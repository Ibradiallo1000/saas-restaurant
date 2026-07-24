"use client"

import * as React from "react"
import { ArrowRight, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { PublicButton } from "@/components/public-ui"
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
  const [desktopImageFailed, setDesktopImageFailed] = React.useState(false)
  const [logoFailed, setLogoFailed] = React.useState(false)
  const menuButtonRef = React.useRef<HTMLButtonElement>(null)

  const name = restaurant?.name || "Restaurant"
  const logo = restaurant?.logoUrl || restaurant?.logo
  const coverImage = restaurant?.coverImage || restaurant?.coverImageUrl || ""
  const configuredDesktopCoverImage = restaurant?.coverDesktopImageUrl || restaurant?.coverDesktopImage || ""
  const desktopCoverImage = configuredDesktopCoverImage && !desktopImageFailed ? configuredDesktopCoverImage : coverImage
  const hasCoverImage = Boolean(coverImage && !imageFailed)
  const hasDesktopCoverImage = Boolean(desktopCoverImage && !(desktopCoverImage === coverImage && imageFailed))
  const hasLogo = Boolean(logo && !logoFailed)
  const openStatus = React.useMemo(() => getRestaurantOpenStatus({ openingHours: restaurant?.openingHours, timezone: restaurant?.timezone }), [restaurant?.openingHours, restaurant?.timezone])
  const initial = name.charAt(0).toUpperCase()

  React.useEffect(() => setImageFailed(false), [coverImage])
  React.useEffect(() => setDesktopImageFailed(false), [configuredDesktopCoverImage, coverImage])
  React.useEffect(() => setLogoFailed(false), [logo])

  React.useEffect(() => {
    menuButtonRef.current?.focus()
  }, [])

  return (
    <section
      className={`public-cover-transition fixed inset-0 z-[80] h-[100dvh] min-h-[100svh] w-screen overflow-y-auto bg-[var(--surface-overlay)] text-[var(--text-inverse-primary)] transition-[opacity,transform] md:flex md:items-center md:justify-center md:p-8 lg:p-10 ${
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
          className="fixed inset-0 size-full object-cover object-center md:hidden"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="fixed inset-0 bg-[var(--surface-overlay)] md:hidden" aria-hidden="true" />
      )}

      <div className="fixed inset-0 bg-[var(--overlay-photo)] md:hidden" aria-hidden="true" />
      <div className="fixed inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/75 md:hidden" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-3xl flex-col pl-[calc(var(--space-5)+var(--safe-left))] pr-[calc(var(--space-5)+var(--safe-right))] pt-[calc(var(--space-5)+var(--safe-top))] pb-[calc(var(--space-4)+var(--safe-bottom))] sm:pl-[calc(var(--space-8)+var(--safe-left))] sm:pr-[calc(var(--space-8)+var(--safe-right))] md:min-h-0 md:h-[min(88vh,860px)] md:max-h-[900px] md:max-w-6xl md:overflow-hidden md:rounded-[32px] md:px-10 md:py-8 md:shadow-[0_32px_90px_rgba(0,0,0,0.34)] lg:px-14">
        {hasDesktopCoverImage ? (
          <img
            src={getOptimizedImage(desktopCoverImage, 2200)}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 hidden size-full object-cover object-[center_42%] md:block"
            onError={() => {
              if (desktopCoverImage === configuredDesktopCoverImage) {
                setDesktopImageFailed(true)
              } else {
                setImageFailed(true)
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 hidden bg-[var(--surface-overlay)] md:block" aria-hidden="true" />
        )}
        <div className="absolute inset-0 hidden bg-[var(--overlay-photo)] md:block" aria-hidden="true" />
        <div className="absolute inset-0 hidden bg-gradient-to-b from-black/25 via-black/12 to-black/70 md:block" aria-hidden="true" />
        <div className="flex flex-1 items-center justify-center pb-[var(--space-4)] pt-0">
          <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
            <div className="-mt-[120px] flex size-20 items-center justify-center overflow-hidden rounded-[var(--radius-public-full)] border border-white/25 bg-white/15 text-2xl font-public-extrabold text-white shadow-[var(--shadow-public-md)] backdrop-blur-md sm:-mt-36 sm:size-24 md:-mt-20">
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
              onClick={onEnterMenu}
              className="relative mt-8 h-[58px] overflow-hidden px-9 text-[18px] font-public-bold shadow-[0_18px_44px_rgba(0,0,0,0.34)] after:pointer-events-none after:absolute after:inset-y-0 after:left-[-45%] after:w-[34%] after:skew-x-[-18deg] after:bg-white/30 after:blur-sm after:content-[''] after:animate-[cover-cta-sheen_3.2s_ease-in-out_infinite] [&_svg]:size-5 sm:mt-9 sm:px-10"
            >
              <span className="inline-flex items-center gap-2">
                Découvrir le menu
                <ArrowRight aria-hidden="true" />
              </span>
            </PublicButton>
          </div>
        </div>

        <div className="flex shrink-0 justify-end pt-2">
          <button
            type="button"
            aria-label="Connexion équipe"
            title="Connexion équipe"
            onClick={() => router.push("/login")}
            className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/18 text-white/72 shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md transition hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
          >
            <UserRound aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
