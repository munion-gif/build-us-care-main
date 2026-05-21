const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const EXPECTED_STATUSES = [
  "draft",
  "submitted",
  "reservation_pending",
  "reservation_confirmed",
  "inquiry",
  "quoted",
  "payment_pending",
  "paid",
  "scheduled",
  "preparing",
  "in_progress",
  "in_service",
  "completed",
  "done",
  "canceled",
  "cancelled",
  "cancel_requested",
  "issue",
  "warranty",
];

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const entries = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    });

  return Object.fromEntries(entries);
}

async function readState(client) {
  const enumRows = (
    await client.query(
      `
        select e.enumsortorder::int as ord, e.enumlabel
        from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
          and t.typname = 'order_status'
        order by e.enumsortorder
      `,
    )
  ).rows;

  const constraintRows = (
    await client.query(
      `
        select conname, convalidated, pg_get_constraintdef(oid) as definition
        from pg_constraint
        where conrelid = 'public.orders'::regclass
          and conname = 'orders_status_check'
      `,
    )
  ).rows;

  const statuses = (
    await client.query(
      `
        select distinct status::text as status
        from public.orders
        order by status::text
      `,
    )
  ).rows.map((row) => row.status);

  return {
    enumLabels: enumRows.map((row) => row.enumlabel),
    constraint: constraintRows[0] || null,
    currentOrderStatuses: statuses,
  };
}

async function applyMigration(client) {
  await client.query("begin");
  try {
    await client.query("alter table public.orders drop constraint if exists orders_status_check");
    await client.query(
      `
        alter table public.orders
          add constraint orders_status_check
          check (
            status = any (
              array[
                'draft'::public.order_status,
                'submitted'::public.order_status,
                'reservation_pending'::public.order_status,
                'reservation_confirmed'::public.order_status,
                'inquiry'::public.order_status,
                'quoted'::public.order_status,
                'payment_pending'::public.order_status,
                'paid'::public.order_status,
                'scheduled'::public.order_status,
                'preparing'::public.order_status,
                'in_progress'::public.order_status,
                'in_service'::public.order_status,
                'completed'::public.order_status,
                'done'::public.order_status,
                'canceled'::public.order_status,
                'cancelled'::public.order_status,
                'cancel_requested'::public.order_status,
                'issue'::public.order_status,
                'warranty'::public.order_status
              ]
            )
          )
          not valid
      `,
    );
    await client.query("alter table public.orders validate constraint orders_status_check");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function summarize(state) {
  const definition = state.constraint?.definition || "";
  const missingFromCheck = EXPECTED_STATUSES.filter((status) => !definition.includes(`'${status}'`));

  return {
    enumHasQuoted: state.enumLabels.includes("quoted"),
    enumHasReservationPending: state.enumLabels.includes("reservation_pending"),
    constraintValidated: state.constraint?.convalidated ?? null,
    checkHasQuoted: definition.includes("'quoted'"),
    checkHasReservationPending: definition.includes("'reservation_pending'"),
    missingExpectedStatusesFromCheck: missingFromCheck,
    currentOrderStatuses: state.currentOrderStatuses,
    constraintDefinition: definition,
  };
}

async function main() {
  const command = process.argv[2] || "check";
  if (!["check", "apply"].includes(command)) {
    throw new Error("Usage: node scripts/order-status-check-db.js [check|apply]");
  }

  const env = loadEnv();
  if (!env.MIGRATION_DATABASE_URL) {
    throw new Error("MIGRATION_DATABASE_URL is missing from .env.local");
  }

  const client = new Client({
    connectionString: env.MIGRATION_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const before = await readState(client);
    if (command === "apply") {
      await applyMigration(client);
    }
    const after = await readState(client);
    console.log(JSON.stringify({ command, before: summarize(before), after: summarize(after) }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
