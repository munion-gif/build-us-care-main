import { Client } from "file:///C:/Users/user/Downloads/UI-Inspector-main/UI-Inspector-main/servers/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "file:///C:/Users/user/Downloads/UI-Inspector-main/UI-Inspector-main/servers/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

const inspectorServer = "C:\\Users\\user\\Downloads\\UI-Inspector-main\\UI-Inspector-main\\servers\\inspector-server.mjs";
const targetUrl = process.env.UI_INSPECTOR_TARGET_URL ?? "http://localhost:3000";

const transport = new StdioClientTransport({
  command: "node",
  args: [inspectorServer],
  cwd: "C:\\Users\\user\\Downloads\\UI-Inspector-main\\UI-Inspector-main\\servers",
});

const client = new Client({ name: "codex-ui-inspector-attacher", version: "1.0.0" });
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
};

process.on("SIGINT", () => cleanup().finally(() => process.exit(0)));
process.on("SIGTERM", () => cleanup().finally(() => process.exit(0)));

const keepAlive = setInterval(() => {}, 60 * 60 * 1000);

await new Promise(() => {});
