# Weak machines: a slow voice says so and suggests a playback speed

Lane: B (dubbing) + D (installer, CI). Runtime files changed: `dub-hardware.js` (new, loaded by `manifest.json`
before `dubbing.js` and by `options.html`), `dubbing.js`, `options.js`, `tools/share/install-mac.sh`.

User-visible (Vietnamese, for the release notes):
- When the local voice needs 0,8 s or more to make 1 s of speech, a toast says so and offers the video speed the
  voice can keep up with (0,8 / rtf in steps of 0,05, e.g. 0,6× at 1,3 s). One click sets it. Simulated, rtf 1.3:
  8 lines dropped at normal speed, 1 at 0,75×.
- Settings shows the machine (Mac chip Intel or Apple, cores) beside the measured voice speed.
- The Mac installer reads the real chip: a Terminal under Rosetta on an Apple chip is no longer treated as Intel.
  Intel Mac voice is opt-in with `DPD_INTEL_VOICE=1`, still unofficial.

Not changed on purpose: `SYNC` (a shorter look-ahead made no difference at any rtf in the sim, see
`DUBBING.md` "A weak machine").
Measured (intel-voice run): VieNeu works on Intel after pinning `onnxruntime<1.24`, rtf 1.5-1.8 on a 4-core runner, so about 0,5× playback is advised there.
Needs a human: hear it on a real Intel Mac before making Intel voice the default.
