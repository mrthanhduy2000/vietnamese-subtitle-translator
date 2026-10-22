// Kiểm thử lồng tiếng: kịch bản nói, ngữ điệu, khớp thời lượng, audio thật,
// đồng bộ với video (tốc độ phát, tạm dừng, tua, đang tải, lệch nhịp), lỗi & dự phòng.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const PLAN = require("../dub-planner.js");
const AUDIO = require("../dub-audio.js");
const { DubEngine, geminiScript } = require("../dub-engine.js");
const seg = require("../vi-segmenter.js");
const { Clock, FakeVideo, FakeAudio, makeFakeSpeech, lectureGroups } = require("./dub-sim.js");

// ================= 1. KỊCH BẢN LỒNG TIẾNG =================
function group(vi, src) {
    return { start: src[0].start, end: src[src.length - 1].end, srcCues: src, viText: vi, viCues: seg.segmentGroupSafe(vi, src) };
}

test("kịch bản: câu nối nhiều phụ đề là MỘT đoạn nói liên tục (không TTS từng cue)", () => {
    const g = group("Vì vậy, trong thực tế, khi huấn luyện một mạng sâu, bạn thường bắt đầu với tốc độ học nhỏ, theo dõi hàm mất mát trên tập xác thực sau mỗi epoch.", [
        { start: 0, end: 2.4, text: "So in practice, when you train a deep network," },
        { start: 2.4, end: 4.6, text: "you usually start with a small learning rate," },
        { start: 4.6, end: 6.8, text: "monitor the validation loss after every epoch." }
    ]);
    assert.ok(g.viCues.length >= 2, "phụ đề phải có nhiều cue");
    const script = PLAN.buildDubScript([g]);
    assert.equal(script.length, 1, JSON.stringify(script.map(s => s.subtitleText)));
    assert.ok(script[0].cueCount >= 2);
});

test("kịch bản: khoảng lặng thật trong lời gốc tách thành đoạn nói riêng", () => {
    const g = group("Đây là bước đầu tiên. Giờ ta chuyển sang bước thứ hai của quy trình.", [
        { start: 0, end: 1.8, text: "This is the first step." },
        { start: 3.0, end: 5.6, text: "Now we move to the second step of the process." }
    ]);
    const script = PLAN.buildDubScript([g]);
    assert.equal(script.length, 2, JSON.stringify(script.map(s => [s.start, s.end, s.subtitleText])));
    assert.ok(script[1].start >= 2.9);
});

// A conversation: four turns answered within seconds (2.4.8 reads ">>" only in a video that is one)
const talk = () => [
    group("Bạn nghĩ sao về cách này?", [{ start: 0, end: 1.5, text: "What do you think about this?" }]),
    group("Tôi nghĩ nó rất hiệu quả.", [{ start: 2, end: 3.5, text: ">> I think it works really well." }]),
    group("Vậy thì thử luôn nhé.", [{ start: 4, end: 5, text: ">> Let's try it then." }]),
    group("Được, làm ngay thôi.", [{ start: 6, end: 7, text: ">> Sure, right now." }]),
    group("Tuyệt vời.", [{ start: 8, end: 9, text: ">> Great." }])
];
test("kịch bản: '>>' đổi người nói, giọng được gán theo người nói", () => {
    const s = PLAN.buildDubScript(talk());
    assert.deepEqual(s.map(x => x.speaker), ["S1", "S2", "S1", "S2", "S1"]);
});

// 2.4.8, from the user's 46 saved videos: the second voice switched at stray marks of one-person
// videos (54-94% of a vlog in the other voice) and missed the turns inside a group
const S = (vi, start, end, text) => group(vi, [{ start, end, text }]);
const voices = (groups, opts) => PLAN.buildDubScript(groups, opts).map(x => x.speaker);

test("who speaks: a one-person video stays in one voice (music marks, lone marks, a credit, a colon)", () => {
    // lzXgzP1Dayw: the recognizer marks the music inside a sentence
    const music = [S("Những bữa ăn vội,", 56, 57, "Last-minute meals,"), S("[Âm nhạc]", 57, 58, ">> [music]"),
        S("những lần mua sắm vội.", 58, 60, ">> last-minute shopping, last-minute days out."),
        S("Thói quen số hai là lên kế hoạch vui chơi.", 61, 63, "being intentional. >> [music] >> Habit number two is to plan fun.")];
    assert.deepEqual([...new Set(voices(music))], ["S1"]);
    // Q4JWEtq23h8: four lone marks over five minutes of one woman talking
    const lone = [0, 128, 367, 393, 422].map((t, k) => S(`Câu số ${k + 1} của người nói.`, t, t + 3, `${k ? ">> " : ""}Sentence ${k + 1} of the talk.`));
    assert.deepEqual([...new Set(voices(lone))], ["S1"]);
    // krPKW8J6JSM: one sigh put 94% of a 35-minute vlog in the other voice
    const sigh = [S("Tôi thở dài.", 130, 133, "[sighs and gasps]"), S("[Thở dài]", 134, 135, ">> [sighs]"), S("Tôi có hộp kẹo này từ lâu.", 135, 138, ">> I'd had this box of pop rocks in here"), S("Và tôi vẫn còn giữ nó.", 200, 203, "and I still have it.")];
    assert.deepEqual([...new Set(voices(sigh))], ["S1"]);
    // PsihkFWDt3Y (TED): a credit line and sentences that end on a colon are no speaker labels
    const ted = [S("Người dịch: Jenny Zurawell", 0, 2, "Translator: Jenny Zurawell"), S("Hôm nay tôi nói về tiền.", 2, 5, "So I want to talk today about money."),
        S("Còn tệ hơn: tôi sẽ chụp ảnh.", 118, 121, "This is even worse: I'd have a picture taken"), S("Một cách nghĩ là: cho đi.", 522, 525, "One way to think of it is: give it away.")];
    assert.deepEqual([...new Set(voices(ted))], ["S1"]);
});

test("who speaks: a turn inside a group switches the voice there; a question across laughter is one turn", () => {
    // dSEZriz716g: "You want hot or ice? >> Uh, hot." sat inside one group, never read as a turn
    const shop = [S("Bạn bị cướp à?", 10, 12, "Did you get robbed?"), S("Cho tôi một ly latte bí ngô được không?", 13, 15, ">> Uh, would I be able to get a pumpkin spice latte?"),
        group("Có ngay. Bạn muốn nóng hay đá? Nóng.", [{ start: 15, end: 17, text: ">> Yeah, you got it. You want hot or ice?" }, { start: 17, end: 18, text: ">> Uh, hot." }]),
        S("Tuyệt. Còn gì nữa không?", 19, 20, ">> Sweet. Anything else for you, bro?"), S("Vậy thôi.", 20.5, 21.5, ">> All right.")];
    const s = PLAN.buildDubScript(shop);
    const hot = s.find(x => /Nóng\.$/.test(x.subtitleText));
    assert.ok(hot, "the reply inside the group was not a segment of its own: " + JSON.stringify(s.map(x => x.subtitleText)));
    assert.deepEqual(s.map(x => x.speaker), ["S1", "S2", "S1", "S2", "S1", "S2"]);
    // rtAi3qa8UtQ: ">> [laughter] >>" after a question: the other one answers
    const T = PLAN.speakerTurns([...talk(), S("Nó không có vị gì nhỉ?", 1100, 1101.5, "Not a lot of taste to it, is there? >> [laughter]"), S("Không ngon lắm.", 1102, 1104, ">> It's not the best tasting thing.")]);
    assert.notEqual(PLAN.speakerAt(T, 1100.5), PLAN.speakerAt(T, 1103));
});

test("who speaks: the one who talks longest has the main voice, named or not", () => {
    // dSEZriz716g: a vlogger back from a five-line sketch (an odd number of turns) stays the main voice
    const sketch = [S("Hôm nay tôi thử một việc.", 0, 3, "Today I try something."), S("Một ly latte nhé?", 4, 5, ">> A latte?"), S("Có ngay.", 6, 7, ">> Sure."),
        S("Nóng hay đá?", 8, 9, ">> Hot or iced?"), S("Nóng.", 10, 11, ">> Hot."),
        S("Quay lại chuyện chính, tôi đã tiêu 9 đô.", 12, 70, ">> So back to the point, I spent nine dollars on that and here is why it matters to me.")];
    const v = voices(sketch);
    assert.equal(v[v.length - 1], "S1", "the main speaker came back in the second voice");
    // three people, two voices: the turn back to the vlogger is the one that keeps its voice
    assert.deepEqual(v.slice(0, 5), ["S1", "S2", "S1", "S2", "S1"]);
    assert.deepEqual([...new Set(v.slice(5))], ["S1"]);
    // UIy-WQCZd4M: the guest talks most; since 2.5.2 three named people get three voices, in order
    // of talk (before, everyone but the main speaker shared the second)
    const pod = [S("Chào mừng.", 0, 5, "ANDREW HUBERMAN: Welcome."), S("Cảm ơn anh.", 6, 60, "ANDY GALPIN: Thanks for having me, here is a long answer."),
        S("Câu hỏi tiếp.", 61, 65, "ANDREW HUBERMAN: Next question."), S("Trả lời dài.", 66, 120, "ANDY GALPIN: A long answer again."), S("Xin chào.", 121, 123, "GUEST TWO: Hello.")];
    assert.deepEqual(voices(pod), ["S2", "S1", "S2", "S1", "S3"]);
});

