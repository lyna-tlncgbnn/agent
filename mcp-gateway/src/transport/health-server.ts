import http from "node:http";
import type { GatewayConfig } from "../config/gateway-config.js";
import type { Logger } from "../logging/logger.js";

export function startHealthServer(config: GatewayConfig, logger: Logger): http.Server | null {
  if (config.healthPort <= 0) {
    logger.info("Health server disabled", { healthPort: config.healthPort });
    return null;
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      const body = JSON.stringify({ ok: true, service: config.gatewayName, version: config.gatewayVersion });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not Found" }));
  });

  server.listen(config.healthPort, () => {
    logger.info("Health server started", { healthPort: config.healthPort });
  });

  return server;
}
