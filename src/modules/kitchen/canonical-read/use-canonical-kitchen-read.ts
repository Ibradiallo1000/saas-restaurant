"use client"

import * as React from "react"

import { useFirestore } from "@/firebase"

import type { CanonicalKitchenReadState } from "./model.ts"
import { subscribeCanonicalKitchenRead } from "./firestore-reader.ts"

const EMPTY_STATE: CanonicalKitchenReadState = {
  items: [],
  groups: [],
  columns: { pending: [], preparing: [], ready: [] },
  counters: { pending: 0, preparing: 0, ready: 0 },
  isLoading: false,
  isSaturated: false,
  invalidDocumentCount: 0,
  error: null,
}

export function useCanonicalKitchenRead(input: {
  restaurantId?: string
  userId?: string
  enabled: boolean
}) {
  const db = useFirestore()
  const [state, setState] = React.useState<CanonicalKitchenReadState>(EMPTY_STATE)

  React.useEffect(() => {
    if (!db || !input.enabled || !input.restaurantId || !input.userId) {
      setState(EMPTY_STATE)
      return
    }
    setState({ ...EMPTY_STATE, isLoading: true })
    return subscribeCanonicalKitchenRead({
      db,
      restaurantId: input.restaurantId,
      log: console,
      onData: (snapshot) => {
        setState({
          ...snapshot,
          isLoading: false,
          error: null,
        })
      },
      onError: (error) => {
        setState((current) => ({
          ...current,
          isLoading: false,
          error,
        }))
      },
    })
  }, [db, input.enabled, input.restaurantId, input.userId])

  return state
}
