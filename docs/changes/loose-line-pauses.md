# Loose lines hand spare time to their own pauses (BACKLOG 48; lane B, background.js passes it on)

- A Vietnamese line much shorter than its slot, read at the floor pace (`minSps` 4.0), ended early and
  the voice fell silent while the speaker still talked. When such a line would end 1 s or more early,
  its take now asks for longer pauses at its own punctuation marks (`SYNC.slackFrom/Keep/Step/Max`,
  `dub-prosody.js` `pauseSlack`, `dub-audio.js` `shapePauses` `opts.slack`): sentence +0.4 s at most,
  `;`/`:` +0.3, comma +0.25, list or opener comma +0.08/+0.1. No word is dropped or added, the speech
  rate is unchanged. Each 0.25 s step has its own audio store key; the first decision for the same
  words sticks for the page's life, so a rewind or a repeated sentence still hits the store.
- The line after a loose one picks its own pace (`slackFreesPace`), as it did when the loose line
  ended a full pause earlier.
- Simulator, 101 saved videos, 11,853 lines, Mỹ Duyên 3.8 syl/s, off -> on: silences >= 1.5 s while the
  source talks 1,439 (3,424 s) -> 1,260 (2,923 s); late starts > 0.5 s 1,603 -> 1,580 (> 2 s 207 -> 193);
  lag 2,450 -> 2,404 s; pace jumps 82 -> 96 of ~8,000 close pairs; server requests 11,749 -> 11,749.
  Per video: 56 fewer silences, 1 one more (qhUAdMGsZ5k 17 -> 18), 28 the same, 16 had none.
  `regress.js` (45 videos): late 1,499 -> 1,482, one video +1 late, scenarios unchanged.
- Not heard yet: A/B takes in `/private/tmp/claude-501/b48-ab-samples` once rendered on the Mac. Old
  stored takes stay valid; a loose line is made once more the first time it is met.
- No version bump: the release thread collects this.
