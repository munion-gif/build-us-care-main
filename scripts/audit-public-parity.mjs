const deployBase = process.env.AUDIT_DEPLOY_BASE_URL?.trim() || "https://builduscare.co.kr";
const localBase = process.env.AUDIT_LOCAL_BASE_URL?.trim() || "http://127.0.0.1:3001";

const routes = [
  "/",
  "/service",
  "/products",
  "/products/toilet",
  "/products/washbasin",
  "/products/faucet",
  "/products/bidet",
  "/products/ventilation",
  "/products/window-handle",
  "/products/door-handle",
  "/products/silicone",
  "/products/bath-accessory",
  "/photo-check",
  "/order-lookup",
  "/order-status",
  "/payment/transfer",
  "/quote-preview",
  "/as-request",
  "/reservation/complete"
];

function pick(html, regex) {
  const match = html.match(regex);
  return match ? match[1] : "";
}

async function readPage(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  const html = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location") || "",
    title: pick(html, /<title>([^<]*)<\/title>/i),
    canonical: pick(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i),
    ogUrl: pick(html, /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["']/i)
  };
}

function samePage(a, b) {
  return a.status === b.status &&
    a.location === b.location &&
    a.title === b.title &&
    a.canonical === b.canonical &&
    a.ogUrl === b.ogUrl;
}

async function main() {
  const mismatches = [];

  for (const route of routes) {
    const [deploy, local] = await Promise.all([
      readPage(deployBase, route),
      readPage(localBase, route)
    ]);
    const ok = samePage(deploy, local);
    console.log(`${ok ? "OK" : "DIFF"}\t${route}`);
    if (!ok) {
      mismatches.push({ route, deploy, local });
      console.log(JSON.stringify({ route, deploy, local }));
    }
  }

  if (mismatches.length > 0) {
    console.error(`\nPARITY_FAIL\t${mismatches.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nPARITY_OK\t${routes.length}`);
}

await main();
