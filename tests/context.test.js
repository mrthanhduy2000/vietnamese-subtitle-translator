// Kiểm thử bộ hiểu ngữ cảnh (context-engine.js) và bộ phát hiện dịch máy (vi-quality.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../context-engine.js");
const Q = require("../vi-quality.js");
const fixtures = require("./fixtures");

// ---------- Nhận diện lĩnh vực ----------
test("lĩnh vực: nhận đúng AI, lập trình, marketing, kinh doanh, toán, hội thoại", () => {
    const d = t => C.detectDomain(t).primary;
    assert.equal(d("Convolutional Neural Networks - Deep Learning Specialization. We train the model on a dataset and compute the loss."), "ml");
    assert.equal(d("Python for Everybody: functions, variables, loops and how to debug your code, import a library"), "programming");
    assert.equal(d("Digital Marketing: build a campaign, grow your audience, improve conversion and engagement on social media"), "marketing");
    assert.equal(d("Business strategy: revenue, profit, customer segments, pricing and stakeholder management for a startup"), "business");
    assert.equal(d("Linear algebra: matrix, vector, eigen values, derivative and integral with proof of the theorem"), "math");
    assert.equal(d("Hey guys welcome back, today I went to the beach with my family"), "general");
});

test("domain: everyday speech stays general (whole words, 3 distinct keywords, score grows with length)", () => {
    const d = t => C.detectDomain(t).primary;
    // prefix matching read "important" / "imported" / "return" as programming and "meaning" /
    // "means" / "limited" as math: this vlog paragraph was "programming" before 2.3.0
    const vlog = "It is important to remember that meaning comes from small things. In general, my objective is simple: a classic, limited wardrobe. Most people of my generation think that success means having more. The importance of rest is often ignored, and a good leader knows it. I mean, what does it really mean to be rich? It means having time. So I started to return things I did not need, and I imported nothing new for a year.";
    assert.equal(d(vlog), "general");
    // one word repeated is not a field: "means" twenty times is still one keyword
    assert.equal(d("That means a lot. ".repeat(20)), "general");
    // a few real keywords lost in a long everyday talk (~1000 words, the size of the 6000-character
    // sample setUnits reads) do not make it technical
    const talk = "We walked along the river and talked about the week. ".repeat(90) + "My friend works on a neural network model with a big dataset.";
    assert.equal(d(talk), "general");
    // inflected and stem forms still count: layers, queries, fine-tuning, debugging
    assert.equal(d("We stack more layers, run fine-tuning on the dataset, and the gradient of the loss flows back through every layer."), "ml");
    assert.equal(d("Write the queries, check each column, visualize the distribution in a dashboard with pandas."), "data");
    assert.equal(d("Start debugging: set a breakpoint, inspect the variable, fix the syntax, then deploy the code to the server."), "programming");
});

test("domain: sponsor lines and links in the description are not evidence", () => {
    const s = new C.ContextSession({
        title: "Why I stopped buying things",
        description: "This video is sponsored by BrandCo, grow your brand audience with content campaigns.\nFollow me on Instagram @me\nhttps://example.com/marketing-funnel\nA quiet talk about owning less."
    });
    s.setUnits(["I used to buy a lot of things.", "Now I keep only what I use every week.", "It changed how I spend my weekends."]);
    assert.equal(s.domain.primary, "general");
});

// ---------- Từ đa nghĩa theo ngữ cảnh ----------
test("từ đa nghĩa: 'channel', 'run', 'model', 'lead' được gợi ý đúng nghĩa theo lĩnh vực", () => {
    const hint = (text, domain) => C.senseHintsFor(text, { primary: domain, secondary: null }).join(" | ");
    assert.match(hint("the output has three channels", "ml"), /kênh màu/);
    assert.match(hint("choose the right channel for your ads", "marketing"), /kênh tiếp thị/);
    assert.match(hint("run the script again", "programming"), /thực thi/);
    assert.match(hint("who will run the company", "business"), /điều hành/);
    assert.match(hint("a new business model", "business"), /mô hình kinh doanh/);
    assert.match(hint("the model predicts a label", "ml"), /mô hình \(học máy\)/);
    assert.match(hint("we collected 200 leads this week", "marketing"), /khách hàng tiềm năng/);
    // Từ nằm trong cụm động từ không được gợi ý theo nghĩa đơn ("set up" không phải "tập hợp")
    assert.doesNotMatch(hint("now that we have set up our environment", "ml"), /set:/);
    assert.match(hint("split the data into a training set", "ml"), /set: tập/);
    // Chỉ gửi gợi ý cho từ THỰC SỰ có trong đoạn (tiết kiệm token)
    assert.equal(hint("hello everyone", "ml"), "");
});

