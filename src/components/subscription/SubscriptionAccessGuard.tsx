"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useUser } from "@/firebase"

export function SubscriptionAccessGuard({
  children,
  companyId,
  restaurantId,
}: {
  children: React.ReactNode
  companyId?: string | null
  restaurantId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isUserLoading } = useUser()
  const [isChecking, setIsChecking] = React.useState(true)
  const [isAllowed, setIsAllowed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function checkAccess() {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[auth:subscription-guard]", {
          pathname,
          uid: user?.uid,
          isUserLoading,
          companyId,
          restaurantId,
        })
      }

      if (isUserLoading) return

      if (!user || !restaurantId) {
        setIsAllowed(false)
        setIsChecking(false)
        return
      }

      setIsChecking(true)

      try {
        const token = await user.getIdToken()
        const params = new URLSearchParams({ restaurantId })
        if (companyId) params.set("companyId", companyId)
        const response = await fetch(
          `/api/subscriptions/access?${params.toString()}`,
          {
            headers: {
              authorization: `Bearer ${token}`,
            },
          }
        )
        const result = (await response.json()) as { allowed?: boolean }

        if (cancelled) return

        if (!result.allowed) {
          router.replace("/subscription-required")
          return
        }

        setIsAllowed(true)
      } catch {
        if (!cancelled) {
          router.replace("/subscription-required")
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false)
        }
      }
    }

    checkAccess()

    return () => {
      cancelled = true
    }
  }, [companyId, isUserLoading, pathname, restaurantId, router, user])

  if (isUserLoading || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAllowed) return null

  return <>{children}</>
}
