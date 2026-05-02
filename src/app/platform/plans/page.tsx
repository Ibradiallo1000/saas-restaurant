"use client"

import * as React from "react"
import { useFirestore } from "@/firebase"
import { collection, addDoc, Timestamp, query, where, getDocs } from "firebase/firestore"

import { PLAN_TEMPLATES } from "@/config/planTemplates"

import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card"

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

type PlanKey = keyof typeof PLAN_TEMPLATES

export default function AdminPlansPage() {
  const db = useFirestore()
  const { toast } = useToast()

  const [selectedPlan, setSelectedPlan] = React.useState<PlanKey>("starter")
  const [price, setPrice] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const template = PLAN_TEMPLATES[selectedPlan]

  React.useEffect(() => {
    if (template) {
      setPrice(String(template.price))
    }
  }, [selectedPlan, template])

  const handleCreate = async () => {
    if (!db || !template) return

    if (!price || isNaN(Number(price))) {
      toast({
        variant: "destructive",
        title: "Prix invalide"
      })
      return
    }

    setLoading(true)

    try {
      // 🔥 CHECK DUPLICATE
      const q = query(
        collection(db, "plans"),
        where("name", "==", template.name)
      )

      const snap = await getDocs(q)

      if (!snap.empty) {
        toast({
          variant: "destructive",
          title: "Ce plan existe déjà"
        })
        setLoading(false)
        return
      }

      // 🔥 CREATE PLAN
      await addDoc(collection(db, "plans"), {
        name: template.name,
        code: selectedPlan, // 🔥 IMPORTANT (clé technique)
        price: Number(price),
        currency: "XOF",

        features: template.features,
        limits: template.limits,

        fees: {
          digitalPercent: 0,
          posFixed: 0,
        },

        billing: {
          minMonthly: 0,
        },

        type: selectedPlan === "starter" ? "trial" : "paid",
        isActive: true,
        createdAt: Timestamp.now(),
      })

      toast({ title: "Plan créé avec succès" })

    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Créer un plan (automatique)</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* SELECT PLAN */}
          <Select
            value={selectedPlan}
            onValueChange={(val) => setSelectedPlan(val as PlanKey)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un plan" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          {/* PRICE */}
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          {/* PREVIEW */}
          <div className="text-sm text-muted-foreground">
            Features :
            <pre className="bg-muted p-2 rounded mt-1 text-xs">
              {JSON.stringify(template.features, null, 2)}
            </pre>
          </div>

          <Button onClick={handleCreate} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Créer le plan"}
          </Button>

        </CardContent>
      </Card>

    </div>
  )
}