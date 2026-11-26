import { api, type Regions, type Readout } from "./api";
import type { Rect } from "../core/contracts";
import { nameplateCrop } from "./nameplateCrop";
import { sceneCardCrop } from "./sceneCardCrop";
import { findDialoguePanel, panelTextRegion } from "./dialoguePanel";

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
  async read(
    video: HTMLVideoElement,
    r: Regions,
    contrast: number,
    manual = false,
  ) {
    if (video.readyState < 2 || !video.videoWidth) return null;
    const card = sceneCardCrop(video);
    const panel = !manual && !card ? findDialoguePanel(video) : null;
    const search = manual
      ? r.speakerNameBox
      : {
          x: 0.035,
          y: Math.max(0.38, (panel?.y ?? 0.68) - 0.08),
          w: 0.43,
          h: 0.15,
        };
    const plate = card ? null : nameplateCrop(video, search);
    const textRegion = panel
      ? panelTextRegion(panel, plate?.bottom)
      : r.dialogueBox;
    const canvases = [card ?? crop(video, textRegion, contrast)];
    if (!card) {
      if (!panel) canvases.push(crop(video, r.speakerNameBox, contrast));
      if (plate) canvases.push(plate.canvas);
    }
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
    if (signature.split("/").every((part) => part === "black")) return null;
    const cacheKey = (card ? "card/" : "game/") + signature;
    if (cacheKey !== this.signature) {
      const result = await api.ocr(await Promise.all(canvases.map(png)));
      this.previous = result;
      this.signature = cacheKey;
    }
    return {
      reads: this.previous,
      kind: card ? ("scene-card" as const) : undefined,
    };
  }
}
