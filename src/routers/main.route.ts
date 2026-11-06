import express from "express";
import { scanFromCanon } from "../utils/scanFromCanon";
import z from "zod";
import { createPdfByImgs } from "../utils/createPdfByImgs";
import os from "os";
import path from "path";

const router = express.Router();

const scanOptionsBodySchema = z.object({
  dpi: z.enum(["75", "100", "150", "200", "300", "400"]).optional(),
  mode: z.enum(["color", "gray", "bw"]).optional(),
  paperSize: z.enum(["A4", "Letter", "Legal"]).optional(),
});

router.post("/scanFromCanon", async (req, res) => {
  try {
    const {
      dpi = 300,
      mode = "color",
      paperSize = "A4",
    } = scanOptionsBodySchema.parse(req.body);

    const tempFileName = await scanFromCanon({
      dpi: Number(dpi),
      mode,
      paperSize,
    });
    res.send(tempFileName);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

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
