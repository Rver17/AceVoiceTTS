import type { Rect } from "../core/contracts";

// The Trilogy dialogue panel is a broad horizontal band of dark navy pixels.
// Working in capture coordinates also handles a window frame or black margins.
export function findDialoguePanel(video: HTMLVideoElement): Rect | null {
  const small = document.createElement("canvas");
  const w = 192,
    h = Math.max(1, Math.round((w * video.videoHeight) / video.videoWidth));
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  const start = Math.floor(h * 0.36);
  let first = -1,
    best: Rect | null = null;
  for (let y = start; y <= h; y++) {
    let hits = 0;
    for (let x = 0; y < h && x < w; x++) {
      const i = (y * w + x) * 4,
        r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2];
      if (r < 48 && g < 61 && b < 92 && b > r + 9 && b > g + 4) hits++;
    }
    if (hits > w * 0.53) {
      if (first < 0) first = y;
      continue;
    }
    if (
      first > start &&
      y - first >= h * 0.08 &&
      (!best || y - first > best.h * h)
    ) {
      best = { x: 0, y: first / h, w: 1, h: (y - first) / h };
    }
    first = -1;
  }
  return best;
}

export function panelTextRegion(panel: Rect, plateBottom?: number): Rect {
  const top = Math.max(panel.y + 0.006, plateBottom ?? panel.y + 0.012);
  const end = panel.y + panel.h;
  return { x: 0.045, y: top, w: 0.85, h: Math.max(0.02, end - top - 0.018) };
}
