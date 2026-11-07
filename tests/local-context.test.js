const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../context-engine');
const { bgEnv } = require('./bg-env');
const ml = 'The neural network model trains on a dataset with gradient loss and embedding layers.';
const biz = 'The company business model increases revenue and profit through investment, pricing and customer sales.';
const life = 'I run along the river after breakfast and remember my family at home.';
function session(units = [ml, ml + ' Again.', biz, life]) {
    const s = new C.ContextSession({ title: 'Neural network training with gradient loss' });
    s.setUnits(units); return s;
}
const learn = (s, i, en, vi, extra = {}) => s.record([i], { engine: 'gemini', translations: [`${vi}.`], terms: [{ en, vi }], ...extra });

test('local topics follow technology, finance and everyday sections despite the title', () => {
    const s = session();
    assert.deepEqual(s.localDomains.map(d => d.primary), ['ml', 'ml', 'business', 'general']);
    assert.equal(s.buildRequest([3]).context.register, 'talk');
    assert.equal(s.buildRequest([3]).context.senseHints.length, 0);
});
test('mixed windows attach sense hints to their own item and abstain on everyday run', () => {
    const c = session().buildRequest([1, 2, 3]).context;
    assert.ok(c.senseHints.some(h => /^1\. model:.*học máy/.test(h)));
    assert.ok(c.senseHints.some(h => /^2\. model:.*kinh doanh/.test(h)));
    assert.ok(!c.senseHints.some(h => /^3\./.test(h)));
    assert.equal(c.segmentDomains[2].primary, 'general');
});
test('local evidence is deterministic under request reordering and seeks', () => {
    const s = session(); const before = s.buildRequest([2]);
    s.buildRequest([0]); s.buildRequest([3]);
    assert.deepEqual(s.buildRequest([2]), before);
    assert.equal(C.localDomain('I run home.', ml).primary, 'general');
    assert.equal(C.localDomain('We use the model.', '').confidence, 'low');
});
test('competing fields and unsupported scripts abstain without a probability claim', () => {
    const d = C.localDomain('neural dataset gradient business revenue profit');
    assert.equal(d.primary, 'general'); assert.equal(d.confidence, 'low');
    assert.equal(C.localDomain('今日は家族と散歩しました。').primary, 'general');
    assert.equal(d.probability, undefined);
});
test('a term needs attested source and actual output before it can be a candidate', () => {
    const s = session();
    learn(s, 0, 'absent name', 'tên bịa');
    learn(s, 0, 'model', 'mô hình', { translations: ['bản dịch không chứa từ đó'] });
    assert.equal(s.terms.size, 0);
    learn(s, 0, 'model', 'mô hình');
    assert.deepEqual(s.buildRequest([1]).context.terms, []);
    assert.deepEqual(s.buildRequest([1]).context.termCandidates, [{ en: 'model', vi: 'mô hình' }]);
});
test('independent source units settle terminology only within the same sense scope', () => {
    const s = session(); learn(s, 0, 'model', 'mô hình'); learn(s, 1, 'model', 'mô hình');
    assert.deepEqual(s.buildRequest([0]).context.terms, [{ en: 'model', vi: 'mô hình' }]);
    assert.deepEqual(s.buildRequest([2]).context.terms, []);
    assert.deepEqual(s.buildRequest([0, 2]).context.terms, []);
    assert.equal(s.exportTerms()[0][3].scope, 'ml');
    const plural = session([ml.replace('model', 'models'), ml.replace('model', 'models') + ' Again.', biz.replace('model', 'models'), biz.replace('model', 'models') + ' Again.']);
    learn(plural, 0, 'models', 'mô hình'); learn(plural, 1, 'models', 'mô hình');
    learn(plural, 2, 'models', 'mô hình kinh doanh'); learn(plural, 3, 'models', 'mô hình kinh doanh');
    assert.equal(plural.buildRequest([0, 2]).context.terms.length, 0);
});
test('retries and duplicate source text cannot manufacture term confidence', () => {
    const s = session([ml, ml]);
    for (let n = 0; n < 8; n++) learn(s, n % 2, 'model', 'mô hình');
    assert.equal(s.exportTerms()[0][2], 1);
    assert.equal(s.buildRequest([0]).context.terms.length, 0);
});
test('conflicting term renderings remain advisory instead of replacing an agreed sense', () => {
    const s = session(); learn(s, 0, 'model', 'mô hình'); learn(s, 1, 'model', 'mẫu');
    assert.equal(s.buildRequest([0]).context.terms.length, 0);
    assert.equal(s.exportTerms()[0][3].conflict, true);
});
test('fallback text and malformed placeholders never enter learned terminology', () => {
    const s = session(); learn(s, 0, 'model', 'mô hình', { engine: 'google_fallback' });
    learn(s, 0, 'model', 'mô hình', { fallbackIndexes: [0] });
    learn(s, 0, 'model', '[[__T1__]]');
    assert.equal(s.terms.size, 0);
});
test('legacy unscoped ambiguous terms stay out of agreed hints without deleting storage', () => {
    const s = session(); const old = [['model', 'người mẫu', 20], ['forward pass', 'truyền xuôi', 4]];
    s.importTerms(old);
    assert.equal(s.buildRequest([0]).context.terms.length, 0);
    assert.equal(s.buildRequest([0]).context.termCandidates.length, 0);
    assert.equal(s.terms.size, 2); assert.deepEqual(old[0], ['model', 'người mẫu', 20]);
});
test('scoped exports roundtrip with bounded evidence and reject invented metadata', () => {
    const a = session(); learn(a, 0, 'model', 'mô hình'); learn(a, 1, 'model', 'mô hình');
    const b = session(); b.importTerms(a.exportTerms());
    assert.equal(b.buildRequest([0]).context.terms.length, 1);
    assert.equal(b.buildRequest([2]).context.terms.length, 0);
    const c = session(); c.importTerms([['model', 'mẫu', 99, { scope: 'ml', provenance: 'source-translation-pair', evidence: ['not here'] }]]);
    assert.equal(c.buildRequest([0]).context.terms.length, 0);
});
test('exact attested names persist across topics without learning arbitrary pronoun mappings', () => {
    const s = session([ml + ' Maria Lopez explains.', biz + ' Maria Lopez agrees.', life + ' Maria Lopez walks.']);
    learn(s, 0, 'Maria Lopez', 'Maria Lopez'); learn(s, 1, 'Maria Lopez', 'Maria Lopez');
    assert.deepEqual(s.buildRequest([2]).context.terms, [{ en: 'Maria Lopez', vi: 'Maria Lopez' }]);
    assert.equal(s.exportTerms()[0][3].scope, 'entity');
});
test('refining a unit replaces its pronoun counts, while topic changes keep a settled address', () => {
    const s = session(); s.record([0], { translations: ['Tôi đi. Tôi về. Tôi ăn. Tôi ngủ.'] });
    assert.equal(s.buildRequest([3]).context.selfRef, 'tôi');
    s.record([0], { translations: ['Mình đi.'] });
    assert.equal(s.self['tôi'], 0); assert.equal(s.self['mình'], 1);
    assert.equal(s.buildRequest([3]).context.selfRef, undefined);
});
test('actual worker prompt carries uncertainty and item scopes and separates mixed cache contexts', async () => {
    const env = bgEnv(async () => { throw new Error('offline'); }).sandbox;
    const req = session().buildRequest([0, 2, 3]); req.context.termCandidates = [{ en: 'model', vi: 'mẫu' }];
    const prompt = env.buildUnitPrompt(req).user;
    assert.match(prompt, /THUẬT NGỮ CHƯA CHẮC/); assert.match(prompt, /chỉ gợi ý, xét theo câu/);
    assert.match(prompt, /1: ml.*2: business.*3: general/);
    const k = await env.unitCacheKey(req, 'x');
    const other = structuredClone(req); other.context.segmentDomains[1].primary = 'ml';
    assert.notEqual(await env.unitCacheKey(other, 'x'), k);
});
test('built-in ambiguous glossary words remain readable while explicit user rules override them', () => {
    const code = fs.readFileSync(require.resolve('../content.js'), 'utf8');
    const a = code.indexOf('function protectGlossary('), b = code.indexOf('\nfunction ', a + 1);
    const state = { glossaryEnabled: true, glossaryNormalize: [], glossaryTranslateAs: new Map([['model', 'người mẫu']]), glossaryUserTerms: new Map(), reExact: null, reBrand: null, reLoose: /\bmodels?\b/gi, reRisky: null };
    const sb = { state, window: { CST_CONTEXT: C }, translateAsFor: s => s.toLowerCase().startsWith('model') ? 'người mẫu' : undefined, canonicalFor: () => undefined, buildContextualRegex: () => null, inflectedLookup: (m, s) => m.get(s) || m.get(s.replace(/s$/, '')) };
    vm.createContext(sb); vm.runInContext(code.slice(a, b), sb);
    assert.equal(sb.protectGlossary('The model predicts.').terms.length, 0);
    state.glossaryUserTerms.set('model', true);
    assert.deepEqual([...sb.protectGlossary('The models pose.').terms], ['người mẫu']);
});

