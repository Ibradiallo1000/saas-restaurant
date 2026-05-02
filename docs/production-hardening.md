# Production Hardening

## Environments

Use separate Firebase projects:

- `dev`
- `staging`
- `production`

Required runtime variables:

```env
APP_ENV=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=
```

Do not commit `.env*` files. They are ignored by Git.

## Firebase Admin

Preferred production setup:

- Use Google Cloud IAM / Application Default Credentials.
- Avoid long-lived service account JSON when running on Google infrastructure.

Fallback setup:

- Store service account JSON as base64 in `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`.
- Never expose it in client code.
- Never put it in `NEXT_PUBLIC_*` variables.

## Subscription Expiration Without Blaze

This project does not require Firebase Functions for subscription enforcement.

- `GET /api/subscriptions/access` checks access before restaurant pages render.
- Expired trials are marked `expired` on demand when that API is called.
- Manual activation and extension are handled from `/platform/billing`.
