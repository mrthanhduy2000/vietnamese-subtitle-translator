// ============================================================
// BỘ HIỂU NGỮ CẢNH CHO ENGINE DỊCH
//
// Pipeline:  SOURCE CONTEXT -> CONTEXT UNDERSTANDING -> TERMINOLOGY
//            -> TRANSLATION (Gemini) -> NATURALIZATION (kiểm tra + dịch lại)
//            -> SEGMENTATION -> LINE BREAKING -> VALIDATION
//
// Module này lo 3 lớp đầu, thuần JS, không gọi mạng:
//   - Nhận diện lĩnh vực của video/khóa học (AI, lập trình, kinh doanh...)
//     từ tiêu đề, mô tả và một mẫu phụ đề.
//   - Giữ "trạng thái ngữ cảnh" của cả video: tóm tắt phần vừa nói,
//     bản dịch các câu trước, thuật ngữ đã thống nhất.
//   - Dựng gói ngữ cảnh GỌN cho mỗi lần dịch (cửa sổ trượt, có ngân sách
//     ký tự) để không lãng phí token.
//
// Gợi ý nghĩa theo lĩnh vực KHÔNG phải bảng tra cố định: chỉ gửi kèm khi
// từ đó xuất hiện trong đoạn đang dịch, và mô hình được yêu cầu chọn nghĩa
// theo câu cụ thể.
// ============================================================
(function (root) {
    "use strict";

    const DOMAINS = {
        ml: {
            label: "Trí tuệ nhân tạo, học máy, học sâu",
            kw: ["neural", "network", "model", "training", "train", "dataset", "gradient", "loss", "layer", "deep learning",
                "machine learning", "transformer", "attention", "embedding", "llm", "gpt", "classifier", "regression",
                "overfitting", "epoch", "batch", "convolution", "backprop", "inference", "fine-tun", "prompt", "token",
                "reinforcement", "supervised", "feature", "label", "weights", "activation", "optimizer", "ai "]
        },
        programming: {
            label: "Lập trình, phát triển phần mềm",
            kw: ["python", "javascript", "function", "variable", "code", "compile", "debug", "api", "class", "object",
                "method", "loop", "array", "string", "library", "framework", "git", "repository", "deploy", "server",
                "database", "syntax", "runtime", "terminal", "install", "package", "import", "return", "parameter"]
        },
        data: {
            label: "Khoa học dữ liệu, phân tích dữ liệu",
            kw: ["data", "pandas", "sql", "query", "table", "column", "row", "dashboard", "visualiz", "analytics",
                "statistic", "correlation", "distribution", "sample", "dataframe", "csv", "etl", "warehouse"]
        },
        math: {
            label: "Toán học, thống kê",
            kw: ["equation", "derivative", "integral", "matrix", "vector", "theorem", "proof", "probability", "function",
                "variance", "mean", "linear", "polynomial", "calculus", "algebra", "eigen", "limit", "sum of", "squared"]
        },
        business: {
            label: "Kinh doanh, quản trị, tài chính",
            kw: ["business", "company", "revenue", "profit", "customer", "market", "strategy", "management", "finance",
                "investment", "stakeholder", "startup", "cost", "pricing", "leadership", "team", "sales", "roi", "capital"]
        },
        marketing: {
            label: "Marketing, quảng cáo số",
            kw: ["marketing", "brand", "campaign", "audience", "conversion", "funnel", "seo", "ads", "advertis", "engagement",
                "social media", "content", "lead", "ctr", "impression", "persona", "retention", "customer journey"]
        },
        science: {
            label: "Khoa học tự nhiên",
            kw: ["cell", "molecule", "energy", "physics", "chemistry", "biology", "experiment", "atom", "reaction",
                "force", "temperature", "species", "evolution", "gene", "protein", "planet", "electron", "wave"]
        }
    };

    // Gợi ý nghĩa của từ đa nghĩa THEO LĨNH VỰC. Chỉ gửi mục nào có từ
    // xuất hiện trong đoạn đang dịch; mô hình vẫn phải tự chọn theo câu.
    const SENSES = {
        model: { ml: "mô hình (học máy)", business: "mô hình kinh doanh", science: "mô hình mô phỏng", general: "mẫu, kiểu mẫu, người mẫu tùy ngữ cảnh" },
        train: { ml: "huấn luyện (mô hình)", business: "đào tạo (nhân viên)", general: "tàu hỏa hoặc rèn luyện" },
        run: { programming: "chạy, thực thi (chương trình)", ml: "chạy; 'a run' là một lần chạy thí nghiệm", business: "điều hành, vận hành", general: "chạy, kéo dài, điều hành tùy câu" },
        pass: { ml: "lượt truyền ('forward pass' là lượt truyền xuôi)", programming: "truyền (tham số) hoặc vượt qua (kiểm thử)", general: "vượt qua, đi qua, bỏ qua, chuyển cho" },
        layer: { ml: "lớp (trong mạng nơ-ron)", programming: "tầng (kiến trúc)", general: "tầng, lớp" },
        channel: { ml: "kênh (kênh màu, kênh đặc trưng)", marketing: "kênh tiếp thị, kênh phân phối", business: "kênh phân phối", general: "kênh" },
        feature: { ml: "đặc trưng", programming: "tính năng", business: "tính năng sản phẩm", general: "đặc điểm, tính năng" },
        label: { ml: "nhãn (dữ liệu)", marketing: "nhãn hàng", general: "nhãn" },
        bias: { ml: "độ lệch (bias của nơ-ron) hoặc thiên lệch dữ liệu, tùy câu", general: "thiên kiến, định kiến" },
        weight: { ml: "trọng số", science: "trọng lượng", general: "cân nặng, sức nặng" },
        weights: { ml: "trọng số" },
        kernel: { ml: "bộ lọc (kernel) tích chập", programming: "nhân hệ điều hành / kernel notebook", math: "hạt nhân" },
        batch: { ml: "lô dữ liệu (batch)", programming: "lô, xử lý hàng loạt" },
        loss: { ml: "hàm mất mát / giá trị mất mát", business: "khoản lỗ", general: "sự mất mát" },
        "return": { programming: "trả về (giá trị)", business: "lợi nhuận, lợi tức", general: "quay lại, trả lại" },
        "class": { programming: "lớp (class)", ml: "lớp / nhãn phân loại", general: "lớp học, hạng" },
        instance: { programming: "thể hiện, đối tượng", ml: "mẫu (một điểm dữ liệu)", general: "trường hợp, ví dụ" },
        "function": { math: "hàm số", programming: "hàm", general: "chức năng" },
        root: { math: "nghiệm hoặc căn", programming: "thư mục gốc, quyền root", general: "gốc rễ" },
        power: { math: "lũy thừa", science: "công suất", general: "sức mạnh, quyền lực" },
        mean: { math: "giá trị trung bình", data: "giá trị trung bình", general: "nghĩa là, có ý" },
        normal: { math: "chuẩn (phân phối chuẩn) hoặc pháp tuyến", general: "bình thường" },
        significant: { math: "có ý nghĩa thống kê", data: "có ý nghĩa thống kê", general: "đáng kể, quan trọng" },
        lead: { marketing: "khách hàng tiềm năng", business: "khách hàng tiềm năng hoặc dẫn dắt", general: "dẫn đầu, dẫn tới" },
        leads: { marketing: "khách hàng tiềm năng", business: "khách hàng tiềm năng" },
        conversion: { marketing: "chuyển đổi (khách thực hiện hành động mục tiêu)", science: "sự chuyển hóa, quy đổi" },
        engagement: { marketing: "mức độ tương tác", general: "sự tham gia, gắn kết" },
        target: { marketing: "nhắm mục tiêu, đối tượng mục tiêu", ml: "giá trị mục tiêu (nhãn cần dự đoán)", general: "mục tiêu" },
        reach: { marketing: "phạm vi tiếp cận", general: "đạt tới, với tới, liên hệ" },
        scale: { business: "mở rộng quy mô", ml: "quy mô hoặc chuẩn hóa thang đo", math: "thang đo, tỉ lệ", general: "quy mô" },
        interest: { business: "lãi suất hoặc sự quan tâm", general: "sự quan tâm" },
        share: { business: "cổ phần, thị phần", general: "chia sẻ" },
        cell: { science: "tế bào", programming: "ô (notebook, bảng tính)", data: "ô dữ liệu", general: "ô" },
        solution: { science: "dung dịch", math: "lời giải, nghiệm", general: "giải pháp" },
        matter: { science: "vật chất", general: "vấn đề; 'it doesn't matter' là không quan trọng" },
        charge: { science: "điện tích", business: "phí, tính phí", general: "sạc, phụ trách, cáo buộc" },
        current: { science: "dòng điện", general: "hiện tại" },
        table: { data: "bảng dữ liệu", general: "cái bàn hoặc bảng" },
        field: { data: "trường dữ liệu", science: "trường (vật lý)", general: "lĩnh vực" },
        record: { data: "bản ghi", general: "ghi lại, kỷ lục" },
        set: { math: "tập hợp", ml: "tập (dữ liệu)", programming: "gán, thiết lập", general: "đặt, thiết lập, bộ" },
        fit: { ml: "khớp / huấn luyện mô hình ('fit the model')", general: "phù hợp, vừa" },
        environment: { programming: "môi trường (lập trình, môi trường ảo)", ml: "môi trường làm việc hoặc môi trường (học tăng cường)", science: "môi trường sống" },
        branch: { programming: "nhánh (git)", business: "chi nhánh", general: "cành, nhánh" },
        commit: { programming: "commit (ghi nhận thay đổi)", general: "cam kết" },
        bug: { programming: "lỗi phần mềm", science: "côn trùng" },
        memory: { programming: "bộ nhớ", ml: "bộ nhớ", general: "ký ức, trí nhớ" },
        agent: { ml: "tác tử AI (agent)", business: "đại lý, người đại diện" },
        head: { ml: "đầu (attention head)", business: "người đứng đầu", general: "cái đầu, phần đầu" },
        state: { ml: "trạng thái", programming: "trạng thái", general: "bang, tình trạng, phát biểu" },
        order: { math: "bậc, thứ tự", business: "đơn hàng", general: "thứ tự, mệnh lệnh" },
        degree: { math: "độ, bậc (đa thức)", general: "bằng cấp, mức độ" },
        address: { programming: "địa chỉ (bộ nhớ, IP)", general: "giải quyết (vấn đề) hoặc địa chỉ" },
        handle: { programming: "xử lý", general: "xử lý, tay cầm" },
        deal: { business: "thương vụ", general: "xử lý ('deal with'), thỏa thuận" },
        close: { business: "chốt (đơn, giao dịch)", general: "đóng, gần" },
        pipeline: { ml: "quy trình xử lý (pipeline)", business: "danh sách cơ hội bán hàng", programming: "quy trình tự động" },
        stack: { programming: "ngăn xếp hoặc bộ công nghệ", general: "chồng, đống" },
        key: { programming: "khóa", general: "chìa khóa, then chốt" },
        value: { programming: "giá trị", business: "giá trị (cho khách hàng)", general: "giá trị" },
        step: { ml: "bước (cập nhật tham số)", general: "bước" },
        point: { math: "điểm", general: "ý, luận điểm" }
    };

    // Cụm động từ và thành ngữ: dịch theo nghĩa, không theo từng chữ
    const PHRASES = {
        "go over": "xem lại, rà lại", "go through": "đi qua từng phần, xem qua", "come up with": "nghĩ ra",
        "figure out": "tìm ra, hiểu ra", "set up": "thiết lập, cài đặt", "break down": "chia nhỏ, phân tích",
        "carry out": "thực hiện", "point out": "chỉ ra", "end up": "rốt cuộc lại", "turn out": "hóa ra",
        "keep in mind": "lưu ý", "take a look": "xem qua", "make sense": "hợp lý, dễ hiểu",
        "in a nutshell": "tóm lại", "at the end of the day": "suy cho cùng", "rule of thumb": "quy tắc kinh nghiệm",
        "under the hood": "cơ chế bên trong", "on the fly": "ngay trong lúc chạy", "out of the box": "có sẵn, dùng được ngay",
        "state of the art": "tiên tiến nhất", "state-of-the-art": "tiên tiến nhất", "low-hanging fruit": "việc dễ làm trước",
        "trade-off": "sự đánh đổi", "tradeoff": "sự đánh đổi", "bottleneck": "điểm nghẽn", "boils down to": "suy cho cùng là",
        "piece of cake": "dễ như trở bàn tay", "hands-on": "thực hành", "wrap up": "tổng kết, kết thúc",
        "dive into": "đi sâu vào", "dive deeper": "đi sâu hơn", "walk through": "hướng dẫn từng bước",
        "walk you through": "hướng dẫn bạn từng bước", "go ahead and": "(bỏ qua, chỉ là lời dẫn: 'hãy', 'giờ ta')",
        "let's go ahead": "giờ chúng ta", "pay off": "đáng công, mang lại kết quả", "roll out": "triển khai",
        "kick off": "bắt đầu", "build on": "phát triển tiếp từ", "come into play": "phát huy tác dụng",
        "on top of that": "thêm vào đó", "that being said": "dù vậy", "that said": "dù vậy",
        "as a matter of fact": "thực ra", "in other words": "nói cách khác", "it turns out": "hóa ra",
        "keep track of": "theo dõi", "get rid of": "loại bỏ", "look into": "tìm hiểu", "run into": "gặp phải",
        "figure it out": "tự tìm ra", "sort of": "kiểu như (ước lượng)", "kind of": "kiểu như (ước lượng)",
        "a bunch of": "nhiều", "a lot of": "nhiều", "at scale": "ở quy mô lớn", "in practice": "trong thực tế",
        "big picture": "bức tranh tổng thể", "the bottom line": "điểm mấu chốt", "ballpark": "ước chừng",
        "bear in mind": "lưu ý", "up and running": "chạy được", "sanity check": "kiểm tra nhanh cho chắc"
    };

    const clip = (s, n) => {
        s = String(s || "").replace(/\s+/g, " ").trim();
        return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
    };
    const clipTail = (s, n) => {
        s = String(s || "").replace(/\s+/g, " ").trim();
        return s.length <= n ? s : "…" + s.slice(s.length - n + 1).replace(/^\S*\s+/, "");
    };
    const stripHints = s => String(s || "").split("¦").join(" ").replace(/\s{2,}/g, " ").trim();
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    function detectDomain(text) {
        const t = " " + String(text || "").toLowerCase() + " ";
        const scores = {};
        for (const [key, d] of Object.entries(DOMAINS)) {
            let s = 0;
            for (const k of d.kw) {
                const re = new RegExp(`(?<![a-z])${escapeRe(k.trim())}`, "g");
                const m = t.match(re);
                if (m) s += Math.min(m.length, 6);
            }
            scores[key] = s;
        }
        const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const [primary, top] = ranked[0];
        const second = ranked[1];
        if (top < 3) return { primary: "general", secondary: null, scores };
        return {
            primary,
            secondary: second && second[1] >= Math.max(3, top * 0.5) ? second[0] : null,
            scores
        };
    }

    function domainLabel(key) {
        return key === "general" ? "Tổng quát / hội thoại" : (DOMAINS[key] ? DOMAINS[key].label : key);
    }

    // Từ tiếng Anh có trong đoạn (chữ thường, bỏ đuôi số nhiều đơn giản)
    function wordsIn(text) {
        const set = new Set();
        for (const w of String(text || "").toLowerCase().match(/[a-z][a-z'-]*/g) || []) {
            set.add(w);
            if (w.endsWith("s") && w.length > 3) set.add(w.slice(0, -1));
        }
        return set;
    }

    function senseHintsFor(text, domain, limit = 10) {
        // Từ đã nằm trong một cụm động từ / thành ngữ ("set up", "figure out")
        // thì nghĩa do cả cụm quyết định: không gợi ý nghĩa đơn lẻ gây nhiễu.
        let t = " " + String(text || "").toLowerCase().replace(/\s+/g, " ") + " ";
        for (const p of Object.keys(PHRASES)) t = t.split(" " + p + " ").join(" ¤ ").split(" " + p + ",").join(" ¤,").split(" " + p + ".").join(" ¤.");
        const words = wordsIn(t);
        const out = [];
        const seen = new Set();
        for (const [w, senses] of Object.entries(SENSES)) {
            if (!words.has(w)) continue;
            // Only a sense the domain decides. The "general" entry is the everyday meaning the model
            // picks anyway, and it misled: "point: ý, luận điểm" was sent for "at this point".
            const pick = (domain.primary !== "general" && senses[domain.primary]) || (domain.secondary && senses[domain.secondary]);
            if (!pick) continue;
            // "weights" in the text also matches "weight": one line when both say the same
            if (seen.has(pick)) continue;
            seen.add(pick);
            out.push(`${w}: ${pick}`);
            if (out.length >= limit) break;
        }
        return out;
    }

    function phraseHintsFor(text, limit = 8) {
        const t = " " + String(text || "").toLowerCase().replace(/\s+/g, " ") + " ";
        const out = [];
        for (const [p, v] of Object.entries(PHRASES)) {
            if (t.includes(" " + p + " ") || t.includes(" " + p + ",") || t.includes(" " + p + ".")) {
                out.push(`${p}: ${v}`);
                if (out.length >= limit) break;
            }
        }
        return out;
    }

    // ---------------- Topic: the useful part of a video description ----------------
    // A YouTube description often opens with links, social handles, sponsor lines and chapter
    // timestamps; sent as the topic, that was up to ~250 characters of noise on every request.
    const DESC_NOISE = /https?:\/\/|www\.|@\w|^\s*#|\b\d{1,2}:\d{2}\b|\b(?:subscrib\w*|follow (?:me|us)|sponsor\w*|patreon|merch|affiliate|discount|promo code|coupon|instagram|twitter|tiktok|discord|linkedin|facebook|newsletter|membership|join (?:this|my|our) channel)\b/i;
    function cleanDescription(text) {
        const lines = String(text || "").split(/\n+/).map(l => l.trim()).filter(l => l && !DESC_NOISE.test(l));
        return clip(lines.join(" "), 200);
    }

    // ---------------- Antecedents further back than the previous two units ----------------
    // A window that opens "He later became the CEO." after three sentences without the name, or
    // "The company then..." long after the company was named, gets the sentence that introduced the
    // referent. Only person pronouns and a short list of definite nouns: "it", "this", "they" point
    // at almost anything and are nearly always resolved by the previous two units already.
    const PERSON_PRONOUN = /\b(?:he|she|him|his|her|hers|himself|herself)\b/i;
    const PERSON_NOUNS = ["person", "man", "woman", "guy", "author", "speaker", "professor", "teacher", "student", "founder", "ceo",
        "researcher", "scientist", "engineer", "customer", "user", "doctor", "patient", "manager", "boss", "client"];
    const REF_NOUNS = ["company", "model", "system", "team", "product", "algorithm", "paper", "study", "approach", "method",
        "network", "dataset", "tool", "app", "platform", "startup", "library", "framework", "project", "device", "experiment", ...PERSON_NOUNS];
    const DEF_NP = new RegExp(`\\bthe (${REF_NOUNS.join("|")})\\b`, "gi");
    // Capitalised words that are not names
    const NOT_NAMES = new Set(["I", "I'm", "I'll", "I've", "I'd", "OK", "Okay", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
        "Saturday", "Sunday", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
        "November", "December", "English", "God"]);
    const REF_LOOKBACK = 15;     // units searched before the previous two
    const REF_MAX = 2;           // sentences carried
    const REF_TOPIC_UNITS = 3;   // a noun in this many earlier units is the topic, not a referent
    const sentencesOf = t => String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean);
    // Words that open English sentences: a capitalised first word that is not one of these is taken
    // as a name ("Sam joined...", "Andrew showed..."), a capitalised word anywhere else always is
    const OPENERS = new Set(("a an the this that these those there here it its he she they we you i my our your his her their " +
        "so and but or now then well okay ok yes no yeah also if when while after before because although though since as once " +
        "so what why how where who which let let's first second third next finally today in on at for with by from to of into " +
        "about over under all each every some many most more any one two three just only even still again maybe perhaps actually " +
        "basically remember notice note think look take make go see try use imagine suppose consider say keep start stop do does did " +
        "is are was were be have has had can could will would should may might must not never always sometimes often however " +
        "instead otherwise meanwhile anyway thanks thank hello hi hey welcome great good right sure").split(" "));
    function hasName(text) {
        return sentencesOf(text).some(sen => sen.split(/\s+/).some((w, k) => {
            const m = w.match(/^[A-Z][a-z]+(?=$|'s|[^a-z])/);
            if (!m || NOT_NAMES.has(m[0])) return false;
            return k > 0 || !OPENERS.has(m[0].toLowerCase());
        }));
    }
    const personMention = t => hasName(t) || PERSON_NOUNS.some(n => new RegExp(`\\b(?:the|a|an|this|our|my) ${n}\\b`, "i").test(t));

    // ---------------- Trạng thái ngữ cảnh của một video / bài giảng ----------------
    const BUDGET = {
        topic: 320,          // tiêu đề + kênh/khóa + mô tả
        prevSource: 480,     // tiếng Anh ngay trước (tối đa 2 đơn vị)
        prevTranslation: 360,
        nextSource: 300,     // tiếng Anh ngay sau (chỉ để tham khảo)
        terms: 18
    };

    class ContextSession {
        constructor(meta = {}) {
            this.meta = {
                title: meta.title || "",
                channel: meta.channel || "",
                course: meta.course || "",
                description: meta.description || "",
                keywords: meta.keywords || []
            };
            this.units = [];                 // văn bản nguồn của từng nhóm (theo thứ tự thời gian)
            this.results = new Map();        // idx -> { vi, note }
            this.terms = new Map();          // en (chữ thường) -> { en, vi, count, locked }
            this.domain = { primary: "general", secondary: null, scores: {} };
        }

        setUnits(texts) {
            this.units = texts.map(t => String(t || ""));
            this.results.clear();
            const sample = this.units.join(" ").slice(0, 6000);
            const metaText = [this.meta.title, this.meta.course, this.meta.channel, this.meta.description, ...(this.meta.keywords || [])].join(" ");
            // Tiêu đề/mô tả nặng ký hơn phụ đề mẫu
            this.domain = detectDomain(`${metaText} ${metaText} ${sample}`);
            return this.domain;
        }

        topicLine() {
            const parts = [];
            if (this.meta.title) parts.push(`Tiêu đề: ${this.meta.title}`);
            if (this.meta.course) parts.push(`Khóa học: ${this.meta.course}`);
            if (this.meta.channel) parts.push(`Kênh/giảng viên: ${this.meta.channel}`);
            const desc = cleanDescription(this.meta.description);
            if (desc) parts.push(`Mô tả: ${desc}`);
            return clip(parts.join(" | "), BUDGET.topic);
        }

        // Có nên xin Gemini trả thuật ngữ cho cửa sổ này không (tiết kiệm token đầu ra):
        // chỉ khi đoạn có từ khóa chuyên ngành CHƯA có trong danh sách đã thống nhất,
        // và tối đa 1 lần mỗi 3 cửa sổ.
        wantsTerms(req) {
            this.windowCount = (this.windowCount || 0) + 1;
            if (this.terms.size >= 80) return false;
            if (this.lastTermsAt && this.windowCount - this.lastTermsAt < 3) return false;
            const d = DOMAINS[this.domain.primary];
            if (!d) return false;
            const text = " " + (req.sentences || []).join(" ").toLowerCase() + " ";
            const known = [...this.terms.keys()].join(" | ");
            const fresh = d.kw.filter(k => k.trim().length > 3 && text.includes(k.trim()) && !known.includes(k.trim()));
            if (fresh.length < 2) return false;
            this.lastTermsAt = this.windowCount;
            return true;
        }

        relevantTerms(text) {
            const t = String(text || "").toLowerCase();
            const hits = [];
            for (const term of this.terms.values()) {
                if (!term.vi) continue;
                const re = new RegExp(`(?<![a-z])${escapeRe(term.en.toLowerCase())}(?:e?s)?(?![a-z])`);
                if (re.test(t)) hits.push(term);
            }
            hits.sort((a, b) => b.count - a.count);
            return hits.slice(0, BUDGET.terms).map(x => ({ en: x.en, vi: x.vi }));
        }

        // Sentences from before the previous two units that introduce who or what the window refers
        // to, when the previous units and the window itself do not. Pure source text, so it is
        // deterministic and may join the cache key.
        refSourceFor(first, sentences) {
            const near = [first - 2, first - 1].filter(i => i >= 0).map(i => this.units[i]).join(" ");
            const needs = [];
            let before = near;
            for (const sen of sentences) {
                if (PERSON_PRONOUN.test(sen) && !personMention(before) && !personMention(sen.split(PERSON_PRONOUN)[0])) needs.push({ person: true });
                for (const m of sen.matchAll(DEF_NP)) {
                    const noun = m[1].toLowerCase();
                    const said = new RegExp(`\\b${noun}\\b`, "i");
                    if (said.test(before) || said.test(sen.slice(0, m.index)) || needs.some(n => n.noun === noun)) continue;
                    // a running topic word ("the model" all through an ML lecture) needs no antecedent
                    let seen = 0;
                    for (let i = first - 1; i >= Math.max(0, first - 2 - REF_LOOKBACK); i--) if (said.test(this.units[i])) seen++;
                    if (seen < REF_TOPIC_UNITS) needs.push({ noun, said });
                }
                before += " " + sen;
            }
            if (!needs.length) return "";
            const picked = new Map();
            // a person: the nearest sentence naming someone, else the nearest "the CEO" / "a teacher"
            const tests = need => (need.person ? [hasName, personMention] : [x => need.said.test(x)]);
            for (const need of needs) {
                for (const ok of tests(need)) {
                    let found = false;
                    for (let i = first - 3; i >= Math.max(0, first - 2 - REF_LOOKBACK) && !found; i--) {
                        const list = sentencesOf(this.units[i]);
                        const k = list.findIndex(ok);
                        if (k >= 0) { picked.set(i * 100 + k, list[k]); found = true; }
                    }
                    if (found) break;
                }
                if (picked.size >= REF_MAX) break;
            }
            return [...picked.entries()].sort((a, b) => a[0] - b[0]).map(e => clip(e[1], 160)).join(" … ");
        }

        // Gói ngữ cảnh cho các nhóm liên tiếp idxs (cửa sổ trượt quanh đoạn đang dịch)
        buildRequest(idxs) {
            const first = idxs[0];
            const last = idxs[idxs.length - 1];
            const sentences = idxs.map(i => this.units[i]);

            const prevIdx = [first - 2, first - 1].filter(i => i >= 0);
            const nextIdx = [last + 1, last + 2].filter(i => i < this.units.length);
            const prevSource = clipTail(prevIdx.map(i => this.units[i]).join(" "), BUDGET.prevSource);
            const prevTranslation = clipTail(prevIdx.map(i => this.results.get(i)).filter(Boolean).map(r => stripHints(r.vi)).join(" "), BUDGET.prevTranslation);
            const nextSource = clip(nextIdx.map(i => this.units[i]).join(" "), BUDGET.nextSource);

            const hintText = sentences.join(" ");
            return {
                sentences,
                context: {
                    topic: this.topicLine(),
                    domain: domainLabel(this.domain.primary) + (this.domain.secondary ? `; liên quan: ${domainLabel(this.domain.secondary)}` : ""),
                    refSource: this.refSourceFor(first, sentences),
                    prevSource,
                    prevTranslation,
                    nextSource,
                    // Chỉ thuật ngữ có trong phần CẦN DỊCH (không tốn token cho ngữ cảnh)
                    terms: this.relevantTerms(hintText),
                    senseHints: senseHintsFor(hintText, this.domain),
                    phraseHints: phraseHintsFor(hintText)
                }
            };
        }

        // Ghi lại kết quả: bản dịch, tóm tắt, thuật ngữ mô hình đã chọn.
        // Thuật ngữ đã thống nhất thì giữ nguyên (nhất quán), chỉ đổi khi
        // thuật ngữ mới xuất hiện nhiều hơn hẳn.
        record(idxs, result) {
            idxs.forEach((i, k) => {
                const vi = result.translations ? result.translations[k] : "";
                if (vi) this.results.set(i, { vi });
            });
            for (const t of result.terms || []) {
                if (!t || !t.en || !t.vi) continue;
                const en = String(t.en).trim();
                const vi = String(t.vi).trim();
                if (en.length < 2 || en.length > 60 || vi.length > 80) continue;
                const key = en.toLowerCase();
                const cur = this.terms.get(key);
                if (!cur) this.terms.set(key, { en, vi, count: 1, alt: {} });
                else if (cur.vi.toLowerCase() === vi.toLowerCase()) cur.count++;
                else {
                    cur.alt[vi] = (cur.alt[vi] || 0) + 1;
                    if (cur.alt[vi] >= cur.count + 2) { cur.vi = vi; cur.count = cur.alt[vi]; cur.alt = {}; }
                }
            }
            if (this.terms.size > 250) {
                const keep = [...this.terms.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 200);
                this.terms = new Map(keep);
            }
        }

        exportTerms() {
            return [...this.terms.values()].sort((a, b) => b.count - a.count).slice(0, 200)
                .map(t => [t.en, t.vi, t.count]);
        }

        importTerms(list) {
            for (const item of list || []) {
                if (!Array.isArray(item) || !item[0] || !item[1]) continue;
                const key = String(item[0]).toLowerCase();
                if (!this.terms.has(key)) this.terms.set(key, { en: item[0], vi: item[1], count: Number(item[2]) || 1, alt: {} });
            }
        }
    }

    const api = { DOMAINS, SENSES, PHRASES, BUDGET, cleanDescription, detectDomain, domainLabel, senseHintsFor, phraseHintsFor, ContextSession };
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CST_CONTEXT = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
