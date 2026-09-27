// Blind corpus written by a separate agent that never read the rules. Scored once; never tuned on.
module.exports = {
  speech: [
    // English full names whose first name is spelled like a Vietnamese syllable
    { id: "b1", text: "Sam Altman cho biết OpenAI sẽ ra mắt một mô hình mới vào cuối năm nay.", src: "Sam Altman said OpenAI will launch a new model later this year.", ents: [["Sam Altman", "en"], ["OpenAI", "en"]] },
    { id: "b2", text: "Theo CEO Tim Cook, doanh số iPhone tại Ấn Độ đã tăng gấp đôi.", src: "According to CEO Tim Cook, iPhone sales in India have doubled.", ents: [["Tim Cook", "en"], ["iPhone", "en"]] },
    { id: "b3", text: "Bà Kim Kardashian đang rót tiền vào một quỹ đầu tư tư nhân.", ents: [["Kim Kardashian", "en"]] },
    { id: "b4", text: "Cuốn tiểu thuyết mới của Dan Brown lại đứng đầu danh sách bán chạy.", src: "Dan Brown's new novel is once again topping the bestseller list.", ents: [["Dan Brown", "en"]] },
    { id: "b5", text: "Nhà đầu tư Ray Dalio cảnh báo rằng nợ công của Mỹ đang tăng quá nhanh.", ents: [["Ray Dalio", "en"]] },
    { id: "b6", text: "Nam diễn viên Liam Neeson sẽ đóng vai chính trong một bộ phim hành động mới.", src: "Liam Neeson will star in a new action movie.", ents: [["Liam Neeson", "en"]] },
    { id: "b7", text: "Tỷ phú Ken Griffin vừa mua thêm một căn biệt thự ở Miami.", ents: [["Ken Griffin", "en"], ["Miami", "en"]] },
    { id: "b8", text: "Jon Stewart đã quay lại dẫn chương trình The Daily Show vào mỗi tối thứ Hai.", src: "Jon Stewart is back hosting The Daily Show every Monday night.", ents: [["Jon Stewart", "en"], ["The Daily Show", "en"]] },
    { id: "b9", text: "Giáo trình học máy kinh điển này do giáo sư Tom Mitchell viết.", ents: [["Tom Mitchell", "en"]] },
    { id: "b10", text: "Đạo diễn Ben Affleck xác nhận sẽ quay bộ phim tiếp theo ở Boston.", src: "Director Ben Affleck confirmed he will shoot his next film in Boston.", ents: [["Ben Affleck", "en"], ["Boston", "en"]] },
    { id: "b11", text: "Công ty có trụ sở chính tại San Francisco và một văn phòng nhỏ ở Austin.", src: "The company is headquartered in San Francisco with a small office in Austin.", ents: [["San Francisco", "en"], ["Austin", "en"]] },

    // Vietnamese people and words that look English
    { id: "b12", text: "Chị Kim là người phụ trách nhóm thiết kế ở văn phòng Đà Nẵng.", ents: [["Kim", "vi"]] },
    { id: "b13", text: "Anh Long sẽ trình bày phần tổng kết doanh thu quý ba.", ents: [["Long", "vi"]] },
    { id: "b14", text: "Cô Kim Anh dạy môn tiếng Anh ở trường cấp ba gần nhà.", ents: [["Kim Anh", "vi"]] },
    { id: "b15", text: "Ông Nguyễn Văn Dân đã làm nông ở vùng này hơn ba mươi năm.", ents: [["Nguyễn Văn Dân", "vi"]] },
    { id: "b16", text: "Bạn Lan hỏi rằng khóa học này có cần biết lập trình trước không.", ents: [["Lan", "vi"]] },
    { id: "b17", text: "Em Minh mới mười tuổi nhưng đã tự viết được trò chơi nhỏ bằng Python.", ents: [["Minh", "vi"], ["Python", "en"]] },
    { id: "b18", text: "Tôi mua một can dầu ăn ở chợ gần nhà.", ents: [["can", "vi"]] },
    { id: "b19", text: "Nhà máy mới của tập đoàn sẽ được xây ở Long An.", ents: [["Long An", "vi"]] },
    { id: "b20", text: "Bản tin sáng nay nói rằng giá xăng sẽ giảm nhẹ.", ents: [["tin", "vi"]] },

    // Lone ambiguous first names, no source: must not be forced to English
    { id: "b21", text: "Sau đó Tom nói rằng anh ấy sẽ không quay lại nữa.", ents: [["Tom", "hold"]] },
    { id: "b22", text: "Sam đã chuẩn bị bữa tối cho cả nhóm.", ents: [["Sam", "hold"]] },
    { id: "b23", text: "Tôi hỏi Kim xem cô ấy có muốn đi cùng không.", ents: [["Kim", "hold"]] },
    { id: "b24", text: "Ray gọi điện lúc nửa đêm để báo tin vui.", ents: [["Ray", "hold"]] },
    { id: "b25", text: "Cảm ơn Dan vì đã giúp tôi quay video này.", ents: [["Dan", "hold"]] },
    { id: "b26", text: "Hôm nay Ben sẽ hướng dẫn các bạn cách pha cà phê.", ents: [["Ben", "hold"]] },

    // Lone first names that the English source proves are English people
    { id: "b27", text: "Tom bảo tôi rằng dự án này sẽ xong trước tháng sau.", src: "Tom told me this project would be done before next month.", ents: [["Tom", "en"]] },
    { id: "b28", text: "Sam và tôi đã thử chiếc máy ảnh này suốt một tuần.", src: "Sam and I have been testing this camera for a whole week.", ents: [["Sam", "en"]] },
    { id: "b29", text: "Ben sẽ chỉ cho các bạn cách cài đặt phần mềm này.", src: "Ben is going to show you how to install this software.", ents: [["Ben", "en"]] },
    { id: "b30", text: "Kim nói rằng bài thuyết trình của cô ấy vẫn chưa xong.", src: "Kim said her presentation still isn't finished.", ents: [["Kim", "en"]] },

    // Brands and multi-word products
    { id: "b31", text: "Chúng tôi chuyển toàn bộ cuộc họp sang Microsoft Teams từ đầu năm.", src: "We moved all our meetings to Microsoft Teams at the start of the year.", ents: [["Microsoft Teams", "en"]] },
    { id: "b32", text: "Tôi dựng video này hoàn toàn bằng Adobe Premiere Pro.", src: "I edited this video entirely in Adobe Premiere Pro.", ents: [["Adobe Premiere Pro", "en"]] },
    { id: "b33", text: "Đôi Nike Air Max này nhẹ hơn tôi nghĩ rất nhiều.", ents: [["Nike Air Max", "en"]] },
    { id: "b34", text: "Nếu bạn dùng Google Sheets, hãy bật tính năng tự động lưu.", src: "If you use Google Sheets, turn on autosave.", ents: [["Google Sheets", "en"]] },
    { id: "b35", text: "Tôi lưu mọi ghi chú trong Notion và đồng bộ với Google Calendar.", ents: [["Notion", "en"], ["Google Calendar", "en"]] },
    { id: "b36", text: "Salesforce vừa công bố thương vụ mua lại trị giá tám tỷ đô la.", src: "Salesforce just announced an eight billion dollar acquisition.", ents: [["Salesforce", "en"]] },

    // English terms used inside Vietnamese
    { id: "b37", text: "Hãy vẽ lại customer journey trước khi chạy quảng cáo.", src: "Map out the customer journey before you run any ads.", ents: [["customer journey", "en"]] },
    { id: "b38", text: "Chiến dịch retargeting giúp chúng tôi kéo lại những khách đã bỏ giỏ hàng.", ents: [["retargeting", "en"]] },
    { id: "b39", text: "Đội ngũ đang tối ưu conversion rate cho trang đích mới.", ents: [["conversion rate", "en"]] },
    { id: "b40", text: "Bài giảng hôm nay nói về sự khác nhau giữa machine learning và deep learning.", src: "Today's lecture is about the difference between machine learning and deep learning.", ents: [["machine learning", "en"], ["deep learning", "en"]] },

    // All-caps codes of five or more letters
    { id: "b41", text: "Trang web này chưa dùng HTTPS nên trình duyệt báo không an toàn.", src: "This site still isn't on HTTPS, so the browser flags it as not secure.", ents: [["HTTPS", "letters"]] },
    { id: "b42", text: "Cổ phiếu công nghệ trên sàn NASDAQ giảm mạnh trong phiên hôm qua.", ents: [["NASDAQ", "en"]] },
    { id: "b43", text: "Quần thể di tích này đã được UNESCO công nhận là di sản thế giới.", ents: [["UNESCO", "en"]] },
    { id: "b44", text: "Tôi đang ôn thi IELTS mỗi tối sau giờ làm.", src: "I'm studying for the IELTS every night after work.", ents: [["IELTS", "en"]] },
    { id: "b45", text: "Hơn một triệu thí sinh vừa hoàn thành kỳ thi THPTQG năm nay.", ents: [["THPTQG", "vletters"]] },
    { id: "b46", text: "Đại diện UBMTTQ phường đã đến thăm các hộ gia đình khó khăn.", ents: [["UBMTTQ", "vletters"]] },
    { id: "b47", text: "Sinh viên ĐHQGHN vừa giành giải nhất một cuộc thi lập trình quốc tế.", ents: [["ĐHQGHN", "vletters"]] },

    // Model and version names versus quantities
    { id: "b48", text: "Bản cập nhật macOS 15.1 đã sửa lỗi Wi-Fi hay bị ngắt.", src: "The macOS 15.1 update fixes the Wi-Fi dropping bug.", ents: [["macOS 15.1", "model"]] },
    { id: "b49", text: "Khóa học này dùng Python 3.13 nên bạn cần cài bản mới nhất.", src: "This course uses Python 3.13, so you'll need the latest version.", ents: [["Python 3.13", "model"]] },
    { id: "b50", text: "Llama 3.1 được Meta phát hành miễn phí cho cộng đồng nghiên cứu.", ents: [["Llama 3.1", "model"], ["Meta", "en"]] },
    { id: "b51", text: "Card đồ họa này có GPU chạy ở 2.5 GHz và bộ nhớ 12 GB.", src: "This graphics card has a GPU running at 2.5 GHz and 12 GB of memory.", ents: [["2.5 GHz", "num"], ["12 GB", "num"]] },
    { id: "b52", text: "Chiếc laptop chỉ nặng 1,2 kg nên rất dễ mang theo.", ents: [["1,2 kg", "num"]] },
    { id: "b53", text: "Máy có RAM 16 GB và lớp kính dày chỉ 0.5 mm.", ents: [["16 GB", "num"], ["0.5 mm", "num"]] },
    { id: "b54", text: "Giá khởi điểm của iPhone 16 Pro là khoảng 28,5 triệu đồng.", src: "The iPhone 16 Pro starts at around 28.5 million dong.", ents: [["iPhone 16 Pro", "model"], ["28,5 triệu", "num"]] },
    { id: "b55", text: "Chúng tôi đã thử GPT-4.1 và Windows 11 trên cùng một máy có pin dùng được 1.5 ngày.", ents: [["GPT-4.1", "model"], ["Windows 11", "model"], ["1.5 ngày", "num"]] }
  ],

  prosody: [
    ["p1", "long_subject", "Một công ty khởi nghiệp nhỏ ở Đà Nẵng trong quý vừa qua / đã tăng doanh thu gấp ba lần."],
    ["p2", "long_subject", "Những sinh viên đăng ký khóa học trực tuyến của trường từ tháng trước / sẽ nhận được chứng chỉ vào tuần sau."],
    ["p3", "de_attached", "Tôi dùng ứng dụng này để ghi chú mỗi ngày."],
    ["p4", "de_clause", "Công ty đã tuyển thêm hai mươi kỹ sư phần mềm / để rút ngắn thời gian phát hành sản phẩm mới."],
    ["p5", "bang_attached", "Anh ấy trả tiền bằng thẻ tín dụng."],
    ["p6", "bang_clause", "Họ giải quyết tình trạng thiếu nhân lực trong mùa cao điểm / bằng cách thuê thêm cộng tác viên bán thời gian."],
    ["p7", "voi_attached", "Tôi đi ăn tối với mấy người bạn cũ."],
    ["p8", "cho_attached", "Chị ấy mua một chiếc máy tính mới cho con gái."],
    ["p9", "tu_den_range", "Giá vé máy bay đã tăng từ hai triệu lên gần năm triệu đồng / chỉ trong vòng một tháng."],
    ["p10", "trong_time", "Trong ba năm qua, | lượng người dùng của nền tảng này đã tăng gấp mười lần."],
    ["p11", "sau_clause", "Sau khi buổi họp kết thúc, | cả nhóm ở lại / để thảo luận thêm về ngân sách."],
    ["p12", "truoc_clause", "Trước khi bắt đầu bài học hôm nay, | tôi muốn nhắc lại một số khái niệm cơ bản."],
    ["p13", "nho_clause", "Nhờ chiến dịch quảng cáo trên mạng xã hội, | doanh số của cửa hàng đã tăng đáng kể."],
    ["p14", "theo_clause", "Theo báo cáo mới nhất của ngân hàng, | lạm phát trong năm nay / có thể vượt mức bốn phần trăm."],
    ["p15", "ve_attached", "Bài giảng hôm nay nói về cách xây dựng thương hiệu cá nhân."],
    ["p16", "cua_subject", "Chiếc điện thoại mới nhất của hãng / có thời lượng pin dài hơn hẳn thế hệ trước."],
    ["p17", "ma_relative", "Cuốn sách mà tôi giới thiệu tuần trước / đã hết hàng ở hầu hết các nhà sách."],
    ["p18", "nen_cause", "Trời mưa rất to từ sáng | nên buổi quay ngoài trời phải dời sang ngày mai."],
    ["p19", "thi_conditional", "Nếu bạn muốn tiết kiệm chi phí quảng cáo | thì hãy bắt đầu với một nhóm khách hàng nhỏ."],
    ["p20", "entity_inside", "Tôi đang chạy Google Ads cho một cửa hàng bán đồ gốm ở Bát Tràng."],
    ["p21", "entity_inside", "Nhóm của chúng tôi chuyển từ Slack sang Microsoft Teams / vào đầu năm ngoái."],
    ["p22", "entity_inside", "Sam Altman cho rằng trí tuệ nhân tạo sẽ thay đổi cách chúng ta làm việc."],
    ["p23", "number_unit", "Chiếc xe điện này đi được khoảng 400 km / sau mỗi lần sạc đầy."],
    ["p24", "range", "Lãi suất tiết kiệm đã giảm từ 6 xuống còn 4,5 phần trăm."],
    ["p25", "long_object_list", "Bạn cần chuẩn bị hộ chiếu, | ảnh thẻ | và bản sao kê ngân hàng trong ba tháng gần nhất."],
    ["p26", "contrast", "Sản phẩm này có thiết kế rất đẹp, | nhưng giá bán lại cao hơn đối thủ khá nhiều."],
    ["p27", "relative", "Những khách hàng đã mua gói năm / sẽ được nâng cấp miễn phí lên bản mới."],
    ["p28", "location", "Ở các thành phố lớn như Hà Nội và Thành phố Hồ Chí Minh, | giá thuê nhà đã tăng liên tục."],
    ["p29", "short", "Hôm nay trời đẹp quá."],
    ["p30", "short", "Cảm ơn các bạn đã theo dõi."],
    ["p31", "short", "Tôi rất thích chiếc máy ảnh này."],
    ["p32", "vi_cause", "Buổi ra mắt bị hoãn / vì nhà sản xuất chưa kịp giao đủ linh kiện."],
    ["p33", "entity_de_attached", "Chúng tôi dùng Adobe Premiere Pro để dựng toàn bộ video."],
    ["p34", "lecture_long", "Khi xây dựng một mô hình học máy, | điều quan trọng nhất / không phải là thuật toán / mà là chất lượng của dữ liệu đầu vào."],
    ["p35", "news_long", "Ngân hàng Nhà nước vừa quyết định giữ nguyên lãi suất điều hành / trong bối cảnh lạm phát vẫn chưa có dấu hiệu hạ nhiệt."],
    ["p36", "de_clause", "Sáng nay tôi dậy sớm / để đi chợ mua đồ ăn cho cả tuần."],
    ["p37", "entity_subject", "Bộ phim mới của đạo diễn Christopher Nolan / sẽ ra rạp vào mùa hè năm sau."],
    ["p38", "thi_topic", "Còn về giá cả thì / tôi nghĩ nó vẫn khá hợp lý."],
    ["p39", "voi_long", "Hãng đã hợp tác với một studio thiết kế nổi tiếng ở Milan / để ra mắt bộ sưu tập giới hạn."],
    ["p40", "cua_long_subject", "Doanh thu của mảng điện toán đám mây trong quý ba / tăng hai mươi phần trăm so với cùng kỳ năm ngoái."]
  ],

  cues: [
    { id: "k1", cues: ["Mình ghé qua đây", "để mua ít cà phê thôi."], marked: "Mình ghé qua đây để mua ít cà phê thôi." },
    { id: "k2", cues: ["Bộ phim tiếp theo của đạo diễn Christopher", "Nolan sẽ quay một phần tại Việt Nam."], marked: "Bộ phim tiếp theo của đạo diễn Christopher Nolan / sẽ quay một phần tại Việt Nam." },
    { id: "k3", cues: ["Chiếc máy tính bảng này chỉ nặng 450", "gram nên cầm cả ngày không mỏi tay."], marked: "Chiếc máy tính bảng này chỉ nặng 450 gram / nên cầm cả ngày không mỏi tay." },
    { id: "k4", cues: ["Những người dùng", "ở khu vực châu Âu sẽ nhận bản cập nhật trước."], marked: "Những người dùng ở khu vực châu Âu / sẽ nhận bản cập nhật trước." },
    { id: "k5", cues: ["Tôi đã dùng thử Samsung Galaxy", "Z Fold 6 trong suốt hai tuần."], marked: "Tôi đã dùng thử Samsung Galaxy Z Fold 6 trong suốt hai tuần." },
    { id: "k6", cues: ["Hôm nay chúng ta sẽ tìm hiểu", "cách viết một câu truy vấn đơn giản."], marked: "Hôm nay chúng ta sẽ tìm hiểu cách viết một câu truy vấn đơn giản." },
    { id: "k7", cues: ["Theo nhà sáng lập Jensen", "Huang, nhu cầu về chip AI vẫn chưa hạ nhiệt."], marked: "Theo nhà sáng lập Jensen Huang, | nhu cầu về chip AI vẫn chưa hạ nhiệt." },
    { id: "k8", cues: ["Giá cổ phiếu đã tăng từ 120", "lên 180 đô la chỉ trong một tuần."], marked: "Giá cổ phiếu đã tăng từ 120 lên 180 đô la / chỉ trong một tuần." },
    { id: "k9", cues: ["Mình dựng video này bằng Adobe", "Premiere Pro trên một chiếc laptop cũ."], marked: "Mình dựng video này bằng Adobe Premiere Pro / trên một chiếc laptop cũ." },
    { id: "k10", cues: ["Công ty cần thêm vốn để", "mở rộng nhà máy ở Bình Dương."], marked: "Công ty cần thêm vốn để mở rộng nhà máy ở Bình Dương." },
    { id: "k11", cues: ["Sau khi ra trường,", "tôi làm việc ở một công ty quảng cáo nhỏ."], marked: "Sau khi ra trường, | tôi làm việc ở một công ty quảng cáo nhỏ." },
    { id: "k12", cues: ["Sản phẩm bán rất chạy trong tháng đầu,", "nhưng sau đó doanh số giảm dần."], marked: "Sản phẩm bán rất chạy trong tháng đầu, | nhưng sau đó doanh số giảm dần." },
    { id: "k13", cues: ["Nếu bạn thấy video này hữu ích", "thì đừng quên nhấn đăng ký kênh nhé."], marked: "Nếu bạn thấy video này hữu ích | thì đừng quên nhấn đăng ký kênh nhé." }
  ]
};
