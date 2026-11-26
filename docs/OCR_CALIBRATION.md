# Capture calibration

Choose window capture first. Restore a minimized game, try borderless mode, or select its display if capture fails. Display capture includes whatever is visible on that monitor.

Automatic detection is the default. Select the game window and start listening. If a particular layout needs adjustment, choose **Dialogue detection → Manual calibration**. Drag a tight dialogue rectangle containing all text rows with a small margin. Exclude the nameplate, buttons and advance arrow. Drag the separate nameplate rectangle around the name text. Test recognition on at least two lines. Save the profile. Coordinates are normalized against captured pixels, keyed by source type, title and frame resolution. Changing resolution keeps listening active and uses the matching saved regions or the current normalized regions.

Start with 3 frames per second and 450 ms stabilization. Increase stability if the game types slowly. OCR cannot distinguish an unusually long mid-sentence pause from completion solely from identical frames. Lower contrast if thin lettering disappears. Names are scored separately from dialogue. The reader also checks for a blue nameplate around the selected name rectangle. Unnamed story lines share a mystery voice until the exchange changes. Green date/time/location cards and episode prompts use the narrator. Black frames keep listening active. Menu filtering is heuristic. Pause on non-dialogue screens if needed.

Windows gameplay acceptance remains necessary for the English Steam trilogy, especially menus, effects, multi-monitor DPI changes, typewriter timing, nameless dialogue, repeated text, rapid advancement and audio balance with the game.



