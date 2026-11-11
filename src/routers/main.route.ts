import express from "express";
import { listScanners, scanPage } from "../utils/scanner";
import z from "zod";
import { createPdfByImgs } from "../utils/createPdfByImgs";
import os from "os";
import path from "path";

const router = express.Router();

const scanOptionsBodySchema = z.object({
  device: z.string().min(1).max(200).optional(),
  driver: z.enum(["wia", "twain", "escl"]).optional(),
  dpi: z.enum(["75", "100", "150", "200", "300", "400"]).optional(),
  mode: z.enum(["color", "gray", "bw"]).optional(),
  paperSize: z.enum(["A4", "Letter", "Legal"]).optional(),
});

// O'rnatilgan skanerlar ro'yxati (?refresh=1 — keshni yangilash)
router.get("/scanners", async (req, res) => {
  try {
    const list = await listScanners(req.query.refresh === "1");
    res.json(list);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

async function handleScan(req: express.Request, res: express.Response) {
  try {
    const {
      device = process.env.DEFAULT_SCANNER || "Canon MF3010",
      driver = (process.env.DEFAULT_SCANNER_DRIVER as "wia" | "twain" | "escl") || "wia",
      dpi = 300,
      mode = "color",
      paperSize = "A4",
    } = scanOptionsBodySchema.parse(req.body);

    const tempFileName = await scanPage({
      device,
      driver,
      dpi: Number(dpi),
      mode,
      paperSize,
    });
    res.send(tempFileName);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
}

router.post("/scan", handleScan);
// Eski manzil (orqaga moslik uchun)
router.post("/scanFromCanon", handleScan);

const createPdfByImgsBodySchema = z.object({
  imgFileNames: z.array(z.string()),
  outputFileName: z.string(),
});
// Windows fayl nomida ruxsat etilmagan belgilarni olib tashlash
function sanitizeFileName(name: string) {
  const clean = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/[. ]+$/, "")
    .trim();
  return clean || "scanned_document";
}

router.post("/createPdfByImgs", async (req, res) => {
  try {
    const { imgFileNames, outputFileName } = createPdfByImgsBodySchema.parse(
      req.body
    );
    if (imgFileNames.length === 0) {
      return res.status(400).send("Saqlash uchun varaq yo'q");
    }
    const tempFileName = await createPdfByImgs(
      imgFileNames.map((f) => path.join(os.tmpdir(), path.basename(f))),
      sanitizeFileName(outputFileName)
    );
    res.send(tempFileName);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

router.get("/image/:fileName", (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(os.tmpdir(), fileName);
  res.sendFile(filePath);
});

export default router;
