"use client"

import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { AppErrorBoundary } from "@/components/layout/app-error-boundary"
import { PermissionDenied } from "@/components/layout/app-states"
import { SidebarSkeleton } from "@/components/layout/sidebar-skeleton"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { SidebarProvider } from "@/components/ui/sidebar"
import { RestaurantProvider, useRestaurant } from "@/design-system/context/RestaurantContext"
import { TenantProvider, useTenant } from "@/design-system/context/TenantProvider"
import { RestaurantThemeProvider } from "@/design-system/theme/RestaurantThemeProvider"

type ProtectedAppShellProps = {
  children: React.ReactNode
  mode: "dashboard" | "platform"
}

const AppSidebar = dynamic(
  () => import("@/components/layout/app-sidebar").then((mod) => mod.AppSidebar),
  {
    ssr: false,
    loading: () => <SidebarSkeleton />,
  }
)

export function ProtectedAppShell({ children, mode }: ProtectedAppShellProps) {
  return (
    <TenantProvider>
      <RestaurantProvider>
        <RestaurantThemeProvider>
          <ProtectedAppShellContent mode={mode}>{children}</ProtectedAppShellContent>
        </RestaurantThemeProvider>
      </RestaurantProvider>
    </TenantProvider>
  )
}

function ProtectedAppShellContent({ children, mode }: ProtectedAppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const tenant = useTenant()
  const restaurant = useRestaurant()
  const [isNavigating, setIsNavigating] = React.useState(false)
  const navigationStartPathRef = React.useRef<string | null>(null)
  const isLoading = tenant.loading || restaurant.loading
  const requiresPlatformRole = mode === "platform"
  const hasPlatformAccess = !requiresPlatformRole || tenant.isSuperAdmin
  const shouldRedirectToLogin = !isLoading && !tenant.user
  const mainClassName =
    mode === "platform"
      ? "flex-1 overflow-y-auto px-4 py-8 md:px-8"
      : "flex-1 overflow-y-auto px-4 py-6 md:px-8"
  const containerClassName =
    mode === "platform"
      ? "app-background flex min-h-screen w-full"
      : "flex min-h-screen w-full"

  React.useEffect(() => {
    if (!shouldRedirectToLogin) return

    const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : ""
    router.replace(`/login${next}`)
  }, [pathname, router, shouldRedirectToLogin])

  React.useEffect(() => {
    const handleNavigationStart = () => {
      navigationStartPathRef.current = pathname ?? null
      setIsNavigating(true)
    }

    window.addEventListener("app:navigation-start", handleNavigationStart)

    return () => {
      window.removeEventListener("app:navigation-start", handleNavigationStart)
    }
  }, [pathname])

  React.useEffect(() => {
    if (!isNavigating) return
    if (pathname === navigationStartPathRef.current) return

    const timer = window.setTimeout(() => {
      navigationStartPathRef.current = null
      setIsNavigating(false)
    }, 100)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isNavigating, pathname])

  React.useEffect(() => {
    if (!isNavigating) return

    const fallbackTimer = window.setTimeout(() => {
      navigationStartPathRef.current = null
      setIsNavigating(false)
    }, 5000)

    return () => {
      window.clearTimeout(fallbackTimer)
    }
  }, [isNavigating])

  const shouldShowPageLoader = isNavigating && !isLoading && !shouldRedirectToLogin

  return (
    <SidebarProvider defaultOpen>
      <div className={containerClassName}>
        {isLoading || shouldRedirectToLogin ? <SidebarSkeleton /> : <AppSidebar />}
        <main className={mainClassName}>
          <AppErrorBoundary key={pathname}>
            {isLoading || shouldRedirectToLogin ? (
              <AdminRouteSkeleton />
            ) : hasPlatformAccess ? (
              <React.Suspense fallback={<PageLoader />}>
                {shouldShowPageLoader ? <PageLoader /> : children}
              </React.Suspense>
            ) : (
              <PermissionDenied />
            )}
          </AppErrorBoundary>
        </main>
      </div>
    </SidebarProvider>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-[calc(100vh-3rem)] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
      </div>
    </div>
  )
}
