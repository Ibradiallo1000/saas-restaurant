
"use client"

/**
 * @fileOverview Page de connexion déterministe.
 * Redirection basée sur le Realm (Platform vs Restaurant).
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
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
        description: "Compte non reconnu par le système SaaS. Veuillez contacter l'administrateur." 
      })
    }
  }, [user, platformProfile, userProfile, isPlatformChecking, isUserChecking, router, toast])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    
    // On initie la connexion. Si elle échoue, on affiche un toast.
    // L'état de succès est géré par l'observateur onAuthStateChanged dans le Provider.
    signInWithEmailAndPassword(auth, email, password)
      .catch((error) => {
        setLoading(false)
        console.error("Login Error:", error.code)
        toast({ 
          variant: "destructive", 
          title: "Erreur d'authentification", 
          description: "Email ou mot de passe incorrect, ou compte inexistant." 
        })
      })

    toast({ title: "Identification", description: "Vérification des accès en cours..." })
  }

  if (isUserLoading || (user && (isPlatformChecking || isUserChecking))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Chargement de votre session...</p>
      </div>
    )
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
                <Input 
                  id="login-email" 
                  type="email" 
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
              <Button type="submit" className="w-full h-14 text-lg font-black uppercase italic" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
                {loading ? "Vérification..." : "Entrer dans le Système"}
              </Button>
            </CardFooter>
          </form>
        </div>
      </Card>
    </div>
  )
}
