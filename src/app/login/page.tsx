"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useFirestore } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"

export default function LoginPage() {
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)

    try {
      // 🔐 AUTH
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid

      let userProfile: any = null
      let userDocId: string | null = null

      // 🔥 1. PRIORITÉ → doc direct
      const userRef = doc(db, COLLECTION_NAMES.USERS, uid)
      const userSnap = await getDoc(userRef)

      if (userSnap.exists()) {
        userProfile = userSnap.data()
        userDocId = uid
      } else {
        // 🔥 fallback ancien système
        const q = query(
          collection(db, COLLECTION_NAMES.USERS),
          where("authUid", "==", uid)
        )

        const snap = await getDocs(q)

        if (!snap.empty) {
          const docSnap = snap.docs[0]
          userProfile = docSnap.data()
          userDocId = docSnap.id
        }
      }

      if (!userProfile || !userDocId) {
        throw new Error("Aucun profil utilisateur lié.")
      }

      // 🔥 AUTO FIX
      if (!userProfile.authUid) {
        await updateDoc(doc(db, COLLECTION_NAMES.USERS, userDocId), {
          authUid: uid
        })
      }

      // 🔀 ROUTING CORRIGÉ
      if (userProfile.role === "super_admin") {
        router.push("/platform")
        return
      }

      if (userProfile.restaurantId) {
        // ✅ FIX ICI
        router.push("/dashboard")
        return
      }

      throw new Error("Profil incomplet.")

    } catch (error: any) {
      console.error(error)

      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Identifiants incorrects"
      })

      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden">

        <CardHeader className="bg-primary text-white py-10 text-center">
          <div className="flex justify-center mb-4">
            <Zap className="h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-black italic uppercase">
            Connexion
          </CardTitle>
          <CardDescription className="text-white/80">
            Accès sécurisé
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Mot de passe</Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button className="w-full" disabled={loading}>
              {loading
                ? <Loader2 className="animate-spin" />
                : "Se connecter"}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}