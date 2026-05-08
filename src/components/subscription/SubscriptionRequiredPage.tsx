"use client"

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function SubscriptionRequiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md border-destructive/20">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Votre abonnement a expire</h1>
            <p className="text-sm text-muted-foreground">
              Veuillez contacter le support ou payer pour reactiver votre acces.
            </p>
          </div>
          <Button asChild className="w-full">
            <a href="mailto:support@gastronomeai.com">Contacter le support</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
