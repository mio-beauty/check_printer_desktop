import net from "node:net";

export async function sendToTcpPrinter(
  payload: Buffer,
  { host, port, timeoutMs = 5000 }: { host: string; port: number; timeoutMs?: number },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error(`TCP printer timeout after ${timeoutMs}ms`));
    };
    const cleanup = () => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        // ignore
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
    socket.connect(port, host, () => {
      socket.write(payload, (err) => {
        if (err) return onError(err);
        socket.end(() => {
          cleanup();
          resolve();
        });
      });
    });
  });
}

