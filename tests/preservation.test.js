const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../vi-quality');
const corpus = require('./preservation-corpus');
for (const c of corpus) test(`preservation: ${c.kind} detects corruption and accepts an equivalent rendering`, () => {
    assert.equal(Q.assessPreservation(c.src, c.good).issues.length, 0, c.good);
    assert.ok(Q.assessPreservation(c.src, c.bad).issues.some(i => i.critical), c.bad);
});
const equivalent = [
    ['A drink costs $3 to $5.', 'Một đồ uống có giá từ 3 đến 5 đô la.'],
    ['A week costs $3 to $5,000.', 'Một tuần tốn từ 3.000 đến 5.000 đô la.'],
    ['The percentage is 5%.', 'Tỷ lệ là năm phần trăm.'],
    ['We use 100% of it.', 'Chúng tôi dùng toàn bộ.'],
    ['It is a two and 1/2 hour task and a 45-minute workout.', 'Đó là công việc hai tiếng rưỡi và buổi tập 45 phút.'],
    ['It takes .1 seconds.', 'Việc đó mất 0,1 giây.'],
    ['The bath lasts 20 seconds.', 'Hãy ngâm 20 giây.'],
    ['It costs $1,000.', 'Nó có giá $1,000.'],
    ['A trip is 2 km long.', 'Chuyến đi dài 2000 m.'],
    ['Call 46219 7839.', 'Gọi số 462-197-839.'],
    ['The water is 60 degrees.', 'Nước ở nhiệt độ 15 độ C.'],
    ['It is not more than 5.', 'Nó không vượt quá 5.'],
    ['It is higher than 5.', 'Nó không thấp hơn 5.'],
    ['Do not forget the password.', 'Hãy nhớ mật khẩu.'],
    ['It does not increase the load.', 'Nó giữ nguyên tải trọng.'],
    ['The United Nations issued a statement.', 'Liên Hợp Quốc đưa ra một tuyên bố.']
];
for (const [src, vi] of equivalent) test(`preservation abstains from unsupported inference: ${src}`, () => {
    assert.equal(Q.assessPreservation(src, vi).issues.length, 0);
});
test('refinement cannot trade a new factual error for fewer fluency warnings', () => {
    const src = 'The ticket costs $25.';
    const first = ['Vé có giá 25 đô la.'], again = ['Vé có giá 35 đô la.'];
    const q1 = [Q.assess(src, first[0])], q2 = [Q.assess(src, again[0])];
    q1[0].score = 20;
    assert.deepEqual(Q.pickRefined(first, again, q1, q2), first);
});
test('refinement repairs facts even if a stylistic warning remains', () => {
    const src = 'The ticket costs $25.', first = ['Vé có giá 35 đô la.'], again = ['Vé có giá 25 đô la.'];
    const q1 = [Q.assess(src, first[0])], q2 = [Q.assess(src, again[0])]; q2[0].score = 5;
    assert.deepEqual(Q.pickRefined(first, again, q1, q2), again);
});
test('an unparseable replacement cannot silently erase evidence of a factual mismatch', () => {
    const src = 'It weighs 5kg.', first = ['Nó nặng 6kg.'], again = ['Nó nặng vài cân.'];
    assert.deepEqual(Q.pickRefined(first, again, [Q.assess(src, first[0])], [Q.assess(src, again[0])]), first);
});
test('refinement selection rejects changed cardinality and newly shifted windows', () => {
    const sources = ['The batch weighs 5kg.', 'The batch weighs 9kg.'];
    const first = ['Lô hàng nặng 5kg.', 'Lô hàng nặng 9kg.'];
    const swapped = [first[1], first[0]];
    const a = Q.assessWindow(sources, first), b = Q.assessWindow(sources, swapped);
    assert.ok(b.every(q => q.issues.some(i => i.type === 'misaligned')));
    assert.deepEqual(Q.pickRefined(first, swapped, a, b), first);
    assert.deepEqual(Q.pickRefined(first, [first[0]], a, [a[0]]), first);
});
test('aligned refinements are accepted atomically without mixing boundaries', () => {
    const sources = ['The batch weighs 5kg.', 'The batch weighs 9kg.'];
    const corrected = ['Lô hàng nặng 5kg.', 'Lô hàng nặng 9kg.'], first = [corrected[1], corrected[0]];
    assert.deepEqual(Q.pickRefined(first, corrected, Q.assessWindow(sources, first), Q.assessWindow(sources, corrected)), corrected);
});
test('semantic uncertainty is explicit and review requirements do not alone spend budget', () => {
    const src = 'If the pressure rises, stop because the valve may fail.';
    const q = Q.assess(src, 'Nếu áp suất tăng, hãy dừng vì van có thể hỏng.');
    assert.equal(q.preservation.semanticVerified, false);
    assert.ok(q.preservation.review.includes('conditional-relation'));
    assert.ok(q.preservation.review.includes('causal-relation'));
    assert.equal(q.needsRefine, false);
    assert.equal(q.dimensions.relations.status, 'unchecked');
});
test('an unrelated negative sentence cannot hide a later lost negation', () => {
    const r = Q.assessPreservation('We do not change the price. This does not increase pressure.', 'Chúng tôi không đổi giá. Điều này làm tăng áp suất.');
    assert.ok(r.issues.some(i => i.type === 'meaning-negation'));
});
test('unrelated comparison words do not invert the numerical clause', () => {
    assert.equal(Q.assessPreservation('The load is less than 5kg.', 'Cao hơn bạn nghĩ. Tải trọng nhỏ hơn 5kg.').issues.length, 0);
});
test('multiple occurrences of a predicate remain uncertain rather than asserting a negation error', () => {
    assert.equal(Q.assessPreservation('This increases demand but does not increase pressure.', 'Điều này tăng nhu cầu nhưng không làm tăng áp suất.').issues.length, 0);
});
test('the real refinement prompt asks for a conservation check without an additional model action', () => {
    const B = require('./bg-env').bgEnv(async () => { throw new Error('No network expected'); });
    const base = { sentences: ['The batch weighs 5kg.'], context: {} };
    assert.doesNotMatch(B.sandbox.buildUnitPrompt(base).user, /KIỂM TRA BẢO TOÀN/);
    const prompt = B.sandbox.buildUnitPrompt({ ...base, refine: { draft: ['Lô hàng nặng 6kg.'], issues: ['Sai dữ kiện'] } }).user;
    assert.match(prompt, /KIỂM TRA BẢO TOÀN/);
    assert.match(prompt, /phủ định, so sánh, điều kiện và nguyên nhân/);
    assert.match(prompt, /không tự đoán dữ kiện/);
});
test('mixed digit and word quantities cannot be paired by dimension count alone', () => {
    const src = 'At 2 minutes I still feel good, but at minute 3 it becomes hard.';
    const vi = 'Ở phút thứ hai tôi vẫn thấy ổn, nhưng đến 3 phút thì bắt đầu khó khăn.';
    assert.equal(Q.assessPreservation(src, vi).issues.length, 0);
});
test('new addition or repetition evidence cannot be traded for a lower fluency score', () => {
    const src = 'Please pay $25 for the ticket.', first = ['Trả 25 đô la cho vé.'];
    const again = ['Trả 25 đô la cho vé. Đây là phần giải thích bổ sung rất dài với những thông tin chưa được nhắc tới trong câu gốc và nhiều lời bình luận khác.'];
    const a = [Q.assess(src, first[0])], b = [Q.assess(src, again[0])]; a[0].score = 100;
    assert.ok(b[0].issues.some(i => i.type === 'addition'));
    assert.deepEqual(Q.pickRefined(first, again, a, b), first);
});
