// Exercise the Windows release with a generated reference and an isolated profile.
import { _electron as electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const dir = await mkdtemp(path.join(tmpdir(), "ace-personal-")),
  env = { ...process.env, ACEVOICE_PORT: "18771" };
delete env.ELECTRON_RUN_AS_NODE;
const exe = env.ACEVOICE_SMOKE_EXE;
const launch = () =>
  electron.launch({
    executablePath: exe,
    args: [
      ...(exe ? [] : ["."]),
      "--user-data-dir=" + dir,
      "--use-fake-device-for-media-stream",
    ],
    env,
  });
let app;
try {
  app = await launch();
  let page = await app.firstWindow();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setPosition(-2400,0));
  await page
    .getByRole("button", { name: "Engine settings, ready", exact: true })
    .waitFor({ timeout: 90000 });
  await page.getByRole("button", { name: "Voices", exact: true }).click();
  const sample = await page.evaluate(async () =>
    Array.from(
      await window.ace.audio({
        text: "The court is open for business. The witness is ready to give a full account of the events of yesterday.",
        speed: 1,
        voiceId: "af_heart",
      }),
    ),
  );
  await page.getByLabel("Voice name", { exact: true }).fill("Test witness");
  await page.getByLabel("Reference recording", { exact: true }).setInputFiles({
    name: "sample.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(sample),
  });
  await page.getByRole("button", { name: "Import voice", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview imported voice" })
    .waitFor({ timeout: 120000 });
  const id = (await page.evaluate(() => window.ace.voices())).find((v) =>
    v.startsWith("ref_test-witness_"),
  );
  assert.ok(id);
  await page.getByRole("button", { name: "Preview imported voice" }).click();
  await page
    .locator(".monitor output")
    .filter({ hasText: "Speaking" })
    .waitFor({ state: "attached", timeout: 60000 });
  const picker = page.getByRole("combobox", {
    name: "Assigned voice",
    exact: true,
  });
  await picker.fill("does not match any voice");
  await page.getByText("No matching voices").waitFor();
  await picker.press("Escape");
  await picker.fill("test wit");
  await page
    .getByRole("option", { name: "Test witness", exact: true })
    .waitFor();
  await picker.press("Enter");
  assert.equal(await picker.inputValue(), "Test witness");
  await page.getByRole("button", { name: "Save voice", exact: true }).click();
  await page.getByText("Custom voice").waitFor();
  // Keep a timed recording from Chromium's synthetic input, never the user's microphone.
  await page.getByRole("button", { name: "Record microphone" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await new Promise((r) => setTimeout(r, 3500));
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByText("Recording ready to import.").waitFor();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Written word or phrase").fill("Fey");
  await page.getByLabel("Speak it as").fill("Fay");
  await page.getByRole("button", { name: "Save pronunciation" }).click();
  await page.getByText("Fey → Fay").waitFor();
  const out = path.join(dir, "cast.json");

  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, out);
  await page.getByRole("button", { name: "Export cast" }).click();
  await page.getByText("Cast preset exported.").waitFor();
  const preset = JSON.parse(await readFile(out, "utf8"));
  assert.equal(preset.cast[0].voiceId, id);
  await page.evaluate((key) => window.ace.reset(key), preset.cast[0].key);
  await page.getByLabel("Import cast preset").setInputFiles(out);
  await page.getByText("Cast preset imported.").waitFor();
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  await page
    .getByRole("button", { name: "Engine settings, ready", exact: true })
    .waitFor({ timeout: 90000 });
  const c = await page.evaluate(() => window.ace.settings());
  assert.equal(c.cast[0].voiceId, id);
  assert.equal(c.pronunciations[0].spoken, "Fay");
  const output = await page.evaluate(
    async (voiceId) =>
      Array.from(
        await window.ace.audio({
          text: "A different new sentence after restart.",
          speed: 1,
          voiceId,
        }),
      ),
    id,
  );
  assert.equal(Buffer.from(output).toString("ascii", 0, 4), "RIFF");
  assert.ok(output.length > 24000);
  console.log(
    "Passed file import, generated speech, character assignment, synthetic microphone recording, dictionary, preset export/import and restart.",
  );
} finally {
  if (app) await app.close();
  await rm(dir, {
    force: true,
    recursive: true,
    maxRetries: 5,
    retryDelay: 250,
  });
}

