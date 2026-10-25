# Vietnamese Subtitle Translator

<div align="center">
  <img src="icons/icon.png" alt="Biểu tượng tiện ích" width="100"/>
</div>

Tiện ích trình duyệt (Manifest V3, nhân Chromium) dịch phụ đề video sang tiếng Việt bằng Gemini và
lồng tiếng Việt bằng giọng VieNeu chạy ngay trên máy. Dùng tốt nhất trên **YouTube** và **Coursera**;
các trang video khác có phụ đề dạng text track cũng dịch được khi bạn bấm Dịch.

Chạy trên Chrome, Cốc Cốc, Edge, Brave, Opera, Vivaldi, Arc và Chromium. Không chạy trên Firefox và
Safari. Không có bước build, không có thư viện ngoài: mã nguồn trong thư mục này chính là tiện ích.

Bạn bè cài bằng một lệnh từ kho công khai
[dich-phu-de-long-tieng](https://github.com/mrthanhduy2000/vietnamese-subtitle-translator) (bản dựng từ kho
này, có bộ cài cho Mac và Windows, tự cập nhật).

## Tính năng

### Phụ đề
- Dịch bằng Gemini, tự dò model mà khóa API của bạn dùng được (mặc định "Tự động"); Gemini lỗi hoặc
  hết ngân sách thì dự phòng bằng Google Dịch.
- Dịch theo ngữ cảnh: gửi kèm câu trước, bản dịch trước, tiêu đề và mô tả video, nhắc lại chủ thể
  được nêu từ xa, để đại từ và thuật ngữ nhất quán trong cả bài.
- Từ điển thuật ngữ và tên riêng hàng chục nghìn mục (số mục từng bản: xem `docs/CHANGELOG.md`): tên sản phẩm,
  viết tắt được giữ nguyên, 526 thuật ngữ có tên tiếng Việt chuẩn luôn được dịch thống nhất. Tự thêm từ giữ nguyên hoặc quy tắc
  `từ => bản dịch` riêng trong Cài đặt.
- Ngắt dòng và phân đoạn theo tiếng Việt, không vắt câu ngang dòng.
- Hiển thị song ngữ hoặc chỉ tiếng Việt; chỉnh vị trí, kiểu chữ, nền trong Cài đặt, cỡ chữ ngay trên video.
- Bản chép lời cạnh video, sửa tay từng dòng (bản sửa được nhớ cho lần sau), xuất tệp `.srt`.
- Video đã có phụ đề tiếng Việt thì dùng luôn, không tốn phí (tắt được trong Cài đặt).

### Lồng tiếng Việt
- Giọng [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) chạy trên máy: miễn phí, 25 giọng theo
  vùng miền, mặc định Mỹ Duyên.
- Khớp nhịp theo mốc thời gian phụ đề bằng tốc độ đọc và khoảng nghỉ. **Không bao giờ lược bớt lời**:
  người nói nhanh thì giọng đọc nhanh hơn (có giới hạn tốc độ tối đa), chứ không cắt nội dung.
- **Mỗi người nói một giọng (tự bật từ 2.5.2).** Video có nhiều người nói (tối đa 8 giọng) thì mỗi người một giọng;
  người nói nhiều nhất dùng giọng chính. Video chỉ một người nói giữ một giọng, kể cả khi phụ đề tự
  động đánh dấu nhầm quanh đoạn nhạc hay câu trích lời. Tiện ích dựa vào:
  - tên người nói trong phụ đề (`TÊN:`), nếu có;
  - nếu không có tên và có khóa Gemini (YouTube): Gemini đọc lời gốc một lần cho mỗi video để biết ai
    nói câu nào, nam hay nữ; giọng được chọn hợp giới tính. Ước tính vài chục đồng cho video 10 phút,
    xem lại không tốn thêm. Kết quả Gemini không chắc chắn thì bỏ qua;
  - còn lại: dấu đổi người nói `>>` trong phụ đề, chỉ khi chúng thật sự tạo thành hội thoại.
  Chọn "Một giọng cho cả video" trong Cài đặt > Lồng tiếng nếu không muốn.
- Ngắt nghỉ theo cấu trúc câu, đọc số và ký hiệu kiểu Việt, đọc đúng tên riêng, thương hiệu, viết tắt
  tiếng Anh.
- Tự hạ tiếng gốc khi giọng Việt đang đọc; không chồng lên bản lồng tiếng AI tiếng Việt của YouTube.
- Audio đã tạo được lưu lại; xem lại video không phải tạo lại.

### Chi phí và tiện dụng
- Ước tính chi phí Gemini, đặt ngân sách theo ngày và theo video; xem chi phí hôm nay trong bảng điều
  khiển.
- Chế độ sử dụng: Cao cấp, Cân bằng (khuyên dùng), Tiết kiệm, Chỉ phụ đề.
- Phím tắt: `Alt+S` bật/tắt phụ đề, `Alt+D` bật/tắt lồng tiếng, `Alt+Shift+V` mở bảng điều khiển
  (đổi tại `chrome://extensions/shortcuts`; Edge: `edge://extensions/shortcuts`).
