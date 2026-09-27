// Prosody corpus (1.7.6). Marks between words (standalone tokens):
//   |  a listener expects a pause here (breath group / clause boundary)
//   /  a light pause is fine here, none is fine too
//   (unmarked) a pause here sounds wrong
// The marks are one reader’s judgment of natural Vietnamese lecture speech, not a measured ground
// truth. History matters when you read results: "corpus" tuned the model; "holdout1" and "holdout2"
// were each checked once and then exposed faults that were fixed (they are seen data now);
// "holdout3" (other topics) was written after all tuning and evaluated once, as is.
// tools/prosody-eval.js renders and scores them; tests/prosody.test.js checks the text side offline.
module.exports = {
    corpus: [
    // short
    ["s1", "short", "Đúng vậy."],
    ["s2", "short", "Cảm ơn các bạn đã theo dõi."],
    ["s3", "short", "Hãy thử lại nhé."],
    // simple / medium
    ["m1", "lead-in", "Bây giờ, / hãy cùng xem ví dụ."],
    ["m2", "medium", "Tôi đã kiểm tra toàn bộ hệ thống / và phát hiện một vấn đề khá quan trọng."],
    ["m3", "rang", "Tôi nghĩ rằng đây là một ví dụ rất hay."],
    ["m4", "rang", "Điều này cho thấy rằng mô hình đã học được quy luật."],
    ["m5", "medium", "Tôi thử lại và kết quả tốt hơn."],
    // compound
    ["c1", "compound", "Tôi đã thử nhiều lần, | nhưng kết quả vẫn không thay đổi."],
    ["c2", "compound", "Chúng ta đã huấn luyện mô hình trên dữ liệu cũ, | nhưng khi đưa vào thực tế / thì độ chính xác giảm mạnh / vì dữ liệu mới rất khác."],
    ["c3", "compound", "Dữ liệu huấn luyện rất sạch, / còn dữ liệu kiểm tra thì có khá nhiều nhiễu."],
    // complex / conditional / causal / contrast
    ["x1", "complex", "Sau khi tôi cập nhật hệ thống, | tốc độ đã cải thiện rõ rệt."],
    ["x2", "conditional", "Nếu bạn bật tùy chọn này, | hệ thống sẽ tự động lưu lại mọi thay đổi / sau mỗi lần chỉnh sửa."],
    ["x3", "causal", "Vì máy chủ quá tải / nên yêu cầu bị chuyển sang một mô hình khác."],
    ["x4", "contrast", "Mặc dù kết quả khá tốt, | tốc độ vẫn chưa ổn định."],
    ["x5", "complex", "Khi mô hình gặp một từ mà nó chưa từng thấy trong quá trình huấn luyện, | nó sẽ chia từ đó thành các phần nhỏ hơn."],
    // explanatory
    ["e1", "explanatory", "Điều này có nghĩa là / hệ thống sẽ phải xử lý gấp đôi lượng dữ liệu / trong cùng một khoảng thời gian."],
    ["e2", "long", "Mô hình này học cách dự đoán từ tiếp theo / dựa trên toàn bộ ngữ cảnh / mà nó đã nhìn thấy trước đó trong đoạn văn bản."],
    // list
    ["l1", "list", "Bạn cần chuẩn bị ba thứ: | dữ liệu huấn luyện, / một mô hình cơ sở, / và một hàm mất mát phù hợp."],
    ["l2", "list", "CPU, / bộ nhớ, / tốc độ mạng và độ trễ | đều ảnh hưởng đến trải nghiệm người dùng."],
    ["l3", "list", "Thứ nhất, / chuẩn hóa dữ liệu. | Thứ hai, / chọn mô hình phù hợp. | Cuối cùng, / đánh giá trên tập kiểm tra."],
    ["l4", "list", "Apple, / Microsoft và Google / đều đang đầu tư mạnh vào trí tuệ nhân tạo."],
    // parenthetical / apposition / vocative
    ["p1", "parenthetical", "Phiên bản mới, / theo tôi, / ổn định hơn nhiều."],
    ["p2", "apposition", "Claude, | mô hình mà chúng ta đang dùng, | có thể đọc cả một cuốn sách trong vài giây."],
    ["p3", "vocative", "Anh Đàm, | phần này anh xem lại giúp em nhé."],
    // question / exclamation
    ["q1", "question", "Tại sao hệ thống lại làm như vậy?"],
    ["q2", "q-answer", "Tại sao hệ thống lại chậm? | Nguyên nhân là bộ nhớ đệm / không được làm mới đúng lúc."],
    ["q3", "q-answer", "Vậy tại sao điều này lại quan trọng? | Vì nếu bỏ qua bước này, | kết quả sẽ sai hoàn toàn."],
    ["q4", "q-answer", "Vậy điều gì xảy ra tiếp theo? | Đầu tiên, / mô hình sẽ tính toán sai số / trên toàn bộ tập dữ liệu."],
    ["ex1", "exclamation", "Điều này thật sự rất nhanh!"],
    ["ex2", "exclamation", "Thật tuyệt vời! | Chỉ với vài dòng mã, | chúng ta đã có một mô hình hoạt động."],
    // quoted / dialogue
    ["d1", "quoted", "Anh ấy nói rằng: / \"Tôi sẽ thử lại.\""],
    ["d2", "dialogue", "Anh ấy hỏi: / bạn có chắc không? | Tôi trả lời: / chắc chắn rồi."],
    // heading / transition
    ["h1", "transition", "Bây giờ chúng ta chuyển sang phần tiếp theo."],
    ["h2", "transition", "Được rồi, / giờ ta sang phần tiếp theo nhé."],
    // cross-sentence inside one take
    ["cs1", "cross", "Tôi đã thử cách này. | Nhưng kết quả không thay đổi."],
    ["cs2", "cross", "Hệ thống xử lý dữ liệu. | Sau đó / lưu kết quả vào bộ nhớ đệm."],
    // technical / numbers / acronyms / names
    ["t1", "technical", "Hàm kích hoạt ReLU / giúp mạng nơ-ron học được các quan hệ phi tuyến / giữa đầu vào và đầu ra."],
    ["t2", "mixed", "Chúng ta sẽ dùng thư viện PyTorch / để xây dựng một mô hình Transformer đơn giản."],
    ["t3", "numbers", "Độ chính xác tăng từ 72,5% lên 91% / sau khi huấn luyện thêm 3 epoch / với 1.500.000 mẫu."],
    ["t4", "acronym", "Chúng ta sẽ chạy mô hình trên GPU / thay vì CPU / để tiết kiệm thời gian."],
    ["t5", "mixed", "Chiến dịch Google Ads Performance Max này / đã tăng doanh thu hai mươi phần trăm."],
    ["t6", "mixed", "API request bị timeout / sau đúng 30 giây."],
    ["t7", "mixed", "CPU usage cao hơn bình thường / khi chạy một large language model."],
    ["t8", "numbers", "Ngày 21/09/2026, / công ty tại TP.HCM / công bố doanh thu 12.500.000 USD."],
    ["t9", "name", "Ông Nguyễn Văn An, | giám đốc kỹ thuật, | cho biết hệ thống sẽ ra mắt vào tháng sau."],
    ["t10", "fixed", "Mô hình mới không chỉ rẻ hơn / mà còn nhanh hơn đáng kể."],
    ["t11", "unit", "Giá chỉ khoảng 10 triệu đồng / cho gói 5 GB mỗi tháng."],
    // very long lecture sentences
    ["v1", "very-long", "Trong phần này, | chúng ta sẽ tìm hiểu cách mà mạng nơ-ron học được các biểu diễn / từ dữ liệu thô / thông qua quá trình lan truyền ngược / và cập nhật trọng số / sau mỗi bước huấn luyện."],
    ["v2", "very-long", "Một trong những lý do khiến mô hình này hoạt động tốt / là vì nó có thể tận dụng thông tin / từ cả phía trước lẫn phía sau của câu / trong cùng một lần xử lý."],
    ["v3", "very-long", "Khi chúng ta tăng kích thước của tập dữ liệu huấn luyện lên gấp mười lần | thì sai số trên tập kiểm tra giảm xuống đáng kể | nhưng thời gian huấn luyện cũng tăng lên tương ứng."],
    ["v4", "very-long", "Điều quan trọng nhất mà các bạn cần nhớ / là mô hình chỉ tốt bằng dữ liệu mà nó được huấn luyện / và không có thuật toán nào / có thể bù đắp cho dữ liệu kém chất lượng."],
    // casual
    ["k1", "casual", "Ừm, / thực ra thì câu trả lời phụ thuộc vào dữ liệu của bạn."],
    ["k2", "casual", "Các bạn thấy đấy, / cách này đơn giản hơn nhiều."],
    ["k3", "casual", "Nói thật là tôi cũng không chắc lắm / nhưng cứ thử xem sao."],
    // narration
    ["n1", "narration", "Năm 2012, | một nhóm nghiên cứu nhỏ tại Toronto / đã tạo ra một mô hình / làm thay đổi hoàn toàn lĩnh vực thị giác máy tính."]
    ],
    holdout1: [
    ["H1", "long", "Để hiểu được cách mô hình đưa ra quyết định / chúng ta cần xem xét trọng số của từng đặc trưng / trong lớp cuối cùng."],
    ["H2", "compound", "Phương pháp này khá đơn giản, | nhưng nó lại hoạt động rất tốt / trên các tập dữ liệu nhỏ."],
    ["H3", "conditional", "Nếu độ chính xác trên tập kiểm tra thấp hơn nhiều so với tập huấn luyện / thì rất có thể mô hình đã bị quá khớp."],
    ["H4", "question", "Làm thế nào để chúng ta biết / mô hình đã học đủ hay chưa?"],
    ["H5", "list", "Các bước gồm có: | thu thập dữ liệu, / làm sạch dữ liệu, / huấn luyện / và đánh giá."],
    ["H6", "explanatory", "Nói cách khác, | mỗi lớp chỉ học một phần nhỏ / của bài toán lớn."],
    ["H7", "mixed", "Bạn có thể cài đặt thư viện scikit-learn / bằng lệnh pip install / chỉ trong vài giây."],
    ["H8", "numbers", "Năm 2017, | nhóm nghiên cứu của Google / công bố bài báo Attention Is All You Need."],
    ["H9", "rang", "Nhiều người cho rằng dữ liệu càng nhiều thì mô hình càng tốt."],
    ["H10", "very-long", "Trong thực tế, | các kỹ sư thường dành phần lớn thời gian / cho việc chuẩn bị và làm sạch dữ liệu / hơn là cho việc thiết kế mô hình."],
    ["H11", "casual", "Thật ra thì / cũng không khó lắm đâu, / các bạn cứ làm theo từng bước là được."],
    ["H12", "cross", "Mô hình đã hội tụ. | Tuy nhiên, / sai số trên tập kiểm tra vẫn còn cao."],
    ["H13", "apposition", "PyTorch, | thư viện do Meta phát triển, | hiện rất phổ biến trong giới nghiên cứu."],
    ["H14", "causal", "Do tốc độ học quá lớn / nên hàm mất mát dao động liên tục / và không giảm xuống được."],
    ["H15", "short", "Rất đơn giản."],
    ["H16", "transition", "Tiếp theo, / chúng ta sẽ nói về cơ chế chú ý."]
    ],
    holdout2: [
    ["G1", "long", "Khi dữ liệu đầu vào có nhiều giá trị bị thiếu / chúng ta phải quyết định nên loại bỏ chúng / hay điền vào bằng giá trị trung bình."],
    ["G2", "compound", "Mạng này có ba lớp ẩn, | mỗi lớp có một trăm hai mươi tám nơ-ron."],
    ["G3", "rang", "Các nhà nghiên cứu phát hiện ra rằng mô hình lớn hơn không phải lúc nào cũng tốt hơn."],
    ["G4", "question", "Vậy chúng ta nên chọn tốc độ học bao nhiêu / là hợp lý?"],
    ["G5", "q-answer", "Tại sao lại cần chuẩn hóa? | Bởi vì các đặc trưng có thang đo rất khác nhau."],
    ["G6", "subject", "Phần lớn các thuật toán học máy hiện đại / đều dựa trên phương pháp giảm độ dốc."],
    ["G7", "mixed", "Hàm softmax biến đầu ra của mạng / thành một phân phối xác suất."],
    ["G8", "list", "Mô hình này nhanh, / nhẹ / và dễ triển khai."],
    ["G9", "contrast", "Thay vì huấn luyện lại từ đầu, | chúng ta chỉ tinh chỉnh vài lớp cuối cùng."],
    ["G10", "comparative", "Việc thu thập thêm dữ liệu / thường hiệu quả hơn là thay đổi kiến trúc mô hình."],
    ["G11", "very-long", "Sau khi đã có một mô hình hoạt động ổn định trên tập kiểm tra, | bước tiếp theo là triển khai nó lên máy chủ / để người dùng có thể sử dụng / thông qua giao diện web."],
    ["G12", "casual", "Nói chung là / nếu các bạn làm đúng như hướng dẫn / thì sẽ không có lỗi gì đâu."],
    ["G13", "numbers", "Tập dữ liệu gồm 60.000 ảnh huấn luyện / và 10.000 ảnh kiểm tra."],
    ["G14", "explanatory", "Nói một cách đơn giản, | mô hình chỉ đang ghi nhớ dữ liệu / chứ không thực sự hiểu nó."],
    ["G15", "short", "Hãy cùng bắt đầu."],
    ["G16", "how", "Làm sao để biết / mô hình có đang bị quá khớp hay không?"]
    ],
    holdout3: [
    ["F1", "business", "Doanh thu của công ty trong quý vừa qua / tăng mạnh nhờ vào các sản phẩm mới / ra mắt hồi đầu năm."],
    ["F2", "history", "Vào thế kỷ thứ mười lăm, | các nhà thám hiểm châu Âu / bắt đầu tìm kiếm những tuyến đường biển mới / sang phương Đông."],
    ["F3", "health", "Nếu bạn ngủ ít hơn sáu tiếng mỗi đêm | thì cơ thể sẽ không có đủ thời gian để phục hồi."],
    ["F4", "cooking", "Cho hành vào chảo, | đảo đều tay / cho đến khi hành chuyển sang màu vàng nhạt."],
    ["F5", "rang", "Nhiều chuyên gia tin rằng giá nhà sẽ tiếp tục tăng trong vài năm tới."],
    ["F6", "list", "Bữa sáng nên có đủ ba nhóm chất: | chất đạm, / chất bột / và chất xơ."],
    ["F7", "question", "Tại sao người La Mã lại xây dựng những con đường thẳng như vậy?"],
    ["F8", "q-answer", "Vậy làm thế nào để tiết kiệm tiền hiệu quả? | Trước hết, / bạn cần biết mình đang tiêu tiền vào đâu."],
    ["F9", "contrast", "Mặc dù thời tiết không thuận lợi, | trận đấu vẫn diễn ra đúng kế hoạch."],
    ["F10", "very-long", "Trong suốt hơn ba mươi năm làm việc tại nhà máy, | ông ấy chưa bao giờ nghỉ một ngày nào / kể cả khi bị ốm / hay gặp chuyện gia đình."],
    ["F11", "numbers", "Giá vé máy bay đã tăng từ 1.200.000 đồng / lên 2.500.000 đồng / chỉ trong vòng một tháng."],
    ["F12", "casual", "Thật ra thì tôi cũng chưa thử món này bao giờ, | nhưng nghe nói là ngon lắm."],
    ["F13", "narration", "Cô bé mở cửa sổ ra / và nhìn thấy cả một vườn hoa đang nở rộ / dưới ánh nắng buổi sáng."],
    ["F14", "cross", "Thị trường đã phục hồi. | Tuy vậy, / nhiều nhà đầu tư vẫn còn thận trọng."],
    ["F15", "subject", "Những người thường xuyên tập thể dục vào buổi sáng / thường có giấc ngủ sâu hơn / vào ban đêm."],
    ["F16", "short", "Cảm ơn bạn rất nhiều."]
    ],
    // 1.8.0, written before the constituent code: "syntax" tunes it (dev), "syntaxval" is only measured.
    // Long subjects with a prepositional phrase inside, purpose / means / cause adjuncts, from-to
    // complements, English entities inside Vietnamese syntax. The unseen check for 1.8.0 is
    // tests/blind-corpus.js, written by a separate agent.
    syntax: [
    ["S1", "subject-pp", "Một công ty công nghệ lớn ở California trong quý vừa qua / đã tăng doanh thu gấp đôi."],
    ["S2", "subject-pp", "Những sinh viên ở ký túc xá trong học kỳ này / sẽ được giảm học phí."],
    ["S3", "subject-pp", "Nhóm nghiên cứu của một trường đại học ở Tokyo / đã công bố kết quả mới."],
    ["S4", "purpose", "Tôi dùng ChatGPT / để phân tích dữ liệu."],
    ["S5", "entity", "Tôi đang chạy Google Ads cho Performance Max / để tăng doanh số."],
    ["S6", "range", "Doanh thu tăng từ 10 lên 20 tỷ / trong năm nay."],
    ["S7", "cause", "Lợi nhuận tăng mạnh nhờ vào dữ liệu khách hàng."],
    ["S8", "adjunct", "Anh ấy làm việc với khách hàng / từ sáng đến tối."],
    ["S9", "adjunct", "Chúng tôi gửi báo cáo cho ban giám đốc / sau mỗi cuộc họp."],
    ["S10", "subject-pp", "Độ chính xác của mô hình trên tập kiểm tra / đã tăng đáng kể."],
    ["S11", "means", "Họ thanh toán bằng thẻ tín dụng / thay vì tiền mặt."],
    ["S12", "entity", "Chúng tôi dùng Microsoft Excel / để theo dõi chi phí hằng tháng."]
    ],
    syntaxval: [
    ["V1", "subject-pp", "Chiếc điện thoại mới của Samsung ở thị trường châu Âu / sẽ có giá cao hơn."],
    ["V2", "subject-pp", "Các kỹ sư trong nhóm phát triển / đã sửa lỗi này từ tuần trước."],
    ["V3", "purpose", "Cô ấy học tiếng Anh / để xin việc ở nước ngoài."],
    ["V4", "range", "Giá cổ phiếu giảm từ 50 xuống 30 đô la / chỉ trong một tháng."],
    ["V5", "means", "Tôi viết code bằng Python / cho dự án này."],
    ["V6", "subject-pp", "Số người dùng ở khu vực nông thôn trong năm ngoái / đã tăng gấp ba lần."],
    ["V7", "adjunct", "Mô hình này được huấn luyện trên dữ liệu / từ nhiều nguồn khác nhau."],
    ["V8", "entity", "Bạn có thể dùng Canva / để thiết kế ảnh bìa."],
    ["V9", "cause", "Doanh số giảm nhẹ / vì thời tiết xấu."],
    ["V10", "subject-pp", "Những khách hàng của chúng tôi tại Hà Nội / đều rất hài lòng."]
    ],
    // 1.8.2: the failures of the first blind split (tests/blind-corpus.js, seen since 1.8.0) moved here,
    // with new sentences around each rule, both ways. The "để" marks follow the user's ruling ("/")
    syntax2: [
    ["N1", "nen-result", "Trời mưa rất to từ sáng | nên buổi quay ngoài trời phải dời sang ngày mai."],
    ["N2", "nen-result", "Máy chủ bị quá tải từ tối qua / nên nhiều người dùng không đăng nhập được."],
    ["N3", "nen-should", "Doanh nghiệp nhỏ nên tập trung vào khách hàng quen."],
    ["N4", "nen-should", "Tôi nghĩ công ty nên đầu tư thêm vào đội ngũ kỹ thuật."],
    ["L1", "list-long-last", "Bạn cần chuẩn bị hộ chiếu, | ảnh thẻ | và bản sao kê ngân hàng trong ba tháng gần nhất."],
    ["L2", "list-subject", "Apple, / Microsoft và Google / đều đang đầu tư mạnh vào trí tuệ nhân tạo."],
    ["R1", "relative", "Chiếc máy mà tôi mua hôm qua / đã bị hỏng."],
    ["R2", "relative", "Cuốn sách mà tôi giới thiệu tuần trước / đã hết hàng ở hầu hết các nhà sách."],
    ["C1", "compare-quantity", "Doanh thu của mảng điện toán đám mây trong quý ba / tăng hai mươi phần trăm so với cùng kỳ năm ngoái."],
    ["C2", "compare-quantity", "Lượng khách quốc tế tháng này / cao gấp đôi so với cùng kỳ năm ngoái."],
    ["P1", "purpose-short", "Chúng tôi dùng Adobe Premiere Pro / để dựng toàn bộ video."],
    ["P2", "purpose-short", "Mình ghé qua đây / để mua ít cà phê thôi."],
    ["P3", "purpose-long", "Nhóm nghiên cứu đã thu thập hơn mười nghìn bức ảnh / để huấn luyện một mô hình nhận diện bệnh trên lá lúa."]
    ],
    // 1.9.5 (BACKLOG 30): the four prosody failures of blind split 2 (b2-*, moved here, so that set is
    // no longer blind for them) plus sentences written with them, before the code, to hold the rules
    // to their limits: the long counterpart of each keeps its boundary.
    syntax3: [
    ["b2-p3", "compare-nhu", "Việc học một ngôn ngữ mới khi đã ngoài bốn mươi tuổi / không hề dễ dàng như nhiều người nghĩ."],
    ["b2-p26", "subject-short", "Số nhân viên của công ty đã tăng từ 10 lên 20 người / chỉ trong sáu tháng."],
    ["b2-p29", "cause-result", "Vì hôm qua thức khuya / nên sáng nay tôi dậy muộn."],
    ["b2-p31", "time-nested", "Nếu bạn gặp lỗi khi cài đặt, | hãy khởi động lại máy rồi thử lại."],
    ["X1", "compare-nhu", "Kết quả thử nghiệm tốt như chúng tôi mong đợi."],
    ["X2", "compare-nhu", "Bài toán này không đơn giản như vẻ ngoài của nó."],
    ["X3", "nhu-example", "Các loại trái cây nhiệt đới / như xoài, / sầu riêng và chôm chôm / đều rất được ưa chuộng."],
    ["X4", "subject-short", "Giá vàng trong nước đã giảm mạnh vào sáng nay."],
    ["X5", "subject-long", "Toàn bộ dữ liệu khách hàng thu thập trong ba năm qua | đã được mã hóa và lưu trữ trên một máy chủ riêng."],
    ["X6", "cause-result", "Vì trời mưa rất to / nên chiều nay chúng tôi phải hủy buổi dã ngoại."],
    ["X7", "fronted-pronoun", "Khi dữ liệu huấn luyện bị thiếu nhãn | chúng ta phải gán nhãn lại bằng tay."],
    ["X8", "time-nested", "Hãy lưu lại tệp khi bạn làm xong."],
    ["X9", "time-long", "Mô hình thường bị tràn bộ nhớ / khi xử lý những tập dữ liệu có hơn một triệu dòng."]
    ]
};
