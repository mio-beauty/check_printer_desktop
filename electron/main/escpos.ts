import iconv from "iconv-lite";

const INIT = Buffer.from([0x1b, 0x40]); // ESC @
const CN_OFF = Buffer.from([0x1c, 0x2e]); // FS .
const INTL_RU = Buffer.from([0x1b, 0x52, 0x07]); // ESC R 7
const CODEPAGE = (n: number) => Buffer.from([0x1b, 0x74, n & 0xff]); // ESC t n
const CUT = Buffer.from([0x1d, 0x56, 0x41, 0x10]); // GS V A 0x10
const NEWLINE = Buffer.from("\n");
const ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const LINE_COMMANDS = new Map([
  ["!BIG", Buffer.from([0x1b, 0x21, 0x30])],
  ["!NORMAL", Buffer.from([0x1b, 0x21, 0x00])],
  ["!CENTER", ALIGN_CENTER],
  ["!LEFT", ALIGN_LEFT],
  ["!RIGHT", Buffer.from([0x1b, 0x61, 0x02])],
]);

function encodeLine(line: string, encoding: string): Buffer {
  const command = line.split(" ", 1)[0];
  const style = LINE_COMMANDS.get(command);
  if (!style) return Buffer.concat([iconv.encode(line, encoding), NEWLINE]);

  const text = line.slice(command.length).trimStart();
  return text ? Buffer.concat([style, iconv.encode(text, encoding), NEWLINE]) : style;
}

export function buildEscPosRaster(bitmap: Buffer, { width, height }: { width: number; height: number }): Buffer {
  const rowBytes = Math.ceil(width / 8);
  const raster = Buffer.alloc(8 + rowBytes * height);
  raster.set([0x1d, 0x76, 0x30, 0x00]); // GS v 0, normal scale.
  raster.writeUInt16LE(rowBytes, 4);
  raster.writeUInt16LE(height, 6);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      // Chromium stores premultiplied color. Composite it on white paper before thresholding.
      const gray = (bitmap[pixel] + bitmap[pixel + 1] + bitmap[pixel + 2]) / 3 + 255 - bitmap[pixel + 3];
      if (gray < 128) {
        const index = 8 + y * rowBytes + (x >> 3);
        raster[index] |= 0x80 >> (x & 7);
      }
    }
  }
  return raster;
}

export function buildEscPosJob(
  text: string,
  { encoding = "cp866", codepage = 17, logo }: { encoding?: string; codepage?: number | null; logo?: Buffer } = {},
): Buffer {
  const chunks: Buffer[] = [INIT, CN_OFF, INTL_RU];
  if (typeof codepage === "number" && Number.isFinite(codepage)) {
    chunks.push(CODEPAGE(codepage));
  }
  if (logo) chunks.push(ALIGN_CENTER, logo, NEWLINE, ALIGN_LEFT);
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    chunks.push(encodeLine(line, encoding));
  }
  chunks.push(Buffer.from("\n\n"));
  chunks.push(CUT);
  return Buffer.concat(chunks);
}
