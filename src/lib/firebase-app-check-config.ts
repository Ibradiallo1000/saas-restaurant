// A reCAPTCHA/App Check site key is a public browser identifier, not a secret.
// Keeping the registered production key as a fallback prevents deployments
// that inject Firebase variables selectively from silently disabling App Check.
const PRODUCTION_APP_CHECK_SITE_KEY = "6LcUcG0tAAAAAG4LDI3nVoh8VMU-LerCwJeGqexD"

export function resolveFirebaseAppCheckSiteKey() {
  return process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY?.trim() || PRODUCTION_APP_CHECK_SITE_KEY
}
