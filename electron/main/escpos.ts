import * as iconv from "iconv-lite";

const INIT = Buffer.from([0x1b, 0x40]); // ESC @
const CN_OFF = Buffer.from([0x1c, 0x2e]); // FS .
const INTL_RU = Buffer.from([0x1b, 0x52, 0x07]); // ESC R 7
const CUT = Buffer.from([0x1d, 0x56, 0x41, 0x10]); // GS V A 0x10

function encodeLine(line: string, encoding: string): Buffer {
  if (line.startsWith("!BIG")) {
    const payload = line.slice(4).trimStart();
    return Buffer.concat([Buffer.from([0x1b, 0x21, 0x30]), iconv.encode(payload, encoding), Buffer.from("\n")]);
  }
  if (line.startsWith("!NORMAL")) {
    return Buffer.from([0x1b, 0x21, 0x00]);
  }
  if (line.startsWith("!CENTER")) {
    return Buffer.from([0x1b, 0x61, 0x01]);
  }
  if (line.startsWith("!LEFT")) {
    return Buffer.from([0x1b, 0x61, 0x00]);
  }
  if (line.startsWith("!RIGHT")) {
    return Buffer.from([0x1b, 0x61, 0x02]);
  }
  return Buffer.concat([iconv.encode(line, encoding), Buffer.from("\n")]);
}

export function buildEscPosJob(text: string, { encoding = "cp866" }: { encoding?: string } = {}): Buffer {
  const chunks: Buffer[] = [INIT, CN_OFF, INTL_RU];
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    chunks.push(encodeLine(line, encoding));
  }
  chunks.push(Buffer.from("\n\n"));
  chunks.push(CUT);
  return Buffer.concat(chunks);
}
