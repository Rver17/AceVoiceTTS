export async function prepareAudio(file: Blob): Promise<Uint8Array> {
  if (file.size > 25 * 1024 * 1024) throw Error("Choose a clip under 25 MB.");
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration < 3 || decoded.duration > 30.05)
      throw Error("Choose 3–30 seconds of clear speech.");
    const rate = 24000,
      length = Math.min(30 * rate, Math.round(decoded.duration * rate));
    const offline = new OfflineAudioContext(1, length, rate),
      source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const wav = new Uint8Array(44 + length * 2),
      view = new DataView(wav.buffer);
    function tag(offset: number, s: string) {
      wav.set(new TextEncoder().encode(s), offset);
    }
    tag(0, "RIFF");
    view.setUint32(4, wav.length - 8, true);
    tag(8, "WAVE");
    tag(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    tag(36, "data");
    view.setUint32(40, length * 2, true);
    samples.forEach((s, i) =>
      view.setInt16(
        44 + i * 2,
        Math.round(Math.min(1, Math.max(-1, s)) * 32767),
        true,
      ),
    );
    return wav;
  } finally {
    await decoder.close();
  }
}
