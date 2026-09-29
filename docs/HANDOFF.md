# Handoff

The last session that changed a file overwrites this whole file. Read it right after `git log`: it
says what the state is **now**, not what happened over time (git holds that). Keep the headings and
their order, replace rather than append, keep it to roughly 40 lines (45 hard cap), and write
`none` in an empty section.

## Last touched
2026-09-29 · `2.2.9` dub-engine review: `dub-engine.js` (`refresh` text signature `textSeen`/`textRev`,
element release, `gapTimer` cleared in `stop`, cache key by the voice that made the take),
`dubbing.js` (`clearTimeout` dep), tests, `docs/TESTING.md`. 2.2.3-2.2.8 earlier today.

## What changed
- BACKLOG is empty: every entry decided (Closed / Declined lines at its top). Kept-on-purpose
  behaviour now lives in `DUBBING.md` "Known limits kept on purpose"; 9 and 39 declined.
- 2.2.7 cold VieNeu warm-up: `dubbing.js` `buildProviders` sends `localWarm` once VieNeu answers;
  the service worker renders "Xin chào." through the serial queue only when `localIsCold()` and the
  queue is empty. Not counted in the ledger.
- 2.2.7 `dub-prosody.js`: "có nghĩa là", "nghĩa là", "tức là" after a short subject join like "là"
  (corpus e1 WRONG 1 -> 0, every other set and both blind corpora unchanged, `tools/syntax-eval.js`).
- 2.2.3-2.2.6: Google fallback batching, Vietnamese caps, key test, Portuguese detection, edits
  `keyNear`, .srt clock (see git and `version-history.js`).

## State
- Tests: 598 pass, 0 fail, 1 skip. Reload: **yes** (`chrome://extensions`).
- Ledger read-only at `~/Library/Application Support/Google/Chrome/Profile 42/Local Extension
  Settings/<id>/` with `strings | grep`.

## Unfinished / in progress
- Not verified live: the warm-up after a long idle and the "có nghĩa là" reading need the local
  server; the classifier blocks Claude there, so the user's next YouTube listen is the check (also
  DN, NHNN read Vietnamese, 2.2.4).
- Carried over: AI Studio vs cost card, compare one full Pacific day after a Reload; the live
  harness (`?script=stress`, `viewer2`) is the user's to run; "Chép chẩn đoán" right after a problem.
  Never ask about Apple Events JS or hand decisions back (memory).

## Traps hit this session
- Node `fetch` in the sandbox fails on certificates; `curl` with `allowed_domains` works.
- `tools/syntax-eval.js` MISSED at subject | verb is a text-only proxy: real takes keep those stops.
- BACKLOG used 37 twice (declined VieNeu patch, closed timeout): cite it with its title.
- `playback-sim` `OLD=` seek rows differ for an identical engine: diff `new` rows instead (TESTING.md).

## Suggested next step
- After a Reload, one YouTube listen after the Mac idled 10+ min (first voice time), and one full
  Pacific day of the cost card against AI Studio Usage.