test("cụm động từ / thành ngữ được nhận diện để dịch theo nghĩa", () => {
    const h = C.phraseHintsFor("Let's figure out why this doesn't make sense, and then go over the results.").join(" | ");
    assert.match(h, /figure out: tìm ra/);
    assert.match(h, /make sense: hợp lý/);
    assert.match(h, /go over: xem lại/);
});

// 2.3.8: the user's vlogs got lecture idioms only; these came out word for word in real videos
test("everyday phrases get a hint, and come before the common ones at the limit", () => {
    const h = t => C.phraseHintsFor(t).join(" | ");
    assert.match(h("In my 20s, I feel like I was constantly trying to improve myself."), /in my 20s: hồi ngoài hai mươi.*không phải đúng 20 tuổi/);
    assert.match(h("She was in her 30s when a video went viral."), /in her 30s: .*ba mươi.* \| went viral: gây sốt/);
    assert.match(h("The flowers sat on top of my dresser, next to the nightstand."), /nightstand: tủ đầu giường \| dresser: tủ ngăn kéo/);
    assert.match(h("I love decluttering and I let go of those dried flowers."), /let go of: thôi giữ.*decluttering: dọn bớt đồ/);
    assert.equal(h("I turned 20 in the 20s of the last century."), "", "only the decade of a life");
    const many = C.phraseHintsFor("It kind of turns out that a lot of, a bunch of, sort of, we end up and figure out and set up and go over, in my 40s, the dresser.");
    assert.equal(many.length, 8);
    assert.ok(many.some(x => x.startsWith("in my 40s")) && many.some(x => x.startsWith("dresser")), many.join(" | "));
});

// ---------- Gói ngữ cảnh ----------
function lecture() {
    const s = new C.ContextSession({ title: "Convolutional Neural Networks", course: "deep learning specialization", channel: "DeepLearning.AI" });
    s.setUnits([
        "Now that we have set up our environment, let us examine the forward pass of this two-layer convolutional neural network.",
        "The model receives the image.",
        "It then processes it through several layers.",
        "Each layer produces a set of feature maps with several channels.",
        "Finally, we compute the loss and run backpropagation."
    ]);
    return s;
}

test("ngữ cảnh: có chủ đề, lĩnh vực, câu trước, bản dịch câu trước, câu sau", () => {
    const s = lecture();
    assert.equal(s.domain.primary, "ml");
    s.record([1], { translations: ["Mô hình nhận vào bức ảnh."] });
    const req = s.buildRequest([2]);
    assert.deepEqual(req.sentences, ["It then processes it through several layers."]);
    assert.match(req.context.topic, /Convolutional Neural Networks/);
    assert.match(req.context.domain, /học máy/);
    // Đại từ "It" chỉ hiểu được nhờ câu trước
    assert.match(req.context.prevSource, /The model receives the image\./);
    assert.match(req.context.prevTranslation, /Mô hình nhận vào bức ảnh\./);
    // Không còn "tóm tắt" do mô hình viết (tốn token đầu ra); bản dịch câu trước đủ để nối mạch
    assert.equal(req.context.summary, undefined);
    assert.match(req.context.nextSource, /feature maps/);
});

test("ngữ cảnh: gói gọn trong ngân sách ký tự (không gửi cả video)", () => {
    const s = new C.ContextSession({ title: "T".repeat(1000), description: "D".repeat(2000) });
    const long = "This is a long lecture sentence about gradient descent and learning rates. ".repeat(20);
    s.setUnits(Array.from({ length: 50 }, () => long));
    for (let i = 0; i < 20; i++) s.record([i], { translations: ["Câu dịch rất dài. ".repeat(60)] });
    const req = s.buildRequest([20]);
    const c = req.context;
    assert.ok(c.topic.length <= C.BUDGET.topic, c.topic.length);
    assert.ok(c.prevSource.length <= C.BUDGET.prevSource);
    assert.ok(c.prevTranslation.length <= C.BUDGET.prevTranslation);
    assert.ok(c.nextSource.length <= C.BUDGET.nextSource);
});

