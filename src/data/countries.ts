import type { Country } from "@/types"

export const DEFAULT_COUNTRIES: Country[] = [
  { code: "ML", name: "Mali", currency: "XOF", phoneCode: "+223", isActive: true },
  { code: "CI", name: "Cote d'Ivoire", currency: "XOF", phoneCode: "+225", isActive: true },
  { code: "SN", name: "Senegal", currency: "XOF", phoneCode: "+221", isActive: true },
  { code: "BJ", name: "Benin", currency: "XOF", phoneCode: "+229", isActive: true },
  { code: "BF", name: "Burkina Faso", currency: "XOF", phoneCode: "+226", isActive: true },
  { code: "TG", name: "Togo", currency: "XOF", phoneCode: "+228", isActive: true },
  { code: "GH", name: "Ghana", currency: "GHS", phoneCode: "+233", isActive: true },
  { code: "NG", name: "Nigeria", currency: "NGN", phoneCode: "+234", isActive: true },
]

export function getDefaultCountry(code: string): Country | undefined {
  const normalizedCode = code.trim().toUpperCase()
  return DEFAULT_COUNTRIES.find((country) => country.code === normalizedCode)
}
