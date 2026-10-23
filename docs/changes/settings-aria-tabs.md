# Settings tabs usable by keyboard and screen reader (lane C)

Changed `options.html`, `options.js`, `tests/ui.test.js`. No version bump (release thread bumps).

Vietnamese line for the version history:
"Các nhóm trong trang Cài đặt nay là thanh tab đúng chuẩn: dùng phím mũi tên trái, phải, Home, End để đổi nhóm, nhấn Tab một lần là vào thẳng nội dung. Trình đọc màn hình đọc được nhóm đang chọn. Ô chọn màu chữ tùy ý và ô chọn tệp sao lưu có tên đọc được; khung xem trước giả lập thanh điều khiển YouTube không còn bị đọc như nút thật."

Handoff note: nav is a WAI-ARIA tablist (roles, aria-selected, roving tabindex, arrow/Home/End in `options.js`).