test("thuật ngữ: giữ nhất quán, chỉ đổi khi cách mới áp đảo; chỉ gửi thuật ngữ có trong đoạn", () => {
    const s = lecture();
    s.record([0], { translations: ["..."], terms: [{ en: "forward pass", vi: "lượt truyền xuôi" }, { en: "feature map", vi: "bản đồ đặc trưng" }] });
    s.record([1], { translations: ["..."], terms: [{ en: "forward pass", vi: "lan truyền tiến" }] });
    let t = s.buildRequest([0]).context.terms;
    assert.deepEqual(t.find(x => x.en === "forward pass"), { en: "forward pass", vi: "lượt truyền xuôi" });
    // Câu 3 nói về feature maps (số nhiều) nhưng không có forward pass
    t = s.buildRequest([3]).context.terms;
    assert.ok(t.some(x => x.en === "feature map"), JSON.stringify(t));
    assert.ok(!t.some(x => x.en === "forward pass"));
    // Cách dịch mới được dùng liên tục nhiều hơn hẳn thì mới thay
    for (let i = 0; i < 3; i++) s.record([1], { translations: ["..."], terms: [{ en: "forward pass", vi: "lan truyền tiến" }] });
    assert.equal(s.terms.get("forward pass").vi, "lan truyền tiến");
});

test("thuật ngữ: xuất / nhập để nhất quán giữa các bài của cùng khóa học", () => {
    const a = lecture();
    a.record([0], { translations: ["x"], terms: [{ en: "forward pass", vi: "lượt truyền xuôi" }] });
    const b = new C.ContextSession({});
    b.importTerms(a.exportTerms());
    b.setUnits(["Next we look at the backward pass after the forward pass."]);
    assert.deepEqual(b.buildRequest([0]).context.terms, [{ en: "forward pass", vi: "lượt truyền xuôi" }]);
});

// ---------- Phát hiện "dịch máy" ----------
// Bản dịch từng chữ điển hình (kiểu Google Translate / mô hình yếu) -> phải bắt được
const MACHINE = [
    ["In order to train the model, we need a lot of data.", "Trong thứ tự để huấn luyện mô hình, chúng ta cần rất nhiều của dữ liệu."],
    ["Let's take a look at the results.", "Hãy để chúng ta lấy một cái nhìn vào các kết quả."],
    ["It is important to normalize the inputs.", "Nó là quan trọng để chuẩn hóa các đầu vào."],
    ["Does that make sense?", "Điều đó có tạo ra cảm giác không?"],
    ["We're going to build a classifier.", "Chúng ta đang đi để xây dựng một bộ phân loại."],
    ["Now we train the model on the dataset.", "Bây giờ chúng ta tàu mô hình trên tập dữ liệu."],
    ["Let's examine the forward pass.", "Hãy xem xét đường chuyền về phía trước."],
    ["Some of these features are redundant.", "Một số của các đặc trưng này là dư thừa."],
    ["At the end of the day, data quality matters most.", "Ở cuối của ngày, chất lượng dữ liệu là vấn đề nhất."],
    ["The large language model answers the question.", "Người mẫu ngôn ngữ lớn trả lời câu hỏi."],
    ["Go ahead and open the notebook.", "Đi trước và mở sổ tay."],
    ["We use gradient clipping to stabilize training when the loss explodes.", "Chúng ta dùng gradient clipping để stabilize training khi loss explodes."],
    ["The network quickly and efficiently learns the weights, and it carefully updates its parameters with its optimizer.", "Mạng học các trọng số một cách nhanh chóng và một cách hiệu quả, và nó cập nhật các tham số của nó với bộ tối ưu của nó."],
    ["After you finish this course, you will be able to build your own machine learning pipeline from scratch.", "Sau khóa học, bạn xây quy trình."],
    ["This is is the key idea.", "Đây là là ý tưởng chính."],
    ["So what we're going to do is build a simple model.", "Vì vậy, những gì chúng ta sẽ làm là xây dựng một mô hình đơn giản."],
    ["This is where regularization comes in.", "Đây là nơi chính quy hóa đến trong."],
    ["It turns out that the model overfits.", "Nó quay ra rằng mô hình bị quá khớp."],
    ["In terms of cost, this approach is cheaper.", "Trong điều khoản của chi phí, cách tiếp cận này rẻ hơn."],
    ["Let me show you a couple of examples.", "Hãy để tôi cho bạn thấy một cặp của các ví dụ."],
    ["On the other hand, the recall drops.", "Trên tay khác, độ phủ giảm xuống."],
    ["Make sure the data is shuffled.", "Làm chắc chắn rằng dữ liệu được xáo trộn."],
    ["We need to figure out why the loss is increasing.", "Chúng ta cần hình ra tại sao mất mát đang tăng."],
    ["Pay attention to the learning rate.", "Trả sự chú ý đến tốc độ học."],
    ["You'll end up with a much better model.", "Bạn sẽ kết thúc lên với một mô hình tốt hơn nhiều."],
    ["It's worth noting that this only works for linear models.", "Nó đáng để lưu ý rằng điều này chỉ hoạt động cho các mô hình tuyến tính."]
];