- Giao diện Sáng / Tối, sao lưu và khôi phục cài đặt, mục Lịch sử phiên bản trong Cài đặt.
- Lần cài đầu tiên, trang Cài đặt tự mở với phần chào mừng: chỗ dán khóa Gemini, trạng thái giọng
  VieNeu, cách ghim tiện ích và phím tắt.

## Tài liệu

- [Hướng dẫn sử dụng](docs/HUONG-DAN.md): cài đặt, lấy khóa Gemini, dịch phụ đề, lồng tiếng, Coursera, chi phí, xử lý sự cố, câu hỏi thường gặp.
- [Lịch sử thay đổi](docs/CHANGELOG.md): các bản đã làm gì, gom theo giai đoạn.

## Cài đặt

### Cách 1: một lệnh (khuyên dùng)

Cài cả tiện ích lẫn giọng VieNeu, cho VieNeu tự chạy cùng máy và tự cập nhật. Chi tiết, bảng lỗi, cách
gỡ: [dich-phu-de-long-tieng](https://github.com/mrthanhduy2000/vietnamese-subtitle-translator).

**Mac** (Terminal):

```bash
curl -fsSL https://raw.githubusercontent.com/mrthanhduy2000/vietnamese-subtitle-translator/share/install-mac.sh | bash
```

**Windows** (Windows PowerShell):

```powershell
irm https://raw.githubusercontent.com/mrthanhduy2000/vietnamese-subtitle-translator/share/install-windows.ps1 | iex
```

Xong, một trang hướng dẫn tự mở trong trình duyệt nhân Chromium của bạn, chỉ đúng địa chỉ và tên nút
của trình đó. Trình duyệt không cho chương trình nào tự bật một tiện ích không qua cửa hàng, nên bước
bật tiện ích (chế độ nhà phát triển, Tải tiện ích đã giải nén) vẫn làm tay một lần.

### Cách 2: từ mã nguồn

1. Tải mã nguồn:
   ```bash
   git clone https://github.com/mrthanhduy2000/vietnamese-subtitle-translator.git
   ```
2. Mở trang tiện ích của trình duyệt (`chrome://extensions`; Edge `edge://extensions`, Brave
   `brave://extensions`, Opera `opera://extensions`, Vivaldi `vivaldi://extensions`), bật **Chế độ
   dành cho nhà phát triển** (Developer mode).
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục vừa tải.
4. Trang Cài đặt tự mở: dán khóa Gemini API (lấy tại
   [Google AI Studio](https://aistudio.google.com/apikey)). Để model là "Tự động".

### Cập nhật bản mới (cách 2)

```bash
git pull
```

Rồi bấm nút **Tải lại** (biểu tượng mũi tên vòng) của tiện ích tại trang tiện ích, và tải lại trang
video đang mở. **Đừng gỡ tiện ích rồi cài lại**: trình duyệt sẽ xóa kho cài đặt, mất khóa API và toàn
bộ cài đặt lồng tiếng.

### Bật giọng VieNeu bằng tay (cách 2)

Máy chủ giọng là một chương trình riêng, chạy ngoài tiện ích. Máy của tác giả đang chạy đúng như sau:

```bash
brew install uv
git clone https://github.com/pnnbao97/VieNeu-TTS.git ~/VieNeu-TTS
cd ~/VieNeu-TTS && git checkout d350c63fceb0792d7b2db9a51d61cc040b1f8efa && uv sync
cp tools/share/vieneu/openai_speech.py ~/VieNeu-TTS/apps/   # chạy trong thư mục tiện ích
~/VieNeu-TTS/.venv/bin/python tools/vieneu-pin.py --install  # tải mô hình cố định, kiểm mã băm, ghi dấu .pinned-ok
```

- Bản VieNeu bị khóa ở một phiên bản, vì 25 giọng (trong đó có Mỹ Duyên) nằm trong chính mã VieNeu.
- `openai_speech.py` là bản vá máy chủ của tiện ích này: trả luồng khi phía gọi ngắt giữa chừng, và
  chỉ nghe trên `127.0.0.1` nếu không đặt `HOST` khác (bản gốc mở cho cả mạng).
- Mô hình 580 MB nằm cố định ở `~/VieNeu-TTS/models/hf`, không nằm trong `~/.cache`, vì công cụ
  dọn đĩa hay xóa thư mục đó. Danh sách tệp và mã băm: `tools/share/vieneu-model.json`.

Khởi động máy chủ với mô hình cố định và không lên mạng, rồi kiểm tra:

```bash
cd ~/VieNeu-TTS && HF_HOME=~/VieNeu-TTS/models/hf HF_HUB_OFFLINE=1 .venv/bin/python -m apps.openai_speech
curl 127.0.0.1:8000/health
python3 tools/vieneu-pin.py   # mô hình trên máy còn đúng bản đã khóa không
```

Máy chủ chưa chạy thì tiện ích báo một lần rồi tự chờ, máy chủ lên là bắt đầu đọc.

## Sử dụng

1. Mở video YouTube, bài giảng Coursera hoặc trang video khác.
2. Bấm nút của tiện ích trên thanh điều khiển video (YouTube, Coursera) hoặc bấm **Dịch** trong bảng
   điều khiển (biểu tượng tiện ích trên thanh công cụ).
3. Mở thực đơn trên video để bật lồng tiếng, chỉnh cỡ chữ, âm lượng, mở bản chép lời.
4. Trên nhãn lồng tiếng, "Lồng tiếng: 3 giọng theo người nói" nghĩa là tiện ích đã nhận ra 3 người nói.

## Khi gặp lỗi

Bảng đầy đủ hơn: [Hướng dẫn sử dụng, mục Xử lý sự cố](docs/HUONG-DAN.md#8-xử-lý-sự-cố).

| Hiện tượng | Cách xử lý |
|---|---|
| Có phụ đề nhưng không có giọng | `curl 127.0.0.1:8000/health`. Không trả lời thì khởi động VieNeu (Cài đặt > Lồng tiếng chỉ đúng lệnh cho máy bạn) |
| YouTube báo không đọc được nội dung phụ đề | Tải lại trang video; vẫn lỗi thì xem `docs/DANGER.md` §pot |
| Giọng thứ hai chen vào video chỉ có một người | Ghi lại đường dẫn video để sửa quy tắc. Tạm thời: Cài đặt > Lồng tiếng > Giọng theo người nói > Một giọng cho cả video |
| Model Gemini báo 404 | Để model là "Tự động": khóa mới không gọi được một số model cũ, tiện ích tự dò model gọi được |
| Sau khi sửa mã, trang video chạy bản cũ | Bấm Tải lại ở trang tiện ích rồi tải lại trang video |

## Quyền riêng tư

- Lời phụ đề được gửi tới Gemini (Google) bằng khóa của bạn, hoặc tới Google Dịch khi tắt AI hay
  Gemini lỗi. Khi bật "Dùng Gemini nhận ra ai đang nói", lời gốc của video YouTube được gửi thêm một
  lần cho việc đó.
- Giọng đọc chạy hoàn toàn trên máy; máy chủ VieNeu chỉ mở ở `127.0.0.1:8000`.
- Khóa Gemini nằm trong kho cài đặt của trình duyệt, chỉ dùng để gọi Gemini.

## Giới hạn đã biết

- Trang video khác YouTube và Coursera: chỉ dịch được khi trình phát có phụ đề dạng text track, và phải
  bấm Dịch mỗi lần mở trang. Chưa hỗ trợ trình phát nằm trong khung nhúng từ tên miền khác (video Vimeo
  nhúng, edX) và trang tự vẽ phụ đề không qua text track (Udemy).
- Lồng tiếng cần máy chủ VieNeu đang chạy trên cùng máy.
- Nhận ra người nói dựa trên chữ của phụ đề (tên, dấu `>>`, hoặc Gemini đọc lời), không nghe giọng thật.
  Một lượt đổi người mà phụ đề không đánh dấu và Gemini không nhận ra thì vẫn đọc bằng giọng trước.
- Trong hội thoại nói qua lại rất nhanh, mỗi lượt là một câu đọc riêng nên giọng bắt đầu trễ hơn một
  chút so với đọc một giọng (đo trên video nhanh nhất: trễ trung vị 0,85 lên 1,18 giây). Không câu
  nào bị bỏ.
- Không có trên Chrome Web Store: bật tiện ích cần chế độ nhà phát triển.

## Dành cho người phát triển

```bash
npm test                     # chạy toàn bộ kiểm thử, không cần mạng, không cần cài gói
node tools/regress.js        # lưới hồi quy trên mọi video đã rà soát (mô phỏng phát lại)
node tools/bump-version.js   # tăng số phiên bản sau mỗi lần sửa mã chạy thật
node tools/publish-share.js --stage    # dựng kho công khai, đẩy lên nhánh staging để cài thử
node tools/publish-share.js --promote  # chỉ khi cài thử trên staging đạt: đưa đúng bản đó lên main
```

- `manifest.json` giữ số phiên bản thật.
- `CLAUDE.md` là quy tắc làm việc; `docs/` mô tả kiến trúc: `MAP.md` (từng tệp làm gì), `SUBTITLE.md`
  (luồng phụ đề, thông điệp, khóa lưu trữ), `DUBBING.md` (lồng tiếng, người nói, đồng bộ), `DANGER.md`
  (chỗ dễ vỡ), `TESTING.md` (kiểm thử), `BACKLOG.md` (lỗi đã biết), `HANDOFF.md` (bàn giao phiên trước).
- Lịch sử thay đổi đầy đủ nằm ở `version-history.js`, hiển thị trong Cài đặt > Lịch sử phiên bản.
