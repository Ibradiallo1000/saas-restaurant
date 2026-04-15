
"use client"

/**
 * @fileOverview Page de connexion déterministe.
 * Gère la redirection vers /platform pour les admins SaaS ou /dashboard pour les restaurateurs.
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

  // 1. On vérifie si l'utilisateur est un Admin Plateforme
  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformChecking } = useDoc(platformUserRef)

  // 2. On vérifie si l'utilisateur est un membre d'un restaurant
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: isUserChecking } = useDoc(userProfileRef)

  // Logique de redirection automatique dès que les profils sont chargés
  React.useEffect(() => {
    if (!user || isPlatformChecking || isUserChecking) return

    if (platformProfile) {
      toast({ title: "Accès Plateforme", description: "Bienvenue dans votre console Super Admin." })
      router.push("/platform")
      return
    }

    if (userProfile) {
      toast({ title: "Accès Établissement", description: "Bienvenue dans votre dashboard restaurant." })
      router.push("/dashboard")
      return
    }

    // Cas d'un utilisateur sans profil Firestore
    if (!platformProfile && !userProfile && !isPlatformChecking && !isUserChecking) {
      toast({ 
        variant: "destructive", 
        title: "Compte non configuré", 
        description: "Votre email est authentifié mais aucun profil n'a été trouvé dans le système." 
      })
    }
  }, [user, platformProfile, userProfile, isPlatformChecking, isUserChecking, router, toast])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    
    signInWithEmailAndPassword(auth, email, password)
      .catch((error) => {
        setLoading(false)
        console.error("Login Error:", error.code)
        toast({ 
          variant: "destructive", 
          title: "Erreur de connexion", 
          description: "Identifiants incorrects. Veuillez vérifier votre email et mot de passe." 
        })
      })
  }

  if (isUserLoading || (user && (isPlatformChecking || isUserChecking))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Validation de votre domaine d'accès...</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
          <div className="flex justify-center mb-4"><Zap className="h-10 w-10" /></div>
          <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Portail GastronomeAI</CardTitle>
          <CardDescription className="text-white/80">Entrez vos accès sécurisés</CardDescription>
        </CardHeader>
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email Professionnel</Label>
              <Input 
                id="login-email" 
                type="email" 
                required 
                placeholder="nom@exemple.com"
                className="h-12 bg-secondary/50 border-none rounded-xl" 
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
                className="h-12 bg-secondary/50 border-none rounded-xl" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full h-14 text-lg font-black uppercase italic shadow-lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              {loading ? "Vérification..." : "Se connecter"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
