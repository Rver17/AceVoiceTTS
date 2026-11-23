import { api, type Regions, type Readout } from "./api";
import type { Rect } from "../core/contracts";

function crop(video: HTMLVideoElement, r: Rect, contrast: number) {
  const { videoWidth: w, videoHeight: h } = video;
  const canvas = document.createElement("canvas");
  const scale = Math.min(2, 1800 / (w * r.w), 700 / (h * r.h));
  canvas.width = Math.max(1, Math.round(w * r.w * scale));
  canvas.height = Math.max(1, Math.round(h * r.h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = "grayscale(1) contrast(" + contrast + ")";
  ctx.drawImage(
    video,
    r.x * w,
    r.y * h,
    r.w * w,
    r.h * h,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}
async function png(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((ok, fail) =>
    canvas.toBlob((b) =>
      b ? ok(b) : fail(Error("Capture frame unavailable")),
    ),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
export class Recognition {
  private signature = "";
  private previous: Readout[] = [];
  async read(video: HTMLVideoElement, r: Regions, contrast: number) {
    if (video.readyState < 2 || !video.videoWidth)
      throw Error("Frame unavailable. Restore the window or choose a display.");
    const canvases = [
      crop(video, r.dialogueBox, contrast),
      crop(video, r.speakerNameBox, contrast),
    ];
    const signature = canvases
      .map((c) => {
        const pixels = c
          .getContext("2d")!
          .getImageData(0, 0, c.width, c.height).data;
        let hash = 0,
          bright = 0;
        for (let i = 0; i < pixels.length; i += 16) {
          hash = (Math.imul(hash, 31) + pixels[i]) | 0;
          if (pixels[i] > 20) bright++;
        }
        return bright ? String(hash) : "black";
      })
      .join("/");
    if (signature === "black/black")
      throw Error(
        "Black capture regions. Restore the window, use borderless mode, or choose a display.",
      );
    if (signature !== this.signature) {
      const result = await api.ocr(await Promise.all(canvases.map(png)));
      this.previous = result;
      this.signature = signature;
    }
    return this.previous;
  }
}
