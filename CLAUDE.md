# DuelingBookEnhanced

A Chrome extension (Manifest V3) adding quality-of-life features to
[duelingbook.com](https://www.duelingbook.com): configurable hotkeys (single
keys or multi-key sequences), dark mode, auto-connect, and intro skipping.

## Commands

- `npm run build` — typecheck (`tsc`), webpack production build, Tailwind CSS. Output goes to `dist/`.
- `npm test` — jest unit tests (`src/**/*.test.ts`).
- `npm run start` / `npm run watch` — webpack dev watch builds.
- `npm run style` — prettier over `src/`.
- `npm run clean` — remove `dist/`.

To try the extension: build, then load `dist/` as an unpacked extension at
`chrome://extensions` (Developer mode → "Load unpacked").

## Architecture

Stack: React 18 + TypeScript, webpack 5 (`webpack/webpack.*.js`), Tailwind.
Webpack entry points are declared in `webpack/webpack.common.js`; the
manifest lives in `public/manifest.json` and is copied into `dist/` verbatim.

- `src/content_script.tsx` — injected into duelingbook.com. Owns all in-game
  behavior: the key listeners, the action→function map
  (`actionFunctionMap`), and DOM manipulation of DuelingBook's UI (clicking
  its buttons/menus by id/class).
- `src/background.ts` — MV3 service worker; only opens the "new features"
  page on install/update.
- `src/popup.tsx`, `src/fullOptions.tsx` — toolbar popup and options page
  (options page is where hotkeys are customized via `CustomizeHotkeys.tsx` →
  `components/HotkeySection.tsx` → `components/HotkeyRecorder.tsx`).
- `src/utilities/configUtility.ts` — hotkey persistence. Config is a flat
  `HotkeyEntry[]` (`{action, hotkey, disabled}`) under `hotkeysConfig` in
  `chrome.storage.sync`. `hotkey` is a single key (`"v"`) or a
  space-separated sequence (`"v e"`). `saveHotkeysConfig` broadcasts a
  `HOTKEYS_CHANGED` runtime message that the content script uses to hot-swap
  bindings without a page reload.
- `src/utilities/sequenceMatcher.ts` — pure trie-based matcher for key
  sequences. The content script feeds it keys; `fire` runs actions,
  `prefix` waits (800ms inter-key timeout), `nomatch` lets the key fall
  through to the page. Duplicate sequences map to multiple actions on
  purpose: card-menu actions are context-dependent and `playCard` clicks
  whichever is present.
- `src/utilities/hotkeyValidation.ts` — options-page conflict rule: two
  bindings conflict when one sequence equals or is a prefix of the other.
- `src/data/validHotkeys.ts` — whitelist of assignable keys.
- `src/data/hotkeySections.ts` — options-page grouping of actions.

## Key handling (why it's shaped this way)

DuelingBook auto-focuses its chat input on any keypress. The content script
therefore listens on `window` in the **capture phase, synchronously** —
never debounce these handlers or move them to bubble phase, or the page
steals focus before the extension sees the key. Keys that match (or start)
a binding get `preventDefault()` + `stopImmediatePropagation()`. A
`typingIntent` flag tracks whether the user is deliberately typing (clicked
an input, toggled the chat box, adjusting LP); while set, nothing is
intercepted. Unbound keys always fall through so DuelingBook's native
type-to-chat keeps working.

## Gotchas

- DuelingBook DOM selectors are fragile and undocumented (e.g. the chat box
  is `document.querySelectorAll("input.cin_txt")[1]`, card menus are
  `#card_menu_content .card_menu_btn`). If the site updates, these break
  silently.
- `actionFunctionMap` in `content_script.tsx` and `getDefaultHotkeys()` in
  `configUtility.ts` must stay in sync — every action string needs both a
  default binding and a function.
- Action names may contain `/` (e.g. `"To S/T"`), and the options page also
  uses `/` to join compound rows (`"Activate/To S/T"`). Always use
  `splitActions()` (`src/utilities/actionsManipulations.ts`) to split
  labels; never `label.split("/")`.
- Options-page keys captured by `HotkeyRecorder` must be confirmed with the
  Done **button** — Enter and Escape are themselves assignable keys.
- Testing anything that touches `chrome.*` requires mocks; prefer keeping
  logic in pure modules (like the matcher/validator) instead.

## CI

- `.github/workflows/build.yml` — build + test on pushes/PRs to `main`.
- `.github/workflows/release.yml` — on push to `main`: builds, zips `dist/`,
  uploads it as an artifact, and publishes a GitHub Release tagged
  `v<version>` when `public/manifest.json`'s version changes.
