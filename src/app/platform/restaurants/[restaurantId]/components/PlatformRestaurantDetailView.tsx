"use client"

import type * as React from "react"
import { ArrowLeft, Save } from "lucide-react"
import { RestaurantLocationPicker } from "@/components/platform/RestaurantLocationPicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlatformHeader, PlatformPage, PlatformRestaurantDetail, PlatformSection } from "@/components/platform-ui"

export interface PlatformCountryPresentation { id: string; code: string; name: string; currency: string; dialCode: string }
export interface PlatformCityPresentation { id: string; name: string; isActive?: boolean; order?: number }
export interface PlatformCommunePresentation { id: string; name: string; isActive?: boolean; order?: number }
export interface PlatformRestaurantFormValue {
  name: string
  phone: string
  countryCode: string
  cityId: string
  cityName: string
  communeId: string
  communeName: string
  districtName: string
  address: string
  googleMapsUrl: string
  lat: string
  lng: string
}
export interface PlatformRestaurantDetailViewProps {
  value: PlatformRestaurantFormValue
  countrySearch: string
  countries: PlatformCountryPresentation[]
  selectedCountry?: PlatformCountryPresentation
  cities: PlatformCityPresentation[]
  communes: PlatformCommunePresentation[]
  isGeoLoading: boolean
  canSave: boolean
  isSaving: boolean
  coordinatesValid: boolean
  onBack: () => void
  onSubmit: (event: React.FormEvent) => void
  onValueChange: (value: PlatformRestaurantFormValue) => void
  onCountrySearchChange: (value: string) => void
  onCountrySelect: (country: PlatformCountryPresentation) => void
  onCitySelect: (cityId: string) => void
  onCommuneSelect: (communeId: string) => void
}

export function PlatformRestaurantDetailView({ canSave, cities, communes, coordinatesValid, countries, countrySearch, isGeoLoading, isSaving, onBack, onCitySelect, onCommuneSelect, onCountrySearchChange, onCountrySelect, onSubmit, onValueChange, selectedCountry, value }: PlatformRestaurantDetailViewProps) {
  return <PlatformPage width="reading">
    <PlatformHeader title="Modifier le restaurant" subtitle="Identité, pays, ville, commune, quartier et position exacte." actions={<Button type="button" variant="outline" className="min-h-11" onClick={onBack}><ArrowLeft aria-hidden="true" className="mr-2 size-4" />Retour</Button>} />
    <PlatformRestaurantDetail>
      <form onSubmit={onSubmit} aria-busy={isSaving || undefined}>
        <PlatformSection title="Informations établissement" description="La modification reste réservée à la plateforme admin. Les anciens champs restent conservés en compatibilité.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="platform-restaurant-name">Nom</Label><Input id="platform-restaurant-name" className="min-h-11" value={value.name} onChange={(event) => onValueChange({ ...value, name: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="platform-restaurant-phone">Téléphone</Label><Input id="platform-restaurant-phone" inputMode="tel" className="min-h-11" value={value.phone} onChange={(event) => onValueChange({ ...value, phone: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="platform-country-search">Pays</Label><div className="space-y-2 rounded-[var(--radius-dashboard-input)] border border-[var(--platform-border)] p-3"><Input id="platform-country-search" role="combobox" aria-expanded="true" aria-controls="platform-country-options" aria-autocomplete="list" placeholder="Rechercher un pays…" className="min-h-11" value={countrySearch} onChange={(event) => onCountrySearchChange(event.target.value)} /><div id="platform-country-options" role="listbox" aria-label="Pays disponibles" className="max-h-56 space-y-1 overflow-y-auto">{countries.map((country) => <button key={country.id} type="button" role="option" aria-selected={value.countryCode === country.code} onClick={() => onCountrySelect(country)} className="dashboard-focus-visible flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-dashboard-button)] border border-[var(--platform-border)] px-3 py-2 text-left text-sm aria-selected:bg-[var(--platform-highlight)]"><span className="font-semibold">{countryFlag(country.code)} {country.name}</span><span className="text-xs text-[var(--dashboard-muted)]">{country.code} · {country.currency}</span></button>)}{countries.length === 0 ? <p className="p-3 text-sm text-[var(--dashboard-muted)]">Aucun pays disponible.</p> : null}</div></div>{selectedCountry ? <p className="text-xs text-[var(--dashboard-muted)]">Pays sélectionné : {countryFlag(selectedCountry.code)} {selectedCountry.name}</p> : null}</div>
            <div className="space-y-2"><Label>Ville</Label><Select value={value.cityId} disabled={!value.countryCode || cities.length === 0} onValueChange={onCitySelect}><SelectTrigger className="min-h-11"><SelectValue placeholder={isGeoLoading ? "Chargement..." : value.cityName || "Choisir une ville"} /></SelectTrigger><SelectContent>{cities.map((city) => <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>)}</SelectContent></Select>{!value.cityId && value.cityName ? <p className="text-xs text-[var(--dashboard-muted)]">Valeur historique : {value.cityName}</p> : null}</div>
            <div className="space-y-2"><Label>Commune</Label><Select value={value.communeId} disabled={!value.cityId || communes.length === 0} onValueChange={onCommuneSelect}><SelectTrigger className="min-h-11"><SelectValue placeholder={isGeoLoading ? "Chargement..." : value.communeName || "Choisir une commune"} /></SelectTrigger><SelectContent>{communes.map((commune) => <SelectItem key={commune.id} value={commune.id}>{commune.name}</SelectItem>)}</SelectContent></Select>{!value.communeId && value.communeName ? <p className="text-xs text-[var(--dashboard-muted)]">Valeur historique : {value.communeName}</p> : null}</div>
            <div className="space-y-2"><Label htmlFor="platform-restaurant-district">Quartier</Label><Input id="platform-restaurant-district" className="min-h-11" value={value.districtName} onChange={(event) => onValueChange({ ...value, districtName: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="platform-restaurant-address">Adresse</Label><Input id="platform-restaurant-address" className="min-h-11" value={value.address} onChange={(event) => onValueChange({ ...value, address: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="platform-restaurant-google-maps">Lien Google Maps</Label><Input id="platform-restaurant-google-maps" className="min-h-11" value={value.googleMapsUrl} onChange={(event) => onValueChange({ ...value, googleMapsUrl: event.target.value })} /></div>
            <div className="space-y-3 sm:col-span-2"><RestaurantLocationPicker value={{ lat: value.lat, lng: value.lng }} onChange={(coordinates) => onValueChange({ ...value, ...coordinates })} countryCode={value.countryCode} countryName={selectedCountry?.name} cityName={value.cityName} />{!coordinatesValid ? <p className="text-sm font-semibold text-destructive">Latitude entre -90 et 90, longitude entre -180 et 180.</p> : null}</div>
          </div>
          <Button type="submit" disabled={!canSave || isSaving} aria-busy={isSaving || undefined} className="min-h-11 w-full sm:w-auto"><Save aria-hidden="true" className="mr-2 size-4" />{isSaving ? "Enregistrement…" : "Enregistrer"}</Button>
        </PlatformSection>
      </form>
    </PlatformRestaurantDetail>
  </PlatformPage>
}

function countryFlag(code: string) { return /^[A-Z]{2}$/.test(code) ? code.split("").map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("") : "🏳" }
