# Lịch sử thay đổi

Bản tóm tắt dễ đọc, gom theo giai đoạn. Từng bản một, đầy đủ chi tiết và số đo, nằm trong
`version-history.js` (hiển thị ở Cài đặt > **Lịch sử phiên bản**). Hướng dẫn dùng: [HUONG-DAN.md](HUONG-DAN.md).

Mốc thời gian lấy từ `version-history.js`. Từ 2.2.0 đến 2.5.0 nguồn đó không ghi ngày nên ghi là "cuối
tháng 9 đến đầu tháng 10/2026".

## Bản mới nhất: 2.9.x (23/10/2026)

- **2.9.6** Câu cảnh báo hết hạn mức của dịch vụ dự phòng MyMemory không còn hiện lên như một dòng phụ đề.
- **2.9.5** Từ điển thêm khoảng 35.000 tên riêng (thể thao, giải trí, âm nhạc, khoa học, công nghệ, sức khỏe,
  địa danh, kinh tế, thú cưng, du lịch, thời trang). Từ điển có khoảng 73.000 mục. Phần lớn soạn từ kiến thức có sẵn,
  chưa đối chiếu nguồn, nên có thể có tên sai.
- **2.9.4** Coursera (và trang video khác) lưu nguyên bài đã dịch. Mở lại không gọi Gemini nữa. Giữ 200 bài gần nhất.
- **2.9.3** Phụ đề trống hoặc hỏng thì thử lần lượt tối đa 4 phụ đề khác; báo rõ khi phụ đề trống.
- **2.9.0 đến 2.9.2** Từ điển lớn lên khoảng 55.000 mục: tên thiết bị, cầu thủ, địa danh, thương hiệu, công ty, nhân vật.

## 2.5 đến 2.8: giọng đọc tự nhiên hơn, nhiều người nói

- **2.8.x** Giọng đọc xử lý chính xác hơn phân số, `15$`, `4K`, `30k` (đọc "30 nghìn"), dấu `/`, `>`, `@`, mặt
  cười; lời thoại trong ngoặc đơn được lồng tiếng; giữ cách xưng "tôi/mình"; chú thích như "[nhạc]" ở mọi
  ngôn ngữ bị bỏ qua.
- **2.7.x** Bền hơn: video mở ở thẻ nền vẫn tự dịch; bản dịch được lưu ngay khi dịch xong; Gemini trả chậm hay
  bỏ trống một dòng ngắn không còn làm hỏng cả đoạn; phụ đề không còn nháy giữa hai dòng.
- **2.6.x** Từ điển lên gần 29.500 thuật ngữ; giọng đọc tên riêng và tiếng Anh theo kiểu quốc tế; đọc được phụ
  đề in trên hình khi YouTube chỉ có phụ đề của bản lồng tiếng AI; giọng không còn đọc trước người nói.
- **2.5.x** **Mỗi người nói một giọng** (2.5.2), cài được trên mọi trình duyệt nhân Chromium; thống kê chi phí đúng
  theo ngày và tuần, tháng, quý, năm (2.5.6); phím tắt đặt riêng cho Windows và Mac; Coursera có giọng Việt ngay
  từ câu đầu (2.5.0); trang Cài đặt gọn và đẹp hơn.

## 2.0 đến 2.4: lồng tiếng ổn định, chi phí minh bạch (cuối tháng 9 đến đầu tháng 10/2026)

- Chi phí ước tính đếm đủ mọi lượt Google tính tiền, chi tiết theo model và theo ngày, hiển thị VNĐ, USD hoặc cả hai.
- Chia sẻ cho bạn bè, có cả máy Windows (2.4.9).
- Lưu tới 100 video đã rà soát, kho audio lồng tiếng tới 3 GB; nút xóa những video đã rà soát.
- Nhiều bản sửa nhịp đọc: ngắt hơi đúng sau chủ ngữ dài, chỗ lấy hơi ngắn như hơi thở, tiếng gốc tăng giảm
  đều tai, hết tiếng "bụp".
- Không cắt mất ý, không bỏ sót câu, phụ đề không còn trượt dòng ở hội thoại nhiều lượt.
- Nút **Kiểm tra API Key** kiểm tra lại thật; không nhầm tiếng Bồ Đào Nha thành tiếng Việt; tệp `.srt` đúng chuẩn.

## 1.5 đến 1.9: hoàn thiện trải nghiệm (23/09 đến 28/09/2026)

- **1.9.x** Xử lý đúng các tình huống khó: trình duyệt chặn âm thanh, quảng cáo YouTube, tua đi tua lại, tải lại
  tiện ích khi đang lồng tiếng.
- **1.8.x** Giọng VieNeu phân biệt tên Việt và tên Anh theo ngữ cảnh; từ điển thuật ngữ có 526 thuật ngữ với
  cách dịch tiếng Việt chuẩn; lồng tiếng có tiếng lại gần như ngay sau khi tua. Bỏ giọng Gemini trả phí, chỉ dùng VieNeu.
- **1.7.x** Mỹ Duyên làm giọng mặc định; không chồng giọng lên bản lồng tiếng AI của YouTube; đọc đúng tên
  riêng, thương hiệu và viết tắt tiếng Anh; ngắt nghỉ theo cấu trúc câu.
- **1.6.x** Dịch được trên các trang video khác; sao lưu cài đặt; giới hạn tốc độ đọc; tùy chọn dùng phụ đề Việt
  có sẵn; nhận đúng video tiếng Việt và không dịch nó.
- **1.5.x** Coursera hiện phụ đề như YouTube; **bản chép lời** cạnh video và xuất `.srt`; sửa tay từng dòng; chỉnh
  cỡ chữ và âm lượng ngay trên video.

## 1.0 đến 1.4: nền móng (15/09 đến 23/09/2026)

- **1.4.x** Phím tắt, thực đơn mới trên video, giao diện Sáng / Tối, mục Lịch sử phiên bản trong Cài đặt, VieNeu luôn sẵn sàng.
- **1.3.x** **Không rút gọn lời thoại** (1.3.1): người nói nhanh thì giọng đọc nhanh hơn, nội dung không bị cắt.
- **1.2.x** Giọng Việt chạy trên máy (VieNeu-TTS) thay cho giọng trả phí; nhịp nói đều hơn.
- **1.1.x** Phân đoạn và ngắt dòng theo tiếng Việt; engine dịch hiểu ngữ cảnh; lồng tiếng AI lần đầu;
  tối ưu chi phí và độ tin cậy khi gọi API.
- **1.0.x** Bản gốc, dịch phụ đề Coursera và YouTube bằng Gemini.
