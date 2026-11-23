# Optional direct dialogue source

The OCR companion works independently. A future user-installed bridge can emit versioned Dialogue events over a current-user named pipe. Keep capture source selection explicit. Restore OCR if the bridge disconnects and discard stale speech.

Inspected AccessMods/PhoenixWrightTrilogy revision eb40f479de0de685b2751b1b49a1adfcc5409467. In DialoguePatches.cs, Arrow_Postfix and guide hooks handle dialogue readiness, NamePlate_Postfix tracks the speaker and TryOutputDialogue coordinates output. Board and clear callbacks provide candidates for display-instance boundaries. These are investigation points for observing completed lines in a compatible game build. The current companion consumes no mod transport. [Inspected source](https://github.com/AccessMods/PhoenixWrightTrilogy/blob/eb40f479de0de685b2751b1b49a1adfcc5409467/AccessibilityMod/Patches/DialoguePatches.cs)

Before implementation, verify Steam version, x86 bitness, MelonLoader compatibility and callback timing in the installed game. Keep the screen reader's existing speech user-controlled. Document opt-in installation and rollback by removing only the new bridge and switching back to OCR. Preserve upstream license notices for any reused code.