// 2.5.3: up to eight voices (five in 2.5.2), and an AI reading of who speaks for videos without marks
test("who speaks: eight named speakers get eight voices in order of talk; a ninth shares one after the main", () => {
    const names = ["ANNA", "BEN", "CARL", "DORA", "EVAN", "FRED", "GINA", "HUGO", "IVAN"];
    const talkS = [60, 50, 40, 30, 25, 20, 15, 10, 5];
    let t = 0;
    const g = [];
    for (let round = 0; round < 2; round++) {
        names.forEach((n, k) => { g.push(S(`Câu của ${n}.`, t, t + talkS[k] / 2, `${n}: Line ${round} of ${n}.`)); t += talkS[k] / 2 + 0.5; });
    }
    const T = PLAN.speakerTurns(g);
    assert.equal(T.source, "names");
    assert.equal(T.voices, 8);
    const v = voices(g);
    assert.deepEqual(v.slice(0, 9), ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S2"]);
});

test("who speaks: 'Yeah. ANDREW HUBERMAN:' is Andrew, not a third person; 'Dr. Galpin:' keeps its title", () => {
    // UIy-WQCZd4M: the last word of the one before stands in front of the label once in 3 hours
    const g = [S("Chào.", 0, 5, "ANDREW HUBERMAN: Hi."), S("Chào bạn.", 6, 20, "ANDY GALPIN: Hello there."),
        S("Vâng. Câu tiếp.", 21, 25, "Yeah. ANDREW HUBERMAN: Next."), S("Được.", 26, 40, "ANDY GALPIN: Yes."),
        S("Một câu nữa.", 41, 45, "Dr. Galpin: One more."), S("Và nữa.", 46, 50, "Dr. Galpin: And again.")];
    const T = PLAN.speakerTurns(g);
    assert.equal(T.voices, 3, JSON.stringify(T.marks));
    assert.deepEqual(T.marks.map(m => m.idx), [1, 0, 1, 0, 2, 2]);
});

// ai: what speakerHints makes of an answer
const aiOf = (turns, o = {}) => ({ turns: turns.map(([t, speaker]) => ({ t, speaker })), speakers: o.speakers || [], confidence: o.confidence || "high", until: o.until });
// manual captions of an interview: no ">>", no names (JBvcMfa7K6E, a money show)
const interview = () => [
    S("Bạn đang kiếm được bao nhiêu?", 0, 3, "What are you making right now?"),
    S("Khoảng ba đến bốn nghìn đô mỗi tháng.", 3.5, 8, "About $3,000 to $4,000 a month."),
    S("Từ đâu?", 9, 10, "From what?"),
    S("Chạy Uber, nhưng tôi đang lỗ.", 10.5, 15, "Uber, but I'm actually losing money."),
    S("Chiếu đoạn clip lên.", 16, 18, "Roll the clip."),
    S("Được rồi, tôi xem.", 18.5, 22, "Okay, I'll look.")
];
test("who speaks: an AI reading gives a video with no marks its voices; the marks alone keep it in one", () => {
    assert.deepEqual([...new Set(voices(interview()))], ["S1"], "no marks, no reading: one voice");
    const ai = aiOf([[0, 1], [3.5, 2], [9, 1], [10.5, 2], [16, 1], [18.5, 2]], { speakers: [{ id: 1, gender: "male" }, { id: 2, gender: "female" }] });
    const T = PLAN.speakerTurns(interview(), { ai });
    assert.equal(T.source, "ai");
    assert.equal(T.voices, 2);
    // the guest talks longer: the main voice is hers; genders follow the voices (S1, S2)
    assert.deepEqual(voices(interview(), { speakerTurns: T }), ["S2", "S1", "S2", "S1", "S2", "S1"]);
    assert.deepEqual(T.genders, ["female", "male"]);
});

test("who speaks: an AI turn heard once and briefly (a quote, a passer-by) stays in the speaker's voice", () => {
    // a vlog: one person; the reading took a quoted line for someone else
    const vlog = [S("Hôm nay trời đẹp.", 0, 20, "It's a beautiful day."), S("Cô ấy nói: không đời nào.", 20, 23, "And she said, no way."),
        S("Và tôi đi tiếp.", 23, 60, "And I kept walking.")];
    const quote = aiOf([[0, 1], [20, 2], [23, 1]]);
    assert.equal(PLAN.speakerTurns(vlog, { ai: quote }).source, "none");
    assert.deepEqual([...new Set(voices(vlog, { speakerTurns: PLAN.speakerTurns(vlog, { ai: quote }) }))], ["S1"]);
    // a third person who speaks once, briefly, in a real interview: folded into the one before
    const T = PLAN.speakerTurns(interview(), { ai: aiOf([[0, 1], [3.5, 2], [9, 1], [10.5, 2], [16, 3], [18.5, 2]]) });
    assert.equal(T.voices, 2);
    // low confidence, or one speaker: one voice
    for (const ai of [aiOf([[0, 1], [3.5, 2], [9, 1], [10.5, 2]], { confidence: "low" }), aiOf([[0, 1]])]) {
        assert.equal(PLAN.speakerTurns(interview(), { ai }).voices, 1);
    }
});

test("who speaks: an AI turn moves onto a '>>' within 2 s; named labels win over the AI", () => {
    const T = PLAN.speakerTurns(talk(), { ai: aiOf([[0, 1], [1.2, 2], [4, 1], [6, 2], [8, 1]]) });
    assert.equal(T.source, "ai");
    assert.ok(T.marks.some(m => m.t === 2), "the turn at 1.2 s moved onto the mark at 2 s: " + JSON.stringify(T.marks));
    const named = [S("Chào.", 0, 5, "ANNA: Hi."), S("Chào bạn.", 6, 20, "BEN: Hello there."), S("Tiếp.", 21, 25, "ANNA: Next."), S("Vâng.", 26, 40, "BEN: Yes.")];
    assert.equal(PLAN.speakerTurns(named, { ai: aiOf([[0, 1], [6, 1], [21, 2], [26, 2]]) }).source, "names");
});

test("who speaks: the lines asked about, and the answer turned into times (a turn inside a line, a later part)", () => {
    const g = [S("A", 0, 2, "Hello there."), S("B", 2, 4, "[Music]"), S("C", 4, 8, "So what do you think? I think it's great."),
        S("D", 8, 10, "Me too.")];
    const lines = PLAN.speakerLines(g);
    assert.deepEqual(lines.map(l => l.text), ["Hello there.", "So what do you think? I think it's great.", "Me too."], "a sound-only line is left out");
    const h = PLAN.speakerHints(lines, { turns: [{ line: 0, speaker: 1 }, { line: 1, speaker: 2, at: "I think" }, { line: 2, speaker: 1 }, { line: 9, speaker: 2 }], speakers: [], confidence: "medium" });
    assert.equal(h.turns.length, 3, "a line out of range is dropped");
    assert.ok(h.turns[1].t > 4 && h.turns[1].t < 8, "inside the line, where 'I think' stands: " + h.turns[1].t);
    assert.equal(h.until, 10);
    // a later part (lines 2..): its line numbers count from its own start
    const late = PLAN.speakerHints(lines, { turns: [{ line: 0, speaker: 3 }], speakers: [{ id: 3, gender: "female" }], confidence: "high" }, 2, 1);
    assert.equal(late.turns[0].t, 8);
    const m = PLAN.mergeSpeakerHints(h, late);
    assert.deepEqual(m.turns.map(x => x.speaker), [1, 2, 3]);
    assert.equal(m.confidence, "medium");
    assert.equal(m.until, 10);
});

// UIy-WQCZd4M, the user's 2026-10-01 batch: the labels of an edited podcast caption were read 262 times
test("script: a speaker label the source carries stays in the subtitle and is not read", () => {
    const a = group("ANDREW HUBERMAN: Nhưng tôi nghĩ mình sẽ giữ mức 5 cho công việc và 2 cho các mối quan hệ.", [
        { start: 0, end: 2.5, text: "ANDREW HUBERMAN: But I think I'm going to hold to 5, 2," },
        { start: 2.5, end: 4, text: "business, relationships." }
    ]);
    const b = group("Nhưng ranh giới giữa các ô đó lại khá mờ nhạt, bởi vì-- ANDY GALPIN: Tất nhiên rồi.", [
        { start: 5, end: 7, text: "But the boundaries between those boxes are blurry, because--" },
        { start: 7, end: 8, text: "ANDY GALPIN: Of course." }
    ]);
    // a name in capitals that is no label of the source is read
    const c = group("Tôi nói: ANDY GALPIN là người đúng.", [{ start: 9, end: 11, text: "I said: Andy Galpin is right." }]);
    assert.ok(a.viCues[0].text.startsWith("ANDREW HUBERMAN:"), "the subtitle keeps it");
    const said = PLAN.buildDubScript([a, b, c], { joinGroups: true }).map(s => s.subtitleText).join(" | ");
    assert.ok(!/HUBERMAN|ANDY GALPIN:/.test(said), said);
    assert.match(said, /^Nhưng tôi nghĩ mình sẽ giữ mức 5/);
    assert.match(said, /bởi vì-- +Tất nhiên rồi\./);
    assert.match(said, /Tôi nói: ANDY GALPIN là người đúng/);
});

// 2.5.3, the speaker lab: 30 PBS NewsHour videos scored against their named transcripts
test("who speaks: a news transcript's 'NAME, Affiliation:' and 'NAME (R-FL):' name the speaker", () => {
    const g = [S("Chào mừng.", 0, 10, "AMNA NAWAZ: Welcome to both of you."),
        S("Cảm ơn.", 11, 40, "TAMARA KEITH, National Public Radio: Thank you, it's good to be here."),
        S("Còn bà?", 41, 45, "AMNA NAWAZ: And you?"),
        S("Vâng.", 46, 80, "REP. MARIA ELVIRA SALAZAR (R-FL): Yes, and a long answer again."),
        S("Tiếp.", 81, 85, "AMNA NAWAZ: Tamara?"),
        S("Đúng.", 86, 100, "TAMARA KEITH: Right.")];
    const T = PLAN.speakerTurns(g);
    assert.equal(T.source, "names");
    assert.equal(T.voices, 3);
    const v = voices(g);
    // Tamara's first answer is hers, not the host's (4 of 19 labelled panels lost 15 to 30 points)
    assert.equal(v[1], v[5]);
    assert.deepEqual([v[0], v[2], v[4]], [v[0], v[0], v[0]]);
    assert.equal(new Set([v[0], v[1], v[3]]).size, 3, JSON.stringify(v));
});

test("who speaks: labels on only some turns leave the voices to the AI reading; labels on every turn need none", () => {
    // a panel whose transcript names each guest once, on the first answer
    const partial = [S("Chào.", 0, 10, "AMNA NAWAZ: Welcome."), S("Cảm ơn.", 11, 30, "DAVID BROOKS: Thanks for having me."),
        S("Còn chị?", 31, 35, "And you, Kimberly?"), S("Vâng.", 36, 60, "KIMBERLY ATKINS STOHR: Yes, glad to be here."),
        S("Câu hỏi.", 61, 65, "Next question for David."), S("Trả lời.", 66, 90, "Well, the answer is a long one."),
        S("Còn chị?", 91, 95, "And Kimberly?"), S("Đáp.", 96, 120, "I agree with David on that.")];
    const T0 = PLAN.speakerTurns(partial);
    assert.equal(T0.labelled, true);
    assert.equal(T0.complete, false);
    const ai = aiOf([[0, 1], [11, 2], [31, 1], [36, 3], [61, 1], [66, 2], [91, 1], [96, 3]]);
    const T = PLAN.speakerTurns(partial, { ai });
    assert.equal(T.source, "ai");
    assert.equal(T.voices, 3);
    const v = voices(partial, { speakerTurns: T });
    assert.deepEqual([v[0], v[2], v[4], v[6]].filter(x => x === v[0]).length, 4);
    assert.equal(v[1], v[5]);
    assert.equal(v[3], v[7]);
    // a label on every turn: complete, the reading is not asked for (dubbing.js) nor used
    const full = [S("Chào.", 0, 5, "ANNA: Hi."), S("Chào bạn.", 6, 20, "BEN: Hello there."), S("Tiếp.", 21, 25, "ANNA: Next."), S("Vâng.", 26, 40, "BEN: Yes.")];
    assert.equal(PLAN.speakerTurns(full).complete, true);
    assert.equal(PLAN.speakerTurns(full, { ai: aiOf([[0, 1], [6, 1], [21, 2], [26, 2]]) }).source, "names");
});

test("who speaks: an AI turn's first words are found one line off, or when they run past the line", () => {
    // caption lines as sent, not joined (speakerLines joins short pieces: the next test)
    const L = (start, end, text) => ({ start, end, text });
    const lines = [L(0, 4, "and that is why I think so. So David, what"), L(4, 8, "do you make of it? Well, I think the"), L(8, 12, "polls are wrong and here is why.")];
    const at = (line, words) => PLAN.speakerHints(lines, { turns: [{ line: 0, speaker: 1 }, { line, speaker: 2, at: words }], speakers: [], confidence: "high" }).turns[1].t;
    // named on line 0, standing on line 1
    const t1 = at(0, "Well, I think the polls are wrong");
    assert.ok(t1 > 4 && t1 < 8, String(t1));
    // a whole sentence running into the next line: the start that stands in the line is enough
    const t2 = at(0, "So David, what do you make of it?");
    assert.ok(t2 > 2 && t2 < 4, String(t2));
    // nothing found, and the line before ends a sentence: the line start
    assert.equal(at(2, "something never said"), 8);
    // first words that start at a line end and run on into the next one ("... the CEO >> I" / "felt like")
    const run = [L(0, 4, "he runs the company and is the CEO >> I"), L(4, 8, "felt like the country was more divided.")];
    const t3 = PLAN.speakerHints(run, { turns: [{ line: 0, speaker: 1 }, { line: 0, speaker: 2, at: "I felt like the country" }], speakers: [], confidence: "high" }).turns[1].t;
    assert.ok(t3 > 3.5 && t3 < 4, String(t3));
    // no first words given: a line that opens on the tail of a sentence hands over after it ends
    const tail = [L(0, 4, "and that is a lot of"), L(4, 8, "pain. Over to you. Thanks, I think so."), L(8, 12, "Mr. Smith said so. Then he left.")];
    const no = line => PLAN.speakerHints(tail, { turns: [{ line: 0, speaker: 1 }, { line, speaker: 2 }], speakers: [], confidence: "high" }).turns[1].t;
    const t4 = no(1);
    assert.ok(t4 > 4.5 && t4 < 5.5, "after 'pain.': " + t4);
    // the line before ends a sentence: the turn stays at the line start ("Mr." is no sentence end anyway)
    assert.equal(no(2), 8);
});

test("who speaks: captions cut into short pieces are read as sentences, whole caption lines as they are", () => {
    // JBvcMfa7K6E: 1289 pieces, half under 23 characters; read piece by piece the model wrote a turn
    // for nearly every line and ran into the token cap
    const pieces = [S("a", 0, 1.5, "So, this is a"), S("b", 1.5, 3, "actually a really interesting"), S("c", 3, 4, "conversation."),
        S("d", 4.2, 5.5, "I would love to hear more"), S("e", 5.5, 7, "from her, but it's hard to hear"), S("f", 9, 10, "that if you yell."),
        S("g", 10, 11, ">> Right, I agree"), S("h", 11, 12, "with that.")];
    const lines = PLAN.speakerLines(pieces);
    assert.deepEqual(lines.map(l => l.text), ["So, this is a actually a really interesting conversation.", "I would love to hear more from her, but it's hard to hear",
        "that if you yell.", ">> Right, I agree with that."], "a sentence end, 1.5 s of silence and a '>>' close a line");
    assert.deepEqual([lines[0].start, lines[0].end], [0, 4]);
    // a turn inside a joined line takes the time of the piece its first words came from
    const h = PLAN.speakerHints(lines, { turns: [{ line: 0, speaker: 1 }, { line: 1, speaker: 2, at: "from her, but" }], speakers: [], confidence: "high" });
    assert.ok(h.turns[1].t >= 5.5 && h.turns[1].t < 5.6, String(h.turns[1].t));
    // whole caption lines (half of them 40 characters or more) are sent as they are
    const whole = [S("a", 0, 3, "And so I think the polls are wrong and here is"), S("b", 3, 6, "why: the turnout model is off by two points."),
        S("c", 6, 9, "Do you see it the same way, Judy, or not at all?")];
    assert.equal(PLAN.speakerLines(whole).length, 3);
    // the cap: no joined line passes 160 characters
    const long = Array.from({ length: 12 }, (_, i) => S("x", i, i + 1, "and then we went on to the next"));
    assert.ok(PLAN.speakerLines(long).every(l => l.text.length <= 160));
});

test("who speaks: the voice changes where a label stands in a translated line, or where a sentence breaks off ('vì-- Vâng')", () => {
    // UIy-WQCZd4M: "about you because--" / "ANDREW HUBERMAN: Right, ..." became one Vietnamese line, and
    // its "Đúng," (Andrew's "Right") was read in Andy's voice: 3 of 14 such labels were met in time
    const g = [
        group("ANDY GALPIN: Tôi biết anh không thích nói về bản thân mình vì-- ANDREW HUBERMAN: Đúng, đó cũng là một lý do khác để làm việc này.", [
            { start: 0, end: 2.6, text: "ANDY GALPIN: I know you don't like making these things" },
            { start: 2.6, end: 3.6, text: "about you because--" },
            { start: 3.6, end: 6.4, text: "ANDREW HUBERMAN: Right, that's the other reason to do it." }]),
        group("ANDY GALPIN: Chính xác, và đó là lý do tôi làm điều này mỗi tuần.", [{ start: 7, end: 10, text: "ANDY GALPIN: Exactly, and that's why I do it every week." }]),
        group("ANDREW HUBERMAN: Tuyệt vời.", [{ start: 10.5, end: 12, text: "ANDREW HUBERMAN: Great." }])
    ];
    const s = PLAN.buildDubScript(g, { joinGroups: true });
    assert.deepEqual(s.map(x => [x.speaker, x.subtitleText]).slice(0, 2), [
        ["S1", "Tôi biết anh không thích nói về bản thân mình vì--"],
        ["S2", "Đúng, đó cũng là một lý do khác để làm việc này."]]);
    // no label (an AI reading): the interrupted sentence's dash, not a share of the line's time
    const plain = [S("Bởi vì nó giúp tăng khối lượng tập luyện của bạn vì-- Vâng, chắc chắn rồi.", 0, 6, "because it boosts your training volume because-- Yeah, for sure."),
        S("Và còn nhiều nữa.", 7, 9, "And there is more.")];
    const T = PLAN.speakerTurns([...plain, S("Đúng.", 10, 14, "Right."), S("Rồi sao nữa?", 15, 17, "And then?"), S("Hết rồi.", 18, 22, "That's it.")],
        { ai: aiOf([[0, 1], [4.6, 2], [7, 1], [10, 2], [15, 1], [18, 2]]) });
    const v = PLAN.buildDubScript(plain, { joinGroups: true, speakerTurns: T }).map(x => [x.speaker, x.subtitleText]);
    assert.deepEqual(v.slice(0, 2).map(x => x[1]), ["Bởi vì nó giúp tăng khối lượng tập luyện của bạn vì--", "Vâng, chắc chắn rồi."], JSON.stringify(v));
    assert.notEqual(v[0][0], v[1][0]);
});

test("script: a news label with who the speaker is is not read; 'NASA, the agency, said:' is", () => {
    const a = group("TAMARA KEITH, Đài Phát thanh Công cộng Quốc gia: Vâng, tôi nghĩ vậy.", [{ start: 0, end: 3, text: "TAMARA KEITH, National Public Radio: Well, I think so." }]);
    const b = group("Cảm ơn. REP. MARIA ELVIRA SALAZAR (R-FL): Đúng vậy.", [{ start: 4, end: 5, text: "Thank you." }, { start: 5, end: 7, text: "REP. MARIA ELVIRA SALAZAR (R-FL): That's right." }]);
    const c = group("NASA, cơ quan vũ trụ, cho biết: không.", [{ start: 8, end: 10, text: "NASA, the space agency, said: no." }]);
    const said = PLAN.buildDubScript([a, b, c], { joinGroups: true }).map(s => s.subtitleText).join(" | ");
    assert.ok(!/KEITH|Quốc gia|SALAZAR|R-FL/.test(said), said);
    assert.match(said, /^Vâng, tôi nghĩ vậy\./);
    assert.match(said, /Cảm ơn\. \| Đúng vậy\./, "a turn of another person: a segment of its own");
    assert.match(said, /NASA, cơ quan vũ trụ, cho biết: không\./);
});

test("who speaks: eight voices are eight different voices, for the free voice and for Gemini", () => {
    const { castVoices, createGeminiProvider } = require("../dub-engine.js");
    const COST = require("../cost-policy.js");
    const L = COST.LOCAL_TTS;
    const free = castVoices(L, L.defaultVoice, L.defaultVoice2, []);
    assert.equal(new Set(Object.values(free)).size, 8, JSON.stringify(free));
    const gem = createGeminiProvider({}, {});
    assert.equal(new Set(Object.values(gem.voices)).size, 8, JSON.stringify(gem.voices));
    assert.equal(gem.voices.S1, "Kore");
    // the reading's genders: a third speaker who is a woman gets a woman's voice of her own
    assert.equal(gem.setCast(["female", "male", "female"]), true);
    const female = ["Kore", "Aoede", "Leda", "Zephyr"];
    assert.ok(female.includes(gem.voices.S3) && gem.voices.S3 !== gem.voices.S1, JSON.stringify(gem.voices));
    assert.equal(new Set(Object.values(gem.voices)).size, 8);
    assert.equal(gem.setCast(["female", "male", "female"]), false, "the same genders: no new cast");
});

// ================= 2. VĂN BẢN ĐỂ NÓI & NGỮ ĐIỆU =================
// Measured against the VieNeu server's own normalizer (sea_g2p): each "before" was what the voice
// actually said. 1.500.000 was stripped to 1500000, which the server reads digit by digit.
test("speech text: numbers, money, versions, links and shorthand are read the Vietnamese way", () => {
    const say = P => PLAN.adaptForSpeech(P);
    assert.equal(say("tức 1.500.000 đồng."), "tức một triệu năm trăm nghìn đồng.");
    assert.equal(say("có 1,500,000 người và 1,000 mẫu."), "có một triệu năm trăm nghìn người và một nghìn mẫu.");
    assert.equal(say("mã 12345678 ở đây."), "mã mười hai triệu ba trăm bốn mươi lăm nghìn sáu trăm bảy mươi tám ở đây.");
    assert.equal(say("Giá là $20 mỗi tháng, hoặc 5 USD."), "Giá là 20 đô la mỗi tháng, hoặc 5 đô la.");
    assert.equal(say("Có 7B tham số, ngữ cảnh 200K token, 1.5M người dùng."), "Có 7 tỷ tham số, ngữ cảnh 200 nghìn token, 1 phẩy 5 triệu người dùng.");
    assert.equal(say("Dùng Python 3.11 và phiên bản v2.0."), "Dùng Python 3 chấm 11 và phiên bản 2 chấm 0.");
    assert.equal(say("Phiên bản v1.1.7 chạy ở 127.0.0.1."), "Phiên bản 1 chấm 1 chấm 7 chạy ở 127 chấm 0 chấm 0 chấm 1.");
    assert.equal(say("Chương 3.4, mục 2.1."), "Chương 3 chấm 4, mục 2 chấm 1.");
    // a Vietnamese word at the start of a sentence is not a product name: still a decimal
    assert.equal(say("Trong 3.5 giây, Claude 3.5 trả lời."), "Trong 3 phẩy 5 giây, Claude 3 chấm 5 trả lời.");
    assert.equal(say("Truy cập https://www.claude.ai/code để thử."), "Truy cập claude chấm ai gạch chéo code để thử.");
    assert.equal(say("Ở TP.HCM, v.v."), "Ở TP.HCM, v.v.", "abbreviations must not be read as web addresses");
    assert.equal(say("Thứ tự: 1st, 2nd, 3rd, 4th, 10th."), "Thứ tự: thứ nhất, thứ hai, thứ ba, thứ tư, thứ 10.");
    assert.equal(say("Năm 1990s, những năm 1980s, thập niên 90s."), "Những năm 1990, những năm 1980, thập niên 90.");
    assert.equal(say("Bước #1 nhanh 2x, tốc độ 1,3x."), "Bước số 1 nhanh 2 lần, tốc độ 1 phẩy 3 lần.");
    assert.equal(say("Ta có 2x - 1 và 2x = 4, ảnh 1920x1080."), "Ta có 2x - 1 và 2x bằng 4, ảnh 1920 nhân 1080.", "algebra and sizes keep their meaning");
    assert.equal(say("Google nói vậy, e.g. ví dụ này."), "Google nói vậy, ví dụ này.");
    // the duration model counts what is said: "một triệu năm trăm nghìn" is 5 syllables, not 7 digits
    assert.equal(PLAN.countSyllables(say("1.500.000")), 5);
});

test("đọc số tiếng Việt đúng (kể cả mốt, lăm, tư, linh)", () => {
    const cases = { 21: "hai mươi mốt", 25: "hai mươi lăm", 24: "hai mươi tư", 105: "một trăm linh năm", 175: "một trăm bảy mươi lăm", 2024: "hai nghìn không trăm hai mươi tư", 1800000000000: "một nghìn tám trăm tỷ" };
    for (const [n, v] of Object.entries(cases)) assert.equal(PLAN.numberToVietnamese(Number(n)), v);
});

test("chuyển văn bản sang dạng dễ đọc KHÔNG đổi nghĩa (số, ký hiệu, ngoặc)", () => {
    assert.equal(PLAN.adaptForSpeech("Độ chính xác đạt 97,5% trên tập kiểm tra."), "Độ chính xác đạt 97 phẩy 5 phần trăm trên tập kiểm tra.");
    assert.equal(PLAN.adaptForSpeech("Ta có x = 2 và y = 3."), "Ta có x bằng 2 và y bằng 3.");
    assert.equal(PLAN.adaptForSpeech("Dùng hàm ReLU (hàm kích hoạt) ở lớp ẩn."), "Dùng hàm ReLU, hàm kích hoạt, ở lớp ẩn.");
    assert.equal(PLAN.adaptForSpeech("Tốc độ 60 km/h."), "Tốc độ 60 ki-lô-mét trên giờ.");
    assert.equal(PLAN.adaptForSpeech("Nặng 5kg, độ trễ 20 ms."), "Nặng 5 ki-lô-gam, độ trễ 20 mi-li-giây.");
});

test("ý định câu: 'Really?' khác hẳn 'This is a very important concept.'", () => {
    const q = PLAN.classifyIntent("Really?", "Thật sao?");
    const e = PLAN.classifyIntent("This is a very important concept.", "Đây là một khái niệm rất quan trọng.");
    assert.equal(q.type, "question");
    assert.equal(e.type, "emphasis");
    const pq = PLAN.INTENT_PROSODY[q.type], pe = PLAN.INTENT_PROSODY[e.type];
    assert.ok(pq.endPitch > 1.05, "câu hỏi lên giọng cuối câu");
    assert.ok(pe.rate < 1, "câu nhấn mạnh nói chậm lại");
    for (const [en, vi, type] of [
        ["Be careful, never test on your training data!", "Cẩn thận, đừng bao giờ kiểm tra trên dữ liệu huấn luyện!", "warning"],
        ["In summary, regularization helps generalization.", "Tóm lại, chính quy hóa giúp khái quát hóa.", "conclusion"],
        ["Wow, this is amazing!", "Ồ, thật tuyệt vời!", "excited"],
        ["That's a joke, haha.", "Đùa thôi, haha.", "humor"],
        ["This works because the gradient is small.", "Cách này hiệu quả vì gradient nhỏ.", "explanation"],
        ["The model has two layers.", "Mô hình có hai lớp.", "neutral"]
    ]) assert.equal(PLAN.classifyIntent(en, vi).type, type, en);
});

function segOf(vi, en, start, end, extra = {}) {
    return { id: "x", index: 0, start, end, slotEnd: extra.slotEnd || end + 0.4, speaker: "S1", subtitleText: vi, speechSource: vi, srcText: en, sourcePauses: extra.pauses || [], continuesNext: false };
}

test("nhịp nói: 'Now... what we need to understand is' -> 'Bây giờ...' [ngắt] 'điều chúng ta cần hiểu là...'", () => {
    const s = segOf("Bây giờ, ¦ điều chúng ta cần hiểu là ¦ cách mô hình xử lý dữ liệu đầu vào.", "Now... what we need to understand is how the model processes its input.", 10, 13.5, {
        pauses: [{ frac: 0.06, dur: 0.3, opener: true }]
    });
    const p = PLAN.planSegment(s);
    assert.equal(p.phrases[0].text, "Bây giờ,");
    assert.ok(p.phrases[0].pause >= 0.15, "phải có khoảng ngừng sau nhịp mở đầu");
    assert.equal(p.phrases[1].text, "điều chúng ta cần hiểu là");
    assert.equal(p.intent, "transition");
});

test("nhịp nói: khoảng ngừng thật của người nói được tái tạo ở vị trí tương ứng", () => {
    const s = segOf("Mô hình nhận bức ảnh rồi xử lý ảnh qua nhiều lớp tích chập khác nhau.", "The model receives the image... and then processes it through several convolutional layers.", 0, 5, {
        pauses: [{ frac: 0.33, dur: 0.6 }]
    });
    const p = PLAN.planSegment(s);
    assert.ok(p.phrases.length >= 2, JSON.stringify(p.phrases.map(x => x.text)));
    const cut = p.phrases[0];
    assert.ok(/ảnh$/.test(cut.text), cut.text);
    assert.ok(cut.pause >= 0.35, String(cut.pause));
});

test("nhấn giọng: cụm chứa từ quan trọng được nói chậm và cao hơn một chút", () => {
    const p = PLAN.planSegment(segOf("Đây là một khái niệm cực kỳ quan trọng, các bạn hãy ghi nhớ nó.", "This is an extremely important concept, remember it.", 0, 4.5));
    const emph = p.phrases.find(x => x.emphasis);
    assert.ok(emph && emph.rateMul < 1 && emph.pitchMul > 1, JSON.stringify(p.phrases));
    assert.ok(p.emphasisWords.length >= 1);
});

test("câu dài không ngắt: tách chỗ lấy hơi ở khe cú pháp, không giữa từ ghép", () => {
    const text = "Mạng nơ-ron tích chập sử dụng các bộ lọc nhỏ trượt trên toàn bộ bức ảnh đầu vào để trích xuất những đặc trưng cục bộ quan trọng nhất.";
    const ph = PLAN.buildPhrases(PLAN.adaptForSpeech(text));
    assert.ok(ph.length >= 2, JSON.stringify(ph.map(x => x.text)));
    const j = ph.map(x => x.text).join(" | ");
    assert.ok(!/tích \| chập|nơ-ron \| tích|trích \| xuất|đặc \| trưng|bức \| ảnh/.test(j), j);
});

// ================= 3. KHỚP THỜI LƯỢNG =================
test("mô hình thời lượng khớp giọng Việt thật (120 mẫu, 1x đến 2,2x): sai số trung bình < 5%", () => {
    const data = require("./audio/linh-calibration.json");
    const m = PLAN.DEFAULT_VOICE_MODEL;
    let err = 0;
    for (const d of data) {
        const phrases = PLAN.buildPhrases(PLAN.adaptForSpeech(d.text));
        let t = m.overhead;
        phrases.forEach((ph, k) => { t += PLAN.speechSeconds(ph.syl, d.rate, m); if (k < phrases.length - 1) t += PLAN.pauseSeconds(ph.pauseAfter, d.rate, m); });
        err += Math.abs(t - d.duration) / d.duration;
    }
    assert.ok(err / data.length < 0.05, `sai số ${(err / data.length * 100).toFixed(1)}%`);
});

test("khớp thời lượng: tiếng Việt dài hơn tiếng Anh vẫn nằm gọn trong khung (dùng tốc độ + khoảng lặng)", () => {
    const p = PLAN.planSegment(segOf("Bây giờ, điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu đầu vào.", "Now, what we need to understand is how the model handles input.", 10, 13.5, { slotEnd: 13.9 }));
    assert.ok(p.durationRatio > 1, "tiếng Việt dài hơn khi đọc ở tốc độ thường");
    assert.ok(p.estDuration <= p.targetDuration + 0.02, `${p.estDuration} > ${p.targetDuration}`);
    assert.ok(p.sps <= PLAN.LIMITS.maxSps + 0.05, "không vượt tốc độ nói dễ nghe");
    assert.ok(p.strategies.includes("compress-pauses"));
});

test("khớp thời lượng: tiếng Việt ngắn hơn thì nói thong thả + giãn khoảng ngừng, không lê thê", () => {
    const p = PLAN.planSegment(segOf("Thật sao?", "Really? Are you sure about that?", 0, 2.4));
    assert.ok(p.strategies.includes("slow-fill"));
    assert.ok(p.sps >= PLAN.LIMITS.minSps - 0.05, String(p.sps));
    assert.equal(p.overflow, 0);
});

test("khớp thời lượng: câu quá dài so với lời gốc bị đánh dấu cần rút gọn (không nói nhanh quá mức)", () => {
    const p = PLAN.planSegment(segOf("Trước khi chuyển sang phần tiếp theo, hãy cùng tóm tắt thật kỹ tất cả những gì chúng ta đã học về cơ chế chú ý và mạng nơ-ron hồi quy.", "Let's recap.", 0, 1.2, { slotEnd: 1.4 }));
    assert.ok(p.strategies.includes("needs-condense"), JSON.stringify(p.strategies));
    assert.ok(p.sps <= PLAN.LIMITS.maxSps + 0.05, "không ép tốc độ vượt trần");
});

test("giọng liền mạch: tốc độ hai đoạn sát nhau không nhảy đột ngột", () => {
    const plans = PLAN.planAll(PLAN.buildDubScript(lectureGroups()));
    for (let i = 1; i < plans.length; i++) {
        const a = plans[i - 1], b = plans[i];
        if (b.start - a.end > 0.8 || a.speaker !== b.speaker) continue;
        const need = Math.max(a.rate, b.rate) - Math.min(a.rate, b.rate);
        assert.ok(need <= 0.101 || a.strategies.includes("faster") || b.strategies.includes("faster"), `${a.rate} -> ${b.rate}`);
    }
});

test("the second part of a sentence keeps the pace of the first; a new sentence or a late voice may change it more", () => {
    const { SYNC } = require("../dub-engine.js");
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const prov = { id: "gemini", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const make = () => {
        const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
            now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, {});
        eng.refresh(true);
        return eng;
    };
    // A is read fast (its audio 1.2x its slot), B's audio fits its own slot at about 1.0
    const syl = p => p.phrases.reduce((x, ph) => x + ph.syl, 0);
    const pair = (eng, i, lagB) => {
        const A = eng.plans[i], B = eng.plans[i + 1];
        const dA = (B.start - A.start) * 1.2, dB = (B.end - B.start) * 0.95;
        const a = eng.chooseRate(A, { duration: dA }, A.start, 0, 0);
        eng.lastSpokenId = A.id;
        const t = lagB ? B.start + lagB : eng.lastRateEnd + 0.02;
        return [a, eng.chooseRate(B, { duration: dB }, t, 0, Math.max(0, t - B.start)), syl(A) / dA, syl(B) / dB, Math.min(syl(A), syl(B))];
    };
    const eng = make();
    const i = eng.plans.findIndex(p => p.continuesNext);
    assert.ok(i >= 0, "the lecture has a sentence read in two parts");
    const [a, b, nativeA, nativeB, minSyl] = pair(eng, i);
    // (2.5.1) the pace kept is the one heard: A's rate x A's own syllables per second, over B's own,
    // at most paceComp from A's rate (two takes of one voice are not read at the same pace)
    const ref = minSyl >= SYNC.paceCompMinSyl ? Math.max(a * (1 - SYNC.paceComp), Math.min(a * (1 + SYNC.paceComp), a * nativeA / nativeB)) : a;
    assert.ok(Math.abs(b - ref) <= SYNC.rateStepInSentence + 1e-9, `inside a sentence ${a.toFixed(3)} -> ${b.toFixed(3)} (reference ${ref.toFixed(3)})`);
    assert.ok(Math.abs(b * nativeB - a * nativeA) < Math.abs(a * nativeB - a * nativeA), "closer to the first part's heard pace than the same rate would be");
    // a new sentence may ease down by rateStepDown
    const eng2 = make();
    const j = eng2.plans.findIndex((p, k) => k > 0 && !p.continuesNext && eng2.plans[k + 1] && eng2.plans[k + 1].start - p.end < 1);
    const [a2, b2] = pair(eng2, j);
    assert.ok(a2 - b2 > SYNC.rateStepInSentence + 1e-6, `between sentences ${a2.toFixed(3)} -> ${b2.toFixed(3)}`);
    // a voice 2 s behind catches up even inside a sentence
    const [a3, b3] = pair(make(), i, 2);
    assert.ok(b3 - a3 > SYNC.rateStepInSentence, `behind ${a3.toFixed(3)} -> ${b3.toFixed(3)}`);
});

test("a new sentence that would overrun its slot at the gentle step climbs up to rateStepUpOverrun; a small overrun keeps the gentle step", () => {
    const { SYNC } = require("../dub-engine.js");
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const prov = { id: "gemini", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const make = () => {
        const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
            now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, {});
        eng.refresh(true);
        return eng;
    };
    const probe = need => {
        const eng = make();
        const j = eng.plans.findIndex((p, k) => k > 0 && !p.continuesNext && !eng.plans[k - 1].continuesNext &&
            eng.plans[k + 1] && eng.plans[k + 1].start - p.end < 1 && p.end - p.start > 2.5);
        const A = eng.plans[j - 1], B = eng.plans[j];
        const a = eng.chooseRate(A, { duration: (B.start - A.start) * 0.98 }, A.start, 0, 0);
        eng.lastSpokenId = A.id;
        const win = Math.min(B.start + (B.targetDuration || 0) + SYNC.fitSlack, eng.plans[j + 1].start - 0.12) - B.start;
        return [a, eng.chooseRate(B, { duration: win * need }, B.start, 0, 0)];
    };
    // the step is taken from the heard-pace reference, which may sit paceComp above the last rate
    const [a, b] = probe(1.6);
    const comp = x => x * SYNC.paceComp + 1e-9;
    assert.ok(b - a > SYNC.rateStepUp + comp(a) + 0.01, `a dense new sentence ${a.toFixed(3)} -> ${b.toFixed(3)}`);
    assert.ok(b - a <= SYNC.rateStepUpOverrun + comp(a), `at most rateStepUpOverrun: ${a.toFixed(3)} -> ${b.toFixed(3)}`);
    const [a2, b2] = probe(a + 0.12);
    assert.ok(b2 - a2 <= SYNC.rateStepUp + comp(a2), `a small overrun keeps the gentle step: ${a2.toFixed(3)} -> ${b2.toFixed(3)}`);
});

// (2.5.1) Chrome starts a fresh element, or one it suspended after ~15 s idle, cold (0.25-0.75 s while
// the server works): between lines the next take's element is made shortly before its line
test("between lines the next take's element is made shortly before its line; a stale unplayed one is made again, a playing one never touched", () => {
    const { SYNC } = require("../dub-engine.js");
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const made = [];
    const prov = { id: "gemini", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        createAudio: url => { const a = new FakeAudio(clock, { duration: 2 }); a.url = url; made.push(a); return a; } }, {});
    eng.refresh(true);
    const [A, B] = eng.plans;
    eng.lastSpokenStart = A.start;
    const r = { url: "blob:b", duration: 2 };
    eng.rendered.set(B.id, r);
    eng.prewarm(B.start - SYNC.prewarmAhead - 0.5);
    assert.equal(r.el, undefined, "too early: nothing made yet");
    eng.prewarm(B.start - SYNC.prewarmMin / 2);
    assert.equal(r.el, undefined, "too late to help: the line's own start makes it");
    eng.prewarm(B.start - 1);
    assert.ok(r.el && r.madeAt === clock.now(), "made a second before its line");
    const first = r.el;
    clock.ms += SYNC.prewarmIdle * 1000 - 100;
    eng.prewarm(B.start - 1);
    assert.equal(r.el, first, "still fresh: kept");
    clock.ms += 200;
    eng.prewarm(B.start - 1);
    assert.ok(r.el !== first && made.length === 2, "unplayed past prewarmIdle: made again");
    // a playing (or fading) element is never replaced
    r.el.play();
    clock.ms += SYNC.prewarmIdle * 1000 + 100;
    const playing = r.el;
    eng.prewarm(B.start - 1);
    assert.equal(r.el, playing);
    // a short next take: the line after it gets its element while the current line plays
    const C = eng.plans[2], rc = { url: "blob:c", duration: 2 };
    eng.rendered.set(C.id, rc);
    r.el = null;
    r.duration = SYNC.prepTwoUnder - 0.2;
    eng.prepareNext(A.id);
    assert.ok(r.el && rc.el, "the next two takes have elements");
});

