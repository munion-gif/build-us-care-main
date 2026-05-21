import { spawn } from "node:child_process";
import http from "node:http";
import { Client } from "file:///C:/Users/user/Downloads/UI-Inspector-main/UI-Inspector-main/servers/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "file:///C:/Users/user/Downloads/UI-Inspector-main/UI-Inspector-main/servers/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

const projectDir = "C:\\Users\\user\\Documents\\New project";
const inspectorServer = "C:\\Users\\user\\Downloads\\UI-Inspector-main\\UI-Inspector-main\\servers\\inspector-server.mjs";
const targetUrl = process.env.UI_INSPECTOR_TARGET_URL ?? "http://127.0.0.1:3000/request/photo";

function waitForUrl(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const tick = () => {
      if (settled) return;
      const req = http.get(url, (res) => {
        res.resume();
        settled = true;
        resolve();
      });
      req.on("error", () => {
        if (settled) return;
        if (Date.now() - startedAt > timeoutMs) {
          settled = true;
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 750);
      });
      req.setTimeout(15000, () => {
        req.destroy();
      });
    };
    tick();
  });
}

const nextBin = `${projectDir}\\node_modules\\next\\dist\\bin\\next`;
const nextMode = process.env.UI_INSPECTOR_NEXT_MODE ?? "start";
const dev = spawn(process.execPath, [nextBin, nextMode, "-H", "127.0.0.1", "-p", "3000"], {
  cwd: projectDir,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

dev.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
dev.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
dev.on("exit", (code, signal) => {
  console.error(`[next] exited code=${code} signal=${signal}`);
  process.exitCode = code ?? 1;
});

await waitForUrl(targetUrl, 60000);
await waitForUrl(targetUrl, 60000);
await waitForUrl(targetUrl, 60000);

const transport = new StdioClientTransport({
  command: "node",
  args: [inspectorServer],
  cwd: "C:\\Users\\user\\Downloads\\UI-Inspector-main\\UI-Inspector-main\\servers",
});
const client = new Client({ name: "codex-ui-inspector-runner", version: "1.0.0" });
await client.connect(transport);

const attach = await client.callTool({
  name: "preview_attach",
  arguments: {
    url: targetUrl,
    project_name: "buildus-care-backend-mvp",
  },
});

const attachText = attach.content?.find((item) => item.type === "text")?.text ?? "";
console.log(attachText);

const sessionId =
  attachText.match(/"session_id":\s*"([^"]+)"/)?.[1] ??
  attachText.match(/session_id:\s*([^\s]+)/)?.[1];
if (!sessionId) {
  throw new Error("ui-inspector preview_attach did not return a session_id");
}

const select = await client.callTool({
  name: "preview_select_element",
  arguments: {
    session_id: sessionId,
    action: "enable_inspector",
  },
});
console.log(select.content?.find((item) => item.type === "text")?.text ?? "");
console.log(`[ui-inspector] ready session_id=${sessionId}`);

const cleanup = async () => {
  try {
    await client.callTool({ name: "preview_stop", arguments: { session_id: sessionId } });
  } catch {}
  try {
    await client.close();
  } catch {}
  if (!dev.killed) dev.kill();
};

process.on("SIGINT", () => cleanup().finally(() => process.exit(0)));
process.on("SIGTERM", () => cleanup().finally(() => process.exit(0)));

await new Promise(() => {});
