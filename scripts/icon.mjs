import fs from "node:fs";
import { Resvg } from "@resvg/resvg-js";
const source = fs.readFileSync(
  new URL("../public/acevoice.svg", import.meta.url),
);
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((width) =>
  new Resvg(source, { fitTo: { mode: "width", value: width } })
    .render()
    .asPng(),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + 16 * i;
  header[entry] = header[entry + 1] = sizes[i] % 256;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
fs.writeFileSync(
  new URL("../public/acevoice.ico", import.meta.url),
  Buffer.concat([header, ...images]),
);
