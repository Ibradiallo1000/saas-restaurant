"use client"

/**
 * @fileOverview Page de connexion déterministe.
 * Redirection basée sur le Realm (Platform vs Restaurant).
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { initiateEmailSignIn } from "@/firebase/non-blocking-login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, LogIn, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { doc } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"

export default function LoginPage() {
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const { user, isUserLoading } = useUser()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformChecking } = useDoc(platformUserRef)

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: isUserChecking } = useDoc(userProfileRef)

  React.useEffect(() => {
    if (!user || isPlatformChecking || isUserChecking) return

    if (platformProfile) {
      router.push("/platform")
      return
    }

    if (userProfile) {
      router.push("/dashboard")
      return
    }

    if (!isPlatformChecking && !isUserChecking && !platformProfile && !userProfile) {
      toast({ 
        variant: "destructive", 
        title: "Accès restreint", 
        description: "Compte non reconnu par le système SaaS." 
      })
    }
  }, [user, platformProfile, userProfile, isPlatformChecking, isUserChecking, router, toast])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    initiateEmailSignIn(auth, email, password)
    toast({ title: "Identification", description: "Vérification en cours..." })
    setLoading(false)
  }

  if (isUserLoading || (user && (isPlatformChecking || isUserChecking))) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
          <div className="flex justify-center mb-4"><Zap className="h-10 w-10" /></div>
          <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Connexion SaaS</CardTitle>
          <CardDescription className="text-white/80">Espace sécurisé GastronomeAI</CardDescription>
        </CardHeader>
        <div className="p-6">
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 px-0">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email Professionnel</Label>
                <Input id="login-email" type="email" required className="h-12 bg-secondary/30 border-none rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input id="login-password" type="password" required className="h-12 bg-secondary/30 border-none rounded-xl" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter className="px-0 pt-4">
              <Button type="submit" className="w-full h-14 text-lg font-black uppercase italic" disabled={loading}>
                <LogIn className="mr-2 h-5 w-5" /> {loading ? "Vérification..." : "Entrer dans le Système"}
              </Button>
            </CardFooter>
          </form>
        </div>
      </Card>
    </div>
  )
}
