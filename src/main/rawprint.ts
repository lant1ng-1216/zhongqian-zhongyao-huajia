import { app } from 'electron'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'

// 通过 Windows 打印后台 RAW 模式把 ESC/POS 原始字节直接发给打印机。
// 原理与满天星（Delphi + WINSPOOL：OpenPrinter/StartDocPrinter(RAW)/WritePrinter）一致。
// 用一段随程序附带的 PowerShell 调用 winspool，避免引入原生模块。

const PS_SCRIPT = `param([Parameter(Mandatory=$true)][string]$PrinterName,[Parameter(Mandatory=$true)][string]$FilePath)
$ErrorActionPreference = "Stop"
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class ZQRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)] public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h;
    if(!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("打不开打印机: " + printer + " (err " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "ZhongqianReceipt"; di.pDataType = "RAW";
      if(!StartDocPrinter(h, 1, ref di)) throw new Exception("StartDocPrinter 失败 (err " + Marshal.GetLastWin32Error() + ")");
      try {
        if(!StartPagePrinter(h)) throw new Exception("StartPagePrinter 失败 (err " + Marshal.GetLastWin32Error() + ")");
        int written;
        if(!WritePrinter(h, bytes, bytes.Length, out written)) throw new Exception("WritePrinter 失败 (err " + Marshal.GetLastWin32Error() + ")");
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
[ZQRawPrinter]::Send($PrinterName, $bytes)
Write-Output "OK"
`

export function rawPrint(
  printerName: string,
  data: Buffer
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ ok: false, error: '原始打印（ESC/POS）仅在 Windows 下可用；当前非 Windows 环境' })
      return
    }
    if (!printerName) {
      resolve({ ok: false, error: '未指定打印机，请到「设置」选择你的小票打印机' })
      return
    }
    const dir = app.getPath('temp')
    const bin = join(dir, `zq-escpos-${Date.now()}.bin`)
    const ps = join(dir, `zq-rawprint.ps1`)
    try {
      writeFileSync(bin, data)
      writeFileSync(ps, PS_SCRIPT, 'utf-8')
    } catch (e) {
      resolve({ ok: false, error: (e as Error).message })
      return
    }
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps, '-PrinterName', printerName, '-FilePath', bin],
      { windowsHide: true, timeout: 20000 },
      (err, _stdout, stderr) => {
        try {
          unlinkSync(bin)
        } catch {
          /* 忽略 */
        }
        if (err) {
          const msg = (stderr || err.message || '打印失败').toString().trim()
          resolve({ ok: false, error: msg.slice(0, 400) })
        } else {
          resolve({ ok: true })
        }
      }
    )
  })
}
