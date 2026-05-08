"use client"

import * as React from "react"
import {
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"

import { useFirestore, useUser } from "@/firebase"
import { COLLECTION_NAMES, RESTAURANT_ROLES } from "@/lib/constants"
import { normalizeActiveRole } from "@/lib/guards"
import type {
  CompanySubscription,
  CurrentUserContextValue,
  RestaurantUser,
  RestaurantUserRole,
  SubscriptionModules,
} from "@/types"

const ACTIVE_ROLE_STORAGE_KEY = "restaurant-active-role"

const DEFAULT_MODULES: SubscriptionModules = {
  kitchen: false,
  inventory: false,
  analytics: false,
  multiBranch: false,
}

const CurrentUserContext = React.createContext<CurrentUserContextValue | null>(null)
type CurrentUserState = Omit<CurrentUserContextValue, "setActiveRole" | "user">

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [state, setState] = React.useState<CurrentUserState>({
    firebaseUser: null,
    isLoading: true,
    isAuthenticated: false,
    isSuperAdmin: false,
    companyId: null,
    restaurantId: null,
    staffUser: null,
    roles: [],
    activeRole: null,
    subscription: null,
    modules: DEFAULT_MODULES,
  })

  React.useEffect(() => {
    let cancelled = false

    async function loadCurrentUser() {
      if (isUserLoading) {
        setState((current) => ({ ...current, isLoading: true }))
        return
      }

      if (!db || !user) {
        setState({
          firebaseUser: user ?? null,
          isLoading: false,
          isAuthenticated: Boolean(user),
          isSuperAdmin: false,
          companyId: null,
          restaurantId: null,
          staffUser: null,
          roles: [],
          activeRole: null,
          subscription: null,
          modules: DEFAULT_MODULES,
        })
        return
      }

      setState((current) => ({ ...current, firebaseUser: user, isLoading: true, isAuthenticated: true }))

      try {
        const rootUserSnap = await getDoc(doc(db, COLLECTION_NAMES.USERS, user.uid))
        const rootUser = rootUserSnap.exists() ? rootUserSnap.data() : null

        if (rootUser?.role === "super_admin") {
          if (cancelled) return
          setState({
            firebaseUser: user,
            isLoading: false,
            isAuthenticated: true,
            isSuperAdmin: true,
            companyId: null,
            restaurantId: null,
            staffUser: null,
            roles: [],
            activeRole: null,
            subscription: null,
            modules: DEFAULT_MODULES,
          })
          return
        }

        const resolvedCompanyId = typeof rootUser?.companyId === "string" ? rootUser.companyId : null
        const resolvedRestaurantId =
          typeof rootUser?.restaurantId === "string" ? rootUser.restaurantId : null
        const staffResolution =
          resolvedCompanyId && resolvedRestaurantId
            ? await getNestedRestaurantUser(db, resolvedCompanyId, resolvedRestaurantId, user.uid)
            : await findNestedRestaurantUser(db, user.uid)

        const companyId = resolvedCompanyId ?? staffResolution.companyId
        const restaurantId = resolvedRestaurantId ?? staffResolution.restaurantId
        const staffUser = staffResolution.staffUser ?? createFallbackStaffUser(user.uid, rootUser, user.email)
        const roles = normalizeRoles(staffUser?.roles)
        const storedRole = localStorage.getItem(`${ACTIVE_ROLE_STORAGE_KEY}:${user.uid}`)
        const activeRole =
          normalizeActiveRole(roles, storedRole) ?? normalizeActiveRole(roles, staffUser?.activeRole)
        const subscription = companyId ? await getCompanySubscription(db, companyId) : null

        if (cancelled) return

        setState({
          firebaseUser: user,
          isLoading: false,
          isAuthenticated: true,
          isSuperAdmin: false,
          companyId,
          restaurantId,
          staffUser,
          roles,
          activeRole,
          subscription,
          modules: {
            ...DEFAULT_MODULES,
            ...(subscription?.modules ?? {}),
          },
        })
      } catch (error) {
        console.error("Erreur current user:", error)
        if (cancelled) return

        setState({
          firebaseUser: user,
          isLoading: false,
          isAuthenticated: true,
          isSuperAdmin: false,
          companyId: null,
          restaurantId: null,
          staffUser: null,
          roles: [],
          activeRole: null,
          subscription: null,
          modules: DEFAULT_MODULES,
        })
      }
    }

    loadCurrentUser()

    return () => {
      cancelled = true
    }
  }, [db, isUserLoading, user])

  const setActiveRole = React.useCallback(
    async (role: RestaurantUserRole) => {
      if (!db || !user || !state.roles.includes(role)) return

      localStorage.setItem(`${ACTIVE_ROLE_STORAGE_KEY}:${user.uid}`, role)

      if (state.companyId && state.restaurantId) {
        await updateDoc(
          doc(
            db,
            COLLECTION_NAMES.COMPANIES,
            state.companyId,
            COLLECTION_NAMES.RESTAURANTS,
            state.restaurantId,
            COLLECTION_NAMES.USERS,
            user.uid
          ),
          {
            activeRole: role,
            updatedAt: serverTimestamp(),
          }
        )
      }

      setState((current) => ({
        ...current,
        activeRole: role,
        staffUser: current.staffUser ? { ...current.staffUser, activeRole: role } : current.staffUser,
      }))
    },
    [db, state.companyId, state.restaurantId, state.roles, user]
  )

  const value = React.useMemo<CurrentUserContextValue>(
    () => ({
      user: state.firebaseUser,
      ...state,
      setActiveRole,
    }),
    [setActiveRole, state]
  )

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function useCurrentUser() {
  const context = React.useContext(CurrentUserContext)

  if (!context) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider.")
  }

  return context
}

