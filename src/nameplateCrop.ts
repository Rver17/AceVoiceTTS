import type { Rect } from "../core/contracts";

// Locate a blue nameplate inside and immediately around the calibrated area.
// Its horizontal bands give a tighter crop than a rectangle containing scenery.
export function nameplateCrop(video: HTMLVideoElement, region: Rect) {
  const left = Math.max(0, region.x - 0.015),
    top = Math.max(0, region.y - 0.025);
  const width = Math.min(1 - left, region.w + 0.035),
    height = Math.min(1 - top, region.h + 0.055);
  const sample = document.createElement("canvas");
  sample.width = Math.max(
    1,
    Math.min(480, Math.round(width * video.videoWidth)),
  );
  sample.height = Math.max(
    1,
    Math.round(
      (sample.width * height * video.videoHeight) / (width * video.videoWidth),
    ),
  );
  const ctx = sample.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(
    video,
    left * video.videoWidth,
    top * video.videoHeight,
    width * video.videoWidth,
    height * video.videoHeight,
    0,
    0,
    sample.width,
    sample.height,
  );
  const w = sample.width,
    h = sample.height,
    pixels = ctx.getImageData(0, 0, w, h);
  const isBlue = (x: number, y: number) => {
    const i = (y * w + x) * 4,
      r = pixels.data[i],
      g = pixels.data[i + 1],
      b = pixels.data[i + 2];
    return b > 105 && g > 60 && b > r + 45 && b > g + 10 && g > r + 18;
  };
  let longest = 0,
    x0 = 0,
    y0 = 0;
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      run = isBlue(x, y) ? run + 1 : 0;
      if (run > longest) {
        longest = run;
        x0 = x - run + 1;
        y0 = y;
      }
    }
  }
  if (longest < Math.max(24, w * 0.13)) return null;
  const inBand = (y: number) => {
    let hits = 0;
    for (let x = x0; x < x0 + longest; x += 2) if (isBlue(x, y)) hits++;
    return hits >= longest * 0.21;
  };
  let y1 = y0,
    y2 = y0;
  while (y1 > 0 && inBand(y1 - 1)) y1--;
  while (y2 + 1 < h && inBand(y2 + 1)) y2++;
  const bandHeight = y2 - y1 + 1;
  if (bandHeight < 7 || longest / bandHeight < 1.6 || longest / bandHeight > 20)
    return null;
  const box = document.createElement("canvas");
  const scale = Math.min(5, 60 / bandHeight);
  box.width = Math.ceil(longest * scale) + 20;
  box.height = Math.ceil(bandHeight * scale) + 20;
  const output = box.getContext("2d")!;
  output.fillStyle = "white";
  output.fillRect(0, 0, box.width, box.height);
  // Extract bright, nearly neutral lettering and discard the saturated plate.
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i],
      g = pixels.data[i + 1],
      b = pixels.data[i + 2];
    const value =
      Math.min(r, g, b) > 145 && Math.max(r, g, b) - Math.min(r, g, b) < 85
        ? 0
        : 255;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  // Remove the pointed ends and their white outline before reading the name.
  const inset = Math.min(bandHeight * 0.44, longest * 0.12);
  output.drawImage(
    sample,
    x0 + inset,
    y1 + 1,
    longest - 2 * inset,
    bandHeight - 2,
    10,
    10,
    longest * scale,
    bandHeight * scale,
  );
  return { canvas: box, bottom: top + ((y2 + 1) / h) * height };
}
