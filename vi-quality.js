// ============================================================
// PHÁT HIỆN BẢN DỊCH "DỊCH MÁY"
//
// Kiểm tra tất định, chạy tức thì trên từng câu đã dịch:
//   - cấu trúc sao chép tiếng Anh (calque): "trong thứ tự để", "tất cả của",
//     "nó là quan trọng để", "hãy để chúng ta", "đang đi để"...
//   - từ đa nghĩa bị dịch theo nghĩa phổ biến nhất sai lĩnh vực
//   - đại từ "nó" mở câu không rõ tham chiếu
//   - lặp từ, lạm dụng "của nó", "một cách", câu bị động dày đặc
//   - thuật ngữ không nhất quán với thuật ngữ đã thống nhất
//   - bỏ sót / thêm nội dung (tỷ lệ độ dài bất thường), sót tiếng Anh
// Nếu điểm vượt ngưỡng, engine chạy lại lượt dịch kèm danh sách vấn đề.
// ============================================================
(function (root) {
    "use strict";

    // JavaScript: \b chỉ hiểu chữ ASCII, nên "\bthứ" không bao giờ khớp.
    // Đổi mọi \b thành ranh giới hiểu chữ tiếng Việt có dấu (Unicode).
    const B = "(?:(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}]))";
    function vre(re) {
        const flags = re.flags.includes("u") ? re.flags : re.flags + "u";
        return new RegExp(re.source.split("\\b").join(B), flags);
    }

    // [mẫu, mức độ, mô tả, gợi ý]
    const CALQUES_RAW = [
        [/\btrong thứ tự để\b/i, 3, "'in order to' dịch từng chữ", "dùng 'để'"],
        [/\b(?:lấy|có) một cái nhìn\b/i, 3, "'take a look' dịch từng chữ", "dùng 'xem qua'"],
        [/\b(?:tạo ra|làm) (?:cảm giác|ý nghĩa)\b/i, 3, "'make sense' dịch từng chữ", "dùng 'hợp lý' / 'dễ hiểu'"],
        [/\bở cuối của ngày\b/i, 3, "'at the end of the day' dịch từng chữ", "dùng 'suy cho cùng'"],
        [/\bđi (?:trước|tới trước) và\b/i, 3, "'go ahead and' dịch từng chữ", "bỏ hoặc dùng 'giờ ta...'"],
        [/\btrên đầu của\b/i, 2, "'on top of' dịch từng chữ", "dùng 'ngoài ra' / 'bên trên'"],
        [/\bnhư một vấn đề của (?:thực tế|sự thật)\b/i, 3, "'as a matter of fact' dịch từng chữ", "dùng 'thực ra'"],
        [/\b(?:rất nhiều|nhiều|một số|tất cả|mỗi|hầu hết|phần lớn|một vài|vài) của (?:các|những|chúng|họ|nó)\b/i, 3, "'some/all/many of' dịch từng chữ", "bỏ 'của'"],
        [/\bmột trong số của\b/i, 3, "'one of' dịch thừa 'của'", "dùng 'một trong những'"],
        [/(?:^|[.!?]\s+)nó là (?:quan trọng|cần thiết|có thể|dễ|khó|hữu ích|tốt|rõ ràng|đáng)\b/i, 3, "chủ ngữ giả 'It is ... to' dịch từng chữ", "đảo thành 'Điều quan trọng là...' / 'Cần...'"],
        [/\bhãy để (?:chúng ta|chúng tôi)\b/i, 3, "'let us' dịch từng chữ", "dùng 'hãy cùng' / 'chúng ta hãy'"],
        [/\b(?:đang|sẽ) đi để\b/i, 3, "'going to' dịch thành 'đi để'", "dùng 'sẽ'"],
        [/\bcó một .{1,40}? mà (?:là|được)\b/i, 1, "'there is a ... that is' bám cấu trúc", "viết gọn lại"],
        [/\bcái mà\b/i, 2, "'which/that' dịch thành 'cái mà'", "bỏ hoặc dùng 'mà'"],
        [/\bđiều mà\b.*\bđiều mà\b/i, 2, "lặp 'điều mà' (bám mệnh đề quan hệ tiếng Anh)", "viết lại"],
        [/\bđiều này là bởi vì\b/i, 1, "'this is because' dịch từng chữ", "dùng 'sở dĩ vậy là vì' / 'vì'"],
        [/\bnếu bạn muốn để\b/i, 2, "'if you want to' dịch thừa 'để'", "bỏ 'để'"],
        [/\bđược biết đến như là\b/i, 1, "'known as' dịch dài dòng", "dùng 'được gọi là'"],
        [/\bbạn có thể nhìn thấy\b/i, 1, "'you can see' dịch sát chữ", "dùng 'có thể thấy'"],
        [/\bchúng ta đã có được\b/i, 1, "'we have got' dịch sát chữ", "dùng 'ta có'"],
        [/\bcảm ơn bạn vì đã\b/i, 1, "'thank you for' bám cấu trúc", "dùng 'cảm ơn bạn đã'"],
        [/\btàu (?:mô hình|mạng|dữ liệu)\b/i, 3, "'train' dịch nhầm thành 'tàu'", "dùng 'huấn luyện'"],
        [/\b(?:chạy|đi) qua (?:về phía trước|chuyển tiếp)\b|\bvượt qua (?:về phía trước|chuyển tiếp|tiến)\b/i, 3, "'forward pass' dịch theo nghĩa 'vượt qua'", "dùng 'lượt truyền xuôi / lan truyền tiến'"],
        [/\bđường chuyền (?:về phía trước|tiến|ngược)\b/i, 3, "'forward/backward pass' dịch như bóng đá", "dùng 'lượt truyền xuôi/ngược'"],
        [/\bngười mẫu (?:học|ngôn ngữ|máy|AI)\b/i, 3, "'model' dịch nhầm thành 'người mẫu'", "dùng 'mô hình'"],
        [/\b(?:con chuột|con bọ) (?:trong|của) (?:mã|chương trình)\b/i, 3, "'bug' dịch theo nghĩa côn trùng", "dùng 'lỗi'"],
        [/\bkhách hàng tiềm năng (?:đến|tới) (?:kết quả|việc)\b/i, 2, "'lead to' dịch nhầm thành 'khách hàng tiềm năng'", "dùng 'dẫn đến'"],
        // Bổ sung sau khi rà thêm các lối dịch máy hay gặp trong phụ đề bài giảng
        [/\bnhững gì (?:chúng ta|bạn|tôi|mình) (?:sẽ|đang) (?:làm|nói) là\b/i, 3, "'what we're going to do is' bám cấu trúc", "dùng 'Việc ta sẽ làm là' / 'Giờ ta sẽ'"],
        [/\bnghĩ về (?:nó|điều này|cái này) như(?: là)?\b/i, 2, "'think of it as' dịch từng chữ", "dùng 'có thể xem nó như'"],
        [/\bđây là nơi .{1,40}? (?:đến|vào) (?:trong|cuộc)\b/i, 3, "'this is where X comes in' dịch từng chữ", "dùng 'lúc này X phát huy tác dụng'"],
        [/\bnó (?:quay|hóa|hoá) ra (?:rằng|là)\b/i, 3, "'it turns out that' thêm 'nó' thừa", "dùng 'hóa ra'"],
        [/\btrong (?:điều khoản|các điều khoản|thuật ngữ) của\b/i, 3, "'in terms of' dịch từng chữ", "dùng 'về mặt' / 'xét về'"],
        [/\bmột cặp của\b/i, 3, "'a couple of' dịch từng chữ", "dùng 'vài'"],
        [/\bhãy để tôi\b/i, 2, "'let me' dịch từng chữ", "dùng 'để tôi' / 'tôi sẽ'"],
        [/\bchăm sóc của\b/i, 3, "'take care of' dịch từng chữ", "dùng 'xử lý' / 'lo'"],
        [/\btrên (?:tay|mặt) khác\b/i, 3, "'on the other hand' dịch từng chữ", "dùng 'mặt khác'"],
        [/\btại cùng (?:một )?thời (?:điểm|gian)\b/i, 2, "'at the same time' dịch từng chữ", "dùng 'đồng thời' / 'cùng lúc'"],
        [/\blàm (?:cho )?chắc chắn (?:rằng|là)?\b/i, 3, "'make sure' dịch từng chữ", "dùng 'đảm bảo'"],
        [/\bkết thúc lên\b/i, 3, "'end up' dịch từng chữ", "dùng 'rốt cuộc' / 'cuối cùng lại'"],
        [/\bhình ra\b/i, 3, "'figure out' dịch từng chữ", "dùng 'tìm ra' / 'hiểu ra'"],
        [/\btrả (?:sự |một sự )?chú ý\b/i, 3, "'pay attention' dịch từng chữ", "dùng 'chú ý'"],
        [/\blặn sâu\b/i, 2, "'deep dive' dịch từng chữ", "dùng 'đi sâu vào'"],
        [/\bnó (?:là )?đáng (?:để )?(?:lưu ý|chú ý|nói|nhắc)\b/i, 3, "'it's worth noting' thêm 'nó' thừa", "dùng 'Cần lưu ý'"],
        [/\bmô hình (?:của|trong) kinh doanh\b/i, 1, "'business model' đảo trật tự", "dùng 'mô hình kinh doanh'"]
    ];
    const CALQUES = CALQUES_RAW.map(([re, sev, d, f]) => [vre(re), sev, d, f]);

    // Lặp từ không tự nhiên (trừ từ láy thông dụng)
    const REDUP_OK = new Set(["từ", "luôn", "nhanh", "chầm", "dần", "đều", "rất", "thường", "mãi", "xa", "gần", "nhiều", "lâu", "chút"]);

    function countMatches(text, re) {
        return (String(text).match(re) || []).length;
    }

    function englishLeftovers(vi, allow) {
        const words = String(vi).match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [];
        const allowSet = allow || new Set();
        return words.filter(w => {
            if (/^[A-Z0-9]{2,}$/.test(w)) return false;          // viết tắt: GPU, API
            if (/[A-Z].*[A-Z]/.test(w.slice(1))) return false;   // camelCase, PyTorch
            if (/^[A-Z]/.test(w)) return false;                  // tên riêng
            if (allowSet.has(w.toLowerCase())) return false;
            return true;
        });
    }

    // src: câu tiếng Anh, vi: bản dịch, opts: { terms:[{en,vi}], keep:Set(từ được giữ nguyên) }
    function assess(src, vi, opts = {}) {
        const issues = [];
        const s = String(src || "").trim();
        const v = String(vi || "").split("¦").join(" ").replace(/\s+/g, " ").trim();
        const add = (type, severity, detail, fix) => issues.push({ type, severity, detail, fix });

        if (!v) {
            add("empty", 3, "bản dịch rỗng", "dịch đầy đủ");
            return finish(issues);
        }

        for (const [re, sev, detail, fix] of CALQUES) {
            if (re.test(v)) add("calque", sev, detail, fix);
        }

        const words = v.split(" ");
        if (countMatches(v, vre(/\bcủa nó\b/gi)) >= 2) add("calque", 2, "lạm dụng 'của nó' (sao chép 'its')", "bỏ bớt, dùng 'này' hoặc lược");
        if (countMatches(v, vre(/\bmột cách\b/gi)) >= 2) add("calque", 2, "lạm dụng 'một cách' (sao chép trạng từ -ly)", "dùng tính từ/trạng từ trực tiếp");
        if (countMatches(v, vre(/\b(?:được|bị)\b/gi)) >= 3 && words.length < 30) add("passive", 2, "câu bị động dày đặc", "chuyển sang chủ động");
        if (vre(/(?:^|[.!?]\s+)Nó\b/).test(v) && /(?:^|[.!?]\s+)(?:It|This)\b/.test(s)) {
            add("pronoun", 1, "'It/This' dịch máy móc thành 'Nó'", "nêu rõ đối tượng (mô hình, hàm...) nếu ngữ cảnh cho phép");
        }
        for (let i = 1; i < words.length; i++) {
            const a = words[i - 1].toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
            const b = words[i].toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
            if (a && a === b && !REDUP_OK.has(a)) { add("repeat", 3, `lặp từ "${a} ${b}"`, "bỏ từ lặp"); break; }
        }

        // Tỷ lệ độ dài: tiếng Việt thường dài 0,9 đến 1,6 lần tiếng Anh (tính ký tự)
        if (s.length >= 25) {
            const r = v.length / s.length;
            if (r < 0.55) add("omission", 3, `bản dịch ngắn bất thường (${r.toFixed(2)} lần câu gốc), có thể bỏ sót ý`, "dịch đủ ý");
            else if (r > 2.3) add("addition", 2, `bản dịch dài bất thường (${r.toFixed(2)} lần câu gốc), có thể thêm ý`, "bỏ phần thêm");
        }

        // Sót tiếng Anh (không tính tên riêng, viết tắt, thuật ngữ được giữ)
        const keep = new Set([...(opts.keep || [])].map(x => String(x).toLowerCase()));
        (opts.terms || []).forEach(t => String(t.vi || "").split(/\s+/).forEach(w => keep.add(w.toLowerCase())));
        const leftovers = englishLeftovers(v, keep).filter(w => new RegExp(`\\b${w}\\b`, "i").test(s));
        const srcWords = (s.match(/[A-Za-z]+/g) || []).length || 1;
        if (leftovers.length >= 3 || (leftovers.length >= 2 && leftovers.length / srcWords > 0.2)) {
            add("untranslated", leftovers.length >= 3 ? 3 : 2, `còn từ tiếng Anh chưa dịch: ${leftovers.slice(0, 5).join(", ")}`, "dịch hoặc giữ có chủ ý");
        }

        // Thuật ngữ đã thống nhất nhưng câu này dùng cách khác
        for (const t of opts.terms || []) {
            if (!t.en || !t.vi) continue;
            const inSrc = new RegExp(`(?<![A-Za-z])${t.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?(?![A-Za-z])`, "i").test(s);
            if (!inSrc) continue;
            const low = v.toLowerCase();
            if (!low.includes(t.vi.toLowerCase()) && !low.includes(t.en.toLowerCase())) {
                add("terminology", 1, `thuật ngữ "${t.en}" đã thống nhất là "${t.vi}" nhưng câu này dịch khác`, `dùng "${t.vi}" nếu cùng nghĩa`);
            }
        }
        return finish(issues);
    }

    function finish(issues) {
        const score = issues.reduce((a, b) => a + b.severity, 0);
        return {
            score,
            issues,
            // Dịch lại khi có lỗi nặng, hoặc nhiều lỗi nhẹ cộng dồn
            needsRefine: issues.some(i => i.severity >= 3) || score >= 4
        };
    }

    // ---------- Context leaking into a translation ----------
    // Each request carries the neighbouring lines as context, and now and then the model translates
    // that context too, into the unit before it. Measured on a real cached video: one group's
    // translation held the next two groups' content (which were also translated on their own), so
    // the subtitle showed a sentence twice and the voice read it twice, at 36 to 51 characters per
    // second to fit. Detect it by the text itself, with no extra request: the tail of this unit
    // repeats the next unit's translation, word pair for word pair.
    const syllables = t => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    const pairs = w => { const out = []; for (let i = 1; i < w.length; i++) out.push(w[i - 1] + " " + w[i]); return out; };
    function clauseEnds(t) {
        const out = [];
        const re = /[,.;:!?…]+["”')\]]*\s+/g;
        let m;
        while ((m = re.exec(t))) out.push(m.index + m[0].length);
        return out;
    }

    // Returns text without the leaked tail, or text unchanged. next: the following unit(s)' translation.
    function trimContextLeak(text, next) {
        const t = String(text || "");
        const nextPairs = new Set(pairs(syllables(next)));
        const nextWords = new Set(syllables(next));
        if (!nextPairs.size) return t;
        const ends = clauseEnds(t);
        let best = null;
        for (const b of ends) {
            const tail = pairs(syllables(t.slice(b)));
            if (tail.length < 6 || syllables(t.slice(0, b)).length < 4) continue;
            const hit = tail.filter(x => nextPairs.has(x)).length;
            // at least half the word pairs repeat the next unit, and more repeat than not
            const score = hit - (tail.length - hit);
            if (hit >= 6 && hit / tail.length >= 0.5 && (!best || score > best.score)) best = { b, score };
        }
        if (!best) return t;
        // Walk back over short clauses made only of the next unit's words ("Ngoài khoản đó ra,"):
        // a paraphrase shares words, not word pairs. Stop at the first clause with its own content.
        let cut = best.b;
        for (let k = ends.indexOf(cut) - 1; k >= -1; k--) {
            const from = k >= 0 ? ends[k] : 0;
            const clause = syllables(t.slice(from, cut));
            if (!clause.length || clause.length > 6) break;
            if (clause.filter(w => nextWords.has(w)).length / clause.length < 1) break;
            if (syllables(t.slice(0, from)).length < 4) break;
            cut = from;
        }
        return t.slice(0, cut).replace(/[,;:\s]+$/, "");
    }

    const api = { assess, CALQUES, englishLeftovers, vre, trimContextLeak };
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CST_QUALITY = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
