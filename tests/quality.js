// Đo chất lượng một kết quả phân đoạn: danh sách cue, mỗi cue có mảng lines.
// Trả về danh sách vi phạm dễ đọc để test và báo cáo so sánh dùng chung.

const LINE_MAX = 42;

function norm(s) {
    return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

// Mọi ranh giới (giữa hai dòng trong cue, hoặc giữa hai cue)
function boundaries(cues) {
    const out = [];
    cues.forEach((cue, ci) => {
        cue.lines.forEach((line, li) => {
            const isLastLine = li === cue.lines.length - 1;
            if (isLastLine && ci === cues.length - 1) return;
            const right = isLastLine ? cues[ci + 1].lines[0] : cue.lines[li + 1];
            out.push({ left: line, right, kind: isLastLine ? "cue" : "line" });
        });
    });
    return out;
}

function endsWithWords(text, words) {
    const a = norm(text).split(" ");
    const b = norm(words).split(" ");
    if (b.length > a.length) return false;
    return a.slice(a.length - b.length).join(" ") === b.join(" ");
}

function startsWithWords(text, words) {
    const a = norm(text).split(" ");
    const b = norm(words).split(" ");
    return a.slice(0, b.length).join(" ") === b.join(" ");
}

function evaluate(testCase, cues) {
    const issues = [];
    const allLines = cues.flatMap(c => c.lines);

    // 1. Không mất / không lặp chữ
    const joined = norm(allLines.join(" "));
    if (joined !== norm(testCase.vi)) issues.push({ type: "text-mismatch", detail: joined });

    // 2. Cắt giữa cụm bị cấm
    for (const b of boundaries(cues)) {
        for (const pair of testCase.forbid || []) {
            const [l, r] = pair.split("|");
            if (endsWithWords(b.left, l) && startsWithWords(b.right, r)) {
                issues.push({ type: "split-phrase", detail: `${b.kind}: "${b.left}" | "${b.right}" (cấm ${pair})` });
            }
        }
        for (const w of testCase.noLineEnd || []) {
            if (endsWithWords(b.left, w)) issues.push({ type: "dangling", detail: `${b.kind}: "${b.left}" kết thúc bằng "${w}"` });
        }
        for (const w of testCase.noLineStart || []) {
            if (startsWithWords(b.right, w)) issues.push({ type: "orphan-start", detail: `${b.kind}: "${b.right}" bắt đầu bằng "${w}"` });
        }
        // Từ đơn lẻ mồ côi (một âm tiết chiếm nguyên dòng)
        if (norm(b.right).split(" ").length === 1 && cues.length + allLines.length > 2) {
            issues.push({ type: "orphan-word", detail: `${b.kind}: dòng chỉ có "${b.right}"` });
        }
    }

    // 3. Độ dài dòng và số dòng
    for (const c of cues) {
        if (c.lines.length > 2) issues.push({ type: "too-many-lines", detail: c.lines.join(" / ") });
        for (const l of c.lines) if (l.length > LINE_MAX + 4) issues.push({ type: "line-too-long", detail: `${l.length}: ${l}` });
    }

    // 4. Kỳ vọng riêng
    if (testCase.expectCues && cues.length !== testCase.expectCues) {
        issues.push({ type: "cue-count", detail: `${cues.length} != ${testCase.expectCues}` });
    }
    if (testCase.expectLines && allLines.length !== testCase.expectLines) {
        issues.push({ type: "line-count", detail: `${allLines.length} != ${testCase.expectLines}` });
    }
    if (testCase.expectLineBreakAfter) {
        const ok = boundaries(cues).some(b => endsWithWords(b.left, testCase.expectLineBreakAfter));
        if (!ok) issues.push({ type: "expected-break", detail: `không ngắt sau "${testCase.expectLineBreakAfter}"` });
    }
    if (testCase.expectCueBreakAfter) {
        const ok = boundaries(cues).some(b => b.kind === "cue" && endsWithWords(b.left, testCase.expectCueBreakAfter));
        if (!ok) issues.push({ type: "expected-cue-break", detail: `không tách cue sau "${testCase.expectCueBreakAfter}"` });
    }

    // 5. Thời gian (nếu có)
    for (let i = 0; i < cues.length; i++) {
        const c = cues[i];
        if (typeof c.start !== "number") continue;
        if (!(c.end > c.start)) issues.push({ type: "timing", detail: `cue ${i} thời lượng <= 0` });
        if (i > 0 && c.start < cues[i - 1].end - 1e-6) issues.push({ type: "timing", detail: `cue ${i} chồng lên cue trước` });
    }
    return issues;
}

// Mô phỏng cách trình duyệt tự xuống dòng (thuật toán cũ không tự ngắt dòng)
function greedyWrap(text, max = LINE_MAX) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
        if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; }
        else cur = cur ? cur + " " + w : w;
    }
    if (cur) lines.push(cur);
    return lines;
}

module.exports = { evaluate, greedyWrap, boundaries, LINE_MAX };
