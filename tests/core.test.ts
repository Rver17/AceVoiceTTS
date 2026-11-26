import { MysteryCasting, isNarration } from "../core/scene";
import { readNameplate } from "../core/nameplate";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allocate, resolve, Stabilizer } from "../core/dialogue";
import { config, defaults, speech } from "../core/contracts";
import { PlaybackQueue } from "../core/queue";
import {
  AudioCache,
  cacheKey,
  readConfig,
  writeConfig,
} from "../electron/store";
test("aliases, provisional names, collision avoidance and exhausted pool", () => {
  for (const name of [" Phoenix ", "pHoEnIx   Wright"])
    assert.equal(resolve(name, [])?.display, "Phoenix Wright");
  for (const name of [null, "???", "Unknown", "A7@"])
    assert.equal(resolve(name, []), null);
  const pool = ["am_test", "af_test"];
  const a = allocate("First Witness", [], pool),
    b = allocate("Second Witness", [a], pool);
  assert.notEqual(a.voiceId, b.voiceId);
  assert.ok(pool.includes(allocate("Third Witness", [a, b], pool).voiceId));
  const user = {
    ...a,
    voiceId: b.voiceId,
    source: "user" as const,
    aliases: ["Witness one"],
  };
  const dir = mkdtempSync(join(tmpdir(), "ace-config-"));
  try {
    writeConfig(dir, { ...defaults, cast: [user] });
    assert.deepEqual(allocate("Witness one", readConfig(dir).cast, pool), user);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("typewriter, brief pauses, duplicates, low confidence, blank reset, speaker change and skips", () => {
  const s = new Stabilizer();
  const read = (t: string, n: number, who = "Maya", c = 0.9) =>
    s.observe(t, who, c, n, 450, 0.75)?.text;
  assert.equal(read("The", 0), undefined);
  assert.equal(read("The", 275), undefined);
  assert.equal(read("The end.", 300), undefined);
  assert.equal(read("The end.", 760), "The end.");
  assert.equal(read("The end.", 1300), undefined);
  read("The ond.", 1400, "Maya", 0.5);
  assert.equal(read("The end.", 1500), undefined);
  assert.equal(read("The end.", 2050), undefined);
  read("", 2200);
  read("", 2300);
  read("The end.", 2400);
  assert.equal(read("The end.", 2900), "The end.");
  read("The end.", 3000, "Judge");
  assert.equal(read("The end.", 3500, "Judge"), "The end.");
  read("First skip", 3600);
  read("Second skip", 3700);
  assert.equal(read("Second skip", 4200), "Second skip");
});
test("cache is bounded to safe hashed filenames and uses all synthesis inputs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ace-cache-"));
  const cache = new AudioCache(dir);
  const s = speech.parse({
    text: "../   sample",
    voiceId: "af_heart",
    speed: 1,
  });
  try {
    let calls = 0;
    const make = async () => {
      calls++;
      return Buffer.from("fixture");
    };
    await cache.audio(s, make);
    await cache.audio(s, make);
    assert.equal(calls, 1);
    assert.match(cacheKey(s), /^[a-f0-9]{64}$/);
    assert.equal(
      new Set([
        cacheKey(s),
        cacheKey({ ...s, speed: 2 }),
        cacheKey({ ...s, voiceId: "am_adam" }),
        cacheKey(s, "next"),
      ]).size,
      4,
    );
    await cache.clear();
    assert.equal((await cache.entries()).length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("queue serializes FIFO, replaces pending work and invalidates stopped work", async () => {
  const started: number[] = [],
    heard: number[] = [];
  let release = () => {};
  const queue = new PlaybackQueue<number>(
    async (i, current) => {
      started.push(i);
      await new Promise<void>((r) => (release = r));
      if (current()) heard.push(i);
    },
    () => {},
    (e) => assert.fail(String(e)),
    () => {},
  );
  const tick = () => new Promise((r) => setTimeout(r, 1));
  queue.add(1, false);
  queue.add(2, false);
  queue.add(3, true);
  assert.deepEqual(started, [1]);
  release();
  await tick();
  assert.deepEqual(started, [1, 3]);
  queue.add(4, false);
  release();
  await tick();
  assert.deepEqual(heard, [3]);
  queue.stop();
  release();
  await tick();
  assert.deepEqual(heard, [3]);
});
test("out-of-frame regions rejected", () =>
  assert.equal(
    config.safeParse({
      ...defaults,
      calibration: { x: { dialogueBox: { x: 0.9, y: 0, w: 0.2, h: 1 } } },
    }).success,
    false,
  ));

test("the English pack covers 246 different assignments before reuse", () => {
  const american = [
    "af_alloy",
    "af_aoede",
    "af_bella",
    "af_heart",
    "af_jessica",
    "af_kore",
    "af_nicole",
    "af_nova",
    "af_river",
    "af_sarah",
    "af_sky",
    "am_adam",
    "am_echo",
    "am_eric",
    "am_fenrir",
    "am_liam",
    "am_michael",
    "am_onyx",
    "am_puck",
    "am_santa",
  ];
  const british = [
    "bf_alice",
    "bf_emma",
    "bf_isabella",
    "bf_lily",
    "bm_daniel",
    "bm_fable",
    "bm_george",
    "bm_lewis",
  ];
  const voices = [
    ...american,
    ...british,
    ...[american, british].flatMap((group) =>
      group.flatMap((a, i) => group.slice(i + 1).map((b) => a + "_mix_" + b)),
    ),
  ];
  const cast: ReturnType<typeof allocate>[] = [];
  for (let i = 0; i < voices.length; i++) {
    const name =
      "Witness " + String.fromCharCode(65 + Math.floor(i / 26), 65 + (i % 26));
    cast.push(allocate(name, cast, voices));
  }
  assert.equal(new Set(cast.map((p) => p.voiceId)).size, 246);
  assert.ok(voices.includes(allocate("Late Arrival", cast, voices).voiceId));
});
test("episode confirmation and missing nameplates use the editable narrator", () => {
  const pool = ["am_adam", "af_sarah", "bf_isabella"];
  const narrator = allocate(null, [], pool);
  assert.equal(narrator.voiceId, "bf_isabella");
  assert.equal(narrator.speed, 0.94);
  const changed = { ...narrator, voiceId: "af_sarah", speed: 0.98 };
  assert.deepEqual(allocate("???", [changed], pool), changed);
  const stabilize = new Stabilizer();
  const prompt = 'Play "The First Turnabout"?';
  stabilize.observe(prompt, "Maya", 0.97, 0, 400, 0.75);
  const event = stabilize.observe(prompt, "Yes", 0.97, 500, 400, 0.75);
  assert.equal(event?.speakerRaw, null);
  assert.equal(allocate("Judge", [changed], pool).voiceId, "am_adam");
});
test("steady moderate-confidence dialogue plays once with a recognized low-confidence name", () => {
  const speaker = readNameplate(
    [
      { text: "[ Maya ]", confidence: 0.43 },
      { text: "blue", confidence: 0.68 },
    ],
    [],
  );
  assert.equal(speaker?.name, "Maya");
  assert.equal(
    readNameplate(
      [
        { text: "???", confidence: 0.92 },
        { text: "XX", confidence: 0.45 },
      ],
      [],
    ),
    null,
  );
  const s = new Stabilizer();
  const read = (at: number, c: number) =>
    s.observe("The hearing can begin.", speaker!.name, c, at, 450, 0.75);
  assert.equal(read(0, 0.42), null);
  assert.equal(read(500, 0.61), null);
  assert.equal(read(1000, 0.48)?.speakerKey, "maya fey");
  assert.equal(read(1500, 0.67), null);
  s.reset();
  assert.equal(read(2000, 0.32), null);
  assert.equal(read(4000, 0.32), null);
});
test("mystery casting persists within an exchange and changes after a transition", () => {
  const s = new Stabilizer(),
    pool = [
      "am_adam",
      "af_sarah",
      "bf_isabella",
      "ref_custom_0123456789abcdef01234567",
    ];
  s.observe("Nobody saw me.", null, 0.9, 0, 400, 0.75);
  const line = s.observe("Nobody saw me.", null, 0.9, 500, 400, 0.75)!;
  const narrator = allocate(null, [], pool),
    m = new MysteryCasting();
  const first = m.pick(line, pool, [], narrator);
  assert.ok(["am_adam", "af_sarah"].includes(first.voiceId));
  assert.equal(
    m.pick({ ...line, text: "I can leave." }, pool, [], narrator).voiceId,
    first.voiceId,
  );
  assert.notEqual(
    m.pick({ ...line, sceneKey: "next" }, pool, [], narrator).voiceId,
    first.voiceId,
  );
  assert.ok(
    isNarration({
      ...line,
      text: "August 3, 9:47 AM District Court Defendant Lobby No. 2",
    }),
  );
  assert.ok(
    isNarration({ ...line, kind: "scene-card", text: "District Court" }),
  );
  assert.ok(!isNarration(line));
});
