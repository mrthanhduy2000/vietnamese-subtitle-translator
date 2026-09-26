# Dubbing (lồng tiếng)

Line numbers drift. Grep the function name.

**Rule that overrides everything here: never condense, shorten or summarize a line.** If Vietnamese
speech does not fit its slot, the allowed levers are speech rate, trimming pauses inside the
sentence, chaining sentences together, and accepting a small lag. There is no condense code: the
machinery that one `condense: null` in `dubbing.js` used to keep off (`needsCondense`,
`condenseBeforeTts`, the `condenseSpeech` action, `condensedIsSafe`) was removed in 1.7.3, and
`tests/backlog.test.js` fails if any of it comes back.

## Four files, one direction of data

```
dub-planner.js   pure    text -> speech script -> prosody and timing. No I/O, fully testable
dub-audio.js     pure    WAV/PCM: decode, normalize, find silence, split, compress pauses
dub-engine.js    impure  providers + scheduler + video clock + ducking. The complicated one
dubbing.js       thin    settings, provider pick, badge, "hold the video while preparing"
```

`dubbing.js` is what `youtube.js` and `content.js` call (`CST_DUB.start` / `.stop`). It is small on
purpose: put logic in the planner or the engine, not here.

## Data contract

**group** (from the translation layer, filtered in `dub-engine.js` `refresh`)
`{ start, end, viText, viCues[], srcCues[] }`

**segment** (`dub-planner.js` `buildDubScript`) - note these are *continuous speech spans*, not one
per cue: `{ id, index, start, end, slotEnd, speaker, cueCount, subtitleText, speechSource, srcText,
sourcePauses[], continuesNext }`

`id` is `t<ms>` and deliberately stable: out-of-order translation must not invalidate audio that
has already been paid for.

**plan** (`dub-planner.js` `planSegment`) adds `{ sps, calibration, text, intent, phrases[], rate,
pauseScale, pitch, emphasisWords, naturalDuration, targetDuration, estDuration, durationRatio,
overflow, strategies[], style }`, where a phrase is `{ text, syl, pauseAfter, rateMul, emphasis,
breakKind, offset, dur, pause }`.

**provider.render(plans, ctx)** -> `[{ planId, wav: Uint8Array, duration, sampleRate }]`

**rendered** (engine RAM) `{ url, duration, stretch, fit, overflow, text, el }`
**speech** (playing now) `{ id, mediaStart, offset, rate, end }`

## Speech text (`adaptForSpeech`, 1.5.8)

What the voice is sent, for every provider. Check a change against what VieNeu actually says: its
normalizer is `sea_g2p` and runs offline with
`~/VieNeu-TTS/.venv/bin/python` + `from vieneu_utils.phonemize_text import PuncNormalizer`.
Measured facts behind the rules: the server reads a digit run of 7+ digits one digit at a time
(`1500000` -> "một năm không..."), so grouped and long numbers are sent as words; `$20` is "u s d",
`7B`/`200K` are letters, English `1,000` becomes "một", `1990s` ends in "giây". Versions and section
numbers are read with "chấm", a decimal with "phẩy". Test: `tests/dub.test.js` "speech text".

## The SYNC block is the tuning bible

`dub-engine.js` lines 27 to 76, one object named `SYNC`. **Every timing constant lives there.** If
you are about to introduce a magic number anywhere in the dubbing code, put it in `SYNC` instead.
The comments in it record why each value is what it is; read them before changing one.

Knobs you will actually reach for:

- **Drift (1.6.8)**: `driftCorrect` 0.15s re-seeks the audio. Below that, `driveSpeech` first absorbs
  the element's start-up latency into the sentence's timeline (`driftAnchor` 0.12, once per
  sentence), smooths the drift (EMA), and nudges by one fixed 3% step with hysteresis
  (`driftNudge` 0.08 on, `driftNudgeOff` 0.02 off, `nudgeSpacing` 0.8 s). Measured in real Chrome
  (`tests/harness/smooth.html`, 120 s of real VieNeu audio): the old per-tick nudge changed
  `playbackRate` 510 times on playing voices (~21 per sentence), each one restarting Chrome's
  time-stretch = the "robotic stutter" (Thục Đoan); after the fix 0 for Thục Đoan and for Mỹ Duyên
  (Mỹ Duyên measured only after), lag still 0.
  `chooseRate` also plays a sentence within `snapToNatural` (5%) of 1.0 at exactly 1.0 when the
  voice is not a sped-up slow one and the step limits allow (21/24 Thục Đoan sentences, no stretch).