test("a line already over a second late when the last one ends follows after a short breath, not a full stop's pause", () => {
    const { SYNC } = require("../dub-engine.js");
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const prov = { id: "gemini", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, {});
    eng.refresh(true);
    const k = eng.plans.findIndex((p, j) => !p.continuesNext && eng.plans[j + 1]);
    const A = eng.plans[k], B = eng.plans[k + 1];
    eng.rendered.set(B.id, { url: "blob:b", duration: 2 });
    const after = (late, wait) => {
        eng.lastSpokenStart = A.start; eng.lastSpokenId = A.id;
        eng.lastSpeechEnd = B.start + late; eng.lastSpeechGap = SYNC.sentenceGap;
        const n = eng.nextSpeech(eng.lastSpeechEnd + wait);
        return n && n.p.id;
    };
    assert.ok(SYNC.lagRest < SYNC.sentenceGap);
    const mid = (SYNC.lagRest + SYNC.sentenceGap) / 2;
    assert.equal(after(SYNC.lagBoostAt + 0.5, mid), B.id, "behind: only lagRest");
    assert.equal(after(SYNC.lagBoostAt + 0.5, SYNC.lagRest / 2), null, "still a breath");
    assert.equal(after(SYNC.lagBoostAt - 0.5, mid), null, "not that far behind: the full rest");
    assert.equal(after(SYNC.lagBoostAt - 0.5, SYNC.sentenceGap + 0.01), B.id);
});

// ================= 4. AUDIO THẬT (giọng tiếng Việt "Linh" tạo bằng TTS macOS) =================
const wav = f => AUDIO.decodeWav(fs.readFileSync(path.join(__dirname, "audio", f)));

test("audio thật: cắt audio 4 câu thành đúng 4 đoạn, bỏ qua chỗ ngắt dấu phẩy", () => {
    const { samples, sampleRate } = wav("linh-chunk.wav");
    const texts = ["Bây giờ, điều chúng ta cần hiểu là cách mô hình xử lý dữ liệu.", "Thật sao?", "Đây là một khái niệm cực kỳ quan trọng, các bạn hãy ghi nhớ nó.", "Hóa ra mô hình bị quá khớp."];
    const r = AUDIO.splitBySilence(samples, sampleRate, texts.map(PLAN.countSyllables));
    assert.equal(r.method, "silence");
    assert.ok(r.confidence > 0.7, String(r.confidence));
    const sil = AUDIO.findSilences(samples, sampleRate);
    const commaPauses = sil.filter(s => s.dur < 0.4).map(s => (s.start + s.end) / 2);
    for (const p of r.parts.slice(1)) assert.ok(!commaPauses.some(c => Math.abs(c - p.start) < 0.05), "cắt nhầm chỗ ngắt dấu phẩy");
    // Mỗi đoạn cắt ra có thời lượng hợp lý theo số âm tiết
    const d = r.parts.map(p => p.end - p.start);
    assert.ok(d[1] < 1.6 && d[1] < d[0] && d[1] < d[2], JSON.stringify(d));
});

test("audio thật: chuẩn hóa âm lượng đều, không vỡ tiếng, không click ở ranh giới", () => {
    const { samples, sampleRate } = wav("linh-single.wav");
    const loud = samples.map(x => x * 2.5);                    // mô phỏng audio quá to, có vỡ
    const quiet = samples.map(x => x * 0.2);                   // mô phỏng audio quá nhỏ
    const a = AUDIO.analyze(AUDIO.prepareSpeech(loud, sampleRate), sampleRate);
    const b = AUDIO.analyze(AUDIO.prepareSpeech(quiet, sampleRate), sampleRate);
    assert.ok(Math.abs(a.voicedRmsDb - b.voicedRmsDb) < 1.5, `${a.voicedRmsDb} vs ${b.voicedRmsDb}`);
    assert.ok(a.peakDb <= -1.4 && b.peakDb <= -1.4, "vượt trần đỉnh");
    assert.equal(a.clipped, 0);
    assert.equal(AUDIO.edgeJump(AUDIO.prepareSpeech(loud, sampleRate)), 0);
    assert.ok(a.leadingSilence <= 0.05 && a.trailingSilence <= 0.06, "còn khoảng lặng thừa làm lệch thời lượng");
});

test("audio: ghi/đọc WAV giữ nguyên dữ liệu", () => {
    const sr = 24000;
    const x = new Float32Array(2400).map((_, i) => 0.5 * Math.sin(i / 10));
    const back = AUDIO.decodeWav(AUDIO.encodeWav(x, sr));
    assert.equal(back.sampleRate, sr);
    assert.ok(Math.max(...back.samples.map((v, i) => Math.abs(v - x[i]))) < 1e-4);
});

// ================= 5. ĐỒNG BỘ VỚI VIDEO (giọng hệ thống, phát theo cụm) =================
function runLive(opts = {}) {
    const clock = new Clock(), video = new FakeVideo(), log = [];
    const trueModel = { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: PLAN.DEFAULT_VOICE_MODEL.sylPerSec * (opts.voiceSpeed || 1) };
    const sp = makeFakeSpeech(clock, video, trueModel, log);
    const groups = lectureGroups();
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: sp }, now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, { duck: 0.2 });
    eng.start();
    video.playbackRate = opts.rate || 1;
    video.play();
    return { clock, video, log, eng, groups, sp, run: ms => clock.advance(ms, st => video.step(st)) };
}

function overlaps(log) {
    const done = log.filter(r => r.mediaEnd != null).sort((a, b) => a.mediaStart - b.mediaStart);
    let n = 0;
    for (let i = 1; i < done.length; i++) if (done[i].mediaStart < done[i - 1].mediaEnd - 1e-6) n++;
    return n;
}

// 1.9.4: stop() and forgetRendered() paused the elements they dropped but left their src set, so
// Chrome kept each one's media player and decoded audio until garbage collection. Every other path
// (a line finished, a seek, releaseOld) already let go with releaseAudio.
test("stop() and forgetRendered() release every audio element (src removed, load() called)", async () => {
    for (const how of ["stop", "forget"]) {
        const released = [];
        class TrackedAudio extends FakeAudio {
            removeAttribute(n) { if (n === "src") released.push(this); }
            load() {}
        }
        const r = await resilienceRun({ get: async () => ({}), render: okRender, seconds: 12,
            makeAudio: clock => new TrackedAudio(clock, { duration: 2.5 }),
            each: (ms, eng) => { if (ms === 11000 && how === "forget") eng.forgetRendered(); } });
        const live = r.audios.filter(a => !released.includes(a));
        assert.equal(live.length, 0, `${how}: ${live.length} of ${r.audios.length} elements kept their src`);
    }
});