for (const [src, vi] of MACHINE) {
    test(`dịch máy bị bắt: "${vi.slice(0, 48)}..."`, () => {
        const r = Q.assess(src, vi);
        assert.ok(r.needsRefine, JSON.stringify(r.issues));
    });
}

// Bản dịch tự nhiên -> KHÔNG được báo nhầm (tránh dịch lại vô ích, tốn token)
const NATURAL = [
    ["In order to train the model, we need a lot of data.", "Để huấn luyện mô hình, chúng ta cần rất nhiều dữ liệu."],
    ["Let's take a look at the results.", "Hãy cùng xem qua kết quả."],
    ["It is important to normalize the inputs.", "Điều quan trọng là phải chuẩn hóa dữ liệu đầu vào."],
    ["Does that make sense?", "Như vậy đã dễ hiểu chưa?"],
    ["We're going to build a classifier.", "Chúng ta sẽ xây dựng một bộ phân loại."],
    ["Now we train the model on the dataset.", "Giờ ta huấn luyện mô hình trên tập dữ liệu."],
    ["Let's examine the forward pass.", "Hãy cùng xem xét lượt truyền xuôi."],
    ["Some of these features are redundant.", "Một số đặc trưng trong này bị thừa."],
    ["At the end of the day, data quality matters most.", "Suy cho cùng, chất lượng dữ liệu mới là quan trọng nhất."],
    ["The model receives the image. It then processes it through several layers.", "Mô hình nhận bức ảnh, rồi xử lý ảnh qua nhiều lớp."],
    ["We use PyTorch and the Adam optimizer.", "Chúng ta dùng PyTorch và bộ tối ưu Adam."],
    ["So what we're going to do is build a simple model.", "Giờ ta sẽ xây dựng một mô hình đơn giản."],
    ["This is where regularization comes in.", "Lúc này chính quy hóa phát huy tác dụng."],
    ["It turns out that the model overfits.", "Hóa ra mô hình bị quá khớp."],
    ["In terms of cost, this approach is cheaper.", "Xét về chi phí, cách này rẻ hơn."],
    ["Let me show you a couple of examples.", "Để tôi cho bạn xem vài ví dụ."],
    ["On the other hand, the recall drops.", "Mặt khác, độ phủ lại giảm."],
    ["Make sure the data is shuffled.", "Hãy đảm bảo dữ liệu đã được xáo trộn."],
    ["We need to figure out why the loss is increasing.", "Chúng ta cần tìm ra vì sao giá trị mất mát đang tăng."],
    ["Pay attention to the learning rate.", "Hãy chú ý đến tốc độ học."],
    ["You'll end up with a much better model.", "Rốt cuộc bạn sẽ có một mô hình tốt hơn nhiều."],
    ["It's worth noting that this only works for linear models.", "Cần lưu ý là cách này chỉ dùng được cho mô hình tuyến tính."],
    ["At the same time, the company expanded its sales channels.", "Đồng thời, công ty mở rộng các kênh bán hàng."],
    ["Our business model depends on subscriptions.", "Mô hình kinh doanh của chúng tôi dựa vào gói thuê bao."]
];

for (const [src, vi] of NATURAL) {
    test(`bản dịch tự nhiên không bị báo nhầm: "${vi.slice(0, 48)}"`, () => {
        const r = Q.assess(src, vi);
        assert.equal(r.needsRefine, false, JSON.stringify(r.issues));
    });
}

test("không báo nhầm trên toàn bộ 22 bản dịch mẫu của bộ phân đoạn", () => {
    const flagged = fixtures
        .map(f => ({ f, r: Q.assess(f.src.map(c => c.text).join(" "), f.vi) }))
        .filter(x => x.r.needsRefine);
    assert.deepEqual(flagged.map(x => `${x.f.vi} => ${JSON.stringify(x.r.issues)}`), []);
});

test("thuật ngữ lệch với cách đã thống nhất thì được ghi nhận", () => {
    const r = Q.assess("Let's examine the forward pass.", "Hãy cùng xem xét lan truyền tiến.", { terms: [{ en: "forward pass", vi: "lượt truyền xuôi" }] });
    assert.ok(r.issues.some(i => i.type === "terminology"), JSON.stringify(r.issues));
});

test("'It' dịch máy móc thành 'Nó' mở câu được ghi nhận (đại từ không rõ)", () => {
    const r = Q.assess("It then processes it through several layers.", "Nó sau đó xử lý nó qua nhiều lớp.");
    assert.ok(r.issues.some(i => i.type === "pronoun"), JSON.stringify(r.issues));
});

