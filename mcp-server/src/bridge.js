import WebSocket, { WebSocketServer } from "ws";

const WS_OPEN = 1;
const HEARTBEAT_MS = 15_000;

export function createFigmaBridge({ port, logger = console.error }) {
  let bridgeMode = "starting";
  let figmaSocket = null;
  let brokerClient = null;
  let requestSeq = 0;
  let figmaCommandQueue = Promise.resolve();

  const pendingFigmaRequests = new Map();
  const pendingBrokerRequests = new Map();
  const ready = startBridge();

  function nextRequestId(prefix = "req") {
    requestSeq += 1;
    return `${prefix}-${process.pid}-${Date.now()}-${requestSeq}`;
  }

  function startBridge() {
    return new Promise((resolve) => {
      let settled = false;
      const server = new WebSocketServer({ port });
      let heartbeat = null;

      server.on("listening", () => {
        settled = true;
        bridgeMode = "owner";
        logger(`[bridge] owner mode: WebSocket listening on :${port}`);
        heartbeat = setInterval(() => {
          for (const ws of server.clients) {
            if (ws.isAlive === false) {
              logger(`[bridge] terminating stale ${ws.role || "unknown"} WebSocket client`);
              if (figmaSocket === ws) {
                figmaSocket = null;
                rejectPendingFigmaRequests(new Error("Figma plugin connection went stale."));
              }
              ws.terminate();
              continue;
            }

            ws.isAlive = false;
            try {
              ws.ping();
            } catch {
              ws.terminate();
            }
          }
        }, HEARTBEAT_MS);
        heartbeat.unref?.();
        resolve();
      });

      server.on("connection", handleBridgeConnection);
      server.on("close", () => {
        if (heartbeat) clearInterval(heartbeat);
      });

      server.on("error", (err) => {
        if (!settled && err.code === "EADDRINUSE") {
          settled = true;
          bridgeMode = "relay";
          logger(`[bridge] port ${port} already in use; using relay mode`);
          connectToExistingBridge()
            .then(resolve)
            .catch((relayError) => {
              logger(`[bridge] relay connection failed: ${relayError.message}`);
              resolve();
            });
          return;
        }

        logger(`[bridge] WebSocket server error: ${err.message}`);
      });
    });
  }

  function connectToExistingBridge() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      let settled = false;

      ws.on("open", () => {
        settled = true;
        brokerClient = ws;
        ws.send(JSON.stringify({
          type: "hello",
          role: "mcp-client",
          client: "free-figma-mcp",
          pid: process.pid
        }));
        logger(`[bridge] relay mode connected to owner on :${port}`);
        resolve();
      });

      ws.on("message", handleBrokerMessage);
      ws.on("close", () => {
        brokerClient = null;
        rejectPendingBrokerRequests(new Error("Relay bridge disconnected."));
        logger("[bridge] relay disconnected from owner; will retry...");
        scheduleRelayReconnect(1000);
      });
      ws.on("error", (err) => {
        if (!settled) reject(err);
        else logger(`[bridge] relay WebSocket error: ${err.message}`);
      });
    });
  }

  function scheduleRelayReconnect(delayMs) {
    const maxDelay = 30_000;
    setTimeout(() => {
      logger(`[bridge] relay attempting reconnect to owner on :${port}`);
      const ws = new WebSocket(`ws://localhost:${port}`);
      let reconnected = false;

      ws.on("open", () => {
        reconnected = true;
        brokerClient = ws;
        ws.send(JSON.stringify({
          type: "hello",
          role: "mcp-client",
          client: "free-figma-mcp",
          pid: process.pid
        }));
        logger(`[bridge] relay reconnected to owner on :${port}`);
      });

      ws.on("message", handleBrokerMessage);
      ws.on("close", () => {
        brokerClient = null;
        rejectPendingBrokerRequests(new Error("Relay bridge disconnected."));
        logger("[bridge] relay disconnected from owner; will retry...");
        scheduleRelayReconnect(Math.min(delayMs * 2, maxDelay));
      });
      ws.on("error", () => {
        if (!reconnected) {
          scheduleRelayReconnect(Math.min(delayMs * 2, maxDelay));
        }
      });
    }, delayMs);
  }

  function handleBridgeConnection(ws) {
    ws.role = "unknown";
    ws.isAlive = true;
    logger("[bridge] WebSocket client connected");

    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("message", (raw) => handleBridgeMessage(ws, raw));
    ws.on("close", () => {
      if (figmaSocket === ws) {
        figmaSocket = null;
        rejectPendingFigmaRequests(new Error("Figma plugin disconnected."));
        logger("[bridge] Figma plugin disconnected");
      }
    });
    ws.on("error", (err) => logger(`[bridge] WebSocket client error: ${err.message}`));
  }

  function handleBridgeMessage(ws, raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      message = { type: "raw", value: raw.toString() };
    }

    if (message.type === "hello") {
      ws.role = message.role || "unknown";
      if (ws.role === "figma") {
        if (figmaSocket && figmaSocket !== ws && figmaSocket.readyState === WS_OPEN) {
          figmaSocket.close(1000, "Replaced by a new Figma plugin connection.");
        }
        figmaSocket = ws;
        logger("[bridge] Figma plugin connected");
      } else if (ws.role === "mcp-client") {
        logger(`[bridge] relay MCP client connected${message.pid ? ` (pid ${message.pid})` : ""}`);
      }
      return;
    }

    if (message.type === "mcp-command") {
      enqueueDirectToFigma(message.command || {}, message.timeoutMs || 30_000, ws, message.requestId).catch((err) => {
        sendJson(ws, {
          type: "mcp-result",
          requestId: message.requestId,
          result: { ok: false, error: err.message }
        });
      });
      return;
    }

    if (message.type === "result" || message.requestId) {
      if (ws.role === "unknown") {
        ws.role = "figma";
        figmaSocket = ws;
      }
      handleFigmaResult(message);
    }
  }

  function handleBrokerMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type !== "mcp-result" || !message.requestId) return;

    const pending = pendingBrokerRequests.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingBrokerRequests.delete(message.requestId);
    pending.resolve(message.result);
  }

  function handleFigmaResult(message) {
    const requestId = message.requestId;
    if (!requestId) {
      logger("[bridge] ignored Figma result without requestId");
      return;
    }

    const pending = pendingFigmaRequests.get(requestId);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingFigmaRequests.delete(requestId);

    if (pending.relaySocket) {
      sendJson(pending.relaySocket, {
        type: "mcp-result",
        requestId: pending.relayRequestId || requestId,
        result: message
      });
      // Must still resolve to unblock figmaCommandQueue — without this the queue
      // is permanently stuck after the first relay command completes.
      pending.resolve(message);
      return;
    }

    pending.resolve(message);
  }

  function sendJson(ws, value) {
    if (ws && ws.readyState === WS_OPEN) {
      ws.send(JSON.stringify(value));
    }
  }

  function rejectPendingFigmaRequests(error) {
    for (const [requestId, pending] of pendingFigmaRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pendingFigmaRequests.delete(requestId);
    }
  }

  function rejectPendingBrokerRequests(error) {
    for (const [requestId, pending] of pendingBrokerRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pendingBrokerRequests.delete(requestId);
    }
  }

  async function sendToFigma(command, timeoutMs = 15_000) {
    await ready;

    if (bridgeMode === "relay") {
      return sendViaBroker(command, timeoutMs);
    }

    return enqueueDirectToFigma(command, timeoutMs);
  }

  function enqueueDirectToFigma(command, timeoutMs = 15_000, relaySocket = null, relayRequestId = null) {
    const queuedAt = Date.now();
    let expired = false;

    const run = () => {
      if (expired) {
        throw new Error(`Timed out waiting for Figma command queue (${Math.round(timeoutMs / 1000)}s).`);
      }

      const elapsedMs = Date.now() - queuedAt;
      const remainingMs = Math.max(1, timeoutMs - elapsedMs);
      return sendDirectToFigma(command, remainingMs, relaySocket, relayRequestId);
    };

    const queued = figmaCommandQueue.then(run, run);
    figmaCommandQueue = queued.catch(() => {});

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        expired = true;
        reject(new Error(`Timed out waiting for Figma command queue (${Math.round(timeoutMs / 1000)}s).`));
      }, timeoutMs);

      queued.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  function sendDirectToFigma(command, timeoutMs = 15_000, relaySocket = null, relayRequestId = null) {
    return new Promise((resolve, reject) => {
      if (!figmaSocket || figmaSocket.readyState !== WS_OPEN) {
        return reject(new Error(
          "Figma plugin is not connected. " +
          "Open Figma Desktop, run Plugins -> Development -> Free Figma MCP Bridge, then press Start."
        ));
      }

      const requestId = command.requestId || relayRequestId || nextRequestId("figma");
      command.requestId = requestId;

      const timer = setTimeout(() => {
        pendingFigmaRequests.delete(requestId);
        reject(new Error(`Timed out waiting for Figma response (${Math.round(timeoutMs / 1000)}s).`));
      }, timeoutMs);

      pendingFigmaRequests.set(requestId, { resolve, reject, timer, relaySocket, relayRequestId });
      figmaSocket.send(JSON.stringify(command));
    });
  }

  function sendViaBroker(command, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      if (!brokerClient || brokerClient.readyState !== WS_OPEN) {
        return reject(new Error(
          `Free Figma MCP is in relay mode, but the owner bridge on :${port} is not connected.`
        ));
      }

      const requestId = nextRequestId("relay");
      command.requestId = requestId;

      const timer = setTimeout(() => {
        pendingBrokerRequests.delete(requestId);
        reject(new Error(`Timed out waiting for relay response (${Math.round(timeoutMs / 1000)}s).`));
      }, timeoutMs);

      pendingBrokerRequests.set(requestId, { resolve, reject, timer });
      brokerClient.send(JSON.stringify({
        type: "mcp-command",
        requestId,
        timeoutMs,
        command
      }));
    });
  }

  return {
    ready,
    sendToFigma,
    getMode: () => bridgeMode,
    getPort: () => port
  };
}
