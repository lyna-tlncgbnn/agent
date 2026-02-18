import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function run() {
  const client = new Client({ name: "phase-c-smoke-client", version: "0.1.0" }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/server.js"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      GATEWAY_HEALTH_PORT: "0"
    }
  });

  await client.connect(transport);
  const tools = await client.listTools();
  console.log(JSON.stringify({ tools: tools.tools.map((t) => t.name) }, null, 2));
  await client.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