- **Rate**: `chooseRate` clamps per sentence to `[floorRate(), maxSpeechRate 1.3]`, rising to
  `lagMaxSpeechRate` 1.4 once lag passes `lagBoostAt` 1.0. Between sentences the change is smoothed
  (`rateStepUp` 0.1, `rateStepDown` 0.06) because the user's complaint was uneven pace, not
  wrong pace. `baseTempo` comes from the voice's **measured** syllables per second (`measureVoice`,
  EMA 0.25), not a constant. `floorRate` divides by `video.playbackRate`.
- **Chaining**: `chainLead` was cut from 2.0s to 0.8s because starting early accumulated error
  across chained segments. `continuesNext` treats gaps up to 1.5s as one continuous span.
- **Skipping**: whole sentences only, never mid-sentence. `maxQueueLag` 4.5, `dropLag` 4.0 for the
  live provider. Gating happens in `nextSpeech`.
- **Overload (added 1.4.7)**: when the TTS server is slower than real time, waiting for the next
  sentence's audio is hopeless and the old code stood silent 4.5s per sentence, dropping them one
  by one while still rendering sentences it had already given up on. Three parts now: `waitAudio(p)`
  estimates the remaining wait from the **measured** `renderRtf` (generated seconds per second of
  speech, EMA in `renderBatch`), `skipAhead` jumps the queue to the first sentence whose audio can
  still arrive (`skipAfter` 8, `skipAheadMax` 60), and `schedule`'s `inWindow` refuses any plan at
  or behind `lastSpokenStart`. Plus: with an empty buffer a request carries **one** short plan, not
  a 4-plan batch. Simulated on a real 11-minute timeline with a server at RTF 1.0: 12/61 sentences
  spoken before, 30/61 after; at RTF 0.23 nothing changes (61/61). The thresholds are measured, not
  guessed: `skipAfter` 4.5 costs 2 sentences at RTF 0.7, and capping `skipAheadMax` at 6 to 14
  seconds drops to 14/61 because short jumps land late again. See `tests/hardening.test.js`
  "slow voice server".
- **Video pace (1.6.1)**: `videoPace(t)` reads the next `paceWindow` (90 s): for each plan,
  `planNeed(i)` = natural audio length (rendered, else syllables / measured voice sps) over its slot,
  syllable-weighted median (`mid`) and upper quartile (`high`). `paceLimits` raises the ceiling to
  `min(paceCeilingMax 1.55, high * 1.08, maxSpokenSps 5.8 / sps)` (+0.1 while lagging) and the floor
  to `mid * 0.92` when `mid > 1`. `chooseRate` also looks `lookAhead` (3) plans ahead and starts
  climbing early, bounded so the current sentence ends at most `lookAheadEarly` (0.5 s) before its
  subtitle. Simulated with Kim Thanh on two real cached timelines: lag over 1 s 3 -> 0 and 5 -> 1,
  a slow speaker (timeline x1.35) unchanged. Measured live on 4eY5DuqASQc 8:25 to end (1.6.1, Kim Thanh):
  peak start lag 1.88 -> 0.43 s, overrun 1.76 -> 0.42 s, top rate 1.40 -> 1.41, none dropped. Harness: `scratchpad/sim-kim.js` pattern, see
  `tests/dub.test.js` "slow voice on a fast speaker".
- **Prefetch**: `prefetchAhead` is adaptive, roughly `(latency * 2.5 + 4) * playbackRate`, times 0.6
  if the user seeks twice in a minute, with a free-provider floor of 20 to 40s. `dubbing.js`
  `smartPrefetch` shrinks it 30% for videos over 30 minutes.