test('refined output without a learned rendering removes its stale evidence', () => {
    const s = session(); learn(s, 0, 'model', 'mô hình'); learn(s, 1, 'model', 'mô hình');
    assert.equal(s.buildRequest([0]).context.terms.length, 1);
    s.record([1], { engine: 'gemini', translations: ['Bản dịch khác.'] });
    assert.equal(s.buildRequest([0]).context.terms.length, 0);
    assert.equal(s.exportTerms()[0][2], 1);
});
test('source risk and pronoun suggestions cannot seed learned terminology', () => {
    const s = session(); s.sourceQuality = { status: 'unusable' }; learn(s, 0, 'model', 'mô hình');
    assert.equal(s.terms.size, 0);
    s.sourceQuality = null; s.setUnits(['He explains the neural model and gradient loss dataset.']); learn(s, 0, 'He', 'ông ấy');
    assert.equal(s.terms.size, 0);
});
test('deferred glossary policy invalidates affected windows while leaving unrelated keys intact', async () => {
    const bg = bgEnv(async () => { throw new Error('offline'); }).sandbox;
    const a = { sentences: ['The model walks.'], context: { domain: 'general' } };
    const key = await bg.unitCacheKey(a, 'x');
    assert.equal(await bg.unitCacheKey({ ...a, deferredGlossary: [] }, 'x'), key);
    assert.notEqual(await bg.unitCacheKey({ ...a, deferredGlossary: ['model'] }, 'x'), key);
    assert.notEqual(await bg.unitCacheKey({ ...a, deferredGlossary: ['model'] }, 'x', true), await bg.unitCacheKey(a, 'x', true));
});
test('a stored count alone cannot promote a single source observation', () => {
    const s = session(); s.importTerms([['model', 'mô hình', 99, { scope: 'ml', provenance: 'source-translation-pair', evidence: [ml] }]]);
    assert.equal(s.buildRequest([0]).context.terms.length, 0);
});

test('term requests follow local topics with the existing three-window throttle despite old memory', () => {
    const s = session(); s.importTerms(Array.from({ length: 100 }, (_, i) => [`legacy term ${i}`, 'cũ', 5]));
    assert.equal(s.wantsTerms(s.buildRequest([0])), true);
    assert.equal(s.wantsTerms(s.buildRequest([2])), false);
    assert.equal(s.wantsTerms(s.buildRequest([3])), false);
    assert.equal(s.wantsTerms(s.buildRequest([2])), true);
    assert.equal(session().wantsTerms(session().buildRequest([3])), false);
});