test("thuật ngữ chỉ được xin khi đoạn có thuật ngữ MỚI, và thưa (không phải mọi cửa sổ)", () => {
    const s = lecture();
    const asks = [];
    for (let i = 0; i < 9; i++) asks.push(s.wantsTerms({ sentences: ["We train the model with gradient descent and compute the loss on each batch of the dataset."] }));
    assert.ok(asks.filter(Boolean).length <= 3, JSON.stringify(asks));
    assert.equal(asks[0], true);
    // Câu thường không có thuật ngữ chuyên ngành: không xin
    const s2 = lecture();
    assert.equal(s2.wantsTerms({ sentences: ["Hello everyone, welcome back to the course."] }), false);
    // Thuật ngữ đã biết hết thì không xin nữa
    const s3 = lecture();
    for (const k of ["gradient", "loss", "batch", "dataset", "model", "train"]) s3.terms.set(k, { en: k, vi: "x", count: 1, alt: {} });
    assert.equal(s3.wantsTerms({ sentences: ["We train the model with gradient descent and compute the loss on each batch of the dataset."] }), false);
});

test("a doubled word is a slip only for grammar words, never across punctuation", () => {
    const repeat = (en, vi) => Q.assess(en, vi, {}).issues.filter(i => i.type === "repeat").length;
    // two sentences, not "tôi tôi" / "đó đó": each of these once cost a refine call (severity 3)
    assert.equal(repeat("I love my home. I cleaned it today.", "Tôi yêu ngôi nhà của tôi. Tôi đã dọn nó hôm nay."), 0);
    assert.equal(repeat("That was the plan. That is how we did it.", "Kế hoạch là như vậy đó. Đó là cách chúng tôi làm."), 0);
    assert.equal(repeat("Books, books everywhere.", "Sách, sách ở khắp mọi nơi."), 0);
    // a doubled content word is Vietnamese style
    assert.equal(repeat("I bought it because it went viral online.", "Tôi mua vì thấy nó nổi rần rần trên mạng."), 0);
    assert.equal(repeat("The rain was pouring down.", "Mưa rơi ầm ầm suốt đêm."), 0);
    // a doubled grammar word is still a slip
    assert.equal(repeat("This is the way we learn.", "Đây là là cách chúng ta học."), 1);
    assert.equal(repeat("The value of the model.", "Giá trị của của mô hình."), 1);
});

test("English leftovers: whole words only, never an ASCII piece of an accented Vietnamese word", () => {
    const got = Q.englishLeftovers("Kỹ thuật này dùng thuật toán, the model và training data");
    assert.deepEqual(got, ["the", "model", "training", "data"]);
    assert.ok(!got.includes("thu"), "'thu' cut out of 'thuật'");
});


test("military history gets contextual senses without changing everyday or marketing meanings", () => {
    const source = "The army invaded during the war. Soldiers fought battles on the front. The Red Army pursued the military campaign during the occupation.";
    const domain = C.detectDomain(source);
    assert.equal(domain.primary, "history");
    const hints = C.senseHintsFor(source, domain).join(" | ");
    assert.match(hints, /red army: Hồng quân/);
    assert.match(hints, /campaign: chiến dịch quân sự/);
    assert.match(hints, /occupation: sự chiếm đóng/);
    assert.doesNotMatch(C.senseHintsFor("Red Army", { primary: "general" }).join(" | "), /Hồng quân/);
    assert.equal(C.detectDomain("We run a marketing campaign for the brand to improve conversion and audience engagement.").primary, "marketing");
    assert.equal(C.detectDomain("We had a pillow battle and watched the red sunset with our friends.").primary, "general");
});


test("partial English name echoes are refined, complete bilingual names and independent names remain valid", () => {
    const source = "That was clear when the Red Army invaded from the east.";
    const echo = Q.assess(source, "Điều đó đã rõ ràng khi Hồng quân Red tiến quân từ phía đông.");
    assert.ok(echo.issues.some(i => i.type === "term" && i.severity === 3));
    assert.equal(echo.needsRefine, true);
    for (const text of ["Hồng quân tiến quân từ phía đông.", "Hồng quân (Red Army) tiến quân từ phía đông.", "Hồng quân Red Army tiến quân từ phía đông."]) {
        assert.ok(!Q.assess(source, text).issues.some(i => i.detail.includes("trộn hai bản dịch")), text);
    }
    assert.ok(!Q.assess("The Red Army met a man named Red.", "Hồng quân Red gặp người đàn ông đó.").issues.some(i => i.detail.includes("trộn hai bản dịch")));
});
