const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

const restaurantId = process.argv[2];
const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!restaurantId) {
  console.error("Usage: node scripts/seed-inventory-items.js <restaurantId>");
  process.exit(1);
}

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

const seeds = [
  { id: "poulet", name: "Poulet", unit: "pièce", stockEstimated: 0, costPerUnit: 0, lossRate: 0 },
  { id: "huile", name: "Huile", unit: "litre", stockEstimated: 0, costPerUnit: 0, lossRate: 0 },
  { id: "pain", name: "Pain", unit: "pièce", stockEstimated: 0, costPerUnit: 0, lossRate: 0 },
];

async function main() {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  seeds.forEach((item) => {
    const ref = db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("inventoryItems")
      .doc(item.id);
    batch.set(
      ref,
      {
        name: item.name,
        unit: item.unit,
        stockEstimated: item.stockEstimated,
        lastCountedStock: item.stockEstimated,
        avgDailyConsumption: 0,
        costPerUnit: item.costPerUnit,
        lossRate: item.lossRate,
        createdAt: now,
        updatedAt: now,
        lastCountedAt: now,
      },
      { merge: true }
    );
  });

  await batch.commit();
  console.log(`Seeded ${seeds.length} inventory items for restaurant ${restaurantId}.`);
}

main().catch((error) => {
  console.error("Inventory seed failed:", error);
  process.exitCode = 1;
});
