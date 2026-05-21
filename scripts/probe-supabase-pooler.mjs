import { Client } from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;

if (!ref || !password) {
  console.error("SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD are required.");
  process.exit(1);
}

const regions = [
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-south-1",
  "us-east-1",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "ca-central-1",
  "sa-east-1"
];

for (const pool of ["aws-0", "aws-1"]) {
  for (const region of regions) {
    for (const port of [6543, 5432]) {
    const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${pool}-${region}.pooler.supabase.com:${port}/postgres`;
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      await client.query("select 1");
      console.log(`FOUND ${pool} ${region} ${port}`);
      await client.end();
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`MISS ${pool} ${region} ${port}: ${message.split("\n")[0]}`);
      await client.end().catch(() => undefined);
    }
  }
  }
}

process.exit(1);
