export interface Casting {
  display: string;
  voice: string;
  speed: number;
  direction: string;
  aliases: string[];
}
function cast(
  display: string,
  voice: string,
  speed: number,
  direction: string,
  ...aliases: string[]
): Casting {
  return { display, voice, speed, direction, aliases };
}
export const casting = [
  cast(
    "Phoenix Wright",
    "am_michael",
    1,
    "Clear and conversational",
    "Phoenix",
    "Wright",
  ),
  cast("Maya Fey", "af_heart", 1.04, "Bright, lively delivery", "Maya"),
  cast(
    "Miles Edgeworth",
    "am_onyx",
    0.96,
    "Measured and deliberate",
    "Edgeworth",
    "Miles",
  ),
  cast("The Judge", "am_adam", 0.9, "Unhurried older courtroom voice", "Judge"),
  cast("Mia Fey", "af_bella", 0.97, "Calm and assured", "Mia"),
  cast(
    "Pearl Fey",
    "af_nova_mix_af_sky",
    1.08,
    "Youthful, light delivery",
    "Pearl",
    "Pearls",
  ),
  cast("Dick Gumshoe", "am_eric", 0.98, "Easygoing detective", "Gumshoe"),
  cast(
    "Franziska von Karma",
    "bf_emma",
    1.03,
    "Brisk and precise",
    "Franziska",
  ),
  cast(
    "Manfred von Karma",
    "bm_george",
    0.88,
    "Older, deliberate prosecutor",
    "Manfred",
  ),
  cast("Godot", "am_fenrir", 0.93, "Low and measured"),
  cast(
    "Larry Butz",
    "am_liam",
    1.07,
    "Fast, animated delivery",
    "Larry",
    "Butz",
  ),
  cast("Winston Payne", "bm_daniel", 1, "Formal courtroom delivery", "Payne"),
  cast(
    "Wendy Oldbag",
    "bf_alice_mix_bf_lily",
    1.03,
    "Older, energetic witness",
    "Oldbag",
  ),
  cast(
    "Marvin Grossberg",
    "bm_fable",
    0.89,
    "Older, thoughtful attorney",
    "Grossberg",
  ),
  cast(
    "Cody Hackins",
    "am_echo_mix_am_puck",
    1.09,
    "Quick, youthful witness",
    "Cody",
  ),
  cast("Lotta Hart", "af_sarah", 1.06, "Energetic witness", "Lotta"),
  cast("Ema Skye", "af_nova", 1.04, "Curious, upbeat delivery", "Ema"),
  cast("Lana Skye", "af_sarah_mix_af_sky", 0.96, "Steady and composed", "Lana"),
  cast("Dahlia Hawthorne", "af_jessica", 0.97, "Soft and deliberate", "Dahlia"),
  cast("Iris", "af_kore", 0.96, "Quiet and reflective"),
  cast(
    "Morgan Fey",
    "bf_alice_mix_bf_isabella",
    0.93,
    "Formal and deliberate",
    "Morgan",
  ),
];
