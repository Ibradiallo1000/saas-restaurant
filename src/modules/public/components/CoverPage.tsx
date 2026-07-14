"use client"

import * as React from "react"
import { Clock, LockKeyhole, ShoppingBag } from "lucide-react"
import { useRouter } from "next/navigation"

import { PublicBadge, PublicButton } from "@/components/public-ui"
import { getOptimizedImage } from "@/lib/image"

type CoverPageProps = {
  restaurant: any
  isExiting: boolean
  onEnterMenu: () => void
}

export default function CoverPage({ restaurant, isExiting, onEnterMenu }: CoverPageProps) {
  const router = useRouter()
  const [imageFailed, setImageFailed] = React.useState(false)
  const [logoFailed, setLogoFailed] = React.useState(false)
  const [teamDialogOpen, setTeamDialogOpen] = React.useState(false)
  const menuButtonRef = React.useRef<HTMLButtonElement>(null)
  const teamButtonRef = React.useRef<HTMLButtonElement>(null)
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null)
  const continueButtonRef = React.useRef<HTMLButtonElement>(null)

  const name = restaurant?.name || "Restaurant"
  const logo = restaurant?.logoUrl || restaurant?.logo
  const coverImage = restaurant?.coverImage || restaurant?.coverImageUrl || ""
  const hasCoverImage = Boolean(coverImage && !imageFailed)
  const hasLogo = Boolean(logo && !logoFailed)
  const isOpen = restaurant?.isOpen !== false && restaurant?.status !== "closed"
  const serviceTime = restaurant?.serviceTime || restaurant?.deliveryTime || restaurant?.estimatedTime
  const serviceLabel = restaurant?.serviceType || restaurant?.serviceMode || restaurant?.orderType || restaurant?.type
  const description = restaurant?.welcomeMessage || restaurant?.description || restaurant?.shortDescription || restaurant?.tagline
  const initial = name.charAt(0).toUpperCase()

  React.useEffect(() => setImageFailed(false), [coverImage])
  React.useEffect(() => setLogoFailed(false), [logo])

  React.useEffect(() => {
    menuButtonRef.current?.focus()
  }, [])

  const closeTeamDialog = React.useCallback(() => {
    setTeamDialogOpen(false)
    window.requestAnimationFrame(() => teamButtonRef.current?.focus())
  }, [])

  React.useEffect(() => {
    if (!teamDialogOpen) return

    const frame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTeamDialog()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeTeamDialog, teamDialogOpen])

  return (
    <section
      className={`public-cover-transition fixed inset-0 z-[80] h-[100dvh] min-h-[100svh] w-screen overflow-y-auto bg-[var(--surface-overlay)] text-[var(--text-inverse-primary)] transition-[opacity,transform] ${
        isExiting
          ? "-translate-y-full opacity-0 motion-reduce:translate-y-0"
          : "translate-y-0 opacity-100"
      }`}
      aria-label={`Couverture de ${name}`}
    >
      {hasCoverImage ? (
        <img
          src={getOptimizedImage(coverImage, 1400)}
          alt=""
          aria-hidden="true"
          className="fixed inset-0 size-full object-cover object-center"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="fixed inset-0 bg-[var(--surface-overlay)]" aria-hidden="true" />
      )}

      <div className="fixed inset-0 bg-[var(--overlay-photo)]" aria-hidden="true" />
      <div className="fixed inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75" aria-hidden="true" />

      <div
        aria-hidden={teamDialogOpen ? true : undefined}
        inert={teamDialogOpen ? true : undefined}
        className="relative z-10 mx-auto flex min-h-full w-full max-w-3xl flex-col pl-[calc(var(--space-5)+var(--safe-left))] pr-[calc(var(--space-5)+var(--safe-right))] pt-[calc(var(--space-5)+var(--safe-top))] pb-[calc(var(--space-4)+var(--safe-bottom))] sm:pl-[calc(var(--space-8)+var(--safe-left))] sm:pr-[calc(var(--space-8)+var(--safe-right))]"
      >
        <div className="flex flex-1 items-center justify-center py-[var(--space-4)]">
          <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-[var(--radius-public-full)] border border-white/25 bg-white/15 text-2xl font-public-extrabold text-white shadow-[var(--shadow-public-md)] backdrop-blur-md sm:size-24">
              {hasLogo ? (
                <img
                  src={getOptimizedImage(logo, 192)}
                  alt={`Logo de ${name}`}
                  className="size-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span aria-label={`Initiale de ${name}`}>{initial}</span>
              )}
            </div>

            <h1 className="mt-3 line-clamp-2 max-w-xl break-words font-publicDisplay text-[28px] font-public-extrabold leading-[34px] text-white sm:mt-4 sm:text-[40px] sm:leading-[46px]">
              {name}
            </h1>

            <p className="mt-2 line-clamp-2 max-w-md text-lg font-public-semibold leading-6 text-[var(--text-inverse-secondary)] sm:text-xl sm:leading-7">
              {description || "Découvrez notre menu"}
            </p>

            <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2 sm:mt-5">
              <PublicBadge
                variant="inverse"
                size="md"
                label={isOpen ? "Ouvert" : "Fermé"}
                icon={<span className={`size-2 rounded-full ${isOpen ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />}
                className="min-h-7 border border-white/15 px-3 text-xs backdrop-blur-md"
              />
              {serviceTime ? (
                <PublicBadge
                  variant="inverse"
                  size="md"
                  label={String(serviceTime)}
                  icon={<Clock />}
                  className="min-h-7 border border-white/15 px-3 text-xs backdrop-blur-md"
                />
              ) : null}
              {serviceLabel ? (
                <PublicBadge
                  variant="inverse"
                  size="md"
                  label={String(serviceLabel)}
                  icon={<ShoppingBag />}
                  className="min-h-7 border border-white/15 px-3 text-xs backdrop-blur-md"
                />
              ) : null}
            </div>

            <PublicButton
              ref={menuButtonRef}
              type="button"
              size="hero"
              shape="marketing"
              fullWidth
              onClick={onEnterMenu}
              className="mt-5 max-w-sm shadow-[var(--shadow-public-lg)] sm:mt-6"
            >
              Découvrir le menu
            </PublicButton>
          </div>
        </div>

        <div className="flex shrink-0 justify-center pt-2">
          <PublicButton
            ref={teamButtonRef}
            type="button"
            variant="ghost"
            size="compact"
            shape="marketing"
            onClick={() => setTeamDialogOpen(true)}
            className="text-xs text-[var(--text-inverse-secondary)] hover:bg-white/10 hover:text-white"
          >
            <LockKeyhole className="size-4" />
            Espace équipe
          </PublicButton>
        </div>
      </div>

      {teamDialogOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[var(--overlay-modal)] px-5 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-dialog-title"
            aria-describedby="team-dialog-description"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return
              if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
                event.preventDefault()
                continueButtonRef.current?.focus()
              } else if (!event.shiftKey && document.activeElement === continueButtonRef.current) {
                event.preventDefault()
                cancelButtonRef.current?.focus()
              }
            }}
            className="w-full max-w-sm rounded-[var(--radius-public-2xl)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-elevated)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-public-lg)]"
          >
            <h2 id="team-dialog-title" className="text-public-heading-3 font-public-bold">Connexion personnel</h2>
            <p id="team-dialog-description" className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
              Cet espace est réservé aux administrateurs, gérants, caissiers, cuisiniers et autres membres du personnel du restaurant.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <PublicButton ref={cancelButtonRef} type="button" variant="secondary" size="standard" onClick={closeTeamDialog}>
                Annuler
              </PublicButton>
              <PublicButton ref={continueButtonRef} type="button" size="standard" onClick={() => router.push("/login")}>
                Continuer
              </PublicButton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
