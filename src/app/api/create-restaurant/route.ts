import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  buildRestaurantLocationPayload,
  normalizeCountryCode,
  normalizeText,
} from "@/lib/restaurant-location";

export async function POST(req: NextRequest) {
  try {
    // ===============================
    // 🔐 1. AUTHENTIFICATION
    // ===============================
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const uid = decoded.uid;

    // 🔥 Vérifier rôle
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists || userDoc.data()?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // ===============================
    // 📦 2. DATA VALIDATION
    // ===============================
    const body = await req.json();
    const { email, name, slug, phone, countryCode, cityId, communeId } = body;
    const safeCountryCode = normalizeCountryCode(countryCode);
    const safeCityId = normalizeText(cityId, 100);
    const safeCommuneId = normalizeText(communeId, 100);
    const safeName = normalizeText(name, 140);
    const safeSlug = normalizeText(slug, 140);
    const safeEmail = normalizeText(email, 180).toLowerCase();

    if (!safeEmail || !safeName || !safeSlug || !safeCountryCode || !safeCityId || !safeCommuneId) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 }
      );
    }

    const countryDoc = await adminDb.collection("platformCountries").doc(safeCountryCode).get();
    if (!countryDoc.exists || countryDoc.data()?.isActive === false) {
      return NextResponse.json(
        { error: "Pays indisponible" },
        { status: 400 }
      );
    }

    const cityDoc = await countryDoc.ref.collection("cities").doc(safeCityId).get();
    if (!cityDoc.exists || cityDoc.data()?.isActive === false) {
      return NextResponse.json(
        { error: "Ville indisponible" },
        { status: 400 }
      );
    }

    const communeDoc = await cityDoc.ref.collection("communes").doc(safeCommuneId).get();
    if (!communeDoc.exists || communeDoc.data()?.isActive === false) {
      return NextResponse.json(
        { error: "Commune indisponible" },
        { status: 400 }
      );
    }

    const locationPayload = buildRestaurantLocationPayload({
      phone,
      countryCode: safeCountryCode,
      countryName: countryDoc.data()?.name,
      cityId: safeCityId,
      cityName: cityDoc.data()?.name,
      communeId: safeCommuneId,
      communeName: communeDoc.data()?.name,
      districtName: body.districtName,
      location: body.location || {
        address: body.address,
        googleMapsUrl: body.googleMapsUrl,
        lat: body.lat,
        lng: body.lng,
      },
    });
    const rawLocation = body.location || {
      address: body.address,
      googleMapsUrl: body.googleMapsUrl,
      lat: body.lat,
      lng: body.lng,
    };

    if (!locationPayload.phone) {
      return NextResponse.json(
        { error: "Téléphone requis" },
        { status: 400 }
      );
    }

    const invalidLatitude = rawLocation.lat !== undefined && rawLocation.lat !== null && rawLocation.lat !== "" && locationPayload.location.lat === null;
    const invalidLongitude = rawLocation.lng !== undefined && rawLocation.lng !== null && rawLocation.lng !== "" && locationPayload.location.lng === null;
    if (invalidLatitude || invalidLongitude) {
      return NextResponse.json(
        { error: "Coordonnées GPS invalides" },
        { status: 400 }
      );
    }

    // ===============================
    // 🔥 3. CREATE USER AUTH
    // ===============================
    let userRecord;

    try {
      userRecord = await adminAuth.createUser({
        email: safeEmail,
        emailVerified: false,
      });
    } catch (err: any) {
      if (err.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "Email déjà utilisé" },
          { status: 400 }
        );
      }
      throw err;
    }

    const ownerUid = userRecord.uid;
    const restaurantId = crypto.randomUUID();

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // ===============================
    // 🧠 4. TRANSACTION (CRITIQUE)
    // ===============================
    const batch = adminDb.batch();

    // 🏢 Restaurant
    const restaurantRef = adminDb.collection("restaurants").doc(restaurantId);
    batch.set(restaurantRef, {
      id: restaurantId,
      name: safeName,
      slug: safeSlug,
      ...locationPayload,
      ownerId: ownerUid,
      ownerEmail: safeEmail,
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    // 👤 User profile
    const userRef = adminDb.collection("users").doc(ownerUid);
    batch.set(userRef, {
      id: ownerUid,
      email: safeEmail,
      role: "owner",
      restaurantId,
      active: true,
      createdAt: now
    });

    // 💳 Subscription (🔥 AJOUT MAJEUR)
    const subscriptionId = crypto.randomUUID();
    const subRef = adminDb.collection("subscriptions").doc(subscriptionId);

    batch.set(subRef, {
      id: subscriptionId,
      restaurantId,
      planId: "starter", // ⚠️ adapte si besoin
      status: "active",
      startDate: now,
      endDate: trialEnd,
      trialEndsAt: trialEnd,
      isTrial: true,
      createdAt: now
    });

    // 🔥 EXECUTION ATOMIQUE
    await batch.commit();

    // ===============================
    // 🔗 5. GENERATE INVITE LINK
    // ===============================
    const inviteLink = await adminAuth.generatePasswordResetLink(safeEmail);

    return NextResponse.json({
      success: true,
      inviteLink,
      restaurantId
    });

  } catch (err: any) {
    console.error("CREATE RESTAURANT ERROR:", err);

    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
