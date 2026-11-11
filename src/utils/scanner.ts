import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

export type ScanDriver = "wia" | "twain" | "escl";

export interface ScannerInfo {
  /** UI uchun noyob kalit: "wia:Canon MF3010" */
  id: string;
  name: string;
  driver: ScanDriver;
}

export interface ScanOptions {
  device: string;
  driver: ScanDriver;
  dpi?: number;
  mode?: "color" | "gray" | "bw";
  paperSize?: "A4" | "Letter" | "Legal";
}

// NAPS2 o'rnatilgan manzil (.env dagi NAPS2_PATH orqali o'zgartirish mumkin)
const NAPS2_PATH =
  process.env.NAPS2_PATH || "C:\\Program Files\\NAPS2\\naps2.console.exe";

// Qaysi drayverlar orqali skaner qidiriladi (masalan: "wia,twain,escl")
const DRIVERS: ScanDriver[] = (process.env.SCANNER_DRIVERS || "wia,twain")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter((d): d is ScanDriver => d === "wia" || d === "twain" || d === "escl");

let cache: { at: number; list: ScannerInfo[] } | null = null;
const CACHE_MS = 60_000;

async function killNaps2() {
  if (process.platform !== "win32") return;
  await execFileAsync("taskkill", ["/F", "/IM", "naps2.console.exe", "/T"]).catch(() => {});
  await execFileAsync("taskkill", ["/F", "/IM", "NAPS2.Worker.exe", "/T"]).catch(() => {});
}

async function listByDriver(driver: ScanDriver): Promise<ScannerInfo[]> {
  try {
    const { stdout } = await execFileAsync(
      NAPS2_PATH,
      ["--listdevices", "--driver", driver],
      { timeout: 30_000, windowsHide: true }
    );
    return stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => ({ id: `${driver}:${name}`, name, driver }));
  } catch (err) {
    console.error(`Skanerlar ro'yxatini olishda xatolik (${driver}):`, err);
    return [];
  }
}

/**
 * Kompyuterga ulangan/o'rnatilgan skanerlar ro'yxati.
 * WIA odatda faqat hozir ulangan qurilmalarni qaytaradi, TWAIN esa o'rnatilgan drayverlarni.
 */
export async function listScanners(refresh = false): Promise<ScannerInfo[]> {
  if (!refresh && cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  await killNaps2();
  const list: ScannerInfo[] = [];
  // NAPS2 bir vaqtda bir nechta nusxada yaxshi ishlamaydi, shuning uchun ketma-ket
  for (const driver of DRIVERS) list.push(...(await listByDriver(driver)));
  cache = { at: Date.now(), list };
  return list;
}

/**
 * Tanlangan skaner orqali bitta varaqni skanerlash.
 * Vaqtinchalik JPG fayl nomini qaytaradi (os.tmpdir() ichida).
 */
export async function scanPage(options: ScanOptions): Promise<string> {
  const { device, driver, dpi = 150, mode = "color", paperSize = "A4" } = options;

  const tempFileName = `scan_${Date.now()}.jpg`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  const args = [
    "-o", tempFilePath,
    "--driver", driver,
    "--device", device,
    "--dpi", String(dpi),
    "--bitdepth", mode,
    "--pagesize", paperSize,
    "--force", // Mavjud faylni ustidan yozish
  ];

  try {
    await killNaps2();
    console.log(`Skanerlanmoqda: ${device} (${driver}), ${mode}, ${dpi} DPI...`);
    await execFileAsync(NAPS2_PATH, args, { timeout: 180_000, windowsHide: true });
    return tempFileName;
  } catch (error) {
    console.error("Skanerlashda xatolik:", error);
    throw new Error(
      `«${device}» skaneri orqali skanerlash muvaffaqiyatsiz tugadi. Skaner yoqilganini tekshiring yoki boshqa skanerni tanlang.`
    );
  }
}
