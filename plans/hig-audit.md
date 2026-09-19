# TickTackToto — Apple Human Interface Guidelines audit

Date: 2026-09-19
Scope: web app (React 19 + Vite + Tailwind 4, Firebase, react-hot-toast, framer-motion). HIG guidance is written for Apple platforms; this audit maps each guideline to its web equivalent (WCAG contrast, focus management, responsive layout) and rates the app.

Priority: **P0** = must fix, **P1** = should fix, **P2** = polish.

Legend for "verification": **verified** = read in the source file or official HIG page at the cited path; **documented** = official source, not executed.

---

## Summary

The app is strong on accessibility fundamentals — labeled inputs, focus traps, Escape dismissal, live regions, reduced-motion support, red for destructive actions. The gaps are concentrated in **feedback during long operations**, **modal/popover dismissal and hierarchy**, and **contrast auditing of custom colors**. The most visible regression a user would feel is the full-screen spinner in place of a loading placeholder.

**Fix order (highest leverage first):**

| # | Priority | Area | Verdict |
|---|----------|------|---------|
| 1 | P0 | Loading | Show placeholder content; never a blank modal fallback |
| 2 | P0 | Modality | Popovers need Escape / click-outside dismissal + focus management |
| 3 | P1 | Feedback | In-button activity indicator for long-running actions (export) |
| 4 | P1 | Color / accessibility | Audit custom colors for 4.5:1 contrast in light, dark, and increased contrast |
| 5 | P1 | Undo and redo | Support more than one level, highlight what was undone |
| 6 | P2 | Branding | index.html title and description disagree with the in-app brand |
| 7 | P2 | Copy / a11y labels | "Report profile settings" label, small header text |

---

## Accessibility (HIG `/accessibility`)

Guidance: interface must be Intuitive, Perceivable, Adaptable. Support larger text (ideally 200% enlargement); WCAG AA 4.5:1 for text, 3:1 for 18pt+/bold, in **both** light and dark; provide a higher-contrast variant; never rely on color alone.

