# Site adapters and TED (lane A, content.js hook of 3 lines)

- New `site-adapters.js`: small extension point for sites whose captions are not a `<track>`.
  Parses WebVTT and HLS subtitle playlists, adds the captions to the `<video>` as TextTracks so the
  generic pipeline is unchanged. `content.js` only calls `CST_SITES.prepare()` before `pickBestTrack()`.
- New `site-ted.js`: ted.com/talks pages, English (plus Vietnamese if offered).
- `tests/site-adapters.test.js`: offline, sample page data and playlists.
- Not seen on a live page; try on Chrome (see HANDOFF). No version bump: the release thread collects this.
