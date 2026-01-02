import express from "express";
import { scanFromCanon } from "../utils/scanFromCanon";
import z from "zod";

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
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
