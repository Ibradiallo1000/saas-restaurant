"use client"

import type * as React from "react"
import Link from "next/link"
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react"

import type { PlatformPublicFooter } from "@/types"
import { MarketplaceContainer } from "./marketplace-layout"

export interface MarketplacePublicFooterProps {
  platformName: string
  logoUrl?: string | null
  footer: PlatformPublicFooter
}

const SOCIALS = [
  { id: "facebook", label: "Facebook", icon: "f" },
  { id: "instagram", label: "Instagram", icon: "◎" },
  { id: "tiktok", label: "TikTok", icon: "♪" },
  { id: "linkedin", label: "LinkedIn", icon: "in" },
  { id: "youtube", label: "YouTube", icon: "▶" },
  { id: "twitter", label: "X / Twitter", icon: "X" },
] as const

export function MarketplacePublicFooter({ footer, platformName }: MarketplacePublicFooterProps) {
  const year = new Date().getFullYear()
  const socials = SOCIALS
    .map((social) => ({ ...social, href: normalizeExternalHref(footer.socialLinks[social.id]) }))
    .filter((social) => Boolean(social.href))
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
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-public-sm font-public-extrabold text-white">Vous êtes restaurateur ?</p>
              <p className="mt-1 text-sm leading-5 text-white/68">
                {footer.description || "Oordera vous aide à développer votre activité, recevoir plus de commandes et gérer votre restaurant."}
              </p>
              <Link href="/landing" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--brand-primary)] px-4 text-sm font-public-extrabold text-[var(--action-primary-fg)] shadow-[0_12px_28px_rgb(var(--brand-primary-rgb)/0.28)] transition hover:brightness-105">
                Découvrir Oordera
                <ArrowRight aria-hidden="true" className="ml-2 size-4" />
              </Link>
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
            {socials.length ? (
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1" aria-label="Réseaux sociaux">
                {socials.map((social) => (
                  <a key={social.id} href={social.href} target="_blank" rel="noreferrer" aria-label={social.label} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-public-extrabold uppercase text-white transition hover:border-[var(--brand-primary)]/60 hover:bg-[var(--brand-primary)] hover:text-[var(--action-primary-fg)]">
                    {social.icon}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/55">Aucun réseau social configuré.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-xs font-public-semibold text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {platformName}. Tous droits réservés.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Liens légaux">
            <FooterLegalLink href={footer.legalLinks.privacy || "/privacy"}>Confidentialité</FooterLegalLink>
            <FooterLegalLink href={footer.legalLinks.terms || "/terms"}>Conditions</FooterLegalLink>
            <FooterLegalLink href={footer.legalLinks.legalNotice || "/legal"}>Mentions légales</FooterLegalLink>
          </nav>
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
