"use client"

import type * as React from "react"
import Link from "next/link"
import { ArrowRight, Mail, MapPin, Phone, Store, User } from "lucide-react"

import type { PlatformPublicFooter } from "@/types"
import { MarketplaceContainer } from "./marketplace-layout"

export interface MarketplacePublicFooterProps {
  platformName: string
  logoUrl?: string | null
  footer: PlatformPublicFooter
}

const SOCIALS = [
  { id: "facebook", label: "Facebook", icon: FacebookIcon, color: "#1877F2" },
  { id: "instagram", label: "Instagram", icon: InstagramIcon, color: "#E4405F" },
  { id: "tiktok", label: "TikTok", icon: TikTokIcon, color: "#25F4EE" },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon, color: "#0A66C2" },
  { id: "youtube", label: "YouTube", icon: YouTubeIcon, color: "#FF0000" },
  { id: "twitter", label: "X / Twitter", icon: XTwitterIcon, color: "#FFFFFF" },
] as const

export function MarketplacePublicFooter({ footer, platformName }: MarketplacePublicFooterProps) {
  const year = new Date().getFullYear()
  const socials = SOCIALS
    .map((social) => ({ ...social, href: normalizeExternalHref(footer.socialLinks[social.id]) }))
    .filter((social) => Boolean(social.href))
  const whatsappSocial = footer.whatsapp
    ? { id: "whatsapp" as const, label: "WhatsApp", icon: WhatsappIcon, color: "#25D366", href: buildWhatsappHref(footer.whatsapp) }
    : null
  const socialLinks = whatsappSocial ? [...socials, whatsappSocial] : socials
  const contacts = [
    footer.phone ? { id: "phone", label: footer.phone, href: `tel:${cleanPhone(footer.phone)}`, icon: <Phone className="size-4" /> } : null,
    footer.whatsapp ? { id: "whatsapp", label: footer.whatsapp, href: buildWhatsappHref(footer.whatsapp), icon: <WhatsappIcon /> } : null,
    footer.email ? { id: "email", label: footer.email, href: `mailto:${footer.email}`, icon: <Mail className="size-4" /> } : null,
    footer.officeAddress ? { id: "address", label: footer.officeAddress, href: buildMapsHref(footer.officeAddress), icon: <MapPin className="size-4" /> } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))

  return (
    <footer className="border-t border-white/10 bg-slate-950 text-white">
      <MarketplaceContainer className="space-y-5 py-6">
        <div className="grid gap-5 md:grid-cols-[1fr_1fr_0.55fr] md:items-start">
          <div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_16px_36px_rgb(0_0_0/0.18)] sm:p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/14 text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/24">
                  <Store className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-public-sm font-public-extrabold text-white">Vous êtes restaurateur ?</p>
                  <p className="mt-1 text-sm leading-5 text-white/68">
                    Digitalisez votre restaurant et développez votre activité avec{" "}
                    <Link href="/landing" className="font-public-bold text-[var(--brand-primary)] transition hover:text-[var(--brand-primary)]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                      Oordera
                    </Link>
                    .
                  </p>
                  <Link href="/landing" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--brand-primary)] px-4 text-sm font-public-extrabold text-[var(--action-primary-fg)] shadow-[0_12px_28px_rgb(var(--brand-primary-rgb)/0.28)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                    Découvrir Oordera
                    <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-public-extrabold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Contact</p>
            {contacts.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {contacts.map((contact) => (
                  <li key={contact.id} className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-public-semibold text-white/72 sm:text-sm">
                    <span className="shrink-0 text-[var(--brand-primary)]">{contact.icon}</span>
                    <a href={contact.href} target={contact.id === "address" ? "_blank" : undefined} rel={contact.id === "address" ? "noreferrer" : undefined} className="min-w-0 truncate transition hover:text-[var(--brand-primary)]">
                      {contact.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/55">Les informations de contact seront bientôt disponibles.</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-public-extrabold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Réseaux</p>
            {socialLinks.length ? (
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1" aria-label="Réseaux sociaux">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                  <a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ouvrir ${social.label}`}
                    style={{ "--social-color": social.color } as React.CSSProperties}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[var(--social-color)] transition hover:border-[var(--social-color)]/70 hover:bg-[var(--social-color)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--social-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <Icon />
                  </a>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-white/55">Aucun réseau social configuré.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-xs font-public-semibold text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {platformName}. Tous droits réservés.</p>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Liens légaux">
              <FooterLegalLink href={footer.legalLinks.privacy || "/privacy"}>Confidentialité</FooterLegalLink>
              <FooterLegalLink href={footer.legalLinks.terms || "/terms"}>Conditions</FooterLegalLink>
              <FooterLegalLink href={footer.legalLinks.legalNotice || "/legal"}>Mentions légales</FooterLegalLink>
            </nav>
            <Link
              href="/login"
              aria-label="Connexion professionnelle"
              title="Connexion professionnelle"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:border-[var(--brand-primary)]/50 hover:text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <User aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </MarketplaceContainer>
    </footer>
  )
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12.04 3.5A8.43 8.43 0 0 0 4.8 16.26L4 20.5l4.32-1.02A8.44 8.44 0 1 0 12.04 3.5Zm0 1.58a6.86 6.86 0 0 1 5.78 10.55 6.86 6.86 0 0 1-8.9 2.34l-.3-.16-2.55.6.48-2.52-.18-.29a6.86 6.86 0 0 1 5.67-10.42Zm-3.08 3.6c-.14 0-.37.05-.56.26-.2.22-.74.72-.74 1.76s.76 2.04.86 2.18c.1.14 1.47 2.36 3.62 3.21 1.79.7 2.15.56 2.54.53.39-.04 1.26-.52 1.44-1.02.18-.5.18-.93.13-1.02-.05-.09-.2-.14-.41-.25-.22-.11-1.27-.63-1.47-.7-.2-.08-.34-.12-.49.1-.14.21-.56.69-.69.83-.13.14-.25.16-.47.05-.22-.11-.91-.34-1.74-1.07-.64-.58-1.08-1.29-1.2-1.51-.13-.22-.02-.34.1-.45.1-.1.22-.25.33-.38.11-.13.14-.22.22-.36.07-.14.04-.27-.02-.38-.06-.11-.49-1.18-.67-1.61-.18-.43-.36-.37-.49-.38h-.41Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5ZM12 7.15A4.85 4.85 0 1 1 12 16.85 4.85 4.85 0 0 1 12 7.15Zm0 2A2.85 2.85 0 1 0 12 14.85 2.85 2.85 0 0 0 12 9.15Zm5.15-2.55a1.13 1.13 0 1 1 0 2.26 1.13 1.13 0 0 1 0-2.26Z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M16.65 2c.3 2.58 1.75 4.12 4.35 4.28v3.02a7.42 7.42 0 0 1-4.28-1.38v6.53c0 4.4-2.9 7.55-7.04 7.55A6.49 6.49 0 0 1 3 15.55c0-3.98 3.12-6.72 7.2-6.35v3.18c-1.98-.3-3.82.82-3.82 3.02a3.15 3.15 0 0 0 3.2 3.17c2.16 0 3.55-1.27 3.55-4.16V2h3.52Z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.67H9.34V8.98h3.42v1.57h.05a3.75 3.75 0 0 1 3.37-1.85c3.61 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.4a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13Zm1.78 13.05H3.54V8.98H7.1v11.47Z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M21.58 7.18a2.74 2.74 0 0 0-1.93-1.94C17.95 4.8 12 4.8 12 4.8s-5.95 0-7.65.45a2.74 2.74 0 0 0-1.93 1.94A28.5 28.5 0 0 0 2 12a28.5 28.5 0 0 0 .42 4.82 2.74 2.74 0 0 0 1.93 1.94c1.7.45 7.65.45 7.65.45s5.95 0 7.65-.45a2.74 2.74 0 0 0 1.93-1.94A28.5 28.5 0 0 0 22 12a28.5 28.5 0 0 0-.42-4.82ZM10 15.2V8.8l5.2 3.2L10 15.2Z" />
    </svg>
  )
}

function XTwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M13.9 10.47 21.35 2h-1.77l-6.47 7.35L7.95 2H2l7.82 11.13L2 22h1.77l6.83-7.76L16.05 22H22l-8.1-11.53Zm-2.42 2.75-.79-1.1-6.3-8.82h2.7l5.08 7.12.79 1.1 6.62 9.27h-2.7l-5.4-7.57Z" />
    </svg>
  )
}

function FooterLegalLink({ children, href }: { children: React.ReactNode; href: string }) {
  if (/^https?:\/\//i.test(href)) return <a href={href} target="_blank" rel="noreferrer" className="transition hover:text-[var(--brand-primary)]">{children}</a>
  return <Link href={href || "/"} className="transition hover:text-[var(--brand-primary)]">{children}</Link>
}

function cleanPhone(value: string) {
  return value.replace(/[^\d+]/g, "")
}

function buildWhatsappHref(value: string) {
  const cleaned = cleanPhone(value)
  if (/^https?:\/\//i.test(value)) return value
  return `https://wa.me/${cleaned.replace(/^\+/, "")}`
}

function buildMapsHref(value: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`
}

function normalizeExternalHref(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}