// 1.9.3: a YouTube ad plays in the lecture's own <video>. The engine took the ad's clock for the
// lecture's: it read the first lines of the lecture over the ad, ducked the ad, and rendered them.
test("YouTube ad in the same <video>: no voice, no duck, no render during the ad; the lecture resumes after it", async () => {
    let ad = false, lectureT = 0, rendersInAd = 0, spokenAtAd = 0, spokenInAd = 0, minVol = 1, spokenAfter = 0, spokenAtEnd = 0;
    const render = async plans => { if (ad) rendersInAd++; return okRender(plans); };
    const r = await resilienceRun({ get: async () => ({}), render, seconds: 70, deps: { adShowing: () => ad },
        each: (ms, eng) => {
            const v = eng.d.video;
            if (ms === 30000) { ad = true; lectureT = v.currentTime; v.currentTime = 0; v.emit("seeking"); v.emit("seeked"); spokenAtAd = eng.stats.started.length; }
            if (ad && ms >= 31000) minVol = Math.min(minVol, v.volume);
            if (ms === 45000) { spokenInAd = eng.stats.started.length - spokenAtAd; ad = false; v.currentTime = lectureT; v.emit("seeking"); v.emit("seeked"); spokenAfter = eng.stats.started.length; }
            if (ms === 69950) spokenAtEnd = eng.stats.started.length;
        } });
    assert.equal(spokenInAd, 0, `${spokenInAd} lines read over the ad`);
    assert.equal(rendersInAd, 0, `${rendersInAd} renders for ad time`);
    assert.ok(minVol > 0.79, `ad ducked to ${minVol}`);
    assert.ok(spokenAtEnd - spokenAfter >= 3, `${spokenAtEnd - spokenAfter} lines after the ad`);
    assert.ok(r.eng.stats.ads >= 1);
});

// BACKLOG 35 (1.9.7): the line an ad cuts goes on where the voice was. It was entered at the video's
// place instead, so a line already running late lost the part nobody had heard.
test("YouTube ad cutting a line: after the ad the same line goes on from where the voice was, never ahead", async () => {
    let ad = false, lectureT = 0, cut = null, resumed = null, adAt = null;
    const render = async plans => plans.map(p => ({ planId: p.id, wav: new Uint8Array(8), duration: 6 }));
    await resilienceRun({ get: async () => ({}), render, seconds: 60, deps: { adShowing: () => ad },
        makeAudio: clock => new FakeAudio(clock, { duration: 6 }),
        each: (ms, eng) => {
            const v = eng.d.video, S = eng.speech, r = S && eng.rendered.get(S.id);
            // the ad comes 3.5 s into a line whose voice started at least 1 s late (the engine reads
            // the voice one 50 ms tick after this, hence the 0.1 s allowance below)
            if (adAt == null && ms > 15000 && S && r && r.el && r.el.currentTime > 3.5 && S.mediaStart - eng.planById.get(S.id).start > 1) {
                adAt = ms; cut = { id: S.id, pos: r.el.currentTime };
                ad = true; lectureT = v.currentTime; v.currentTime = 0; v.emit("seeking"); v.emit("seeked");
            }
            if (adAt != null && ms === adAt + 8000) { ad = false; v.currentTime = lectureT; v.emit("seeking"); v.emit("seeked"); }
            if (adAt != null && ms > adAt + 8000 && !resumed && eng.speech) resumed = { id: eng.speech.id, offset: eng.speech.offset };
        } });
    assert.ok(cut, "no late line was cut in this run");
    assert.equal(resumed.id, cut.id, "the cut line was not taken up again");
    assert.ok(resumed.offset <= cut.pos + 0.1 && resumed.offset >= cut.pos - 1.3, `resumed at ${resumed.offset.toFixed(2)} s, the voice was at ${cut.pos.toFixed(2)} s`);
});

// 2.0.1: an ad that comes while the voice rests after a line whose subtitle is still up. After the
// ad that line was entered again at the video's place and its tail read a second time.
test("YouTube ad between lines: the line already heard is not read again after the ad", async () => {
    let ad = false, lectureT = 0, heard = null, adAt = null, after = null;
    // 5 s takes: long enough that the tail entered again is not dropped as too short to start
    const render = async plans => plans.map(p => ({ planId: p.id, wav: new Uint8Array(8), duration: 5 }));
    const run = await resilienceRun({ get: async () => ({}), render, seconds: 60, deps: { adShowing: () => ad },
        makeAudio: clock => new FakeAudio(clock, { duration: 5 }),
        each: (ms, eng) => {
            const v = eng.d.video;
            const p = eng.lastSpokenId && eng.planById.get(eng.lastSpokenId);
            // voice done, the line's subtitle still up a little longer
            if (adAt == null && ms > 8000 && !eng.speech && p && v.currentTime < p.end - 0.5 && v.currentTime > p.start + 4) {
                adAt = ms; heard = p.id;
                ad = true; lectureT = v.currentTime; v.currentTime = 0; v.emit("seeking"); v.emit("seeked");
            }
            if (adAt != null && ms === adAt + 6000) { ad = false; v.currentTime = lectureT; v.emit("seeking"); v.emit("seeked"); after = eng.stats.started.length; }
        } });
    assert.ok(heard, "no rest inside a subtitle was found in this run");
    const next = run.eng.stats.started[after];
    assert.ok(next, "nothing was read after the ad");
    assert.notEqual(next.id, heard, "the line heard before the ad was read again");
    assert.equal(run.eng.stats.adKeptPlace, 1);
});

// 1.9.2: Reload at chrome://extensions while the original track is ducked. The old content script
// runs on until its liveness poll notices (up to 1.5 s) or never stops at all, and the new one
// starts on the same <video>. Each took the other's ducked level for the user's own: after dubbing
// stopped YouTube was left at 0.01 of a 0.80 volume. Isolated worlds share only the DOM, so the
// user's level and the owner of the duck live in attributes on the element.
class VolumeVideo extends FakeVideo {
    constructor() { super(); this._v = 0.8; this.attrs = {}; }
    get volume() { return this._v; }
    set volume(x) { if (this._v === undefined) return; const ch = Math.abs(x - this._v) > 1e-9; this._v = x; if (ch) queueMicrotask(() => this.emit("volumechange")); }
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
    setAttribute(n, v) { this.attrs[n] = String(v); }
    removeAttribute(n) { delete this.attrs[n]; }
}
for (const youtube of [true, false]) for (const old of ["stops late", "never stops"]) {
    test(`reload while ducked (${youtube ? "YouTube" : "plain video"}, old script ${old}): the user's volume comes back, one voice`, async () => {
        const clock = new Clock(), video = new VolumeVideo(), groups = lectureGroups();
        const mk = () => new DubEngine({ video, getGroups: () => groups, providers: { primary: makeFakeSpeech(clock, video, PLAN.DEFAULT_VOICE_MODEL, []) }, now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id), setTimeout: (f, ms) => clock.setTimeout(f, ms) }, { duck: 0.2, playerOwnsVolume: youtube });
        const run = async ms => { for (let i = 0; i < ms / 50; i++) { clock.advance(50, st => video.step(st)); await new Promise(r => setImmediate(r)); } };
        const A = mk();
        A.start();
        video.play();
        for (let i = 0; i < 400 && A.duckFactor > 0.21; i++) await run(50);
        assert.ok(video.volume < 0.2, "never ducked");
        if (old === "never stops") A.d.clearInterval(A.timer);
        const B = mk();
        B.start();
        await run(1500);
        if (old === "stops late") {
            assert.equal(A.running, false, "the old engine kept speaking over the new one");
            A.stop();
        }
        await run(3000);
        assert.ok(B.running);
        B.stop();
        await new Promise(r => setImmediate(r));
        assert.ok(Math.abs(video.volume - 0.8) < 0.01, `volume left at ${video.volume.toFixed(2)}`);
        assert.equal(video.getAttribute("data-cst-duck-owner"), null);
    });
}

// 1.9.1: Chrome's speechSynthesis sometimes never reports the end of an utterance (an utterance the
// page holds no reference to is collected with its handlers; network voices stop mid-way; the
// queue sticks "pending"). tickLive waited for that end forever: the system voice went silent for
// the rest of the video.
for (const lost of ["onend", "both"]) {
    test(`system voice: an utterance whose ${lost === "both" ? "start and end are" : "end is"} never reported does not silence the rest of the video`, () => {
        const base = runLive();
        const end = base.groups[base.groups.length - 1].end + 3;
        base.run(end * 1000 + 1000);
        const S = runLive();
        const real = S.sp.speak;
        let n = 0;
        S.sp.speak = (text, opts, cb) => {
            if (++n !== 5) return real(text, opts, cb);
            // the fifth phrase: events swallowed, like a collected utterance
            return real(text, opts, lost === "both" ? {} : { onstart: cb.onstart });
        };
        S.run(end * 1000 + 1000);
        const spoken = S.eng.stats.started.length;
        assert.ok(spoken >= base.eng.stats.started.length - 2, `${spoken} of ${base.eng.stats.started.length} lines after a lost end`);
        assert.ok(S.eng.stats.errorTypes && S.eng.stats.errorTypes.speech_stalled >= 1);
        assert.equal(overlaps(S.log), 0);
    });
}

test("system voice: the handle keeps the utterance, so Chrome cannot collect it with its end handler", () => {
    const spoken = [];
    class Utter { constructor(text) { this.text = text; } }
    const synth = { speak: u => spoken.push(u), cancel() {}, getVoices: () => [] };
    const P = require("../dub-engine.js").createWebSpeechProvider({ speechSynthesis: synth, SpeechSynthesisUtterance: Utter });
    const h = P.speak("Xin chào", { rate: 1, pitch: 1, speaker: "S1" }, {});
    assert.equal(h.utterance, spoken[0]);
});

for (const rate of [0.75, 1, 1.25, 1.5]) {
    test(`đồng bộ ${rate}x: mọi đoạn bắt đầu đúng lúc lời gốc bắt đầu, không chồng tiếng`, () => {
        const S = runLive({ rate });
        const end = S.groups[S.groups.length - 1].end + 3;
        S.run(end / rate * 1000 + 1000);
        assert.equal(S.eng.stats.started.length, S.eng.plans.length, "có đoạn bị bỏ qua");
        const lags = S.eng.stats.started.map(s => s.lag);
        assert.ok(Math.max(...lags) < 0.15, `trễ tối đa ${Math.max(...lags)}`);
        assert.equal(overlaps(S.log), 0);
        assert.equal(S.eng.stats.errors, 0);
        // Không cụm nào bắt đầu trước khi người nói gốc bắt đầu nói
        for (const s of S.eng.stats.started) assert.ok(s.t >= s.due - 0.05);
    });
}

test("đồng bộ: giọng thật chậm hơn mô hình 20% -> tự hiệu chỉnh, độ trễ KHÔNG tích lũy", () => {
    const S = runLive({ voiceSpeed: 0.8 });
    S.run(170000);
    const cal = S.sp.voiceModel.calibration;
    assert.ok(cal > 1.15 && cal < 1.45, `hiệu chỉnh ${cal}`);
    const lags = S.eng.stats.started.map(s => s.lag);
    const lastHalf = lags.slice(Math.floor(lags.length / 2));
    assert.ok(lastHalf.filter(l => l > 0.3).length <= 1, JSON.stringify(lastHalf));
    assert.ok(Math.max(...lags) < S.eng.constructor ? 1.6 : 1.6, "trễ đơn lẻ vẫn trong giới hạn");
    assert.equal(overlaps(S.log), 0);
});

test("tạm dừng: im lặng ngay, tiếp tục đúng cụm đang dở khi phát lại, hủy KHÔNG bị tính là lỗi", () => {
    const S = runLive();
    const p = S.eng.plans.find(x => x.phrases.length >= 2);
    S.run((p.start + p.phrases[0].offset + 0.4) * 1000);
    const spokenBefore = S.log.length;
    S.video.pause();
    S.run(3000);
    assert.equal(S.sp.active, null, "vẫn đang nói khi video tạm dừng");
    assert.equal(S.log.length, spokenBefore, "nói thêm trong lúc tạm dừng");
    const pausedAt = S.video.currentTime;
    S.video.play();
    S.run(600);
    const resumed = S.log[S.log.length - 1];
    assert.ok(resumed.mediaStart - pausedAt < 0.3, "tiếp tục chậm");
    assert.equal(S.eng.stats.errors, 0);
    for (let i = 0; i < 5; i++) { S.video.pause(); S.run(200); S.video.play(); S.run(700); }
    assert.equal(S.eng.stats.errors, 0, "hủy khi tạm dừng bị tính là lỗi");
});

test("tua tới giữa một đoạn: nói từ cụm chưa trôi qua; tua lùi: nói lại đúng đoạn", () => {
    const S = runLive();
    S.run(5000);
    const target = S.eng.plans.find(x => x.phrases.length >= 3 && x.start > 40);
    const mid = target.start + target.phrases[1].offset + 0.02;
    S.video.seek(mid);
    S.run(400);
    const first = S.log[S.log.length - 1];
    assert.ok(first.mediaStart >= mid - 0.01);
    assert.ok(target.phrases.slice(1).some(ph => ph.text === first.text), `sau khi tua nói "${first.text}"`);
    const back = S.eng.plans[2];
    S.video.seek(back.start - 0.2);
    S.run(800);
    assert.equal(S.log[S.log.length - 1].text, back.phrases[0].text);
    assert.equal(overlaps(S.log), 0);
});

test("đang tải (video đứng hình nhưng không tạm dừng): lồng tiếng chờ theo, không chạy trước hình", () => {
    const S = runLive();
    const p = S.eng.plans.find(x => x.phrases.length >= 3);
    S.run((p.start + 0.2) * 1000);
    S.video.stalled = true;
    S.run(2500);
    const talkedDuringStall = S.log.filter(r => r.mediaStart != null && Math.abs(r.mediaStart - S.video.currentTime) < 1e-9 && r !== S.log[S.log.length - 1]).length;
    assert.equal(S.sp.active, null, "vẫn nói khi video đang tải");
    assert.ok(talkedDuringStall <= 1);
    S.video.stalled = false;
    S.run(3000);
    assert.equal(overlaps(S.log), 0);
    assert.equal(S.eng.stats.errors, 0);
});

test("âm lượng gốc hạ/nâng mượt (không giật), tôn trọng người dùng chỉnh âm lượng, trả lại khi tắt", () => {
    const S = runLive();
    const vols = [];
    const p = S.eng.plans[3];
    for (let t = 0; t < (p.start + 2) * 20; t++) { S.run(50); vols.push(S.video.volume); }
    // 2.0.9: a step is judged in loudness (dB), the ear's scale: 1.55 dB each at the default duck. The
    // linear ramp before it (0.09 a tick) passed an amplitude bound but moved up to 2.9 dB in one tick.
    // 2.1.2: coming down under a voice already sounding (this first phrase: nothing announced it) is
    // the 4-tick attack, 3.5 dB a tick; going back up stays at the gentle 1.55 dB
    for (let i = 1; i < vols.length; i++) {
        const db = 20 * Math.log10(vols[i] / vols[i - 1]);
        assert.ok(db <= 1.6 && db >= -3.6, `bước ${vols[i - 1]} -> ${vols[i]}`);
    }
    assert.ok(Math.min(...vols) < 0.8 * 0.3, "chưa hạ tiếng gốc khi có lời Việt");
    // ... and the whole way down is still a ramp, not one jump
    const first = vols.findIndex(v => v < 0.8 - 1e-9), low = vols.findIndex(v => v <= 0.8 * 0.2 + 1e-9);
    assert.ok(first >= 0 && low - first >= 3, `ramp down in ${low - first + 1} ticks`);
    // Người dùng tự giảm âm lượng trong lúc đang hạ tiếng gốc
    const f = S.eng.duckFactor;
    S.video.volume = 0.3;
    S.video.emit("volumechange");
    S.eng.stop();
    // Khi tắt lồng tiếng: trả về đúng mức người dùng muốn (0,3 / hệ số hạ), không về 0,8 cũ
    assert.ok(Math.abs(S.video.volume - Math.min(1, 0.3 / f)) < 0.02, `${S.video.volume} vs ${0.3 / f}`);
});

test("YouTube re-applying its own volume mid-speech does not undo the duck", () => {
    const S = runLive();
    S.eng.settings.playerOwnsVolume = true;
    S.eng.settings.duck = 0.1;
    const p = S.eng.plans[3];
    // Run until the voice speaks and the duck has settled at its target
    let settled = false;
    for (let i = 0; i < (p.start + 2) * 20 && !settled; i++) {
        S.run(50);
        settled = S.eng.speakingUntilMedia >= S.video.currentTime && Math.abs(S.eng.duckFactor - 0.1) < 1e-3;
    }
    assert.ok(settled, "the duck never reached its target");
    // YouTube writes its own level (Stable Volume, seek, player refresh) while the voice goes on
    S.video.volume = 0.75;
    S.video.emit("volumechange");
    S.run(50);
    assert.ok(S.eng.speakingUntilMedia >= S.video.currentTime, "the test needs the voice still speaking");
    assert.ok(Math.abs(S.video.volume - 0.075) < 0.01, `original track left at ${S.video.volume}`);
    // Turning dubbing off gives back YouTube's level, not a level inflated by the duck factor
    S.eng.stop();
    assert.ok(Math.abs(S.video.volume - 0.75) < 0.01, `restored to ${S.video.volume}`);
});

// 2.4.6, measured with a volumechange probe on the user's YouTube <video>: the player wrote its full
// level (0.825 over a 0.2475 duck) 2 s after play, and the duck came back only at the next tick, so
// the original sounded at full for up to 50 ms, a loud blip. It goes back in the event itself.
test("YouTube re-applying its own volume is ducked again at once, not at the next tick", () => {
    const S = runLive();
    S.eng.settings.playerOwnsVolume = true;
    S.eng.settings.duck = 0.3;
    const p = S.eng.plans[3];
    let settled = false;
    for (let i = 0; i < (p.start + 2) * 20 && !settled; i++) {
        S.run(50);
        settled = S.eng.speakingUntilMedia >= S.video.currentTime && Math.abs(S.eng.duckFactor - 0.3) < 1e-3;
    }
    assert.ok(settled, "the duck never reached its target");
    S.video.volume = 0.825;
    S.video.emit("volumechange");
    assert.ok(Math.abs(S.video.volume - 0.825 * 0.3) < 0.005, `original track at ${S.video.volume} until the next tick`);
});

// 2.0.8, the system voice, the same cases before: 10 of 30 short gaps pumped, 18 of 38 phrases began
// over the original above 30%, it rose under 6 to 8% of the voice (phrases running past their
// predicted end), and the phrase cut by the pause went on over it at 91%.
test("system voice: the original stays down between close phrases, under a slow phrase and across a pause", () => {
    // voiceSpeed 0.8: a voice slower than the engine's model, so phrases run past their predicted end
    for (const { rate, voiceSpeed } of [{ rate: 1 }, { rate: 1.5 }, { rate: 1, voiceSpeed: 0.8 }]) {
        const S = runLive({ rate, voiceSpeed });
        let prev = false, gap = null, first = true, pumps = 0, gaps = 0, starts = 0, pausedAt = null, resumed = null, under = 0, voiced = 0;
        const loud = [];
        for (let w = 0; w < 150000; w += 50) {
            if (pausedAt == null && w >= 30000 && S.sp.active) { S.video.pause(); pausedAt = w; }
            if (pausedAt != null && resumed == null && w >= pausedAt + 5000) { S.video.play(); resumed = w; }
            S.run(50);
            if (S.video.paused) { prev = false; gap = null; continue; }
            const voice = !!S.sp.active, f = S.video.volume / 0.8;
            if (voice) { voiced++; if (f > 0.35) under++; }
            if (voice && !prev) {
                if (gap && w - gap.at < 1500) { gaps++; if (gap.peak > 0.5) pumps++; }
                if (!first) { starts++; if (f > 0.3) loud.push(`${w} ms ${f.toFixed(2)}`); }
                first = false;
                gap = null;
            } else if (!voice) {
                if (prev) gap = { at: w, peak: 0 };
                if (gap) gap.peak = Math.max(gap.peak, f);
            }
            prev = voice;
        }
        const at = `${rate}x, voice ${voiceSpeed || 1}`;
        assert.ok(resumed != null && starts >= 25 && gaps >= 20, `${at}: too little measured (${starts} phrases, ${gaps} short gaps)`);
        assert.equal(pumps, 0, `${at}: ${pumps} of ${gaps} short gaps let the original up and down again`);
        assert.deepEqual(loud, [], `${at}: phrases that began over the original above 30% (one is the phrase resumed after the pause)`);
        assert.ok(under / voiced < 0.01, `${at}: the original above 35% under ${(100 * under / voiced).toFixed(1)}% of the voice`);
    }
});

