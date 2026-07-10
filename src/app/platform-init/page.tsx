
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser } from "@/firebase"
import { doc, setDoc, collection, getDocs, query, limit, serverTimestamp } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Loader2, AlertTriangle, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePlatform } from "@/contexts/platform-context"

/**
 * @fileOverview Page d'initialisation sécurisée.
 * Permet de créer le TOUT PREMIER super_admin si la collection est vide.
 */
export default function PlatformInitPage() {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const { settings } = usePlatform()
  const [checking, setChecking] = React.useState(true)
  const [canInit, setCanInit] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    async function checkExistingAdmins() {
      if (!db) return
      try {
        const q = query(collection(db, COLLECTION_NAMES.USERS), limit(1))
        const snapshot = await getDocs(q)
        setCanInit(snapshot.empty)
      } catch (error) {
        console.error("Erreur de vérification:", error)
      } finally {
        setChecking(false)
      }
    }
    checkExistingAdmins()
  }, [db])

  const handleInitialize = async () => {
    if (!user || !db || !canInit) return
    setLoading(true)

    try {
      const adminRef = doc(db, COLLECTION_NAMES.USERS, user.uid)
      await setDoc(adminRef, {
        id: user.uid,
        email: user.email,
        role: ROLES.SUPER_ADMIN,
        active: true,
        createdAt: serverTimestamp(),
      })

      toast({
        title: "Succès !",
        description: "Vous êtes maintenant le Super Admin de la plateforme.",
      })
      router.push("/platform")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer le profil administrateur.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (isUserLoading || checking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Vérification du système...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full border-none shadow-2xl text-center">
          <CardHeader>
            <AlertTriangle className="h-12 w-12 text-[var(--brand-primary)] mx-auto mb-4" />
            <CardTitle>Connexion Requise</CardTitle>
            <CardDescription>Vous devez être connecté pour initialiser la plateforme.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push("/login")}>Aller au Login</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 animate-in fade-in duration-700">
      <Card className="max-w-md w-full border-none shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-primary text-primary-foreground p-8 text-center">
          <div className="h-16 w-16 bg-background/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Initialisation SaaS</CardTitle>
          <CardDescription className="text-white/80">Configuration du premier accès administrateur</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6 text-center">
          {canInit ? (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-sm italic">
                <p>Aucun administrateur n'a été détecté dans le système.</p>
                <p className="mt-2 font-bold text-primary">Email actuel : {user.email}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                En cliquant sur le bouton ci-dessous, vous deviendrez le <strong>Super Admin</strong> de {settings.name}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 text-sm text-destructive font-bold">
                Action Interdite : Un administrateur existe déjà.
              </div>
              <p className="text-xs text-muted-foreground">
                Cette page est désactivée par mesure de sécurité car le système est déjà initialisé.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-8 pt-0">
          {canInit ? (
            <Button 
              className="w-full h-14 text-lg font-black uppercase italic shadow-xl" 
              onClick={handleInitialize}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2 h-5 w-5" />}
              Devenir Super Admin
            </Button>
          ) : (
            <Button variant="outline" className="w-full h-12" onClick={() => router.push("/login")}>
              Retour au Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