- **Retention**: `keepBehind` 90s / `keepAhead` 240s in `releaseOld`, so a short rewind is free.
- **Levels (1.5.6)**: `dubVolume` and `dubDuck` are 0..1 and read through `CST_DUB.level(x, fallback)`.
  Never `Number(x) || fallback`: 0 is a real choice (mute the original), and that idiom turned the
  Settings slider's 0% into 20%. Both are also set from the quick menu (`buildVolumeControls` in
  `player-ui.js`) and applied live by the storage listener in `dubbing.js`.
- **What the viewer sees (1.5.6)**: `engine.health(t)` returns `{ live, ahead, rtf, dropped, errors }`;
  `CST_DUB.describeHealth()` turns it into the one line under "Lồng tiếng Việt" in both quick menus
  (ready N seconds ahead / server slow at RTF x / N lines skipped), warning-coloured when it matters.
- **Ducking**: voice cannot be separated from music, so the original track is ramped down
  (`duckRampPerTick` 0.09, `duckHold` 0.35) in `updateDuck`, with a guard against fighting the
  user's own volume changes.

**Planning window (1.6.3).** `refresh` plans only groups overlapping
`[step*planStep - planBehind, (step+1)*planStep + planAhead]` (60 / 150 / 300 s) plus one group past
the edge (for `continuesNext`); the step number is in the signature, so it rebuilds at most once a
minute while nothing new arrives. Speaker parity for the window comes from
`PLAN.speakerStateBefore(all, first)`. Whole-video planning cost ~90 ms per new group on a 60-minute
talk; now ~15 ms. `releaseOld` frees audio whose plan left the window (it used to skip them: a leak).
`audioKeysForVideo` still plans the whole video, on purpose (forget-audio needs every key).

`tick` is the 50ms main loop. It splits into `tickLive` (Web Speech, no buffer) and `tickBuffer`
(prerendered timeline). A seek is detected in `tick` as `t < lastT - 0.3 || t > lastT + 2.5` and
calls `hardReset`, which drops queued speech, renders a tiny first batch (`warmup`), and re-anchors.
`cancelObsoleteJobs` deliberately lets jobs that are nearly done finish, because aborting a Gemini
call still bills for it.

**Viewer cap (1.6.6).** `settings.maxRate` (storage `dubMaxRate`) is the one user override of this
block: when set, `userMaxRate()` clamps `ceiling`, `lagCeiling` and the final rate, even below a
slow voice's floor rate. The voice then falls behind instead of rushing; it never drops words.

## The three TTS providers

Selected by the `dubProvider` setting. `createVieneuProvider` / `createGeminiProvider` /
`createWebSpeechProvider` in `dub-engine.js`.

### VieNeu local (default, free)

Config is centralized in `cost-policy.js` `LOCAL_TTS`: `http://127.0.0.1:8000`, model
`vieneu-v3-turbo`, 48 kHz (native), temperature 0.6, plus a 25-voice table with each voice's measured
syllables per second. The server is a user-run process outside this repo (`~/VieNeu-TTS`, started
with `cst-start.command`).

Engine sends `{ action: "synthesizeSpeech", engine: "vieneu", text, voice, jobId, parts: [{ key,
weight }], maxPause }`. `background.js` probes `/health` and `/v1/models` (`handleLocalTtsStatus`),
and calls the OpenAI-compatible
`POST /v1/audio/speech` with `{ model, voice, input, response_format: "pcm", sample_rate,
temperature }`.

**The server serves one request at a time.** `background.js` keeps a global priority queue
(`localSerial` / `localPump`) with an adaptive timeout and one retry. Its caps are
`{ serial: true, maxBatch: 1, free: true }`. Do not parallelize it.

First stop when there is no voice at all: `curl 127.0.0.1:8000/health`.

**Voice paces (1.5.9).** Every voice in `LOCAL_TTS.voices` now has a measured `sps`. Method, so it
can be redone: 3 lecture sentences per voice through `POST /v1/audio/speech` (pcm, 24 kHz), count
syllables over voiced 20 ms frames (energy within 38 dB of the peak), scale by 0.984 so the 4
voices measured earlier are reproduced (they were, within 4%). Needs the sandbox off for loopback.
`CST_COST.voiceLabel(v)` shows the pace (chậm < 4.4 <= vừa <= 5.2 < nhanh) in all three pickers.