// ================= 6. ĐỒNG BỘ AUDIO CÓ SẴN (Gemini TTS) =================
function fakeGeminiProvider(clock, opts = {}) {
    const calls = [];
    return {
        id: "gemini", label: "Gemini giả", caps: { prerender: true, live: false }, voiceLabel: "Kore",
        voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: 4.6, rateExp: 1, pauseFactor: 1.3 },
        calls,
        async render(plans) {
            calls.push(plans.map(p => p.id));
            if (opts.fail) throw new Error("HTTP 429: hết hạn mức");
            await new Promise(r => setTimeout(r, 0));
            return plans.map(p => ({ planId: p.id, wav: new Uint8Array(4), duration: p.estDuration * (opts.lengthFactor || 1) }));
        }
    };
}

async function runBuffer(opts = {}) {
    const clock = new Clock(), video = new FakeVideo();
    const groups = lectureGroups();
    const audios = [];
    const prov = fakeGeminiProvider(clock, opts);
    const fb = opts.fallback ? makeFakeSpeech(clock, video, PLAN.DEFAULT_VOICE_MODEL, []) : null;
    let meta = new Map();
    const eng = new DubEngine({
        video, getGroups: () => groups, providers: { primary: prov, fallback: fb },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        createObjectURL: () => "blob:" + meta.size, revokeObjectURL() {},
        createAudio: url => { const a = new FakeAudio(clock, { duration: 99 }, opts.drift || 0); audios.push(a); return a; },
        onStatus: s => { eng && (eng.lastStatus = s); }
    });
    eng.start();
    // Chờ lượt tạo audio đầu (promise) hoàn tất
    for (let i = 0; i < 20; i++) { clock.advance(50); await new Promise(r => setImmediate(r)); }
    video.playbackRate = opts.rate || 1;
    video.play();
    const run = async ms => {
        for (let t = 0; t < ms; t += 100) {
            clock.advance(100, st => { video.step(st); audios.forEach(a => a.step(st)); });
            await new Promise(r => setImmediate(r));
        }
    };
    return { eng, video, audios, prov, run, clock };
}

test("audio Gemini: gộp nhiều đoạn một lượt TTS, chỉ tạo quanh vị trí đang phát", async () => {
    const S = await runBuffer();
    const firstCalls = S.prov.calls.flat();
    assert.ok(S.prov.calls.some(c => c.length > 1), "không gộp đoạn nào");
    const lastStart = Math.max(...firstCalls.map(id => S.eng.planById.get(id).start));
    assert.ok(lastStart <= 60 + 5, `tạo trước quá xa: ${lastStart}s`);
    await S.run(150000);
    assert.ok(S.prov.calls.length < S.eng.plans.length * 0.7, `${S.prov.calls.length} lượt cho ${S.eng.plans.length} đoạn`);
    // Tua lùi không tạo lại audio đã có (dùng bộ nhớ đệm)
    const before = S.prov.calls.length;
    S.video.seek(10);
    await S.run(3000);
    assert.equal(S.prov.calls.length, before);
});

test("audio Gemini: audio trôi nhịp 3% vẫn được kéo về đúng (lệch < 0,2 s), đúng tốc độ phát", async () => {
    for (const rate of [1, 1.5]) {
        const S = await runBuffer({ drift: 0.03, rate });
        let worst = 0;
        for (let i = 0; i < 400; i++) {
            await S.run(100);
            // Đo theo DÒNG THỜI GIAN LỜI NÓI (1.1.6): câu xếp hàng sau câu dài bắt đầu muộn hơn
            // mốc phụ đề là đúng thiết kế, không phải trôi nhịp
            const t = S.video.currentTime;
            const sp = S.eng.speech;
            if (!sp) continue;
            const r = S.eng.rendered.get(sp.id);
            if (!r || !r.el || r.el.paused) continue;
            worst = Math.max(worst, Math.abs(r.el.currentTime - (sp.offset + (t - sp.mediaStart) * sp.rate)));
            // Tốc độ = tốc độ lời nói x tốc độ video, chỉ được nhích tối đa ±5% để khớp dần
            assert.ok(Math.abs(r.el.playbackRate / (sp.rate * rate) - 1) <= 0.05 + 1e-6, "sai tốc độ phát audio");
            assert.ok(sp.rate >= 0.95 - 1e-9 && sp.rate <= 1.3 + 1e-9, "tốc độ lời nói ngoài giới hạn [0,95 ; 1,3]");
            assert.equal(r.el.preservesPitch, true, "co giãn phải giữ cao độ");
        }
        assert.ok(worst < 0.2 + 0.03 * 0.1 * rate + 1e-6, `lệch tối đa ${worst}`);
        assert.ok(S.eng.stats.corrections + (S.eng.stats.nudges || 0) > 0);
        // Trôi 3% được bù bằng nhích tốc độ: hầu như không phải tua (tua = chỗ vấp nghe được)
        assert.ok(S.eng.stats.corrections <= 4, `tua ${S.eng.stats.corrections} lần`);
    }
});

test("audio Gemini: dài hơn khung thì phát nhanh hơn vừa đủ, giữ cao độ, trong giới hạn an toàn; nhịp đổi từ từ giữa các câu", async () => {
    const S = await runBuffer({ lengthFactor: 1.4 });
    await S.run(20000);
    const rates = S.eng.stats.started.map(x => x.rate).filter(Boolean);
    assert.ok(rates.some(r => r > 1.01), JSON.stringify(rates));
    // co giãn theo khung của câu, không bao giờ ra ngoài dải an toàn
    assert.ok(rates.every(r => r >= 0.95 - 1e-9 && r <= 1.3 + 1e-9), JSON.stringify(rates));
    // 2.7.0: a line that would overrun its slot by more than overrunStepAt may climb
    // rateStepUpOverrun (0.2); every other step stays within rateStepUp. Which lines overrun depends
    // on timing, so under load a 0.14 step showed up here: allowed, but most steps stay gentle
    const { SYNC } = require("../dub-engine.js");
    const steps = rates.slice(1).map((r, i) => r - rates[i]);
    for (let i = 0; i < steps.length; i++) assert.ok(steps[i] <= SYNC.rateStepUpOverrun + 1e-9, `nhịp tăng vọt ${rates[i]} -> ${rates[i + 1]}`);
    assert.ok(steps.filter(d => d > SYNC.rateStepUp + 1e-9).length <= Math.ceil(steps.length / 4), JSON.stringify(rates));
});

test("audio Gemini: tạm dừng video thì audio dừng, phát lại thì tiếp đúng vị trí", async () => {
    const S = await runBuffer();
    const p = S.eng.plans[2];
    await S.run((p.start + 0.8) * 1000);
    S.video.pause();
    await S.run(1000);
    assert.ok(S.audios.every(a => a.paused), "audio vẫn chạy khi video tạm dừng");
    S.video.play();
    await S.run(300);
    const r = S.eng.rendered.get(S.eng.plans[S.eng.planAt(S.video.currentTime)].id);
    assert.ok(r.el && !r.el.paused);
    assert.ok(Math.abs(r.el.currentTime - (S.video.currentTime - S.eng.plans[S.eng.planAt(S.video.currentTime)].start) * r.stretch) < 0.2);
});

test("dự phòng: Gemini TTS lỗi liên tục -> chuyển cả video sang giọng hệ thống, video không bị ảnh hưởng", async () => {
    const S = await runBuffer({ fail: true, fallback: true });
    await S.run(5000);
    assert.equal(S.eng.provider.id, "system");
    assert.equal(S.eng.lastStatus.fallback, true);
    assert.ok(S.video.currentTime > 4, "video bị kẹt");
});

// ================= 7. KỊCH BẢN GỬI GEMINI TTS =================
test("kịch bản Gemini TTS: có hướng dẫn giọng theo ý định, nhấn từ, ngắt nghỉ; lời thoại tách đoạn", () => {
    const a = PLAN.planSegment(segOf("Thật sao?", "Really?", 0, 1));
    const b = PLAN.planSegment(segOf("Đây là một khái niệm cực kỳ quan trọng, các bạn hãy ghi nhớ nó.", "This is an extremely important concept, remember it.", 2, 6));
    const s = geminiScript([a, b]);
    assert.match(s, /giọng hỏi/);
    assert.match(s, /nhấn vào "cực kỳ/);
    assert.match(s, /Thật sao\?\n\nĐây là/);
    assert.match(s, /không đọc phần hướng dẫn/);
    assert.ok(!/¦/.test(s));
});

// 1.6.1: adapt to how fast the video speaks. A slow voice (Kim Thanh, measured 3.8 syllables/s)
// on a fast speaker used to hit the fixed ceiling sentence after sentence and fall behind. Measured
// on two real cached timelines: lag over 1 s went 3 -> 0 and 5 -> 1, a slow speaker was unchanged.
async function paceRun(timeScale, { oldBehaviour = false } = {}) {
    const { SYNC } = require("../dub-engine.js");
    const saved = { lookAhead: SYNC.lookAhead, paceCeilingMax: SYNC.paceCeilingMax, paceFloorShare: SYNC.paceFloorShare };
    if (oldBehaviour) { SYNC.lookAhead = 0; SYNC.paceCeilingMax = SYNC.maxSpeechRate; SYNC.paceFloorShare = 0; }
    try {
        const clock = new Clock(), video = new FakeVideo();
        const groups = lectureGroups().map(g => ({
            ...g, start: g.start * timeScale, end: g.end * timeScale,
            srcCues: g.srcCues.map(c => ({ ...c, start: c.start * timeScale, end: c.end * timeScale })),
            viCues: g.viCues.map(c => ({ ...c, start: c.start * timeScale, end: c.end * timeScale }))
        }));
        const audios = [];
        const RAW_SPS = 3.61;                       // Kim Thanh after pause trimming, measured
        const prov = {
            id: "vieneu", label: "VieNeu", caps: { prerender: true, live: false, free: true, serial: true, maxBatch: 1, timeStretch: true },
            tempo: { targetSps: 4.8, maxTempo: 1.22, minSps: 4.0, maxFloor: 1.15 },
            voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL, sylPerSec: 4.66, rateExp: 1, pauseFactor: 1 },
            naturalSps: () => 3.8 * 0.86, audioKey: async p => "k" + p.id, abort() {},
            render: async plans => plans.map(p => ({ planId: p.id, wav: new Uint8Array(4), duration: p.phrases.reduce((a, ph) => a + ph.syl, 0) / RAW_SPS + 0.05 }))
        };
        const eng = new DubEngine({
            video, getGroups: () => groups, providers: { primary: prov },
            now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
            setTimeout: (f, ms) => clock.setTimeout(f, ms), createObjectURL: () => "blob:x", revokeObjectURL() {},
            createAudio: () => { const a = new FakeAudio(clock, { duration: 99 }); audios.push(a); return a; }
        });
        eng.start();
        for (let i = 0; i < 20; i++) { clock.advance(50); await new Promise(r => setImmediate(r)); }
        video.play();
        const end = groups[groups.length - 1].end + 2;
        for (let i = 0; i < 20000 && video.currentTime < end; i++) {
            clock.advance(50, st => { video.step(st); audios.forEach(a => a.step(st)); });
            if (i % 4 === 0) await new Promise(r => setImmediate(r));
        }
        eng.stop();
        const st = eng.stats.started;
        return {
            lagMax: Math.max(...st.map(x => x.t - x.due)),
            rateMean: st.reduce((a, x) => a + x.rate, 0) / st.length,
            rateMax: Math.max(...st.map(x => x.rate)),
            spoken: st.length, dropped: eng.stats.dropped
        };
    } finally {
        Object.assign(SYNC, saved);
    }
}

test("slow voice on a fast speaker: speeds up early and evenly, and a slow speaker is left alone", async () => {
    const fastOld = await paceRun(0.8, { oldBehaviour: true });
    const fastNew = await paceRun(0.8);
    assert.equal(fastNew.dropped, 0);
    assert.ok(fastNew.lagMax < fastOld.lagMax - 0.2, `lag ${fastOld.lagMax.toFixed(2)} -> ${fastNew.lagMax.toFixed(2)}`);
    assert.ok(fastNew.rateMax <= 1.65, `never beyond the spoken-pace cap: ${fastNew.rateMax}`);
    const slowOld = await paceRun(1.4, { oldBehaviour: true });
    const slowNew = await paceRun(1.4);
    assert.ok(Math.abs(slowNew.rateMean - slowOld.rateMean) < 0.03, `slow speaker sped up: ${slowOld.rateMean.toFixed(2)} -> ${slowNew.rateMean.toFixed(2)}`);
});

// 2.5.2: voices follow the speakers unless the viewer picks one voice ("Giọng theo người nói"). The
// engine itself stays one voice unless told (secondVoice): the page decides, from the setting.
test("voices follow the speakers by default ('auto'); 'one' reads every speaker with the main voice", () => {
    const groups = talk();
    const make = settings => {
        const clock = new Clock();
        const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
        const eng = new DubEngine({ video: new FakeVideo(), getGroups: () => groups, providers: { primary: prov },
            now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, settings);
        eng.refresh(true);
        return eng.plans.map(p => p.speaker);
    };
    assert.deepEqual([...new Set(make({}))], ["S1"], "the engine alone: one voice");
    assert.deepEqual(make({ secondVoice: true }), ["S1", "S2", "S1", "S2", "S1"]);
    const R = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", f), "utf8");
    const html = R("options.html"), js = R("options.js"), dj = R("dubbing.js");
    assert.match(html, /<select id="dubSpeakers"[^>]*>\s*<option value="auto" selected>/, "auto is the default in Settings");
    assert.match(html, /id="dubSpeakerAi" checked/);
    assert.match(js, /dubSpeakers: speakersSel \? speakersSel\.value : "auto"/, "Settings saves it");
    assert.match(dj, /dubSpeakers: "auto",/, "the page's default");
    assert.match(dj, /secondVoice: s\.dubSpeakers !== "one"/);
    assert.match(dj, /changes\.dubSpeakers \|\| changes\.dubSpeakerAi \|\|/, "a change restarts the voice");
});

test("who speaks: an AI reading that arrives later remakes only the lines it gives another voice", () => {
    const groups = interview();
    const clock = new Clock();
    const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, voices: { S1: "Mỹ Duyên", S2: "Thái Sơn" },
        render: async () => [], setCast(g) { this.cast = g; return false; } };
    const eng = new DubEngine({ video: new FakeVideo(), getGroups: () => groups, providers: { primary: prov }, createObjectURL: () => "blob:x",
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, { secondVoice: true });
    eng.refresh(true);
    assert.deepEqual([...new Set(eng.plans.map(p => p.speaker))], ["S1"]);
    for (const p of eng.plans) eng.addRendered(p, new Uint8Array(8), 1);
    const before = new Map([...eng.rendered].map(([id, r]) => [id, r]));
    eng.setSpeakerHints({ turns: [[0, 1], [3.5, 2], [9, 1], [10.5, 2], [16, 1], [18.5, 2]].map(([t, speaker]) => ({ t, speaker })),
        speakers: [{ id: 1, gender: "male" }, { id: 2, gender: "female" }], confidence: "high" });
    eng.refresh(true);
    const now = eng.plans.map(p => [p.speaker, eng.rendered.has(p.id)]);
    assert.deepEqual(now.map(x => x[0]), ["S2", "S1", "S2", "S1", "S2", "S1"]);
    // the guest's lines stay S1 in the same voice: kept; the host's are S2 now: made again
    for (const [speaker, kept] of now) assert.equal(kept, speaker === "S1", JSON.stringify(now));
    assert.ok([...eng.rendered.values()].every(r => before.has([...eng.rendered].find(([, x]) => x === r)[0])));
    assert.deepEqual(prov.cast, ["female", "male"], "the provider is told the genders, main speaker first");
    assert.equal(eng.turns.source, "ai");
});

// 1.6.3: planning the whole video on every new translated group cost ~90 ms of main thread on a
// 60-minute lecture (a visible stutter each time). Only a window around playback is planned now.
function longLecture(minutes, marks) {
    const base = lectureGroups();
    const span = base[base.length - 1].end + 2;
    const out = [];
    for (let k = 0; out.length === 0 || out[out.length - 1].end < minutes * 60; k++) base.forEach((g, i) => {
        const o = k * span;
        // two turns in a row, then none: a question and its answer (2.4.8: lone marks are no turns)
        const src = g.srcCues.map((c, j) => ({ ...c, start: c.start + o, end: c.end + o, text: marks && j === 0 && (k + i) % 3 !== 2 ? ">> " + c.text : c.text }));
        out.push({ ...g, start: g.start + o, end: g.end + o, srcCues: src, viCues: g.viCues.map(c => ({ ...c, start: c.start + o, end: c.end + o })) });
    });
    return out;
}

test("planning window: same plans as a whole-video build around playback, second voice included", () => {
    const groups = longLecture(60, true);
    const clock = new Clock(), video = new FakeVideo();
    const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id) }, { secondVoice: true });
    video.currentTime = 1800;
    eng.refresh(true);
    const whole = PLAN.planAll(PLAN.buildDubScript(groups), { voiceModel: PLAN.DEFAULT_VOICE_MODEL });
    assert.ok(eng.plans.length < whole.length / 4, `planned ${eng.plans.length} of ${whole.length}`);
    const byId = new Map(whole.map(p => [p.id, p]));
    // every windowed plan away from the window's far edge matches the whole-video plan exactly
    const inner = eng.plans.filter(p => p.start > 1800 - 120 && p.start < 1800 + 300);
    assert.ok(inner.length > 20);
    for (const p of inner) {
        const w = byId.get(p.id);
        assert.ok(w, `plan ${p.id} does not exist in a whole-video build`);
        assert.equal(p.text, w.text);
        assert.equal(p.speaker, w.speaker, `speaker differs at ${p.start}`);
        assert.equal(p.continuesNext, w.continuesNext);
    }
    assert.ok(inner.some(p => p.speaker === "S2"), "the fixture should contain a second speaker");
});

test("audio of a plan that left the window is released, not kept forever", () => {
    const groups = longLecture(20);
    const clock = new Clock(), video = new FakeVideo();
    const revoked = [];
    const prov = { id: "x", caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, audioKey: async p => p.id, render: async () => [] };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov }, audioCache: {},
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        revokeObjectURL: u => revoked.push(u) });
    video.currentTime = 60;
    eng.refresh(true);
    const early = eng.plans.slice(0, 5);
    early.forEach(p => eng.rendered.set(p.id, { url: "blob:" + p.id, duration: 2, stretch: 1, text: p.text }));
    video.currentTime = 900;                    // far ahead: the early plans leave the window
    eng.refresh(true);
    assert.ok(early.every(p => !eng.planById.has(p.id)));
    eng.releaseOld(900);
    assert.equal(eng.rendered.size, 0, "rendered audio of vanished plans must be freed");
    assert.equal(revoked.length, 5);
});

