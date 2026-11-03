# Continuous video with complete speech (3.1.7)

The user chose continuous source playback with delayed Vietnamese speech rather than automatic
video holds. The extension therefore sets DubEngine `keepAllSpeech: true`. The engine's bare
compatibility default retains the previous skip policy for existing embedders/tests; production
DUB.start, the playback simulator and current live/listening harnesses explicitly use the new policy.
No new storage setting is needed, and the source playback rate is never changed by this policy.

## Queue contract

- Anchor the entry to the user's start/seek time. A late first take does not enter further into its
  audio just because synthesis took time. An intentional seek can still enter at a clean gap.
- Read every valid queued plan in source order, even beyond the former 8-second lag bound.
  Wait for overdue audio rather than skip ahead; an explicitly pending earlier translation blocks
  later speech. Actual synthesis failures remain reported and can release a blocked queue.
- Retain unspoken plans/audio across planning windows, eviction and ordinary job cleanup.
  Prepare audio near the next speech cursor, not the distant video playhead. Advance the render
  horizon across source silences, so a long gap cannot stall the FIFO indefinitely.
- Natural source end drains remaining speech on an incremental wall-clock timeline. Playback-rate
  changes do not jump that timeline. Ordinary manual pause still silences speech; seeking, changing
  videos or disabling dubbing abandons the old queue. Autoplay navigation also changes videos.
- Ads pause speech and preserve its cursor; returning to the same source position restores backlog
  and the interrupted take, including its final syllable. A source-position change resets entry.
- Web Speech fallback follows the same phrase order. Pacing ceilings, max-rate setting, speech text
  and audio-cache identity are unchanged. Full speech can remain noticeably behind dense sources.
- Health distinguishes pending translation, delayed complete speech, synthesis errors and reading
  the final tail. The source video is not automatically paused to catch up.

## Real-source listening evidence

Use the same three downloaded sources and 28 Kim Thanh WAV takes documented in REAL_VIDEO_ONSET.md.
For this study both engines are capped at 1x and the original source clock really ends at 50 s.
This is a controlled natural-pace stress check, not the earlier automatic-rate protocol. The old
engine is 3.1.6, the new one 3.1.7; plan text and source/take hashes match exactly.

| Source interval | Whole takes completed, old / new | Engine lag drops, old / new | New speech tail after source end |
|---|---|---|---|
| 6QULfp2wdZI 465-515 s | 3/4 / 4/4 | 1 / 0 | none |
| JBvcMfa7K6E 90-140 s | 5/7 / 7/7 | 1 / 0 | 13.11 s |
| yZfhCQwCWT4 120-170 s | 12/17 / 17/17 | 3 / 0 | 23.75 s |

All 28 takes finished in the new engine versus 20 in the old engine, with zero overlap or engine
errors in either version. Increased delay is the selected tradeoff, not a hidden regression.
At a 1x ceiling the dense conversation reaches ~24.66 s onset delay by the final tail. The Russian
caption/content mismatch remains a separate source-quality issue; this change does not repair it.

`real-onset.html` records acoustic onsets (PCM peak >0.003 every 10 ms), ended events and a mixed
source/Vietnamese track. The old generic paused-sound counter includes natural EOF; this protocol
has no manual pause steps, so those counts are explicitly classified as natural-end sound in the
measurement report. Unit tests separately cover manual pause, seek, long gaps, missing audio,
planning windows, ads, live fallback, failures and EOF clock continuity. No subjective listening
judgment or full-video source-meaning alignment is claimed.

Numeric results and input hashes: [complete-speech-2026-11-03.json](measurements/complete-speech-2026-11-03.json).
Local recordings remain ignored under `tests/harness/smooth/real-video/`. The current listening
page presents original audio and both full recordings; the earlier automatic-rate study remains
in its history folder. No new paid translation or voice requests were used.

## Saved-video regression

All 145 saved videos under the actual continuous-speech simulator policy, LATENCY=busy, queue
drained before word accounting: missing words 16 -> 0, repeated words 0 -> 0, lag drops 1 -> 0.
All 145 finish without new missing/repeated words, cuts or hard starts. Plan count 17,952 -> 17,949
reflects different retained plan boundaries, not shortened text. Late starts 2,243 -> 2,281 are
accepted because valid lines are now read instead of discarded. Corpus numbers are token/timeline
simulation evidence, not human verification of the original captions or every synthesized word.

The standard 45-video/24-scenario comparison moved 141 numbers, including 61 worse metrics:
31 late-start, 7 gap-count, 7 gap-duration, 5 max-gap, 6 peak-URL, 2 mean seek-recovery,
2 max seek-recovery and 1 plan-count measurements. Every worse metric is explained in the linked
machine-readable report. The FIFO can wait longer for synthesis and retain more audio; source
speed and rate ceilings are unchanged. New and repeated-word/cut/overlap counters stay zero.
Scenario drops 19 -> 0; late starts 76 -> 138 and gaps 20.34 -> 39.62 s are the selected tradeoff.
The new baseline is saved only after this policy interpretation, not labeled "zero worse".

[Corpus totals](measurements/complete-speech-corpus-2026-11-03.json) ·
[Every accepted regression](measurements/complete-speech-regression-2026-11-03.json).
