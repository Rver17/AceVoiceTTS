function label(id: string) {
  return id
    .split("_mix_")
    .map((v) => {
      const name = v.split("_")[1];
      return name.charAt(0).toUpperCase() + name.slice(1);
    })
    .join(" + ");
}
export function VoiceOptions({ voices }: { voices: string[] }) {
  return (
    <>
      {[false, true].flatMap((blend) =>
        ["a", "b"].map((code) => {
          const group = voices.filter(
            (v) => v.startsWith(code) && v.includes("_mix_") === blend,
          );
          return group.length ? (
            <optgroup
              key={code + blend}
              label={
                (code === "a" ? "US" : "UK") +
                " English · " +
                (blend ? "blends" : "stock")
              }
            >
              {group.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </optgroup>
          ) : null;
        }),
      )}
    </>
  );
}
