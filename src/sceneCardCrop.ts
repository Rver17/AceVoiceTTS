// Scene cards use centered green lettering beneath a nearly black scene.
// Sample the layout first and only process full-resolution lettering on a match.
export function sceneCardCrop(video: HTMLVideoElement) {
  const sample = document.createElement("canvas");
  const w = 256,
    h = Math.max(1, Math.round((w * video.videoHeight) / video.videoWidth));
  sample.width = w;
  sample.height = h;
  const ctx = sample.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  let dark = 0,
    total = 0,
    green = 0,
    left = w,
    right = 0,
    top = h,
    bottom = 0;
  for (let y = Math.floor(0.08 * h); y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4,
        r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2];
      if (y < h * 0.45) {
        total++;
        if (Math.max(r, g, b) < 40) dark++;
        continue;
      }
      if (g > 65 && g > 1.7 * r && g > 1.5 * b) {
        green++;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (
    dark < total * 0.9 ||
    green < 16 ||
    right - left < 18 ||
    Math.abs((left + right) / 2 - w / 2) > w * 0.16
  )
    return null;
  const x = Math.max(0, left - 4) / w,
    y = Math.max(0, top - 3) / h;
  const width = Math.min(1 - x, (right - left + 9) / w),
    height = Math.min(1 - y, (bottom - top + 7) / h);
  const image = document.createElement("canvas");
  image.width = Math.max(
    1,
    Math.min(1500, Math.round(width * video.videoWidth * 1.5)),
  );
  image.height = Math.max(
    1,
    Math.round(
      (image.width * height * video.videoHeight) / (width * video.videoWidth),
    ),
  );
  const output = image.getContext("2d", { willReadFrequently: true })!;
  output.drawImage(
    video,
    x * video.videoWidth,
    y * video.videoHeight,
    width * video.videoWidth,
    height * video.videoHeight,
    0,
    0,
    image.width,
    image.height,
  );
  const data = output.getImageData(0, 0, image.width, image.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i],
      g = data.data[i + 1],
      b = data.data[i + 2];
    const ink = g > 60 && g > r * 1.55 && g > b * 1.35 ? 0 : 255;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = ink;
  }
  output.putImageData(data, 0, 0);
  return image;
}
