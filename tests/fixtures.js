// Bộ ca kiểm thử phụ đề thực tế: cue tiếng Anh (có thời gian) + bản dịch tiếng Việt.
// "forbid" liệt kê những cặp từ KHÔNG được tách ra hai dòng/hai cue khác nhau,
// dạng "trái|phải" nghĩa là không được cắt giữa "trái" và "phải".
// "noLineEnd" / "noLineStart": từ không được đứng cuối / đầu dòng hoặc cue.

function cues(list) {
    return list.map(([start, end, text, words]) => ({ start, end, text, words }));
}

module.exports = [
    {
        name: "ảnh lỗi thực tế: 'tôi,' bị treo xuống dòng",
        group: "regression",
        src: cues([[10.0, 11.6, "But for me personally,"], [11.6, 14.2, "the most important thing is consistency."]]),
        vi: "Nhưng với cá nhân tôi, điều quan trọng nhất là sự nhất quán.",
        forbid: ["cá nhân|tôi,", "cá|nhân", "sự|nhất quán", "nhất|quán", "quan|trọng"],
        expectLineBreakAfter: "tôi,"
    },
    {
        name: "chúng ta hãy / xem xét",
        group: "regression",
        src: cues([[0, 1.8, "Let's take a look at"], [1.8, 4.6, "convolutional neural networks with two layers."]]),
        vi: "Chúng ta hãy xem xét mạng nơ-ron tích chập hai lớp.",
        forbid: ["hãy|xem", "xem|xét", "tích|chập", "nơ-ron|tích", "mạng|nơ-ron", "hai|lớp."]
    },
    {
        name: "mệnh đề điều kiện nếu... thì",
        group: "clause",
        src: cues([[5.0, 7.2, "If the learning rate is too large,"], [7.2, 9.8, "gradient descent may overshoot the minimum"], [9.8, 11.5, "and fail to converge."]]),
        vi: "Nếu tốc độ học quá lớn, thuật toán gradient descent có thể vượt quá điểm cực tiểu và không hội tụ được.",
        forbid: ["tốc|độ", "độ|học", "gradient|descent", "có|thể", "cực|tiểu", "hội|tụ", "quá|lớn,", "tụ|được.", "vượt|quá", "điểm|cực"],
        noLineEnd: ["và", "có thể"]
    },
    {
        name: "số + đơn vị",
        group: "numbers",
        src: cues([[20.0, 22.5, "The model has 175 billion parameters"], [22.5, 25.0, "and was trained on 300 billion tokens."]]),
        vi: "Mô hình có 175 tỷ tham số và được huấn luyện trên 300 tỷ token.",
        forbid: ["175|tỷ", "tỷ|tham", "tham|số", "300|tỷ", "tỷ|token.", "huấn|luyện", "được|huấn"]
    },
    {
        name: "câu hỏi",
        group: "question",
        src: cues([[30.0, 31.4, "So what happens"], [31.4, 33.8, "when we increase the batch size?"]]),
        vi: "Vậy điều gì sẽ xảy ra khi chúng ta tăng kích thước lô?",
        forbid: ["xảy|ra", "sẽ|xảy", "kích|thước", "thước|lô?", "chúng|ta"]
    },
    {
        name: "hội thoại có tiểu từ cuối câu",
        group: "dialogue",
        src: cues([[40.0, 41.5, "Yeah, I think that's right,"], [41.5, 43.2, "but let's double check it."]]),
        vi: "Vâng, tôi nghĩ điều đó đúng, nhưng hãy kiểm tra lại nhé.",
        forbid: ["lại|nhé.", "kiểm|tra", "hãy|kiểm", "điều|đó"]
    },
    {
        name: "câu giảng bài có thuật ngữ",
        group: "lecture",
        src: cues([[50.0, 51.8, "In this video, you'll learn"], [51.8, 54.0, "how to implement logistic regression"], [54.0, 55.8, "from scratch in Python."]]),
        vi: "Trong video này, bạn sẽ học cách triển khai hồi quy logistic từ đầu bằng Python.",
        forbid: ["video|này,", "hồi|quy", "quy|logistic", "triển|khai", "từ|đầu", "bằng|Python."]
    },
    {
        name: "toán học",
        group: "math",
        src: cues([[60.0, 62.0, "The derivative of x squared"], [62.0, 63.6, "is equal to two x."]]),
        vi: "Đạo hàm của x bình phương bằng 2x.",
        forbid: ["đạo|hàm", "bình|phương", "của|x", "x|bình"]
    },
    {
        name: "mệnh đề nhượng bộ mặc dù",
        group: "clause",
        src: cues([[70.0, 73.0, "Although the model performs well on the training set,"], [73.0, 74.6, "it generalizes poorly"], [74.6, 76.0, "to new data."]]),
        vi: "Mặc dù mô hình hoạt động tốt trên tập huấn luyện, nó lại khái quát hóa kém trên dữ liệu mới.",
        forbid: ["mặc|dù", "tập|huấn", "huấn|luyện,", "khái|quát", "quát|hóa", "dữ|liệu", "hoạt|động"],
        expectCueBreakAfter: "luyện,"
    },
    {
        name: "mệnh đề thời gian sau khi",
        group: "clause",
        src: cues([[80.0, 81.6, "After you finish this course,"], [81.6, 83.4, "you will be able to build"], [83.4, 85.6, "your own machine learning pipeline."]]),
        vi: "Sau khi hoàn thành khóa học này, bạn sẽ có thể tự xây dựng quy trình học máy của riêng mình.",
        forbid: ["sau|khi", "khóa|học", "học|này,", "có|thể", "xây|dựng", "quy|trình", "học|máy", "của|riêng", "riêng|mình."],
        noLineEnd: ["của", "sẽ", "tự"]
    },
    {
        name: "câu rất ngắn",
        group: "short",
        src: cues([[90.0, 90.9, "Okay."]]),
        vi: "Được rồi.",
        expectCues: 1,
        expectLines: 1
    },
    {
        name: "câu rất dài nhiều dấu phẩy",
        group: "long",
        src: cues([
            [100.0, 102.4, "So in practice, when you train a deep network,"],
            [102.4, 104.6, "you usually start with a small learning rate,"],
            [104.6, 106.8, "monitor the validation loss after every epoch,"],
            [106.8, 109.0, "and stop training as soon as it starts to go up,"],
            [109.0, 111.2, "which is a technique called early stopping."]
        ]),
        vi: "Vì vậy, trong thực tế, khi huấn luyện một mạng sâu, bạn thường bắt đầu với tốc độ học nhỏ, theo dõi hàm mất mát trên tập xác thực sau mỗi epoch, và dừng huấn luyện ngay khi nó bắt đầu tăng lên, đây là một kỹ thuật được gọi là dừng sớm.",
        forbid: ["tốc|độ", "độ|học", "hàm|mất", "mất|mát", "tập|xác", "xác|thực", "mỗi|epoch,", "được|gọi", "gọi|là", "dừng|sớm.", "huấn|luyện", "bắt|đầu", "theo|dõi", "một|mạng", "một|kỹ"],
        noLineEnd: ["một", "với", "sau", "khi", "là", "được"]
    },
    {
        name: "trước khi + tóm tắt",
        group: "clause",
        src: cues([[120.0, 121.8, "Before we move on,"], [121.8, 124.0, "let's recap what we've learned"], [124.0, 126.0, "about the attention mechanism."]]),
        vi: "Trước khi chuyển sang phần tiếp theo, hãy cùng tóm tắt những gì chúng ta đã học về cơ chế chú ý.",
        forbid: ["trước|khi", "tiếp|theo,", "tóm|tắt", "những|gì", "cơ|chế", "chế|chú", "chú|ý.", "đã|học", "hãy|cùng", "cùng|tóm"],
        noLineEnd: ["những", "hãy", "cùng", "về"]
    },
    {
        name: "mục đích với để",
        group: "clause",
        src: cues([[130.0, 131.6, "We normalize the inputs"], [131.6, 133.6, "to speed up training."]]),
        vi: "Chúng ta chuẩn hóa đầu vào để tăng tốc quá trình huấn luyện.",
        forbid: ["chuẩn|hóa", "đầu|vào", "quá|trình", "huấn|luyện."],
        noLineEnd: ["để"]
    },
    {
        name: "đơn vị kỹ thuật",
        group: "numbers",
        src: cues([[140.0, 142.2, "The GPU has 80 GB of memory"], [142.2, 144.0, "and runs at 1.4 GHz."]]),
        vi: "GPU này có 80 GB bộ nhớ và chạy ở tốc độ 1,4 GHz.",
        forbid: ["80|GB", "bộ|nhớ", "1,4|GHz.", "tốc|độ", "độ|1,4"]
    },
    {
        name: "lập trình",
        group: "programming",
        src: cues([[150.0, 151.6, "Call the fit method"], [151.6, 153.2, "on the training data"], [153.2, 155.4, "and then evaluate on the test set."]]),
        vi: "Gọi phương thức fit trên dữ liệu huấn luyện rồi đánh giá trên tập kiểm tra.",
        forbid: ["phương|thức", "dữ|liệu", "huấn|luyện", "đánh|giá", "tập|kiểm", "kiểm|tra.", "liệu|huấn", "thức|fit"]
    },
    {
        name: "phụ đề tự động YouTube (không dấu câu, có thời gian từng từ)",
        group: "asr",
        src: cues([
            [200.0, 202.1, "so the key idea behind attention", [{ t: 200.0, text: "so" }, { t: 200.3, text: "the" }, { t: 200.5, text: "key" }, { t: 200.9, text: "idea" }, { t: 201.3, text: "behind" }, { t: 201.7, text: "attention" }]],
            [202.1, 204.3, "is that the model can look back", [{ t: 202.1, text: "is" }, { t: 202.3, text: "that" }, { t: 202.6, text: "the" }, { t: 202.8, text: "model" }, { t: 203.2, text: "can" }, { t: 203.5, text: "look" }, { t: 203.9, text: "back" }]],
            [204.3, 206.5, "at every word in the input sentence", [{ t: 204.3, text: "at" }, { t: 204.6, text: "every" }, { t: 205.0, text: "word" }, { t: 205.4, text: "in" }, { t: 205.6, text: "the" }, { t: 205.8, text: "input" }, { t: 206.1, text: "sentence" }]]
        ]),
        vi: "Ý tưởng chính của cơ chế chú ý là mô hình có thể nhìn lại mọi từ trong câu đầu vào.",
        forbid: ["ý|tưởng", "cơ|chế", "chú|ý", "mô|hình", "có|thể", "nhìn|lại", "mọi|từ", "đầu|vào.", "câu|đầu"],
        noLineEnd: ["của", "có thể", "mọi", "trong"]
    },
    {
        name: "mệnh đề nguyên nhân vì",
        group: "clause",
        src: cues([[210.0, 212.4, "Because the data is noisy,"], [212.4, 215.0, "we need to apply regularization to the model."]]),
        vi: "Vì dữ liệu bị nhiễu nên chúng ta cần áp dụng chính quy hóa cho mô hình.",
        forbid: ["dữ|liệu", "bị|nhiễu", "áp|dụng", "quy|hóa", "chính|quy", "mô|hình.", "chúng|ta"],
        noLineEnd: ["bị", "cần", "cho"]
    },
    {
        name: "câu hỏi hội thoại ngắn",
        group: "question",
        src: cues([[220.0, 221.2, "Does that make sense?"]]),
        vi: "Điều đó có hợp lý không?",
        expectCues: 1,
        expectLines: 1
    },
    {
        name: "tên riêng và sản phẩm",
        group: "lecture",
        src: cues([[230.0, 232.0, "Andrew Ng will show you how to use"], [232.0, 234.6, "Claude Code together with Google Cloud."]]),
        vi: "Andrew Ng sẽ hướng dẫn bạn cách sử dụng Claude Code cùng với Google Cloud.",
        forbid: ["Andrew|Ng", "Claude|Code", "Google|Cloud.", "sử|dụng", "hướng|dẫn", "cùng|với"],
        noLineEnd: ["với", "sẽ"]
    },
    {
        name: "khoa học: phần trăm và nhiệt độ",
        group: "numbers",
        src: cues([[240.0, 242.5, "About 70 percent of the Earth's surface"], [242.5, 244.8, "is covered by water, at an average of 15 degrees."]]),
        vi: "Khoảng 70 phần trăm bề mặt Trái Đất được bao phủ bởi nước, với nhiệt độ trung bình 15 độ C.",
        forbid: ["70|phần", "phần|trăm", "bề|mặt", "Trái|Đất", "bao|phủ", "nhiệt|độ", "trung|bình", "15|độ", "độ|C."],
        noLineEnd: ["bởi", "với"]
    },
    {
        name: "mệnh đề quan hệ mà",
        group: "clause",
        src: cues([[250.0, 252.4, "This is the function that we will optimize"], [252.4, 254.2, "in the next lesson."]]),
        vi: "Đây là hàm mà chúng ta sẽ tối ưu hóa trong bài học tiếp theo.",
        forbid: ["tối|ưu", "ưu|hóa", "bài|học", "tiếp|theo.", "sẽ|tối"],
        noLineEnd: ["mà", "sẽ", "trong"]
    }
];
