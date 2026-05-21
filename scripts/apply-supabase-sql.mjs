import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

async function loadDotEnvLocal() {
  const envPath = path.resolve(".env.local");

  try {
    const raw = await fs.readFile(envPath, "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

await loadDotEnvLocal();

const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
const files = process.argv.slice(2);

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        if (quote === "'" && next === "'") {
          current += next;
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += char + next;
      i += 1;
      lineComment = true;
      continue;
    }

    if (char === "/" && next === "*") {
      current += char + next;
      i += 1;
      blockComment = true;
      continue;
    }

    if (char === "'" || char === '"') {
      current += char;
      quote = char;
      continue;
    }

    if (char === "$") {
      const match = sql.slice(i).match(/^\$\$|^\$[A-Za-z_][A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

if (!connectionString) {
  console.error("MIGRATION_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}

if (files.length === 0) {
  console.error("At least one SQL file path is required.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

try {
  await client.connect();

  const identity = await client.query(`
    select
      current_database() as database_name,
      current_user as user_name,
      inet_server_addr()::text as server_addr,
      inet_server_port() as server_port
  `);
  console.log("Connected database:", identity.rows[0]);

  for (const file of files) {
    const fullPath = path.resolve(file);
    const sql = await fs.readFile(fullPath, "utf8");
    console.log(`Applying ${file}`);

    const statements = splitSqlStatements(sql);
    for (const [index, statement] of statements.entries()) {
      const result = await client.query(statement);
      if (result.command === "SELECT") {
        console.log(`Result ${path.basename(file)} #${index + 1}:`);
        console.table(result.rows);
      }
    }
  }

  console.log("SQL applied successfully.");
} finally {
  await client.end().catch(() => undefined);
}
