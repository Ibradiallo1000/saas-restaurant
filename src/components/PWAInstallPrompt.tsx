"use client"

import * as React from "react"
import { Download, Share2, X } from "lucide-react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISS_KEY = "pwa-install-prompt-dismissed-at"
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 7

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = React.useState(false)
  const [isIos, setIsIos] = React.useState(false)
  const [isStandalone, setIsStandalone] = React.useState(false)
  const [showIosHelp, setShowIosHelp] = React.useState(false)
  const [showManualHelp, setShowManualHelp] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
    const userAgent = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(userAgent)
    const androidChrome = /android/.test(userAgent) && /chrome|crios/.test(userAgent)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true

    setIsIos(ios)
    setIsStandalone(standalone)

    if (standalone || wasRecentlyDismissed()) return

    if (ios) {
      const timer = window.setTimeout(() => setVisible(true), 1800)
      return () => window.clearTimeout(timer)
    }

    let fallbackTimer: number | null = null
    if (androidChrome) {
      fallbackTimer = window.setTimeout(() => {
        setShowManualHelp(true)
        setVisible(true)
      }, 3000)
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (fallbackTimer) window.clearTimeout(fallbackTimer)
      setShowManualHelp(false)
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    const handleAppInstalled = () => {
      setVisible(false)
      setInstallPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      if (fallbackTimer) window.clearTimeout(fallbackTimer)
    }
  }, [])

  const handleInstall = async () => {
    if (isIos) {
      setShowIosHelp(true)
      return
    }

    if (!installPrompt) {
      setShowManualHelp(true)
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      setVisible(false)
      setInstallPrompt(null)
    }
  }

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  if (isStandalone || !visible || (!installPrompt && !isIos && !showManualHelp)) return null

  return (
    <div className="fixed bottom-24 left-3 right-3 z-[70] mx-auto max-w-sm md:bottom-6 md:left-auto md:right-6 md:mx-0">
      <div className="rounded-2xl border bg-background/95 p-3 text-foreground shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            {isIos ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Installer l'application</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-muted-foreground">
              {showIosHelp
                ? "Sur iPhone : appuie sur Partager, puis sur Sur l'ecran d'accueil."
                : showManualHelp
                ? "Ouvrez le menu ⋮ de Chrome, puis choisissez Ajouter à l'écran d'accueil."
                : "Accede plus vite au restaurant depuis ton ecran d'accueil."}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="h-10 flex-1 rounded-xl bg-[var(--color-primary)] px-4 text-xs font-black uppercase text-white transition active:scale-[0.98]"
              >
                {isIos || showManualHelp ? "Voir comment" : "Installer"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="h-10 rounded-xl border px-4 text-xs font-black uppercase text-muted-foreground transition hover:bg-muted active:scale-[0.98]"
              >
                Plus tard
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
            aria-label="Masquer l'installation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function wasRecentlyDismissed() {
  const value = window.localStorage.getItem(DISMISS_KEY)
  const dismissedAt = Number(value || 0)
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS
}