**Pauses, hiss, sample rate (1.6.7).** Three causes of the voice stopping where the text has no
break, all fixed: `plainScript` no longer adds a comma at the source speaker's pauses (only after an
opener); `background.js` runs `AUDIO.shapePauses(piece, sr, text)` instead of `compressPauses`, which
matches every internal silence to the text's punctuation by position in voiced time, keeps
sentence 0.4 / clause 0.32 / comma 0.26 s (capped by `maxPause`, so tight mode still works), closes
every other stop to 0.09 s, and leaves one 0.16 s breath per 4.5 s of unpunctuated speech; and
`buildDubScript({ joinGroups })` (free voice only) reads a sentence that spans two translation groups
as one segment (a split made the model end the first half with a falling tone, then stop). Then
`AUDIO.gateNoise` (removed in 1.7.3, see below) pulled the gaps down 18 dB (Mỹ Duyên's reference hiss: gaps -52.8 -> -64.7 dB).
Requests are 48 kHz: Chrome's pitch-preserving time-stretch roughened a 24 kHz Thục Đoan copy much
more (roughest-decile harmonicity 0.700 -> 0.613 at 1.4x vs 0.669 -> 0.649 at 48 kHz). The server
ignores `speed`, so the browser stretch cannot be avoided. `LOCAL_STYLE_VERSION` 4: all VieNeu audio
re-renders once (free). Temperature 0.4 / 0.6 / 0.8 made no measurable difference to roughness.

**1.6.8 refinements.** Pause shaping v2: a comma's pause grows with the clause before it
(0.14 + 0.012 per word, capped 0.28), is 0.04 shorter before a joining word (và, nhưng, còn...),
and ? / ! rest a little longer (capped by `maxPause`). `gateNoise` now gates only frames within 6 dB
of the take's own noise floor (never above 30 dB under speech) with 60 ms hold: 1.6.7's fixed
threshold altered 2 to 4% of Thục Đoan's speech samples (clipped word tails), now 0 to 0.3%; Mỹ
Duyên's hiss drops 4 to 9 dB instead of 12. Free voices segment with `FREE_SEGMENTS` (`joinGroups`,
`segSoft` 8, `segHard` 11) so fewer sentences are cut into two utterances. `LOCAL_STYLE_VERSION` 5.

**Hiss removal (1.7.1).** `AUDIO.denoise` runs on the whole VieNeu take before it is cut: STFT
(1024 / hop 256 at 48 kHz), per-bin noise power = 20th percentile over frames x 1.6, decision-directed
Wiener gain (a-priori SNR smoothing 0.98) with a -12 dB floor and 3-bin smoothing (no musical noise).
A take with speech/floor over 50 dB is left alone (Thục Đoan ~58 to 60 dB: skipped; Mỹ Duyên ~40 to
41 dB: applied). Measured on Mỹ Duyên: stationary hiss down ~10 dB in the low and high bands, speech
energy change under 0.1 dB, harmonicity unchanged; ~140 ms per 10 s take in the service worker.
Pause shaping measured on 8 Mỹ Duyên sentences with , ; : ? ! : 14/14 punctuation marks matched a
pause, 6 unpunctuated stops closed. `LOCAL_STYLE_VERSION` 6.

**Cleanup and pauses v3 (1.7.2).** Measured on 17 test sentences x 4 takes (Mỹ Duyên x2, Thục
Đoan, Thái Sơn). What the VieNeu path now does, in `splitTtsAudio` order:
`AUDIO.cleanTake` = `highPass` (4th-order Butterworth, `LOCAL_TTS.highPassHz` 80 Hz female / 60 Hz
male, picked by `localHighPass(voice)`) then `denoise`; per piece `shapePauses` then `prepareSpeech`.
- Rumble: Mỹ Duyên's reference carries 20 to 150 Hz noise at almost the same level under the words
  as in the pauses; her voice has nothing under ~130 Hz. 20-60 Hz vs 200-1000 Hz: -45 -> -61 dB.
  Speech bands above 125 Hz unchanged; Thái Sơn loses 0.09 dB at 80-100 Hz.
