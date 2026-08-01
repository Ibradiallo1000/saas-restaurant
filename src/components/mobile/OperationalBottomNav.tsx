"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { signOut } from "firebase/auth"
import { LogOut, MoreHorizontal } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useAuth } from "@/firebase"
import { cn } from "@/lib/utils"
import {
  getNavigationByRole,
  type OperationalDrawerItem,
  type OperationalNavItem,
} from "@/components/mobile/operational-navigation"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import {
  getOwnerMobileDestination,
  preserveOwnerTimeParams,
} from "@/config/owner-navigation"
import { ROLES } from "@/lib/constants"
import { resolveStaffDisplayName } from "@/lib/staff-identity"

export default function OperationalBottomNav() {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const { role, user, profile } = useTenant()
  const { cashSessionRequests, pendingCashValidationCount, unpaidServedCount } = useRestaurantLiveData()
  const [open, setOpen] = React.useState(false)
  const userLabel = resolveStaffDisplayName(profile?.staffProfile, user)
  const navigation = React.useMemo(() => {
    const current = getNavigationByRole(role)
    return {
      bottomItems: current.bottomItems.map((item) => ({
        ...item,
        href: role === ROLES.OWNER ? preserveOwnerTimeParams(item.href, searchParams) : item.href,
      })),
      drawerSections: current.drawerSections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.type === "link"
            ? {
                ...item,
                href: role === ROLES.OWNER ? preserveOwnerTimeParams(item.href, searchParams) : item.href,
              }
            : item
        ),
      })),
    }
  }, [role, searchParams])
  const bottomItems = React.useMemo(
    () =>
      navigation.bottomItems.map((item) => ({
        ...item,
        badge:
          item.id === "orders"
            ? unpaidServedCount
            : item.id === "cash"
              ? cashSessionRequests.length + pendingCashValidationCount
              : undefined,
      })),
    [cashSessionRequests.length, navigation.bottomItems, pendingCashValidationCount, unpaidServedCount]
  )
  const ownerDestination = role === ROLES.OWNER ? getOwnerMobileDestination(pathname) : null
  const drawerActive = role === ROLES.OWNER
    ? ownerDestination === "more"
    : navigation.drawerSections.some((section) =>
        section.items.some((item) => item.type === "link" && isActivePath(pathname, item.href))
      )

  const handleLogout = React.useCallback(async () => {
    setOpen(false)
    await signOut(auth)
    router.push("/login")
  }, [auth, router])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid h-16 grid-cols-5">
        {bottomItems.map((item) => (
          <BottomNavLink
            key={item.id}
            item={item}
            active={
              role === ROLES.OWNER
                ? ownerDestination === item.id
                : isActivePath(pathname, item.href)
            }
          />
        ))}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-bold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                (open || drawerActive) && "bg-primary/10 text-primary"
              )}
              aria-label="Ouvrir le menu secondaire"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="truncate">Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl p-0 md:hidden">
            <SheetHeader className="border-b p-3 text-left">
              <SheetTitle className="text-base">Plus</SheetTitle>
              <SheetDescription className="sr-only">
                Profil, déconnexion et accès autorisés selon le rôle.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3 p-3">
              {navigation.drawerSections.map((section) => (
                <section key={section.label} className="space-y-2">
                  <h3 className="px-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </h3>
                  <div className="grid gap-2">
                    {role === ROLES.MANAGER && section.label === "Compte"
                      ? <ManagerAccountRow userLabel={userLabel} onLogout={handleLogout} />
                      : section.items.map((item) => renderDrawerItem(item, userLabel, role, handleLogout))}
                  </div>
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}

function ManagerAccountRow({ userLabel, onLogout }: { userLabel: string; onLogout: () => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-3">
      <p className="min-w-0 truncate text-sm font-black">{userLabel} <span className="font-medium text-muted-foreground">· Manager</span></p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onLogout} aria-label="Se déconnecter" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Se déconnecter</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

function BottomNavLink({ item, active }: { item: OperationalNavItem; active: boolean }) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-bold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
        active && "bg-primary/10 text-primary"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-full truncate">{item.label}</span>
      {item.badge ? (
        <span className="absolute right-2 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  )
}

function renderDrawerItem(
  item: OperationalDrawerItem,
  userLabel: string,
  role: string | null,
  onLogout: () => void
) {
  const Icon = item.icon

  if (item.type === "profile") {
    return (
      <div key={item.id} className="flex min-h-11 items-center gap-3 rounded-xl border bg-card px-3">
        <Icon className="h-5 w-5 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{userLabel}</p>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">{role}</p>
        </div>
      </div>
    )
  }

  if (item.type === "logout") {
    return (
      <button
        key={item.id}
        type="button"
        onClick={onLogout}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-black text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon className="h-5 w-5" />
        {item.label}
      </button>
    )
  }

  return (
    <SheetClose key={item.id} asChild>
      <Link href={item.href} className="flex min-h-11 items-center gap-3 rounded-xl border bg-card px-3 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Icon className="h-5 w-5 text-primary" />
        <span>{item.label}</span>
      </Link>
    </SheetClose>
  )
}

function isActivePath(pathname: string, href: string) {
  const hrefPath = href.split("?")[0]
  if (
    hrefPath === "/manager/inventory" &&
    (pathname === "/manager/stock" || pathname.startsWith("/manager/stock/"))
  ) {
    return true
  }
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`)
}
