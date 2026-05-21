# Instagram Funnel Export Manual

## Campaign

Use this first campaign filter:

```text
source=instagram
campaign=suwon_toilet_fixed_price
```

Example ad URLs:

```text
/?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price
/quote/toilet_replace?utm_source=instagram&utm_medium=social&utm_campaign=suwon_toilet_fixed_price
```

## CSV Export URLs

Admin auth is required. Add the normal admin key/header used by the admin APIs.

Events:

```text
/api/admin/events/export?from=2026-05-10&to=2026-05-31&source=instagram&campaign=suwon_toilet_fixed_price
```

Orders:

```text
/api/admin/orders/export?from=2026-05-10&to=2026-05-31&source=instagram&campaign=suwon_toilet_fixed_price
```

Sessions:

```text
/api/admin/sessions/export?from=2026-05-10&to=2026-05-31&source=instagram&campaign=suwon_toilet_fixed_price
```

## Excel: events Pivot

Paste the events CSV into the `events` sheet.

Recommended pivot:

- Filter: `source = instagram`
- Filter: `campaign = suwon_toilet_fixed_price`
- Rows: `event_type`
- Values: count of `event_id`
- Optional slicers: `landing_path`, `device_type`, `service_code`, `region_code`

Funnel order:

1. `landing_view`
2. `quote_start`
3. `quote_submit`
4. `payment_done`
5. `order_lookup`
6. `status_view`

Conversion formula example:

```text
quote_submit / landing_view
payment_done / quote_submit
status_view / payment_done
```

## Excel: orders Pivot

Paste the orders CSV into the `orders` sheet.

Recommended pivot:

- Filter: `source = instagram`
- Filter: `campaign = suwon_toilet_fixed_price`
- Values: count of `order_id`
- Values: sum and average of `amount_final`
- Values: average of `lead_time_first_contact_min`
- Values: average of `lead_time_done_min`
- Rows: `quality_flag`
- Rows or filter: `warranty_flag`
- Values: average of `feedback_score_overall`

Useful operating questions:

- Conversion is good: does `payment_done / landing_view` improve?
- Revenue is real: are `order_id` count and `amount_final` healthy?
- Quality is acceptable: are `warranty_flag=1` and non-`ok` `quality_flag` low?
- Operations can keep up: are first-contact and completion lead times stable?

## Refresh Routine

1. Export events for the Instagram campaign and paste into `events`.
2. Export orders for the same date range and paste into `orders`.
3. Export sessions when landing/session diagnostics are needed and paste into `sessions`.
4. Refresh all Excel pivot tables.
5. Check funnel conversion first, then order quality and lead time.

