// Lịch sử phiên bản: MỘT nguồn duy nhất cho mục "Lịch sử phiên bản" trong trang Cài đặt.
// Mỗi mục: v (số phiên bản), luc (thời điểm cập nhật, để trống nếu không ghi lại được),
// ten (tên bản), y (những việc đã làm), bang (bảng so sánh Trước / Nay, nếu có số đo thật).
(function (root) {
    const HISTORY = [
        {
            v: "1.4.5", luc: "10:55 23/09/2026", ten: "Sửa lỗi máy chủ giọng chạy chậm gấp 5 lần; tiện ích tự đo tốc độ",
            y: [
                "Tệp cài dịch vụ tự khởi động (bản 1.4.2) đặt mức ưu tiên Nền, làm macOS đẩy máy chủ giọng sang lõi tiết kiệm điện: tạo 1 giây lời nói mất 1,07 giây thay vì khoảng 0,23. Nay đặt mức Tương tác.",
                "Tiện ích tự đo tốc độ tạo giọng của 5 lượt gần nhất và hiện trong Cài đặt; quá chậm thì báo ngay trên video thay vì để bạn đoán vì sao giọng trễ.",
                "Bài kiểm tra chạy thật nay BÁO HỎNG khi máy chủ chậm, và khi không câu nào được đọc (trước đó vẫn in ĐẠT).",
                "Thêm công cụ đo nhanh: node tools/vieneu-bench.js"
            ],
            bang: { cot: ["Đo thật trên MacBook Air M3", "Mức ưu tiên Nền (1.4.2)", "Mức Tương tác (1.4.5)"], hang: [
                ["Tạo 1 giây lời nói mất", "1,07 giây", "cần đo lại sau khi cài lại"],
                ["Ba đoạn đầu có audio sau", "10,3 giây", "cần đo lại sau khi cài lại"]
            ] }
        },
        {
            v: "1.4.4", luc: "01:40 23/09/2026", ten: "Bỏ tin nhắn thừa trong bảng điều khiển; tài liệu hết ghi cứng số phiên bản",
            y: [
                "Bảng điều khiển từng gửi cho trang một tin nhắn (setOptions) mà không file nào xử lý; bật tắt lồng tiếng vốn đã đi qua kho cài đặt nên tin nhắn đó là thừa.",
                "Thêm bài kiểm tra: mọi tin nhắn bảng điều khiển gửi cho trang đều phải có nơi xử lý.",
                "Tài liệu nội bộ không còn ghi cứng số phiên bản (trước ghi 1.4.0 trong khi thật là 1.4.3), nay trỏ về manifest.json."
            ]
        },
        {
            v: "1.4.3", luc: "01:28 23/09/2026", ten: "Mục Lịch sử phiên bản trong Cài đặt",
            y: [
                "Thêm mục Lịch sử phiên bản: đủ 35 bản từ bản gốc tới bản đang dùng, mỗi bản ghi rõ đã sửa gì.",
                "Bản nào có số đo thật thì kèm bảng so sánh trước và sau.",
                "Có ô tìm kiếm trong lịch sử (ví dụ gõ \"giọng\", \"phím tắt\").",
                "Công cụ tăng phiên bản nhắc ghi lịch sử nếu bản mới chưa có mục; có bài kiểm tra giữ cho lịch sử không lệch với phiên bản thật."
            ]
        },
        {
            v: "1.4.2", luc: "01:05 23/09/2026", ten: "VieNeu luôn sẵn sàng; giao diện Sáng / Tối",
            y: [
                "Máy chủ giọng VieNeu tự chạy cùng máy: cài một lần bằng tools/vieneu-autostart.command (dịch vụ com.damduy.vieneu, chạy khi đăng nhập, tự bật lại nếu bị tắt).",
                "Nếu lúc bật lồng tiếng mà máy chủ chưa lên: đọc tạm bằng giọng khác rồi tự chuyển về VieNeu ngay khi máy chủ sẵn sàng, không phải bấm gì.",
                "Thêm giao diện Sáng / Tối / Theo máy, chọn ở đầu trang Cài đặt, dùng chung cho cả bảng điều khiển.",
                "Khung xem thử phụ đề hiện luôn nhãn lồng tiếng như trên video thật.",
                "Thêm phím tắt Alt+Shift+V để mở bảng điều khiển.",
                "Sửa lỗi nút Cài đặt tàng hình ở giao diện sáng, và lỗi bộ theo dõi VieNeu bị xóa nhầm (giọng không bao giờ tự chuyển về)."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Máy chủ VieNeu", "tự nhấp đúp mỗi lần bật máy", "tự chạy khi đăng nhập, tự bật lại khi tắt"],
                ["Máy chủ chưa chạy", "cả video dùng giọng hệ thống", "tự đổi về VieNeu giữa chừng khi máy chủ lên"],
                ["Giao diện", "chỉ theo cài đặt của macOS", "Sáng / Tối / Theo máy, tự chọn được"]
            ] }
        },
        {
            v: "1.4.1", luc: "00:45 23/09/2026", ten: "Viết lại thực đơn trên video; bảng điều khiển biết trang đang làm gì",
            y: [
                "Mỗi dòng trong thực đơn là công tắc thật, bấm được bằng bàn phím, một màu thống nhất.",
                "Chọn giọng đọc ngay trong thực đơn, không phải mở trang Cài đặt.",
                "Thực đơn tự cập nhật trạng thái mỗi 0,7 giây và không đóng sau mỗi lần bấm.",
                "Bảng điều khiển hiện trạng thái thật của trang: đã dịch bao nhiêu đoạn, đang đọc giọng nào."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Nhãn bật/tắt", 'chữ "BẬT" trông như nút bấm, hai màu khác nhau', "công tắc thật, một màu, đọc được bằng trình đọc màn hình"],
                ["Tiến độ dịch", "không biết", '"Đã dịch 12/40 đoạn"'],
                ["Đổi giọng", "phải mở trang Cài đặt", "chọn ngay trong thực đơn"],
                ["Bàn phím", "Tab lọt ra sau lưng trình phát", "Tab chạy vòng trong thực đơn, Esc đóng"]
            ] }
        },
        {
            v: "1.4.0", luc: "00:08 23/09/2026", ten: "Phím tắt, thông báo không chặn trang, dùng được bằng bàn phím",
            y: [
                "Thêm phím tắt Alt+S (phụ đề) và Alt+D (lồng tiếng), không thêm quyền nào.",
                "Bỏ mọi hộp thoại chặn trang trên YouTube và Coursera, thay bằng thẻ thông báo nhỏ tự ẩn, có nút thao tác.",
                "Viền tiêu điểm rõ khi dùng bàn phím; tôn trọng cài đặt giảm chuyển động của hệ điều hành.",
                "Nút trên trình phát báo đúng trạng thái cho trình đọc màn hình."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Phím tắt", "không có", "Alt+S, Alt+D"],
                ["Báo lỗi", "hộp thoại chặn cả trang, video vẫn chạy nên mất lời", "thẻ nhỏ tự ẩn, có nút Mở Cài đặt / Thử lại"],
                ["Trước khi lồng tiếng", 'hỏi "Cần dịch phụ đề trước?"', "dịch luôn và báo một dòng"]
            ] }
        },
        {
            v: "1.3.9", luc: "23:51 22/09/2026", ten: "Đổi giọng đọc không còn chồng hai giọng",
            y: [
                "Đổi giọng trong Cài đặt từng làm hai bộ đọc chạy song song (giọng cũ và giọng mới chồng nhau).",
                "Nguyên nhân: trang Cài đặt lưu tất cả mục mỗi lần đổi một thứ, nên hai nơi cùng bật lại lồng tiếng.",
                "Nay mỗi lượt bật mang số thứ tự, chỉ lượt mới nhất được chạy."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Đổi giọng khi đang xem", "hai giọng đọc chồng lên nhau", "chỉ một giọng, giọng cũ tắt hẳn"]
            ] }
        },
        {
            v: "1.3.8", luc: "22:49 22/09/2026", ten: 'Không đọc "(Vỗ tay)", "(Cười)"; giao diện tối giản',
            y: [
                "Chú thích âm thanh trong phụ đề vẫn hiện trên màn hình nhưng không còn bị đọc thành lời.",
                "Bảng điều khiển bỏ phần giới thiệu, mẹo, chân trang và nút Cài đặt trùng lặp.",
                "Trang Cài đặt chỉ hiện mục thuộc lựa chọn hiện tại; nhãn lồng tiếng trên video chỉ hiện 3 giây rồi mờ.",
                "Thực đơn trên video bỏ ô không bấm được và khối thông tin kỹ thuật."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["(Vỗ tay), (Cười)", "bị đọc thành lời, nghe rất giả", "không đọc, thành khoảng lặng"],
                ["Bảng điều khiển", "6 công tắc + mẹo + chân trang", "2 công tắc + nút dịch"]
            ] }
        },
        {
            v: "1.3.7", luc: "22:39 22/09/2026", ten: "Câu đầu video không mất chữ",
            y: [
                "YouTube tự phát 0,2 đến 0,4 giây trước khi tiện ích kịp tạm dừng để chuẩn bị, nên câu đầu mất vài chữ.",
                "Nay hết thời gian chờ mà video còn ở dưới 1,5 giây thì quay về 0 rồi mới phát."
            ]
        },
        {
            v: "1.3.6", luc: "22:36 22/09/2026", ten: "Hết treo tab YouTube khi Tải lại tiện ích",
            y: [
                "Tải lại tiện ích khi đang mở video làm tab treo cứng (đo thật 330% CPU): mã cũ và mã mới xóa nút của nhau rồi tự tạo lại, lặp vô tận.",
                "Nay phần tử của thế hệ mã cũ chỉ bị ẩn, không bị xóa. Có bài kiểm tra giả lập hai thế hệ mã trong một tab."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Tải lại tiện ích khi đang xem", "tab treo cứng, phải đóng tab", "không treo, mã mới tiếp quản"]
            ] }
        },
        {
            v: "1.3.5", luc: "22:25 22/09/2026", ten: "Ghi chép chẩn đoán lúc bắt đầu phát",
            y: ["Thêm ghi chép trạng thái (chỉ bật khi đo, không gửi đi đâu) để tìm nguyên nhân giọng vào trễ."]
        },
        {
            v: "1.3.4", luc: "22:19 22/09/2026", ten: "Xóa audio đã lưu của riêng một video",
            y: [
                "Thêm nút trong bảng điều khiển để xóa audio lồng tiếng của đúng video đang mở rồi tạo lại.",
                "Audio các video khác và bản dịch đã lưu giữ nguyên."
            ]
        },
        {
            v: "1.3.3", luc: "19:46 22/09/2026", ten: "Không nghỉ giữa câu; gộp đoạn quá ngắn",
            y: [
                "Đang đọc sớm hơn phụ đề thì được chậm lại nhanh hơn để lấp khung.",
                "Đoạn từ 2 âm tiết trở xuống mà câu còn tiếp được gộp vào đoạn sau, không tạo audio lẻ loi."
            ]
        },
        {
            v: "1.3.2", luc: "19:39 22/09/2026", ten: "Giọng không chạy trước phụ đề, không bỏ đoạn ngắn",
            y: [
                "Đo thật video TED: giọng đọc trước phụ đề tới 2 giây do độ sớm cộng dồn qua chuỗi đoạn.",
                "Sửa thêm lỗi có sẵn: đoạn đầu rất ngắn (audio dưới 0,8 giây) sau khi mở video hoặc tua bị bỏ, không đọc."
            ],
            bang: { cot: ["Chỉ số (video TED, 70 giây đầu)", "1.3.1", "1.3.2"], hang: [
                ["Đọc sớm hơn phụ đề, tối đa", "2,00 giây", "0,80 giây"],
                ["Số đoạn sớm hơn 0,8 giây", "7/25", "0/27"],
                ["Bỏ câu / lỗi", "0 / 0", "0 / 0"]
            ] }
        },
        {
            v: "1.3.1", luc: "15:39 22/09/2026", ten: "KHÔNG rút gọn lời thoại (giữ đủ nội dung người nói)",
            y: [
                "Bỏ hẳn việc rút gọn câu: bản 1.2.9 và 1.3.0 có thể cắt tới khoảng 40% chữ với người nói nhanh.",
                "Người nói nhanh nay được xử lý bằng khoảng nghỉ ngắn hơn trong câu (0,15 giây) và tốc độ tối đa 1,4x khi đang trễ.",
                "Đánh đổi: với người nói rất nhanh, giọng Việt sẽ trễ hơn thay vì mất nội dung."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Câu dài hơn khung", "rút gọn chữ, mất nội dung", "giữ nguyên chữ, đọc nhanh hơn và bớt khoảng nghỉ"],
                ["Mô phỏng câu cần 1,35x", "có câu bị cắt", "14/14 câu nguyên vẹn, trễ dưới 2 giây"]
            ] }
        },
        {
            v: "1.3.0", luc: "22/09/2026", ten: "Chờ chuẩn bị 5 giây; người nói rất nhanh không làm trễ dồn",
            y: [
                "Nâng thời gian chờ chuẩn bị từ 3,5 lên 5 giây.",
                "Phát hiện bước rút gọn của 1.2.9 chưa bao giờ chạy vì ước độ dài theo tốc độ mục tiêu thay vì tốc độ thật của giọng."
            ],
            bang: { cot: ["Mô phỏng người nói rất nhanh", "1.2.9", "1.3.0"], hang: [
                ["Trễ tối đa", "4,4 giây", "0 giây"],
                ["Câu bị bỏ", "có", "0"]
            ] }
        },
        {
            v: "1.2.9", luc: "22/09/2026", ten: "Người nói nhanh không làm giọng Việt trễ dần",
            y: [
                "Đo thật: 25 giây đầu giọng Việt chạy hết tốc độ 1,3x mà vẫn trễ dần tới 1,3 giây.",
                "Thêm bước rút gọn nhẹ không chặn cho câu dài hơn khung (về sau bị bỏ hẳn ở 1.3.1 theo yêu cầu giữ đủ nội dung)."
            ]
        },
        {
            v: "1.2.8", luc: "22/09/2026", ten: "Đo thật bản 1.2.7; dịch nhanh hơn sau khi tua",
            y: [
                "Nhóm phụ đề sắp phát (8 giây tới) được dịch thành lượt nhỏ, dịch khẩn cả khi vị trí rơi vào khoảng lặng."
            ],
            bang: { cot: ["Đo thật (video mới 9SCixFSvTNY)", "Kết quả"], hang: [
                ["Chờ chuẩn bị khi mở video", "3,3 giây, có giọng ngay từ câu đầu"],
                ["Tua tới phút 7", "chờ 3,2 giây, khoảng hở trong cùng câu 0 đến 0,19 giây (trước 1,5 đến 3 giây)"]
            ] }
        },
        {
            v: "1.2.7", luc: "22/09/2026", ten: "Đọc liền mạch tới dấu câu; chờ chuẩn bị 3,5 giây",
            y: [
                "Đoạn đọc cắt ngay sau dấu câu thay vì cắt ở ranh giới khung phụ đề (thường giữa một vế câu).",
                "Thêm tính năng chờ chuẩn bị: tạm dừng video tối đa 3,5 giây để tải phụ đề, dịch và tạo giọng cho đoạn đầu.",
                "Cửa sổ Chrome bị che: đoạn sau bắt đầu theo sự kiện của audio và video, không hụt tiếng tới 1 giây nữa."
            ]
        },
        {
            v: "1.2.6", luc: "22/09/2026", ten: "Lồng tiếng mặc định bật; tab đang mở tự nhận bản mới",
            y: [
                'Sửa lỗi "mất luôn VieNeu, không thấy phụ đề": kho cài đặt bị Chrome tạo lại làm mất lựa chọn lồng tiếng.',
                "Tải lại tiện ích: service worker tự nạp lại đủ mã vào tab đang mở, không cần F5.",
                "Bỏ 2 lượt làm nóng giọng; đoạn đọc quanh chỗ bắt đầu xem cắt ngắn khoảng 3,5 giây."
            ],
            bang: { cot: ["Mô phỏng video phụ đề tự động", "Trước", "Nay"], hang: [
                ["Tiếng đầu tiên kể từ khi có bản dịch", "1,65 giây", "0,90 giây"]
            ] }
        },
        {
            v: "1.2.5", luc: "22/09/2026", ten: "Số phiên bản đúng quy tắc; vào giữa video có tiếng ngay",
            y: [
                "Sửa cách đánh số: mỗi lần +0.0.1, tới 9 thì lên bậc. Các bản ghi nhầm 1.1.10 đến 1.1.14 đổi thành 1.2.0 đến 1.2.4.",
                "Thêm giờ cập nhật bên cạnh số phiên bản trong Cài đặt và công cụ tools/bump-version.js.",
                "Sửa lỗi vào giữa một đoạn đọc bị bỏ cả đoạn; VieNeu luôn tạo sẵn audio ít nhất 20 giây phía trước."
            ]
        },
        {
            v: "1.2.4", luc: "22/09/2026", ten: "Có tiếng ngay với phụ đề tự động",
            y: [
                "Phụ đề tự động (không dấu câu) từng làm cả nhóm 20 đến 30 giây thành một đoạn đọc, audio xong thì video đã trôi qua.",
                "Đoạn đọc nay tối đa khoảng 8 giây, cắt ở ranh giới dòng và ưu tiên sau dấu câu."
            ],
            bang: { cot: ["Đo thật (DwWu9ZKCSzU, mở ở phút 6)", "Trước", "Nay"], hang: [
                ["Thời gian có giọng Việt", "25 giây vẫn chưa có", "4,4 giây"]
            ] }
        },
        {
            v: "1.2.3", luc: "22/09/2026", ten: "Giọng Việt không còn mất từng quãng",
            y: [
                "Tìm ra nguyên nhân giọng im khoảng 15 giây: bước rút gọn câu bằng Gemini chặn việc tạo audio tới 16 giây.",
                "Giọng mặc định đổi thành VieNeu trên máy; bỏ khối Model VieNeu trong Cài đặt.",
                "Dịch lỗi tạm thời được thử lại sau 2, 4, 8 giây thay vì chờ cố định 15 giây."
            ],
            bang: { cot: ["Đo thật với máy chủ VieNeu", "Kết quả"], hang: [
                ["Tiếng đầu tiên kể từ khi bật", "2,8 giây"],
                ["Số câu đọc được", "22/22, mỗi câu tạo audio đúng 1 lần"]
            ] }
        },
        {
            v: "1.2.2", luc: "22/09/2026", ten: "Sửa lỗi phụ đề rỗng; tự bật lồng tiếng",
            y: [
                'Sửa lỗi "tải được phụ đề nhưng không đọc được nội dung": từ 09/2026 YouTube trả phụ đề rỗng nếu thiếu mã xác thực của trình phát. Thêm cầu nối yt-bridge.js.',
                "Ghi nhớ lựa chọn lồng tiếng để video sau tự bật.",
                "Vá máy chủ VieNeu: bản gốc giữ luồng duy nhất mãi mãi khi phía gọi ngắt giữa chừng, làm các câu sau bị bỏ."
            ],
            bang: { cot: ["Đo thật (bài giảng 22 câu)", "Kết quả"], hang: [
                ["Câu đọc được / bỏ", "22/22 / bỏ 0"],
                ["Trễ tối đa", "1,15 giây"]
            ] }
        },
        {
            v: "1.2.1", luc: "21/09/2026", ten: "Nhịp nói đều; chất lượng giọng VieNeu",
            y: [
                "Giọng mặc định: Mỹ Duyên (chính) và Thái Sơn (thứ hai).",
                "Giọng chậm được tăng tốc đều cho cả video, giữ cao độ; rút khoảng lặng dài trong câu.",
                "Nhiệt độ lấy mẫu 0,6 để độ dài câu ổn định hơn."
            ],
            bang: { cot: ["Đo thật (bài giảng 22 câu, Mỹ Duyên)", "1.2.0", "1.2.1"], hang: [
                ["Độ lệch chuẩn tốc độ giữa các câu", "0,044", "0,006"],
                ["Bước nhảy tốc độ lớn nhất", "0,15", "0,018"],
                ["Trễ so với phụ đề, tối đa", "0,8 giây", "0,3 giây"],
                ["Tốc độ nghe", "khoảng 3,7 âm tiết/giây", "khoảng 4,5 âm tiết/giây"]
            ] }
        },
        {
            v: "1.2.0", luc: "20/09/2026", ten: "Giọng Việt chạy trên máy (VieNeu-TTS)",
            y: [
                "Thêm nguồn giọng miễn phí chạy ngay trên máy, không gửi lời thoại ra ngoài.",
                "25 giọng theo vùng, chọn trong Cài đặt.",
                'Chế độ "Tự động": VieNeu nếu đang chạy, rồi Gemini AI, rồi giọng hệ thống.'
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Chi phí lồng tiếng", "tính tiền theo phút audio Gemini", "0 đồng với giọng VieNeu"],
                ["Đo trên MacBook Air M3", "", "tạo 5 giây lời nói trong khoảng 1,1 giây"]
            ] }
        },
        {
            v: "1.1.9", luc: "19/09/2026", ten: "Giao diện Cài đặt mới; lồng tiếng nhanh hơn",
            y: [
                "Trang Cài đặt thiết kế lại, tự đổi sáng tối theo máy.",
                "Coursera áp dụng vị trí và lề phụ đề; YouTube có tùy chọn luôn giữ sát lề đã chọn.",
                "Bảng điều khiển hiện chi phí ước tính hôm nay.",
                "Lượt tạo giọng đầu tiên chỉ một câu ngắn để có tiếng sớm nhất."
            ]
        },
        {
            v: "1.1.8", luc: "19/09/2026", ten: "Kiểu phụ đề mặc định; vị trí ổn định",
            y: [
                "Sửa lỗi phụ đề YouTube nhảy lên cao 64 px mỗi khi thanh điều khiển hiện ra.",
                "Sửa lỗi phụ đề kẹt ở vị trí cao sau khi tắt bật dịch hoặc đổi video.",
                "Bỏ hỗ trợ DeepLearning.AI; ảnh và biểu tượng chỉ cho YouTube và Coursera đọc."
            ]
        },
        {
            v: "1.1.7", luc: "18/09/2026", ten: "Phát hiện tiện ích chưa được nạp lại",
            y: [
                "Trang Cài đặt và bảng điều khiển so phiên bản đang chạy với phiên bản trên đĩa, lệch thì hiện nút nạp lại.",
                "Nút Cài đặt trên YouTube báo lỗi rõ ràng khi trang đang dùng kết nối cũ."
            ]
        },
        {
            v: "1.1.6", luc: "18/09/2026", ten: "Hoàn thiện: model, tự động dịch, ngân sách",
            y: [
                "Sửa lỗi model 2.5 Flash-Lite trả 404 với API key mới.",
                "Sửa lỗi Chrome chặn khi mở trang Cài đặt từ YouTube.",
                "Thêm tự động dịch (nhận diện ngôn ngữ ngay trên máy, không tốn phí).",
                "Thêm ngân sách và thống kê chi phí, chỉ lưu trên máy.",
                "Lồng tiếng không bị cắt giữa câu dài."
            ]
        },
        {
            v: "1.1.5", luc: "17/09/2026", ten: "Danh mục model tập trung",
            y: [
                "Mọi tên model Gemini nằm ở một nơi duy nhất (cost-policy.js).",
                "Quyền truy cập model tính theo từng API key, ghi nhớ 3 ngày theo mã băm của key (không lưu key).",
                "Bộ nhớ đệm bản dịch tách theo model."
            ]
        },
        {
            v: "1.1.4", luc: "17/09/2026", ten: "Độ tin cậy khi gọi API",
            y: [
                "API key gửi qua header, không còn nằm trong đường dẫn.",
                "Phân loại lỗi theo tài liệu Gemini: lỗi nào thử lại, lỗi nào dừng hẳn.",
                "Audio được cắt và lưu kho trước khi trả lời, yêu cầu giống hệt nhau chỉ tạo audio một lần."
            ]
        },
        {
            v: "1.1.3", luc: "17/09/2026", ten: "Tối ưu chi phí",
            y: [
                "Bộ nhớ đệm 2 tầng cho bản dịch và audio, sống qua khởi động lại trình duyệt.",
                "4 chế độ sử dụng: Cao cấp, Cân bằng, Tiết kiệm, Chỉ phụ đề.",
                "YouTube chỉ dịch trước quanh vị trí đang xem."
            ]
        },
        {
            v: "1.1.2", luc: "16/09/2026", ten: "Lồng tiếng Việt AI",
            y: [
                "Lồng tiếng đọc theo kịch bản liền mạch dựng từ bản dịch có ngữ cảnh, không đọc từng dòng phụ đề.",
                "Lập kế hoạch ngắt nghỉ, ngữ điệu và thời lượng, khớp nhịp với người nói gốc.",
                "Đồng bộ với video: tạm dừng, tua, đổi tốc độ; hạ nhỏ tiếng gốc mượt."
            ]
        },
        {
            v: "1.1.1", luc: "16/09/2026", ten: "Engine dịch hiểu ngữ cảnh",
            y: [
                "Nhận diện lĩnh vực và giữ ngữ cảnh của cả video (tóm tắt phần trước, thuật ngữ đã thống nhất).",
                "Phát hiện dấu hiệu dịch từng chữ và tự dịch lại, chỉ nhận bản mới nếu tốt hơn.",
                "Trang Cài đặt tự lưu và áp dụng ngay."
            ]
        },
        {
            v: "1.1.0", luc: "15/09/2026", ten: "Phân đoạn và ngắt dòng theo tiếng Việt",
            y: [
                "Phụ đề tiếng Việt được cắt theo cú pháp tiếng Việt thay vì theo số ký tự của câu tiếng Anh.",
                "Thêm danh mục phông chữ có dấu tiếng Việt và kiểu viền chữ dùng chung cho mọi trang."
            ],
            bang: { cot: ["Hạng mục", "Trước", "Nay"], hang: [
                ["Cách ngắt dòng", "theo số ký tự / theo dòng tiếng Anh", "theo mệnh đề và cụm từ tiếng Việt"]
            ] }
        },
        {
            v: "1.0.0 đến 1.0.4", luc: "", ten: "Bản gốc (trước khi Đàm bắt đầu nâng cấp)",
            y: [
                "Dịch phụ đề YouTube và Coursera sang tiếng Việt bằng Google Translate.",
                "Biểu tượng bật tắt dịch ngay trên trình phát, lưu tạm bản dịch để hiện nhanh hơn.",
                "Ghi chú: bản gốc không có nhật ký thay đổi cho từng bản 1.0.1 đến 1.0.4, nên phần này dựng lại từ danh sách tính năng trong README, không phải từ lịch sử thật."
            ]
        }
    ];

    const api = { HISTORY };
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CST_HISTORY = api;
})(typeof self !== "undefined" ? self : this);
