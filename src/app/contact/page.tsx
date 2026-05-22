
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore } from "@/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { MessageSquare, Send, CheckCircle2, Building2, User, Phone, Mail, MapPin } from "lucide-react"
import { usePlatform } from "@/contexts/platform-context"

export default function ContactRequestPage() {
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const { settings } = usePlatform()
  const [loading, setLoading] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const [formData, setFormData] = React.useState({
    restaurantName: "",
    managerName: "",
    phone: "",
    email: "",
    city: "",
    establishmentType: "restaurant",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db) return
    setLoading(true)

    try {
      await addDoc(collection(db, COLLECTION_NAMES.CONTACT_REQUESTS), {
        ...formData,
        status: 'new',
        createdAt: serverTimestamp(),
      })
      
      setSubmitted(true)
      toast({
        title: "Demande envoyée",
        description: "Un conseiller vous contactera sous 24h.",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-12 w-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">C'est Reçu !</h1>
          <p className="text-muted-foreground">
            Votre demande d'accès à la plateforme {settings.name} a bien été enregistrée. 
            Nos équipes vont l'analyser et vous recontacter très prochainement.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
          Retour à l'accueil
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 animate-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-primary text-primary-foreground p-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-background/20 rounded-2xl backdrop-blur-md">
              <MessageSquare className="h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-4xl font-black italic uppercase tracking-tighter">Demander un Accès</CardTitle>
          <CardDescription className="text-white/80 text-lg">
            Rejoignez l'élite de la restauration africaine digitale.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="restaurantName">Nom de l'établissement</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="restaurantName" 
                    placeholder="Ex: Le Palais de la Mer" 
                    required 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.restaurantName}
                    onChange={e => setFormData({...formData, restaurantName: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="managerName">Nom du responsable</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="managerName" 
                    placeholder="Prénom et Nom" 
                    required 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.managerName}
                    onChange={e => setFormData({...formData, managerName: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Numéro WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="phone" 
                    type="tel"
                    placeholder="+225 00 00 00 00" 
                    required 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email professionnel</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="contact@etablissement.com" 
                    required 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville & Pays</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="city" 
                    placeholder="Abidjan, Côte d'Ivoire" 
                    required 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type d'établissement</Label>
                <Select value={formData.establishmentType} onValueChange={v => setFormData({...formData, establishmentType: v})}>
                  <SelectTrigger className="h-12 bg-secondary/30 border-none rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurant Classique</SelectItem>
                    <SelectItem value="hotel">Hôtel / Résidence</SelectItem>
                    <SelectItem value="fastfood">Fast Food / Snack</SelectItem>
                    <SelectItem value="catering">Traiteur / Cloud Kitchen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 pt-0">
            <Button type="submit" className="w-full h-14 text-lg font-black uppercase italic shadow-2xl" disabled={loading}>
              {loading ? "Envoi en cours..." : <><Send className="mr-2 h-5 w-5" /> Envoyer ma demande</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="text-center text-xs text-muted-foreground mt-8 italic">
        En soumettant ce formulaire, vous acceptez d'être recontacté par un conseiller {settings.name}.
      </p>
    </div>
  )
}
