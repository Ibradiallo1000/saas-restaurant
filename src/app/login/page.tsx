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
import { doc, getDoc } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { getRoleHomePath } from "@/lib/guards"

export default function LoginPage() {
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    router.prefetch("/dashboard")
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)

    try {
      // 🔐 AUTH
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid
      clearAuthSessionCache(uid)

      const userRef = doc(db, COLLECTION_NAMES.USERS, uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        throw new Error("Aucun profil utilisateur lie.")
      }

      const userProfile: any = userSnap.data()

      if (userProfile.role === "super_admin") {
        router.prefetch("/platform")
        router.push("/platform")
        return
      }

      if (userProfile.restaurantId) {
        const homePath = getRoleHomePath(userProfile.role)
        router.prefetch(homePath)
        router.push(homePath)
        return
      }

      throw new Error("Compte non lié à un restaurant")
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

function clearAuthSessionCache(uid: string) {
  if (typeof window === "undefined") return

  window.localStorage.removeItem(`restaurant-active-role:${uid}`)
  window.sessionStorage.clear()
}
