"use client"

import * as React from "react"
import { useFirestore } from "@/firebase"
import { collection, addDoc, Timestamp, query, where, getDocs, limit } from "firebase/firestore"

import { PLAN_TEMPLATES } from "@/config/planTemplates"

import { useToast } from "@/hooks/use-toast"
import { PlatformPlansView } from "./PlatformPlansView"
import { buildPlatformPlanTemplateViewModel } from "./platform-plans-view-model"

type PlanKey = keyof typeof PLAN_TEMPLATES

export default function AdminPlansPage() {
  const db = useFirestore()
  const { toast } = useToast()

  const [selectedPlan, setSelectedPlan] = React.useState<PlanKey>("starter")
  const [price, setPrice] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const template = PLAN_TEMPLATES[selectedPlan]
  const viewModel = React.useMemo(() => buildPlatformPlanTemplateViewModel(selectedPlan, template), [selectedPlan, template])

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
        where("name", "==", template.name),
        limit(1)
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

  return <PlatformPlansView selectedPlan={selectedPlan} price={price} loading={loading} template={viewModel} onSelectedPlanChange={(value) => setSelectedPlan(value as PlanKey)} onPriceChange={setPrice} onCreate={() => void handleCreate()} />
}
