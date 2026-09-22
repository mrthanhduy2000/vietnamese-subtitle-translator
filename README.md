# Vietnamese Subtitle Translator (Coursera + YouTube)

<div align="center">
  <img src="icons/icon.png" alt="Extension Icon" width="100"/>
</div>

Đây là một tiện ích mở rộng Chrome giúp dịch phụ đề video YouTube và bài giảng Coursera sang tiếng Việt bằng Gemini AI (dự phòng Google Translate), kèm lồng tiếng Việt.

## ✨ Tính năng

- 🌐 Hỗ trợ dịch sang tiếng Việt
- 🎯 Hỗ trợ hai nền tảng:
  - YouTube
  - Coursera.org
- ⚡ Dịch phụ đề theo thời gian thực
- 🔄 Tự động phát hiện và xử lý phụ đề
- 💾 Cache bản dịch để tăng tốc độ hiển thị
- 🎨 Giao diện người dùng thân thiện:
  - Icon dịch tích hợp trong player video
  - Dễ dàng bật/tắt chức năng dịch
  - Hiển thị phụ đề mượt mà

## 🚀 Cài đặt

1. Tải xuống source code:
   ```bash
   git clone https://github.com/bombap/coursera-translator.git
   ```

2. Mở Chrome Extensions:
   - Truy cập `chrome://extensions/`
   - Bật "Developer mode" ở góc phải trên

3. Cài đặt Extension:
   - Click "Load unpacked"
   - Chọn thư mục chứa source code đã tải

## 📖 Hướng dẫn sử dụng

1. Mở video YouTube hoặc bài giảng Coursera
2. Tìm icon 🌐 ở góc phải trên của video player
3. Click vào icon để bật/tắt chức năng dịch
4. Phụ đề sẽ được dịch tự động sang tiếng Việt

## 🛠️ Công nghệ sử dụng

- Chrome Extension Manifest V3
- HTML/CSS
- JavaScript
- Google Translate API

## 📸 Ảnh minh họa

### Giao diện Extension trên Coursera
![Extension Interface](images/extension.png)

### Phụ đề đã dịch (khung xem trước trong Cài đặt)
![Translated Subtitles](images/example-image.png)

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy thoải mái:
- 🐛 Báo cáo lỗi
- 💡 Đề xuất tính năng mới
- 🔧 Tạo Pull Request

## 📝 Giấy phép

Dự án này được phân phối dưới giấy phép MIT. Xem `LICENSE` để biết thêm thông tin.

## 💖 Ủng hộ dự án

Nếu bạn thấy dự án hữu ích, hãy:
- ⭐ Star dự án trên GitHub
- 📢 Chia sẻ với bạn bè xem YouTube hoặc học trên Coursera

## 🧩 Phân đoạn & ngắt dòng tiếng Việt (v1.1.0)

Sau khi dịch, phụ đề tiếng Việt được cắt theo cú pháp tiếng Việt thay vì theo số ký tự hay số dòng tiếng Anh.

- `vi-segmenter.js`: bộ phân đoạn thuần (không phụ thuộc DOM), gồm hai bài toán tách riêng:
  - **Phân đoạn cue** (`segmentGroup`): quy hoạch động trên toàn câu, tự quyết định số cue, điểm cắt và thời gian (bám khoảng lặng và thời gian từng từ của phụ đề nguồn).
  - **Ngắt dòng** (`breakLines`): chia một cue thành 1 đến 2 dòng, ưu tiên ranh giới mệnh đề và cụm từ hơn độ cân bằng tuyệt đối.
  - Hai bài toán dùng chung bộ chấm điểm "khe" giữa các âm tiết: dấu câu, liên từ mở mệnh đề, từ ghép, thuật ngữ, cụm số và đơn vị, tên riêng, hư từ treo cuối dòng, tiểu từ cuối câu.
  - Gemini có thể chèn dấu gợi ý `¦` ở chỗ ngắt nghỉ tự nhiên; dấu này chỉ là tín hiệu phụ và luôn bị xóa trước khi hiển thị.
- `subtitle-style.js`: danh mục phông (phông web có dấu tiếng Việt được tải khi chọn), viền chữ theo đơn vị em, dùng chung cho trang cài đặt, Coursera và YouTube.

Chạy kiểm thử (chỉ cần Node 18 trở lên, không cần cài gói):

```bash
npm test
```

So sánh thuật toán cũ và mới trên bộ ca thực tế:

```bash
npm run compare
```

## 🧠 Engine dịch hiểu ngữ cảnh (v1.1.1)

Luồng xử lý: nguồn và ngữ cảnh → hiểu ngữ cảnh → thuật ngữ → dịch → kiểm tra "dịch máy" và dịch lại → phân đoạn → ngắt dòng → kiểm tra toàn vẹn.

- `context-engine.js`: nhận diện lĩnh vực (AI, lập trình, dữ liệu, toán, kinh doanh, marketing, khoa học), giữ trạng thái ngữ cảnh của cả video (tóm tắt phần trước, bản dịch câu trước, thuật ngữ đã thống nhất lưu theo khóa học/kênh), dựng gói ngữ cảnh gọn theo cửa sổ trượt có ngân sách ký tự.
- `vi-quality.js`: phát hiện dấu hiệu dịch từng chữ (sao chép cấu trúc tiếng Anh, sai nghĩa theo lĩnh vực, "Nó" mở câu, lặp từ, thuật ngữ lệch, bỏ sót ý, sót tiếng Anh). Phát hiện thì tự dịch lại kèm danh sách vấn đề; chỉ nhận bản mới nếu tốt hơn.
- Mảnh câu nằm ở nhiều nhóm phụ đề được dịch chung một lần rồi trả về đúng mốc thời gian.
- Trang cài đặt tự lưu và áp dụng ngay mọi thay đổi.

## 🎙️ Lồng tiếng Việt AI (v1.1.2)

Không đọc từng phụ đề. Luồng xử lý: bản dịch có ngữ cảnh → kịch bản nói liên tục → kế hoạch ngữ điệu và thời lượng → giọng nói → căn thời gian → đồng bộ với video.

