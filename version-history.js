// Lịch sử phiên bản: MỘT nguồn duy nhất cho mục "Lịch sử phiên bản" trong trang Cài đặt.
// Mỗi mục: v (số phiên bản), luc (thời điểm cập nhật, để trống nếu không ghi lại được),
// ten (tên bản), y (những việc đã làm), bang (bảng so sánh Trước / Nay, nếu có số đo thật).
(function (root) {
    const HISTORY = [
        {
            v: "1.7.0", luc: "21:05 26/09/2026", ten: "Không chồng giọng lên bản lồng tiếng AI tiếng Việt của YouTube",
            y: [
                "Video nước ngoài mà YouTube đang phát bằng giọng lồng tiếng AI tiếng Việt: tiện ích không hiện phụ đề dịch và không lồng tiếng thêm, vì bạn đã nghe tiếng Việt, tránh hai giọng đè nhau.",
                "Thông báo nhỏ có nút \"Dùng tiếng gốc + giọng tiện ích\": bấm là trình phát chuyển về tiếng gốc, rồi tiện ích dịch phụ đề và lồng tiếng như bình thường.",
                "Đổi đường tiếng giữa chừng cũng được theo dõi: chuyển sang lồng tiếng AI tiếng Việt thì phụ đề và giọng của tiện ích tự tắt; chuyển về tiếng gốc thì tiện ích tự dịch lại (nếu đang bật Tự động dịch)."
            ]
        },
        {
            v: "1.6.9", luc: "21:00 26/09/2026", ten: "Nhận diện đúng video tiếng Việt, không phụ đề video tiếng Việt",
            y: [
                "Sửa lỗi dịch nhầm video tiếng Việt: YouTube nay tự lồng tiếng AI cho nhiều video (ví dụ bản tin tiếng Việt có thêm đường tiếng Anh tự động), kèm phụ đề tự động tiếng Anh của bản lồng tiếng đó. Tiện ích từng lấy phụ đề tiếng Anh này, tưởng video nói tiếng Anh, rồi dịch ngược sang tiếng Việt.",
                "Nay tiện ích hỏi trình phát đường tiếng nào là tiếng GỐC, bỏ qua phụ đề của bản lồng tiếng AI, và khi không có thông tin đó thì xem tiêu đề, mô tả (bỏ qua video ghi \"Vietsub\", \"thuyết minh\", \"lồng tiếng\").",
                "Video nói tiếng Việt không còn bị hiện phụ đề dịch hay lồng tiếng, kể cả bản dịch đã lưu từ trước. Nếu bạn tự bấm dịch, tiện ích báo lý do và có nút \"Vẫn dịch\"."
            ]
        },
        {
            v: "1.6.8", luc: "20:54 26/09/2026", ten: "Giọng đọc mượt, hết khựng như robot; ngắt nghỉ thông minh hơn",
            y: [
                "Tìm ra nguyên nhân giọng bị khựng như robot (đo trên Chrome thật, 2 phút lồng tiếng): tiện ích đổi tốc độ phát của giọng 510 lần trong lúc đang đọc, khoảng 21 lần mỗi câu, vì đuổi theo độ trễ vài chục mili giây lúc audio bắt đầu phát. Mỗi lần đổi, Chrome phải khởi động lại bộ co giãn giọng và tạo tiếng vấp. Nay: 0 lần, giọng vẫn khớp phụ đề.",
                "Câu có tốc độ gần tự nhiên được phát đúng 1 lần, không qua bộ co giãn, nên giọng giữ nguyên chất: 21 trên 24 câu với Thục Đoan. Mỹ Duyên (giọng chậm) vẫn được tăng tốc đều 1,07 đến 1,1 lần như trước.",
                "Ngắt nghỉ thông minh bản 2: dấu phẩy sau vế ngắn (\"Vâng,\") nghỉ rất nhẹ, sau vế dài nghỉ đủ hơi; dấu phẩy trước \"và, nhưng, còn...\" nghỉ ngắn hơn để nối ý; câu hỏi, câu cảm nghỉ lâu hơn một chút.",
                "Giảm tiếng xì nhẹ tay hơn, không còn làm cụt đuôi chữ (trước làm thay đổi 2 đến 4% phần giọng của Thục Đoan, nay gần như 0).",
                "Giọng VieNeu đọc liền mạch câu dài hơn (tối đa 11 giây một lượt thay vì 8), bớt chỗ một câu bị chia hai lượt đọc với ngữ điệu bị ngắt. Mọi giọng VieNeu (cả miền Nam, Bắc, Trung) dùng 48 kHz."
            ],
            bang: { cot: ["Đo trên Chrome thật, 120 giây", "Trước", "Nay"], hang: [
                ["Số lần đổi tốc độ giọng khi đang đọc (Thục Đoan)", "510", "0"],
                ["Câu phát đúng tốc độ gốc (Thục Đoan)", "0/24", "21/24"],
                ["Số lần đổi tốc độ khi đang đọc (Mỹ Duyên, chỉ đo sau khi sửa)", "chưa đo", "0"]
            ] }
        },
        {
            v: "1.6.7", luc: "20:22 26/09/2026", ten: "Giọng VieNeu chỉ ngừng ở dấu câu, bớt rè, bớt tiếng xì",
            y: [
                "Giọng đọc không còn ngừng giữa câu ở chỗ không có dấu câu. Trước đây có ba nguyên nhân: tiện ích tự thêm dấu phẩy ở chỗ người nói gốc ngừng, máy chủ giọng tự ngừng giữa câu, và một câu bị chia làm hai lượt đọc khi nằm ở ranh giới hai nhóm dịch. Nay chỉ dấu phẩy, dấu chấm, dấu chấm phẩy... mới tạo khoảng ngừng; câu dài không có dấu câu vẫn có một chỗ lấy hơi rất ngắn.",
                "Giọng Thục Đoan bớt rè ở đoạn đọc nhanh: tiện ích lấy âm thanh 48 kHz (tần số gốc của giọng) thay vì 24 kHz. Đo trong Chrome, cùng một câu đọc nhanh 1,4 lần, độ sạch của giọng giảm ít hơn khoảng 4 lần so với trước.",
                "Giọng Mỹ Duyên bớt tiếng xì nền giữa các từ (khoảng lặng từ -53 xuống -65 dB).",
                "Audio VieNeu đã lưu sẽ được tạo lại một lần theo cách mới (miễn phí, chỉ tốn thời gian máy chủ ở lần xem đầu)."
            ],
            bang: { cot: ["Đo trên máy", "Trước", "Nay"], hang: [
                ["Chỗ ngắt giữa câu khi nhóm dịch cắt ngang câu (22 câu mẫu)", "7", "1"],
                ["Độ sạch Thục Đoan ở 1,4 lần (10% đoạn kém nhất)", "giảm 0,087", "giảm 0,020"],
                ["Tiếng xì giữa các từ, Mỹ Duyên", "-53 dB", "-65 dB"]
            ] }
        },
        {
            v: "1.6.6", luc: "20:06 26/09/2026", ten: "Sao lưu cài đặt, giới hạn tốc độ đọc, tùy chọn dùng phụ đề Việt có sẵn",
            y: [
                "Thẻ mới \"Sao lưu cài đặt\": xuất toàn bộ cài đặt, danh sách thuật ngữ và các dòng phụ đề đã sửa ra một tệp, nhập lại bất cứ lúc nào. Có thể chọn kèm hoặc không kèm Gemini API Key. Bản dịch và audio đã lưu không nằm trong tệp (tự tạo lại được).",
                "Mục mới \"Tốc độ đọc tối đa\" trong phần Lồng tiếng: Tự động (như trước) hoặc giới hạn từ 1,1 đến 1,5 lần. Giới hạn thấp nghe rõ hơn nhưng giọng có thể trễ sau hình ở đoạn nói nhanh; không bao giờ bỏ chữ. Đổi là có hiệu lực từ câu kế tiếp.",
                "Mục mới \"Bỏ qua dịch khi video đã có phụ đề tiếng Việt\" (mặc định bật). Tắt đi thì vẫn dịch từ phụ đề gốc, dùng khi phụ đề Việt sẵn có là bản dịch máy kém. Áp dụng cho YouTube, Coursera và các trang video khác."
            ]
        },
        {
            v: "1.6.5", luc: "19:58 26/09/2026", ten: "Dịch phụ đề và lồng tiếng trên các trang video khác",
            y: [
                "Ngoài YouTube và Coursera, giờ dịch được phụ đề trên mọi trang có video dùng phụ đề chuẩn của trình duyệt (trang khoá học, blog, trang trường, trình phát video.js, Plyr...). Mở trang, bấm nút tiện ích rồi bấm Dịch, hoặc dùng phím tắt Alt+S / Alt+D.",
                "Tiện ích chỉ chạy trên trang đó khi bạn bấm, không xin quyền đọc mọi trang web.",
                "Trang không có thanh điều khiển mà tiện ích nhận ra được: nút dịch nổi ở góc trên bên phải video, phụ đề Việt nằm đúng trong khung hình. Khi xem toàn màn hình, trình duyệt tự hiện phụ đề Việt.",
                "Chưa hỗ trợ: video nằm trong khung nhúng của trang khác (ví dụ Vimeo nhúng, edX) và trang tự vẽ phụ đề riêng (ví dụ Udemy). Tiện ích sẽ báo rõ khi gặp trường hợp này."
            ]
        },
        {
            v: "1.6.4", luc: "19:37 26/09/2026", ten: "Dọn các lỗi tồn đọng; lồng tiếng và phụ đề nhẹ máy hơn",
            y: [
                "Sửa lỗi chế độ song ngữ tự tắt: bật song ngữ trong cửa sổ nhỏ rồi mở lại trang Coursera có thể quay về một ngôn ngữ, và trên YouTube tắt song ngữ trong cửa sổ nhỏ có thể không có tác dụng. Nay chỉ còn một chỗ quyết định chế độ hiển thị.",
                "Chỉ còn một cầu nối đọc phụ đề YouTube. Sau khi bấm Tải lại tiện ích, trang đang mở dùng đúng cầu nối đầy đủ (có mã xác thực của trình phát), không còn bản sao thiếu chức năng.",
                "Dựng kịch bản lồng tiếng nhanh gấp khoảng 3 lần (13 xuống 4 mili giây cho mỗi lần có câu mới), kết quả giống hệt từng đoạn trên bài giảng 60 phút.",
                "Nút trên thanh điều khiển không còn bị kiểm tra lại mỗi lần YouTube thay đổi trang (bình luận, đề xuất, trò chuyện trực tiếp), chỉ tối đa khoảng 7 lần mỗi giây.",
                "Dọn cài đặt rút gọn lời thoại vốn đã tắt: giờ chỉ còn một công tắc, luôn tắt. Lời thoại không bao giờ bị rút gọn."
            ],
            bang: { cot: ["Đo trên máy", "Trước", "Nay"], hang: [
                ["Dựng kịch bản cho 80 nhóm câu", "13,1 mili giây", "3,9 mili giây"],
                ["Tách dòng 22 câu mẫu", "2,2 mili giây", "1,8 mili giây"]
            ] }
        },
        {
            v: "1.6.3", luc: "23:06 23/09/2026", ten: "Mượt hơn với video dài; thực đơn và bản chép lời mở, đóng có chuyển động",
            y: [
                "Sửa nguyên nhân giật hình khi dịch video dài: mỗi lần thêm một nhóm câu dịch xong, bộ lồng tiếng dựng lại kịch bản cho toàn bộ video, tốn khoảng 90 mili giây (bằng 5 khung hình) với bài giảng 60 phút, và lặp lại hàng trăm lần trong lúc dịch. Nay chỉ dựng cho khoảng quanh chỗ đang xem: còn khoảng 15 mili giây, nhịp nặng nhất từ 97 xuống 16 mili giây. Kịch bản thu được giống hệt cách cũ (đã kiểm chứng từng đoạn, kể cả khi bật giọng thứ hai).",
                "Sửa rò rỉ bộ nhớ: audio của những đoạn không còn trong kịch bản trước đây không bao giờ được giải phóng.",
                "Tua tới chỗ khác thì nhịp đo tốc độ nói của video được đo lại ngay, không dùng số đo của chỗ cũ.",
                "Thực đơn trên video hiện ra mềm (mờ dần và nhích lên), bản chép lời trượt vào từ phải, cả hai mờ dần khi đóng. Phụ đề trượt mượt sang bên khi nhường chỗ. Ai bật \"giảm chuyển động\" trong hệ điều hành thì không có hiệu ứng nào.",
                "Bản chép lời không ghép lại toàn bộ lời thoại mỗi 150 mili giây nữa, chỉ khi có câu mới hoặc khi bạn sửa một dòng."
            ],
            bang: { cot: ["Bài giảng 60 phút", "Trước", "Nay"], hang: [
                ["Dựng lại kịch bản lồng tiếng mỗi lần có câu mới", "khoảng 90 mili giây", "khoảng 15 mili giây"],
                ["Nhịp xử lý nặng nhất", "97 mili giây", "16 mili giây"],
                ["Số đoạn phải lập kế hoạch", "668", "96"]
            ] }
        },
        {
            v: "1.6.2", luc: "22:57 23/09/2026", ten: "Bật/tắt giọng đọc thứ hai; đo thật: giọng Kim Thanh hết trễ ở đoạn nói nhanh",
            y: [
                "Thêm công tắc \"Dùng giọng thứ hai cho người nói khác\" trong Cài đặt, mục Lồng tiếng. Mặc định TẮT: cả video đọc bằng một giọng, không đổi giọng giữa chừng. Bật lên thì câu của người nói thứ hai (phụ đề đánh dấu >>, gạch đầu dòng hoặc TÊN:) đọc bằng giọng thứ hai, và hai ô chọn giọng thứ hai mới hiện ra.",
                "Đo trực tiếp bản 1.6.1 trên YouTube với giọng Kim Thanh, cùng đoạn dày chữ như lần trước: trễ tối đa từ 1,88 giây xuống 0,43 giây, nói lấn phụ đề từ 1,76 giây xuống 0,42 giây, tốc độ cao nhất giữ nguyên khoảng 1,4 lần, không bỏ câu nào."
            ],
            bang: { cot: ["Đo thật, đoạn dày chữ, Kim Thanh", "1.6.0", "1.6.1"], hang: [
                ["Trễ lúc bắt đầu, câu tệ nhất", "1,88 giây", "0,43 giây"],
                ["Nói lấn quá phụ đề, câu tệ nhất", "1,76 giây", "0,42 giây"],
                ["Tốc độ cao nhất", "1,40 lần", "1,41 lần"]
            ] }
        },
        {
            v: "1.6.1", luc: "22:43 23/09/2026", ten: "Giọng đọc tự thích ứng theo tốc độ nói của video, tăng tốc dần từ trước câu dày chữ",
            y: [
                "Giọng đọc nay tự đo nhịp nói của video (khoảng 90 giây phía trước): mỗi câu cần đọc nhanh bao nhiêu để vừa khung phụ đề, theo tốc độ thật của giọng bạn chọn. Video nói nhanh thì giọng giữ nhịp nhanh đều cả đoạn và được nới trần tốc độ (tối đa 1,55 lần, không bao giờ quá 5,8 âm tiết mỗi giây). Video nói chậm thì không đổi gì.",
                "Giọng biết trước câu nào sắp dày chữ và tăng tốc dần từ vài câu trước, thay vì đến sát câu đó mới dồn gấp rồi trễ. Mỗi câu vẫn chỉ nhanh hơn câu trước tối đa 0,1 nên nhịp không giật; và câu hiện tại không bao giờ kết thúc sớm quá 0,5 giây so với phụ đề của nó.",
                "Khi đang đọc nhanh theo người nói, thực đơn ghi rõ \"người nói nhanh, đọc nhanh theo\".",
                "Đo bằng mô phỏng trên dòng thời gian thật của hai video, với tốc độ thật của giọng Kim Thanh."
            ],
            bang: { cot: ["Giọng Kim Thanh, dòng thời gian thật", "Trước", "Nay"], hang: [
                ["Video nói nhanh 1: câu trễ quá 1 giây", "3", "0"],
                ["Video nói nhanh 1: trễ tối đa", "1,41 giây", "0,94 giây"],
                ["Video 2: câu trễ quá 1 giây", "5", "1"],
                ["Video 2: 90% số câu trễ dưới", "0,76 giây", "0,23 giây"],
                ["Người nói chậm: tốc độ đọc trung bình", "1,05 lần", "1,05 lần (không đổi)"]
            ] }
        },
        {
            v: "1.6.0", luc: "22:30 23/09/2026", ten: "Sửa theo lần đo trên video thật: thực đơn không che phụ đề, bản chép lời tự cuộn đúng",
            y: [
                "Đo trực tiếp trên YouTube trong Chrome của bạn, giọng Kim Thanh, nền tối. Thực đơn mở ra che mất cuối hai dòng phụ đề. Nay phụ đề tự dịch sang trái và thu hẹp lại khi thực đơn mở, giống như khi mở bản chép lời. Áp dụng cho cả Coursera.",
                "Bản chép lời không tự cuộn tới dòng đang phát (video ở 8:20 mà danh sách đứng ở 0:02). Hai lỗi chồng nhau: vị trí dòng tính lệch 112 điểm ảnh, và lệnh cuộn chỉ chạy một lần nên bị ngắt giữa chừng là kẹt luôn. Nay mỗi nhịp đều kiểm tra lại, xa thì nhảy thẳng, gần thì cuộn mượt.",
                "Không tách đôi \"gần bằng\", \"gần giống\", \"xấp xỉ\" khi ngắt dòng (gặp thật: \"cũng gần / bằng với tiền thuê nhà\").",
                "Đo giọng Kim Thanh trên đoạn dày chữ: tốc độ đọc lên tới 1,4 lần, trễ tối đa 1,9 giây rồi bắt kịp sau khoảng 10 giây, không bỏ câu nào. Kim Thanh là giọng nói chậm nhất trong 25 giọng (3,8 âm tiết mỗi giây)."
            ],
            bang: { cot: ["Đo trên video thật (8:25 đến hết, 13 câu, Kim Thanh)", "Kết quả"], hang: [
                ["Câu bị bỏ", "0"],
                ["Trễ lúc bắt đầu, đoạn thưa chữ", "tối đa 0,26 giây"],
                ["Trễ lúc bắt đầu, đoạn dày chữ", "tối đa 1,88 giây, bắt kịp sau khoảng 10 giây"],
                ["Tốc độ đọc cao nhất", "1,4 lần"]
            ] }
        },
        {
            v: "1.5.9", luc: "22:18 23/09/2026", ten: "Đo tốc độ nói của cả 25 giọng; thực đơn, bảng chép lời và bảng điều khiển gọn gàng, dễ đọc hơn",
            y: [
                "Đo thật tốc độ nói của cả 25 giọng VieNeu trên máy bạn. Trước đây chỉ 4 giọng có số đo, 21 giọng còn lại dùng chung con số ước 4,8 âm tiết mỗi giây, lệch tới 24% (giọng thật từ 3,8 đến 5,8). Nay bộ lồng tiếng chọn đúng nhịp ngay từ câu đầu với mọi giọng.",
                "Danh sách giọng ghi rõ giọng nói chậm, vừa hay nhanh, ví dụ \"Mỹ Duyên (nữ, đọc truyện, nói chậm)\": bài giảng nhiều chữ nên chọn giọng nói vừa hoặc nhanh.",
                "Thực đơn trên video chia hai phần có tiêu đề, Phụ đề và Giọng đọc, mỗi phần chỉ gồm nút của nó; khoảng cách rộng hơn, nhãn gọn hơn.",
                "Bản chép lời trình bày như một trang đọc: dòng đầu ghi số dòng, thời lượng, số dòng đã sửa; câu gốc in nghiêng như chú thích; dòng đang phát đánh dấu bằng vạch màu bên trái; khung rộng hơn nên ít xuống dòng vụn.",
                "Bảng điều khiển (bấm biểu tượng tiện ích) có thẻ Đang xem: tên video, thanh tiến độ dịch, và giọng đang đọc kèm tình trạng (đã chuẩn bị trước bao nhiêu giây, máy chủ có chậm không).",
                "Sửa ghi chú trong Cài đặt: kéo tiếng gốc về 0% là tắt hẳn (ghi chú cũ vẫn nói không tắt)."
            ],
            bang: { cot: ["Giọng VieNeu", "Trước", "Nay"], hang: [
                ["Số giọng có số đo tốc độ nói", "4 trên 25", "25 trên 25"],
                ["Sai số lớn nhất của con số ước chung", "24%", "không còn dùng con số ước"]
            ] }
        },
        {
            v: "1.5.8", luc: "22:02 23/09/2026", ten: "Giọng đọc số và ký hiệu đúng kiểu Việt, phụ đề không lặp câu, không vắt ngang câu",
            y: [
                "Giọng VieNeu đọc \"1.500.000 đồng\" thành \"một năm không không không không không\". Lỗi do chính tiện ích: bỏ dấu chấm thành 1500000, mà máy chủ giọng đọc từng chữ số với mọi số từ 7 chữ số trở lên. Nay đọc \"một triệu năm trăm nghìn\". Kiểm chứng bằng đúng bộ chuẩn hóa chữ của máy chủ VieNeu.",
                "Sửa thêm cách đọc: $20 thành \"20 đô la\" (trước là \"u s d\"), 7B và 200K thành \"7 tỷ\", \"200 nghìn\" (trước là \"bảy bê\", \"hai trăm ca\"), 1,000 kiểu Anh thành \"một nghìn\" (trước là \"một\"), 1990s thành \"những năm 1990\" (trước đọc chữ s thành \"giây\"), 1st/2nd thành \"thứ nhất, thứ hai\", Python 3.11 và v2.0 đọc bằng \"chấm\", địa chỉ web không còn đánh vần \"hát tê tê phê\", #1 thành \"số 1\", 2x thành \"2 lần\".",
                "Sửa lỗi nặng: đôi khi mô hình dịch luôn cả câu ngữ cảnh phía sau vào bản dịch của câu trước, trong khi câu sau vẫn được dịch riêng. Phụ đề hiện một ý hai lần, giọng Việt đọc hai lần và phải đọc 36 đến 51 ký tự mỗi giây. Nay tiện ích tự nhận ra phần lấn và cắt bỏ, không tốn thêm lượt gọi, áp dụng cả cho video đã dịch và lưu từ trước.",
                "Phụ đề không còn để một khung chứa đuôi câu trước dính với nửa đầu câu sau. Đo trên 2 video thật: từ 38 khung xuống 7.",
                "Bổ sung các từ ghép hay bị tách đôi khi ngắt dòng: tủ đồ, trào lưu, bày biện, bất cứ lúc nào, đồ đạc, ngăn nắp và vài từ khác."
            ],
            bang: { cot: ["Đo trên 2 video thật đã dịch (347 khung phụ đề)", "Trước", "Nay"], hang: [
                ["Khung vắt ngang hai câu", "38", "7"],
                ["Khung phải đọc nhanh hơn 25 ký tự/giây", "16", "7"],
                ["Khung phải đọc nhanh hơn 30 ký tự/giây", "8", "1"],
                ["Khung nhanh nhất", "45,5 ký tự/giây", "31 ký tự/giây"],
                ["Nội dung hiện và đọc hai lần", "257 ký tự", "0"]
            ] }
        },
        {
            v: "1.5.7", luc: "21:45 23/09/2026", ten: "Sửa tay một dòng phụ đề, giọng Việt đọc đúng câu đã sửa",
            y: [
                "Trong Bản chép lời, rê chuột vào một dòng rồi bấm biểu tượng bút chì để sửa bản dịch. Enter để lưu, Esc để hủy. Video tự tạm dừng trong lúc bạn gõ và phát tiếp khi lưu xong.",
                "Bản sửa được lưu riêng cho từng video, trên máy của bạn. Mở lại video (kể cả khi bản dịch lấy từ bộ nhớ đệm) thì bản sửa vẫn nằm trên bản dịch máy.",
                "Giọng Việt đọc đúng câu đã sửa. Chỉ câu bị sửa mới được tạo giọng lại, các câu khác giữ nguyên audio đã có.",
                "Dòng đã sửa có nhãn \"đã sửa\" màu cam, và có nút \"Dùng bản dịch máy\" để quay về bản gốc bất cứ lúc nào.",
                "Tab mới \"Phụ đề đã sửa\" trong Cài đặt: xem mọi dòng đã sửa của mọi video, bản dịch máy gạch ngang bên dưới, sửa tiếp, khôi phục từng dòng hoặc cả video. Đổi ở đây là video đang mở cập nhật ngay.",
                "Xuất .srt từ Bản chép lời nay có luôn các dòng bạn đã sửa."
            ]
        },
        {
            v: "1.5.6", luc: "19:11 23/09/2026", ten: "Chỉnh cỡ chữ và âm lượng ngay trên video, biết giọng đọc đang làm gì",
            y: [
                "Sửa lỗi: trong Cài đặt kéo \"Tiếng gốc khi đang đọc\" về 0% nhưng tiếng gốc vẫn còn 20%. Mã cũ coi số 0 là \"chưa chọn\" rồi thay bằng 20%. Nay 0% là tắt hẳn tiếng gốc đúng như bạn chọn.",
                "Sửa lỗi trên Coursera: đổi cỡ chữ, màu hay viền phụ đề trong Cài đặt phải chờ tới lần đổi kích thước khung video mới thấy. Nay áp dụng ngay. Bật tắt song ngữ từ bên ngoài cũng vẽ lại liền, không chờ câu kế.",
                "Thực đơn nhanh trên YouTube và Coursera có thêm nút chỉnh cỡ chữ phụ đề (A− / A+, mỗi lần 10%), không phải mở Cài đặt nữa.",
                "Thêm hai thanh trượt khi đang lồng tiếng: âm lượng giọng Việt và mức tiếng gốc khi đang đọc. Đổi là nghe khác ngay, không phải tạo lại giọng.",
                "Dòng Lồng tiếng Việt trong thực đơn nay nói giọng đang làm gì: đã chuẩn bị trước bao nhiêu giây, máy chủ giọng có đang chậm không (đo thật), và đã bỏ bao nhiêu câu để bắt kịp. Trước đây giọng im mà không biết vì sao.",
                "Nhãn tên giọng và thẻ \"Đang chuẩn bị phụ đề và giọng Việt…\" đổi sang cùng kiểu thẻ tối với thông báo và thực đơn, không còn là hộp đen phông mặc định."
            ],
            bang: { cot: ["Việc", "Trước", "Nay"], hang: [
                ["Tiếng gốc chọn 0%", "vẫn phát ở 20%", "tắt hẳn"],
                ["Đổi cỡ chữ trên Coursera", "chờ tới khi khung video đổi cỡ", "thấy ngay"],
                ["Chỉnh cỡ chữ, âm lượng", "phải mở trang Cài đặt", "ngay trong thực đơn trên video"],
                ["Giọng im một lúc", "không có lời giải thích", "ghi rõ máy chủ chậm hoặc đang tạo giọng"]
            ] }
        },
        {
            v: "1.5.5", luc: "17:22 23/09/2026", ten: "Sửa lỗi ngắt dòng phụ đề trên Coursera, phụ đề nhường chỗ cho bản chép lời",
            y: [
                "Phụ đề trên Coursera bị ngắt giữa cụm từ, kiểu \"... mà bạn có thể thực / hiện,\". Nguyên nhân: phần cắt dòng cắt theo cú pháp chứ không theo bề rộng, còn lớp phủ lại để trình duyệt tự xuống dòng ở chỗ nào cũng được.",
                "Đo thật trên trang: với cỡ chữ 130% một câu dài chiếm 1085 điểm ảnh trong khi khung chỉ rộng 848, nên bị ngắt bừa. Nay tiện ích đo đúng phông và cỡ chữ bạn đang dùng rồi cắt lại theo cú pháp (khoảng 50 ký tự mỗi dòng ở cỡ 130%).",
                "Phép cắt dòng này nay dùng chung cho cả YouTube và Coursera, nằm ở một chỗ duy nhất.",
                "Lớp phủ Coursera nay giống hệt YouTube: khung ôm sát chữ, không cho trình duyệt tự ngắt dòng nữa.",
                "Mở Bản chép lời thì phụ đề tự thu hẹp và dịch sang trái, không còn chạy xuống dưới khung chép lời."
            ],
            bang: { cot: ["Đo trên trang Coursera thật, cỡ chữ 130%", "Trước", "Nay"], hang: [
                ["Bề rộng một câu dài", "1085 điểm ảnh", "1085 điểm ảnh"],
                ["Khung chứa được", "848 điểm ảnh", "848 điểm ảnh"],
                ["Cách xử lý khi tràn", "trình duyệt ngắt bừa giữa cụm", "cắt lại theo cú pháp, 50 ký tự mỗi dòng"]
            ] }
        },
        {
            v: "1.5.4", luc: "16:59 23/09/2026", ten: "Bản chép lời cạnh video, xuất .srt, và báo phụ đề nguồn là loại nào",
            y: [
                "Thêm khung Bản chép lời trượt ra cạnh video trên cả YouTube và Coursera: xem toàn bộ lời thoại song ngữ, dòng đang phát tự sáng và tự cuộn theo, bấm một dòng là video nhảy tới đó, có ô tìm trong lời thoại.",
                "Xuất tệp .srt cho video đang xem. Đang để Song ngữ thì tệp có cả dòng gốc, để Chỉ tiếng Việt thì chỉ có bản dịch.",
                "Thực đơn nhanh nay nói rõ đang đọc phụ đề loại nào: phụ đề tác giả tải lên hay phụ đề máy nghe tự động. Phụ đề máy nghe là nguyên nhân chính làm bản dịch sai, nên dòng này hiện màu cảnh báo.",
                "Khung chép lời không tốn thêm tiền: nó dùng lại đúng dữ liệu mà lớp phụ đề đang vẽ.",
                "Mở khung bằng nút Bản chép lời trong thực đơn nhanh."
            ]
        },
        {
            v: "1.5.3", luc: "16:37 23/09/2026", ten: "Coursera hiển thị phụ đề như YouTube, có nút riêng trên thanh điều khiển",
            y: [
                "Phụ đề trên Coursera trước đây được giao cho phần vẽ phụ đề sẵn có của trình duyệt, mà Coursera cũng vẽ phụ đề của họ lên cùng chỗ, nên hai khung đè lên nhau và chữ chồng chữ. Nay tiện ích tự vẽ lớp phủ riêng như bên YouTube, và tắt hẳn phần vẽ của trình duyệt.",
                "Lớp phủ dùng chung bộ kiểu chữ, màu, nền và vị trí với YouTube, tự nâng lên trên thanh điều khiển nên không bị thanh che.",
                "Bỏ hai nút tròn nổi trên video. Thay bằng MỘT nút nằm ngay trong thanh điều khiển của Coursera, cạnh nút toàn màn hình, mở đúng thực đơn nhanh như trên YouTube: bật tắt phụ đề, bật tắt lồng tiếng, chọn giọng, chọn kiểu hiển thị, mở Cài đặt.",
                "Biểu tượng, màu sắc và thực đơn của hai trang nay lấy từ cùng một tệp dùng chung, không còn mỗi nơi một kiểu."
            ],
            bang: { cot: ["Trên Coursera", "Trước", "Nay"], hang: [
                ["Ai vẽ phụ đề", "trình duyệt vẽ, Coursera vẽ chồng lên", "tiện ích tự vẽ, chỉ một khung"],
                ["Kiểu phụ đề", "khác YouTube", "giống hệt YouTube"],
                ["Nút điều khiển", "2 nút tròn nổi trên video", "1 nút trong thanh điều khiển"],
                ["Thực đơn nhanh", "không có", "có, giống YouTube"]
            ] }
        },
        {
            v: "1.5.2", luc: "16:18 23/09/2026", ten: "Một biểu tượng duy nhất cho toàn bộ tiện ích",
            y: [
                "Trước đây mỗi nơi một hình: biểu tượng trên thanh Chrome là chữ C xanh, bảng điều khiển là hình tia, trang Cài đặt là nút phát màu tím, trên YouTube lại là hình khác. Nay tất cả dùng chung một hình: bong bóng thoại lồng tia sáng, màu cam đất.",
                "Biểu tượng trên thanh công cụ Chrome được vẽ lại ở bốn cỡ riêng (16, 32, 48, 128 điểm ảnh), cỡ nhỏ có nét dày hơn để không bị nhòe.",
                "Trang Cài đặt bỏ nốt mảng màu tím còn sót trong ô biểu tượng.",
                "Thêm bài kiểm tra: mọi nơi phải dùng đúng một hình, và mỗi tệp biểu tượng phải đúng số điểm ảnh đã khai báo."
            ],
            bang: { cot: ["Biểu tượng ở từng nơi", "Trước", "Nay"], hang: [
                ["Thanh công cụ Chrome", "chữ C màu xanh", "bong bóng thoại cam đất"],
                ["Bảng điều khiển", "hình tia bốn cánh", "bong bóng thoại"],
                ["Trang Cài đặt", "nút phát trên nền tím", "bong bóng thoại trên nền cam đất"],
                ["Nút trên YouTube", "bong bóng thoại (từ 1.5.1)", "giữ nguyên"],
                ["Số tệp biểu tượng", "1 tệp dùng cho mọi cỡ", "4 tệp vẽ riêng cho từng cỡ"]
            ] }
        },
        {
            v: "1.5.1", luc: "16:10 23/09/2026", ten: "Biểu tượng trên nút YouTube hiện được thật, đo trực tiếp trên trang",
            y: [
                "Nguyên nhân ô trống: chính CSS của YouTube ép hình vẽ đặt trong nút của trình phát về chiều rộng 0. Đo trên trang thật: chiều cao 18 điểm ảnh nhưng chiều rộng 0.",
                "Nay biểu tượng được vẽ bằng ảnh nền của nút, thứ mà CSS của YouTube không với tới được. Đã thử ngay trên trang YouTube thật trước khi phát hành.",
                "Biểu tượng vẫn là bong bóng thoại lồng tia sáng của tiện ích, cùng màu cam đất với bảng điều khiển.",
                "Bài kiểm tra tự động nay bắt buộc nút phải vẽ biểu tượng bằng ảnh nền và không được đổi màu bằng thuộc tính gộp (làm mất biểu tượng); bài này báo hỏng trên đúng bản 1.5.0."
            ],
            bang: { cot: ["Đo trên trang YouTube thật", "1.5.0", "1.5.1"], hang: [
                ["Chiều rộng hình trong nút", "0 điểm ảnh", "19 điểm ảnh"],
                ["Nhìn thấy biểu tượng", "không, chỉ có ô màu", "có"]
            ] }
        },
        {
            v: "1.5.0", luc: "16:00 23/09/2026", ten: "Nút trên thanh điều khiển YouTube có biểu tượng riêng, không còn ô trống",
            y: [
                "Bản 1.4.9 đặt biểu tượng vào nút nhưng không ghi kích thước cho hình vẽ, nên trên YouTube nút chỉ hiện một ô màu trống trơn.",
                "Nút nay có biểu tượng riêng: bong bóng thoại lồng tia sáng của tiện ích, nhìn rõ ở cỡ 17 điểm ảnh ngay cạnh các nút sẵn có của YouTube, và vẫn cùng một nhà với bảng điều khiển.",
                "Thêm bài kiểm tra: mọi hình vẽ trong nút phải khai báo kích thước, để lỗi ô trống không lặp lại."
            ],
            bang: { cot: ["Nút trên thanh điều khiển", "1.4.9", "1.5.0"], hang: [
                ["Hình bên trong nút", "không hiện (ô màu trống)", "bong bóng thoại + tia sáng"],
                ["Kích thước hình", "không khai báo", "lấp đầy khung 18 điểm ảnh"]
            ] }
        },
        {
            v: "1.4.9", luc: "15:55 23/09/2026", ten: "Nút và thực đơn trên YouTube dùng chung một bộ nhận diện với bảng điều khiển",
            y: [
                "Nút trên thanh điều khiển YouTube trước đây màu tím với biểu tượng loa, không giống bảng điều khiển và trang Cài đặt. Nay dùng đúng biểu tượng và màu cam đất của tiện ích.",
                "Thực đơn nhanh trên video được vẽ lại theo đúng bộ màu, bo góc, kiểu chữ và công tắc của bảng điều khiển: thẻ có viền, tiêu đề chữ có chân, công tắc 36x20 giống hệt.",
                "Thực đơn nhanh nay theo luôn lựa chọn Sáng / Tối trong Cài đặt, đổi trong Cài đặt là đổi ngay, không cần tải lại trang.",
                "Thông báo nhỏ hiện trên video cũng dùng chung bộ màu đó; nút thao tác trong thông báo chuyển sang màu nhấn.",
                "Chấm trạng thái trên nút rút còn hai màu cho dễ hiểu: vàng là đang dịch, xanh lá là đang bật. Đang bật phụ đề hay lồng tiếng thì xem ở chú thích khi rê chuột.",
                "Thêm bài kiểm tra tự động: bộ màu của nút, thực đơn và thông báo phải khớp với bảng điều khiển, tránh về sau lại lệch nhau."
            ]
        },
        {
            v: "1.4.8", luc: "12:10 23/09/2026", ten: "Dọn lại phần mã vừa viết cho đúng quy ước ngôn ngữ của dự án",
            y: [
                "Không đổi cách chạy: chỉ viết lại bằng tiếng Anh những dòng ghi chú và tên bài kiểm tra MỚI thêm ở bản 1.4.7, theo quy ước mới của dự án (ghi chú trong mã và tên hàm mới viết bằng tiếng Anh).",
                "Mọi chữ bạn nhìn thấy trên màn hình vẫn là tiếng Việt như cũ, kể cả trang Cài đặt, bảng điều khiển và các thông báo trên video."
            ]
        },
        {
            v: "1.4.7", luc: "11:46 23/09/2026", ten: "Máy chủ giọng chậm không còn làm lồng tiếng im cả quãng",
            y: [
                "Khi máy chủ giọng tạo không kịp (máy đang bận việc khác), engine đứng im chờ từng câu một tới 4,5 giây rồi mới bỏ, trong khi vẫn tiếp tục tạo audio cho những câu đã bỏ. Kết quả: im lặng cả quãng dài rồi bỗng đọc dồn cho kịp.",
                "Nay engine ước lượng \"còn phải chờ bao lâu\" theo tốc độ tạo giọng ĐO ĐƯỢC, biết chắc không kịp thì nhảy tới câu mà audio còn về kịp và đọc liền mạch từ đó.",
                "Không còn tạo audio cho câu đã trôi qua: mỗi lượt của máy chủ dành cho câu sắp đọc.",
                "Hết audio phía trước thì chỉ xin MỘT câu ngắn mỗi lượt (thay vì gộp 4 câu), để có tiếng sớm nhất.",
                "Máy chủ khỏe (0,23) thì mọi thứ y như cũ: 61/61 câu, không bỏ câu nào."
            ],
            bang: { cot: ["Mô phỏng trên dòng thời gian thật của một video 11 phút", "Trước", "Nay"], hang: [
                ["Máy chủ khỏe (tạo 1 giây lời nói mất 0,23 giây)", "61/61 câu", "61/61 câu"],
                ["Hơi chậm (0,45 giây)", "60/61 câu", "60/61 câu"],
                ["Chậm (0,70 giây)", "58/61 câu", "58/61 câu"],
                ["Chậm ngang thời gian thực (1,00 giây)", "12/61 câu", "30/61 câu"],
                ["... câu đọc trễ quá 2 giây", "10 câu", "2 câu"],
                ["... quãng im dài nhất", "63 giây", "không còn quãng im vì chờ audio"]
            ] }
        },
        {
            v: "1.4.6", luc: "11:05 23/09/2026", ten: "Xác nhận đã khôi phục tốc độ giọng; tệp cài chịu được lỗi của macOS",
            y: [
                "Đo lại sau khi cài lại dịch vụ: tốc độ tạo giọng về 0,23 (trước khi sửa là 1,07), mức ưu tiên tiến trình về 31 (trước là 4).",
                "Bài kiểm tra chạy thật: 25/25 câu được đọc, trễ tối đa 1,15 giây, ba đoạn đầu có audio sau 2,2 giây.",
                "Tệp cài dịch vụ: lần cài lại đầu tiên bị macOS trả lỗi và để máy chủ tắt hẳn, vì lệnh gỡ chưa xong mà lệnh nạp đã chạy. Nay chờ gỡ xong, thử lại 5 lần, hỏng thì báo rõ và chỉ cách bật tạm.",
                "Bảng so sánh của bản 1.4.5 đã điền số đo thật."
            ]
        },
        {
            v: "1.4.5", luc: "10:55 23/09/2026", ten: "Sửa lỗi máy chủ giọng chạy chậm gấp 5 lần; tiện ích tự đo tốc độ",
            y: [
                "Tệp cài dịch vụ tự khởi động (bản 1.4.2) đặt mức ưu tiên Nền, làm macOS đẩy máy chủ giọng sang lõi tiết kiệm điện: tạo 1 giây lời nói mất 1,07 giây thay vì khoảng 0,23. Nay đặt mức Tương tác.",
                "Tiện ích tự đo tốc độ tạo giọng của 5 lượt gần nhất và hiện trong Cài đặt; quá chậm thì báo ngay trên video thay vì để bạn đoán vì sao giọng trễ.",
                "Bài kiểm tra chạy thật nay BÁO HỎNG khi máy chủ chậm, và khi không câu nào được đọc (trước đó vẫn in ĐẠT).",
                "Thêm công cụ đo nhanh: node tools/vieneu-bench.js"
            ],
            bang: { cot: ["Đo thật trên MacBook Air M3", "Mức ưu tiên Nền (1.4.2)", "Mức Tương tác (1.4.5)"], hang: [
                ["Tạo 1 giây lời nói mất", "1,07 giây", "0,23 giây"],
                ["Ba đoạn đầu có audio sau", "10,3 giây", "2,2 giây"],
                ["Mức ưu tiên tiến trình", "4 (lõi tiết kiệm điện)", "31 (bình thường)"],
                ["Số câu đọc được", "0/24 (bài kiểm tra vẫn báo ĐẠT)", "25/25"],
                ["Câu trễ trên 1 giây khi mở video", "4 câu, tối đa 3,40 giây", "1 câu, tối đa 1,15 giây"]
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
