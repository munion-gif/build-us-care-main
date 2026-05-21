import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envPath = ".env.local";
const bucket = "buildus-order-photos";

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
}

const fileEnv = readEnvFile(envPath);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("missing_supabase_env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error(`list_buckets_failed: ${listError.message}`);
  process.exit(1);
}

const exists = (buckets ?? []).some((item) => item.name === bucket);

if (!exists) {
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
  });

  if (createError) {
    console.error(`create_bucket_failed: ${createError.message}`);
    process.exit(1);
  }

  console.log("bucket_created");
} else {
  console.log("bucket_exists");
}

const { error: uploadUrlError } = await supabase.storage
  .from(bucket)
  .createSignedUploadUrl(`diagnoses/temp/smoke-${Date.now()}.jpg`);

if (uploadUrlError) {
  console.error(`signed_upload_failed: ${uploadUrlError.message}`);
  process.exit(1);
}

console.log("signed_upload_ok");