- `dub-planner.js`: dựng đoạn nói liên tục theo khoảng lặng thật của lời gốc (cue phụ đề chỉ là mốc thời gian), chuyển văn bản sang dạng dễ đọc (số, đơn vị, ký hiệu), nhận diện ý định câu (hỏi, nhấn mạnh, cảnh báo, kết luận, hào hứng, hài hước, giải thích), lập cụm ngắt nghỉ, tái tạo nhịp "Now... / Bây giờ...", khớp thời lượng theo tốc độ nói thật (âm tiết/giây). Mô hình thời lượng hiệu chỉnh từ 120 mẫu giọng Việt thật, sai số 3,3%.
- `dub-audio.js`: đọc/ghi WAV, chuẩn hóa âm lượng có trần đỉnh, làm mờ hai đầu chống click, tìm khoảng lặng và cắt audio nhiều câu.
- `dub-engine.js`: lớp provider thay được (Gemini TTS, giọng hệ thống), tạo trước audio quanh vị trí đang phát, đồng bộ với video (tạm dừng, tua, đang tải, tốc độ phát, sửa lệch êm bằng nhích tốc độ), hạ nhỏ tiếng gốc mượt, tự chuyển sang giọng hệ thống khi Gemini lỗi.
- Gemini TTS gộp nhiều đoạn một lượt; đoạn quá dài có thể được rút gọn nhẹ (giữ nguyên số liệu, thuật ngữ).

Kiểm tra trên trình duyệt thật: mở `tests/harness/dub.html` qua máy chủ tĩnh cục bộ.

## 💰 Tối ưu chi phí (v1.1.3)

Thứ tự: xử lý cục bộ → bộ nhớ đệm → model rẻ → model mạnh (chỉ khi cần) → TTS (chỉ khi cần, đúng một lần).

- `cst-cache.js`: bộ nhớ đệm 2 tầng (RAM, IndexedDB) cho bản dịch và audio, sống qua khởi động lại; khóa SHA-256 theo phiên bản prompt/kiểu đọc, model, giọng, văn bản chuẩn hóa, ngữ cảnh; giới hạn dung lượng (bản dịch 30 MB, audio 200 MB), xóa mục ít dùng nhất.
- `cost-policy.js`: 4 chế độ sử dụng (Cao cấp, Cân bằng, Tiết kiệm, Chỉ phụ đề) và bộ định tuyến độ khó tất định (không gọi AI để quyết định có gọi AI).
- Model: xem mục "Danh mục model" (v1.1.5).
- Đầu ra dịch tối giản `{"t": [...]}`; thuật ngữ chỉ xin khi có thuật ngữ mới; ngắt dòng/ngắt nghỉ làm cục bộ.
- YouTube chỉ dịch trước quanh vị trí đang xem; TTS tạo trước thích ứng, hủy khi tua, rút gọn câu chỉ khi vượt khung đáng kể và trước khi tạo audio.

## 🛡️ Độ tin cậy khi gọi API (v1.1.4)

- API Key gửi qua header `x-goog-api-key`, không còn nằm trong URL.
- Lỗi được phân loại theo tài liệu lỗi Gemini API: 400/401/402/403/404 không thử lại; 429 tạm ngưng đúng model bị giới hạn theo thời gian máy chủ báo; 500/503/504 và lỗi mạng thử lại tối đa 2 lần (TTS: 1 lần), chờ tăng dần. Khóa sai thì ngừng gọi tới khi đổi khóa; model không tồn tại thì lùi về model rẻ mặc định.
- TTS: service worker cắt audio theo từng đoạn và lưu kho **trước khi trả lời**; yêu cầu giống hệt nhau chỉ tạo audio một lần; quá thời gian chờ thì không tự gửi lại.
- Khi tua: lượt TTS mới gửi thì hủy, lượt đã chạy gần xong thì để chạy nốt vào kho; tối đa 2 lượt cùng lúc.
- IndexedDB lỗi hoặc treo: coi như không có trong kho và gọi API tiếp (tra kho tối đa 1,5 giây, ghi tối đa 3 giây, không chặn phụ đề).
- Model Flash thế hệ 3 (không phải Flash-Lite) được đặt mức suy nghĩ thấp, vì token suy nghĩ tính tiền như token đầu ra.

## 🗂️ Danh mục model (v1.1.5, sửa ở v1.1.6)

Mọi tên model nằm ở MỘT nơi: `cost-policy.js` (trang Cài đặt, service worker, lồng tiếng, chuyển đổi cài đặt cũ và kiểm thử đều đọc từ đây). Đối chiếu với tài liệu Gemini API ngày 16 đến 17/09/2026 và diễn đàn nhà phát triển Google.

| Model | Vai trò | Ghi chú |
|---|---|---|
| Tự động (mặc định) | Model chính | Model Flash-Lite rẻ nhất mà API key gọi được thật: 2.5 nếu key có quyền, không thì 3.1 |
| `gemini-2.5-flash-lite` | Tùy chọn | Rẻ nhất, nhưng Google KHÔNG cấp cho API key / dự án mới (404 "no longer available to new users") |
| `gemini-3.1-flash-lite` | Tùy chọn | Mọi key dùng được; Google ngừng hỗ trợ 07/05/2027, thay bằng 3.5 Flash-Lite (tự chuyển khi tới ngày) |
| `gemini-3.5-flash-lite` | Model nâng cấp (câu khó, chế độ Cao cấp) | |
| `gemini-3.8-flash` | Tùy chọn | Đắt nhất, gửi kèm mức suy nghĩ thấp |
| `gemini-2.5-flash-preview-tts` | Giọng đọc AI | Key không có quyền thì dùng `gemini-3.1-flash-tts-preview` |

- Luồng: Cài đặt → `chrome.storage.sync` → định tuyến (`modelChain`) → service worker → `models/<model>:generateContent`.
- Quyền truy cập model tính THEO TỪNG API KEY, nguồn sự thật là kết quả gọi generateContent thật (không dựa vào models.list). Model báo 404 cho key mới được ghi nhớ 3 ngày theo mã băm của key (không lưu key), nên không thử lại cho từng phụ đề, kể cả sau khi tải lại tiện ích.
- Model không gọi được thì dùng ngay model Gemini kế tiếp trong cùng yêu cầu; chỉ khi không còn model Gemini nào gọi được mới dùng Google Translate. Chế độ Tiết kiệm không dùng model đắt hơn lựa chọn của bạn / model rẻ nhất key gọi được.
- Bộ nhớ đệm bản dịch tách theo model: bản của 2.5, 3.1, 3.5 không bao giờ dùng lẫn.
- Kiểm tra đầu cuối trên trình duyệt: mở `tests/harness/e2e-model.html` qua máy chủ tĩnh cục bộ, gọi `runE2E()`.

## 🛠️ v1.1.6: hoàn thiện

