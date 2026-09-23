# Dubbing (lồng tiếng)

Line numbers drift. Grep the function name.

**Rule that overrides everything here: never condense, shorten or summarize a line.** If Vietnamese
speech does not fit its slot, the allowed levers are speech rate, trimming pauses inside the
sentence, chaining sentences together, and accepting a small lag. `condense` is set to `null` in
`dubbing.js` on purpose. The condense machinery (`needsCondense`, `condenseBeforeTts`, the
`condenseSpeech` service-worker action) still exists but must stay unused.

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

- **Drift**: `driftCorrect` 0.15s re-seeks the audio. `driftNudge` 0.035 / `nudgeMax` 0.05 apply an
  inaudible rate nudge for small drift instead of a jump.
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
  a slow speaker (timeline x1.35) unchanged. Harness: `scratchpad/sim-kim.js` pattern, see
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

`tick` is the 50ms main loop. It splits into `tickLive` (Web Speech, no buffer) and `tickBuffer`
(prerendered timeline). A seek is detected in `tick` as `t < lastT - 0.3 || t > lastT + 2.5` and
calls `hardReset`, which drops queued speech, renders a tiny first batch (`warmup`), and re-anchors.
`cancelObsoleteJobs` deliberately lets jobs that are nearly done finish, because aborting a Gemini
call still bills for it.

## The three TTS providers

Selected by the `dubProvider` setting. `createVieneuProvider` / `createGeminiProvider` /
`createWebSpeechProvider` in `dub-engine.js`.

### VieNeu local (default, free)

Config is centralized in `cost-policy.js` `LOCAL_TTS`: `http://127.0.0.1:8000`, model
`vieneu-v3-turbo`, 24kHz, temperature 0.6, plus a 25-voice table with each voice's measured
syllables per second. The server is a user-run process outside this repo (`~/VieNeu-TTS`, started
with `cst-start.command`).

Engine sends `{ action: "synthesizeSpeech", engine: "vieneu", text, voice, jobId, parts: [{ key,
weight }], maxPause }`. `background.js` probes `/health` and `/v1/models` (`handleLocalTtsStatus`),
warms the model (`handleLocalTtsWarm`), and calls the OpenAI-compatible
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
