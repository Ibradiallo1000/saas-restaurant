
"use client"

/**
 * @fileOverview Page de connexion centralisée.
 * Gère la redirection intelligente vers /platform ou /dashboard selon l'appartenance de l'utilisateur.
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
import { RestaurantService } from "@/services/restaurant.service"

export default function LoginPage() {
  const auth = useAuth()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const { user, isUserLoading } = useUser()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  // 1. Check if Platform User
  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid)
  }, [db, user])
  const { data: platformProfile, isLoading: isPlatformChecking } = useDoc(platformUserRef)

  // 2. Check if Restaurant User
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: userProfile, isLoading: isUserChecking } = useDoc(userProfileRef)

  // 3. Logic de redirection intelligente
  React.useEffect(() => {
    if (!user || isPlatformChecking || isUserChecking || !db) return

    const checkAndRedirect = async () => {
      // Priorité 1 : Admin Plateforme
      if (platformProfile) {
        router.push("/platform")
        return
      }

      // Priorité 2 : Membre de restaurant
      if (userProfile) {
        router.push("/dashboard")
        return
      }

      // Priorité 3 : Provisionnement automatique (Premier login d'un owner pré-enregistré)
      const restaurantService = new RestaurantService(db)
      const linkedId = await restaurantService.linkUserToRestaurant(user.uid, user.email || '')
      
      if (linkedId) {
        toast({ title: "Configuration terminée", description: "Votre espace restaurant est prêt." })
        router.push("/dashboard")
      } else {
        // Utilisateur égaré
        toast({ variant: "destructive", title: "Accès refusé", description: "Votre compte n'est pas autorisé sur cette plateforme." })
      }
    }

    checkAndRedirect()
  }, [user, platformProfile, userProfile, isPlatformChecking, isUserChecking, router, db, toast])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    initiateEmailSignIn(auth, email, password)
    toast({
      title: "Vérification des accès",
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
          <CardTitle className="text-3xl font-black font-headline italic uppercase tracking-tighter">Accès SaaS</CardTitle>
          <CardDescription className="text-white/80">
            Connectez-vous pour gérer votre établissement ou la plateforme.
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
                <LogIn className="mr-2 h-5 w-5" /> {loading ? "Vérification..." : "Ouvrir ma Session"}
              </Button>
            </CardFooter>
          </form>
          <p className="text-center text-[10px] text-muted-foreground mt-4 italic">
            Seuls les comptes provisionnés par la plateforme peuvent accéder au système.
          </p>
        </div>
      </Card>
    </div>
  )
}
