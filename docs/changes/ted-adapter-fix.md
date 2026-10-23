# TED adapter fix (found on a live talk)

- The stream is in `videoData.videoPlayerData.resources.hls.stream` (also `videoData.hlsUrl`), not `playerData`.
- HLS subtitle playlists have a 3.504 s lead-in before `#EXT-X-DISCONTINUITY`; cue times restart after it,
  so `loadHlsVtt` now adds the elapsed time before each discontinuity (`parseHlsTimeline`).
- No version bump: the release thread collects this.
