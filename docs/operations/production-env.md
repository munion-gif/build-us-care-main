# Production Environment Variables

This project is linked to the Vercel project `buildus-site`, which serves `https://builduscare.co.kr`.

## Bank Transfer Text

Set these in Vercel Production to control the bank transfer copy without changing code:

```env
NEXT_PUBLIC_BANK_TRANSFER_BANK=농협
NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT=355-0094-9209-33
NEXT_PUBLIC_BANK_TRANSFER_HOLDER=주식회사 무니온
```

When set:
- `/payment/transfer` and `/api/builduscare/transfer-guide` use the Vercel values.

When missing:
- The app falls back to the code defaults: `농협`, `355-0094-9209-33`, `주식회사 무니온`.

## Cron Protection

Set this in Vercel Production:

```env
CRON_SECRET=<random-secret>
```

Recommended generated value for the current setup:

```env
CRON_SECRET=TxTes8nYH0AcWvBYZhQBHXy11Ee32RxrGBFojEjE4lI
```

When set:
- Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`.
- `/api/cron/notifications?limit=20` can process queued notifications.

When missing:
- `/api/cron/notifications` returns `401`.
- Queued notifications are not processed by the scheduled cron job.

## Notification Dispatch

Email dispatch requires:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=Buildus Care <onboarding@resend.dev>
```

SMS dispatch requires:

```env
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER_PHONE=
```

When set:
- `notifications` rows with email or SMS recipients can be dispatched by the cron route.

When missing:
- Queue rows can still be created.
- Dispatch attempts fail with configuration errors and the row is marked failed.

Kakao AlimTalk is not ready yet. The current dispatcher returns a configuration error for `kakao` until an approved provider/template integration is added.
