# TTS text normalization (lane B, `dub-planner.js` `adaptForSpeech`)

Defect classes fixed, all in the text sent to the voice:

- Glued or spelled currency: `100.000đ` was "một trăm nghìnđ", `VND` was spelled. Now "đồng". Added `€ £ ¥ EUR GBP JPY CNY RMB`.
- An amount followed by a comma swallowed it: `$20, rồi` gave "20, đô la". The comma now stays after the currency word.
- Long decimals: `2.718281828` became "2.bảy trăm ..." (the 7+ digit rule), `0.001` became "một". Now a decimal, digit by digit.
- `1.234,56` and `1,234.56` keep the cents after "phẩy".
- A number starting with 0 (tax code, phone) is left for the server's digit-by-digit reading.
- Codes: OTP, PIN, CCCD, MST, SĐT, hotline, mã xác nhận are spoken digit by digit.
- `9am`, `9:30 PM`, `7 p.m.` read as "giờ sáng/chiều/tối". `m2 m3 ² ³ ^n`, `≥ ≤ ≠ ≈ ± √ π`, minus signs.
- `4K 60fps` is a resolution.

Not verified against the real VieNeu front end (no sea_g2p in the cloud session). Ranges (`10-20`), ratios (`3:1`) and dates were left alone on purpose: earlier sessions measured them. Run `tools/vieneu-g2p.py` on the Mac for the new rules. No version bump (release thread does it).

## Follow-up (Mac check of PR 26: 27/29)

- `60fps` / `120 FPS` is said "khung hình trên giây" (the server left "fps" bare).
- A spaced hyphen between a larger and a smaller number ("10 - 5") is "trừ"; the server read it as the range "mười đến năm". A rising pair ("10 - 15 phút") is left to the server.
