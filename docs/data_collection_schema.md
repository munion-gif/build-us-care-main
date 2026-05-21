# BuildUS Care Data Collection Schema

## Goal

Primary reporting target:

- `source = instagram`
- `campaign = suwon_toilet_fixed_price`

The data model is designed so Excel can pivot the Instagram funnel from landing to quote, payment, lookup, and status views, then connect the same campaign to order quality, revenue, warranty, feedback, and lead time.

## events Sheet

Source: `public.analytics_events_export` view, backed by `public.events`.

| Column | Type | Meaning | Example | Code/DB source |
|---|---:|---|---|---|
| event_id | uuid | Event primary key | `...` | `events.id` |
| event_time | timestamptz | Event time | `2026-05-13T10:00:00Z` | `events.occurred_at` |
| session_id | text | Browser session id | `sess...` | `lib/tracking.ts` |
| order_id | uuid | Linked order when available | `...` | API route context |
| event_type | text | Funnel event | `landing_view` | normalized in `app/api/events/route.ts` |
| source | text | Channel code | `instagram` | UTM/session/order |
| campaign | text | Campaign code | `suwon_toilet_fixed_price` | `utm_campaign` |
| landing_path | text | First/current path | `/quote/toilet_replace` | client tracking context |
| device_type | text | `mobile` or `desktop` | `mobile` | UA/client detection |
| service_code | text | Service code | `toilet_replace` | quote/order context |
| region_code | text | Region code | `suwon_yeongtong` | URL/preset/home |
| meta_note | text | Free note | `mock payment` | optional properties |

Core event types:

- `landing_view`
- `quote_start`
- `quote_submit`
- `payment_done`
- `order_lookup`
- `status_view`
- extension examples: `photo_request_start`, `photo_result_view`

End-to-end Instagram example:

| event_time | session_id | order_id | event_type | source | campaign | landing_path | device_type | service_code | region_code |
|---|---|---|---|---|---|---|---|---|---|
| 2026-05-13 10:00 | `sess_a` |  | `landing_view` | `instagram` | `suwon_toilet_fixed_price` | `/quote/toilet_replace` | `mobile` | `toilet_replace` | `suwon_yeongtong` |
| 2026-05-13 10:01 | `sess_a` |  | `quote_start` | `instagram` | `suwon_toilet_fixed_price` | `/quote/toilet_replace` | `mobile` | `toilet_replace` | `suwon_yeongtong` |
| 2026-05-13 10:05 | `sess_a` | `order_1` | `quote_submit` | `instagram` | `suwon_toilet_fixed_price` | `/quote/toilet_replace` | `mobile` | `toilet_replace` | `suwon_yeongtong` |
| 2026-05-13 10:07 | `sess_a` | `order_1` | `payment_done` | `instagram` | `suwon_toilet_fixed_price` | `/quote/toilet_replace` | `mobile` | `toilet_replace` | `suwon_yeongtong` |
| 2026-05-13 10:08 | `sess_a` | `order_1` | `status_view` | `instagram` | `suwon_toilet_fixed_price` | `/quote/toilet_replace` | `mobile` | `toilet_replace` | `suwon_yeongtong` |

## orders Sheet

Source: `public.analytics_orders_export` view, backed by `orders`, `customers`, `homes`, `payments`, `quotes`, `jobs`, `feedbacks`, and `warranty_cases`.

| Column | Type | Meaning | Example | Code/DB source |
|---|---:|---|---|---|
| order_id | uuid | Order id | `...` | `orders.id` |
| created_at | timestamptz | Order creation time | `2026-05-13T10:05:00Z` | `orders.created_at` |
| service_code | text | Service code | `toilet_replace` | `orders.service_type_code` or `skus` |
| region_code | text | Region code | `suwon_yeongtong` | `orders.region_code` or `homes.address_dong` |
| source | text | Channel code | `instagram` | `orders.source` |
| campaign | text | Campaign code | `suwon_toilet_fixed_price` | `orders.campaign` |
| soft_launch_flag | integer | Soft launch marker | `1` | `orders.soft_launch_flag` |
| amount_final | integer | Paid/accepted/final amount | `215000` | payment, quote, order |
| status_final | text | Final/current status | `paid` | `orders.status` |
| lead_time_first_contact_min | integer | Order to first contact | `12` | `customers.first_contact_at` |
| lead_time_done_min | integer | Order to completed job | `1440` | `jobs.completed_at` |
| quality_flag | text | Quality classification | `ok` | `orders.quality_flag` or status fallback |
| warranty_flag | integer | Warranty case exists | `0` | `warranty_cases` |
| feedback_score_overall | numeric | Overall feedback | `5` | rating, score quality, or NPS/2 |

## sessions Sheet

Source: `public.analytics_sessions_export` view, backed by `public.sessions`.

| Column | Type | Meaning | Example |
|---|---:|---|---|
| session_id | text | Browser session id | `sess_a` |
| first_event_time | timestamptz | First seen time | `2026-05-13T10:00:00Z` |
| source | text | Channel code | `instagram` |
| campaign | text | Campaign code | `suwon_toilet_fixed_price` |
| landing_path | text | Landing path | `/` |
| device_type | text | Device type | `mobile` |
| region_hint | text | Region hint | `suwon_yeongtong` |
| order_id | uuid | Linked order | `...` |

## dim_* Sheets

Source tables:

- `dim_services(code, name, description)`
- `dim_channels(code, name, description)`
- `dim_campaigns(code, name, description)`
- `dim_regions(code, name, description)`

Required seeded codes:

- channel: `instagram`
- campaign: `suwon_toilet_fixed_price`
- services: loaded from `service_items.service_type_code`
- regions: `suwon`, `suwon_yeongtong`, `suwon_gwanggyo`

## Collection Points

- `/` and `/quote/[serviceCode]`: `landing_view` for Instagram UTM traffic.
- `/quote/[serviceCode]`: `quote_start` on quote page entry.
- `/api/orders`: `quote_submit` when an order/quote request reaches the server.
- `/api/payments/toss/confirm`: `payment_done` after Toss confirm succeeds.
- `/orders/lookup`: `order_lookup` from the client tracking call.
- `/api/orders/[id]/status`: `status_view` when the customer status API is opened.

UTM mapping:

- `utm_source=instagram` -> `source=instagram`
- `utm_campaign=suwon_toilet_fixed_price` -> `campaign=suwon_toilet_fixed_price`

