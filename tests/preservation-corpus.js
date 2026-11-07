// Authored bilingual challenges. Natural saved-video recall is not inferred from these labels.
module.exports = [
    { kind: 'money', src: 'The ticket costs $25.', good: 'Vé có giá 25 đô la.', bad: 'Vé có giá 35 đô la.' },
    { kind: 'money-scale', src: 'The budget is $1 million.', good: 'Ngân sách là 1 triệu đô la.', bad: 'Ngân sách là 2 triệu đô la.' },
    { kind: 'percentage', src: 'The rate is 0.5%.', good: 'Tỷ lệ là 0,5%.', bad: 'Tỷ lệ là 5%.' },
    { kind: 'negative-number', src: 'The return was -4%.', good: 'Lợi nhuận là âm 4%.', bad: 'Lợi nhuận là 4%.' },
    { kind: 'mass', src: 'The batch weighs 5kg.', good: 'Lô hàng nặng 5000g.', bad: 'Lô hàng nặng 6000g.' },
    { kind: 'length', src: 'The distance is 2 km.', good: 'Khoảng cách là 2000 mét.', bad: 'Khoảng cách là 3000 mét.' },
    { kind: 'time', src: 'The process takes 2.5 hours.', good: 'Quy trình mất 2 tiếng rưỡi.', bad: 'Quy trình mất 2 tiếng.' },
    { kind: 'leading-decimal', src: 'The gain is .86 kg.', good: 'Mức tăng là 0,86 kg.', bad: 'Mức tăng là 0,68 kg.' },
    { kind: 'date', src: 'The meeting is on May 5, 2020.', good: 'Cuộc họp diễn ra ngày 5 tháng 5 năm 2020.', bad: 'Cuộc họp diễn ra ngày 6 tháng 5 năm 2020.' },
    { kind: 'iso-date', src: 'The release is dated 2024-12-03.', good: 'Bản phát hành ghi ngày 03/12/2024.', bad: 'Bản phát hành ghi ngày 04/12/2024.' },
    { kind: 'product', src: 'Use the RTX 5090.', good: 'Hãy dùng RTX 5090.', bad: 'Hãy dùng RTX 4090.' },
    { kind: 'version', src: 'This device runs iOS 17.', good: 'Thiết bị này chạy iOS 17.', bad: 'Thiết bị này chạy iOS 27.' },
    { kind: 'integer', src: 'There are 12 steps.', good: 'Có 12 bước.', bad: 'Có 13 bước.' },
    { kind: 'negation', src: 'This does not increase pressure.', good: 'Điều này không làm tăng áp suất.', bad: 'Điều này làm tăng áp suất.' },
    { kind: 'negation-support', src: "It doesn't support this format.", good: 'Nó không hỗ trợ định dạng này.', bad: 'Nó hỗ trợ định dạng này.' },
    { kind: 'comparison-minimum', src: 'Use at least 5%.', good: 'Hãy dùng ít nhất 5%.', bad: 'Hãy dùng tối đa 5%.' },
    { kind: 'comparison-maximum', src: 'Use at most 5%.', good: 'Hãy dùng tối đa 5%.', bad: 'Hãy dùng tối thiểu 5%.' },
    { kind: 'comparison-less', src: 'The load is less than 5kg.', good: 'Tải trọng nhỏ hơn 5kg.', bad: 'Tải trọng lớn hơn 5kg.' }
];
