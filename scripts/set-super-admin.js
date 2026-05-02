const admin = require("firebase-admin")
const dotenv = require("dotenv")

dotenv.config({ path: ".env.local" })
dotenv.config()

const uid = process.argv[2]

if (!uid) {
  console.error("Usage: npm run set-super-admin -- <firebase-auth-uid>")
  process.exit(1)
}

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID.")
  process.exit(1)
}

function getCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountJson) {
    return admin.credential.cert(JSON.parse(serviceAccountJson))
  }

  return admin.credential.applicationDefault()
}

async function main() {
  admin.initializeApp({
    credential: getCredential(),
    projectId,
  })

  const user = await admin.auth().getUser(uid)

  await admin.firestore().collection("users").doc(uid).set({
    id: uid,
    email: user.email || null,
    role: "super_admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  console.log("Firestore role applied.")
  console.log({
    uid: user.uid,
    email: user.email,
    projectId,
    path: `users/${uid}`,
    role: "super_admin",
  })
}

main().catch((error) => {
  console.error("Failed to set Firestore role.")
  console.error(error)
  process.exit(1)
})