- Hiss estimate: 1.7.1's 20th percentile x 1.6 per bin sat ~4.5 dB under the true noise, so the
  1-4 kHz hiss between words came down only ~2 dB (4-12 kHz ~4 dB). Now the mean over frames that
  are pure hiss (>= 20 dB under speech, within 6 dB of their median), bias 1.3: gaps -8.5 dB at
  1-4 kHz, -9.6 dB at 4-12 kHz; fricatives 0.0 dB, loud speech -0.1 dB, weak word tails -1.2 dB
  (was -0.7). Flaring-bin index in the gaps 14.6 -> 10.6 (raw 9.7). 97 -> 75 ms per take.
- The gate (`gateNoise`) is off the path: after the fix it took only ~1.5 dB more off the gaps and
  made the floor rise and fall with the words. Removed in 1.7.3.
- Pauses: `textBreaks` adds soft breaks before clause openings (`STARTERS2`, `STARTERS1`, weak "và"
  / "hoặc") when the clause before has >= 5 words (6 for weak) and >= 3 (4) follow. Only a real
  stop of the voice (>= 0.12 s) near one keeps 0.1 + 0.008 per word (max 0.2); the voice stopped
  there on every clause opening of the test set, and 1.7.1 closed those stops to 0.09 s, the
  run-on reading. A full stop rests 0.28 + 0.01 per word of its sentence (cap 0.4), ? +0.05, !
  +0.03, never past `maxPause`. Positions count spoken syllables (`spokenWeight`) from the first to
  the last sound (the lead silence used to push a first-word comma out of tolerance). Breaths only
  at stops >= 0.2 s. Durations: -2.3% total on the 130 s lecture (shorter sentence pauses).
- Onset: a take whose first 5 ms is already voiced (Thái Sơn 14/17, Thục Đoan 5/17, Mỹ Duyên 0/34)
  gets a 20 ms fade-in instead of 8 ms.
- Engine: `gapAfter(plan)`: a part of a running sentence that ended on , ; : is followed after
  `SYNC.joinGapClause` 0.15 s (was 0: the comma's rest was trimmed away with the take's tail).
- Not changed, measured fine: loudness per take (LUFS sd 0.2 to 0.3 dB within a voice, -20.3 avg
  for all four), the soft clipper (10/68 takes touch it, added distortion under -56 dB), DC
  (< 1e-3), sample rate (48 kHz native, no resampling). No EQ: Mỹ Duyên's 2-8 kHz balance is within
  1.5 dB of Thục Đoan's. `LOCAL_STYLE_VERSION` 7.

### Gemini TTS (paid)

`POST` to `GEMINI_BASE` with `responseModalities: ["AUDIO"]` and a prebuilt voice name; the reply
carries `candidates[0].content.parts[].inlineData`. Several segments are synthesized in one call
and cut apart with `dub-audio.js` `splitBySilence`, then **persisted to cache before replying**, so
a service-worker death does not lose paid audio. A timeout marks plans failed with no retry,
because the call may already have been billed.

### Web Speech (fallback, free, live)

No buffer, so it runs the `tickLive` path. Quality and pacing control are much weaker.

## Cache (`cst-cache.js`)

IndexedDB database `cst-cache`, stores `tr` and `audio`, each with a separate `<store>_meta` store
so LRU touches do not rewrite the WAV blob. Falls back to an in-memory backend if IndexedDB is
unavailable.

Keys are SHA-256 over the content-determining fields only, **never the video id**, so identical
audio is reused across videos. The audio key includes the style version, model, voice, text,
intent, emphasis and a pace bucket.

Budgets: `tr` 30MB, `audio` 200MB; memory tier 400 entries for `tr`, 24 for `audio`. Eviction is
LRU plus version-mismatch victims, down to 85% of the cap. A single item larger than half the cap
is not stored. Reads time out at 1500ms and writes at 3000ms, degrading to a cache miss rather than
blocking playback. `dubbing.js` keeps a small page-side mirror; per-video purge goes through
`audioKeysForVideo`.

## Testing dubbing without a video

`tests/dub-sim.js` gives you a virtual clock plus fake video, audio and speech objects, so a
20-minute video simulates in milliseconds and deterministically. `tests/dub.test.js` and
`tests/cost.test.js` use it. Real-audio checks use the WAV fixtures in `tests/audio/`. For a real
`HTMLAudioElement`, open `tests/harness/dub.html` in Chrome. See `TESTING.md`.
