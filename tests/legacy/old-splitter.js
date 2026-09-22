// Bản sao thuật toán cắt phụ đề CŨ (content.js v1.0.4, dòng 581-759), chỉ dùng để đo so sánh.
const VI_CONNECTORS = new Set([
    "và", "hoặc", "nhưng", "mà", "khi", "vì", "do", "để", "thì", "nếu", "bởi",
    "trong", "với", "cho", "tuy", "ngay", "như", "theo", "sau", "trước", "nhằm",
    "rồi", "nên", "liệu", "dù", "miễn", "trừ"
]);

// 1. Cụm từ ghép và thuật ngữ kỹ thuật tuyệt đối không bao giờ được chia đôi
const VI_INSEPARABLE = new Set([
    // Trí tuệ nhân tạo, Học máy & Học sâu
    "tích chập", "nơ ron", "nơ-ron", "mô hình", "dữ liệu", "học máy", "học sâu", "học tăng", "tăng cường",
    "đặc trưng", "trọng số", "xác suất", "thuật toán", "huấn luyện", "độ chính", "chính xác",
    "hàm mất", "mất mát", "tham số", "siêu tham", "hồi quy", "phân loại", "đầu vào", "đầu ra",
    "kiểm thử", "tối ưu", "tối ưu hóa", "ma trận", "truyền thẳng", "lan truyền", "truyền ngược",
    "ngược lại", "trí tuệ", "nhân tạo", "tốc độ", "kích hoạt", "chuẩn hóa", "không gian",
    "khả năng", "phương pháp", "kỹ thuật", "kết quả", "chúng ta", "các bạn", "người dùng",
    "máy tính", "hệ thống", "thực hiện", "phát triển", "nội dung", "mục tiêu", "xử lý",
    "ngôn ngữ", "tự nhiên", "thị giác", "bài giảng", "video", "trực tuyến", "trực tiếp",
    "giao diện", "tương tác", "trực quan", "nghiên cứu", "đánh giá", "chuyển đổi", "cấu trúc",
    "thông tin", "quy trình", "nguyên tắc", "nền tảng", "kiến trúc", "khái niệm", "thành phần",
    "yếu tố", "giá trị", "quan trọng", "đơn giản", "phức tạp", "cụ thể", "ví dụ", "minh họa",
    "tập trung", "liên quan", "tự động", "hoạt động", "hiệu suất", "tài nguyên", "độ dốc",
    "hội tụ", "phân kỳ", "chiều sâu", "chiều rộng", "lớp ẩn", "chuỗi thời", "thời gian",
    "thời gian thực", "bộ đệm", "bộ nhớ", "hàng đợi", "nguồn mở", "mã nguồn", "lập trình",
    "phần mềm", "phần cứng", "ứng dụng", "tiện ích", "máy chủ", "máy khách", "kết nối",
    "đầy đủ", "tương đương", "suy luận", "phân phối", "ước lượng", "trung bình", "độ lệch",
    "phương sai", "tập con", "tập mẫu", "mẫu thử", "kiểm định", "khoa học", "công nghệ",
    "thực tế", "kinh nghiệm", "phổ biến", "cơ bản", "nâng cao", "chuyên sâu", "toàn diện"
]);

// 2. Các từ cấm đứng cuối dòng (Dangling terminal words) - Phạt cực nặng nếu ngắt sau từ này
const VI_DANGLING = new Set([
    "của", "và", "hoặc", "trong", "cho", "với", "ở", "từ", "vào", "đến", "các", "những",
    "một", "mỗi", "được", "bị", "là", "rằng", "về", "lượt", "qua", "theo", "tại", "do",
    "bởi", "như", "giữa", "lên", "xuống", "sang", "ra", "thì", "mà", "để", "khi", "nếu",
    "bằng", "gồm", "nhất", "rất", "quá", "sẽ", "đang", "đã", "vẫn", "còn", "chưa", "cũng",
    "như là", "tức là", "nghĩa là", "gọi là", "chính là", "vì", "với tư cách", "đối với"
]);

// 3. Các liên từ & mở đầu mệnh đề - Thưởng điểm lớn nếu ngắt ngay TRƯỚC từ này
const VI_CLAUSE_CONNECTORS = new Set([
    "nhưng", "tuy nhiên", "mặc dù", "cho nên", "vì vậy", "do đó", "đồng thời", "hơn nữa",
    "ngoài ra", "mặt khác", "sau đó", "trước khi", "bởi vì", "đặc biệt", "chẳng hạn",
    "ví dụ", "nghĩa là", "tức là", "để mà", "khi mà", "nếu như", "song song", "thay vì",
    "thực ra", "trái lại", "nhờ đó", "từ đó", "bởi lẽ", "dẫn đến"
]);

const VI_CLASSIFIERS = new Set([
    "mô hình", "mạng", "thuật toán", "hàm", "lớp", "ma trận", "bộ", "tập", "hệ số", "giá trị",
    "tham số", "biến", "phương trình", "đối tượng", "phần tử", "chỉ số", "véc tơ", "vector"
]);