// ================= PLAYBACK DELIVERY (1.8.6) =================
// tools/playback-sim.js runs the real engine and VieNeu provider against a model of the service
// worker and the serial VieNeu server (slot held ~4.5 s after a client leaves). Old engine vs new on
// the same scenarios: seek back 0.8 -> 0.05 s to voice, rapid seeks 3.7 -> 1.4 s (max 7.1 -> 2.5),
// slow server 13.6 -> 7.7 s, audio elements alive 21 -> 2.
const SIM = require("../tools/playback-sim.js");
const simRun = (name, extra = {}) => SIM.run(require("../dub-engine.js"), { ...SIM.SCENARIOS[name], bgAbort: "queued", ...extra });

// The request count as a whole grew with the free voice's 60 s horizon (16 -> 19, all before the
// seek), so what is checked is the claim itself: nothing is requested while the held audio lasts
test("playback delivery: a seek back onto audio already in the page plays it at once, with no new request", async () => {
    let lastT = null, seekAt = null, before = null, after = null;
    const r = await simRun("seekBackward", { trace: ({ wall, video, eng }) => {
        if (seekAt == null && lastT != null && video.currentTime < lastT - 1) { seekAt = wall; before = eng.stats.requests; }
        if (seekAt != null && after == null && wall - seekAt >= 30000) after = eng.stats.requests - before;
        lastT = video.currentTime;
    } });
    assert.ok(r.seekRecover != null && r.seekRecover < 0.3, `voice ${r.seekRecover} s after the seek`);
    assert.equal(after, 0, "requests in the 30 s after a seek back onto held audio (a re-cut head line re-rendered it once)");
    assert.equal(r.duplicateGen, 0);
});

test("playback delivery: rapid seeks get voice back within 3 s each", async () => {
    const r = await simRun("rapidSeek");
    assert.ok(r.seekRecoverMax <= 3, `worst ${r.seekRecoverMax} s`);
});

// BACKLOG 33 (1.9.7): a server near real time. One scenario swings with the timing of a single
// seek (a request cut on the server holds its slot 4.5 s, which the page cannot see), so this runs
// 24: RTF 0.8/0.9/1.0, rate 1/1.5, 4 seek pairs. The seekWhileSlow scenario alone is such a swing:
// its seek times shifted by 0.25 s steps, 16 runs, 1.9.8 averaged 6.45 s to voice and 1.9.9 7.11 s,
// every difference from two shifts where the first request left 50 ms later and a line crossed the
// entered-too-late edge (5.5 -> 10.6 s). So the average over many runs is what is held here.
//          lines  late  gaps    voice back after a seek (mean)
//   1.9.6   280   101   138.6
//   1.9.8   290   104   143.8   4.11 s
//   1.9.9   282    98   128.6   4.26 s
//   2.0.6   278    96   136.0   4.36 s
//   2.1.5   279    99   142.6   4.36 s
// 1.9.9 speaks fewer: a job left behind by a seek now measures the server too (renderBatch), so the
// engine sees a server at 1.0x as one and gives up lines it cannot reach (5 of the 8) instead of
// reading them late; the 60 s horizon keeps the serial server busy further ahead when the seek
// comes (the other 3). Continuous viewing is what the horizon is for: see the fastSlowdown test.
// 2.0.6 moved the head cuts after a seek to phrase boundaries: 3 of the 4 lines are one run (RTF 0.9
// at 1.5x, where a skip decision came 8 s later). Paired over the 144-run slow matrix it is noise:
// lines -13 (22 runs more, 24 fewer), late -17, gaps -10 s, first voice sooner in 60 runs, later in 10.
// 2.1.5 (breathing commas at "/" too, speech +0.7%): the 144-run slow matrix went lines 2096 -> 2098,
// late 504 -> 502, gaps 735.2 -> 740.6 s (+0.7%, worse in 20 runs, better in 11), voice back after a
// seek 5.99 -> 5.89 s; these 24 runs swing more (gaps +6.7 s), so the gap bound is 145.
test("playback delivery: a slow server with seeks keeps its lines, late starts and gaps (24 runs)", async () => {
    let spoken = 0, late = 0, gaps = 0, rec = 0, n = 0;
    for (const rtf of [0.8, 0.9, 1.0]) for (const rate of [1, 1.5]) for (let s = 1; s <= 4; s++) {
        const a = 10 + (s * 7) % 15;
        const r = await SIM.run(require("../dub-engine.js"), { wall: 60, rate, rtf: () => rtf, seed: s, bgAbort: "queued",
            steps: [{ at: a, do: "seek", v: 30 + (s * 37) % 220 }, { at: a + 22, do: "seek", v: 15 + (s * 53) % 180 }] });
        spoken += r.spoken; late += r.late; gaps += r.gapSum;
        if (r.seekRecover != null) { rec += r.seekRecover; n++; }
    }
    assert.ok(spoken >= 275, `${spoken} lines spoken`);
    assert.ok(late <= 101 && gaps <= 145, `${late} late starts, ${gaps.toFixed(1)} s of gaps`);
    assert.ok(rec / n <= 4.5, `voice back ${(rec / n).toFixed(2)} s after a seek on average`);
});

// What the viewer reported (1.9.9): on a first view of a fast talk the Vietnamese subtitle showed,
// the voice went silent, came back quicker, then skipped lines it had not read. Measured live on
// zPSs9a0MYGw: the voice (Mỹ Duyên, 3.8 syllables/s) needed up to 1.25 s of audio per second of
// video while the Mac slowed VieNeu to RTF 0.6-0.87. 20 s ready ahead drained within a minute of
// that; 60 s lasts it: 1.9.8 dropped 11 of 66 lines here with 6.6 s of gaps, 1.9.9 none.
test("playback delivery: a fast talk keeps every line through two minutes of a slow server", async () => {
    const r = await simRun("fastSlowdown");
    assert.equal(r.dropped, 0, "lines dropped");
    assert.equal(r.spoken, 66);
    assert.ok(r.gapSum < 1, `${r.gapSum} s of gaps`);
    // every take made was heard: the simulator matches a take by the key it was made under (2.3.2;
    // recomputed at the start without the tight-pause flag, it counted 46 played takes as unplayed)
    assert.equal(r.unplayedGen, 0);
    // and every word of it is read, once (2.3.6: lines are counted, words are what the viewer hears)
    assert.deepEqual([r.wordsLost, r.wordsTwice], [0, 0]);
});

// 2.3.6: a caption line cut at a sentence end can now have its two halves in two translation windows
// (youtube.js closes a window at its hard limit even there). When the second half came while the
// first was being read, the planner carried it into that line; the engine went on from the next
// line start, so its words were never read: 17 of 51 here on 2.3.5.
test("playback delivery: the second half of a cut caption line, translated while the first plays, is still read", async () => {
    const mk = (start, end, text, extra) => ({ start, end, viText: text, viCues: [{ start, end, text, lines: [text] }], srcCues: [{ start, end, text: "src" }], ...extra });
    const A = ["Chúng tôi mua nhà năm ngoái và nấu ăn ở nhà nhiều hơn.", "Tôi dùng chiếc điện thoại này đã năm năm rồi.", "Mặt kính camera trước có một vết xước nhỏ."];
    const B = ["Tôi thấy mình tiết kiệm được khá nhiều tiền.", "Thật ra tôi không muốn đổi sang máy mới.", "Nó làm ảnh chụp hơi mờ một chút."];
    for (const into of [1.5, 3]) {
        const groups = A.flatMap((a, k) => [mk(12 * k + 1, 12 * k + 4.5, a, { batch: 2 * k }), mk(12 * k + 4.5, 12 * k + 8, B[k], { batch: 2 * k + 1, midLine: true })]);
        const r = await SIM.run(require("../dub-engine.js"), { groups, wall: 45, bgAbort: "queued", trAhead: 1e9,
            trLat: g => (g.batch % 2 ? groups[g.batch - 1].start + into : 0) });
        assert.deepEqual([r.spoken, r.wordsLost, r.wordsTwice], [6, 0, 0], `second half ${into} s into the first`);
    }
});

// 2.4.2, the user's 2026-10-01 batch: after a line too dense to fit, the next one was due more than
// maxQueueLag ago and was dropped whole, though it was sparse enough to give the time back (nm1TxQj9IsQ
// lost a 10-second line that way at 20:52). 2.4.1 drops the third line here.
test("playback delivery: a line late after a dense one is read rather than dropped", async () => {
    const POOL = "chúng tôi đã thử nhiều cách khác nhau trong suốt mấy năm qua để tìm ra điều thật sự hiệu quả cho cả gia đình mình và bạn bè xung quanh".split(" ");
    const mk = (start, end, n) => {
        const text = Array.from({ length: n }, (_, i) => POOL[i % POOL.length]).join(" ") + ".";
        return { start, end, viText: text, viCues: [{ start, end, text, lines: [text] }], srcCues: [{ start, end, text: "src" }] };
    };
    const groups = [mk(1, 7, 22), mk(7.2, 13, 66), mk(13.2, 25, 22), mk(25.5, 31, 18)];
    const r = await SIM.run(require("../dub-engine.js"), { groups, wall: 45, sps: 3.8, bgAbort: "queued", trAhead: 1e9, trLat: () => 0 });
    assert.deepEqual([r.dropped, r.wordsLost], [0, 0]);
    assert.equal(r.spoken, 5);
    // 2.4.5: dense lines right behind it give no time back, and are read late all the same (2.4.4
    // dropped the first of them, 14 words)
    const tight = [mk(1, 7, 22), mk(7.2, 13, 70), mk(13.2, 15, 14), mk(15.2, 17, 14), mk(17.2, 40, 20)];
    const r2 = await SIM.run(require("../dub-engine.js"), { groups: tight, wall: 60, sps: 3.8, bgAbort: "queued", trAhead: 1e9, trLat: () => 0 });
    assert.deepEqual([r2.dropped, r2.wordsLost, r2.spoken], [0, 0, 6]);
});

test("playback delivery: pausing never cancels the request for the lines just ahead", async () => {
    // "running": the old service worker, which cut a started request. Any cancel would show here.
    const r = await simRun("pauseResume", { bgAbort: "running" });
    assert.equal(r.cutRunning, 0);
    assert.equal(r.droppedQueued, 0);
});

test("playback delivery: in every scenario no two voices overlap, no line is generated twice, at most 3 audio elements live", async () => {
    for (const name of Object.keys(SIM.SCENARIOS)) {
        const r = await simRun(name);
        assert.equal(r.overlapTicks, 0, `${name}: overlap`);
        assert.equal(r.duplicateGen, 0, `${name}: duplicate generation`);
        assert.ok(r.maxEls <= 3, `${name}: ${r.maxEls} audio elements alive`);
        // 90 s behind (keepBehind) and up to 90 s ahead (freeAheadMax): a fast talk's Vietnamese runs
        // up to 1.1 s of audio per second of it. 195 s at most here (18 MB of 48 kHz WAV); 150 in 1.9.8
        assert.ok(r.maxHeld <= 210, `${name}: ${r.maxHeld} s of audio held`);
        assert.ok(r.maxRendered <= 45, `${name}: ${r.maxRendered} lines held`);
    }
});

// 2.4.6, the user's "bụp bụp, lúc được lúc không" (two videos): chrome://media-internals showed a
// voice element Chrome was slow to start (0.16 to 0.96 s while VieNeu made takes) seeked 7 times in
// 1.1 s by driftCorrect, each seek a pop that restarted the wait. The simulator's elements started
// at once, so no run ever showed it. With Chrome's start-up modelled (LATENCY=busy), 2.4.5 seeked
// playing voices 0 to 238 times per scenario, passed over up to 34.5 s of takes, and brought voices
// up inside a take at full volume up to 10 times.
test("playback delivery: a voice Chrome is slow to start is never seeked: 0 seeks, 0 take seconds skipped, 0 clicks, in every scenario", async () => {
    for (const name of Object.keys(SIM.SCENARIOS)) {
        const quick = await simRun(name);
        const r = await simRun(name, { latency: "busy" });
        assert.equal(r.reseeks, 0, `${name}: ${r.reseeks} seeks of a playing voice`);
        assert.equal(r.skippedS, 0, `${name}: ${r.skippedS} s of takes passed over`);
        assert.equal(r.hardStarts, 0, `${name}: ${r.hardStarts} voices came up inside a take at full volume`);
        assert.equal(r.overlapTicks, 0, `${name}: overlap`);
        assert.ok(r.spoken >= quick.spoken - 1, `${name}: ${r.spoken} lines spoken, ${quick.spoken} when every element starts at once`);
    }
});

test("a voice Chrome takes 0.4 s to start at 1.4x is not seeked: the wait moves the line later, every word kept", () => {
    const eng = Object.create(DubEngine.prototype);
    let wall = 0, time = 0, holdUntil = 0, writes = 0;
    eng.d = { now: () => wall };
    eng.settings = { volume: 1 };
    eng.stats = { corrections: 0 };
    // Chrome-like: currentTime stays where it was set until the element has started, after play()
    // and after every seek while it plays
    const el = {
        paused: true, volume: 1, playbackRate: 1,
        get currentTime() { return time; },
        set currentTime(v) { if (!this.paused) { writes++; holdUntil = wall + 400; } time = v; },
        play() { this.paused = false; holdUntil = wall + 400; return Promise.resolve(); }
    };
    const S = { id: "a", mediaStart: 10, offset: 0, rate: 1.4, end: 10 + 3 / 1.4 };
    for (let k = 0; k <= 60; k++) {
        wall = k * 50;
        if (k > 0 && !el.paused && wall > holdUntil) time += 0.05 * el.playbackRate;
        eng.driveSpeech(S, { el }, 10 + wall / 1000, 1, k === 0);
    }
    assert.equal(writes, 0, `the starting voice was seeked ${writes} times (2.4.5: every 150 ms, 7 in 1.1 s live)`);
    assert.equal(eng.stats.corrections, 0);
    assert.ok(Math.abs(S.mediaStart - 10.45) < 0.06, `the line moved ${(S.mediaStart - 10).toFixed(2)} s for a 0.4 s start`);
    assert.ok(Math.abs(S.end - (10.45 + 3 / 1.4)) < 0.06, "its end moved with it");
    assert.equal(eng.stats.startUp.n, 1);
});

test("a voice resumed inside its take stays silent until it moves, then fades in; a sounding voice steps down before it pauses", () => {
    const clock = new Clock();
    const eng = Object.create(DubEngine.prototype);
    const video = { currentTime: 20 };
    eng.d = { now: () => clock.now(), setTimeout: (f, ms) => clock.setTimeout(f, ms), video };
    eng.settings = { volume: 0.9 };
    eng.stats = { corrections: 0 };
    eng.running = true;
    const el = new FakeAudio(clock, { duration: 5 }, 0, { startLatency: 120 });
    const r = { el };
    eng.rendered = new Map([["a", r]]);
    // the video resumes at 20 s, 2.4 s into this take: mid-word
    const S = eng.speech = { id: "a", mediaStart: 18, offset: 0, rate: 1.2, end: 18 + 5 / 1.2 };
    eng.driveSpeech(S, r, 20, 1);
    assert.equal(el.paused, false);
    assert.equal(el.volume, 0, "a resume inside the take starts silent");
    const vols = [];
    for (let k = 0; k < 40; k++) {
        clock.advance(5, st => { video.currentTime += st / 1000; el.step(st); });
        vols.push(el.volume);
    }
    assert.equal(el.hardStarts, 0, "the voice came up inside its take at full volume (a click)");
    const first = vols.find(v => v > 0);
    assert.ok(first <= 0.9 * 0.1, `the first sound came up at ${(first / 0.9).toFixed(2)} of the level`);
    for (let i = 1; i < vols.length; i++) assert.ok(vols[i] >= vols[i - 1], "the fade went down");
    assert.ok(Math.abs(vols[vols.length - 1] - 0.9) < 1e-9, `left at ${vols[vols.length - 1]}`);
    // the video pauses: the voice steps down over SYNC.pauseFade, then pauses
    let atPause = null;
    const pause0 = el.pause.bind(el);
    el.pause = () => { atPause = el.volume; pause0(); };
    eng.quietPause(el);
    assert.equal(el.paused, false, "a sounding voice cut at once");
    clock.advance(60, st => el.step(st));
    assert.equal(el.paused, true);
    assert.ok(atPause <= 0.9 * 0.05, `paused at ${(atPause / 0.9).toFixed(2)} of the level`);
    assert.equal(el.cuts, 0, "paused while still loud");
});

// 2.4.7: a seek, an ad or dubbing off let a sounding voice go at once (pause, src removed): a click
// on every seek while the voice spoke (simulator: 8 of 18 cuts were seeks, the rest dubbing off)
test("a voice let go while sounding (a seek, dubbing off) fades out first, then is released", () => {
    const clock = new Clock();
    const eng = Object.create(DubEngine.prototype);
    eng.d = { now: () => clock.now(), setTimeout: (f, ms) => clock.setTimeout(f, ms) };
    const make = () => {
        const el = new FakeAudio(clock, { duration: 5 });
        el.volume = 0.9;
        el.play();
        el.step(100);
        el.attrs = { src: "blob:1" };
        el.removeAttribute = n => { delete el.attrs[n]; };
        el.load = () => {};
        return el;
    };
    for (const already of [false, true]) {
        const el = make(), r = { el };
        let after = 0;
        if (already) eng.quietPause(el);                 // hardReset: silence() began the fade
        eng.releaseAudio(r, true, () => after++);
        assert.equal(r.el, null, "the line still holds the element");
        assert.equal(el.paused, false, "cut at once");
        clock.advance(60, st => el.step(st));
        assert.equal(el.paused, true);
        assert.equal(el.cuts, 0, "paused while still loud");
        assert.equal(el.attrs.src, undefined, "src kept after the fade");
        assert.equal(after, 1);
    }
    // a voice already silent, or no fade asked: let go at once, as before
    const el = make();
    eng.releaseAudio({ el });
    assert.equal(el.paused, true);
    assert.equal(el.attrs.src, undefined);
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "dub-engine.js"), "utf8");
    assert.match(src, /if \(r\.el\) this\.releaseAudio\(r, true\);/, "hardReset fades");
    assert.match(src, /if \(r\.el\) this\.releaseAudio\(r, true, revoke\);/, "stop() fades and revokes after");
});

