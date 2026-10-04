# Translation brief

This site is a memorial exhibition of water-light photographs by the late Yumok (流木) Lee Dong-joo (이동주, 李東周, 1952-2024), a Korean professor of hydraulic engineering who photographed the surface of water in his last years. His son built it after his death. The tone is quiet, warm and plain: a museum wall text, not marketing.

## Your task

Read `i18n/en.json` (English) and `i18n/ko.json` (Korean, the original; use it to check nuance for the `ui`, `motion`, `gate` and `titles` sections).
Write `i18n/<code>.json` in your target language with exactly the same structure as `i18n/en.json`.

## Rules

1. Same keys, same nesting, same array lengths and order. `titles` must have exactly 282 entries. `ui.timeline` stays a list of [year, text] pairs; `ui.finale` a list of 4 lines; `gate.d3` and `gate.d2` lists of 4.
2. In `places` and `site` the KEYS stay exactly as in en.json (English). Translate only the VALUES.
3. Keep placeholders exactly: `{n}`, `{f}`, `{v}`. Keep HTML tags and attributes exactly (`<strong>`, `<a href="...">`, `<sub>`, `<br>`); translate only the text between them. Keep URLs, file names, numbers, years, camera and lens names, "CC BY 4.0", "MIT License", "W A S D", "Esc", "F", "3D", "2D", "EFDC", "PDF", "GitHub".
4. Language codes shown as labels (`KO`, `EN`, `JA`, `DE`) stay as they are.
5. The name: keep 流木 as written. Render "Yumok" and "Lee Dong-joo" the way Korean names are normally written in your language (for example Chinese 李东周, Russian Ли Дон Джу, Arabic transliteration). Where the source has 李東周 keep it.
6. Korean place names (Gunsan, Gimje, Simpo Port, Eunpa Lake...): transliterate into your script in the usual way, translating the generic part (Port, Lake, Temple, Reservoir).
7. Titles are short descriptions of what is visible in an abstract photograph of water. Keep them short (2 to 6 words), concrete and unadorned. Do not add poetry that is not in the source. The three titles "Water-Light Memories", "Water-Light Feast", "Water-Light Festival" were given by the photographer: translate them faithfully.
8. `ui.finale` is the son's dedication to his father. Translate it simply and sincerely, first person.
9. Natural, idiomatic language as a native museum editor would write. Formal/polite register. No machine-translation stiffness. Do not leave English words where your language has a natural one.
10. Output must be valid UTF-8 JSON, indent 1, no trailing commas. Do not write anything else to the repository and do not modify any other file.

## Before you finish

Run this check and fix anything it reports:

```
python tools/i18n_check.py <code>
```

Report in one or two sentences: done or not, and anything you were unsure about.