function cleanWordForScore(w) {
    return (w || "").toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function isProtectedToken(w) {
    return /(?:\[\[\s*__\s*T\d+\s*__\s*\]\]|__T\d+__|ZQ\d+QZ)/i.test(w || "");
}

function scoreSplitPoint(words, idx, targetIdx, totalWords = words.length) {
    if (idx <= 0 || idx >= words.length) return -999999;
    const wPrev = words[idx - 1];
    const wNext = words[idx];
    const cPrev = cleanWordForScore(wPrev);
    const cNext = cleanWordForScore(wNext);

    // Khoảng cách hình học tới vị trí cân đối lý tưởng (targetIdx)
    let penalty = Math.pow(Math.abs(idx - targetIdx), 2) * 3.5;

    // 1. Ưu tiên tuyệt đối ngắt tại dấu câu (Punctuation)
    const hasPeriod = /[.!?]$/.test(wPrev);
    const hasMajorPunct = /[,;:—\-\)\]"”’']$/.test(wPrev);
    if (hasPeriod) {
        penalty -= 220; // Thưởng cực cao cho điểm ngắt hết câu
    } else if (hasMajorPunct) {
        penalty -= 160; // Thưởng cao cho dấu phẩy, chấm phẩy, gạch ngang
    }

    // 2. Ưu tiên ngắt trước liên từ mở đầu mệnh đề (Clause Connectors)
    if (VI_CLAUSE_CONNECTORS.has(cNext) || (idx + 1 < words.length && VI_CLAUSE_CONNECTORS.has(`${cNext} ${cleanWordForScore(words[idx + 1])}`))) {
        penalty -= 130;
    } else if (VI_CONNECTORS.has(cNext)) {
        penalty -= 55;
    }

    // 3. Tuyệt đối cấm chia cắt từ ghép 2 âm tiết hoặc 3 âm tiết
    const bigram = `${cPrev} ${cNext}`;
    if (VI_INSEPARABLE.has(bigram)) {
        penalty += 380; // Phạt nặng phá từ ghép 2 âm tiết
    }
    if (idx + 1 < words.length) {
        const cNext2 = cleanWordForScore(words[idx + 1]);
        if (VI_INSEPARABLE.has(`${cPrev} ${cNext} ${cNext2}`)) {
            penalty += 450; // Phạt cực nặng phá từ ghép 3 âm tiết
        }
    }

    // 4. Chống treo từ cuối dòng (Dangling terminal word penalty)
    // Nếu từ trước điểm ngắt là giới từ/từ nối không có dấu câu đi kèm -> phạt nặng
    if (VI_DANGLING.has(cPrev) && !hasMajorPunct && !hasPeriod) {
        penalty += 340;
    }

    // 5. Chống từ mồ côi (Orphan word penalty)
    // Nếu điểm ngắt tạo ra phân đoạn quá ngắn (1 từ hoặc dưới 8 ký tự)
    const leftWords = idx;
    const rightWords = words.length - idx;
    if (leftWords <= 1 || rightWords <= 1) {
        penalty += 260;
    } else if (leftWords === 2 || rightWords === 2) {
        penalty += 80;
    }

    // 6. Tránh cắt giữa từ chỉ loại và token thuật ngữ
    if (VI_CLASSIFIERS.has(cPrev) && isProtectedToken(wNext)) {
        penalty += 240;
    }

    return -penalty;
}

function distributeTranslation(translatedText, cueTexts) {
    const clean = (translatedText || "").trim();
    if (!cueTexts || cueTexts.length <= 1) return [clean];

    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return cueTexts.map(() => "");

    const N = cueTexts.length;

    // Trường hợp đặc biệt: số từ ít hơn hoặc bằng số lượng cue
    if (words.length <= N) {
        const res = cueTexts.map(() => "");
        for (let i = 0; i < words.length; i++) res[i] = words[i];
        return res;
    }

    const totalSrcChars = cueTexts.reduce((sum, t) => sum + (t ? t.length : 0), 0) || 1;
    const result = [];
    let wordIdx = 0;

    for (let i = 0; i < N; i++) {
        if (i === N - 1) {
            result.push(words.slice(wordIdx).join(" "));
            break;
        }

        const remainingSlots = N - i;
        const remainingWords = words.length - wordIdx;
        const minWords = 1;
        const maxWords = remainingWords - (remainingSlots - 1);

        const share = (cueTexts[i] ? cueTexts[i].length : 1) / totalSrcChars;
        let targetCount = Math.round(words.length * share);
        targetCount = Math.max(minWords, Math.min(targetCount, maxWords));
        const targetIdx = wordIdx + targetCount;

        let bestIdx = targetIdx;
        let bestScore = -9999999;

        // Vùng tìm kiếm linh hoạt thích ứng (Adaptive Search Window)
        const windowRadius = Math.max(5, Math.min(8, Math.floor(remainingWords * 0.4)));
        const searchMin = Math.max(wordIdx + minWords, targetIdx - windowRadius);
        const searchMax = Math.min(wordIdx + maxWords, targetIdx + windowRadius);

        for (let candidate = searchMin; candidate <= searchMax; candidate++) {
            const s = scoreSplitPoint(words, candidate, targetIdx, words.length);
            if (s > bestScore) {
                bestScore = s;
                bestIdx = candidate;
            }
        }

        result.push(words.slice(wordIdx, bestIdx).join(" "));
        wordIdx = bestIdx;
    }

    return result;
}

module.exports = { distributeTranslation };
