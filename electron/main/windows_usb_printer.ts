import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type ExecResult = { code: number; stdout: string; stderr: string };

function execFileAsync(file: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: timeoutMs }, (error: any, stdout, stderr) => {
      const code = typeof error?.code === "number" ? error.code : error ? 1 : 0;
      resolve({ code, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

function isWindows(): boolean {
  return process.platform === "win32";
}

function psArgs(command: string): string[] {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ];
}

export async function listWindowsPrinters(): Promise<string[]> {
  if (!isWindows()) return [];

  // Prefer Get-Printer (PrintManagement). Fallback to wmic.
  const ps = await execFileAsync(
    "powershell.exe",
    psArgs(
      [
        "$ErrorActionPreference = 'Stop'",
        "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
      ].join("; "),
    ),
    { timeoutMs: 8000 },
  );
  if (ps.code === 0) {
    try {
      const parsed = JSON.parse(ps.stdout.trim() || "[]");
      const names = (Array.isArray(parsed) ? parsed : [parsed])
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      names.sort((a, b) => a.localeCompare(b, "ru"));
      return names;
    } catch {
      // continue to fallback
    }
  }

  const wmic = await execFileAsync("wmic.exe", ["printer", "get", "name"], { timeoutMs: 8000 });
  if (wmic.code !== 0) return [];
  const lines = wmic.stdout
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l && l.toLowerCase() !== "name");
  const names = Array.from(new Set(lines));
  names.sort((a, b) => a.localeCompare(b, "ru"));
  return names;
}

export type UsbProbeResult = {
  configured: boolean;
  ok: boolean;
  checkedAt: string;
  error: string | null;
  details?: { printerStatus?: string | null; workOffline?: boolean | null };
};

export async function probeWindowsPrinter(printerName: string | null | undefined): Promise<UsbProbeResult> {
  const checkedAt = new Date().toISOString();
  const name = String(printerName || "").trim();
  if (!name) return { configured: false, ok: false, checkedAt, error: "usb_printer_not_configured" };
  if (!isWindows()) return { configured: true, ok: false, checkedAt, error: "usb_not_supported" };

  const ps = await execFileAsync(
    "powershell.exe",
    psArgs(
      [
        "$ErrorActionPreference = 'Stop'",
        `$p = Get-Printer -Name ${JSON.stringify(name)}`,
        "$o = [ordered]@{",
        "  Name = $p.Name",
        "  PrinterStatus = $p.PrinterStatus",
        "  WorkOffline = $p.WorkOffline",
        "}",
        "$o | ConvertTo-Json -Compress",
      ].join("; "),
    ),
    { timeoutMs: 8000 },
  );

  if (ps.code !== 0) {
    return { configured: true, ok: false, checkedAt, error: "usb_printer_not_found" };
  }

  try {
    const obj = JSON.parse(ps.stdout.trim() || "{}") as any;
    const printerStatus = obj?.PrinterStatus != null ? String(obj.PrinterStatus) : null;
    const workOffline = obj?.WorkOffline != null ? Boolean(obj.WorkOffline) : null;
    const ok = workOffline === false;
    return {
      configured: true,
      ok,
      checkedAt,
      error: ok ? null : "usb_printer_offline",
      details: { printerStatus, workOffline },
    };
  } catch {
    return { configured: true, ok: true, checkedAt, error: null };
  }
}

export async function sendRawToWindowsPrinter(opts: { printerName: string; payload: Buffer; docName: string }): Promise<void> {
  if (!isWindows()) throw new Error("usb_not_supported");
  const printerName = String(opts.printerName || "").trim();
  if (!printerName) throw new Error("usb_printer_not_configured");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mio-usb-print-"));
  const binPath = path.join(dir, "job.bin");
  fs.writeFileSync(binPath, opts.payload);

  // PowerShell + C# RawPrinterHelper (no native Node modules).
  // Reads bytes from temp file and sends RAW to the selected Windows printer.
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$printerName = ${JSON.stringify(printerName)}`,
    `$docName = ${JSON.stringify(opts.docName || "Check")}`,
    `$binPath = ${JSON.stringify(binPath)}`,
    "$bytes = [System.IO.File]::ReadAllBytes($binPath)",
    "Add-Type -Language CSharp -TypeDefinition @'\n" +
      "using System;\n" +
      "using System.Runtime.InteropServices;\n" +
      "\n" +
      "public class RawPrinterHelper {\n" +
      "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]\n" +
      "  public class DOCINFOA {\n" +
      "    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;\n" +
      "    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;\n" +
      "    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;\n" +
      "  }\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"OpenPrinterW\", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)]\n" +
      "  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"ClosePrinter\", SetLastError=true, ExactSpelling=true)]\n" +
      "  public static extern bool ClosePrinter(IntPtr hPrinter);\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"StartDocPrinterW\", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)]\n" +
      "  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFOA di);\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"EndDocPrinter\", SetLastError=true, ExactSpelling=true)]\n" +
      "  public static extern bool EndDocPrinter(IntPtr hPrinter);\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"StartPagePrinter\", SetLastError=true, ExactSpelling=true)]\n" +
      "  public static extern bool StartPagePrinter(IntPtr hPrinter);\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"EndPagePrinter\", SetLastError=true, ExactSpelling=true)]\n" +
      "  public static extern bool EndPagePrinter(IntPtr hPrinter);\n" +
      "\n" +
      "  [DllImport(\"winspool.Drv\", EntryPoint=\"WritePrinter\", SetLastError=true, ExactSpelling=true)]\n" +
      "  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);\n" +
      "\n" +
      "  public static void SendBytes(string printerName, string docName, byte[] bytes) {\n" +
      "    IntPtr hPrinter;\n" +
      "    if(!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) throw new Exception(\"OpenPrinter failed: \" + Marshal.GetLastWin32Error());\n" +
      "    try {\n" +
      "      DOCINFOA di = new DOCINFOA();\n" +
      "      di.pDocName = docName;\n" +
      "      di.pDataType = \"RAW\";\n" +
      "      if(!StartDocPrinter(hPrinter, 1, di)) throw new Exception(\"StartDocPrinter failed: \" + Marshal.GetLastWin32Error());\n" +
      "      try {\n" +
      "        if(!StartPagePrinter(hPrinter)) throw new Exception(\"StartPagePrinter failed: \" + Marshal.GetLastWin32Error());\n" +
      "        try {\n" +
      "          IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);\n" +
      "          Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);\n" +
      "          try {\n" +
      "            int written;\n" +
      "            if(!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written)) throw new Exception(\"WritePrinter failed: \" + Marshal.GetLastWin32Error());\n" +
      "          } finally {\n" +
      "            Marshal.FreeCoTaskMem(pUnmanagedBytes);\n" +
      "          }\n" +
      "        } finally {\n" +
      "          EndPagePrinter(hPrinter);\n" +
      "        }\n" +
      "      } finally {\n" +
      "        EndDocPrinter(hPrinter);\n" +
      "      }\n" +
      "    } finally {\n" +
      "      ClosePrinter(hPrinter);\n" +
      "    }\n" +
      "  }\n" +
      "}\n" +
      "'@",
    "[RawPrinterHelper]::SendBytes($printerName, $docName, $bytes)",
  ].join("; ");

  const res = await execFileAsync("powershell.exe", psArgs(script), { timeoutMs: 15000 });
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  if (res.code !== 0) {
    const msg = (res.stderr || res.stdout || "").trim() || "usb_print_failed";
    throw new Error(msg);
  }
}

