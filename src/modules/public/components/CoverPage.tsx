"use client"

import * as React from "react"
import { Clock, ShoppingBag } from "lucide-react"
import { useRouter } from "next/navigation"

import { getOptimizedImage } from "@/lib/image"

type CoverPageProps = {
  restaurant: any
  isExiting: boolean
  onEnterMenu: () => void
}

export default function CoverPage({
  restaurant,
  isExiting,
  onEnterMenu,
}: CoverPageProps) {
  const router = useRouter()
  const [imageFailed, setImageFailed] = React.useState(false)
  const [teamDialogOpen, setTeamDialogOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  const name = restaurant?.name || "Restaurant"
  const logo = restaurant?.logoUrl || restaurant?.logo
  const coverImage = restaurant?.coverImage || restaurant?.coverImageUrl || ""
  const hasCoverImage = Boolean(coverImage && !imageFailed)
  const isOpen = restaurant?.isOpen !== false && restaurant?.status !== "closed"
  const serviceTime =
    restaurant?.serviceTime ||
    restaurant?.deliveryTime ||
    restaurant?.estimatedTime
  const serviceLabel =
    restaurant?.serviceType ||
    restaurant?.serviceMode ||
    restaurant?.orderType ||
    restaurant?.type
  const description =
    restaurant?.welcomeMessage ||
    restaurant?.description ||
    restaurant?.shortDescription ||
    restaurant?.tagline
  const initial = name.charAt(0).toUpperCase()

  React.useEffect(() => {
    buttonRef.current?.focus()
  }, [])

  return (
    <section
      className={`public-cover-transition fixed inset-0 z-[80] h-[100dvh] min-h-[100svh] w-screen overflow-hidden bg-slate-950 text-white transition-[opacity,transform,filter] ${
        isExiting
          ? "-translate-y-full scale-[0.98] opacity-0 blur-sm motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:blur-0"
          : "translate-y-0 scale-100 opacity-100 blur-0"
      }`}
      aria-label={`Couverture de ${name}`}
    >
      {hasCoverImage ? (
        <img
          src={getOptimizedImage(coverImage, 1400)}
          alt={`Image de couverture de ${name}`}
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgb(var(--brand-primary-rgb)/0.42),transparent_28rem),linear-gradient(160deg,#0f172a,#111827_48%,#020617)]" />
      )}

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-black/85" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgb(var(--brand-primary-rgb)/0.32),transparent_24rem)]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col px-5 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-[max(1.4rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-7 sm:gap-8">
          <div className="-translate-y-14 text-center sm:-translate-y-16">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/15 text-2xl font-black text-white shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-md sm:h-24 sm:w-24">
              {logo ? (
                <img
                  src={getOptimizedImage(logo, 180)}
                  alt={`Logo ${name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <h1 className="mx-auto mt-4 max-w-[18rem] text-balance text-3xl font-black leading-tight sm:max-w-xl sm:text-5xl">
              {name}
            </h1>
          </div>

          <div className="mx-auto w-full max-w-md text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
              Bienvenue
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              Découvrez notre menu
            </h2>
            {description ? (
              <p className="mx-auto mt-2 line-clamp-3 max-w-sm text-sm font-medium leading-6 text-white/82 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.14] px-3 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOpen ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {isOpen ? "Ouvert" : "Fermé"}
              </span>

              {serviceTime ? (
                <span className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.14] px-3 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md">
                  <Clock className="h-3.5 w-3.5 text-white/80" />
                  {serviceTime}
                </span>
              ) : null}

              {serviceLabel ? (
                <span className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.14] px-3 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md">
                  <ShoppingBag className="h-3.5 w-3.5 text-white/80" />
                  {serviceLabel}
                </span>
              ) : null}
            </div>

            <button
              ref={buttonRef}
              type="button"
              onClick={onEnterMenu}
              className="relative flex h-14 w-full overflow-hidden rounded-full bg-[var(--brand-primary)] px-6 text-base font-black text-white shadow-[0_18px_42px_rgba(0,0,0,0.25)] transition duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/35 active:scale-[0.98] before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:skew-x-[-18deg] before:bg-white/25 before:blur-sm before:content-[''] before:animate-[cover-button-shimmer_2.6s_ease-in-out_infinite] motion-reduce:before:animate-none"
            >
              <span className="relative z-10 flex h-full w-full items-center justify-center">
                Voir le menu
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-[max(1.15rem,env(safe-area-inset-bottom))] left-0 right-0 z-20 flex justify-center px-5">
        <button
          type="button"
          onClick={() => setTeamDialogOpen(true)}
          className="group rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-center text-white/72 shadow-[0_10px_28px_rgba(0,0,0,0.14)] backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
        >
          <span className="block text-xs font-black leading-tight">
            🔒 Espace équipe
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold leading-tight text-white/55 group-hover:text-white/70">
            Accès réservé au personnel
          </span>
        </button>
      </div>

      {teamDialogOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[1.6rem] border border-white/15 bg-slate-950/92 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <h3 className="text-lg font-black">Connexion personnel</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-white/72">
              Cet espace est réservé aux administrateurs, gérants, caissiers,
              cuisiniers et autres membres du personnel du restaurant.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTeamDialogOpen(false)}
                className="h-11 rounded-full border border-white/15 bg-white/[0.08] text-sm font-black text-white/82 transition hover:bg-white/[0.12]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="h-11 rounded-full bg-white text-sm font-black text-slate-950 transition hover:brightness-95"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
