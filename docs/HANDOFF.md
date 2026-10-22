# Handoff (2026-10-22, 2.7.3)

## State
- Rule zero (CLAUDE.md): every fix is for the whole system; report by defect class with counts
  over all saved videos (`ext-storage.js --prefix=ytcache4_` + `review-archive/`, ~82 now).
- Today: 2.6.9 `chainLead` 0.3; 2.7.0 `rateStepUpOverrun` 0.2; 2.7.1 no blink between lines, no
  weekday kept as written. 2.7.2 + 2.7.3 (one commit), all found by running new videos:
  - `ytRetryEmptyCaptions`: an auto start whose captions came back empty (pot not seen yet, a
    background or covered tab) tries again on show and after 4/12/30 s. Fzbvle8b1GQ, yrZIt3aOmXY:
    unsaved twice, saved on the rerun.
  - `ytGanBanDich` saves the moment the last group lands (autoplay used to turn the run off first).
  - `requestUnit`: a sound-note line inside a window of speech is filled from the list, never sent
    (">> [music]" came back empty from both models -> whole window to Google -> video unsaved).
  - `dropTermEchoes` in `restoreGlossary`: a rendering the model also wrote beside its code is
    kept once (5 of 10,057 saved groups doubled, every one a glossary term).
  - Diagnostics on the device: `cstFallbackLog`, `ytSaveSkip` (SUBTITLE.md storage keys).
- Tried and dropped: a prompt line for unpunctuated sources (tr-lab run `asr1`, TESTING.md).
- `npm test` 739 pass, 0 fail, 1 skip; `regress.js` 0 numbers moved.

## Unfinished
- A driver run is going (12 ids; saved so far TUSgouBKDGg, yrZIt3aOmXY). MebK9iEUzQA has an
  uploaded Vietnamese track: shown as is, never saved by design, the driver logs it "NOT SAVED".
  After it ends: review the new ids (`batch-review.js` on a dump), read `cstFallbackLog`.
- Not heard: 2.6.9-2.7.3 by ear.
- Carried over: prompt 3 and the >> split on a real reading (BACKLOG 44); 2.6.5-2.6.8 not checked
  live; `screen-text.js` never ran; share repo promotion of 2.5.7-2.7.3 after a green install
  test; BACKLOG 43-47; 2.5.7 shortcuts on YouTube; joint-takes branches; 2.5.0 Coursera start hold;
  CI gaps; voice items "có nghĩa là", DN, NHNN; `ban-giao.md` lacks the share repo.
- Never ask the user about Chrome's Apple Events setting.

## Traps
- A harness page added since the last load is blocked until a Reload. `tests/harness/reload.html`
  reloads (and puts dubbing back after an interrupted driver run); Control_Chrome cannot script
  chrome:// pages or call chrome.runtime from its world.
- `yt-driver.html` keeps the element unmuted (tab muted) and pauses `rate * 2.5` s before the end,
  else a covered window ran ~1x and autoplay took the tab to another video.
- A prompt A/B needs a gap larger than two samples of one prompt (127 of 143 items differ anyway).
