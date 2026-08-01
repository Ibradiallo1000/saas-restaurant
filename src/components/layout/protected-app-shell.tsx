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
import { getRoleHomePath, isRouteAllowedForRole } from "@/lib/guards"
import { ROLES } from "@/lib/constants"
import OperationalBottomNav from "@/components/mobile/OperationalBottomNav"
import OperationalMobileHeader from "@/components/mobile/OperationalMobileHeader"
import { RestaurantLiveDataProvider } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { TimeFilterProvider } from "@/contexts/time-filter-context"

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
          <TimeFilterProvider>
            <RestaurantLiveDataProvider>
              <ProtectedAppShellContent mode={mode}>{children}</ProtectedAppShellContent>
            </RestaurantLiveDataProvider>
          </TimeFilterProvider>
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
  const [loginRedirectReady, setLoginRedirectReady] = React.useState(false)
  const [ownerSidebarOpen, setOwnerSidebarOpen] = React.useState(true)
  const isLoading = tenant.loading || restaurant.loading
  const requiresPlatformRole = mode === "platform"
  const hasPlatformAccess = !requiresPlatformRole || tenant.isSuperAdmin
  const shouldRedirectToLogin = !isLoading && !tenant.user && loginRedirectReady
  const routeRole = tenant.isSuperAdmin ? "super_admin" : tenant.role
  const isAllowedForRole = isRouteAllowedForRole(pathname ?? "/", routeRole as any)
  const roleHomePath = getRoleHomePath(routeRole as any)
  const isFullscreenRoute =
    (pathname ?? "").startsWith("/pos") || (pathname ?? "").startsWith("/kitchen")
  const shouldShowOperationalBottomNav =
    mode === "dashboard" &&
    (tenant.role === ROLES.OWNER || tenant.role === ROLES.MANAGER) &&
    !isFullscreenRoute
  const shouldShowOperationalMobileHeader = shouldShowOperationalBottomNav
  const mainClassName =
    mode === "platform"
      ? "flex-1 overflow-y-auto px-4 py-8 md:px-8"
      : isFullscreenRoute
        ? "flex-1 overflow-y-auto"
      : shouldShowOperationalMobileHeader
        ? "flex-1 overflow-y-auto px-4 pb-[calc(80px+env(safe-area-inset-bottom))] pt-[calc(56px+env(safe-area-inset-top)+16px)] md:px-8 md:pb-8 md:pt-6"
        : "flex-1 overflow-y-auto px-4 pb-[calc(80px+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-8"
  const containerClassName =
    mode === "platform"
      ? "app-background flex min-h-screen w-full"
      : "app-background flex min-h-screen w-full text-foreground"
  const isRedirectingForRole =
    !isLoading &&
    !shouldRedirectToLogin &&
    mode !== "platform" &&
    tenant.user &&
    !isAllowedForRole

  React.useEffect(() => {
    if (isLoading || tenant.user) {
      setLoginRedirectReady(false)
      return
    }

    const timer = window.setTimeout(() => setLoginRedirectReady(true), 600)
    return () => window.clearTimeout(timer)
  }, [isLoading, tenant.user])

  React.useEffect(() => {
    if (!shouldRedirectToLogin) return

    const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : ""
    router.replace(`/login${next}`)
  }, [pathname, router, shouldRedirectToLogin])

  React.useEffect(() => {
    if (isLoading || shouldRedirectToLogin || mode === "platform") return
    if (!isAllowedForRole) router.replace(roleHomePath)
  }, [isAllowedForRole, isLoading, mode, roleHomePath, router, shouldRedirectToLogin])

  React.useEffect(() => {
    if (tenant.role !== ROLES.OWNER) return

    const desktopQuery = window.matchMedia("(min-width: 1024px)")
    const adaptOwnerSidebar = () => setOwnerSidebarOpen(desktopQuery.matches)
    adaptOwnerSidebar()
    desktopQuery.addEventListener("change", adaptOwnerSidebar)
    return () => desktopQuery.removeEventListener("change", adaptOwnerSidebar)
  }, [tenant.role])

  const shouldShowPageLoader = isRedirectingForRole && !isLoading && !shouldRedirectToLogin

  return (
    <SidebarProvider
      defaultOpen
      open={tenant.role === ROLES.OWNER ? ownerSidebarOpen : undefined}
      onOpenChange={tenant.role === ROLES.OWNER ? setOwnerSidebarOpen : undefined}
      style={{
        "--sidebar-width-icon": tenant.role === ROLES.OWNER ? "4.25rem" : "10rem",
      } as React.CSSProperties}
    >
      <div className={containerClassName}>
        {isFullscreenRoute ? null : isLoading || shouldRedirectToLogin ? <SidebarSkeleton /> : <AppSidebar />}
        {shouldShowOperationalMobileHeader ? <OperationalMobileHeader /> : null}
        <main className={mainClassName}>
          <AppErrorBoundary key={pathname}>
            {isLoading || shouldRedirectToLogin || (!tenant.user && !loginRedirectReady) || isRedirectingForRole ? (
              <AdminRouteSkeleton />
            ) : hasPlatformAccess && (mode === "platform" || isAllowedForRole) ? (
              <React.Suspense fallback={<PageLoader />}>
                {shouldShowPageLoader ? <PageLoader /> : children}
              </React.Suspense>
            ) : (
              <PermissionDenied />
            )}
          </AppErrorBoundary>
        </main>
        {shouldShowOperationalBottomNav ? <OperationalBottomNav /> : null}
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
