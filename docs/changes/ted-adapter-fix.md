# TED adapter fix (found on a live talk)

- The stream is in `videoData.videoPlayerData.resources.hls.stream` (also `videoData.hlsUrl`), not `playerData`.
- HLS subtitle playlists have a 3.504 s lead-in before `#EXT-X-DISCONTINUITY`; cue times restart after it,
  so `loadHlsVtt` now adds the elapsed time before each discontinuity (`parseHlsTimeline`).
- No version bump: the release thread collects this.
- ted.com added to the content-script matches; `csAdapterSite()` lets `courseraAutoTranslate` run on adapter sites, so TED talks translate (and voice) on arrival. Not seen live: needs the Mac check.

## Second round (Mac check on a live talk)
- `pageTracks` returns only the adapter's `Site: ...` tracks when present: the player's own English track fills while the talk plays, and translating it left everything after ~35 s untranslated.
- `loadHlsVtt` drops cues repeated at HLS segment boundaries (19 of 204 on the checked talk).
- Moving to another talk without a reload: `site-ted.js` uses the DOM `__NEXT_DATA__` only if it names the current slug, else fetches the talk's HTML; tracks of the previous talk are marked `cstStale`; `courseraAutoTranslateNow` prepares the adapter before picking a track.
- Vietnamese overlay not showing was seen only with the half-loaded track; recheck after this.
