"use client"

import * as React from "react"
import { Building2, Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { createRestaurant } from "@/services/onboarding-api.service"

interface CreateRestaurantModalProps {
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onCreated?: (restaurantId: string) => void
}

export function CreateRestaurantModal({
  defaultOpen = false,
  onOpenChange,
  onCreated,
}: CreateRestaurantModalProps) {
  const { user } = useUser()
  const { toast } = useToast()
  const [open, setOpen] = React.useState(defaultOpen)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    slug: "",
    userId: "",
  })

  const canSubmit =
    form.name.trim().length > 1 &&
    form.email.trim().length > 3 &&
    form.slug.trim().length > 1 &&
    form.userId.trim().length > 1

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const updateName = (name: string) => {
    setForm((current) => ({
      ...current,
      name,
      slug: current.slug ? current.slug : slugify(name),
    }))
  }

  const handleSubmit = async () => {
    if (isSubmitting || !canSubmit) return

    setIsSubmitting(true)

    try {
      const actorToken = await user?.getIdToken()
      const result = await createRestaurant(
        {
          name: form.name,
          email: form.email,
          slug: form.slug,
          userId: form.userId,
        },
        actorToken
      )

      toast({
        title: "Restaurant cree",
        description: "Le restaurant, la compagnie, l'abonnement et le proprietaire sont prets.",
      })

      setForm({
        name: "",
        email: "",
        slug: "",
        userId: "",
      })
      handleOpenChange(false)
      onCreated?.(result.restaurantId)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation impossible",
        description: error?.message || "Le provisioning serveur a echoue.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau restaurant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Creer un restaurant
          </DialogTitle>
          <DialogDescription>Onboarding securise via API serveur.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="restaurant-name">Nom restaurant</Label>
            <Input
              id="restaurant-name"
              value={form.name}
              onChange={(event) => updateName(event.target.value)}
              placeholder="Ex: Le Palais"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="restaurant-slug">Slug public</Label>
            <Input
              id="restaurant-slug"
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: slugify(event.target.value) }))
              }
              placeholder="le-palais"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="restaurant-email">Email proprietaire</Label>
            <Input
              id="restaurant-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="owner@restaurant.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="restaurant-user-id">UID Firebase Auth proprietaire</Label>
            <Input
              id="restaurant-user-id"
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
              placeholder="uid Firebase Auth"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