- **Sửa lỗi 404 của 2.5 Flash-Lite với API key mới**: mặc định chuyển sang "Tự động"; lỗi được nhận diện riêng (không phải model đã tắt, không phải lỗi chung); Cài đặt ghi rõ "Chỉ dành cho API key có quyền truy cập" / "Không khả dụng với API key hiện tại"; nút Kiểm tra Key chạy qua service worker và cho biết model nào trả lời.
- **Sửa lỗi `ERR_BLOCKED_BY_CLIENT` khi mở Cài đặt từ YouTube**: nút không còn tự mở `chrome-extension://.../options.html` từ trang web (Chrome chặn), mà gửi `openOptions` cho service worker gọi `chrome.runtime.openOptionsPage()` (lỗi thì mở tab `options.html`). Bỏ khai báo trùng `options_page`.
- **Tự động dịch sang tiếng Việt** (Cài đặt, mặc định bật): `lang-detect.js` nhận diện ngôn ngữ ngay trên máy (mã track, track tự động, mẫu nội dung). Tiếng Việt hoặc không chắc chắn thì không tự dịch; nội dung đã là tiếng Việt không bao giờ gửi Gemini.
- **Lồng tiếng không bị cắt**: dòng thời gian lời nói tách khỏi phụ đề (speech.start / speech.end theo thời lượng audio thật). Câu dài được nói trọn, câu sau xếp hàng chờ rồi nói nhanh hơn một chút để bắt kịp; trễ quá 3,5 giây thì bỏ nguyên câu, không cắt giữa chừng. Kết quả TTS về muộn cho lời thoại đã đổi không được phát.
- **Ngân sách & thống kê chi phí** (chỉ lưu trên máy): ngân sách ngày / video; chạm ngân sách thì chuyển sang giọng hệ thống và không nâng cấp lên model mạnh; vượt gấp đôi ngân sách ngày thì ngừng gọi Gemini dịch. Thống kê: USD ước tính, số lượt, phút audio, lượt trúng bộ nhớ đệm, lượt gọi tránh được, video tạo audio bất thường.
- Video dài hơn 30 phút tạo audio trước ít hơn; TTS quá thời gian chờ không gửi lại cho cùng đoạn.
- Coursera: không dùng Flex / Batch (Flex chỉ có qua Interactions API, 1 đến 15 phút, không bảo đảm; Batch tới 24 giờ).

## 🔁 v1.1.7: phát hiện tiện ích chưa được nạp lại

Với tiện ích cài từ thư mục (unpacked), Chrome chỉ nạp lại service worker, manifest và content script khi bấm **Tải lại** trong `chrome://extensions`; trang Cài đặt và popup thì đọc thẳng file trên đĩa. Nếu quên nạp lại, tab YouTube vẫn chạy mã cũ (ví dụ nút Cài đặt cũ bị Chrome chặn: `ERR_BLOCKED_BY_CLIENT`).

- `version-check.js`: trang Cài đặt và popup so phiên bản Chrome đang chạy (`chrome.runtime.getManifest()`) với phiên bản của file; lệch thì hiện cảnh báo và nút **Nạp lại tiện ích ngay** (`chrome.runtime.reload()`).
- Nút Cài đặt trên YouTube báo lỗi rõ ràng trên màn hình (không chỉ trong console) khi trang đang dùng kết nối cũ.

Sau mỗi lần cập nhật file: vào `chrome://extensions`, bấm Tải lại ở thẻ tiện ích, rồi tải lại (F5) các tab YouTube / Coursera đang mở.

## 🎨 v1.1.8: kiểu phụ đề mặc định, vị trí ổn định, bỏ DeepLearning.AI

- Mặc định mới: cỡ chữ 90%, độ đậm 400, viền quầng mờ, khoảng cách lề 1%. Cài đặt cũ còn đúng giá trị mặc định trước đây được chuyển một lần; mục đã tự chỉnh giữ nguyên.
- Sửa lỗi phụ đề YouTube "nhảy lên cao": trước đây mỗi lần thanh điều khiển hiện ra, phụ đề bị cộng cứng 64 px. Giờ lề đã chọn được giữ nguyên, chỉ nâng khi thanh điều khiển thật sự che phụ đề (đo chiều cao thật), trượt mượt, thanh ẩn thì trở lại đúng lề.
- Sửa lỗi phụ đề YouTube bị kẹt ở vị trí cao sau khi tắt/bật dịch hoặc chuyển video: bộ theo dõi thanh điều khiển và kích thước trình phát trước đây vẫn cập nhật lớp phụ đề cũ đã bị xóa.
- Bỏ hỗ trợ DeepLearning.AI (manifest, quyền truy cập, mã nhận diện trang, giao diện, tài liệu).
- Ảnh/biểu tượng của tiện ích chỉ cho YouTube và Coursera đọc (trước đây mọi trang web đều đọc được).

## ✨ v1.1.9: vị trí Coursera, giữ sát lề, chi phí trong popup, lồng tiếng nhanh hơn, giao diện Cài đặt mới

- **Coursera áp dụng vị trí + lề**: từng cue được đặt theo % khung video (một dòng) hoặc xếp hàng đúng thứ tự (song ngữ); đổi trong Cài đặt thì áp dụng ngay.
- **"Luôn giữ sát lề đã chọn" (YouTube)**: phụ đề không bao giờ dịch lên khi thanh điều khiển hiện; vẽ trên thanh, không chặn chuột.
- **Popup hiện chi phí ước tính hôm nay** (USD, phút giọng AI, lượt gọi tránh được, thanh % ngân sách); bấm để mở Cài đặt.
- **Lồng tiếng AI nhanh hơn, không tốn thêm** (tiền TTS tính theo độ dài audio, không theo số lượt):
  - lượt đầu sau khi bật / tua chỉ một câu ngắn (tối đa 40 âm tiết) để có tiếng sớm nhất;
  - audio sẵn phía trước sắp cạn thì chạy 2 lượt song song để bắt kịp (tối đa 3 lượt kể cả lượt cũ chạy nốt);
  - API báo vượt giới hạn tốc độ (429, hay gặp với key miễn phí) thì tự chuyển sang dè dặt: 1 lượt mỗi lúc, không chia lượt nhỏ;
  - chỉ yêu cầu ngừng lâu khi khoảng ngừng >= 0,6 giây (khoảng lặng cũng được tạo và tính tiền);
  - giọng hệ thống chỉ bỏ phần còn lại của câu khi trễ quá 4 giây (trước là 2,5 giây), bớt mất lời.
- **Trang Cài đặt kiểu Claude**: nền ngà, tiêu đề chữ có chân (Source Serif 4), màu nhấn cam đất, viền mảnh, danh mục bên trái phẳng, ô thông báo theo màu chủ đề; tự đổi sang giao diện tối theo máy.

## 🗣️ v1.2.0 (trước ghi nhầm 1.1.10): giọng Việt chạy trên máy (VieNeu-TTS)

Nguồn giọng mới, **miễn phí**, dùng [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) v3 Turbo (Apache 2.0) chạy ngay trên máy.

