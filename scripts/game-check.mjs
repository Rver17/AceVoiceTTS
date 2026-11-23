// Opt-in live test. Capture only the running Trilogy window. Never send it input.
import { _electron as electron } from "playwright-core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const profile = await mkdtemp(path.join(tmpdir(), "acevoice-game-check-"));
let app;
try {
  const env = { ...process.env, ACEVOICE_PORT: "18768" };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: env.ACEVOICE_SMOKE_EXE,
    args: [
      ...(env.ACEVOICE_SMOKE_EXE ? [] : ["."]),
      "--user-data-dir=" + profile,
    ],
    env,
  });
  const page = await app.firstWindow();
  await page.getByRole("button", { name: "Refresh sources" }).click();
  const window = page
    .locator("option")
    .filter({ hasText: /^Phoenix Wright: Ace Attorney Trilogy/i })
    .first();
  await page
    .getByLabel("Window or display")
    .selectOption(await window.getAttribute("value", { timeout: 8000 }));
  await page
    .getByRole("button", { name: "Select game window", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start listening" })
    .click({ timeout: 60000 });
  await page
    .locator(".monitor output")
    .filter({ hasText: "Speaking" })
    .waitFor({ timeout: 25000 });
  console.log(
    "Live Trilogy game window → OCR → speech:",
    await page.locator(".monitor strong").innerText(),
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
} finally {
  if (app) await app.close();
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 4,
    retryDelay: 250,
  });
}
