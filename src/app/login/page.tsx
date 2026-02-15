
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth, useUser } from "@/firebase"
import { initiateEmailSignIn, initiateEmailSignUp } from "@/firebase/non-blocking-login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Zap, LogIn, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const auth = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUser()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      router.push("/dashboard")
    }
  }, [user, router])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    initiateEmailSignIn(auth, email, password)
    toast({
      title: "Connexion en cours",
      description: "Accès à votre espace GastronomeAI...",
    })
    setLoading(false)
  }

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    initiateEmailSignUp(auth, email, password)
    toast({
      title: "Création du compte",
      description: "Initialisation de votre profil de gestion...",
    })
    setLoading(false)
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
          <CardTitle className="text-3xl font-black font-headline italic uppercase tracking-tighter">GastronomeAI</CardTitle>
          <CardDescription className="text-white/80">
            Prenez le contrôle de votre rentabilité culinaire.
          </CardDescription>
        </CardHeader>
        
        <div className="p-6">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 rounded-xl p-1">
              <TabsTrigger value="login" className="rounded-lg font-bold">Connexion</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg font-bold">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="animate-in slide-in-from-left-2 duration-300">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4 px-0">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email Professionnel</Label>
                    <Input 
                      id="login-email" 
                      type="email" 
                      placeholder="votre@restaurant.com" 
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
                  <Button type="submit" className="w-full h-12 text-lg font-black uppercase italic shadow-xl" disabled={loading}>
                    <LogIn className="mr-2 h-5 w-5" /> {loading ? "Connexion..." : "Ouvrir ma Session"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="animate-in slide-in-from-right-2 duration-300">
              <form onSubmit={handleSignUp}>
                <CardContent className="space-y-4 px-0">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Professionnel</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      placeholder="votre@restaurant.com" 
                      required 
                      className="h-12 bg-secondary/30 border-none rounded-xl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input 
                      id="signup-password" 
                      type="password" 
                      required 
                      placeholder="6 caractères min."
                      className="h-12 bg-secondary/30 border-none rounded-xl"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="px-0 pt-4">
                  <Button type="submit" className="w-full h-12 text-lg font-black uppercase italic shadow-xl bg-primary hover:bg-primary/90" disabled={loading}>
                    <UserPlus className="mr-2 h-5 w-5" /> {loading ? "Création..." : "Commencer l'essai"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  )
}
