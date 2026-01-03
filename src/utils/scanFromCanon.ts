import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

// Skanerlash opsiyalari uchun interfeys
interface ScanOptions {
  dpi?: number;
  mode?: "color" | "gray" | "bw";
  paperSize?: "A4" | "Letter" | "Legal" | "Custom";
}

/**
 * Canon MF3010 orqali skanerlash va Buffer qaytarish
 */
export async function scanFromCanon(options: ScanOptions): Promise<string> {
  const { dpi = 150, mode = "color", paperSize = "A4" } = options;

  // NAPS2 o'rnatilgan manzil (agar PATH da bo'lmasa to'liq manzilni yozing)
  const naps2Path = `"C:\\Program Files\\NAPS2\\naps2.console.exe"`;

  // Vaqtinchalik fayl yaratish
  const tempFileName = `scan_${Date.now()}.jpg`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  // NAPS2 buyrug'ini yig'ish
  // --driver twain: Sizda ishlagan drayver
  // --device: Qurilma nomi
  // --bitdepth: color, gray, bw
  const command =
    `& ${naps2Path} -o "${tempFilePath}" ` +
    `--driver wia ` + // twain o'rniga wia
    `--device "Canon MF3010" ` +
    `--dpi ${dpi} ` +
    `--bitdepth ${mode} ` +
    `--pagesize ${paperSize} ` +
    `--force`; // Mavjud faylni ustidan yozish uchun

  try {
    await execAsync('taskkill /F /IM "naps2.console.exe" /T').catch(() => {});
    await execAsync('taskkill /F /IM "NAPS2.Worker.exe" /T').catch(() => {});
    console.log(`Skanerlanmoqda: ${mode}, ${dpi} DPI...`);

    // PowerShell orqali ishga tushirish
    await execAsync(command, { shell: "powershell.exe" });

    // Faylni Bufferga o'qish

    return tempFileName;
  } catch (error) {
    // Xato bo'lsa ham vaqtinchalik faylni o'chirishga harakat qilamiz
    try {
      //   await fs.unlink(tempFilePath);
    } catch (e) {}

    console.error("Skanerlashda xatolik:", error);
    throw new Error("Skanerlash jarayoni muvaffaqiyatsiz tugadi.");
  }
}
