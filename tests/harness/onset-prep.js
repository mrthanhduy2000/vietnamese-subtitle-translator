// Prepare repeatable local speech takes for onset.html. No paid network is reachable.
const fs = require('node:fs');
const path = require('node:path');
const { bgEnv } = require('../bg-env');
const out = path.join(__dirname, 'smooth');
const B = bgEnv((url, init) => {
    if (!String(url).startsWith('http://127.0.0.1:8000/')) throw new Error('Only local speech is allowed');
    return fetch(url, init);
}, { dubProvider: 'vieneu' }, { paidTts: false });
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const texts = ['Xin chào các bạn.', 'Chúng ta cùng bắt đầu nhé.', 'Hãy lắng nghe câu tiếp theo.', 'Nội dung vẫn được giữ đầy đủ.'];
    const takes = [];
    for (let i = 0; i < texts.length; i++) {
        const r = await B.send({ action: 'synthesizeSpeech', engine: 'vieneu', text: texts[i], voice: 'Mỹ Duyên', parts: [{ key: 'onset-' + i, weight: texts[i].split(/\s+/).length }] });
        if (!r.ok) throw new Error(r.error);
        const p = r.parts[0];
        const file = `onset-${i}.wav`;
        fs.writeFileSync(path.join(out, file), Buffer.from(p.wav, 'base64'));
        takes.push({ text: texts[i], duration: p.duration, file, timing: r.timing });
    }
    fs.writeFileSync(path.join(out, 'onset.json'), JSON.stringify(takes, null, 2));
    console.log(takes);
})().catch(e => { console.error(e); process.exitCode = 1; });
