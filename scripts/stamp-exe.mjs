import fs from "node:fs";
import { NtExecutable, NtExecutableResource, Resource, Data } from "resedit";
const metadata = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const file = process.argv[2];
const exe = NtExecutable.from(fs.readFileSync(file), { ignoreCert: true });
const resources = NtExecutableResource.from(exe);
const icons = Data.IconFile.from(
  fs.readFileSync(new URL("../public/acevoice.ico", import.meta.url)),
).icons.map((i) => i.data);
for (const group of Resource.IconGroupEntry.fromEntries(resources.entries))
  Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries,
    group.id,
    group.lang,
    icons,
  );
const parts = metadata.version.split(".").map(Number);
for (const info of Resource.VersionInfo.fromEntries(resources.entries)) {
  for (const language of info.getAllLanguagesForStringValues()) {
    info.setFileVersion(...parts, 0, language.lang);
    info.setProductVersion(...parts, 0, language.lang);
    info.setStringValues(language, {
      ProductName: metadata.productName,
      CompanyName: metadata.author,
      FileDescription: metadata.description,
      OriginalFilename: "AceVoice.exe",
      InternalName: "AceVoice",
      Comments: "Developed by " + metadata.author,
      LegalCopyright:
        "AceVoice application © " +
        new Date().getFullYear() +
        " " +
        metadata.author,
    });
  }
  info.outputToResourceEntries(resources.entries);
}
resources.outputResource(exe);
fs.writeFileSync(file, Buffer.from(exe.generate()));
