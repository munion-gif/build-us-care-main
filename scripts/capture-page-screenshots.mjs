import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "https://buildus-care-flow.vercel.app";
const CHROME_PATH = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.join(process.cwd(), "screenshots", "page-print", new Date().toISOString().slice(0, 10));
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT ?? 9300 + Math.floor(Math.random() * 500));

const pages = [
  ["home", "/"],
  ["services", "/services"],
  ["cases", "/cases"],
  ["photo-request", "/request/photo"],
  ["quote-toilet", "/quote/toilet_replace"],
  ["orders-lookup", "/orders/lookup"],
  ["privacy", "/privacy"],
  ["refund-policy", "/refund-policy"]
];
const pageFilter = process.env.SCREENSHOT_PAGE_FILTER;
const filteredPages = pageFilter ? pages.filter(([name]) => name === pageFilter) : pages;

const viewports = [
  { name: "desktop", width: 1440, height: 1200, scale: 1, mobile: false },
  { name: "mobile", width: 390, height: 844, scale: 1, mobile: true }
];
const viewportFilter = process.env.SCREENSHOT_VIEWPORT_FILTER;
const filteredViewports = viewportFilter ? viewports.filter(({ name }) => name === viewportFilter) : viewports;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChrome() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await delay(250);
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

function cdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = new Map();

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolve(payload.result ?? {});
      return;
    }
    if (payload.method && events.has(payload.method)) {
      for (const listener of events.get(payload.method)) listener(payload.params ?? {});
    }
  });

  return {
    async open() {
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
    },
    send(method, params = {}, sessionId) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`${method} timed out`));
          }
        }, 30000);
      });
    },
    once(method) {
      return new Promise((resolve) => {
        const listener = (params) => {
          const listeners = events.get(method) ?? [];
          events.set(method, listeners.filter((item) => item !== listener));
          resolve(params);
        };
        events.set(method, [...(events.get(method) ?? []), listener]);
      });
    },
    close() {
      socket.close();
    }
  };
}

async function capturePage(browser, pageName, pathname, viewport) {
  const target = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });

  async function send(method, params = {}) {
    return browser.send(method, params, sessionId);
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.scale,
    mobile: viewport.mobile
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile });

  const url = new URL(pathname, BASE_URL).toString();
  const loadEvent = browser.once("Page.loadEventFired");
  await send("Page.navigate", { url });
  await Promise.race([loadEvent, delay(12000)]);
  await delay(2500);

  const metrics = await send("Runtime.evaluate", {
    expression: `(() => {
      const body = document.body;
      const html = document.documentElement;
      return {
        width: Math.max(body.scrollWidth, html.scrollWidth, body.offsetWidth, html.offsetWidth),
        height: Math.max(body.scrollHeight, html.scrollHeight, body.offsetHeight, html.offsetHeight)
      };
    })()`,
    returnByValue: true
  });
  const size = metrics.result?.value ?? { width: viewport.width, height: viewport.height };
  const fullHeight = Math.min(Math.max(size.height, viewport.height), 16000);
  const fullWidth = Math.min(Math.max(size.width, viewport.width), 2400);

  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: fullHeight,
    deviceScaleFactor: viewport.scale,
    mobile: viewport.mobile
  });
  await delay(300);

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: fullWidth, height: fullHeight, scale: 1 }
  });

  const fileName = `${String(pages.findIndex(([name]) => name === pageName) + 1).padStart(2, "0")}-${pageName}-${viewport.name}.png`;
  const filePath = path.join(OUT_DIR, fileName);
  await fs.writeFile(filePath, Buffer.from(screenshot.data, "base64"));
  await browser.send("Target.closeTarget", { targetId: target.targetId });
  return { pageName, viewport: viewport.name, filePath, width: fullWidth, height: fullHeight };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const userDataDir = path.join(os.tmpdir(), `buildus-page-screenshots-${Date.now()}`);
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--hide-scrollbars",
    "about:blank"
  ], { stdio: "ignore" });

  try {
    const version = await waitForChrome();
    const browser = cdpClient(version.webSocketDebuggerUrl);
    await browser.open();
    const outputs = [];
    for (const viewport of filteredViewports) {
      for (const [pageName, pathname] of filteredPages) {
        process.stdout.write(`capturing ${pageName} ${viewport.name}... `);
        const output = await capturePage(browser, pageName, pathname, viewport);
        outputs.push(output);
        process.stdout.write(`${path.basename(output.filePath)}\n`);
      }
    }
    browser.close();
    console.log(JSON.stringify({ baseUrl: BASE_URL, outDir: OUT_DIR, outputs }, null, 2));
  } finally {
    chrome.kill("SIGTERM");
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
