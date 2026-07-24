import assert from "node:assert/strict"
import test from "node:test"

import {
  buildRestaurantLocationPayload,
  normalizeCountryCode,
  normalizeGeoCoordinate,
  normalizeRestaurantLocation,
  normalizeSlugSegment,
  normalizeText,
} from "../src/lib/restaurant-location.ts"

test("normalise les textes et les codes pays", () => {
  assert.equal(normalizeText("  Bamako   Centre  "), "Bamako Centre")
  assert.equal(normalizeCountryCode(" ml "), "ML")
  assert.equal(normalizeSlugSegment("Commune VI"), "commune-vi")
})

test("valide les bornes latitude et longitude", () => {
  assert.equal(normalizeGeoCoordinate("12.6392329", -90, 90), 12.639233)
  assert.equal(normalizeGeoCoordinate("-181", -180, 180), null)
  assert.equal(normalizeGeoCoordinate("bad", -90, 90), null)
})

test("normalise la location restaurant sans inventer de coordonnées", () => {
  assert.deepEqual(normalizeRestaurantLocation({ address: " Rue 1 ", lat: "", lng: null }), {
    address: "Rue 1",
    googleMapsUrl: "",
    lat: null,
    lng: null,
  })
})

test("construit un payload compatible anciens champs", () => {
  const payload = buildRestaurantLocationPayload({
    phone: " 74746580 ",
    countryCode: "ml",
    countryName: "Mali",
    cityId: "bamako",
    cityName: "Bamako",
    communeId: "commune-i",
    communeName: "Commune I",
    districtName: "ACI 2000",
    location: { address: "Rue 1", googleMapsUrl: "https://maps.example", lat: "12.6", lng: "-8" },
  })

  assert.equal(payload.countryCode, "ML")
  assert.equal(payload.country, "Mali")
  assert.equal(payload.city, "Bamako")
  assert.equal(payload.location.lat, 12.6)
  assert.equal(payload.location.lng, -8)
})