- Cài một lần (đã cài sẵn ở `~/VieNeu-TTS`): `brew install uv`, `git clone https://github.com/pnnbao97/VieNeu-TTS.git ~/VieNeu-TTS`, `cd ~/VieNeu-TTS && uv sync`.
- Bật máy chủ: nhấp đúp `~/VieNeu-TTS/cst-start.command` (chỉ mở trên `127.0.0.1:8000`, máy khác trong mạng không gọi được).
- Đo trên MacBook Air M3 (CPU): tạo 5 giây lời nói trong khoảng 1,1 giây; 3 đoạn bài giảng có audio sau 2,1 giây.
- 25 giọng theo vùng (mặc định Thùy Dung, nữ Nam Bộ; người nói thứ hai Minh Triết, nam Nam Bộ), chọn trong Cài đặt > Lồng tiếng.
- "Tự động": VieNeu nếu máy chủ đang chạy, rồi Gemini AI, rồi giọng hệ thống. Chế độ Tiết kiệm cũng dùng VieNeu. VieNeu lỗi giữa chừng thì chuyển sang giọng hệ thống (không tự sang Gemini để tránh tốn tiền).
- Audio VieNeu vào cùng kho audio (khóa riêng theo giọng), cùng cơ chế chống tạo trùng; thống kê hiện số phút VieNeu (0 USD).
- Kiểm tra thật với máy chủ đang chạy: `node tests/vieneu.live.js`.

## 🟢 v1.4.2: VieNeu luôn sẵn sàng; giao diện Sáng / Tối

**Máy chủ giọng VieNeu tự chạy** (cài MỘT LẦN): nhấp đúp `tools/vieneu-autostart.command`. Tệp này tạo một dịch vụ macOS (`com.damduy.vieneu`) chạy khi đăng nhập, tự bật lại nếu bị tắt, ghi nhật ký vào `~/VieNeu-TTS/server.log`. Gỡ: `zsh tools/vieneu-autostart.command --uninstall`.

**Tiện ích tự phục hồi**: nếu lúc bật lồng tiếng mà máy chủ chưa lên, tiện ích đọc tạm bằng giọng khác rồi cứ 8 giây hỏi lại (tối đa 5 phút, chỉ khi tab đang hiện); máy chủ sẵn sàng là **tự chuyển về giọng VieNeu giữa chừng**, không bắt bấm gì. Trang Cài đặt cũng tự cập nhật trạng thái mỗi 5 giây.

**Giao diện Sáng / Tối / Theo máy**: chọn ở đầu trang Cài đặt, dùng chung cho cả bảng điều khiển. Trước đây hai trang chỉ chạy theo cài đặt sáng/tối của macOS nên không tự chọn được.

**Khác**:
- Khung xem thử phụ đề hiện luôn nhãn "Lồng tiếng: <giọng>" đúng như trên video thật, tên video mẫu đổi thành tên trung tính.
- Phím tắt mở bảng điều khiển: **Alt+Shift+V**.
- Sửa lỗi: nút "Cài đặt" ở bảng điều khiển tàng hình khi dùng giao diện sáng (chữ trắng trên nền trắng).
- Sửa lỗi do bài kiểm tra mới phát hiện: đoạn dọn bộ đọc cũ (thêm ở 1.3.9) xóa luôn bộ theo dõi VieNeu, nên giọng không bao giờ tự chuyển về.

## 🎛️ v1.4.1: Thực đơn trên video viết lại; bảng điều khiển biết trang đang làm gì

**Thực đơn trên trình phát YouTube** (bấm nút tím ở thanh điều khiển):

| Vấn đề cũ | Nay |
|---|---|
| Nhãn "BẬT" trông như nút bấm nhưng chỉ là chữ trạng thái, lại dùng hai màu khác nhau cho cùng một ý | Mỗi dòng là **công tắc thật** (role=switch), Tab tới được, Enter/Space bấm được, một màu thống nhất |
| Không biết đang dịch tới đâu | Dòng phụ đề ghi "Đã dịch 12/40 đoạn"; dòng lồng tiếng ghi "Đang đọc bằng giọng Mỹ Duyên" |
| Trạng thái đứng im khi tiện ích tự đổi sau lưng | Tự cập nhật mỗi 0,7 giây trong lúc thực đơn mở |
| Đổi giọng phải mở trang Cài đặt | **Chọn giọng ngay trong thực đơn** (theo miền Nam / Bắc / Trung), đổi xong tiện ích tự tạo lại giọng |
| Bấm một dòng là thực đơn đóng, muốn làm tiếp phải mở lại | Thực đơn ở lại, trạng thái đổi ngay tại chỗ |
| Không thấy phím tắt | Mỗi công tắc kèm phím tắt (Alt+S, Alt+D) |
| Tab lọt ra sau lưng trình phát | Tab chạy vòng trong thực đơn; Esc đóng và trả tiêu điểm về nút |
| Cảnh báo (chạm ngân sách, phải đổi giọng, Gemini lỗi) nằm rải rác | Một dòng cảnh báo duy nhất, chỉ hiện khi có chuyện |

**Bảng điều khiển**: thêm dòng trạng thái thật của trang đang xem ("Đã dịch 12/40 đoạn · đang đọc bằng giọng Mỹ Duyên"), nút chính đổi thành "Dịch lại bài giảng" khi phụ đề đang bật.

Kiểm tra: tests/ui.test.js dựng thực đơn bằng DOM thật rồi kiểm tra công tắc, ô chọn giọng, tự cập nhật và phím Esc.

## ⌨️ v1.4.0: Phím tắt, thông báo không chặn trang, dùng được bằng bàn phím

Theo hướng dẫn giao diện tiện ích của Chrome (dùng được hoàn toàn bằng bàn phím, thấy rõ phần tử đang chọn, có phím tắt cho việc hay dùng và nói cho người dùng biết) và cách làm chung của các tiện ích dịch phụ đề 2026.

