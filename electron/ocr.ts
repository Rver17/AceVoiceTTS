import { createWorker, PSM, type Worker } from "tesseract.js";
import path from "node:path";
let worker: Promise<Worker> | undefined;
export async function recognize(
  images: Uint8Array[],
  root: string,
  dir: string,
) {
  if (!worker)
    worker = createWorker("eng", 1, {
      langPath: path.join(root, "node_modules/@tesseract.js-data/eng/4.0.0"),
      cachePath: dir,
    }).catch((e) => {
      worker = undefined;
      throw e;
    });
  const active = await worker;
  const results = [];
  for (const [i, image] of images.entries()) {
    await active.setParameters({
      tessedit_pageseg_mode: i === 0 ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE,
    });
    const { data } = await active.recognize(Buffer.from(image));
    results.push({ text: data.text, confidence: data.confidence / 100 });
  }
  return results;
}
export function closeOCR() {
  void worker?.then((w) => w.terminate()).catch(() => {});
}
