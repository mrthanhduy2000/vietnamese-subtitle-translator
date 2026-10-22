// Reload the unpacked extension from a session (2.7.2, docs/TESTING.md): what the Reload button at
// chrome://extensions does, so changed service-worker code is live for a harness run. Puts dubbing
// back first if a yt-driver run was interrupted (its ytDriverDub key), since the reload closes it.
(async () => {
    const left = (await chrome.storage.local.get("ytDriverDub")).ytDriverDub;
    if (left && left.restore) {
        await chrome.storage.sync.set({ dubEnabled: left.value });
        await chrome.storage.local.remove("ytDriverDub");
    }
    setTimeout(() => chrome.runtime.reload(), 200);
})();
