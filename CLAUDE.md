# DuelingBookReloaded

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
  `chrome.storage.sync`. `hotkey` is a space-separated sequence of tokens;
  a token is `["shift+"] base` (`"v"`, `"shift+b"`, `"s shift+b"`, `"f1"`).
  Shift is meaningful only on letters/digits. `loadHotkeysConfig` backfills
  defaults for actions missing from stored configs (new-version actions
  appear on upgrade). `saveHotkeysConfig` broadcasts a `HOTKEYS_CHANGED`
  runtime message that the content script uses to hot-swap bindings without
  a page reload.
- `src/utilities/keyNormalization.ts` — the single place keyboard events
  become tokens (`normalizeKeyEvent`, via `e.code` for letters/digits so
  Shift/CapsLock can't skew them) and tokens become UI text
  (`displaySequence` → `S → ⇧B`). Content script, recorder, and overlay all
  use it.
- `src/utilities/hintsData.ts` + `src/utilities/hintsOverlay.ts` — the
  in-game hotkey hints popup ("Show Hotkey Hints" action, default F1).
  `hintsData` groups enabled bindings per `hotkeySections` (pure/testable);
  `hintsOverlay` is a vanilla-DOM singleton (`#dbr-hints-overlay`, styled by
  `src/styles/hints-overlay.css`) with no focusable elements. The matcher's
  `pendingPrefix()`/`continuations()` drive live narrowing while a sequence
  is pending.
- `src/utilities/sequenceMatcher.ts` — pure trie-based matcher for key
  sequences. The content script feeds it keys; `fire` runs actions,
  `prefix` waits (800ms inter-key timeout), `nomatch` lets the key fall
  through to the page. Duplicate sequences map to multiple actions on
  purpose: card-menu actions are context-dependent and `playCard` clicks
  whichever is present.
- `src/utilities/hotkeyValidation.ts` — options-page conflict rule: two
  bindings conflict when one sequence equals or is a prefix of the other.
- Touchscreen mode (option `touchMode`: on/off/auto, auto =
  `matchMedia("(pointer: coarse)")`): tapping a duel card or pile opens a
  radial fan of large action buttons that drives DuelingBook's own (CSS-hidden)
  card menu. Modules: `src/utilities/touchMenuData.ts` (pure: action→group
  table, `buildFanModel`, `resolveTouchActive`), `touchFanLayout.ts` (pure:
  ring/grid geometry in viewport px), `touchNativeMenu.ts` (opens/reads/
  clicks/closes `#card_menu` via synthetic MouseEvents), `touchFanOverlay.ts`
  (DOM singleton `#dbr-touch-fan`, hintsOverlay pattern, divs only),
  `touchInput.ts` (window capture-phase touch classifier: fan → interactive
  elements → cards/piles → generic tap-to-hover shim; toggles `dbr-touch` on
  `<html>`), styled by `src/styles/touch-mode.css`. Mouse clicks open the fan
  too (the native menu is invisible while the mode is on), with a capture-phase
  guard that swallows trusted card/pile mouseover/mouseout while the fan is
  open — otherwise mousing toward a fan button across neighboring cards would
  swap DuelingBook's menu underneath it and a fan click would act on the
  wrong card.
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
- In touch mode the native `#card_menu` is hidden with `opacity: 0` but MUST
  stay in the DOM with real layout — `playCard` and the fan click its spans,
  and DuelingBook's `:visible` checks must keep passing. Never `display:none`
  it. When closed, DuelingBook *detaches* `#card_menu` from the DOM
  (presence = open). The content script is isolated-world: DuelingBook is
  driven only via synthetic MouseEvents (`mouseover` on a card's `.content`
  opens the menu synchronously; `mouseout` with clientY *below* the card's
  bottom closes it — coords above are treated as moving into the menu), and
  `showMenu` can silently refuse (card tweening, overlay up), so success is
  verified by reading `#card_menu` back.
- Testing anything that touches `chrome.*` requires mocks; prefer keeping
  logic in pure modules (like the matcher/validator) instead.

## CI

- `.github/workflows/build.yml` — build + test on pushes/PRs to `main`.
- `.github/workflows/release.yml` — on push to `main`: builds, zips `dist/`,
  uploads it as an artifact, and publishes a GitHub Release tagged
  `v<version>` when `public/manifest.json`'s version changes.
