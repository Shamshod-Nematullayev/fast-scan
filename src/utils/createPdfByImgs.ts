import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { PDFDocument } from "pdf-lib";

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function createPdfByImgs(
  imgFileNames: string[],
  outputFileName: string
) {
  const dateFolder = formatDate(new Date());
  const baseDir = path.join(os.homedir(), "Pictures", dateFolder);

  // 1. Papka borligini tekshirish va bo'lmasa yaratish
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // 2. Fayl nomi takrorlanmasligini ta'minlash
  let finalFileName = `${outputFileName}.pdf`;
  let counter = 1;

  while (fs.existsSync(path.join(baseDir, finalFileName))) {
    // "0001", "0002" ko'rinishida formatlash
    const suffix = String(counter).padStart(4, "0");
    finalFileName = `${outputFileName}_${suffix}.pdf`;
    counter++;
  }

  const fullPath = path.join(baseDir, finalFileName);

  // 3. PDF yaratish jarayoni (pdf-lib misolida)
  try {
    const pdfDoc = await PDFDocument.create();

    for (const imgPath of imgFileNames) {
      // Rasmni o'qish va PDF-ga sahifa sifatida qo'shish logikasi shu yerda bo'ladi
      const imgBytes = fs.readFileSync(imgPath);
      const image = imgPath.toLowerCase().endsWith(".png")
        ? await pdfDoc.embedPng(imgBytes)
        : await pdfDoc.embedJpg(imgBytes);

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(fullPath, pdfBytes);
    imgFileNames.forEach((imgPath) =>
      fs.unlink(imgPath, (err) => {
        if (err) {
          console.error("Faylni o'chirishda xatolik:", err);
        }
        console.log(`Fayl muvaffaqiyatli o'chirildi: ${imgPath}`);
      })
    );
    console.log(`Fayl muvaffaqiyatli saqlandi: ${fullPath}`);
    return fullPath;
  } catch (error) {
    console.error("PDF yaratishda xatolik:", error);
  }
}