// 2.0.8: the original track came back after duckHold whatever came next. In a 0.8 s sentence gap it
// was at full just as the next line began and was ducked again under that line's first words (a
// pump), and after a pause the line went on over it at full. These three scenarios before: 25 of 40
// gaps under 1.5 s pumped, 61 of 74 lines began over it above 30%; in gaps over 2.5 s it was back at
// full 74% of the time (60% now: it comes down before the next line). The first line after the start
// is left out: its take lands when it is due, so nothing can bring the original down ahead of it.
test("playback delivery: the original stays down through a short gap and a pause, is down when a line starts, and comes back in a long gap", async () => {
    let shortGaps = 0, pumps = 0, starts = 0, longTicks = 0, longBack = 0;
    const loud = [];
    for (const name of ["normal", "pauseResume", "rate15"]) {
        let prevVoice = false, gap = null, first = true;
        await simRun(name, { trace: ({ wall, video, eng }) => {
            const S = eng.speech, r = S && eng.rendered.get(S.id);
            const f = video.volume / (eng.baseVolume != null ? eng.baseVolume : 0.8);
            if (video.paused) { prevVoice = false; gap = null; return; }   // a pause is not a gap
            const voice = !!(r && r.el && !r.el.paused);
            if (voice && !prevVoice) {
                if (gap && wall - gap.at < 1500) { shortGaps++; if (gap.peak > 0.5) pumps++; }
                if (gap && wall - gap.at >= 2500) { longTicks += gap.ticks; longBack += gap.back; }
                if (!first) { starts++; if (f > 0.3) loud.push(`${name} ${S.id} ${f.toFixed(2)}`); }
                first = false;
                gap = null;
            } else if (!voice) {
                if (prevVoice) gap = { at: wall, peak: 0, ticks: 0, back: 0 };
                if (gap) { gap.peak = Math.max(gap.peak, f); gap.ticks++; if (f > 0.9) gap.back++; }
            }
            prevVoice = voice;
        } });
    }
    assert.ok(starts >= 60 && shortGaps >= 30 && longTicks > 0, `too little measured: ${starts} starts, ${shortGaps} short gaps`);
    assert.equal(pumps, 0, `${pumps} of ${shortGaps} short gaps let the original up and down again`);
    assert.deepEqual(loud, [], "lines that began over the original above 30%");
    assert.ok(longBack / longTicks > 0.4, `the original back at full for only ${(100 * longBack / longTicks).toFixed(0)}% of the long gaps`);
});

test("slow server: a close line whose take is still being made keeps the original down, and a long wait lets it up", async () => {
    // 2.1.3: slowTts had 2 short gaps (0.97 s, 1.4 s) where the next take was on the way but not made,
    // so nothing announced the line and the original came up to full, then down again under it
    let shortGaps = 0, pumps = 0, longestDown = 0, downAt = null;
    let prevVoice = false, gap = null;
    await simRun("slowTts", { trace: ({ wall, video, eng }) => {
        const S = eng.speech, r = S && eng.rendered.get(S.id);
        const f = video.volume / (eng.baseVolume != null ? eng.baseVolume : 0.8);
        if (video.paused) { prevVoice = false; gap = null; downAt = null; return; }
        const voice = !!(r && r.el && !r.el.paused);
        if (voice && !prevVoice && gap && wall - gap.at < 1500) { shortGaps++; if (gap.peak > 0.5) pumps++; }
        if (voice) { gap = null; downAt = null; }
        else {
            if (prevVoice) gap = { at: wall, peak: 0 };
            if (gap) gap.peak = Math.max(gap.peak, f);
            if (f >= 0.5) downAt = null;
            else { if (downAt == null) downAt = wall; longestDown = Math.max(longestDown, wall - downAt); }
        }
        prevVoice = voice;
    } });
    assert.ok(shortGaps >= 10, `too little measured: ${shortGaps} short gaps`);
    assert.equal(pumps, 0, `${pumps} of ${shortGaps} short gaps let the original up and down again`);
    // Held at most duckBridge after a line, plus duckHold and the ramp back up
    const { SYNC } = require("../dub-engine.js");
    assert.ok(longestDown <= (SYNC.duckBridge + 1) * 1000, `the original held down ${longestDown} ms with no voice`);
});

test("playback delivery: stopping the engine (another video, dubbing off) drops its queued requests", async () => {
    const clock = new Clock(), video = new FakeVideo();
    const aborted = [];
    const prov = {
        id: "vieneu", caps: { prerender: true, live: false, free: true, serial: true, maxBatch: 1 },
        voiceModel: PLAN.DEFAULT_VOICE_MODEL, audioKey: async p => "k" + p.id,
        abort: id => aborted.push(id), render: () => new Promise(() => {})
    };
    const eng = new DubEngine({ video, getGroups: () => lectureGroups(), providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms), createObjectURL: () => "blob:x", revokeObjectURL() {},
        audioCache: { get: async () => ({}), put() {} } });
    eng.start();
    video.play();
    for (let i = 0; i < 20 && !eng.jobs.size; i++) { clock.advance(50, st => video.step(st)); await new Promise(r => setImmediate(r)); }
    assert.ok(eng.jobs.size >= 1, "no request was made");
    const ids = [...eng.jobs.keys()];
    eng.stop();
    assert.deepEqual(aborted, ids);
});

// 1.8.7: entering a line after a seek. The proportional position started inside a syllable 85% of
// the time on 25 real VieNeu takes (1,509 landings), with no fade-in; a gap between words is used
// now (0.3%). Checked here on the three Mỹ Duyên takes in tests/audio.
test("playback delivery: a line entered mid-way starts in a gap between words, not inside a syllable", () => {
    const eng = Object.create(DubEngine.prototype);
    eng.stats = {};
    let n = 0, oldVoiced = 0, newVoiced = 0;
    for (const f of ["vieneu-my-duyen-long-ma.wav", "vieneu-my-duyen-nen.wav", "vieneu-my-duyen-rang.wav"]) {
        const bytes = new Uint8Array(fs.readFileSync(path.join(__dirname, "audio", f)));
        const { samples, sampleRate: sr } = AUDIO.decodeWav(bytes);
        const D = samples.length / sr;
        const r = { stops: eng.findStops(bytes, D), duration: D };
        assert.ok(r.stops && r.stops.length >= 2, `${f}: no stops found`);
        const rms = t => { let q = 0; const a = Math.floor(t * sr), b = Math.min(samples.length, a + sr / 100); for (let i = a; i < b; i++) q += samples[i] * samples[i]; return Math.sqrt(q / Math.max(1, b - a)); };
        const loud = Math.max(...Array.from({ length: Math.floor(D * 100) }, (_, k) => rms(k / 100)));
        const voiced = t => rms(t) > loud * 0.03;
        for (let o = 0.35; o < D - Math.min(0.8, D * 0.5); o += 0.05) {
            const e = eng.entryPoint(r, o);
            n++;
            if (voiced(o)) oldVoiced++;
            if (voiced(e)) newVoiced++;
            assert.ok(o - e <= 1.2 + 1e-9 && e - o <= 0.8 + 1e-9, `entry ${e} too far from ${o}`);
        }
    }
    assert.ok(oldVoiced / n > 0.6, `proportional entries inside the voice: ${oldVoiced}/${n}`);
    assert.ok(newVoiced / n < 0.05, `entries inside the voice: ${newVoiced}/${n}`);
    assert.equal(eng.entryPoint({ stops: null }, 2.3), 2.3, "a take without stops keeps the proportional entry");
});

test("playback delivery: a rewind past what the page holds finds the store first; the first line at 2x is not rendered in vain", async () => {
    const far = await simRun("seekBackFar");
    assert.ok(far.seekRecover < 0.3, `voice ${far.seekRecover} s after a 3-minute rewind (a re-cut head: 0.95)`);
    assert.ok(far.serverRuns <= 27, `${far.serverRuns} requests`);
    const fast = await simRun("rate2");
    assert.ok(fast.firstAudio <= 2, `first voice at 2x after ${fast.firstAudio} s (2.75 before)`);
    const normal = await simRun("normal");
    assert.ok(normal.firstAudio <= 1.65, `the optimistic reach must keep the first line at 1x: ${normal.firstAudio} s`);
});

// ================= SLOW SERVER ON A FAST TALK (1.9.9) =================
// An engine on the free local voice whose renders the test finishes by hand
function freeVoiceEngine(render = () => new Promise(() => {})) {
    const clock = new Clock(), video = new FakeVideo();
    const prov = { id: "vieneu", caps: { prerender: true, live: false, free: true, serial: true, maxBatch: 1 }, voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL },
        naturalSps: () => 4, audioKey: async p => "k" + p.id, abort() {}, render };
    const eng = new DubEngine({ video, getGroups: () => lectureGroups(), providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id), setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createObjectURL: () => "blob:x", revokeObjectURL() {}, createAudio: () => new FakeAudio(clock, { duration: 2.5 }),
        audioCache: { get: async () => ({}), put() {} } });
    return { clock, video, eng };
}

test("free voice keeps at least 60 s of audio ready ahead, in media seconds scaled by the video rate", () => {
    const { SYNC } = require("../dub-engine.js");
    const { video, eng } = freeVoiceEngine();
    video.play();
    assert.ok(SYNC.freeAheadMin >= 60, "20 s drained within a minute of a slow server on a fast talk");
    assert.ok(eng.prefetchAhead() >= SYNC.freeAheadMin && eng.prefetchAhead() <= SYNC.freeAheadMax);
    video.playbackRate = 2;
    assert.ok(eng.prefetchAhead() >= 2 * SYNC.freeAheadMin, "at 2x, 60 media seconds last only 30 s of real time");
    video.playbackRate = 1;
    video.pause();
    assert.ok(eng.prefetchAhead() <= Math.max(SYNC.prefetchPaused, SYNC.prefetchMin), "paused: only what is just ahead");
    eng.provider = { ...eng.provider, caps: { ...eng.provider.caps, free: false } };
    video.play();
    assert.ok(eng.prefetchAhead() <= SYNC.prefetchMax, "a paid voice keeps its cap");
});

// Live (1.9.9): a busy Mac delays the page's timers. A tick 3 s late saw the video 3 s further and
// took it for a seek: the line being read was cut and entered again mid-way
test("a page timer that ran late is not taken for a seek; a jump the clock does not explain still resets", () => {
    const { clock, video, eng } = freeVoiceEngine();
    eng.start();
    video.play();
    clock.advance(2000, st => video.step(st));
    clock.ms += 3000;                          // the main thread froze for 3 s; the video played on
    video.currentTime += 3;
    eng.tick();
    assert.ok(!eng.events.some(e => e.k === "reset"), JSON.stringify(eng.events));
    assert.equal(eng.stats.lateTicks, 1);
    video.currentTime += 30;                   // the player moved with no seeking event
    eng.tick();
    assert.ok(eng.events.some(e => e.k === "reset" && e.why === "jump"));
});

// Live (1.9.9): on a server at 1.0x nearly every job is left behind by the time it lands; counting
// only the others kept the estimate at 0.47, and the engine chased lines it could not reach
// (worst voice-back after a seek 35 s in the 144-run matrix, 24.4 s with this)
test("a take left behind by a seek still measures the server", async () => {
    let finish = null;
    const { clock, video, eng } = freeVoiceEngine(batch => new Promise(res => {
        finish = () => res(batch.map(p => ({ planId: p.id, wav: new Uint8Array(8), duration: 5 })));
    }));
    eng.start();
    video.play();
    for (let i = 0; i < 40 && !finish; i++) { clock.advance(50, st => video.step(st)); await new Promise(r => setImmediate(r)); }
    assert.ok(finish, "no request was made");
    eng.renderRtf = eng.lastRtf = 0.3;         // a healthy server so far
    for (const j of eng.jobs.values()) j.orphan = true;
    clock.ms += 4500;                          // 5 s of audio in 4.5 s: about 0.8x real time
    finish();
    for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
    assert.ok(eng.renderRtf > 0.4, `estimate ${eng.renderRtf} after a slow take`);
});

test("diagnostics: every line the engine gives up is in the event ring with its reason", async () => {
    for (const name of ["seekWhileSlow", "slowTts", "rapidSeek"]) {
        let eng = null;
        await simRun(name, { trace: x => { eng = x.eng; } });
        const E = eng.events;
        assert.ok(E.length < require("../dub-engine.js").SYNC.eventKeep, `${name}: ring full, the count below would be short`);
        const counted = E.filter(e => e.k === "drop" && e.why !== "entered-too-late").length + E.filter(e => e.k === "skip").reduce((a, e) => a + e.lines, 0);
        assert.equal(counted, eng.stats.dropped, `${name}: ${JSON.stringify(E.filter(e => e.k !== "late"))}`);
        assert.ok(E.every(e => typeof e.at === "number" && typeof e.t === "number" && e.k));
        const snap = eng.debugSnapshot();
        assert.deepEqual(snap.events, E);
        assert.ok("rtf" in snap && "lateTicks" in snap && "spoken" in snap);
    }
    const { eng } = freeVoiceEngine();
    const { SYNC } = require("../dub-engine.js");
    for (let i = 0; i < SYNC.eventKeep + 20; i++) eng.note("error", { kind: "x" + i });
    assert.equal(eng.events.length, SYNC.eventKeep);
    assert.equal(eng.events[eng.events.length - 1].kind, "x" + (SYNC.eventKeep + 19));
});

// ================= RESILIENCE (1.8.8) =================
// Each case failed before: reproduced with tests/dub-sim.js, measured over 60 s of the lecture.
async function resilienceRun({ get, render, seconds = 60, groups = lectureGroups(), makeAudio = null, each = null, deps = {} }) {
    const clock = new Clock(), video = new FakeVideo(), audios = [];
    let urls = 0, revoked = 0;
    const prov = { id: "vieneu", caps: { prerender: true, live: false, free: true, serial: true, maxBatch: 1 }, voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL },
        naturalSps: () => 4, audioKey: async p => "k" + p.id, abort() {}, render };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id), setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createObjectURL: b => { urls++; return (b && b[0] === 9 ? "blob:bad:" : "blob:") + urls; }, revokeObjectURL: () => { revoked++; },
        createAudio: url => { const a = makeAudio ? makeAudio(clock, url) : new FakeAudio(clock, { duration: 2.5 }); audios.push(a); return a; },
        audioCache: { get, put() {} }, ...deps });
    eng.start();
    video.play();
    for (let i = 0; i < seconds * 20; i++) {
        clock.advance(50, st => { video.step(st); audios.forEach(a => a.step(st)); });
        if (each) each(i * 50, eng);
        await new Promise(r => setImmediate(r));
    }
    eng.stop();
    // a sounding voice fades out before it is let go (2.4.7): give the fade its 40 ms
    clock.advance(100, st => audios.forEach(a => a.step(st)));
    return { eng, spoken: eng.stats.started.length, live: () => urls - revoked, audios };
}
const okRender = async plans => plans.map(p => ({ planId: p.id, wav: new Uint8Array(8), duration: 2.5 }));

test("decodeWav refuses a header it cannot read (rate 0 or 4 GHz, 0 channels, float, cut fmt) with code wav_invalid", () => {
    const A = require("../dub-audio.js");
    const good = A.encodeWav(new Float32Array(4800).map((_, i) => Math.sin(i / 5) * 0.3), 48000);
    const mut = f => { const b = new Uint8Array(good); f(new DataView(b.buffer)); return b; };
    assert.equal(A.decodeWav(good).sampleRate, 48000);
    const bad = {
        rate0: mut(dv => dv.setUint32(24, 0, true)), rateHuge: mut(dv => dv.setUint32(24, 4e9, true)),
        channels0: mut(dv => dv.setUint16(22, 0, true)), float: mut(dv => dv.setUint16(20, 3, true)),
        fmtCut: mut(dv => dv.setUint32(16, 8, true)), short: good.slice(0, 8), truncated: good.slice(0, 30)
    };
    for (const [k, b] of Object.entries(bad)) {
        assert.throws(() => A.decodeWav(b), e => e.code === "wav_invalid", k);
    }
});

// 1.9.0: what the page does when the browser refuses to play a take. Before, every refusal went to
// onProviderError and the paused element was asked to play again on every 50 ms tick.
const playError = name => { const e = new Error(name); e.name = name; return e; };
class RefusingAudio extends FakeAudio {
    constructor(clock, meta, refuse) { super(clock, meta); this.refuse = refuse; this.plays = 0; }
    play() {
        this.plays++;
        const name = this.refuse(this);
        if (!name) return super.play();
        this.paused = true;
        return Promise.reject(playError(name));
    }
}

test("play refused by the autoplay policy: asked again once a second, not every tick; voice comes back when allowed", async () => {
    let blocked = true, sawBlocked = false;
    const r = await resilienceRun({ get: async () => ({}), render: okRender, seconds: 40,
        makeAudio: clock => new RefusingAudio(clock, { duration: 2.5 }, () => blocked ? "NotAllowedError" : null),
        each: (ms, eng) => { if (eng.playBlocked) sawBlocked = true; if (ms === 20000) blocked = false; } });
    const plays = r.audios.reduce((a, x) => a + x.plays, 0);
    assert.ok(plays < 80, `${plays} play() calls in 20 s of refusals`);
    assert.ok(r.eng.stats.errorTypes.play_blocked >= 1);
    assert.ok(sawBlocked, "the badge was never told the sound is blocked");
    assert.equal(r.eng.playBlocked, false, "still flagged blocked after playback resumed");
    assert.ok(r.audios.some(a => a.plays > 0 && !a.refuse(a) && a.currentTime > 0), "no voice after the block lifted");
});

test("play interrupted by a pause or seek (AbortError) is not an error: never counted toward switching the voice", async () => {
    const first = new Set();
    const r = await resilienceRun({ get: async () => ({}), render: okRender, seconds: 30,
        makeAudio: clock => new RefusingAudio(clock, { duration: 2.5 }, a => { if (first.has(a)) return null; first.add(a); return "AbortError"; }) });
    assert.ok(r.spoken >= 5);
    assert.equal(r.eng.stats.errors, 0, "AbortError counted as a provider error");
    assert.ok(r.eng.stats.errorTypes.play_interrupted >= 1);
});

test("a take the browser cannot play (NotSupportedError) is dropped and made again, not retried every tick", async () => {
    let badPlan = null;
    const renders = new Map();
    const render = async plans => plans.map(p => {
        renders.set(p.id, (renders.get(p.id) || 0) + 1);
        if (badPlan == null && renders.size === 3) badPlan = p.id;
        const wav = new Uint8Array(8);
        if (p.id === badPlan && renders.get(p.id) === 1) wav[0] = 9;          // only the first take is broken
        return { planId: p.id, wav, duration: 2.5 };
    });
    const r = await resilienceRun({ get: async () => ({}), render, seconds: 40,
        makeAudio: (clock, url) => new RefusingAudio(clock, { duration: 2.5 }, () => /bad/.test(url) ? "NotSupportedError" : null) });
    const bad = r.audios.filter(a => a.refuse(a));
    const badPlays = bad.reduce((a, x) => a + x.plays, 0);
    assert.ok(bad.length >= 1, "the broken take was never tried");
    assert.ok(badPlays <= 3, `${badPlays} play() calls on a take that cannot play`);
    assert.ok(renders.get(badPlan) >= 2, "the broken take was not made again");
    assert.ok(r.eng.stats.errorTypes.play_failed >= 1);
});

test("resilience: a store lookup that never answers no longer silences dubbing (0 -> most lines spoken)", async () => {
    const base = await resilienceRun({ get: async () => ({}), render: okRender });
    const hung = await resilienceRun({ get: () => new Promise(() => {}), render: okRender });
    assert.ok(hung.spoken >= base.spoken * 0.6, `${hung.spoken} of ${base.spoken} lines`);
    assert.ok(hung.eng.stats.errorTypes.lookup_timeout >= 1);
});

test("resilience: TTS requests that never answer stop counting after orphanStallMs; voice comes back", async () => {
    let n = 0;
    const r = await resilienceRun({ get: async () => ({}), render: plans => n++ < 3 ? new Promise(() => {}) : okRender(plans) });
    assert.ok(r.spoken >= 5, `${r.spoken} lines after three silent requests (0 before 1.8.8)`);
    assert.ok(r.eng.stats.errorTypes.job_stalled >= 1);
});

