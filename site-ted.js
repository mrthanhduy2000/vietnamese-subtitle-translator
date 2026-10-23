// TED adapter (ted.com/talks/...): the talk's captions are WebVTT renditions of its HLS stream.
// The page embeds Next.js data: props.pageProps.videoData.playerData (a JSON string) whose
// resources.hls.stream is the master playlist. Written from the public page structure, not yet seen
// live (see docs/HANDOFF.md).
(function () {
    "use strict";
    const S = (typeof window !== "undefined" ? window : globalThis).CST_SITES;
    if (!S) return;

    function hlsStream(doc) {
        const el = doc.getElementById("__NEXT_DATA__");
        if (!el) return "";
        let data = JSON.parse(el.textContent);
        let pd = data && data.props && data.props.pageProps && data.props.pageProps.videoData
            && data.props.pageProps.videoData.playerData;
        if (typeof pd === "string") pd = JSON.parse(pd);
        const hls = pd && pd.resources && pd.resources.hls;
        return (hls && hls.stream) || "";
    }

    S.register({
        id: "ted",
        match: loc => /(^|\.)ted\.com$/.test(loc.hostname) && /^\/talks\//.test(loc.pathname),
        async sources(doc, env) {
            const stream = hlsStream(doc);
            if (!stream) return [];
            const subs = S.parseHlsSubtitles(await env.fetchText(stream), stream);
            return subs.map(s => ({ lang: s.lang, label: s.name, load: () => S.loadHlsVtt(s.uri, env.fetchText) }));
        },
    });
})();
