import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const url = process.argv[2];
const output = process.argv[3];
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 1800);
const mobile = process.argv[6] !== "desktop";
const waitMs = Number(process.env.SCREENSHOT_WAIT_MS ?? 2500);
const scrollY = Number(process.env.SCREENSHOT_SCROLL_Y ?? 0);
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9900 + Math.floor(Math.random() * 400);

if (!url || !output) {
  console.error("Usage: node scripts/capture-single-page-screenshot.mjs <url> <output> [width] [height] [mobile|desktop]");
  process.exit(1);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(targetUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 750);
  try {
    const response = await fetch(targetUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForChrome() {
  for (let index = 0; index < 80; index += 1) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch {
      await delay(250);
    }
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
      for (const listener of events.get(payload.method)) listener(payload);
    }
  });

  return {
    open() {
      return new Promise((resolve, reject) => {
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
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }, 20000);
      });
    },
    once(method, predicate = () => true, timeoutMs = 15000) {
      return new Promise((resolve) => {
        const listener = (payload) => {
          if (!predicate(payload)) return;
          clearTimeout(timeout);
          const listeners = events.get(method) ?? [];
          events.set(method, listeners.filter((item) => item !== listener));
          resolve(payload.params ?? {});
        };
        const timeout = setTimeout(() => {
          const listeners = events.get(method) ?? [];
          events.set(method, listeners.filter((item) => item !== listener));
          resolve({});
        }, timeoutMs);
        events.set(method, [...(events.get(method) ?? []), listener]);
      });
    },
    close() {
      socket.close();
    }
  };
}

async function main() {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const userDataDir = path.join(os.tmpdir(), `buildus-single-shot-${Date.now()}`);
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank"
  ], { stdio: "ignore" });

  try {
    const version = await waitForChrome();
    const browser = cdpClient(version.webSocketDebuggerUrl);
    await browser.open();
    const target = await browser.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    const send = (method, params = {}) => browser.send(method, params, sessionId);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
    const loadEvent = browser.once("Page.loadEventFired", (payload) => payload.sessionId === sessionId);
    await send("Page.navigate", { url });
    await loadEvent;
    await delay(waitMs);
    if (scrollY > 0) {
      await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${scrollY});` });
      await delay(500);
    }
    const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    await fs.writeFile(output, Buffer.from(screenshot.data, "base64"));
    await browser.send("Target.closeTarget", { targetId: target.targetId });
    browser.close();
    console.log(output);
  } finally {
    chrome.kill("SIGTERM");
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
