# Voice: no second `<en>` tag inside an English span (lane B, glossary thread)

- `dub-speech.js` `renderUncached`: text that already carries `<en>...</en>` spans (the planner's `adaptForSpeech` runs first) is rendered only outside those spans. Before, the glossary entry "R" wrapped a letter of an already spelled name: `CRH3` became `<en>c <en>r</en> h</en> 3`, which the front end read as Vietnamese ("sờ ờ hát ..."). Found with `tools/glossary-pron.js` run against the pip `sea-g2p` + `vieneu_utils` front end: 179 names (CRH380A, BRCA1, H&R Block, SRAM XX1, Sony SRS-XB100, Yonex VCORE, Threadripper PRO...), the "about 181 still read Vietnamese" of 2.9.5.
- Test: `tests/glossary-speech.test.js` (2.9.9 case).
- Vietnamese for version-history: "Lồng tiếng đọc đúng các tên có chữ R đánh vần (CRH3, BRCA1, H&R Block...), không đọc kiểu tiếng Việt nữa."
