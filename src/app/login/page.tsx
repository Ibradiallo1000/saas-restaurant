
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { initiateEmailSignIn } from "@/firebase/non-blocking-login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, LogIn } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/firebase"

export default function LoginPage() {
  const auth = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUser()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")

  React.useEffect(() => {
    if (user) {
      router.push("/")
    }
  }, [user, router])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    
    initiateEmailSignIn(auth, email, password)
    toast({
      title: "Tentative de connexion",
      description: "Vérification de vos identifiants...",
    })
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-2xl shadow-lg">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-black font-headline italic">Connexion</CardTitle>
          <CardDescription>
            Entrez vos accès administrateur GastronomeAI
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@restaurant.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-11">
              <LogIn className="mr-2 h-4 w-4" /> Se connecter
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
