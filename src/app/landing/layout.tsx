import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Solution de gestion pour restaurants",
  description: "Oordera centralise les ventes, commandes, paiements et opérations des restaurants et hôtels.",
  alternates: { canonical: "/landing" },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) { return children }
