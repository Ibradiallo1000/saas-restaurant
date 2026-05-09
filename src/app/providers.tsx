// app/providers.tsx
"use client"

import { FirebaseProvider } from "@/firebase/provider"
import { ThemeProvider } from "@/contexts/theme-context"
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Configuration Firebase (remplace par tes valeurs)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialisation unique de Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const firestore = getFirestore(app)
const auth = getAuth(app)

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FirebaseProvider firebaseApp={app} firestore={firestore} auth={auth}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </FirebaseProvider>
  )
}
