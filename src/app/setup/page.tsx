"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { RestaurantService } from "@/services/restaurant.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Building2, Save, Loader2, ShieldCheck } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { COLLECTION_NAMES } from "@/lib/constants"

export default function SetupPage() {
  const { t } = useTranslation()
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    const r = doc(db, COLLECTION_NAMES.USERS, user.uid)
    return Object.assign(r, { __memo: true })
  }, [db, user])
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)

  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    country: "CI",
    currency: "XOF"
  })

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !db) return

    setLoading(true)
    const restaurantService = new RestaurantService(db)

    try {
      await restaurantService.createRestaurant(user.uid, user.email || '', formData)
      
      toast({
        title: t.common.success,
        description: t.setup.creating,
      })
      
      router.push("/dashboard")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.common.error,
        description: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (profile?.restaurantId) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-4 bg-primary/10 text-primary rounded-xl border border-primary/20 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6" />
          <p className="font-medium text-sm">Compte associé à : {profile.restaurantId}</p>
        </div>
        <Button onClick={() => router.push("/dashboard")} className="w-full">
          Aller au Tableau de Bord
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-10 animate-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-8 w-8" />
            <CardTitle className="text-2xl font-black italic uppercase">{t.setup.title}</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            {t.setup.description}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateRestaurant}>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t.setup.restaurantName}</Label>
              <Input 
                id="name" 
                placeholder="Ex: Le Petit Bistro" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t.setup.slug}</Label>
              <Input 
                id="slug" 
                placeholder="le-petit-bistro" 
                required 
                value={formData.slug}
                onChange={e => setFormData({...formData, slug: e.target.value})}
              />
              <p className="text-[10px] text-muted-foreground italic">
                {t.setup.slugHint}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.setup.country}</Label>
                <Select 
                  defaultValue={formData.country} 
                  onValueChange={v => setFormData({...formData, country: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BJ">Bénin</SelectItem>
                    <SelectItem value="BF">Burkina Faso</SelectItem>
                    <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                    <SelectItem value="SN">Sénégal</SelectItem>
                    <SelectItem value="ML">Mali</SelectItem>
                    <SelectItem value="TG">Togo</SelectItem>
                    <SelectItem value="GN">Guinée</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.setup.currency}</Label>
                <Select 
                  defaultValue={formData.currency} 
                  onValueChange={v => setFormData({...formData, currency: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XOF">FCFA (XOF)</SelectItem>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                    <SelectItem value="USD">Dollar ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-secondary/30">
            <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t.setup.submit}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