**Working well (verified):**
- :focus-visible outline (2px primary, 2px offset) on all interactive elements — `src/index.css`.
- Font-size-agnostic layout: rem-based Tailwind scale, text tokens `xs`–`4xl` — `src/index.css`. No fixed `px` font sizes found.
- 44px minimum touch target for buttons/links under 768px — `src/index.css`. Matches the HIG 44×44pt hit-region rule.
- `prefers-reduced-motion: reduce` zeroes transitions in CSS (`src/index.css`) **and** timer pulse animation is gated by `useReducedMotion()` — `TimerSection.jsx`. Matches HIG motion preferences.
- Timer state announced via `sr-only role="status"` live region — `TimerSection.jsx` (status text; per-app guidance). Not color-only: closed-ticket state shows a Lock icon plus text — `TimerSection.jsx`.
- Contrast of success/danger/warning body text (#10b981/#ef4444/#f59e0b on gray-50/900) is plausible but not verified (see P1 #4).

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| A1 | `src/index.css` tokens | Hard-coded accent combinations (`bg-yellow-500`, `bg-green-600`, `bg-red-500`, `text-muted`) are not verified to hit 4.5:1 in **both** light and dark | Run a contrast audit (e.g. axe-core in CI, or manual WCAG check) for every accent/background pair in both themes; adjust tokens, not components | P1 |
| A2 | global | No increased-contrast variant or "Increase Contrast" equivalent | Web equivalent: support forced-colors / a high-contrast CSS override, or at minimum keep contrast AA; document the decision | P2 |
| A3 | `TimerSection.jsx` char counters | Amber counter cue at >180/4500 may be color-only (unverified whether a text cue accompanies it) | Pair the amber threshold with a text warning | P2 |

---

## Color (HIG `/color`)

Guidance: consistency — the same color must not mean different things; all colors must work in light, dark, and increased-contrast contexts; never rely solely on color.

**Working well (verified):**
- Colors are Tailwind semantic classes (`bg-gray-50/dark:bg-gray-900`, `primary`, `success`, `danger`, `warning` tokens) so light/dark adapt rather than being hard-coded hex in components — `src/index.css`.
- Status semantics are consistent: Start = indigo (primary), Pause = yellow, Resume = green, Stop = red, Closed = gray with Lock — `TimerSection.jsx`.
- Destructive actions stay red (`bg-red-600`) and never reuse primary indigo — `ConfirmationModal.jsx:16-17`. Matches "NEVER assign Primary to a destructive action."
- Each colored TimerSection action also carries a text label (Start/Pause/Resume/Stop), so color is not the only signal.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| C1 | `TimerSection.jsx` | Contrast of yellow-500 (Pause) and green-600 (Resume) against their background and white labels is unverified | Measure in both themes; yellow-500 with white text commonly fails 4.5:1 — if so, darken text or use dark text on yellow | P1 |
| C2 | Counters / helper text | `text-muted` and helper text contrast unverified in dark mode | Include in the A1 contrast pass | P2 |

---

## Typography (HIG `/typography`)

Guidance: legible sizes (iOS default 17pt, min 11pt); avoid light font weights for small text; hierarchy via weight/size/color that survives text scaling; minimize typefaces.

**Working well (verified):**
- One font family (system stack via Tailwind), no thin/light weights in the UI — matches "minimize the number of typefaces."
- Hierarchy via size, not color alone: h1 `text-4xl font-extrabold`, section h2, body, `text-xs` meta — `App.jsx` / `src/index.css`.
- Text scale is rem-based, so the layout responds to browser font-size zoom (HIG "Adaptability": rows and containers must grow rather than crop) — `src/index.css`.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| T1 | `App.jsx` header | "Log out" label at `text-xs` and other meta text approach the 11pt floor; fine now but fragile if the scale is tightened | Keep meta text ≥ 12px; treat text-xs as the user-facing minimum | P2 |

---

## Dark mode (HIG `/dark-mode`)

Guidance: respect the system appearance; colors need bright and dim variants; ≥4.5:1 in **all** appearances; test with Increase Contrast and Reduce Transparency.

**Working well (verified):**
- Default theme is read from `matchMedia('(prefers-color-scheme: dark)')`; user toggle is persisted to localStorage; `dark` class on `documentElement`; `meta theme-color` updates per theme — `App.jsx`.
- HIG says to *avoid* an app-specific appearance setting because users may think the app is broken. In a **web** context a toggle is conventional and acceptable, but it should default correctly (it does) and both themes must be fully styled (they are, via Tailwind `dark:` variants).
- Test coverage exists (`test:rules`, Vitest) and the dark styles are class-based, not CSS-var overrides — low regression risk.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| D1 | all `dark:` variants | Dark palette correctness is unverified beyond gray-900/50 surfaces; component accents (yellow/green/red) and muted text need the same A1 contrast pass in dark | Include dark as a required CI/a11y check | P1 |

---

## Layout & adaptability (HIG `/layout`)

Guidance: progressive disclosure; visual hierarchy; group related items; layouts must adapt to size, orientation, and larger text (stacks, taller rows).

**Working well (verified):**
- `max-w-4xl mx-auto` — content is width-capped and centered on large screens (HIG: horizontal centering at large sizes) — `App.jsx`.
- Grid collapses: Filter & Summary uses `grid lg:grid-cols-2` — `App.jsx`. Responsive down to mobile.
- Progressive disclosure: Instructions popover, Export menu, quick filter chips — `App.jsx` / `ExportMenu.jsx`.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| L1 | `App.jsx` | The header title is `h1` on every state; fine, but subtitle "the slick ticket time tracker" duplicates the index.html description and adds noise | Keep one brand statement; consider making the subtitle `p` (already) with muted styling | P2 |

---

## Loading (HIG `/loading`)

Guidance: the best experience finishes before people notice; show **something as soon as possible** — placeholder text/graphics/animation, not a wait screen; let people do other things; use determinate progress when duration is known, indeterminate spinner only when it isn't.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| LD1 | `App.jsx` | Full-screen spinner + "Loading Tracker…" while `!isAuthReady || !logsLoadedOnce` | Replace with skeleton/placeholder layout so content is "almost there"; per HIG this is the single highest-impact loading change | **P0** |
| LD2 | `App.jsx` (Suspense) | All modals `lazy()` with `fallback={null}` — opening a modal shows nothing until its code loads | Provide a lightweight fallback (spinner or toast). P0 if any chunk is slow; P2 otherwise | P1 |
| LD3 | `App.jsx` handleExport | Long full-history export shows only a **toast** `Loading full history…`; the button gives no progress | Prefer an indeterminate progress indicator **inside the export button** (see B3) | P1 |

---

## Feedback (HIG `/feedback`)

Guidance: categories — status, success/failure, warnings, opportunity to correct; match delivery to significance; make it accessible (color + text); warn before unexpected irreversible loss, not when loss is expected; show when a command can't run and why.

**Working well (verified):**
- Toast system (react-hot-toast, top-right) with differentiated timing (success 2s / error 4s / default 3s) and dark-mode styling — `App.jsx`.
- Combined error panel with icon + message + "Try Again" and "Refresh Page" — shows *why* and offers recovery — `App.jsx`.
- Inline, contextual errors (closed-ticket block with Lock icon, char counters) — `TimerSection.jsx`.
- Destructive confirmations state consequences (ticket, time worked, note, session count, "You can undo for a few seconds afterwards") — `ConfirmationModal.jsx`, `ExportConfirmModal.jsx`. Matches "warn before unexpected irreversible data loss."

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| FB1 | `ExportConfirmModal.jsx` | Long export relies on a transient toast; if the user switches tabs the confirmation of completion can be missed | Add an in-button progress state and keep a success state (e.g. checkmark) rather than only a toast | P1 |

---

## Undo and redo (HIG `/undo-and-redo`)

Guidance: predict the outcome, highlight the restored result; allow multiple undos; describe the operation precisely; prefer standard system paths (Cmd/Ctrl+Z).

**Working well (verified):**
- Global Ctrl/Cmd+Z undo with guards (no modal open, not editing/typing) — `App.jsx`.
- Undo toasts name the operation ("Marked N session(s) as submitted — hidden by default; view via the Submitted filter") — `App.jsx`, `undoToast.jsx`.
- Deletions and exports announce undo availability with a deadline ("for a few seconds afterwards") — good "opportunity to correct mistakes" pattern.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| U1 | `App.jsx` (undo system) | Undo is single-level: only the last action can be reversed (`runLastUndo`) | If feasible, keep a small LIFO stack of undoable actions; at minimum, **highlight the restored item** (HIG: people repeat undo when they can't see its effect) | P1 |
| U2 | `App.jsx` | Undo applies only to in-session actions; there is no redo | Add redo (Ctrl/Cmd+Shift+Z) for symmetry where cheap | P2 |

---

## Modality (HIG `/modality`)

Guidance: modal = separate mode requiring explicit dismissal; always an obvious way to dismiss; one modal at a time; titled and task-focused; get confirmation if closing could lose user-generated content.

**Working well (verified):**
- `ModalBase.jsx` implements the full modal contract: `role="dialog"`, `aria-modal`, `aria-labelledby` (+ optional `aria-describedby`), focus trap with Tab/Shift+Tab cycling, Escape to close, backdrop click (unless `backdropCanClose=false`), initial focus target, and **focus restoration to the previously focused element** on close.
- Modals are titled (e.g. ExportConfirmModal labels/describes), one-at-a-time, and guarded during in-flight work (`backdropCanClose={!isLoading}`).
- Confirmation of user-generated content is in place (nothing is silently discarded).

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| M1 | `App.jsx` Instructions popover | Disclosure popover (`aria-expanded`, absolutely positioned, `z-10`) **cannot be dismissed via Escape or click-outside**, and has no focus management once opened | Treat it as a light modal or a proper popover: Escape + outside-click to close, focus moves in on open and returns on close | **P0** (same fix as LD1/2 high leverage) |
| M2 | `App.jsx` Instructions popover | `z-10` — a modal (`z-50`) opened over it would hide it without closing it | Move the popover above modal backdrop or close it when a modal opens, so two layers are never simultaneously visible | P1 |
| M3 | `App.jsx` profile popover | Button aria-label reads "Report profile settings" (odd wording for an open/close toggle) and likely the same no-Escape issue as M1 | Rename to "Profile settings" / "Open profile settings" and apply the M1 treatment | P2 |

---

## Buttons (HIG `/buttons`)

Guidance: 44×44pt hit region; a pressed state on custom buttons; one to two prominent actions per view; distinguish preferred choice by style not size; labels start with a verb; primary responds to Return and auto-closes where suitable; never make a destructive action primary; show an activity indicator inside the button when an action isn't instant.

**Working well (verified):**
- Press states on all buttons (`active:scale-[0.98]`) — `src/index.css` `.btn-*`.
- Hit region ≥44px on mobile media query; buttons in TimerSection are text-lg.
- One primary action per logical view: TimerSection's action button swaps styles by state with **no two accent buttons competing**; Stop is red, not indigo.
- Destructive never primary — `ConfirmationModal.jsx:16-17`.
- Verb-first labels: Start, Pause, Resume, Stop, Export, Clear All — `TimerSection.jsx`, `FilterBar.jsx`, `App.jsx`.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| B1 | `ExportMenu` / `App.jsx` | Export menu keyboard nav is excellent (menu/menuitem, arrows, Escape step-back) — no change | — | — |
| B2 | `TimerSection.jsx` | Timer action button changes **color + label** together (Start indigo → Pause yellow → Resume green) — color changes meaning mid-view; acceptable but a single accent with a changing label is more consistent (HIG: distinguish by style, keep semantics stable) | Consider keeping one accent color and swapping only icon/text | P2 |
| B3 | `App.jsx` export flow | **No in-button activity indicator or changing label** ("Exporting…") for the full-history export — HIG explicitly asks for an activity indicator inside the button when an action does not complete instantly | Add a spinner + changing label in the Export button while `isLoading`; disable duplicates | P1 |

---

## Forms & entering data (HIG `/entering-data`)

Guidance (forms substitute; `/forms` 404s): pre-gather data; make required data obvious; use choices/selection over raw entry where possible; dynamic validation with early error feedback; keep submit disabled until required data is valid; secure fields for sensitive data.

**Working well (verified):**
- Every input is labeled (`<label htmlFor>` + placeholder), including a datalist of recent tickets for fast selection — `TimerSection.jsx`. Matches "offer choices instead of typing."
- Live validation feedback: char counters with soft (amber) and hard (`maxLength` 200/5000) limits; inline error for closed tickets — `TimerSection.jsx`.
- Passwords/secure data: none stored; Google sign-in — nothing to obscure.
- Filter inputs have visible labels + an `aria-label` clear button — `FilterBar.jsx`.

**Findings:**

| # | Location | Finding | Recommendation | Priority |
|---|----------|---------|----------------|----------|
| F1 | `TimerSection.jsx` | Submit (Start) button enabled state on validation is unverified — HIG says keep submit disabled until required data is present | Confirm the Start/ticket-input guards (empty ticket) disable or reject clearly; if not, disable until valid | P2 |

---

## Severity roll-up

| Priority | Action | Items |
|----------|---------|--------|
| P0 | Fix now | LD1 placeholder vs spinner; M1 popover dismissal/focus |
| P1 | Next release | A1/A2 contrast pass incl. yellow-500 & dark; C1; LD2 modal fallback; LD3/B3 in-button progress; FB1 persistent export state; U1 multi-level undo + highlight; M2 z-order |
| P2 | Backlog | T1 text-xs floor; A3; C2; L1; D1; U2 redo; B2 stable accent; F1 submit-disabled; M3 aria label; brand title/description |

---

## Verified evidence base

- HIG pages read (official site, via browser): accessibility, color, typography, dark-mode, layout, feedback, loading, undo-and-redo, modality, buttons, entering-data. (`/forms`, `/empty-states` return 404.)
- Source reviewed: `index.html`, `src/index.css`, `src/App.jsx`, `components/ModalBase.jsx`, `ExportMenu.jsx`, `ExportConfirmModal.jsx`, `ConfirmationModal.jsx`, `FilterBar.jsx`, `TimerSection.jsx`.
- Unverified items are marked accordingly and should be checked with a contrast tool (axe-core) plus manual light/dark inspection before sign-off.

---

## Fix status (implemented after audit)

Verification: `npm run lint` (0 errors), `npm test` (50/50 pass), `npm run build` (success). Contrast pairs were verified with the WCAG formula script, not eyeballed.

- **LD1 (P0)** — Fixed. Full-screen "Loading Tracker…" spinner replaced with a skeleton layout (`src/App.jsx`) mirroring header/timer/summary/list cards, with `role="status"` and an sr-only label.
- **LD2 (P1)** — Fixed. Modal `Suspense` fallback is now a visible lightweight overlay (spinner + `aria-busy`) instead of `null`.
- **M1 (P0)** — Fixed. Instructions and profile popovers dismiss on Escape and click/touch outside, move focus into the panel on open and restore it on close (`src/hooks/usePopoverDismiss.js`, caller-owned refs).
- **M2 / M3 (P1/P2)** — Fixed. Popovers raise to `z-40` (above content, below modal overlay `z-50`) and are force-closed when any modal opens (one dialog surface at a time); profile button renamed to "Profile settings" with `aria-haspopup`.
- **A1/A2/C1/D1 (P1)** — Fixed. Script-verified contrast pass: green fills `green-700/800`, red fills `red-600/700` (`.btn-danger`, Stop, bulk Delete), Pause `yellow-400` + `text-gray-900`, running/paused labels `indigo-700` / `yellow-700`, amber text `amber-700` light, interactive icon buttons `gray-500/dark:gray-400`, placeholders "No notes added" and empty states bumped. Timer state colors keep the yellow/green/red semantic mapping (B2 decision retained), now with passing pairs.
- **C2 (P2)** — Verified: `.text-muted` (gray-600 / dark gray-400) already passes both themes; no change needed.
- **LD3/B3/FB1 (P1)** — Fixed. Export trigger button shows an in-button spinner, `aria-label="Exporting…"`, and is disabled while exporting; both action buttons in `ExportConfirmModal` show spinners while loading.
- **U1 (P1)** — Fixed. Multi-level undo: LIFO stack (max 10) in `src/utils/undoToast.jsx`; repeated Ctrl/Cmd+Z restores successive actions; expired entries are skipped and dismissed. **U1b** — Fixed. After an undo that restores or moves content, the affected ticket group flash-highlights for ~2s (`undo-flash`, respects `prefers-reduced-motion`).
- **U2 (P2)** — Not implemented (redo requires an action-inversion model; documented as backlog).
- **F1 (P2)** — Verified already gated: Start is disabled while the ticket input is empty (`TimerSection.jsx`); no change made.
- **A3 (P2)** — Fixed. Near-limit counters now read "N/M · near limit" (text, not color alone).
- **T1 / L1 (P2)** — Fixed via TypeUI fundamentals: "Log out", char counters, and helper texts raised to the 14px interactive/support floor; h1 capped at `text-2xl` (dashboard ≤28px rule); `.input` enforces 1rem font size (prevents iOS focus zoom); `.btn-*`/`.input` get `disabled:cursor-not-allowed`. Decorative icons and micro-UI (timestamps, uppercase labels) intentionally kept.
- **Brand (P2)** — Fixed. `index.html` title is now "TickTackToto" and the meta description "TickTackToto — the slick ticket time tracker" (manifest already correct).