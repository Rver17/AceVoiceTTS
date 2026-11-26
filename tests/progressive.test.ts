import test from "node:test";
import assert from "node:assert/strict";
import { Stabilizer } from "../core/dialogue";

const frames = (s: Stabilizer, texts: string[], step = 300, start = 0) => {
  const out: { text: string; continuation?: boolean }[] = [];
  texts.forEach((t, i) => {
    const d = s.observe(t, "Phoenix Wright", 0.9, start + i * step, 450, 0.75, undefined, true);
    if (d) out.push({ text: d.text, continuation: d.continuation });
  });
  return out;
};

test("typewriter text is spoken sentence by sentence without repeats", () => {
  const s = new Stabilizer();
  const typed = [
    "Hold i",
    "Hold it! The wit",
    "Hold it! The witness is lyi",
    "Hold it! The witness is lying to you.",
    "Hold it! The witness is lying to you. Check the re",
    "Hold it! The witness is lying to you. Check the record.",
    "Hold it! The witness is lying to you. Check the record.",
    "Hold it! The witness is lying to you. Check the record.",
    "Hold it! The witness is lying to you. Check the record.",
    "Hold it! The witness is lying to you. Check the record.",
  ];
  const out = frames(s, typed);
  assert.deepEqual(
    out.map((o) => o.text),
    ["Hold it!", "The witness is lying to you.", "Check the record."],
  );
  assert.deepEqual(out.map((o) => o.continuation), [undefined, true, true]);
  assert.equal(frames(s, ["Hold it! The witness is lying to you. Check the record."], 300, 5000).length, 0);
});

test("abbreviations do not split and plain lines still speak once", () => {
  const s = new Stabilizer();
  const line = "Mr. Wright is here today";
  const out = frames(s, [line, line, line, line, line]);
  assert.deepEqual(out.map((o) => o.text), [line]);
});
