"use client"

import * as React from "react"

export default function PWARegister() {
  React.useEffect(() => {
    updateManifestLink()

    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed", error)
      })
    })
  }, [])

  return null
}

function updateManifestLink() {
  if (typeof window === "undefined") return

  const slug = getInstallSlug(window.location.pathname)
  const href = slug
    ? `/pwa-manifest.webmanifest?slug=${encodeURIComponent(slug)}`
    : "/manifest.webmanifest"

  const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (existing) {
    existing.href = href
    return
  }

  const link = document.createElement("link")
  link.rel = "manifest"
  link.href = href
  document.head.appendChild(link)
}

function getInstallSlug(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0]?.toLowerCase() || ""

  const reserved = new Set([
    "api",
    "_next",
    "admin",
    "dashboard",
    "manager",
    "owner",
    "platform",
    "pos",
    "orders",
    "order",
    "settings",
    "setup",
    "login",
    "invite",
    "contact",
    "checkout",
    "images",
    "customers",
    "kitchen",
    "tables",
    "ai-tools",
  ])

  if (!segment || reserved.has(segment)) return ""
  if (!/^[a-z0-9-]{2,80}$/.test(segment)) return ""

  return segment
}
