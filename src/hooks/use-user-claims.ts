"use client"

import * as React from "react"
import { doc, getDoc } from "firebase/firestore"

import { useFirestore, useUser } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"

export function useUserClaims(_forceRefresh = false) {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [role, setRole] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    if (isUserLoading) {
      setIsLoading(true)
      return
    }

    if (!user) {
      setRole(null)
      setIsLoading(false)
      return
    }

    if (!db) {
      setRole(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    getDoc(doc(db, COLLECTION_NAMES.USERS, user.uid))
      .then((snapshot) => {
        if (!cancelled) {
          const data = snapshot.exists() ? snapshot.data() : null
          const nextRole = typeof data?.role === "string" ? data.role : null

          if (process.env.NODE_ENV !== "production") {
            console.debug("[auth:firestore-role]", {
              uid: user.uid,
              email: user.email,
              role: nextRole,
              source: `users/${user.uid}`,
            })
          }

          setRole(nextRole)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[auth:firestore-role:error]", {
              uid: user.uid,
              email: user.email,
              error,
            })
          }
          setRole(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [db, isUserLoading, user])

  return {
    isLoading,
    role,
  }
}
