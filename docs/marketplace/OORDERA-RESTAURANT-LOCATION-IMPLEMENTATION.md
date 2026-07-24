# OORDERA - Restaurant Structured Location Implementation

## Scope

This implementation stabilizes restaurant geography for the platform-admin workflow only.

No destructive migration was added. Existing restaurants remain readable through fallbacks for legacy fields such as `country`, `city`, `address`, and `location`.

## Existing Architecture Audited

The restaurant creation endpoint was centralized in:

- `src/app/api/create-restaurant/route.ts`

The platform restaurant forms were in:

- `src/app/platform/restaurants/new/components/NewPlatformRestaurantClient.tsx`
- `src/app/platform/restaurants/[restaurantId]/components/PlatformRestaurantDetailClient.tsx`
- `src/app/platform/restaurants/[restaurantId]/components/PlatformRestaurantDetailView.tsx`

Country administration already existed in:

- `src/app/platform/settings/countries/components/PlatformCountriesClient.tsx`

Firestore rules controlling restaurants and platform countries were in:

- `firestore.rules`

## Final Restaurant Location Model

Restaurants now support the normalized fields below:

```ts
{
  phone: string
  countryCode: string
  countryName: string
  cityId: string
  cityName: string
  communeId: string
  communeName: string
  districtName: string
  location: {
    address: string
    googleMapsUrl: string
    lat: number | null
    lng: number | null
  }
}
```

Legacy compatibility fields are still written/read where needed:

```ts
{
  country: string
  city: string
  address: string
}
```

These compatibility fields prevent older public, dashboard, or marketplace reads from breaking while the structured model becomes the canonical source.

## Platform Geography Collections

The new geography hierarchy is:

```txt
platformCountries/{countryCode}
platformCountries/{countryCode}/cities/{cityId}
platformCountries/{countryCode}/cities/{cityId}/communes/{communeId}
```

Country documents contain:

```ts
{
  code: string
  name: string
  currency: string
  dialCode: string
  isActive: boolean
  order: number
  createdAt
  updatedAt
}
```

City and commune documents contain:

```ts
{
  name: string
  normalizedName: string
  isActive: boolean
  order: number
  createdAt
  updatedAt
}
```

Districts remain free text through `districtName`.

## Files Modified

- `package.json`
- `firestore.rules`
- `scripts/seed-west-africa-location.mjs`
- `src/app/api/create-restaurant/route.ts`
- `src/app/platform/restaurants/new/components/NewPlatformRestaurantClient.tsx`
- `src/app/platform/restaurants/[restaurantId]/components/PlatformRestaurantDetailClient.tsx`
- `src/app/platform/restaurants/[restaurantId]/components/PlatformRestaurantDetailView.tsx`
- `src/app/platform/settings/countries/components/PlatformCountriesClient.tsx`
- `src/components/platform/RestaurantLocationPicker.tsx`
- `src/lib/restaurant-location.ts`
- `tests/restaurant-location.test.mjs`
- `tests/restaurant-location-rules.test.mjs`

## Seed Data

The script `scripts/seed-west-africa-location.mjs` is idempotent and can be run with:

```bash
npm run seed:west-africa-location
```

It configures West African countries with ISO code, name, currency, and phone dial code.

Initial active geography:

- Mali (`ML`)
- Bamako
- Commune I
- Commune II
- Commune III
- Commune IV
- Commune V
- Commune VI

Other countries are created inactive and can be activated progressively from platform settings.

## Admin Platform Changes

Country configuration now supports:

- country listing;
- country activation/deactivation;
- country creation/update through the country code document;
- dependent city management;
- dependent commune management.

Restaurant creation now asks for:

- owner email;
- restaurant name;
- slug;
- country;
- city;
- commune;
- district;
- phone;
- address;
- Google Maps URL;
- latitude;
- longitude.

Restaurant editing now allows a complete relocation while preserving legacy values if the structured identifiers are missing.

## Position Picker

A lightweight platform position picker was added in:

- `src/components/platform/RestaurantLocationPicker.tsx`