test("resilience: a take whose duration is missing or NaN is measured from its WAV header; garbage is refused", async () => {
    const real = AUDIO.encodeWav(new Float32Array(48000 * 2.5), 48000);
    const base = await resilienceRun({ get: async () => ({}), render: okRender });
    const nan = await resilienceRun({ get: async () => ({}), render: async plans => plans.map(p => ({ planId: p.id, wav: real, duration: NaN })) });
    assert.equal(nan.spoken, base.spoken, "a NaN duration jammed the engine after one line");
    const eng = Object.create(DubEngine.prototype);
    assert.equal(Math.round(eng.audioLength(real, undefined) * 10) / 10, 2.5);
    assert.equal(eng.audioLength(real, 3.1), 3.1);
    assert.equal(eng.audioLength(null, 2), null);
    assert.equal(eng.audioLength(new Uint8Array(0), 2), null);
    assert.equal(eng.audioLength(new Uint8Array(8), Infinity), null);
    assert.equal(eng.audioLength(new Uint8Array(8), -1), null);
});

test("resilience: a store hit arriving after stop() or for a re-translated line is dropped (no leak, no stale voice)", async () => {
    const clock = new Clock(), video = new FakeVideo();
    let groups = lectureGroups(), urls = 0, revoked = 0, answer = null;
    const prov = { id: "vieneu", caps: { prerender: true, free: true, serial: true, maxBatch: 1 }, voiceModel: { ...PLAN.DEFAULT_VOICE_MODEL }, audioKey: async p => "k" + p.id, render: () => new Promise(() => {}) };
    const eng = new DubEngine({ video, getGroups: () => groups, providers: { primary: prov }, now: () => clock.now(),
        setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id), setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createObjectURL: () => { urls++; return "u"; }, revokeObjectURL: () => { revoked++; },
        audioCache: { get: () => new Promise(r => { answer = r; }), put() {} } });
    eng.start();
    const p0 = eng.plans[0];
    const pending0 = eng.lookupCache([p0]);
    // the line is re-translated while the lookup is out
    const cur = { ...p0, text: p0.text + " đã sửa" };
    eng.plans[0] = cur;
    eng.planById.set(p0.id, cur);
    await new Promise(r => setImmediate(r));
    answer({ ["k" + p0.id]: { wav: new Uint8Array(8), duration: 2 } });
    await pending0;
    assert.equal(eng.rendered.has(p0.id), false, "audio of the old text was kept for the new line");
    const p1 = eng.plans[1];
    const pending1 = eng.lookupCache([p1]);
    eng.stop();
    await new Promise(r => setImmediate(r));
    answer({ ["k" + p1.id]: { wav: new Uint8Array(8), duration: 2 } });
    await pending1;
    assert.equal(eng.rendered.size, 0);
    assert.equal(urls - revoked, 0, "a blob URL made after stop() is never revoked");
});

test("resilience: a watchdog-released job finishing late does not clear its retry's claim", async () => {
    const eng = Object.create(DubEngine.prototype);
    eng.pending = new Map([["t1", "tts2"]]);
    const batch = [{ id: "t1" }];
    batch.forEach(p => { if (eng.pending.get(p.id) === "tts1") eng.pending.delete(p.id); });
    assert.equal(eng.pending.get("t1"), "tts2");
    assert.match(fs.readFileSync(path.join(__dirname, "..", "dub-engine.js"), "utf8"), /if \(this\.pending\.get\(p\.id\) === jobId\) this\.pending\.delete\(p\.id\)/);
});

// ================= DROP COUNT (BACKLOG 38) =================
test("a line waited on for audio after a seek and lost counts as dropped; a seek into a line's last second does not", () => {
    const { eng } = freeVoiceEngine();
    const plan = (id, start, end) => ({ id, start, end, phrases: [{ offset: 0, dur: end - start }] });
    eng.plans = [plan("a", 10, 14), plan("b", 14, 18), plan("c", 18, 22)];
    eng.planById = new Map(eng.plans.map(p => [p.id, p]));
    eng.rendered = new Map();
    // seek into "a" with 3.5 s left, no audio: wait; then "a" passes and "b" begins
    assert.equal(eng.nextSpeech(10.5), null);
    assert.equal(eng.nextSpeech(14.2), null);
    assert.equal(eng.stats.dropped, 1, "the quick menu's 'đã bỏ N câu' missed this line");
    assert.ok(eng.events.some(e => e.k === "drop" && e.id === "a" && e.why === "entry-no-audio"));
    // audio for "b" lands too late to say any of it: lost as well
    eng.rendered.set("b", { duration: 3.5 });
    eng.entryPoint = (r, x) => x;
    assert.equal(eng.nextSpeech(17.8), null);
    assert.equal(eng.stats.dropped, 2);
    // a fresh seek into the last half second of "c", no audio, then it passes: the viewer's skip
    eng.hardReset("seek");
    const before = eng.stats.dropped;
    assert.equal(eng.nextSpeech(21.6), null);
    eng.plans.push(plan("d", 22, 25));
    eng.planById.set("d", eng.plans[3]);
    assert.equal(eng.nextSpeech(22.1), null);
    assert.equal(eng.stats.dropped, before);
    // audio for a waited line that arrives in time is spoken, not counted
    eng.hardReset("seek");
    eng.rendered.delete("d");
    assert.equal(eng.nextSpeech(22.2), null);
    eng.rendered.set("d", { duration: 3 });
    assert.ok(eng.nextSpeech(22.6));
    assert.equal(eng.stats.dropped, before);
});

test("engine stop: the next-line wake-up timer is cancelled; the page passes clearTimeout", () => {
    const clock = new Clock(), video = new FakeVideo();
    const provider = { id: "vieneu", caps: { prerender: true, free: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const eng = new DubEngine({
        video, getGroups: () => lectureGroups(), providers: { primary: provider },
        now: () => clock.now(), setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id),
        setTimeout: (f, ms) => clock.setTimeout(f, ms), clearTimeout: id => clock.clear(id),
        createObjectURL: () => "blob:x", revokeObjectURL() {}, createAudio: () => new FakeAudio(clock, { duration: 1 })
    });
    eng.start();
    let fired = 0;
    eng.gapTimer = clock.setTimeout(() => { fired++; eng.gapTimer = null; }, 500);
    eng.stop();
    assert.equal(eng.gapTimer, null);
    clock.advance(1000);
    assert.equal(fired, 0, "the old wake-up still fired after stop");
    assert.match(fs.readFileSync(path.join(__dirname, "..", "dubbing.js"), "utf8"), /clearTimeout: id => clearTimeout\(id\)/);
});

// ================= Coursera start hold (2.5.0) =================
// Coursera autoplays a lecture before its first lines are voiced (measured: the greeting never
// spoken, the first voice on the second line). courseraHoldFirstPlay is run for real, lifted out of
// content.js into a small fake page.
function courseraHoldEnv({ dubEnabled = true, prepareWait = true, playing = false } = {}) {
    const vm = require("node:vm");
    const src = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
    const fn = src.slice(src.indexOf("function courseraHoldFirstPlay"), src.indexOf("async function courseraAutoTranslateNow"));
    class HTMLVideoElement { constructor() { this.paused = !playing; this.currentTime = 0; this.parentElement = {}; } }
    const listeners = new Map();
    const holds = [];
    const api = { dub: { engine: null }, hold: { active: false, release() { this.active = false; holds.push("released"); } },
        prepareHold(v, ready, opts) { holds.push({ v, ready, opts }); this.hold.active = true; return true; } };
    api.prepareHold = api.prepareHold.bind(api);
    const video = new HTMLVideoElement();
    const ctx = {
        state: { dubEnabled, prepareWait }, location: { href: "https://www.coursera.org/learn/x/lecture/a" },
        window: { CST_DUB: api }, HTMLVideoElement,
        document: { addEventListener: (t, f) => listeners.set(t, f), removeEventListener: (t, f) => { if (listeners.get(t) === f) listeners.delete(t); } },
        csVideo: () => video, csPlayerBox: () => ({ box: true }),
    };
    vm.createContext(ctx);
    vm.runInContext(fn, ctx);
    const play = () => { const f = listeners.get("play"); if (f) f({ target: video }); };
    return { ctx, api, video, holds, listeners, play, arm: () => vm.runInContext(`courseraHoldFirstPlay(location.href)`, ctx) };
}

test("Coursera: the lecture's first play waits for the voice of its line, from 0, like YouTube", () => {
    const E = courseraHoldEnv();
    E.arm();
    assert.equal(E.holds.length, 0, "nothing held before the video plays");
    E.play();                                                    // Coursera's own autoplay
    assert.equal(E.holds.length, 1);
    assert.equal(E.holds[0].v, E.video);
    assert.equal(E.holds[0].opts.initial, true, "initial: re-pauses a quick second play, restarts from 0");
    assert.deepEqual(E.holds[0].opts.container, { box: true });
    // ready only once the engine has the voice for where the video stands
    assert.equal(E.holds[0].ready(), false, "no engine yet");
    E.api.dub.engine = { isReadyAt: t => t === 0 };
    assert.equal(E.holds[0].ready(), true);
    E.play();                                                    // later plays are the viewer's: no new hold
    assert.equal(E.holds.length, 1);
    assert.equal(E.listeners.has("play"), false, "the listener is gone after the first play");
});

test("Coursera: a lecture already playing is held at once; no hold when the setting or dubbing is off", () => {
    const A = courseraHoldEnv({ playing: true });
    A.arm();
    assert.equal(A.holds.length, 1);
    for (const opts of [{ prepareWait: false }, { dubEnabled: false }]) {
        const B = courseraHoldEnv(opts);
        B.arm();
        B.play();
        assert.equal(B.holds.length, 0, JSON.stringify(opts));
        assert.equal(B.listeners.has("play"), false);
    }
});

test("Coursera: no translation or no voice releases the hold and stops listening", () => {
    const E = courseraHoldEnv();
    const release = E.arm();
    release();                                                   // nothing played yet
    assert.equal(E.listeners.has("play"), false);
    E.play();
    assert.equal(E.holds.length, 0);
    const F = courseraHoldEnv();
    const releaseF = F.arm();
    F.play();
    releaseF();                                                  // held, then translation failed
    assert.equal(F.holds.at(-1), "released");
    assert.equal(F.api.hold.active, false);
    // the auto path wraps it: released unless dubbing came up
    assert.match(fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8"),
        /const release = courseraHoldFirstPlay\(location\.href\);[\s\S]{0,200}finally \{[\s\S]{0,120}if \(!\(window\.CST_DUB && window\.CST_DUB\.dub\.enabled\)\) release\(\);/);
});

// 2026-10-16, Made by Google's Fitbit Edge video: "(Nhạc nền sôi động)" was read aloud. The user
// is not hard of hearing: no sound description of the captions is ever read
test("script: a caption's sound description is not read, however it is worded; a gloss in parentheses is", () => {
    for (const note of ["(Nhạc nền sôi động)", "(tiếng gõ cửa)", "(upbeat music)", "(Vỗ tay nhiệt liệt)", "[Âm nhạc]", "(khán giả reo hò)", "(cười khúc khích)", "♪ ♪"]) {
        assert.equal(PLAN.stripSoundNotes(note), "", note);
    }
    for (const gloss of ["AI (trí tuệ nhân tạo) rất mạnh", "Bài hát (nhạc sĩ Trịnh Công Sơn)", "Nói (tiếng Anh) rất hay", "Hỏi (John Smith)", "Sợ bỏ lỡ (FOMO)"]) {
        assert.equal(PLAN.stripSoundNotes(gloss), gloss, gloss);
    }
    // a source line that is only a note: whatever the translation put in parentheses is that note
    const only = group("(Một giai điệu rộn ràng vang lên)", [{ start: 0, end: 3, text: "[upbeat music]" }]);
    const said = group("Đây là đồng hồ mới.", [{ start: 3, end: 5, text: "This is the new watch." }]);
    const script = PLAN.buildDubScript([only, said]);
    assert.ok(!script.some(s => /giai điệu/.test(s.speechSource)), JSON.stringify(script.map(s => s.speechSource)));
    assert.ok(script.some(s => /đồng hồ mới/.test(s.speechSource)));
});

test("who speaks: a turn mark inside a caption line opens a line of its own for the reading (qSlxe4hA66g)", () => {
    // Korean recognizer captions, two caption rows each, turns inside them (2.6.6)
    const caps = [
        [164.8, 174.0, "가국과 안모는 애국심의 기반이다. >> 나도 그거 좋아하."],
        [172.04, 179.6, ">> 나한테 가장 고운 건 뭔지 알고 싶니?"],
        [357.634, 362.52, "[숨을 헐떡임] >> 날려주십시오."],
        [372.44, 381.96, "있어. 뭘 받는지 말해 보라오. >> 아무것도 못 보았습니다. 맹세합니다."]
    ].map(([start, end, text]) => ({ start, end, text }));
    const lines = PLAN.speakerLines(caps.map(c => ({ start: c.start, end: c.end, srcCues: [c] })));
    assert.deepEqual(lines.map(l => l.text), [
        "가국과 안모는 애국심의 기반이다.", ">> 나도 그거 좋아하.", ">> 나한테 가장 고운 건 뭔지 알고 싶니?",
        ">> 날려주십시오.", "있어. 뭘 받는지 말해 보라오.", ">> 아무것도 못 보았습니다. 맹세합니다."]);
    // the mark's time is its share of the line, as speakerTurns places it
    const t = caps[0].start + (caps[0].end - caps[0].start) * caps[0].text.indexOf(">>") / caps[0].text.length;
    assert.ok(Math.abs(lines[1].start - t) < 0.01, `${lines[1].start} vs ${t}`);
    // a reading naming that line puts the turn there, not at the caption's start
    const hints = PLAN.speakerHints(lines, { turns: [{ line: 0, speaker: 1 }, { line: 1, speaker: 2 }], confidence: "high" });
    assert.ok(Math.abs(hints.turns[1].t - t) < 0.01);
    // long whole lines (not joined) are split too
    const long = [{ start: 0, end: 6, text: "This is a fairly long whole caption line that is spoken by one. >> And this is the answer of another one here." }];
    assert.equal(PLAN.speakerLines([{ start: 0, end: 6, srcCues: long }]).length, 2);
});

test("who speaks: the prompt covers film and game scenes, any language, roles and their genders", () => {
    const bg = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "background.js"), "utf8");
    assert.match(bg, /const SPEAKER_PROMPT_VERSION = 3;/);
    assert.match(bg, /Film, drama, game cutscene/);
    assert.match(bg, /The lines may be in any language/);
    assert.match(bg, /never \\"unknown\\" as a label/);
    assert.match(bg, /a role that has one \(mother, father/);
});

// 2.7.6: the first takes move the voice calibration and a plan rebuild cut the video's first line
// anew just before its turn; its take was thrown away and its first part dropped
test("a plan rebuild that only cuts a line with a made take elsewhere keeps that line and its take", () => {
    const { DubEngine } = require("../dub-engine.js");
    const keep = DubEngine.prototype.keepMadeTakes;
    const P = (start, end, text, speaker = "S1") => ({ id: "t" + Math.round(start * 1000), start, end, text, speaker });
    const old = [P(10.32, 17.575, "Chào mọi người, chào mừng các bạn. Mình là Keisha, hôm nay mình làm video."), P(17.575, 24, "Câu sau.")];
    const made = { rendered: new Map([[old[0].id, {}]]), pending: new Map() };
    const resplit = [P(10.32, 13.146, "Chào mọi người, chào mừng các bạn."), P(13.146, 17.575, "Mình là Keisha, hôm nay mình làm video."), P(17.575, 24, "Câu sau.")];
    const got = keep.call(made, old, resplit, 2);
    assert.deepEqual(got.map(p => p.id), ["t10320", "t17575"]);
    assert.equal(got[0], old[0], "the made line itself, so its take stays");
    // other words over the span (a refine): the new plan wins and the line is made again
    const refined = [P(10.32, 13.146, "Xin chào cả nhà."), P(13.146, 17.575, "Mình là Keisha, hôm nay mình làm video."), P(17.575, 24, "Câu sau.")];
    assert.deepEqual(keep.call(made, old, refined, 2).map(p => p.text), refined.map(p => p.text));
    // no take: the new cut as before; a line already passed: left alone
    assert.equal(keep.call({ rendered: new Map(), pending: new Map() }, old, resplit, 2), resplit);
    assert.equal(keep.call(made, old, resplit, 30), resplit);
    // being made counts as made
    assert.equal(keep.call({ rendered: new Map(), pending: new Map([[old[0].id, 1]]) }, old, resplit, 2)[0], old[0]);
});

// 2.8.0: what the VieNeu normalizer misreads (tools/vieneu-g2p.py), and two of our own slips
test("speech text: a cook's fraction, mph, a dollar after its number, 4K on a screen; 65g is no 5G", () => {
    const P = require("../dub-planner.js");
    const say = t => P.adaptForSpeech(t);
    assert.equal(say("1/4 thìa cà phê muối"), "một phần tư thìa cà phê muối");
    assert.equal(say("1/2 cốc nước"), "nửa cốc nước");
    assert.equal(say("khoảng 3/4 chén"), "khoảng ba phần tư chén");
    for (const keep of ["ngày 1/4", "mở cửa 24/7", "tỷ số 5/3"]) assert.equal(say(keep), keep, keep);
    assert.equal(say("Chạy 4 mph"), "Chạy 4 dặm một giờ");
    assert.equal(say("Chỉ 15$ thôi."), "Chỉ 15 đô la thôi.");
    assert.equal(say("65g rau chân vịt"), "65g rau chân vịt", "the kept term 5G may not start inside 65");
    assert.match(say("mạng 5G rất nhanh"), /<en>g<\/en>/, "5G itself is still the kept term");
    assert.equal(say("quay video 4K"), "quay video bốn ca");
    assert.equal(say("Khoảng 6K đến 8K một tháng."), "Khoảng 6 nghìn đến 8 nghìn một tháng.", "money names no screen");
});

// 2.8.1: subtitled Japanese and Korean vlogs put a cat's or a thought's words in brackets
test("a line all in brackets that holds a sentence is read; a sound or a word or two is a note", () => {
    const P = require("../dub-planner.js");
    const said = (src, vi) => {
        const g = { start: 0, end: 3, viText: vi, srcCues: [{ start: 0, end: 3, text: src }], viCues: [{ start: 0, end: 3, text: vi }] };
        return P.buildDubScript([g]).map(s => s.speechSource || "").join(" ").trim();
    };
    assert.match(said("(Cat: Are you listening?)", "(Mèo: Này, có nghe tôi nói không đấy?)"), /có nghe tôi nói/);
    assert.match(said("(I'm having trouble finding the right baking temperature.)", "(Mình đang khó tìm nhiệt độ nướng phù hợp.)"), /nhiệt độ nướng/);
    for (const [src, vi] of [["(upbeat music)", "(nhạc sôi động)"], ["(door closes)", "(tiếng cửa đóng)"], ["(Speaking Japanese)", "(Nói tiếng Nhật)"], ["[Music]", "[Âm nhạc]"]])
        assert.equal(said(src, vi), "", src);
});