| Nâng cấp | Trước | Nay |
|---|---|---|
| Phím tắt | không có | **Alt+S** bật/tắt phụ đề, **Alt+D** bật/tắt lồng tiếng (đổi ở chrome://extensions/shortcuts). Không thêm quyền nào |
| Báo lỗi / hướng dẫn | `alert()` chặn cả trang, video vẫn chạy nên mất lời | Thẻ nhỏ trên trình phát, tự ẩn, có nút thao tác ("Mở Cài đặt", "Thử lại", "Tải lại trang"), đọc được bằng trình đọc màn hình (role=status) |
| Hỏi trước khi lồng tiếng | `confirm("Cần dịch phụ đề trước…")` | Dịch luôn và báo "Đang dịch phụ đề để lồng tiếng…" (bấm lồng tiếng nghĩa là đồng ý dịch) |
| Máy chủ VieNeu chưa chạy | chỉ ghi ra console, người xem không hiểu vì sao đổi giọng | Báo một lần mỗi trang kèm nút **Thử lại** |
| Bàn phím | không thấy phần tử đang chọn | Viền tiêu điểm ở bảng điều khiển và trang Cài đặt; thực đơn trên video đóng bằng **Esc**, các dòng vào được bằng Tab, bấm bằng Enter/Space |
| Trình đọc màn hình | nút chỉ có nhãn | Nút báo `aria-pressed` (đang bật/tắt) và `aria-expanded` (thực đơn đang mở); tiêu đề nút nói rõ đang bật gì |
| Chuyển động | luôn chạy hiệu ứng | Tôn trọng cài đặt "giảm chuyển động" của hệ điều hành |

Bài kiểm tra mới: tests/ui.test.js (6 bài).

## 🔇 v1.3.9: Đổi giọng đọc không còn chồng hai giọng

Đổi giọng trong Cài đặt làm giọng cũ và giọng mới đọc chồng lên nhau. Trang Cài đặt tự lưu TẤT CẢ mục mỗi lần đổi một thứ, nên cả dubbing.js (đổi giọng) lẫn youtube.js (khóa dubEnabled bị báo "đổi" dù giá trị y nguyên) cùng bật lại lồng tiếng. Việc bật có nhiều bước chờ (đọc cài đặt, hỏi máy chủ VieNeu, hỏi model) nên hai lượt chạy song song và tạo ra HAI bộ đọc cùng phát.

Sửa: mỗi lượt bật mang một số thứ tự, chỉ lượt mới nhất được tạo và chạy bộ đọc (các lượt cũ tự hủy sau mỗi bước chờ); youtube.js chỉ xử lý dubEnabled khi giá trị đổi thật. Có bài kiểm tra bật hai lượt cùng lúc, bắt đúng lỗi này trên mã cũ.

## ✂️ v1.3.8: Không đọc "(Vỗ tay)", "(Cười)"; giao diện tối giản

- **Chú thích âm thanh** trong phụ đề ("(Vỗ tay)", "(Cười)", "(Tiếng cười)", "[Nhạc]", "(Laughter)", "♪"): vẫn hiện trên màn hình nhưng **không đọc thành lời**; khung chỉ có chú thích thành khoảng lặng. Ngoặc giải thích ("AI (trí tuệ nhân tạo)") vẫn đọc.
- **Bảng điều khiển**: chỉ còn Song ngữ (kèm 2 tùy chọn con), Lồng tiếng Việt, nút Dịch, và liên kết "Tạo lại giọng đọc cho video này" (chỉ hiện trên YouTube). Bỏ: đoạn giới thiệu, Dịch AI và Dịch từng dòng (chuyển vào Cài đặt), nút Cài đặt thứ hai, Mẹo sử dụng, chân trang. Sửa thanh trống (ô chi phí ẩn nhưng vẫn hiện).
- **Cài đặt**: chỉ hiện ô chọn giọng của nguồn giọng đang dùng; mục Gemini (key, model, ngân sách) chỉ hiện khi bật dịch Gemini hoặc dùng giọng Gemini; model mạnh chỉ ở chế độ Cao cấp; rút gọn các đoạn giải thích.
- **Trên video**: nhãn "Lồng tiếng: Mỹ Duyên" chỉ hiện 3 giây lúc bật rồi mờ đi (cảnh báo chạm ngân sách / đổi giọng thì giữ). Thực đơn của nút trên thanh điều khiển: bỏ khối "Động cơ dịch" (chỉ hiện khi Gemini lỗi), bỏ ô "Ngắt câu thông minh, vĩnh viễn bật" (không bấm được), bỏ biểu tượng cảm xúc.

## 🧊 v1.3.6 / v1.3.7: Hết treo tab YouTube khi Tải lại tiện ích; câu đầu không mất chữ

Đo thật 22/09/2026: bấm Tải lại tiện ích khi đang mở video YouTube làm tab treo cứng (330% CPU, không phản hồi). Nguyên nhân: mã cũ còn chạy trong tab thêm tới 1,5 giây, mã mới được nạp vào cùng tab; mỗi bên **xóa** nút của bên kia rồi tự tạo lại nút của mình khi thấy bị xóa, vòng lặp chạy dạng vi tác vụ nên trang không bao giờ được nghỉ, bộ tự tắt của mã cũ cũng không kịp chạy. Từ 1.3.6, phần tử của thế hệ mã cũ hơn chỉ bị **ẩn**, không bị xóa (YouTube và Coursera); mã cũ khi tự tắt ngắt bộ theo dõi trước khi gỡ nút. Có bài kiểm tra giả lập hai thế hệ mã trong một tab (tests/reload-fight.test.js), kể cả mã cũ chưa vá.

**1.3.7:** video mới mở, YouTube thường tự phát 0,2 đến 0,4 giây trước khi bị giữ dừng để chuẩn bị (đo thật) -> câu đầu mất vài chữ, giọng Việt vào trễ tương ứng. Nay khi hết chờ mà video còn ở dưới 1,5 giây thì quay về 0 rồi mới phát (mở bằng liên kết có mốc thời gian hay tua thì giữ nguyên vị trí).

Bản 1.3.5 cũng thêm ghi chép chẩn đoán lúc bắt đầu phát (chỉ khi bật cờ gỡ lỗi trên máy).

## 🧹 v1.3.4: Xóa audio đã lưu của riêng một video

Bảng điều khiển (bấm biểu tượng tiện ích) có nút **"Xóa audio đã lưu của video này"**: chỉ xóa audio lồng tiếng của video đang mở (trong trang và trong kho của tiện ích), audio các video khác giữ nguyên, rồi tạo lại từ vị trí đang xem. Giọng VieNeu tạo lại miễn phí; giọng Gemini sẽ tính tiền lại. Bản dịch đã lưu không bị xóa.

## 🎯 v1.3.2 / v1.3.3: Giọng không chạy trước phụ đề, không bỏ đoạn ngắn

Đo thật trên video TED có phụ đề Việt do người dịch (arj7oStGLkU, bản 1.3.1): 25 đoạn, không bỏ đoạn nào, nhưng 7/25 đoạn được đọc sớm hơn phụ đề trên 0,8 giây (tối đa 2,0 giây).

| Vấn đề | Nguyên nhân | Sửa |
|---|---|---|
| Giọng đi trước phụ đề tới 2 giây | Câu chưa hết được nói nối sớm tối đa 2 giây, độ sớm cộng dồn qua cả chuỗi đoạn | Sớm tối đa 0,8 giây; đang sớm thì được đọc chậm tới 0,95x để lấp khung, chỉ nghỉ khi vẫn thừa |
| Đoạn đầu rất ngắn (audio < 0,8 giây) sau khi mở video / tua bị bỏ | Điều kiện "đã qua gần hết đoạn" đúng cả khi chưa vào đoạn | Chỉ áp dụng khi đã vào giữa đoạn |
| Có tiếng chậm ~0,4 giây sau khi hết chờ chuẩn bị | Audio đoạn đầu mới nạp khi video chạy | Nạp sẵn audio ngay trong lúc chờ |
| (1.3.3) Nghỉ giữa câu 0,55 đến 0,93 giây sau khi chặn chạy trước | Tốc độ chỉ được giảm 0,06 mỗi đoạn; đoạn 1 âm tiết ("Và") tạo audio 0,4 giây trong khung 1,6 giây | Đang sớm giữa câu: giảm tốc tới 0,1 mỗi đoạn; đoạn <= 2 âm tiết còn nối tiếp được gộp vào đoạn sau (không bỏ chữ nào) |

## 🛑 v1.3.1: KHÔNG rút gọn lời thoại (giữ đủ nội dung người nói)

- Theo yêu cầu của Đàm: bỏ hẳn việc rút gọn câu (bản 1.2.9 và 1.3.0 có thể rút câu tới ~40% với người nói nhanh, làm mất nội dung). Mọi chế độ, mọi giọng đều đọc NGUYÊN VẸN bản dịch; Cài đặt không còn ô "Cho phép rút gọn".
- Người nói nhanh được xử lý mà không bớt chữ: câu dày chữ (theo tốc độ đo thật, phải đọc > 1,15x mới vừa khung) được tạo với khoảng nghỉ trong câu tối đa 0,15 giây (thường 0,4); đang trễ > 1 giây thì được đọc tới 1,4x (Mỹ Duyên ~5 âm tiết/giây, ngang tốc độ đọc tin tức), trần hạ dần khi đã bắt kịp.
- Mô phỏng câu cần ~1,35x mới vừa khung: 14/14 câu đọc nguyên vẹn, 0 câu bỏ, trễ tối đa < 2 giây. Với người nói còn nhanh hơn, giọng Việt sẽ trễ hơn (chấp nhận trễ thay vì mất nội dung).
- Chờ chuẩn bị tối đa 5 giây (giữ từ 1.3.0).

## 🎯 v1.3.0: chờ chuẩn bị 5 giây, người nói rất nhanh không còn làm trễ dồn

- **Đo thật (bg4oDxvTWxs, bản 1.2.9)**: chờ chuẩn bị 1,9 giây (bản dịch đã có sẵn), giọng có từ giây 0. Nhưng người nói rất nhanh: mọi đoạn đọc ở trần 1,3x, trễ dồn 1,1 -> 3,5 -> 4,0 giây (sát ngưỡng bỏ câu 4,5 giây); bước rút gọn của 1.2.9 KHÔNG chạy lần nào vì ước độ dài theo tốc độ mục tiêu (4,66 âm tiết/giây) thay vì tốc độ thật của Mỹ Duyên (~3,56): đoạn "vừa khung" theo ước tính nhưng audio thật dài gấp 1,3 lần.
- Nay: cần rút gọn khi (theo tốc độ ĐO THẬT) phải đọc nhanh hơn 1,15x mới vừa khung; rút tới mức đọc ~1,1x là vừa (còn dư để bắt kịp phần trễ). Câu cần rút gọn CHỜ tới lượt (tối đa 3 câu cùng lúc) thay vì bị tạo giọng luôn bằng câu gốc; câu còn < 2 giây thì đọc câu gốc. Trong lúc chờ chuẩn bị (video đang dừng) rút gọn được cả các câu đầu.
- Chờ chuẩn bị tối đa **5 giây** (trước 3,5 giây).
- Mô phỏng người nói rất nhanh (câu Việt cần 1,9x mới vừa khung): trễ tối đa 4,4 giây -> 0 giây, tốc độ đều 1,12x, 0 câu bỏ.

## 🏃 v1.2.9: người nói nhanh không làm giọng Việt trễ dần

- **Đo thật (kiA_NzGVFo0, bản 1.2.8)**: chờ chuẩn bị 3,1 giây, giọng có ngay từ giây 0,39; 2 lần đọc nối liền, 0 câu bỏ, 0 lỗi. Nhưng người nói rất nhanh: 25 giây đầu giọng Việt chạy ở trần 1,3x mà vẫn trễ dần tới 1,3 giây (bản dịch Việt dài hơn khung).
- Nay với VieNeu: câu dài hơn khung rõ rệt (> 0,6 giây và > 20%) được Gemini rút gọn NHẸ ở chế độ không chặn: chỉ câu còn >= 6 giây nữa mới phát, tối đa 2 câu cùng lúc, các câu khác vẫn tạo giọng; rút gọn về muộn (câu còn < 2 giây) thì đọc câu gốc. Có kiểm tra an toàn nội dung (giữ số liệu, thuật ngữ) và kho đệm; chi phí rất nhỏ (model rẻ nhất, vài chục token mỗi câu). Chế độ Tiết kiệm không rút gọn.

## 📏 v1.2.8: đo thật bản 1.2.7 + dịch nhanh hơn sau khi tua

- **Đo thật trong Chrome (video mới 9SCixFSvTNY, 22/09/2026)**: mở video: chờ chuẩn bị 3,3 giây (Gemini dịch câu đầu ~1,3 giây, VieNeu tạo đoạn đầu 1,14 giây), giọng Việt có NGAY từ câu đầu (giây 0,57 của video), đọc liên tục 20 giây. Tua tới phút 7: chờ 3,2 giây, giọng có ngay; 5 lần đọc nối liền, khoảng hở trong cùng câu 0 đến 0,19 giây (trước: 1,5 đến 3 giây); 0 câu bị bỏ.
- Sau khi tua / mở video: lượt dịch đầu gửi 5 nhóm (1,9 giây) -> nay nhóm sắp phát (8 giây tới) dịch lượt nhỏ; dịch khẩn cấp cả khi vị trí rơi vào khoảng lặng giữa hai dòng phụ đề.

## 🎧 v1.2.7: đọc liền mạch tới dấu câu, chờ chuẩn bị 3,5 giây, không hụt tiếng khi cửa sổ bị che

- **Ngắt giữa câu (chưa tới dấu phẩy / dấu chấm)**: đoạn đọc từng bị cắt ở ranh giới khung phụ đề (thường giữa một vế câu), và "câu chưa hết" chỉ tính khi khoảng lặng < 0,3 giây. Nay: khung phụ đề được chia theo dấu câu bên trong, đoạn đọc cắt ngay SAU dấu câu (buộc phải cắt thì lùi về dấu câu gần nhất); câu chưa hết = không có dấu kết câu và đoạn sau tới trong 1,5 giây; đoạn nối tiếp nói liền (không nghỉ), được bắt đầu sớm tối đa 2 giây, chậm hơn sàn của giọng tối đa 0,08.
- **Cửa sổ Chrome bị che**: Chrome giãn bộ đếm giờ của trang tới ~1 giây (đo thật) -> giữa hai đoạn có thể hụt 1 giây. Nay đoạn sau bắt đầu ngay theo sự kiện "phát xong" của audio / "timeupdate" của video; nhịp nghỉ giữa hai câu được hẹn giờ chính xác.
- **Chờ chuẩn bị (tối đa 3,5 giây, bật/tắt trong Cài đặt > Lồng tiếng)**: mở video mới hoặc tua tới đoạn chưa có giọng -> tạm dừng video trong lúc tải phụ đề, dịch và tạo giọng cho đoạn sắp phát, phát tiếp NGAY khi sẵn sàng. Tua lại đoạn đã có giọng: không dừng. Bấm phát trong lúc chờ: video chạy luôn. Đang quảng cáo: không dừng (chuẩn bị trong lúc quảng cáo).
- Nhịp: tốc độ câu sau không tăng quá 0,1 so với câu trước kể cả khi tốc độ giọng vừa được đo lại.

## 🚀 v1.2.6: lồng tiếng mặc định bật, tab đang mở tự nhận bản mới, tiếng đầu tiên nhanh hơn

- **"Mất luôn VieNeu, không thấy phụ đề"** (đo thật 22/09/2026): (1) kho cài đặt của tiện ích bị Chrome tạo lại lúc 13:44 (gỡ rồi cài lại tiện ích), mất lựa chọn "Lồng tiếng: bật" vốn không nằm trong trang Cài đặt; (2) tab mở từ trước giữ mã cũ đã mất kết nối (mọi lượt dịch báo "Extension context invalidated"); (3) nút dịch trong popup nạp dự phòng chỉ 4 tệp -> lỗi `CST_STYLE` / `ytSettings`.
- Lồng tiếng tự bật MẶC ĐỊNH; Cài đặt có ô "Tự động lồng tiếng Việt khi mở video" (lưu cùng mọi cài đặt khác).
- Tải lại tiện ích: service worker tự nạp lại ĐỦ mã (đúng thứ tự manifest) vào tab YouTube / Coursera đang mở; mã cũ tự tắt khi mất kết nối; nút và lớp phụ đề của mã cũ được thay bằng phần tử còn sống. Popup nạp dự phòng đủ tệp.
- Tiếng đầu tiên nhanh hơn: bỏ 2 lượt "làm nóng giọng" chen trước câu đầu (~0,6 giây); quanh chỗ bắt đầu xem, đoạn đọc được cắt ngắn ~3,5 giây (chia cả khung phụ đề 2 dòng theo từ) để lượt tạo giọng đầu tiên xong trong ~0,6 giây. Mô phỏng video phụ đề tự động: tiếng đầu tiên 1,65 -> 0,90 giây kể từ khi có bản dịch.

## 🧭 v1.2.5: số phiên bản đúng quy tắc, giờ cập nhật trong Cài đặt, vào giữa video có tiếng ngay

- **Phiên bản**: mỗi lần +0.0.1, chữ số tới 9 thì sang bậc trên (1.2.9 -> 1.3.0). Các bản trước ghi nhầm 1.1.10 đến 1.1.14 nay là 1.2.0 đến 1.2.4. `node tools/bump-version.js` tự tính số kế tiếp và ghi đủ manifest, package, build-info.js, nhãn Cài đặt (kèm giờ cập nhật) và popup.
- **Đo thật trong Chrome (1.2.4)**: DwWu9ZKCSzU mở ở phút 6: có tiếng sau 4,4 giây (trước: 25 giây chưa có), trong đó ~2 giây chờ bản dịch Gemini. wNu087h3OAQ mở ở phút 2: tiếng sau 6,5 giây vì lỗi dưới đây.
- **Vào giữa một đoạn đọc**: vị trí trong audio từng tính bằng nhịp nền 1,22x -> tưởng đoạn sắp xong, bỏ cả đoạn, im tới đoạn sau. Nay tính theo độ dài audio thật so với khung phụ đề.
- **VieNeu tạo trước xa hơn**: luôn có sẵn audio ít nhất 20 giây phía trước (miễn phí, tạo nhanh ~4 lần thời gian thực).
- **Chẩn đoán**: đặt `localStorage.cstDubDebug = "1"` trên trang YouTube, engine ghi trạng thái (đoạn quanh vị trí xem, đoạn đã nói, tốc độ) vào thuộc tính `data-cst-dub` của thẻ html. Không gửi đi đâu.

## ⚡ v1.2.4 (trước ghi nhầm 1.1.14): có tiếng ngay, không còn ngắt giữa câu với phụ đề tự động

- **Đo thật trong Chrome (22/09/2026)**: video phụ đề tự động (DwWu9ZKCSzU, mở ở phút 5) có phụ đề Việt sau ~2 giây nhưng 25 giây KHÔNG có tiếng. Log máy chủ: mỗi lượt VieNeu là 23 đến 31 giây audio, mất 6 đến 8 giây, vì phụ đề tự động (không dấu câu, dòng nối liền) làm cả nhóm dịch 20 đến 30 giây thành MỘT đoạn đọc; audio xong thì video đã qua đoạn đó.
- Đoạn đọc nay tối đa ~8 giây, cắt ở ranh giới dòng phụ đề (ưu tiên sau dấu câu từ 6 giây). Lúc vừa bật / vừa tua không tạo audio cho đoạn đã qua.
- Câu CHƯA HẾT (đoạn nối sang đoạn sau): giọng đọc lấp tới đoạn sau (được chậm tới 0,95x như người nói gốc) và đoạn sau được nói sớm tối đa 1,2 giây ngay sau đoạn trước, không còn im giữa câu chờ phụ đề.
- Mô phỏng video phụ đề tự động (VieNeu 0,3 giây tạo cho 1 giây lời, bật ở phút 5): tiếng đầu tiên sau 1,65 giây, không có chỗ im > 0,3 giây giữa các đoạn của cùng câu.

## 🔊 v1.2.3 (trước ghi nhầm 1.1.13): giọng Việt không còn mất từng quãng, bật tiếng nhanh hơn

- **Giọng im ~15 giây rồi mới có lại**: nguyên nhân chính là bước rút gọn câu bằng Gemini vẫn chạy khi giọng là VieNeu (chế độ Cân bằng + có API key). Mỗi lần rút gọn chờ Gemini tới 8 giây, thử lại 1 lần (tới ~16 giây) và CHẶN toàn bộ việc tạo audio. Nay: VieNeu không rút gọn câu (co giãn tốc độ đủ khớp); với Gemini TTS, rút gọn không được chặn quá 2,5 giây.
- Phần dịch lỗi tạm thời (Gemini giới hạn tốc độ) từng chờ cố định 15 giây mới dịch lại: câu sắp phát nay thử lại sau 2, 4, 8 giây.
- Mã câu trong kế hoạch lồng tiếng theo mốc thời gian (trước theo số thứ tự, bị lệch khi bản dịch về không theo thứ tự).
- VieNeu lỗi tạm thời không còn làm cả video chuyển sang giọng hệ thống (chỉ khi máy chủ thật sự tắt); câu tạo lỗi hết lượt thử được bỏ qua ngay, không im chờ 4,5 giây.
- Bật nhanh hơn: tự dịch thử từ 0,4 giây sau khi mở video (trước chờ cố định 1,5 giây và bỏ cuộc nếu trình phát chưa sẵn sàng); kiểm tra giọng hệ thống và VieNeu song song; bỏ bước hỏi model Gemini TTS khi dùng VieNeu; câu thoại được gửi trước việc làm nóng giọng.
- Giọng đọc mặc định: **Giọng Việt trên máy: VieNeu** (chuyển một lần từ "Tự động"). Bỏ ô "Model VieNeu" trong Cài đặt.
- Đo thật (máy chủ VieNeu thật, bản dịch về lộn thứ tự, có lượt dịch lỗi): tiếng đầu tiên sau 2,8 giây kể từ khi bật (gồm chờ bản dịch đầu tiên), đọc 22/22 câu, mỗi câu tạo audio đúng 1 lần.

## 🩹 v1.2.2 (trước ghi nhầm 1.1.12): sửa lỗi phụ đề rỗng, tự bật lồng tiếng, VieNeu không bỏ câu

- **"Tải được phụ đề nhưng không đọc được nội dung"**: từ 09/2026 YouTube trả phụ đề rỗng (200, 0 byte) cho link có `exp=xpe` nếu thiếu mã xác thực `pot` của trình phát. Cầu nối `yt-bridge.js` nghe (không sửa) yêu cầu phụ đề của chính trình phát để giữ nội dung và mã `pot`; chưa có thì bật phụ đề trình phát trong giây lát (đo thật: 0,7 giây) rồi trả về trạng thái cũ.
- **Tự dịch và tự bật lồng tiếng**: ô "Lồng tiếng" trong popup và nút trên trình phát được nhớ (`dubEnabled`); video / bài giảng sau tự dịch rồi tự bật giọng VieNeu. Tự động thì lỗi chỉ ghi ra console, không bật hộp thoại chặn trang.
- **VieNeu bỏ câu**: log thật cho thấy một lượt bị kẹt 45 giây (6 giây audio), chặn luồng duy nhất của máy chủ, các câu khác nhận 429 rồi bị bỏ. Nay mọi yêu cầu xếp hàng trong service worker (máy chủ không nhận 2 yêu cầu cùng lúc), hạn giờ theo độ dài câu (8 giây cho câu ngắn), bị kẹt hoặc audio dài bất thường thì tạo lại; hết giờ không còn đánh dấu bỏ câu vĩnh viễn.
- **Nhịp đọc**: mỗi câu co giãn để nói xong gần mốc cuối phụ đề của nó (không chạy trước phụ đề), không dưới tốc độ sàn của giọng (nghe tối thiểu ~4 âm tiết/giây; Mỹ Duyên ~x1,13), tối đa 1,3x; nhanh lên tối đa 0,1, chậm lại tối đa 0,06 mỗi câu. Giữ khoảng ngừng tự nhiên tới 0,4 giây (trước là 0,22), thêm dấu phẩy ở chỗ người nói gốc ngừng thật, nghỉ 0,18 giây giữa hai câu khi phải nối nhau.
- **Máy chủ VieNeu (vá trong `~/VieNeu-TTS/apps/openai_speech.py`, bản gốc `.orig`)**: khi phía gọi ngắt kết nối giữa chừng, máy chủ gốc giữ luồng duy nhất mãi mãi (mọi câu sau nhận 429 tới khi khởi động lại). Bản vá trả luồng sau 4 giây không tiến triển.
- Đo thật (bài giảng 22 câu, Mỹ Duyên, 2 lần): 22/22 câu, bỏ 0, trễ tối đa 1,15 giây (chỉ sau câu 15 giây trong khung 11,7 giây), tốc độ x1,10 đến x1,22, độ lệch chuẩn 0,03, nghe ~4,05 âm tiết/giây.

## 🎚️ v1.2.1 (trước ghi nhầm 1.1.11): nhịp nói đều, chất lượng giọng VieNeu

Đo thật trên máy (bài giảng 22 câu, giọng Mỹ Duyên), so với 1.1.10:

| | 1.1.10 | 1.1.11 |
|---|---|---|
| Độ lệch chuẩn tốc độ giữa các câu | 0,044 | 0,006 |
| Bước nhảy tốc độ lớn nhất giữa hai câu | 0,15 | 0,018 |
| Trễ so với phụ đề tối đa | 0,8 giây | 0,3 giây |
| Tốc độ nghe (âm tiết/giây) | ~3,7 | ~4,5 |

- Giọng mặc định: **Mỹ Duyên** (người nói chính) và **Thái Sơn** (người nói thứ hai), miền Nam; model **VieNeu-TTS v3 Turbo**.
- **Nhịp nền theo giọng**: giọng chậm (kể chuyện, đọc truyện) được tăng tốc ĐỀU cho cả video (tối đa 1,22x, giữ cao độ), đo tốc độ thật từ audio; từng câu chỉ nhanh thêm tối đa 8% khi dài hơn khoảng trống, thêm tối đa 8% khi đang trễ, và tốc độ đổi không quá 0,06 giữa hai câu.
- **Nhiệt độ lấy mẫu 0,6** (mặc định VieNeu 0,8): độ dài cùng một câu dao động 4 đến 6% thay vì 8 đến 12%.
- **Rút khoảng lặng dài** trong câu (VieNeu ngừng 0,3 đến 0,6 giây ở dấu phẩy) xuống 0,22 giây, cắt ở giữa khoảng lặng và làm mờ mép, không đổi giọng.
- **Lời thoại cho VieNeu**: chỉ giữ dấu câu thật (không tự thêm dấu phẩy ở chỗ lấy hơi), bỏ ký hiệu ([nhạc], >>, ♪), câu còn nối sang phụ đề sau thì không ép ngữ điệu kết câu.
- **Làm nóng giọng** khi bật lồng tiếng; **tạo sẵn audio câu kế tiếp** để không hụt giữa hai câu.
- **Video 1,25x / 1,5x**: không nhân thêm nhịp nền (tránh giọng líu ríu).
- **Giải phóng bộ nhớ**: audio các câu đã qua hơn 90 giây được giải phóng (tua lại lấy từ kho, không tạo lại).
- **Máy chủ bận (429)**: chờ theo Retry-After rồi thử lại tối đa 2 lần; máy chủ cho tối đa 4 yêu cầu chờ (`cst-start.command`).
- "Nghe thử" trong Cài đặt phát đúng nhịp nền như khi lồng tiếng thật.
