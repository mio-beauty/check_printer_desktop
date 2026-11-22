import fs from "node:fs";
import path from "node:path";

type PrintResult = { status: "success" | "failed" | "unknown"; error?: string };
type Entry = { timestamp: number; result: PrintResult };
const retentionMs = 7 * 24 * 60 * 60 * 1000;
const maxEntries = 10000;
const running = new Map<string, Promise<PrintResult>>();
let entries: Map<string, Entry> | undefined;

function load(file: string): Map<string, Entry> {
  if (entries) return entries;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Entry>;
    entries = new Map(
      Object.entries(data)
        .filter(([, entry]) => entry && entry.timestamp >= Date.now() - retentionMs)
        .slice(-maxEntries),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    entries = new Map();
  }
  return entries;
}

function store(file: string, history: Map<string, Entry>, id: string, result: PrintResult) {
  history.delete(id);
  history.set(id, { timestamp: Date.now(), result });
  while (history.size > maxEntries) {
    const oldest = history.keys().next().value;
    if (oldest === undefined) break;
    history.delete(oldest);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(Object.fromEntries(history)), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}

export function printOnce(directory: string, id: string, print: () => Promise<void>): Promise<PrintResult> {
  const inFlight = running.get(id);
  if (inFlight) return inFlight;

  const file = path.join(directory, "print-history.json");
  const task = (async (): Promise<PrintResult> => {
    let history: Map<string, Entry>;
    try {
      history = load(file);
      const existing = history.get(id);
      if (existing) return existing.result;
      // A restart while sending leaves an indeterminate physical result.
      store(file, history, id, { status: "unknown", error: "previous_delivery_uncertain" });
    } catch (error) {
      return { status: "unknown", error: `print_history_unavailable: ${String(error)}` };
    }

    let result: PrintResult;
    try {
      await print();
      result = { status: "success" };
    } catch (error) {
      result = { status: "failed", error: String(error) };
    }
    try {
      store(file, history, id, result);
    } catch {
      // The pre-send marker remains on disk and prevents unsafe printing after restart.
    }
    return result;
  })().finally(() => running.delete(id));
  running.set(id, task);
  return task;
}
