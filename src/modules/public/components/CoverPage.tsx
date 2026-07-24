"use client"

import * as React from "react"
import { LockKeyhole } from "lucide-react"
import { useRouter } from "next/navigation"

import { PublicBadge, PublicButton } from "@/components/public-ui"
import { getOptimizedImage } from "@/lib/image"
import { getRestaurantOpenStatus } from "@/lib/restaurant-hours"

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
  const openStatus = React.useMemo(() => getRestaurantOpenStatus({ openingHours: restaurant?.openingHours, timezone: restaurant?.timezone }), [restaurant?.openingHours, restaurant?.timezone])
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
        <div className="flex flex-1 items-center justify-center pb-[var(--space-4)] pt-0">
          <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
            <div className="-mt-12 flex size-20 items-center justify-center overflow-hidden rounded-[var(--radius-public-full)] border border-white/25 bg-white/15 text-2xl font-public-extrabold text-white shadow-[var(--shadow-public-md)] backdrop-blur-md sm:-mt-14 sm:size-24">
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

            <p className="mt-7 text-[14px] font-public-medium leading-5 text-white/75 sm:mt-8 sm:text-[15px]">
              Bienvenue chez
            </p>

            <h1 className="mt-2 line-clamp-2 max-w-xl break-words font-publicDisplay text-[42px] font-public-extrabold leading-[46px] text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:text-[58px] sm:leading-[62px]">
              {name}
            </h1>

            <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2 sm:mt-6">
              <span
                className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 text-xs font-public-bold backdrop-blur-md ${
                  openStatus.isOpenNow
                    ? "border-emerald-300/25 bg-emerald-400/15 text-white shadow-[0_10px_26px_rgba(16,185,129,0.18)]"
                    : "border-red-300/25 bg-red-400/15 text-white shadow-[0_10px_26px_rgba(239,68,68,0.16)]"
                }`}
              >
                <span className={`size-2 rounded-full ${openStatus.isOpenNow ? "bg-emerald-300" : "bg-red-300"}`} />
                {openStatus.label} · {openStatus.detail}
              </span>
            </div>

            <div className="mt-7 max-w-sm text-[17px] font-public-semibold leading-6 text-[var(--text-inverse-secondary)] sm:mt-8 sm:text-lg sm:leading-7">
              <p>Qu&apos;avez-vous envie de déguster aujourd&apos;hui ?</p>
            </div>

            <PublicButton
              ref={menuButtonRef}
              type="button"
              size="hero"
              shape="marketing"
              fullWidth
              onClick={onEnterMenu}
              className="relative mt-8 max-w-sm overflow-hidden shadow-[0_18px_44px_rgba(0,0,0,0.34)] after:pointer-events-none after:absolute after:inset-y-0 after:left-[-45%] after:w-[34%] after:skew-x-[-18deg] after:bg-white/30 after:blur-sm after:content-[''] after:animate-[cover-cta-sheen_3.2s_ease-in-out_infinite] sm:mt-9"
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
