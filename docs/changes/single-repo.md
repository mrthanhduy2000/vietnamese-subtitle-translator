# One GitHub repo for dev and friends' installs

The share repo `dich-phu-de-long-tieng` is folded into `vietnamese-subtitle-translator`, which is now
public. The friends' build lives on the `share` branch (`share-staging` for the install test), and
the installers and `dichphude-update.py` read that branch by default. `publish-share.js` builds into
`../vietnamese-subtitle-translator-share` and pushes `share`/`share-staging` instead of `main`/`staging`.

Friends on the old build still update from `dich-phu-de-long-tieng`: a bridge build there carries the
new updater, which then reads this repo's `share` branch. That repo is deleted only after they moved.

The VieNeu model release (`vieneu-model-61b85e3-ceff0d0`, about 560 MB of assets) stays on
`dich-phu-de-long-tieng` for now. `tools/share/vieneu-model.json` keeps pointing there, so that repo
cannot be deleted until the release is copied here.
