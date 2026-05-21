import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const url = process.argv[2] ?? "https://buildus-care-flow.vercel.app/quote/toilet_replace";
const width = Number(process.argv[3] ?? 390);
const height = Number(process.argv[4] ?? 900);
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9800 + Math.floor(Math.random() * 400);

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

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(payload.error.message));
    else resolve(payload.result ?? {});
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
        }, 10000);
      });
    },
    close() {
      socket.close();
    }
  };
}

async function main() {
  const userDataDir = path.join(os.tmpdir(), `buildus-overflow-${Date.now()}`);
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
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await send("Page.navigate", { url });
    await delay(4500);
    const result = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const viewport = document.documentElement.clientWidth;
        const rows = [...document.querySelectorAll("*")].map((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.right <= viewport + 1 && rect.left >= -1) return null;
          return {
            tag: el.tagName.toLowerCase(),
            className: String(el.className || ""),
            text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 90),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          };
        }).filter(Boolean).sort((a, b) => b.right - a.right).slice(0, 30);
        return {
          viewport,
          innerWidth,
          bodyScrollWidth: document.body.scrollWidth,
          htmlScrollWidth: document.documentElement.scrollWidth,
          offenders: rows
        };
      })()`
    });
    console.log(JSON.stringify(result.result.value, null, 2));
    await browser.send("Target.closeTarget", { targetId: target.targetId });
    browser.close();
  } finally {
    chrome.kill("SIGTERM");
    await import("node:fs/promises").then((fs) => fs.rm(userDataDir, { recursive: true, force: true })).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
