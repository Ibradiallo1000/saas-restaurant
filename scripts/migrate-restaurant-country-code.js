const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
  process.exit(1);
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    return admin.credential.cert(JSON.parse(serviceAccountJson));
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  return admin.credential.applicationDefault();
}

admin.initializeApp({
  credential: getCredential(),
  projectId,
});

const db = admin.firestore();

const CITY_COUNTRY_CODES = {
  bamako: "ML",
  dakar: "SN",
};

async function main() {
  const snapshot = await db.collection("restaurants").get();
  let batch = db.batch();
  let batchSize = 0;
  let updateCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (typeof data.countryCode === "string" && data.countryCode.trim()) {
      continue;
    }

    const city = typeof data.city === "string" ? data.city.trim().toLowerCase() : "";
    const countryCode = CITY_COUNTRY_CODES[city] ?? "UNKNOWN";

    batch.update(doc.ref, {
      countryCode,
      updatedAt: new Date(),
    });

    updateCount += 1;
    batchSize += 1;

    if (batchSize === 450) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (updateCount === 0) {
    console.log("No restaurants need countryCode migration.");
    return;
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  console.log(`Updated ${updateCount} restaurants with countryCode.`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  console.error(
    "Check Firebase Admin credentials in .env.local: FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, FIREBASE_SERVICE_ACCOUNT_KEY, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
  );
  process.exitCode = 1;
});
