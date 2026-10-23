// TED adapter (ted.com/talks/...): the talk's captions are WebVTT renditions of its HLS stream.
// The page embeds Next.js data: props.pageProps.videoData.playerData (a JSON string) whose
// resources.hls.stream is the master playlist. Checked against a live talk page; captions are offset by the
// HLS timeline (see loadHlsVtt).
(function () {
    "use strict";
    const S = (typeof window !== "undefined" ? window : globalThis).CST_SITES;
    if (!S) return;

    const asObject = v => { if (typeof v === "string") { try { return JSON.parse(v); } catch (e) { return null; } } return v || null; };

    // Live page (checked on a real talk): videoData.videoPlayerData.resources.hls.stream, also
    // videoData.hlsUrl. Older pages carried the same JSON as videoData.playerData.
    function hlsStream(doc) {
        const el = doc.getElementById("__NEXT_DATA__");
        if (!el) return "";
        const data = JSON.parse(el.textContent);
        const vd = data && data.props && data.props.pageProps && data.props.pageProps.videoData;
        if (!vd) return "";
        for (const key of ["videoPlayerData", "playerData"]) {
            const pd = asObject(vd[key]);
            const stream = pd && pd.resources && pd.resources.hls && pd.resources.hls.stream;
            if (stream) return stream;
        }
        return vd.hlsUrl || "";
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
