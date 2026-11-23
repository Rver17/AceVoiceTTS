import test from "node:test";
import assert from "node:assert/strict";
import { pronounce } from "../core/dictionary";
import { config, defaults } from "../core/contracts";
import { allocate } from "../core/dialogue";
import { mergeCast, exportCast } from "../core/presets";
test("old settings gain an empty pronunciation dictionary and substitutions are bounded and single pass", () => {
  const { pronunciations, ...legacy } = defaults;
  assert.deepEqual(config.parse(legacy).pronunciations, []);
  assert.equal(
    pronounce("FEY, Feywild and Mia Fey.", [
      { word: "Fey", spoken: "Fay" },
      { word: "Mia Fey", spoken: "Mee-ah Fay" },
      { word: "Fay", spoken: "wrong" },
    ]),
    "Fay, Feywild and Mee-ah Fay.",
  );
});
test("presets merge personal voice assignments only when the reference is installed", () => {
  const id = "ref_sample_0123456789abcdef01234567",
    list = ["af_heart", id];
  const custom = {
    ...allocate("Maya", [], list),
    voiceId: id,
    source: "user" as const,
  };
  const input = exportCast({ ...defaults, cast: [custom] });
  assert.throws(
    () => mergeCast(defaults, input, ["af_heart"]),
    /Missing voice/,
  );
  const restored = mergeCast(defaults, input, list);
  assert.equal(allocate("Maya", restored.cast, list).voiceId, id);
  assert.equal(allocate("Witness", restored.cast, list).voiceId, "af_heart");
});
