"use client"

export function preloadOnIdle(loader: () => Promise<unknown>) {
  const preload = () => {
    loader().catch(() => undefined)
  }

  const idleCallback =
    window.requestIdleCallback ??
    ((callback: IdleRequestCallback) => window.setTimeout(() => callback({} as IdleDeadline), 1))
  const idleId = idleCallback(preload)

  return () => {
    if (window.cancelIdleCallback) {
      window.cancelIdleCallback(idleId as number)
    } else {
      window.clearTimeout(idleId as number)
    }
  }
}
