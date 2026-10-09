# Vietnamese Subtitle Translator

<div align="center">
  <img src="icons/icon.png" alt="Biểu tượng tiện ích" width="100"/>
</div>

Tiện ích Chrome (Manifest V3) dịch phụ đề video sang tiếng Việt bằng Gemini và lồng tiếng Việt bằng
giọng VieNeu chạy ngay trên máy. Dùng tốt nhất trên **YouTube** và **Coursera**; các trang video khác
có phụ đề dạng text track cũng dịch được khi bạn bấm Dịch.

Không có bước build, không có thư viện ngoài: mã nguồn trong thư mục này chính là tiện ích.

## Tính năng

### Phụ đề
- Dịch phụ đề bằng Gemini, tự dò model mà khóa API của bạn dùng được (mặc định "Tự động"); Gemini lỗi
  hoặc hết ngân sách thì dự phòng bằng Google Translate.
- Dịch theo ngữ cảnh: gửi kèm câu trước, bản dịch trước, tiêu đề và mô tả video, nhắc lại chủ thể
  được nêu từ xa, để đại từ và thuật ngữ nhất quán trong cả bài.
- Từ điển thuật ngữ 19 nhóm ngành (hơn 1.600 thuật ngữ): tên sản phẩm, viết tắt được giữ nguyên,
  526 thuật ngữ có tên tiếng Việt chuẩn luôn được dịch thống nhất. Tự thêm từ giữ nguyên hoặc quy tắc
  `từ => bản dịch` riêng trong Cài đặt.
- Ngắt dòng và phân đoạn theo tiếng Việt, không vắt câu ngang dòng.
- Hiển thị song ngữ hoặc chỉ tiếng Việt; chỉnh vị trí, kiểu chữ, nền trong Cài đặt, cỡ chữ ngay trên video.
- Bản chép lời cạnh video, sửa tay từng dòng (bản sửa được nhớ cho lần sau), xuất tệp `.srt`.
- Video đã có phụ đề tiếng Việt thì dùng luôn, không tốn phí (tắt được trong Cài đặt).

### Lồng tiếng Việt
- Giọng [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS) chạy trên máy: miễn phí, 25 giọng theo
  vùng miền, có tùy chọn giọng thứ hai cho người nói khác.
- Khớp nhịp theo mốc thời gian phụ đề bằng tốc độ đọc và khoảng nghỉ. **Không bao giờ lược bớt lời**:
  người nói nhanh thì giọng đọc nhanh hơn (có giới hạn tốc độ tối đa), chứ không cắt nội dung.
- Ngắt nghỉ theo cấu trúc câu, đọc số và ký hiệu kiểu Việt, đọc đúng tên riêng, thương hiệu, viết tắt
  tiếng Anh.
- Tự hạ tiếng gốc khi giọng Việt đang đọc; không chồng lên bản lồng tiếng AI tiếng Việt của YouTube.
- Audio đã tạo được lưu lại; xem lại video không phải tạo lại.

### Chi phí và tiện dụng
- Ước tính chi phí Gemini, đặt ngân sách theo ngày và theo video; xem chi phí hôm nay trong bảng điều
  khiển.
- Chế độ sử dụng: Cao cấp, Cân bằng (khuyên dùng), Tiết kiệm, Chỉ phụ đề.
- Phím tắt: `Alt+S` bật/tắt phụ đề, `Alt+D` bật/tắt lồng tiếng, `Alt+Shift+V` mở bảng điều khiển
  (đổi tại `chrome://extensions/shortcuts`).
- Giao diện Sáng / Tối, sao lưu và khôi phục cài đặt, mục Lịch sử phiên bản trong Cài đặt.

## Cài đặt

1. Tải mã nguồn:
   ```bash
   git clone https://github.com/mrthanhduy2000/vietnamese-subtitle-translator.git
   ```
2. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển** (Developer mode).
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục vừa tải.
4. Mở Cài đặt của tiện ích, dán khóa Gemini API (lấy tại
   [Google AI Studio](https://aistudio.google.com/apikey)). Để model là "Tự động".

### Cập nhật bản mới

```bash
git pull
```

Rồi bấm nút **Tải lại** (biểu tượng mũi tên vòng) của tiện ích tại `chrome://extensions`.
**Đừng gỡ tiện ích rồi cài lại**: Chrome sẽ xóa kho cài đặt, mất khóa API và toàn bộ cài đặt lồng
tiếng.

### Bật giọng VieNeu (cho lồng tiếng)

Máy chủ giọng là một chương trình riêng, chạy ngoài tiện ích. Cách dễ nhất là bộ cài một lệnh ở kho
công khai [dich-phu-de-long-tieng](https://github.com/mrthanhduy2000/dich-phu-de-long-tieng): nó
cài cả tiện ích lẫn VieNeu, tự khởi động cùng máy và tự cập nhật.

Cài tay (máy của tác giả đang chạy đúng như sau):

```bash
brew install uv
git clone https://github.com/pnnbao97/VieNeu-TTS.git ~/VieNeu-TTS
cd ~/VieNeu-TTS && git checkout d350c63fceb0792d7b2db9a51d61cc040b1f8efa && uv sync
cp tools/share/vieneu/openai_speech.py ~/VieNeu-TTS/apps/   # chạy trong thư mục tiện ích
~/VieNeu-TTS/.venv/bin/python tools/vieneu-pin.py --fetch    # tải mô hình cố định, kiểm mã băm
```

- Bản VieNeu bị khóa ở một phiên bản, vì 25 giọng (trong đó có Mỹ Duyên) nằm trong chính mã VieNeu.
- `openai_speech.py` là bản vá máy chủ của tiện ích này (trả luồng khi phía gọi ngắt giữa chừng).
- Mô hình 580 MB nằm cố định ở `~/VieNeu-TTS/models/hf`, không nằm trong `~/.cache`, vì công cụ
  dọn đĩa hay xóa thư mục đó. Danh sách tệp và mã băm: `tools/share/vieneu-model.json`.

Khởi động máy chủ với mô hình cố định và không lên mạng (chỉ mở trên `127.0.0.1:8000`, máy khác trong
mạng không gọi được), rồi kiểm tra:

```bash
cd ~/VieNeu-TTS && HF_HOME=~/VieNeu-TTS/models/hf HF_HUB_OFFLINE=1 .venv/bin/python -m apps.openai_speech
curl 127.0.0.1:8000/health
python3 tools/vieneu-pin.py   # mô hình trên máy còn đúng bản đã khóa không
```

Máy chủ chưa chạy thì tiện ích báo một lần rồi tự chờ, máy chủ lên là bắt đầu đọc.

## Sử dụng

1. Mở video YouTube, bài giảng Coursera hoặc trang video khác.
2. Bấm nút của tiện ích trên thanh điều khiển video (YouTube, Coursera) hoặc bấm **Dịch** trong bảng
   điều khiển (biểu tượng tiện ích trên thanh công cụ Chrome).
3. Mở thực đơn trên video để bật lồng tiếng, chỉnh cỡ chữ, âm lượng, mở bản chép lời.

## Giới hạn đã biết

- Trang video khác YouTube và Coursera: chỉ dịch được khi trình phát có phụ đề dạng text track, và phải
  bấm Dịch mỗi lần mở trang. Chưa hỗ trợ trình phát nằm trong khung nhúng từ tên miền khác (video Vimeo
  nhúng, edX) và trang tự vẽ phụ đề không qua text track (Udemy).
- Lồng tiếng cần máy chủ VieNeu đang chạy trên cùng máy.

## Dành cho người phát triển

```bash
npm test                     # chạy toàn bộ kiểm thử, không cần mạng, không cần cài gói
node tools/bump-version.js   # tăng số phiên bản sau mỗi lần sửa mã
```

- `manifest.json` giữ số phiên bản thật.
- `docs/` mô tả kiến trúc: `MAP.md` (từng tệp làm gì), `SUBTITLE.md` (luồng phụ đề, khóa lưu trữ),
  `DUBBING.md` (lồng tiếng), `DANGER.md` (chỗ dễ vỡ), `TESTING.md` (kiểm thử).
- Lịch sử thay đổi đầy đủ nằm ở `version-history.js`, hiển thị trong Cài đặt > Lịch sử phiên bản.
