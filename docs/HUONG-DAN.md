# Hướng dẫn sử dụng

Dành cho người dùng, không cần biết lập trình. Muốn xem tiện ích đổi gì qua từng bản, đọc
[CHANGELOG.md](CHANGELOG.md). Muốn biết tiện ích làm việc bên trong ra sao, đọc [MAP.md](MAP.md).

**Mục lục**
1. [Cài đặt trong 5 phút](#1-cài-đặt-trong-5-phút)
2. [Lấy khóa Gemini API](#2-lấy-khóa-gemini-api)
3. [Dịch phụ đề](#3-dịch-phụ-đề)
4. [Lồng tiếng Việt với VieNeu](#4-lồng-tiếng-việt-với-vieneu)
5. [Coursera và các trang video khác](#5-coursera-và-các-trang-video-khác)
6. [Chi phí](#6-chi-phí)
7. [Cài đặt hay dùng](#7-cài-đặt-hay-dùng)
8. [Xử lý sự cố](#8-xử-lý-sự-cố)
9. [Câu hỏi thường gặp](#9-câu-hỏi-thường-gặp)

---

## 1. Cài đặt trong 5 phút

Hai cách. Chọn cách 1 nếu bạn muốn có cả giọng lồng tiếng.

| | Cách 1: một lệnh | Cách 2: từ mã nguồn |
|---|---|---|
| Cài tiện ích | Có | Có |
| Cài giọng VieNeu và cho tự chạy cùng máy | Có | Tự làm (xem [README](../README.md#bật-giọng-vieneu-bằng-tay-cách-2)) |
| Tự cập nhật | Có | Tự chạy `git pull` |
| Hợp với | Người dùng thường | Người phát triển |

**Cách 1 (Mac, Terminal):**

```bash
curl -fsSL https://raw.githubusercontent.com/mrthanhduy2000/vietnamese-subtitle-translator/share/install-mac.sh | bash
```

**Cách 1 (Windows, PowerShell):**

```powershell
irm https://raw.githubusercontent.com/mrthanhduy2000/vietnamese-subtitle-translator/share/install-windows.ps1 | iex
```

Xong, trình duyệt tự mở một trang hướng dẫn. Còn đúng một việc bạn phải làm tay, vì trình duyệt
không cho chương trình nào tự bật tiện ích ngoài cửa hàng:

1. Mở trang tiện ích: `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`;
   trình khác thì gõ `tên-trình://extensions`).
2. Bật **Chế độ dành cho nhà phát triển** (Developer mode) ở góc trên bên phải.
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục tiện ích mà trang hướng dẫn chỉ.

Sau đó bấm biểu tượng mảnh ghép trên thanh công cụ và **ghim** tiện ích để luôn thấy nó.

Tiện ích chạy trên mọi trình duyệt nhân Chromium (Chrome, Cốc Cốc, Edge, Brave, Opera, Vivaldi, Arc).
Không chạy trên Firefox và Safari.

> **Quan trọng:** khi cần cập nhật hay sửa lỗi, luôn bấm nút **Tải lại** (mũi tên vòng) của tiện ích
> ở trang tiện ích. **Đừng gỡ rồi cài lại**: trình duyệt sẽ xóa kho cài đặt và bạn mất khóa API cùng
> mọi cài đặt lồng tiếng.

### Cập nhật lên bản mới nhất

Số phiên bản hiện tại nằm ở trang **Cài đặt** của tiện ích (hoặc `manifest.json`). Nếu thấy cũ hơn bản
mới nhất, cập nhật theo cách bạn đã cài:

- **Cách 1 (một lệnh), Mac và Windows:** chạy lại đúng lệnh cài ở trên. Việc đó chính là cập nhật, giữ
  nguyên khóa API và cài đặt. Sau đó **đóng hẳn trình duyệt rồi mở lại** (hoặc bấm **Tải lại** ở trang
  tiện ích).
- **Cách 2, Mac hoặc Windows có git:** trong thư mục tiện ích chạy `git pull`, rồi bấm **Tải lại**.
- **Cách 2 không dùng git:** vào trang **Releases** của kho mã, tải file `vietnamese-subtitle-translator-vX.Y.Z.zip`
  của bản mới nhất, giải nén **đè lên đúng thư mục đã Tải tiện ích đã giải nén** (đừng chọn thư mục khác,
  trình duyệt gắn cài đặt với đường dẫn), rồi bấm **Tải lại**.

Nhờ AI cài hộ trên Windows? Bảo nó dùng lệnh `irm ... | iex` ở Cách 1, không tự tải zip, và sau khi xong
đọc lại `version` trong `manifest.json` để đối chiếu với bản mới nhất.

## 2. Lấy khóa Gemini API

Khóa là "chìa" để tiện ích nhờ Gemini (AI của Google) dịch giúp bạn. Dùng thử miễn phí được; chi tiêu
thực tế xem mục [Chi phí](#6-chi-phí).

1. Vào [Google AI Studio](https://aistudio.google.com/apikey) và đăng nhập tài khoản Google.
2. Bấm **Create API key** (Tạo khóa API). Chọn một dự án hoặc để Google tạo dự án mới.
3. Sao chép chuỗi khóa (bắt đầu bằng `AIza...`).
4. Mở **Cài đặt** của tiện ích (lần cài đầu tự mở), thẻ **Gemini AI**, dán khóa vào ô khóa, bấm
   **Kiểm tra API Key**. Báo hợp lệ là xong.
5. Để mục model ở **Tự động**. Khóa mới của Google không gọi được một số model cũ (báo lỗi 404);
   "Tự động" sẽ tự dò model khóa của bạn dùng được.

Không có khóa thì sao? Tiện ích vẫn dịch bằng Google Dịch (miễn phí), chỉ kém hơn ở ngữ cảnh và thuật ngữ.

Khóa nằm trong kho cài đặt của trình duyệt trên máy bạn và chỉ dùng để gọi Gemini. **Đừng gửi khóa cho
ai, đừng dán vào ảnh chụp màn hình.** Lộ khóa thì vào AI Studio xóa khóa đó và tạo khóa mới.

## 3. Dịch phụ đề

**YouTube**
1. Mở video. Tiện ích thêm một nút vào thanh điều khiển của video (cạnh nút cài đặt).
2. Bấm nút đó, hoặc biểu tượng tiện ích trên thanh công cụ rồi **Bắt đầu dịch**.
3. Vài giây sau, phụ đề tiếng Việt hiện ở dưới video. Đoạn nào chưa dịch xong sẽ hiện tiếng Anh trước
   rồi được thay.

**Thực đơn nhanh trên video** (bấm nút của tiện ích trên thanh điều khiển): bật/tắt lồng tiếng, chỉnh
cỡ chữ, chỉnh âm lượng giọng đọc, mở **bản chép lời**.

**Bản chép lời**: danh sách toàn bộ lời thoại cạnh video, bấm vào một dòng để tua tới đó. Bạn có thể
**sửa tay từng dòng** (bản sửa được nhớ cho lần xem sau, và giọng lồng tiếng sẽ đọc đúng câu bạn đã sửa)
và **xuất tệp `.srt`**.

**Một số điểm đáng biết**
- Bật **Song ngữ** trong bảng điều khiển để hiện thêm dòng gốc, tiện học ngoại ngữ. Công tắc
  **Tiếng Anh ở trên** đảo thứ tự hai dòng.
- Video đã có phụ đề tiếng Việt thì tiện ích dùng luôn, không tốn phí. Tắt được trong Cài đặt nếu bạn
  muốn bản dịch của AI.
- Video nói tiếng Việt thì tiện ích không dịch gì.
- Tên sản phẩm, viết tắt (ví dụ API, GPU, tên công ty) được giữ nguyên tiếng Anh nhờ từ điển thuật ngữ.
  Muốn thêm từ riêng: Cài đặt > **Thuật ngữ**. Mỗi dòng một từ để giữ nguyên, hoặc quy tắc
  `từ gốc => bản dịch`.

**Phím tắt** (đổi tại `chrome://extensions/shortcuts`)

| Phím | Việc |
|---|---|
| `Alt+S` | Bật/tắt phụ đề |
| `Alt+D` | Bật/tắt lồng tiếng |
| `Alt+Shift+V` | Mở bảng điều khiển |

## 4. Lồng tiếng Việt với VieNeu

Tiện ích đọc bản dịch bằng giọng Việt và tự hạ nhỏ tiếng gốc khi giọng Việt đang đọc.

**Điều kiện:** máy chủ giọng VieNeu phải đang chạy trên chính máy bạn. Cài bằng cách 1 ở trên thì nó đã
tự chạy cùng máy. Kiểm tra:

```bash
curl 127.0.0.1:8000/health
```

Có trả lời là máy chủ đang chạy. Không trả lời thì khởi động lại theo mục Lồng tiếng trong Cài đặt (nó chỉ
đúng lệnh cho máy bạn). Máy chủ chưa chạy thì tiện ích báo một lần rồi tự chờ, máy chủ lên là bắt đầu đọc.

**Cách dùng**
1. Bật **Lồng tiếng Việt** trong bảng điều khiển, hoặc `Alt+D`.
2. Chọn giọng và chỉnh tốc độ ở Cài đặt > **Lồng tiếng Việt** (có 25 giọng theo vùng miền, mặc định
   Mỹ Duyên) và **Âm lượng và tốc độ**.

**Cách tiện ích khớp lời với hình**
- Giọng đọc khớp theo thời gian của phụ đề bằng tốc độ đọc và khoảng nghỉ.
- **Không bao giờ cắt ngắn lời.** Người nói nhanh thì giọng đọc nhanh hơn (có mức tối đa bạn đặt trong
  Cài đặt), chứ nội dung không bị lược bớt.
- Nhiều người nói: mỗi người một giọng (tối đa 8). Video chỉ có một người nói thì giữ một giọng. Nếu
  không thích, chọn **Một giọng cho cả video** ở Cài đặt > Lồng tiếng > **Giọng theo người nói**.
  Dòng trên nhãn như "Lồng tiếng: 3 giọng theo người nói" nghĩa là đã nhận ra 3 người.
- Số, ký hiệu, tên riêng, thương hiệu và từ viết tắt tiếng Anh được đọc theo kiểu hợp lý, không đọc
  chú thích âm thanh như "(Vỗ tay)" hay "[Nhạc]".
- Audio đã tạo được lưu lại trên máy: xem lại video không phải tạo lại. Có nút xóa kho này ở Cài đặt.

**Trình duyệt không phát tiếng?** Trình duyệt chặn âm thanh tự phát cho tới khi bạn bấm vào trang ít nhất
một lần. Bấm vào video rồi thử lại.

## 5. Coursera và các trang video khác

**Coursera**: mở bài học, tiện ích hiện phụ đề như YouTube và có nút riêng trên thanh điều khiển. Dịch
xong, cả bài được lưu trên máy: mở lại bài đó phụ đề hiện ngay và **không tốn lượt gọi Gemini**. Bài
chỉ được dịch lại khi phụ đề gốc của bài đổi. Máy giữ 200 bài gần nhất.

**Trang video khác** (ví dụ trang khóa học tự làm, trang tin có video): chỉ dịch được khi trình phát
có phụ đề dạng text track, và bạn phải bấm **Dịch** trong bảng điều khiển mỗi lần mở trang.

**Chưa hỗ trợ:** trình phát nằm trong khung nhúng từ tên miền khác (Vimeo nhúng, edX) và trang tự vẽ
phụ đề mà không dùng text track (Udemy).

## 6. Chi phí

Xem **Cài đặt > Chi phí Gemini (ước tính)**: có thể xem theo ngày, tuần, tháng, và video tốn nhiều nhất.
Đây là **ước tính** của tiện ích, số chính xác nằm trong trang thanh toán của Google.

Cách giữ chi phí thấp:

| Cách | Hiệu quả |
|---|---|
| Chế độ **Cân bằng** (mặc định) | Cân giữa chất lượng và tiền |
| Chế độ **Tiết kiệm** | Dùng model rẻ hơn, ngữ cảnh gọn hơn |
| Chế độ **Chỉ phụ đề** | Không làm việc nào ngoài dịch |
| Đặt **ngân sách theo ngày và theo video** | Hết ngân sách thì chuyển sang Google Dịch miễn phí |
| Coursera và video đã dịch | Mở lại không tốn thêm |
| Video có sẵn phụ đề Việt | Dùng luôn, không gọi Gemini |

Giọng đọc VieNeu chạy trên máy bạn nên **miễn phí**. Nhận ra người nói bằng Gemini (chỉ YouTube, chỉ khi
phụ đề không ghi tên) tốn khoảng vài chục đồng mỗi video 10 phút.

Cài đặt cho phép hiện tiền theo VNĐ, USD hoặc cả hai.

## 7. Cài đặt hay dùng

Mở trang Cài đặt từ bảng điều khiển (bấm biểu tượng tiện ích trên thanh công cụ), hoặc từ trang tiện ích của trình duyệt.

| Muốn | Vào |
|---|---|
| Chữ phụ đề to hơn, đậm hơn, đổi màu nền | **Chữ**, **Vị trí và nền** |
| Chỉ hiện tiếng Việt, hoặc song ngữ | Bảng điều khiển > **Song ngữ** |
| Đưa phụ đề lên đầu video | **Vị trí và nền** > Dưới / Trên |
| Giọng đọc chậm lại, nhanh lên | **Âm lượng và tốc độ** |
| Đổi giọng | **Lồng tiếng Việt** |
| Thêm từ giữ nguyên hoặc quy tắc dịch riêng | **Thuật ngữ** |
| Đặt ngân sách | **Chi phí Gemini** |
| Xóa bản dịch hoặc audio đã lưu | **Bộ nhớ đệm** |
| Chuyển sang máy mới | **Sao lưu** (xuất tệp, rồi nhập ở máy mới) |
| Giao diện Sáng / Tối | Trang Cài đặt hoặc bảng điều khiển |
| Xem bản này khác bản trước ra sao | **Lịch sử phiên bản** |

Mẹo: hãy **sao lưu** trước khi làm gì lớn. Sao lưu chứa khóa API, nên giữ tệp đó như giữ mật khẩu.

## 8. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Không thấy nút của tiện ích trên video | Trang mở trước khi cài, hoặc tiện ích vừa cập nhật | Tải lại trang video (F5) |
| Sau khi cập nhật, trang video chạy bản cũ | Trang chưa nạp bản mới | Bấm **Tải lại** ở trang tiện ích, rồi F5 trang video |
| "Không đọc được nội dung phụ đề" (YouTube) | YouTube chưa trả phụ đề | F5 trang video. Vẫn lỗi thì thử video khác để biết có phải riêng video này không |
| Video không có phụ đề | Video thật sự không có | Tiện ích thử đến 4 phụ đề khác; nếu vẫn trống thì video đó không dịch được |
| Phụ đề không hiện, báo lỗi khóa | Khóa sai, hết hạn hoặc bị xóa | Cài đặt > Gemini AI > **Kiểm tra API Key**; nếu cần, tạo khóa mới |
| Báo lỗi 404 về model | Đã chọn model mà khóa của bạn không dùng được | Đặt model về **Tự động** |
| Báo hết hạn mức hoặc 429 | Khóa miễn phí có giới hạn số lượt mỗi phút/ngày | Chờ một lúc rồi thử lại. Tiện ích tự thử lại và có thể chuyển sang Google Dịch |
| Có phụ đề nhưng không có giọng | Máy chủ VieNeu chưa chạy | Chạy `curl 127.0.0.1:8000/health`. Không trả lời thì khởi động VieNeu |
| Có giọng nhưng không nghe tiếng | Trình duyệt chặn âm thanh tự phát, hoặc video đang tắt tiếng | Bấm vào trang video một lần, kiểm tra âm lượng giọng đọc trong thực đơn |
| Giọng đọc trễ so với hình | Máy chủ giọng chậm (máy yếu, đang chạy việc nặng) | Đóng bớt ứng dụng nặng; hạ tốc độ tối đa; tiện ích tự thích ứng sau vài câu |
| Một câu bị bỏ qua khi lồng tiếng | Câu đó quá dày chữ so với thời gian phụ đề | Bình thường ở đoạn rất nhanh; tiện ích không cắt ngắn lời để chạy cho kịp |
| Quảng cáo YouTube bị đè phụ đề hay giọng | Không nên xảy ra | Tải lại tiện ích và F5 trang; nếu còn, báo lỗi kèm đường dẫn video |
| Giọng thứ hai chen vào video chỉ có một người | Nhận người nói chưa chuẩn | Tạm thời chọn **Một giọng cho cả video**; ghi lại đường dẫn video để báo lỗi |
| Tab YouTube bị treo sau khi tải lại tiện ích | Tab còn giữ mã cũ | F5 trang video |
| Mất khóa API và cài đặt | Đã gỡ tiện ích rồi cài lại | Nhập lại khóa; nếu có tệp sao lưu, nhập ở mục **Sao lưu** |

**Báo lỗi sao cho nhanh được sửa:** gửi (1) đường dẫn video, (2) phiên bản tiện ích (Cài đặt > Lịch sử
phiên bản, dòng trên cùng), (3) ảnh chụp màn hình chỗ lỗi, (4) bạn đã thử những gì ở bảng trên. Đừng kèm
khóa API.

## 9. Câu hỏi thường gặp

**Tiện ích có miễn phí không?** Bản thân tiện ích và giọng VieNeu miễn phí. Chỉ phần dịch bằng Gemini
tính phí theo khóa của bạn (có hạn mức miễn phí của Google tùy thời điểm), và có thể giữ ở mức 0 nếu
bạn dùng Google Dịch.

**Dữ liệu của tôi đi đâu?** Lời phụ đề được gửi tới Gemini (Google) bằng khóa của bạn, hoặc tới Google
Dịch khi tắt AI hay Gemini lỗi. Giọng đọc chạy hoàn toàn trên máy bạn, máy chủ giọng chỉ mở ở
`127.0.0.1`. Khóa chỉ dùng để gọi Gemini.

**Vì sao không có trên Chrome Web Store?** Hiện chỉ phát hành qua kho mã nguồn, nên bật tiện ích cần chế độ
nhà phát triển.

**Lồng tiếng chạy được trên điện thoại không?** Không. Cần trình duyệt máy tính và máy chủ VieNeu trên
cùng máy.

**Vì sao câu lồng tiếng dài hơn câu gốc mà không bị cắt?** Đó là chủ ý: tiện ích không bao giờ rút gọn
lời người nói. Nó tăng tốc đọc và rút ngắn khoảng nghỉ trong giới hạn bạn đặt.

**Tôi muốn dịch cả video tiếng Việt sang ngôn ngữ khác?** Tiện ích chỉ dịch sang tiếng Việt.

**Cập nhật bản mới thế nào?** Cách 1: tự cập nhật. Cách 2: `git pull` rồi bấm **Tải lại** ở trang tiện ích.
