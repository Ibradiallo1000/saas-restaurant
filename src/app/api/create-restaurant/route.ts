import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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
    const { email, name, slug, city, phone, countryCode } = body;

    if (!email || !name || !slug || !countryCode) {
      return NextResponse.json(
        { error: "Champs requis manquants" },
        { status: 400 }
      );
    }

    // ===============================
    // 🔥 3. CREATE USER AUTH
    // ===============================
    let userRecord;

    try {
      userRecord = await adminAuth.createUser({
        email,
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
      name,
      slug,
      countryCode: String(countryCode).toUpperCase(),
      city,
      phone,
      ownerId: ownerUid,
      ownerEmail: email.toLowerCase(),
      status: "active",
      createdAt: now
    });

    // 👤 User profile
    const userRef = adminDb.collection("users").doc(ownerUid);
    batch.set(userRef, {
      id: ownerUid,
      email: email.toLowerCase(),
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
    const inviteLink = await adminAuth.generatePasswordResetLink(email);

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
