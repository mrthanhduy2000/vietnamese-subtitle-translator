// ============================================================
// NHẬN DIỆN NGÔN NGỮ PHỤ ĐỀ NGAY TRÊN MÁY (không gọi Gemini chỉ để nhận diện)
//
// Thứ tự tin cậy:
//   1. thông tin của chính track phụ đề (mã ngôn ngữ YouTube / thuộc tính srclang)
//   2. thông tin trang / video đáng tin (ví dụ track phụ đề tự động = ngôn ngữ đang nói)
//   3. nhận diện từ mẫu nội dung phụ đề (chữ viết + từ thông dụng)
// Nếu mẫu nội dung chắc chắn MÂU THUẪN với thông tin track (track gắn nhãn sai) thì tin mẫu.
// Độ tin cậy thấp -> KHÔNG tự động dịch (người dùng vẫn bấm dịch tay được).
// ============================================================
(function (root) {
    "use strict";

    // Chữ cái chỉ tiếng Việt dùng (loại á à é è... vì tiếng Pháp/Tây Ban Nha/Bồ Đào Nha cũng có).
    // Not ã (Portuguese "não", "então") nor ă (Romanian "să"): with them a Portuguese lecture read as
    // Vietnamese at 0.94 and was skipped, every line returned untranslated
    const VI_ONLY = /[đơưạảằắẳẵặầấẩẫậẹẻẽềếểễệỉĩịọỏồốổỗộờớởỡợụủừứửữựỳỷỹỵ]/gi;
    const SCRIPTS = [
        ["ko", /[가-힯ᄀ-ᇿ㄰-㆏]/g],
        ["ja", /[぀-ヿ]/g],
        ["zh", /[一-鿿]/g],
        ["ru", /[Ѐ-ӿ]/g],
        ["th", /[฀-๿]/g],
        ["ar", /[؀-ۿ]/g],
        ["he", /[֐-׿]/g],
        ["hi", /[ऀ-ॿ]/g]
    ];
    const STOP = {
        en: "the and of to is that it you we this in for are with on be have as not but they what can so if or at by from your there will just about one all do an was which how when our",
        es: "el la de que y en los se del las un por con no una para es lo como pero sus al más esto muy también",
        fr: "le la les de des et est un une que qui dans pour pas ce il vous nous sur avec plus ne au du",
        de: "der die das und ist nicht ein eine zu den mit sich auch auf für es wir sie ich dem von",
        pt: "o a os de que e do da em um para é com não uma se na no mais as dos como mas",
        id: "yang dan di ini itu dengan untuk tidak dari dalam ada akan kita saya juga ke bisa kami",
        it: "il di che e la per un non sono una le del della si con ma anche questo come",
        vi: "va la cua nhung khong duoc cac mot trong nay cho voi thi da se nguoi chung toi ban"
    };
    const STOP_SETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(" "))]));

    // "en-US", "en", "a.en" (YouTube tự động), "zh-Hans", "iw" (mã cũ của tiếng Do Thái)
    function normCode(code) {
        const c = String(code || "").trim().toLowerCase().replace(/^a\./, "");
        if (!c) return "";
        const base = c.split(/[-_]/)[0];
        return { iw: "he", in: "id", jw: "jv", fil: "tl" }[base] || base;
    }

    function detectText(text) {
        const t = String(text || "").replace(/\[[^\]]*\]|\([^)]*\)|https?:\S+|\d+/g, " ");
        const letters = (t.match(/\p{L}/gu) || []).length;
        if (letters < 20) return { lang: "unknown", confidence: 0 };
        for (const [lang, re] of SCRIPTS) {
            const n = (t.match(re) || []).length;
            const ratio = n / letters;
            // Tiếng Nhật dùng cả chữ Hán: chỉ cần có kana là tiếng Nhật
            if (lang === "ja" && ratio > 0.08) return { lang, confidence: Math.min(0.98, 0.75 + ratio) };
            if (lang !== "ja" && ratio > 0.3) return { lang, confidence: Math.min(0.98, 0.6 + ratio * 0.4) };
        }
        const vi = (t.match(VI_ONLY) || []).length / letters;
        if (vi > 0.025) return { lang: "vi", confidence: Math.min(0.99, 0.75 + vi * 4) };
        const words = t.toLowerCase().match(/\p{L}+/gu) || [];
        if (words.length < 5) return { lang: "unknown", confidence: 0 };
        const scores = Object.entries(STOP_SETS)
            .map(([lang, set]) => [lang, words.filter(w => set.has(w)).length / words.length])
            .sort((a, b) => b[1] - a[1]);
        const [best, second] = scores;
        if (best[1] < 0.08) return { lang: "unknown", confidence: 0.2 };
        const margin = best[1] - second[1];
        const confidence = Math.max(0, Math.min(0.97, 0.35 + best[1] * 1.2 + margin * 1.5));
        return { lang: best[0], confidence };
    }

    // meta: mã ngôn ngữ của track / video; sample: vài chục dòng phụ đề
    // Trả về { lang, confidence, source, action: "translate" | "skip" | "unsure" }
    function decide({ metaLang, sample, minConfidence = 0.7 } = {}) {
        const meta = normCode(metaLang);
        const det = sample ? detectText(sample) : null;
        let lang = "unknown", confidence = 0, source = "none";
        if (meta && det && det.lang !== "unknown" && det.lang !== meta && det.confidence >= 0.85) {
            lang = det.lang; confidence = det.confidence; source = "sample";          // track gắn nhãn sai
        } else if (meta) {
            lang = meta; confidence = det && det.lang === meta ? 0.98 : 0.9; source = "metadata";
        } else if (det) {
            lang = det.lang; confidence = det.confidence; source = "sample";
        }
        let action = "translate";
        if (lang === "vi" && confidence >= 0.5) action = "skip";                     // tiếng Việt: không dịch
        else if (lang === "unknown" || confidence < minConfidence) action = "unsure";
        return { lang, confidence, source, action };
    }

    // The language actually SPOKEN in a YouTube video, from the strongest signal available:
    //   1. the original (not auto-dubbed) audio track the player reports       -> "audio"
    //   2. the one auto-caption (ASR) track = YouTube's own reading of speech   -> "asr"
    //      several ASR tracks (one per AI-dubbed audio): the one whose language is not a dub,
    //      else the one matching the title's language                             -> "asr+title"
    //   3. no ASR at all: a title + description written in Vietnamese, unless it says the video is
    //      a translation ("Vietsub", "thuyết minh", ...)                           -> "title"
    // Measured 2026-09-26 on 3lY0eRQhYkY (Vietnamese news): audio "vi.4" original + "en-US.10"
    // auto-dubbed, and the English ASR of the dub listed FIRST, which made the old "first ASR track"
    // rule call the video English and translate YouTube's English dub back into Vietnamese.
    const TRANSLATED_MARK = /vietsub|viet\s*sub|thuy[eế]t\s*minh|l[oồ]ng\s*ti[eế]ng|ph[uụ]\s*đ[eề]\s*vi[eệ]t|engsub|eng\s*sub/i;
    // Which ASR tracks transcribe one of YouTube's AI dubs. YouTube marks those URLs with
    // "variant=timing-optimized" (2026-10-19, qSlxe4hA66g: 20 of 21 ASR tracks carry it; the one
    // without, Korean, is the original speech, while a Korean dub exists too). When any track has the
    // mark, the mark decides; without one (older responses, test fixtures) an ASR track in a dubbed
    // language counts as a dub transcript, as before.
    const DUB_VARIANT = /[?&]variant=timing-optimized(?:&|$)/;
    function dubTranscripts(tracks, audio) {
        const list = tracks || [];
        const dubbed = new Set(((audio && audio.tracks) || []).filter(t => t.isAutoDubbed).map(t => normCode(t.lang)));
        const marked = list.some(t => t.kind === "asr" && DUB_VARIANT.test(t.baseUrl || ""));
        return new Set(list.filter(t => t.kind === "asr" &&
            (marked ? DUB_VARIANT.test(t.baseUrl || "") : dubbed.has(normCode(t.languageCode)))));
    }

    function spokenLanguage({ audio, tracks, title, description } = {}) {
        const a = audio || {};
        const list = tracks || [];
        // YouTube's own transcript of the original audio, told apart from the dubs' by their mark:
        // what its recogniser heard beats the uploader's audio label (qSlxe4hA66g is labelled en-US
        // and spoken in Korean up to 17:30)
        if (list.some(t => DUB_VARIANT.test(t.baseUrl || ""))) {
            const dubs = dubTranscripts(list, a);
            const own = list.filter(t => t.kind === "asr" && !dubs.has(t));
            if (own.length === 1) return { lang: normCode(own[0].languageCode), confidence: 0.96, source: "asr-original" };
        }
        if (a.original) return { lang: normCode(a.original), confidence: 0.97, source: "audio" };
        const dubbed = new Set((a.tracks || []).filter(t => t.isAutoDubbed).map(t => normCode(t.lang)));
        const asr = list.filter(t => t.kind === "asr");
        const meta = [title, description].filter(Boolean).join(" ");
        const titleDet = meta && !TRANSLATED_MARK.test(meta) ? detectText(meta) : { lang: "unknown", confidence: 0 };
        if (asr.length === 1) return { lang: normCode(asr[0].languageCode), confidence: 0.95, source: "asr" };
        if (asr.length > 1) {
            const notDub = asr.filter(t => !dubbed.has(normCode(t.languageCode)));
            if (notDub.length === 1 && dubbed.size) return { lang: normCode(notDub[0].languageCode), confidence: 0.93, source: "asr" };
            const byTitle = titleDet.confidence >= 0.8 && asr.find(t => normCode(t.languageCode) === titleDet.lang);
            if (byTitle) return { lang: titleDet.lang, confidence: 0.85, source: "asr+title" };
            return { lang: normCode(asr[0].languageCode), confidence: 0.5, source: "asr" };
        }
        if (titleDet.lang === "vi" && titleDet.confidence >= 0.9) return { lang: "vi", confidence: 0.8, source: "title" };
        return { lang: "unknown", confidence: 0, source: "none" };
    }

    // The viewer is listening to YouTube's own AI dub in Vietnamese (the original is another
    // language): they already hear Vietnamese, so our subtitles and our voice would only double it.
    function hearsVietnameseDub(audio) {
        return !!(audio && audio.currentDubbed && normCode(audio.current) === "vi" && normCode(audio.original) !== "vi");
    }

    // (2.7.9) A machine transcript that heard nothing usable: mostly dots and digits, or tagged with a
    // language of its own script and written in none of it. YouTube tagged a Tamil-English street
    // interview "ko (auto)": its 413 lines were ". 5 - 6", "HFC B", "ook", and the uploaded English
    // track went unused, every window came back with empty items and the video was never saved.
    // Judged on the first lines, notes and numbers out. { broken, why }
    const SCRIPT_OF = { ko: "ko", ja: "ja", zh: "zh", ru: "ru", uk: "ru", bg: "ru", sr: "ru", mk: "ru", be: "ru", kk: "ru", th: "th", ar: "ar", fa: "ar", ur: "ar", he: "he", hi: "hi", mr: "hi", ne: "hi" };
    function brokenTranscript(code, text) {
        const t = String(text || "").replace(/\[[^\]]*\]|\([^)]*\)|https?:\S+/g, " ");
        const chars = (t.match(/\S/gu) || []).length;
        const letters = (t.match(/\p{L}/gu) || []).length;
        if (chars < 60) return { broken: false, why: "" };
        if (letters / chars < 0.5) return { broken: true, why: "no-words" };
        const want = SCRIPT_OF[normCode(code)];
        if (want && letters >= 40) {
            const re = SCRIPTS.find(([l]) => l === want)[1];
            const own = (t.match(re) || []).length + (want === "ja" ? (t.match(/[一-鿿]/g) || []).length : 0);
            if (own / letters < 0.2) return { broken: true, why: "wrong-script" };
        }
        return { broken: false, why: "" };
    }

    // A transcript that heard almost nothing: a long video whose captions hold sound notes and a
    // handful of scattered words. YouTube's Arabic machine transcript of a Pashto/Dari documentary
    // (14.5 min) held 35 lines, 21 of them "[موسيقى]" and about 19 words in all (~6 letters of
    // speech a minute): the button showed on, the menu "6/29 translated" and the screen nothing,
    // with no word of why. Letters of speech (sound notes, (...), music signs, ">>" out) per minute
    // of the video, from minMinutes on. The 133 saved videos: median 775 a minute; 6 under 30, all
    // music-only or misheard (0, 0, 0, 3, 17, 21 a minute: "[Music]", "oh all m a", "mahaarunuusumusum",
    // "Foreign! Foreign speech"); the lowest above is 46. The notice only explains: what little there
    // is still gets translated. { sparse, letters, perMinute }
    const SPARSE = { minMinutes: 2, perMinute: 30 };
    function sparseTranscript(texts, seconds) {
        const t = (texts || []).join(" ").replace(/\[[^\]]*\]|\([^)]*\)|[♪♫]|>>/g, " ");
        const letters = (t.match(/\p{L}/gu) || []).length;
        const minutes = (Number(seconds) || 0) / 60;
        if (!(minutes >= SPARSE.minMinutes)) return { sparse: false, letters, perMinute: null };
        const perMinute = letters / minutes;
        return { sparse: perMinute < SPARSE.perMinute, letters, perMinute: Math.round(perMinute) };
    }

    // Can the voice read a site's own Vietnamese captions? Only when the page also offers captions in
    // another language: that is the sign the speech is not Vietnamese. A Vietnamese-only page is
    // taken as a Vietnamese video, which gets no voice. langs: the language codes of the page's tracks.
    function viVoiceSource(langs) {
        const codes = (langs || []).map(normCode).filter(Boolean);
        const foreign = codes.filter(c => c !== "vi");
        return { offer: codes.includes("vi") && foreign.length > 0, spoken: foreign[0] || "" };
    }

    // Structural evidence is not a probability that captions match the audible speech.
    function assessSource(cues, { metaLang = '', spoken = '', asr = false, duration = 0 } = {}) {
        const rows = Array.from(cues || []).map(c => ({ start: Number(c.start ?? c.startTime), end: Number(c.end ?? c.endTime), text: String(c.text || '').replace(/<[^>]*>/g, '').trim() }));
        const signals = [], add = (code, level, detail) => signals.push({ code, level, detail });
        const texts = rows.map(c => c.text), text = texts.join(' '), letters = (text.match(/\p{L}/gu) || []).length;
        const isNote = text => /^\[(?:music|applause|laughter|âm nhạc|музыка)\]$/i.test(text);
        const speechRows = rows.filter(c => /\p{L}/u.test(c.text) && !isNote(c.text));
        const invalid = rows.filter(c => !isNote(c.text) && /[\p{L}\p{N}]/u.test(c.text) && (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start)).length;
        let reversed = 0, dense = 0, repeats = 0, short = 0;
        for (let i = 0; i < rows.length; i++) {
            const c = rows[i], words = c.text.toLowerCase().match(/\p{L}+/gu) || [];
            if (i && c.start < rows[i-1].start - 0.1) reversed++;
            if (c.end > c.start && words.length >= 5 && c.text.length / (c.end - c.start) > 90) dense++;
            if (words.length <= 2) short++;
            if (i && words.length >= 5 && c.text.toLowerCase() === rows[i-1].text.toLowerCase()) repeats++;
        }
        const n = Math.max(1, rows.length), valid = rows.filter(c => c.end > c.start && c.start >= 0);
        const lastEnd = valid.reduce((max, c) => Math.max(max, c.end), 0);
        const detected = detectText(speechRows.map(c => c.text).join(' ').slice(0, 12000));
        const broken = asr ? brokenTranscript(metaLang, rows.slice(0, 120).map(c => c.text).join(' ')) : { broken: false };
        if (!rows.length || !text.trim()) add('empty', 'error', 'Phụ đề nguồn không có nội dung.');
        if (invalid >= 3 && invalid / n > 0.25) add('invalid-timing', 'error', 'Nhiều dòng nguồn có mốc thời gian không hợp lệ.');
        else if (invalid || reversed >= 3) add('timing-warning', 'warning', 'Một số mốc thời gian nguồn sai hoặc đảo thứ tự.');
        if (broken.broken) add(broken.why, broken.why === 'wrong-script' ? 'warning' : 'error', broken.why === 'wrong-script' ? 'Chữ viết không khớp nhãn ngôn ngữ; chưa biết nhãn hay nội dung nguồn có vấn đề.' : 'Nguồn tự động gần như không có chữ đọc được.');
        if (asr && rows.length >= 20 && repeats / n > 0.6) add('repeat-loop', 'notice', 'Nguồn tự động lặp nguyên một câu dài liên tiếp bất thường.');
        if (rows.length >= 10 && dense / n > 0.3) add('dense-timing', 'warning', 'Văn bản nguồn quá dày so với thời gian hiển thị.');
        if (normCode(metaLang) && detected.lang !== 'unknown' && normCode(metaLang) !== detected.lang && detected.confidence >= 0.92 && letters >= 300 && !(SCRIPT_OF[normCode(metaLang)] && SCRIPT_OF[normCode(metaLang)] === SCRIPT_OF[detected.lang])) {
            add('language-label', 'notice', 'Nhãn ngôn ngữ và mẫu văn bản chưa nhất quán; có thể là phụ đề dịch hoặc nội dung trộn ngôn ngữ.');
        }
        const sparse = sparseTranscript(texts, Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : lastEnd);
        if (sparse.sparse) add('sparse', 'notice', 'Nguồn có rất ít chữ; chưa đủ căn cứ phân biệt video ít lời với nhận dạng thiếu.');
        if (asr && spoken && normCode(metaLang) && normCode(spoken) !== normCode(metaLang)) add('spoken-language', 'notice', 'Track khác ngôn ngữ tiếng nói được báo; chưa được đối chiếu âm thanh.');
        const errors = signals.filter(x => x.level === 'error').length, warnings = signals.filter(x => x.level === 'warning').length;
        return { status: errors ? 'unusable' : warnings ? 'suspect' : sparse.sparse ? 'limited' : 'unverified',
            integrityScore: Math.max(0, 100 - errors * 50 - warnings * 20), audioVerified: false, signals,
            metrics: { cues: rows.length, speechCues: speechRows.length, letters, invalidTiming: invalid, reversed,
                repeatRatio: repeats / n, denseRatio: dense / n, fragmentationRatio: short / n, perMinute: sparse.perMinute },
            language: { declared: normCode(metaLang), detected: detected.lang, evidence: detected.confidence },
            independentCheck: 'not-run' };
    }

    function compareSources(first, second, { firstLang = '', secondLang = '', independent = false } = {}) {
        const usable = cues => Array.from(cues || []).filter(c => Number.isFinite(c.start ?? c.startTime) && Number.isFinite(c.end ?? c.endTime) && (c.start ?? c.startTime) >= 0 && (c.end ?? c.endTime) > (c.start ?? c.startTime))
            .map(c => ({ start: c.start ?? c.startTime, end: c.end ?? c.endTime, text: String(c.text || '') }));
        const a = usable(first), b = usable(second);
        const langA = normCode(firstLang), langB = normCode(secondLang);
        const unknown = { status: 'unknown', agreement: null, independent, audioVerified: false };
        if (!langA || langA !== langB || !a.length || !b.length) return unknown;
        // Compare only temporally overlapping text. A track excerpt is not evidence about its full video.
        const extent = rows => rows.reduce((out, c) => ({ start: Math.min(out.start, c.start), end: Math.max(out.end, c.end) }), { start: Infinity, end: -Infinity });
        const ea = extent(a), eb = extent(b);
        const lo = Math.max(ea.start, eb.start), hi = Math.min(ea.end, eb.end);
        if (hi - lo < 5) return unknown;
        const join = rows => rows.filter(c => c.end > lo && c.start < hi).map(c => c.text).join(' ').toLowerCase();
        const ta = join(a), tb = join(b);
        if ((ta.match(/\p{L}/gu) || []).length < 80 || (tb.match(/\p{L}/gu) || []).length < 80) return unknown;
        const tokens = t => {
            const words = t.match(/[\p{L}\p{N}]+/gu) || [];
            // Character shingles support unspaced writing without imposing English token boundaries.
            if (words.length < 8) { const s = t.replace(/[^\p{L}\p{N}]/gu, ''); return new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3))); }
            return new Set(words);
        };
        if (Math.min(ta.length, tb.length) / Math.max(ta.length, tb.length) < 0.35) return unknown;
        const sa = tokens(ta), sb = tokens(tb), shared = [...sa].filter(x => sb.has(x)).length;
        const agreement = 2 * shared / Math.max(1, sa.size + sb.size);
        return { status: agreement < 0.15 ? 'conflict' : agreement >= 0.55 && Math.min(ta.length, tb.length) / Math.max(ta.length, tb.length) >= 0.7 ? 'corroborated' : 'unknown', agreement,
            independent, audioVerified: false, comparedSeconds: hi - lo };
    }

    function preferSource(first, second, { comparison = null, sameLanguage = false } = {}) {
        if (!first || !second || second.status === 'unusable') return false;
        if (first.status === 'unusable') return true;
        // Soft text signals alone must not replace a potentially correct caption track.
        return sameLanguage && comparison?.status === 'corroborated' && first.integrityScore + 20 <= second.integrityScore;
    }
    function sourceNotice(report) {
        if (!report) return '';
        if (report.status === 'unusable') return 'Nguồn có dấu hiệu lỗi: ' + report.signals.filter(s => s.level === 'error').map(s => s.detail).join(' ');
        if (report.status === 'suspect') return 'Cần kiểm tra phụ đề nguồn: ' + report.signals.filter(s => s.level === 'warning').map(s => s.detail).join(' ');
        if (report.status === 'limited') return 'Phụ đề nguồn ít chữ; chưa đủ căn cứ đánh giá độ khớp với tiếng nói.';
        return 'Chưa đối chiếu phụ đề nguồn với tiếng nói.';
    }

    const api = { assessSource, compareSources, preferSource, sourceNotice, viVoiceSource, normCode, detectText, decide, spokenLanguage, hearsVietnameseDub, dubTranscripts, brokenTranscript, sparseTranscript, SPARSE, TRANSLATED_MARK };
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CST_LANG = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
