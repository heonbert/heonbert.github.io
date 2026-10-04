# Translation brief

This site is a memorial exhibition of water-light photographs by the late Yumok (流木) Lee Dong-joo (이동주, 李東周, 1952-2024), a Korean professor of hydraulic engineering who photographed the surface of water in his last years. His son built it after his death. The tone is quiet, warm and plain: a museum wall text, not marketing.

## How the texts are kept

- `i18n/ko.json` is the Korean original and `i18n/en.json` its English version. Every other language is a file with the same structure: `i18n/<code>.json`.
- Sections: `ui` (the 3D exhibition), `labels` (buttons and small notices of the 2D pages), `motion` and `gate` (front page), `titles` (one per photograph, in catalogue order), `places` (keyed by the English name), `site` (every sentence of the 2D pages, keyed by the English sentence).
- When something new is added, `python tools/i18n_delta.py export` writes `i18n/delta/<code>.json` with only the strings a language still lacks.

## Your task

1. Read `i18n/delta/<code>.json`. It has up to five sections: `ui`, `labels`, `titles`, `places`, `site`. Each entry gives the English text (`en`), usually the Korean original (`ko`), and sometimes a `hint`.
2. Read your language's existing file `i18n/<code>.json` first, so that names, the site title, album names and recurring terms are rendered exactly as they already are there.
3. Write `i18n/delta/<code>.out.json`: the same sections and the same keys, with your translation as the value (a plain string). Example:

```json
{
 "ui": { "halls.awards": "…", "prize.283": "…" },
 "labels": { "close": "…" },
 "titles": { "283": "…" },
 "site": { "Privacy": "…" }
}
```

4. Run `python tools/i18n_delta.py check <code>` and fix everything it reports.
5. Do not edit `i18n/<code>.json` or any other file. Report in one or two sentences: done or not, and anything you were unsure about.

## Rules

1. Translate from the English, and use the Korean to check nuance. Where they differ in detail, follow the Korean.
2. Keys stay exactly as given. In `site` the key is the English sentence itself: copy it character for character.
3. Keep placeholders exactly: `{n}`, `{d}`, `{f}`, `{v}`, `{title}`, `{year}`. Keep HTML tags and their attributes exactly (`<strong>`, `<a href="...">`, `<cite>`, `<sub>`); translate only the text between them. `<x1/>` stands for an icon: keep it, at the place where the icon should sit in your sentence.
4. Keep line breaks (`\n`) where the English has them. Keep URLs, file names, numbers, years, camera and lens names, "CC BY 4.0", "MIT License", "Ctrl+D", "⌘+D", "W A S D", "Esc", "3D", "2D", "EFDC", "PDF", "GitHub", "Google", "Cloudflare", "GitHub Pages", "seungheon.com".
5. The name: keep 流木 as written. Render "Yumok" and "Lee Dong-joo" the way your language file already does. Where the source has 李東周 keep it.
6. Korean place names (Gunsan, Gimje, Okcheon, Masan...): transliterate into your script in the usual way, and translate the generic part (Port, Lake, Temple, photo contest, photography competition, Festival).
7. `titles` 283 to 303 were given by the photographer himself to pictures he entered in contests: festival scenes, portraits, a night bridge, a moorhen feeding its chick. Translate them faithfully and briefly, as titles.
8. `ui.prize.*` are label lines such as "Selected, Masan national photo contest, 2019". "Selected" (입선) means the picture was accepted and shown by the jury, below the prize ranks. Use the usual term in your language and keep the lines short and uniform.
9. `labels.suggest` is shown to someone reading the page in another language. Write it in your language and name your own language in it, for example French: "Voir cette page en français".
10. `labels.citeLine` is a credit line; use your language's own quotation marks around `{title}`.
11. `labels.bm_*` are short instructions for adding the page to bookmarks or to the phone's home screen. Use the wording your language's browsers and phones use for "Add to Home Screen" and "Share".
12. A `hint` shows how an earlier version of the sentence was translated in your language. Stay consistent with it where the meaning has not changed. "Currently left in English" marks strings that were never translated; translate them now, or repeat them unchanged if that is correct in your language (for example a proper name written in Latin script).
13. Natural, idiomatic language as a native museum editor would write. Formal, polite register. No machine-translation stiffness. Do not leave English words where your language has a natural one.
14. Output must be valid UTF-8 JSON.

## Translating a whole new language

Copy `i18n/en.json` to `i18n/<code>.json`, translate every value (not the keys of `places` and `site`), keep array lengths and order, then run `python tools/i18n_check.py <code>`.
