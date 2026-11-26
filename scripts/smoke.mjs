// Real Windows desktop test. Only the purpose-built fixture window is selected.
import { _electron as electron } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = await mkdtemp(path.join(tmpdir(), "acevoice-smoke-"));
const env = { ...process.env, ACEVOICE_PORT: "18766" };
delete env.ELECTRON_RUN_AS_NODE;
const portable = process.env.ACEVOICE_SMOKE_EXE;
const launch = () =>
  electron.launch({
    executablePath: portable,
    args: [...(portable ? [] : ["."]), "--user-data-dir=" + dir],
    env,
  });
let app, page;
try {
  const launchedAt = performance.now();
  app = await launch();
  page = await app.firstWindow();
  page.on("pageerror", (e) => console.error(e));
  await page
    .getByRole("button", { name: "Test Dialogue", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Test Dialogue",
      )?.disabled,
    null,
    { timeout: 120000 },
  );
  console.log(
    "Launch to ready (ms):",
    Math.round(performance.now() - launchedAt),
  );
  const previewAt = performance.now();
  await page
    .getByRole("button", { name: "Test Dialogue", exact: true })
    .click();
  await page.getByText("Speaking · 0 queued").waitFor();
  console.log(
    "Uncached Phoenix preview to playback (ms):",
    Math.round(performance.now() - previewAt),
  );
  await page.getByText("Idle · 0 queued").waitFor();
  const saved = await page.evaluate(() => window.ace.settings());
  assert.equal(saved.cast[0].voiceId, "am_michael");
  await page.getByRole("button", { name: "Mute speech", exact: true }).click();
  await page.getByRole("button", { name: "Replay line", exact: true }).click();
  await page.getByText("Speaking · 0 queued").waitFor();
  await page
    .getByRole("button", { name: "Unmute speech", exact: true })
    .click();
  await page.getByText("Idle · 0 queued").waitFor();
  const bytes = await page.evaluate(() => window.ace.cache());
  assert.ok(bytes > 1000);
  console.log("Electron Test Dialogue played. Cached bytes:", bytes);
  await page.getByRole("button", { name: "Voices", exact: true }).click();
  await page.getByRole("button", { name: "Pearl Fey", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview voice", exact: true })
    .click();
  await page
    .locator(".monitor output")
    .filter({ hasText: "Speaking" })
    .waitFor({ state: "attached" });
  await page
    .locator(".monitor output")
    .filter({ hasText: "Idle" })
    .waitFor({ state: "attached" });
  await page.getByRole("button", { name: "Save voice", exact: true }).click();
  await page.getByText("Custom voice").waitFor();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  console.log("Pearl's two-voice blend played and her override was saved.");
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({
      width: 800,
      height: 480,
      frame: false,
      useContentSize: true,
      autoHideMenuBar: true,
      show: true,
      webPreferences: { sandbox: true, nodeIntegration: false },
    });
    const html =
      "<title>AceVoice fixture court</title><style>*{margin:0}body{background:#161e29;color:white;font:26px Arial}h3,p{position:absolute;left:12%}h3{top:66%;font-size:23px;line-height:26px}p{top:75%}</style><h3>Maya</h3><p>The witness found a blue ticket.</p>";
    await w.loadURL("data:text/html," + encodeURIComponent(html));
  });
  const invalid = await page.evaluate(async () => {
    try {
      await window.ace.select("window:0:0");
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(invalid, true);
  await page.bringToFront();
  await page.getByRole("button", { name: "Refresh sources" }).click();
  const option = page
    .locator("option")
    .filter({ hasText: "AceVoice fixture court" });
  const id = await option.getAttribute("value", { timeout: 15000 });
  await page.getByLabel("Window or display").selectOption(id);
  await page.getByRole("button", { name: "Select game window" }).click();
  await page.getByLabel("Dialogue detection").selectOption("manual");
  await page
    .getByRole("button", { name: "Save profile" })
    .click({ timeout: 15000 });
  await page.getByLabel("Dialogue detection").selectOption("automatic");
  const captureAt = performance.now();
  await page.getByRole("button", { name: "Start listening" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("blockquote")
        ?.textContent?.includes("blue ticket"),
    null,
    { timeout: 60000 },
  );
  await page.getByText("Speaking · 0 queued").waitFor();
  console.log(
    "Start listening to first fixture playback (ms):",
    Math.round(performance.now() - captureAt),
  );
  await page.getByText("Idle · 0 queued").waitFor();
  await page.getByText(/Recent dialogue/).click();
  await page
    .getByRole("button", { name: "Replay The witness is ready.", exact: true })
    .waitFor();
  await app.evaluate(async ({ BrowserWindow }) => {
    const fixture = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "AceVoice fixture court",
    );
    await fixture.webContents.executeJavaScript(
      "document.querySelector('p').textContent='I found another blue ticket.'",
    );
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector("blockquote")
        ?.textContent?.includes("another blue ticket"),
    null,
    { timeout: 30000 },
  );
  await page.getByText("Speaking · 0 queued").waitFor();
  await page.getByText("Idle · 0 queued").waitFor();
  console.log(
    "Second displayed dialogue line played without a new Listen action.",
  );
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "AceVoice fixture court",
    );
    await w.webContents.executeJavaScript(
      `document.querySelector('p').textContent='Play "The First Turnabout"?';document.querySelector('h3').textContent=''`,
    );
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector("blockquote")
        ?.textContent?.includes("First Turnabout"),
    null,
    { timeout: 30000 },
  );
  await page.getByText("Narrator · bf_isabella", { exact: true }).waitFor();
  await page.getByText("Speaking · 0 queued").waitFor();
  await page.getByText("Idle · 0 queued").waitFor();
  console.log("Nameless episode confirmation played with Isabella.");
  let data = await page.evaluate(() => window.ace.settings());
  assert.ok(
    data.cast.some((p) => p.key === "maya fey" && p.voiceId === "af_heart"),
  );
  // Keep the native capture running throughout a fade and a resolution change.
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "AceVoice fixture court",
    );
    await w.webContents.executeJavaScript(
      "document.body.style.background='black';document.body.style.color='black'",
    );
    w.setContentSize(840, 500);
  });
  await page
    .getByText("Waiting for dialogue · listening continues", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Start listening" }).isDisabled(),
    true,
  );
  await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "AceVoice fixture court",
    );
    await w.webContents.executeJavaScript(
      "document.body.style.color='white';document.querySelector('h3').style.cssText='top:66%;left:12%;width:100px;background:#244a88;color:white;text-align:center;font:16px Georgia';document.querySelector('h3').textContent='Edgeworth';document.querySelector('p').textContent='We can resume the hearing.'",
    );
  });
  await page
    .getByText("Edgeworth · am_onyx", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByText("Speaking · 0 queued").waitFor();
  await page.getByText("Idle · 0 queued").waitFor();
  console.log(
    "Black transition and resize recovered automatically. Edgeworth spoke with his own voice.",
  );
  async function showLine(text) {
    await app.evaluate(async ({ BrowserWindow }, s) => {
      const w = BrowserWindow.getAllWindows().find(
        (w) => w.getTitle() === "AceVoice fixture court",
      );
      await w.webContents.executeJavaScript(
        "document.querySelector('h3').style.display='none';document.querySelector('p').textContent=" +
          JSON.stringify(s),
      );
    }, text);
    await page.waitForFunction(
      (s) => document.querySelector("blockquote")?.textContent === s,
      text,
      { timeout: 30000 },
    );
  }
  await showLine("Nobody saw me enter.");
  const mysteryVoice = await page.locator(".monitor strong").innerText();
  assert.match(mysteryVoice, /Mystery speaker/);
  await showLine("Someone should leave this place.");
  assert.equal(await page.locator(".monitor strong").innerText(), mysteryVoice);
  let image = process.env.ACEVOICE_CARD_IMAGE
    ? (await readFile(process.env.ACEVOICE_CARD_IMAGE)).toString("base64")
    : "";
  await app.evaluate(async ({ BrowserWindow }, png) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.getTitle() === "AceVoice fixture court",
    );
    await w.webContents.executeJavaScript(
      png
        ? "document.body.innerHTML='';document.body.style.cssText=" +
            JSON.stringify(
              "height:100vh;background:black url(data:image/png;base64," +
                png +
                ") center/100% 100% no-repeat",
            )
        : "document.body.innerHTML='<div style=\"position:absolute;top:60%;width:100%;text-align:center;color:lime;font:28px Georgia\">August 3, 9:47 AM<br>District Court<br>Defendant Lobby No. 2</div>'",
    );
  }, image);
  await page.waitForFunction(
    () =>
      /August 3,?\s+9:47\s*AM\s+District Court\s+Defendant/i.test(
        document.querySelector("blockquote")?.textContent ?? "",
      ) &&
      /Lobby No\.? 2/i.test(
        document.querySelector("blockquote")?.textContent ?? "",
      ),
    null,
    { timeout: 30000 },
  );
  await page.getByText("Narrator · bf_isabella", { exact: true }).waitFor();
  await page.getByText("Speaking · 0 queued").waitFor();
  console.log(
    "Unnamed dialogue kept one mystery voice. The complete date/time/location card played through the narrator.",
  );
  if (process.env.ACEVOICE_PHOENIX_IMAGE) {
    const png = (await readFile(process.env.ACEVOICE_PHOENIX_IMAGE)).toString(
      "base64",
    );
    await app.evaluate(async ({ BrowserWindow }, image) => {
      const fixture = BrowserWindow.getAllWindows().find(
        (w) => w.getTitle() === "AceVoice fixture court",
      );
      fixture.setContentSize(1280, 732);
      await fixture.webContents.executeJavaScript(
        "document.body.style.backgroundImage=" +
          JSON.stringify("url(data:image/png;base64," + image + ")"),
      );
    }, png);
    await page
      .getByText("(Boy am I nervous!)", { exact: true })
      .first()
      .waitFor({ timeout: 30000 });
    await page.getByText("Phoenix · am_michael", { exact: true }).waitFor();
    await page.getByText("Speaking · 0 queued").waitFor();
    console.log(
      "Captured Phoenix frame read and played with his assigned voice.",
    );
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByText("Paused", { exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .find((w) => w.getTitle() === "AceVoice fixture court")
      .close(),
  );
  await page
    .getByText("Capture lost", { exact: true })
    .waitFor({ timeout: 12000 });
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  data = await page.evaluate(() => window.ace.settings());
  console.log(
    "Windows native fixture capture → English OCR → Maya → Kokoro → Web Audio passed.",
  );
  await app.close();

  app = await launch();
  const reopened = await app.firstWindow();
  const restored = await reopened.evaluate(() => window.ace.settings());
  assert.deepEqual(restored, data);
  console.log("Voice mappings and resolution profile survived relaunch.");
} catch (e) {
  console.error(
    await page
      ?.locator("small")
      .allTextContents()
      .catch(() => []),
  );
  throw e;
} finally {
  if (app) await app.close();
  await rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 250,
  });
}