async function getNestedRestaurantUser(
  db: NonNullable<ReturnType<typeof useFirestore>>,
  companyId: string,
  restaurantId: string,
  userId: string
) {
  const userSnap = await getDoc(
    doc(
      db,
      COLLECTION_NAMES.COMPANIES,
      companyId,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.USERS,
      userId
    )
  )

  return {
    companyId,
    restaurantId,
    staffUser: userSnap.exists() ? toRestaurantUser(userId, userSnap.data()) : null,
  }
}

async function findNestedRestaurantUser(
  db: NonNullable<ReturnType<typeof useFirestore>>,
  userId: string
) {
  const staffQuery = query(collectionGroup(db, COLLECTION_NAMES.USERS), where(documentId(), "==", userId), limit(1))
  const snapshot = await getDocs(staffQuery)

  if (snapshot.empty) {
    return {
      companyId: null,
      restaurantId: null,
      staffUser: null,
    }
  }

  const staffDoc = snapshot.docs[0]
  const restaurantRef = staffDoc.ref.parent.parent
  const companyRef = restaurantRef?.parent.parent

  if (!restaurantRef || !companyRef) {
    return {
      companyId: null,
      restaurantId: null,
      staffUser: null,
    }
  }

  return {
    companyId: companyRef.id,
    restaurantId: restaurantRef.id,
    staffUser: toRestaurantUser(staffDoc.id, staffDoc.data()),
  }
}

async function getCompanySubscription(
  db: NonNullable<ReturnType<typeof useFirestore>>,
  companyId: string
) {
  const snap = await getDoc(doc(db, COLLECTION_NAMES.COMPANIES, companyId, "subscription", "current"))
  if (!snap.exists()) return null
  return snap.data() as CompanySubscription
}

function createFallbackStaffUser(
  userId: string,
  data: Record<string, any> | null,
  email: string | null
): RestaurantUser | null {
  if (!data?.restaurantId) return null

  const role = normalizeRootRole(data.role)
  const roles = normalizeRoles(Array.isArray(data.roles) ? data.roles : role ? [role] : [])
  const activeRole = normalizeActiveRole(roles, data.activeRole) ?? roles[0]

  if (!activeRole) return null

  return {
    id: userId,
    name: data.name ?? email?.split("@")[0] ?? "Utilisateur",
    phone: data.phone ?? "",
    email: data.email ?? email ?? "",
    roles,
    activeRole,
    pinCode: data.pinCode,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
  }
}

function toRestaurantUser(id: string, data: Record<string, any>): RestaurantUser {
  const roles = normalizeRoles(data.roles)
  const activeRole = normalizeActiveRole(roles, data.activeRole) ?? roles[0] ?? RESTAURANT_ROLES.MANAGER

  return {
    id,
    name: data.name ?? "",
    phone: data.phone ?? "",
    email: data.email,
    roles,
    activeRole,
    pinCode: data.pinCode,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
  }
}

function normalizeRoles(roles: unknown): RestaurantUserRole[] {
  if (!Array.isArray(roles)) return []
  return roles.filter((role): role is RestaurantUserRole =>
    Object.values(RESTAURANT_ROLES).includes(role as RestaurantUserRole)
  )
}

function normalizeRootRole(role: unknown): RestaurantUserRole | null {
  if (role === "staff") return RESTAURANT_ROLES.MANAGER
  if (Object.values(RESTAURANT_ROLES).includes(role as RestaurantUserRole)) return role as RestaurantUserRole
  return null
}
