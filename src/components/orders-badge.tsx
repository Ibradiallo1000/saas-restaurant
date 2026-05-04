// src/components/orders-badge.tsx
'use client'

import { useState, useEffect } from 'react'
import { useFirestore } from '@/firebase'
import { useTenant } from '@/design-system/context/TenantProvider'
import { collection, query, where, onSnapshot } from 'firebase/firestore'

export function OrdersBadge() {
  const [count, setCount] = useState(0)
  const db = useFirestore()
  const { restaurantId } = useTenant()

  useEffect(() => {
    if (!db || !restaurantId) return

    const q = query(
      collection(db, 'restaurants', restaurantId, 'orders'),
      where('status', 'in', ['pending', 'nouvelle'])
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size)
    })

    return unsubscribe
  }, [db, restaurantId])

  if (count === 0) return null
  
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  )
}