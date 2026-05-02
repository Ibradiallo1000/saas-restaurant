"use client"

import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { useFeature } from "@/hooks/use-feature"
import type { FeatureModule } from "@/types"

export function FeatureGate({ module, children }: { module: FeatureModule; children: ReactNode }) {
  const enabled = useFeature(module)

  if (enabled) return <>{children}</>

  return (
    <Card>
      <CardContent className="flex min-h-48 items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-xl font-semibold">Module désactivé</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce module n'est pas inclus dans l'abonnement actuel.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