It supports:

- click selection;
- drag selection;
- keyboard selection;
- direct latitude/longitude entry;
- opening the saved position in Google Maps.

No external map dependency was added.

## Security

Firestore rules now enforce:

- restaurant create: super admin only, with required structured location fields;
- restaurant update: super admin only, with valid GPS bounds when location is provided;
- platform country/city/commune writes: super admin only;
- platform country/city/commune reads: authenticated users only;
- no public writes.

Latitude must be between `-90` and `90`.

Longitude must be between `-180` and `180`.

## Compatibility

Old restaurant documents remain compatible because edit screens fallback from:

- `countryCode` to `country`;
- `cityName` to `city`;
- `location.address` to root `address`;
- missing `communeId`/`cityId` to the existing display names.

No existing restaurant document is migrated or deleted by this implementation.

## Validation

Executed validations:

- `npx tsc --noEmit`
- targeted Node tests for location normalization and rule invariants
- `npm run build`
- `git diff --check`

## Validation Run - 2026-07-23

### Environment

Firebase project used:

```txt
studio-7907252579-dd6af
```

This project is configured as `dev` in `.firebaserc`.

No production project is configured in `.firebaserc`; the `production` alias still points to `replace-with-production-project-id`.

### Seed Result

Command executed twice:

```bash
npm run seed:west-africa-location
```

Both executions completed with:

```json
{
  "event": "west_africa_location_seed_complete",
  "countries": 16,
  "cities": 1,
  "communes": 6
}
```

The seed script initially failed because it used Firebase Application Default Credentials without loading `.env.local`.

Correction applied:

- load `.env.local`;
- reuse `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`;
- preserve `createdAt` on existing seed documents while updating `updatedAt`.

### Firestore Controls

Collection checked:

```txt
platformCountries
```

Result:

- expected seeded countries: 16;
- missing seeded countries: 0;
- total country documents in collection: 17;
- extra pre-existing country document: `NsSSAQoSc2reofPTB76O`;
- duplicate country IDs: 0;
- Mali active: yes;
- Bamako exists: yes;
- Bamako communes: 6.

Configured commune IDs:

```txt
commune-i
commune-ii
commune-iii
commune-iv
commune-v
commune-vi
```

### Restaurant Test Document

Validation document created in dev:

```txt
restaurants/location-validation-test-20260723
```

It was created with `status: "inactive"` to avoid public exposure.

Stored fields confirmed:

- `phone`;
- `countryCode`;
- `countryName`;
- `cityId`;
- `cityName`;
- `communeId`;
- `communeName`;
- `districtName`;
- `location.address`;
- `location.googleMapsUrl`;
- `location.lat`;
- `location.lng`;
- legacy `country`;
- legacy `city`;
- legacy `address`.

### Univers Food Control

Univers Food was found at:

```txt
restaurants/ccb21584-d85a-4d7b-b2a6-c36f4ff5f32f
```

Observed fields:

- `slug: "univers-food"`;
- `countryCode: "ML"`;
- legacy `city: "Bamako"`;
- no `cityId`;
- no `communeId`;
- no structured `location`.

This confirms that the fallback path for older restaurants remains necessary.

### UI Controls

No browser automation dependency is configured in the project (`Playwright`/`Puppeteer` not present), and no authenticated manual browser session was available from this validation environment.

The UI was therefore validated by code path and successful production build, not by interactive browser clicks.

Covered by code/build:

- country field exists in the restaurant creation form;
- city selector depends on selected country;
- commune selector depends on selected city;
- district, phone, address, Google Maps URL, latitude and longitude fields exist;
- edit form reads legacy restaurant values and structured values;
- edit form can write a structured location payload;
- coordinates are validated client-side and server-side.

### Remaining Anomalies

- `platformCountries` contains one extra pre-existing document with a random ID: `NsSSAQoSc2reofPTB76O`.
- Interactive UI validation through an authenticated browser session was not executed in this environment.

## Result

GO, provided the seed script is executed in the intended Firebase environment before creating restaurants with the new structured geography fields.
