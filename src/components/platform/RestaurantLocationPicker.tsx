"use client"

import * as React from "react"
import type { DivIcon, LatLngExpression, Map as LeafletMap, Marker } from "leaflet"
import { ExternalLink, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Coordinates = {
  lat: string
  lng: string
}

type RestaurantLocationPickerProps = {
  value: Coordinates
  onChange: (value: Coordinates) => void
  countryCode?: string
  countryName?: string
  cityName?: string
}

type SearchResult = {
  display_name: string
  lat: string
  lon: string
}

const DEFAULT_ZOOM = 13
const FALLBACK_CENTER = { lat: 12.6392, lng: -8.0029 }
const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom?: number }> = {
  "ML|bamako": { lat: 12.6392, lng: -8.0029, zoom: 13 },
  bamako: { lat: 12.6392, lng: -8.0029, zoom: 13 },
}

export function RestaurantLocationPicker({ cityName, countryCode, countryName, onChange, value }: RestaurantLocationPickerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<LeafletMap | null>(null)
  const markerRef = React.useRef<Marker | null>(null)
  const markerIconRef = React.useRef<DivIcon | null>(null)
  const [isMapReady, setIsMapReady] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState("")
  const lat = toNumber(value.lat, -90, 90)
  const lng = toNumber(value.lng, -180, 180)
  const hasPoint = lat !== null && lng !== null
  const cityCenter = getCityCenter(countryCode, cityName)
  const initialCenter = hasPoint ? { lat, lng } : cityCenter || FALLBACK_CENTER

  React.useEffect(() => {
    let disposed = false

    async function initMap() {
      if (!containerRef.current || mapRef.current) return
      const leaflet = await import("leaflet")
      if (disposed || !containerRef.current) return

      markerIconRef.current = leaflet.divIcon({
        className: "",
        html: '<span class="restaurant-location-marker" aria-hidden="true"></span>',
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      })

      const map = leaflet.map(containerRef.current, {
        center: [initialCenter.lat, initialCenter.lng] as LatLngExpression,
        zoom: cityCenter?.zoom || DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      map.on("click", (event) => {
        updateCoordinates(event.latlng.lat, event.latlng.lng)
      })

      mapRef.current = map
      setIsMapReady(true)
    }

    void initMap()

    return () => {
      disposed = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      markerIconRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map || hasPoint || !cityCenter) return
    updateCoordinates(cityCenter.lat, cityCenter.lng)
    map.setView([cityCenter.lat, cityCenter.lng], cityCenter.zoom || DEFAULT_ZOOM)
  }, [cityCenter, hasPoint])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const target = hasPoint ? { lat, lng } : cityCenter || FALLBACK_CENTER
    map.setView([target.lat, target.lng], hasPoint ? map.getZoom() : cityCenter?.zoom || DEFAULT_ZOOM)
  }, [cityCenter, hasPoint, lat, lng])

  React.useEffect(() => {
    async function syncMarker() {
      const map = mapRef.current
      if (!map || !hasPoint || !markerIconRef.current) {
        markerRef.current?.remove()
        markerRef.current = null
        return
      }

      const leaflet = await import("leaflet")
      if (!markerRef.current) {
        markerRef.current = leaflet.marker([lat, lng], {
          draggable: true,
          icon: markerIconRef.current,
          title: "Position du restaurant",
        }).addTo(map)
        markerRef.current.on("dragend", () => {
          const next = markerRef.current?.getLatLng()
          if (next) updateCoordinates(next.lat, next.lng)
        })
        return
      }
      markerRef.current.setLatLng([lat, lng])
    }

    void syncMarker()
  }, [hasPoint, lat, lng])

  const googleMapsHref = hasPoint
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : null

  async function searchLocation() {
    const query = [searchQuery, cityName, countryName || countryCode].filter(Boolean).join(", ").trim()
    if (!query) return

    setIsSearching(true)
    setSearchError("")
    setResults([])

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json" },
      })
      if (!response.ok) throw new Error("SEARCH_FAILED")
      const data = await response.json() as SearchResult[]
      setResults(data.filter((item) => toNumber(item.lat, -90, 90) !== null && toNumber(item.lon, -180, 180) !== null))
      if (!data.length) setSearchError("Aucun résultat trouvé.")
    } catch {
      setSearchError("Recherche indisponible pour le moment.")
    } finally {
      setIsSearching(false)
    }
  }

  function selectResult(result: SearchResult) {
    const nextLat = toNumber(result.lat, -90, 90)
    const nextLng = toNumber(result.lon, -180, 180)
    if (nextLat === null || nextLng === null) return
    updateCoordinates(nextLat, nextLng)
    mapRef.current?.setView([nextLat, nextLng], 17)
    setSearchQuery(result.display_name)
    setResults([])
  }

  function updateCoordinates(nextLat: number, nextLng: number) {
    onChange({
      lat: nextLat.toFixed(6),
      lng: nextLng.toFixed(6),
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="restaurant-location-search">Rechercher un restaurant ou une adresse</Label>
        <div className="flex gap-2">
          <Input
            id="restaurant-location-search"
            placeholder="Ex: Univers Food, ACI 2000, Bamako"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              void searchLocation()
            }}
          />
          <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={isSearching} onClick={() => void searchLocation()}>
            {isSearching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
            <span className="sr-only">Rechercher</span>
          </Button>
        </div>
        {results.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--platform-border)] bg-[var(--dashboard-surface)] shadow-sm">
            {results.map((result) => (
              <button
                key={`${result.lat}-${result.lon}-${result.display_name}`}
                type="button"
                className="block w-full border-b border-[var(--platform-border)] px-3 py-2 text-left text-sm font-medium last:border-b-0 hover:bg-[var(--platform-highlight)]"
                onClick={() => selectResult(result)}
              >
                {result.display_name}
              </button>
            ))}
          </div>
        ) : null}
        {searchError ? <p className="text-sm font-semibold text-destructive">{searchError}</p> : null}
      </div>

      <div className="relative h-72 overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--dashboard-section)]">
        <div ref={containerRef} className="h-full w-full" aria-label="Carte de position du restaurant" />
        {!isMapReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--dashboard-section)] text-sm font-semibold text-[var(--dashboard-muted)]">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Chargement de la carte
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="restaurant-latitude">Latitude</Label>
          <Input
            id="restaurant-latitude"
            inputMode="decimal"
            placeholder="12.639200"
            value={value.lat}
            onChange={(event) => onChange({ ...value, lat: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="restaurant-longitude">Longitude</Label>
          <Input
            id="restaurant-longitude"
            inputMode="decimal"
            placeholder="-8.002900"
            value={value.lng}
            onChange={(event) => onChange({ ...value, lng: event.target.value })}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={!googleMapsHref}
        onClick={() => {
          if (googleMapsHref) window.open(googleMapsHref, "_blank", "noopener,noreferrer")
        }}
      >
        <ExternalLink className="mr-2 size-4" aria-hidden="true" />
        Ouvrir dans Google Maps
      </Button>

      <style jsx global>{`
        .restaurant-location-marker {
          position: relative;
          display: block;
          width: 36px;
          height: 36px;
          border-radius: 999px 999px 999px 0;
          background: var(--brand-primary);
          border: 3px solid #fff;
          box-shadow: 0 16px 32px rgb(15 23 42 / 0.28);
          transform: rotate(-45deg);
        }
        .restaurant-location-marker::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #fff;
          transform: translate(-50%, -50%);
        }
      `}</style>
    </div>
  )
}

function getCityCenter(countryCode?: string, cityName?: string) {
  const normalizedCity = normalizeKey(cityName)
  const normalizedCountry = typeof countryCode === "string" ? countryCode.trim().toUpperCase() : ""
  return CITY_CENTERS[`${normalizedCountry}|${normalizedCity}`] || CITY_CENTERS[normalizedCity] || null
}

function normalizeKey(value?: string) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
    : ""
}

function toNumber(value: string, minimum: number, maximum: number) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < minimum || number > maximum) return null
  return number
}
