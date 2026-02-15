"use client"

/**
 * @fileOverview Page de connexion déterministe.
 * Architecture : Redirection par Realm (Platform vs Restaurant).
 * Plus de fallback de provisionnement automatique pour garantir la sécurité.
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

  // 1. Détection Realm Plateforme
  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformChecking } = useDoc(platformUserRef)

  // 2. Détection Realm Restaurant
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: isUserChecking } = useDoc(userProfileRef)

  // 3. Logique de redirection déterministe
  React.useEffect(() => {
    if (!user || isPlatformChecking || isUserChecking) return

    // Priorité 1 : Admin Plateforme (SuperAdmin / Admin)
    if (platformProfile) {
      router.push("/platform")
      return
    }

    // Priorité 2 : Utilisateur Restaurant (Owner / Staff)
    if (userProfile) {
      router.push("/dashboard")
      return
    }

    // Cas : Utilisateur non reconnu par le système SaaS
    if (!isPlatformChecking && !isUserChecking && !platformProfile && !userProfile) {
      toast({ 
        variant: "destructive", 
        title: "Accès non autorisé", 
        description: "Ce compte n'est lié à aucun établissement provisionné." 
      })
    }
  }, [user, platformProfile, userProfile, isPlatformChecking, isUserChecking, router, toast])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    initiateEmailSignIn(auth, email, password)
    toast({
      title: "Identification",
      description: "Connexion sécurisée en cours...",
    })
    setLoading(false)
  }

  if (isUserLoading || (user && (isPlatformChecking || isUserChecking))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md border-none shadow-2xl bg-card overflow-hidden rounded-3xl">
        <CardHeader className="space-y-1 text-center bg-primary text-primary-foreground py-10">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Zap className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Connexion SaaS</CardTitle>
          <CardDescription className="text-white/80">
            Accédez à votre espace sécurisé.
          </CardDescription>
        </CardHeader>
        
        <div className="p-6">
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 px-0">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email Professionnel</Label>
                <Input 
                  id="login-email" 
                  type="email" 
                  placeholder="votre@email.com" 
                  required 
                  className="h-12 bg-secondary/30 border-none rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input 
                  id="login-password" 
                  type="password" 
                  required 
                  className="h-12 bg-secondary/30 border-none rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="px-0 pt-4">
              <Button type="submit" className="w-full h-14 text-lg font-black uppercase italic shadow-xl" disabled={loading}>
                <LogIn className="mr-2 h-5 w-5" /> {loading ? "Vérification..." : "Entrer dans le Système"}
              </Button>
            </CardFooter>
          </form>
        </div>
      </Card>
    </div>
  )
}