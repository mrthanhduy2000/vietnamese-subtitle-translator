# Retry when the service worker was asleep (content.js, dubbing.js; lane A/B)

Chrome stops the service worker after ~30 s idle; the first message can fail with "Receiving end does
not exist" or "message port closed". `sendMessageAsync` (content.js) now retries twice (250 ms, 1 s) on
those errors and never on "Extension context invalidated" (needs a page reload) or a real error from
the worker. `dubbing.js` `sendMessage` retries only "receiving end does not exist" (message not
delivered), not a closed port, so paid synthesis is not repeated. Test: `tests/sw-lifecycle.test.js`.
Also: youtube.js readScreenText no longer throws out of the read loop on a dead context (skips the frame). Not done: options.js callers (page is open, worker wakes on send) and the multi-tab port audit.
