import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.FAKE_PRINTER_PORT || 9100);
const host = process.env.FAKE_PRINTER_HOST || "127.0.0.1";

const outDir = path.resolve(__dirname, "..", "fake-printer-out");
fs.mkdirSync(outDir, { recursive: true });

const server = net.createServer((socket) => {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(outDir, `job-${ts}.bin`);
  const stream = fs.createWriteStream(file);

  console.log(`[fake-printer] connection from ${socket.remoteAddress}:${socket.remotePort}`);
  console.log(`[fake-printer] writing to ${file}`);

  socket.on("data", (chunk) => {
    stream.write(chunk);
    process.stdout.write(`[fake-printer] received ${chunk.length} bytes\n`);
  });

  socket.on("close", () => {
    stream.end();
    console.log("[fake-printer] connection closed");
  });

  socket.on("error", (err) => {
    stream.end();
    console.error("[fake-printer] socket error:", err);
  });
});

server.listen(port, host, () => {
  console.log(`[fake-printer] listening on ${host}:${port}`);
  console.log(`[fake-printer] set PRINTER_IP=${host} PRINTER_PORT=${port} in desktop app`);
});

