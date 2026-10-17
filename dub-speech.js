// ============================================================
// SPEECH: English spans inside Vietnamese speech, and how the free voice (VieNeu) is made to say them
//
// VieNeu's front end (sea_g2p) already reads English: a word that is not a Vietnamese syllable goes
// to its English dictionary and G2P ("Claude" klˈɔːd, "Performance Max" pɚfˈɔːɹməns mˈæks), known
// acronyms become English letters ("API"), and its own table expands Vietnamese ones ("CLB" câu lạc
// bộ). Measured on its phonemizer (tools/pron-eval.js), it goes wrong in four places, and this
// module changes exactly those, nothing else:
//   1. an all-caps code it does not know is spelled with Vietnamese letter names: "CPC" "xê phê xê",
//      "IKEA" "i ca e a"                                   -> <en>c p c</en>, <en>ikea</en>
//   2. camelCase is split, and a piece that is a Vietnamese syllable is read Vietnamese:
//      "DiCaprio" "zi caprio"                              -> <en>dicaprio</en>
//   3. a word that is a Vietnamese syllable is always Vietnamese, even inside <en>: "Tom" t̪ˈɔm,
//      "San" sˈaːn                                         -> inside an English name only, a spelling
//      its English engine reads the English way (RESPELL: "tahm", "sanne")
//   4. a model number is read as a quantity: "RTX 5090" "năm nghìn không trăm chín mươi"
//                                                         -> "RTX 5 0 9 0"
// <en>...</en> is the front end's own marker (its normalizer emits it for "API"): the text inside
// skips the acronym and camelCase rules. Two limits of it, measured: it does not change the language
// of a Vietnamese-syllable word (hence RESPELL), and past 10 tags in one sentence its placeholder
// restore breaks (the 11th reads "... 0"): at most TAG_MAX per text.
// Which codes VieNeu already reads well, and the respellings, come from its own front end, probed
// offline by tools/build-speech-tables.js. Nothing here calls a server.
//
// analyze(text) also tells the prosody model where the English spans are ("Google Ads API",
// "Christopher Nolan", "GPT 5 chấm 6"): no pause inside one.
// Other voices get the text unchanged: Gemini reads English natively.
// Pure, memoised. Runs in the page, the service worker and Node.
// ============================================================
(function (root) {
    "use strict";
    const SEG = (root && root.CST_VI_SEG) ||
        (typeof require === "function" ? (() => { try { return require("./vi-segmenter.js"); } catch (e) { return null; } })() : null);

    const TAG_MAX = 8;
    const planner = () => (root && root.CST_DUB_PLAN) ||
        (typeof require === "function" ? (() => { try { return require("./dub-planner.js"); } catch (e) { return null; } })() : null);
    const isViet = w => !!(SEG && SEG.isVietWord(String(w).toLowerCase()));
    const DIACRITIC = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

    // @generated speech-tables begin: tools/build-speech-tables.js, do not edit by hand
    // How VieNeu (sea_g2p 0.9.1) reads each all-caps code of 2-4 letters, in a Vietnamese sentence.
    // Already English: left as is. Expanded to Vietnamese words ("CLB" câu lạc bộ): left as is. Read as a
    // word ("RAM", "NASA"): left as is. Every other code it spells with Vietnamese letter names.
    const CAPS_EN = new Set((
        "ADB AFK AI AM AMD ANU ANZ API AQI AR ASMR ASQ ASR ATM BBC BMI BMW BTS CBRE CD CEO CER CFO CI CIA CMS " +
        "CNC CNN CNY CPI CPU CRM CSS CT CTO CTR CV DB DBS DJ DNS DOP DVD ECG EEG EP EPS EQ ERP ESPN ETF EUR " +
        "FBI FDI FPS FTA FTP GB GBP GDP GM GPA GPS GPT GPU HBO HDD HDMI HP HPV HSBC HTML HTTP IAEA IBM ICU ID " +
        "ILO IMF IP IPO IPS IQ IT IVF JPY JSON KB KFC KOL KPI LAN LCD LG LGBT LLM LSE LSTM MB MBA MC MIT ML " +
        "MLB MMS MOU MRI MRSA MSI MTV MV NBA NDA NFC NFL NLP NTU NUS NY NYU OCR ODA ODM OECD OEM OKR OS OT PC " +
        "PCR PE PM PSG PT QR RGB RMIT RNN ROA ROAS ROE RTX SDK SEO SLM SME SMS SOP SQL SSD SSL SUV TB TPU " +
        "TSMC TTS TV UCLA UFC UI UK UN UNDP UOB US USB USC USD UX VAE VGA VJ VPN VR VRAM VW WB WER XML").split(" "));
    const CAPS_VI = new Set((
        "ATGT ATTP BCH BCTC BHTN BHXH BHYT BQP BS BTC BV CAND CCCD CLB CM CMND CNTT CP CSGT CTY CUDA GPLX " +
        "GPMB GS GTGT GTVT GV HCM HLV HN HSSV HTX KCN KG KHCN KM KS LHQ MG MM MMHG MST MTTQ NSNN NXB PCCC PGS " +
        "PTTH SV TAND TBT TDTT THCS THPT TNCN TNDN TNGT TNHH TNMT TP TS TTTT TW UBND VKS VN VND").split(" "));
    const CAPS_WORD = new Set((
        "AC ACH AIDS AN AND ANG ANH AO AP APEC AS ASAP AT AU AY BA BAC BACH BAI BAM BAN BANG BANH BAO BAP " +
        "BASE BAT BAU BAY BE BEC BECH BEM BEN BENG BENH BEO BEP BERT BET BEU BI BIA BICH BIEC BIEM BIEN BIET " +
        "BIEU BIM BIN BINH BIP BIU BLEU BO BOAI BOAM BOAN BOAY BOC BOEM BOEN BOEO BOI BOM BON BONG BOOC BOP " +
        "BU BUA BUC BUI BUM BUN BUNG BUOC BUOI BUOM BUON BUOT BUOU BUP BUT BUU BUYN BUYT BUYU BY CA CAC CACH " +
        "CAI CAM CAN CANG CANH CAO CAP CASE CAT CAU CAY CHA CHAC CHAI CHAM CHAN CHAO CHAP CHAU CHAY CHE CHEM " +
        "CHEN CHEO CHEP CHET CHEU CHI CHIA CHIM CHIN CHIP CHIT CHIU CHO CHOA CHOC CHOE CHOI CHOM CHON CHOP " +
        "CHOT CHU CHUA CHUC CHUE CHUI CHUM CHUN CHUP CHUT CHUY CHY CO COA COAI COAM COAN COAO COAY COC COE " +
        "COEM COEO COI COM CON CONG COOC COP COT CU CUA CUC CUI CUM CUN CUNG CUOC CUOI CUOM CUON CUP CUU CUY " +
        "CUYA CUYN CUYU DA DAC DACH DAI DAM DAN DANG DANH DAO DAP DART DAT DAU DAY DE DECH DEM DEN DENG DENH " +
        "DEO DEP DESC DET DEU DEYO DI DIA DICH DIEC DIEM DIEN DIEP DIET DIEU DIM DIN DINH DINK DIP DIT DIU DO " +
        "DOA DOAC DOAI DOAM DOAN DOAO DOAT DOAY DOEM DOEN DOEO DOI DOM DON DONG DOT DU DUA DUAT DUC DUE DUI " +
        "DUM DUN DUNG DUOC DUOI DUOM DUON DUOT DUOU DUP DUT DUY DUYA DUYN DUYU DY EBIT EC ECH ECMO ELO ELSE " +
        "EM EN END ENG ENH EO EPIC ET EURO FANG FED FIFA FOMO FROM GA GAC GACH GAI GAM GAN GANG GANH GAO GAP " +
        "GAT GAU GAY GHE GHEM GHEN GHEO GHEP GHET GHI GHIA GHIM GHIN GHIT GHIU GHY GI GIA GIAC GIAI GIAM GIAN " +
        "GIAO GIAP GIAT GIAU GIAY GICH GIE GIEC GIEM GIEN GIEO GIEP GIET GIEU GIF GIM GIN GINH GINI GIO GIOA " +
        "GIOC GIOE GIOI GIOM GION GIOP GIOT GIP GIU GIUA GIUC GIUI GIUM GIUN GIUP GIUT GIUY GIY GMAT GO GOA " +
        "GOAI GOAN GOAO GOAY GOC GOE GOEM GOEN GOEO GOI GOM GON GONG GOP GOT GU GUA GUC GUI GUN GUNG GUOC " +
        "GUOI GUOM GUON GUOT GUT GUYN GUYU GYM HA HAC HACH HAI HAM HAN HANG HANH HAO HAP HAT HAU HAY HE HEC " +
        "HECH HEM HEN HENG HENH HEO HEP HET HEU HI HIA HICH HIEC HIEM HIEN HIEP HIET HIEU HIM HIN HINH HIP " +
        "HIU HO HOA HOAC HOAI HOAM HOAN HOAO HOAT HOAY HOC HOE HOEM HOEN HOEO HOI HOM HON HONG HOOC HOP HU " +
        "HUA HUAN HUAY HUC HUE HUI HUM HUN HUNG HUO HUOC HUOM HUON HUOT HUOU HUP HUT HUU HUY HUYA HUYN HUYT " +
        "HUYU HY IA ICH IDEA IM IN INH IS ISO IU JOIN JPEG KAEI KAN KE KEC KECH KEM KEN KENG KENH KEO KEP KET " +
        "KEU KHA KHAC KHAI KHAM KHAN KHAO KHAP KHAT KHAU KHAY KHE KHEC KHEM KHEN KHEO KHEP KHET KHEU KHI KHIA " +
        "KHIM KHIN KHIT KHIU KHO KHOA KHOC KHOE KHOI KHOM KHON KHOP KHOT KHU KHUA KHUC KHUE KHUI KHUM KHUN " +
        "KHUO KHUT KHUU KHUY KHY KIA KICH KIEM KIEN KIEP KIET KIEU KIM KIN KINH KIP KIT KIU KY LA LAC LACH " +
        "LAI LAM LANG LANH LAO LAP LAT LAU LAY LE LEC LECH LED LEFT LEM LEN LENG LENH LEO LEP LET LEU LI LIA " +
        "LICH LIEC LIEM LIEN LIEP LIET LIEU LIKE LIM LIN LINH LIP LIT LIU LO LOA LOAC LOAI LOAN LOAO LOAT " +
        "LOAY LOC LOE LOEM LOEO LOI LOM LON LONG LOP LOT LU LUA LUAN LUAT LUC LUI LUM LUN LUNG LUOC LUOI LUOM " +
        "LUON LUOT LUOU LUP LUT LUU LUY LUYA LUYN LUYT LUYU LY MA MACH MAI MAM MAN MANG MANH MAO MAT MAU MAY " +
        "ME MEC MECH MEM MEN MENA MENG MENH MEO MEP MERS MET MEU MI MIA MICH MIEN MIEP MIET MIEU MIM MINH MIP " +
        "MIU MO MOA MOAM MOAO MOAY MOC MOEM MOEN MOEO MOI MOM MON MONG MOOC MOP MOT MU MUA MUC MUI MUM MUN " +
        "MUNG MUOC MUOI MUOM MUON MUOT MUOU MUP MUT MUU MUY MUYA MUYN MUYU MY NA NAC NACH NAI NAM NAN NANG " +
        "NANH NAO NAP NASA NAT NATO NAU NAY NE NEET NEM NEN NENG NENH NEO NEP NET NEU NGA NGAC NGAI NGAM NGAN " +
        "NGAO NGAP NGAT NGAU NGAY NGHE NGHI NGHY NGO NGOA NGOC NGOE NGOI NGOM NGON NGOP NGOT NGU NGUA NGUC " +
        "NGUI NGUM NGUN NGUP NGUT NGUU NGUY NHA NHAC NHAI NHAM NHAN NHAO NHAP NHAT NHAU NHAY NHE NHEM NHEN " +
        "NHEO NHEP NHET NHEU NHI NHIA NHIM NHIN NHIP NHIT NHIU NHO NHOA NHOC NHOE NHOI NHOM NHON NHOP NHOT " +
        "NHU NHUA NHUC NHUE NHUI NHUM NHUN NHUT NHUY NHY NI NIA NICH NIEM NIEN NIET NIEU NIM NIN NINH NIP NIT " +
        "NIU NO NOA NOAI NOAN NOAO NOAY NOC NOEM NOEN NOEO NOI NOM NON NONG NOP NOT NU NUA NUC NUI NULL NUM " +
        "NUN NUNG NUOC NUOI NUOM NUOT NUP NUT NUY NUYA NUYN NUYU NYOI OA OAC OACH OAI OAM OAN OANG OANH OAO " +
        "OAP OAT OAY OC OE OEO OI OLED OM ON ONG ONNX OOC OP OPEC OR PA PAC PAI PAN PANG PANH PAO PAP PAT PAU " +
        "PEC PECH PEM PENG PEO PET PHA PHAC PHAI PHAM PHAN PHAO PHAP PHAT PHAU PHAY PHE PHEC PHEM PHEN PHEO " +
        "PHEP PHET PHEU PHI PHIA PHIM PHIN PHIT PHIU PHO PHOA PHOC PHOE PHOI PHOM PHON PHOP PHOT PHU PHUA " +
        "PHUC PHUI PHUM PHUN PHUP PHUT PHUY PHY PI PIA PICH PIEU PIM PINH PIP PISA PIT PIU PO POA POAI POAM " +
        "POAN POAO POAY POEN POEO PONG POS POT PU PUA PUI PUM PUNG PUOC PUOI PUY PUYA PUYN PUYU PY QU QUA " +
        "QUAC QUAI QUAM QUAN QUAO QUAP QUAT QUAU QUAY QUE QUEC QUEM QUEN QUEO QUET QUEU QUI QUIA QUIM QUIT " +
        "QUIU QUM QUNG QUO QUOA QUOC QUOE QUOI QUOM QUON QUY QUYA QUYN QUYU RA RAC RACH RAG RAI RAM RAN RANG " +
        "RANH RAO RAT RAU RAY RE RECH REIT REM REN RENG RENH REO REST RET REU RI RIA RIEM RIEN RIET RIEU RIM " +
        "RIN RINH RIP RIT RIU RO ROAI ROAN ROAO ROAT ROAY ROC ROEM ROEN ROEO ROM RON RONG ROP ROT RU RUA RUC " +
        "RUE RUI RUM RUN RUNG RUOC RUOI RUOM RUON RUOT RUOU RUP RUT RUY RUYA RUYN RUYU RY SA SAC SACH SAI SAM " +
        "SAN SANG SANH SAO SAP SARS SAT SAU SAY SE SEA SEAL SECH SEM SEN SENG SENH SEP SET SEU SI SIA SICH " +
        "SIEC SIEM SIEN SIET SIEU SIM SIN SINH SIT SIU SO SOA SOAI SOAM SOAN SOAO SOAP SOAT SOAY SOC SOE SOEM " +
        "SOEN SOEO SOI SOM SON SONG SOOC SOT SOTA SPA STEM SU SUA SUAT SUC SUE SUI SUM SUN SUNG SUOI SUON " +
        "SUOT SUP SUT SUU SUY SUYN SUYT SWAT SY TA TAC TACH TAI TAM TAN TANG TANH TAO TAP TAT TAU TAY TE TEC " +
        "TECH TEM TEN TENG TENH TEO TEP TET TEU THA THAC THAI THAM THAN THAO THAP THAT THAU THAY THE THEM " +
        "THEN THEO THEP THET THEU THI THIA THIM THIN THIP THIT THIU THO THOA THOC THOE THOI THOM THON THOP " +
        "THOT THU THUA THUC THUE THUI THUM THUN THUO THUP THUT THUY THY TI TIA TICH TIEC TIEM TIEN TIEP TIET " +
        "TIEU TIM TIN TINH TIP TIT TIU TO TOA TOAC TOAI TOAM TOAN TOAO TOAT TOAY TOC TOE TOEM TOEN TOEO TOI " +
        "TOM TON TONG TOOC TOT TRA TRAC TRAI TRAM TRAN TRAO TRAP TRAT TRAU TRAY TRE TREC TREM TREN TREO TRET " +
        "TREU TRI TRIA TRIN TRIT TRIU TRO TROA TROC TROE TROI TROM TRON TROP TROT TRU TRUA TRUC TRUE TRUI " +
        "TRUM TRUN TRUP TRUT TRUU TRUY TU TUA TUAN TUAT TUC TUE TUI TUM TUN TUNG TUOC TUOI TUOM TUON TUOT " +
        "TUOU TUP TUT TUU TUY TUYA TUYN TUYT TUYU TY UA UAN UAT UAY UC UE UEFA UM UNG UNIC UNIX UO UOC UOI " +
        "UOM UON UONG UOT UP UT UU UY UYA UYCH UYEN UYN UYNH UYT UYU VA VAC VACH VAI VAM VAN VANG VANH VAO " +
        "VAP VAR VAU VAY VE VEC VECH VEM VEN VENG VENH VEO VET VEU VI VIA VICH VIEC VIEM VIEN VIET VIM VIN " +
        "VINH VIP VIT VIU VO VOAI VOAM VOAN VOAO VOAY VOC VOE VOEM VOEN VOEO VOI VOM VON VONG VOOC VOP VOT VU " +
        "VUA VUC VUCA VUI VUM VUN VUNG VUOC VUON VUOT VUT VUU VUY VUYA VUYN VUYU VY WASP WHEN WIFI XA XAC " +
        "XACH XAI XAM XAN XANG XANH XAO XAP XAT XAU XAY XE XEC XECH XEM XEN XENG XENH XEO XEP XET XEU XI XIA " +
        "XICH XIEC XIEM XIEN XIET XIEU XIM XIN XINH XIT XIU XO XOA XOAC XOAI XOAM XOAN XOAO XOAT XOAY XOC XOE " +
        "XOEM XOEN XOEO XOI XOM XON XONG XOOC XOP XOT XU XUA XUAN XUAT XUAY XUC XUE XUI XUM XUN XUNG XUOC " +
        "XUOI XUOM XUOT XUP XUT XUY XUYA XUYN XUYT XUYU XY YEM YEN YET YEU YOLO").split(" "));
    // Vietnamese-syllable spellings of English name words -> a spelling VieNeu's English engine reads the
    // English way ("tom" -> tˈɑːm). Used only inside an English span ("Tom Hanks", "San Francisco").
    const RESPELL = {
        an: "ann", bay: "bayh", be: "bhe", ben: "benn", bin: "bin", bo: "boh", bon: "bonn", ca: "cah",
        can: "cann", chan: "chann", co: "coh", con: "conn", da: "dah", dan: "dann", di: "dih", do: "do",
        don: "donn", go: "goh", he: "heah", ho: "hoh", hon: "hahn", in: "inn", kim: "kym", king: "kingh",
        la: "lah", lan: "lann", lee: "leeh", leo: "lleo", lin: "linn", lo: "loh", long: "laung", ma: "mah",
        mae: "mey", man: "mann", may: "may", me: "meah", min: "minn", mo: "moh", mon: "mahn", na: "nah",
        nan: "nanne", no: "noh", pa: "pah", pi: "pie", ray: "rae", ron: "ronn", sam: "samh", san: "sanne",
        so: "soh", son: "son", sue: "sueh", ta: "tah", tan: "tann", tim: "timm", tom: "tahm", ton: "tonne",
        van: "vann", vic: "vicc"
    };
    // @generated speech-tables end

    // @generated glossary-say begin: tools/glossary-pron.js --write, do not edit by hand
    // 416 glossary names VieNeu read with Vietnamese sounds as written, and the spelling it reads
    // the English way (checked on its front end, sea_g2p, in a Vietnamese carrier sentence)
    const GLOSSARY_SAY = {
        "$100m offers": "100 <en>m offers</en>",
        "& other stories": "<en>and other stories</en>",
        "(g)i-dle": "<en>(g)i dle</en>",
        "1.5°c": "1.5 <en>c</en>",
        "1080p": "1080 <en>p</en>",
        "11.11": "11.11",
        "2% bha liquid exfoliant": "2 <en>% b h a liquid exfoliant</en>",
        "2nm": "2 <en>nm</en>",
        "3nm": "3 <en>nm</en>",
        "401(k)": "401 <en>k</en>",
        "401k": "401 <en>k</en>",
        "403(b)": "403 <en>b</en>",
        "457(b)": "457 <en>b</en>",
        "4g lte": "4 <en>g l t e</en>",
        "5g": "5 <en>g</en>",
        "85°c bakery": "85 <en>c bakery</en>",
        "911 gt3": "911 <en>g t</en> 3",
        "99% invisible": "99 <en>% invisible</en>",
        "a$ap rocky": "<en>a$ap rocky</en>",
        "a/b testing": "<en>a/b testing</en>",
        "a16z": "<en>a</en> 16 <en>z</en>",
        "aamir khan": "<en>aamir khann</en>",
        "abercrombie & fitch": "<en>abercrombie and fitch</en>",
        "ac/dc": "<en>ac/dc</en>",
        "af1": "<en>a f</en> 1",
        "ag1": "<en>a g</en> 1",
        "agust d": "<en>agust d</en>",
        "ai weiwei": "<en>aih weiwei</en>",
        "ai21 labs": "<en>a i</en> 21 <en>labs</en>",
        "air france-klm": "<en>air france klm</en>",
        "aishwarya rai": "<en>aishwarya raih</en>",
        "akb48": "<en>a k b</en> 48",
        "alexa+": "<en>alexa+</en>",
        "ancestrydna": "<en>ancestrydna</en>",
        "apoe4": "<en>a p o e</en> 4",
        "apple fitness+": "<en>apple fitness+</en>",
        "apple tv+": "<en>apple tv+</en>",
        "applecare+": "<en>applecare+</en>",
        "aps-c": "<en>aps c</en>",
        "arc-agi": "<en>arc agi</en>",
        "asics corporation": "<en>asics corporation</en>",
        "asp.net": "<en>asp.net</en>",
        "aston martin db11": "<en>aston martin d b</en> 11",
        "aston martin db12": "<en>aston martin d b</en> 12",
        "audi rs6": "<en>audi r s</en> 6",
        "audio-technica at2020": "<en>audio technica a t</en> 2020",
        "autocad": "<en>autocad</en>",
        "babyagi": "<en>babyagi</en>",
        "bain & company": "<en>bain and company</en>",
        "balenciaga triple s": "<en>balenciaga triple s</en>",
        "ban ki-moon": "<en>ban ki moon</en>",
        "bang & olufsen": "<en>bang and olufsen</en>",
        "bang si-hyuk": "<en>bang si hyuk</en>",
        "bath & body works": "<en>bath and body works</en>",
        "batna": "<en>batna</en>",
        "bayraktar tb2": "<en>bayraktar t b</en> 2",
        "becky g": "<en>becky g</en>",
        "bed bath & beyond": "<en>bed bath and beyond</en>",
        "ben & jerry's": "<en>ben and jerry's</en>",
        "big-bench": "<en>big bench</en>",
        "bigbang": "<en>bigbang</en>",
        "bmw r 1250 gs": "<en>b m w r</en> 1250 <en>g s</en>",
        "byd han": "<en>b y d hann</en>",
        "byd tang": "<en>b y d tange</en>",
        "c++": "<en>c++</en>",
        "c-ptsd": "<en>c ptsd</en>",
        "c25k": "<en>c</en> 25 <en>k</en>",
        "canal+": "<en>canal+</en>",
        "canon g7x": "<en>canon g</en> 7 <en>x</en>",
        "car-t": "<en>car t</en>",
        "casio f-91w": "<en>casio f</en> 91 <en>w</en>",
        "casio g-shock": "<en>casio g shock</en>",
        "cbt-i": "<en>cbt i</en>",
        "cha eun-woo": "<en>chah eun woo</en>",
        "chappell roan": "<en>chappell roann</en>",
        "character.ai": "<en>character dot a i</en>",
        "chick-fil-a": "<en>chick fil a</en>",
        "cinestill 800t": "<en>cinestill</en> 800 <en>t</en>",
        "circle k": "<en>circle k</en>",
        "cissp": "<en>cissp</en>",
        "citizenm": "<en>citizenm</en>",
        "claude.ai": "<en>claude dot aih</en>",
        "command r": "<en>command r</en>",
        "command r+": "<en>command r+</en>",
        "comptia security+": "<en>comptia security+</en>",
        "copilot+ pc": "<en>copilot+ pc</en>",
        "copy.ai": "<en>copy dot aih</en>",
        "coq au vin": "<en>coq au vin</en>",
        "cosrx": "<en>cosrx</en>",
        "cosrx snail mucin": "<en>cosrx snail mucin</en>",
        "cptsd": "<en>cptsd</en>",
        "cr7": "<en>c r</en> 7",
        "crate & barrel": "<en>crate and barrel</en>",
        "crayon shin-chan": "<en>crayon shin chann</en>",
        "crying in h mart": "<en>crying in h mart</en>",
        "cs2": "<en>c s</en> 2",
        "css3": "<en>c s s</en> 3",
        "custom gpts": "<en>custom gpts</en>",
        "d&d": "<en>d and d</en>",
        "d-id": "<en>d id</en>",
        "d2c": "<en>d</en> 2 <en>c</en>",
        "d3.js": "<en>d</en> 3 <en>js</en>",
        "dall-e 2": "<en>d a l l e</en> 2",
        "dall-e 3": "<en>d a l l e</en> 3",
        "dana k. white": "<en>dana k white</en>",
        "daos": "<en>daos</en>",
        "dave2d": "<en>dave</en> 2 <en>d</en>",
        "david chang": "<en>david change</en>",
        "disney+": "<en>disney+</en>",
        "dodge ram": "<en>dodge ramm</en>",
        "dr. jart+": "<en>dr jart plus</en>",
        "dragon ball z": "<en>dragon ball z</en>",
        "dspy": "<en>dspy</en>",
        "dungeons & dragons": "<en>dungeons and dragons</en>",
        "e = mc2": "<en>e = mc</en> 2",
        "e*trade": "<en>e*trade</en>",
        "e.l.f.": "<en>e.l.f.</en>",
        "e.t. the extra-terrestrial": "<en>e dot t the extra terrestrial</en>",
        "e=mc2": "<en>e mc</en> 2",
        "e=mc²": "<en>e=mc²</en>",
        "ecpm": "<en>ecpm</en>",
        "eileen gu": "<en>eileen guh</en>",
        "eltamd": "<en>eltamd</en>",
        "eltamd uv clear": "<en>eltamd uv clear</en>",
        "epcot": "<en>epcot</en>",
        "eric nam": "<en>eric namm</en>",
        "ernst & young": "<en>ernst and young</en>",
        "eslint": "<en>eslint</en>",
        "esp32": "<en>e s p</en> 32",
        "f-91w": "<en>f</en> 91 <en>w</en>",
        "fafsa": "<en>fafsa</en>",
        "farrow & ball": "<en>farrow and ball</en>",
        "fast & furious": "<en>fast and furious</en>",
        "felv": "<en>felv</en>",
        "ferrari sf90": "<en>ferrari s f</en> 90",
        "fireflies.ai": "<en>fireflies dot aih</en>",
        "florence + the machine": "<en>florence + the machine</en>",
        "flux.1": "<en>f l u x</en> 1",
        "fodmap": "<en>fodmap</en>",
        "four tet": "<en>four tett</en>",
        "fpt corporation": "<en>fpt corporation</en>",
        "fpt play": "<en>fpt play</en>",
        "frances ha": "<en>frances hah</en>",
        "franklin d. roosevelt": "<en>franklin d roosevelt</en>",
        "g-class": "<en>g class</en>",
        "g-dragon": "<en>g dragon</en>",
        "g-idle": "<en>g idle</en>",
        "g-shock": "<en>g shock</en>",
        "g-wagon": "<en>g wagon</en>",
        "galaxy z flip": "<en>galaxy z flip</en>",
        "galaxy z flip 6": "<en>galaxy z flip</en> 6",
        "galaxy z flip 7": "<en>galaxy z flip</en> 7",
        "galaxy z fold": "<en>galaxy z fold</en>",
        "galaxy z fold 6": "<en>galaxy z fold</en> 6",
        "galaxy z fold 7": "<en>galaxy z fold</en> 7",
        "gb200": "<en>g b</en> 200",
        "genesis gv80": "<en>genesis g v</en> 80",
        "gmt-master": "<en>gmt master</en>",
        "graphql": "<en>graphql</en>",
        "graphql api": "<en>graphql api</en>",
        "grpc": "<en>grpc</en>",
        "gs25": "<en>g s</en> 25",
        "gsm8k": "<en>g s m</en> 8 <en>k</en>",
        "gt-r": "<en>gt r</en>",
        "guns n' roses": "<en>guns n' roses</en>",
        "gzclp": "<en>gzclp</en>",
        "h&r block": "<en>h and r block</en>",
        "h-1b": "<en>h</en> 1 <en>b</en>",
        "h-e-b": "<en>h e b</en>",
        "h. pylori": "<en>h pylori</en>",
        "h.264": "<en>h</en> 264",
        "h.265": "<en>h</en> 265",
        "h5n1": "<en>h</en> 5 <en>n</en> 1",
        "ha jung-woo": "<en>hah jung woo</en>",
        "han jisung": "<en>hann jisung</en>",
        "han so-hee": "<en>hann so hee</en>",
        "hasselblad x2d": "<en>hasselblad x</en> 2 <en>d</en>",
        "hba1c": "<en>hb a</en> 1 <en>c</en>",
        "hdr10": "<en>h d r</en> 10",
        "head & shoulders": "<en>head and shoulders</en>",
        "honda cr-v": "<en>honda cr v</en>",
        "honda hr-v": "<en>honda hr v</en>",
        "html5": "<en>h t m l</en> 5",
        "icloud+": "<en>icloud+</en>",
        "ifttt": "<en>ifttt</en>",
        "ilford hp5": "<en>ilford h p</en> 5",
        "imran khan": "<en>imran khann</en>",
        "in-n-out": "<en>in n out</en>",
        "in-n-out burger": "<en>in n out burger</en>",
        "j&t express": "<en>j and t express</en>",
        "jay-z": "<en>jay z</en>",
        "jd.com": "<en>jd.com</en>",
        "ji chang-wook": "<en>ji change wook</en>",
        "johnson & johnson": "<en>johnson and johnson</en>",
        "jstor": "<en>jstor</en>",
        "karol g": "<en>karol g</en>",
        "keurig k-mini": "<en>keurig k mini</en>",
        "khan academy": "<en>khann academy</en>",
        "kip thorne": "<en>kipp thorne</en>",
        "kols": "<en>kols</en>",
        "kung pao chicken": "<en>kung paoh chicken</en>",
        "l&d": "<en>l and d</en>",
        "la 2028": "<en>l a</en> 2028",
        "la clippers": "<en>l a clippers</en>",
        "la fitness": "<en>l a fitness</en>",
        "la galaxy": "<en>l a galaxy</en>",
        "laion-5b": "<en>l a i o n</en> 5 <en>b</en>",
        "lamda": "<en>lah m d a</en>",
        "langgraph": "<en>lange graph</en>",
        "langsmith": "<en>lange smith</en>",
        "le sserafim": "<en>le sserafim</en>",
        "leonardo.ai": "<en>leonardo dot aih</en>",
        "lg h&h": "<en>lg h and h</en>",
        "lgbtq": "<en>lgbtq</en>",
        "lgbtq+": "<en>lgbtq+</en>",
        "lightgbm": "<en>lightgbm</en>",
        "lipoprotein(a)": "<en>lipoprotein(a)</en>",
        "lisa": "<en>lisa</en>",
        "litert": "<en>litert</en>",
        "lmarena": "<en>lmarena</en>",
        "lmsys": "<en>lmsys</en>",
        "logitech g pro": "<en>logitech g pro</en>",
        "lora": "<en>lora</en>",
        "low fodmap": "<en>low fodmap</en>",
        "lp(a)": "<en>lp(a)</en>",
        "lumix gh6": "<en>lumix g h</en> 6",
        "m&m's": "<en>m and m's</en>",
        "m&s": "<en>m and s</en>",
        "m.d.": "<en>m.d.</en>",
        "mane 'n tail": "<en>mane 'n tail</en>",
        "maserati mc20": "<en>maserati m c</en> 20",
        "masld": "<en>masld</en>",
        "matlab": "<en>matlab</en>",
        "mckinsey & company": "<en>mckinsey and company</en>",
        "mclaren 720s": "<en>mc laren</en> 720 <en>s</en>",
        "mclaren 750s": "<en>mc laren</en> 750 <en>s</en>",
        "mercedes g-class": "<en>mercedes g class</en>",
        "mercedes g-wagon": "<en>mercedes g wagon</en>",
        "mercedes s-class": "<en>mercedes s class</en>",
        "mercedes-amg": "<en>mercedes amg</en>",
        "meta quest 3s": "<en>meta quest</en> 3 <en>s</en>",
        "michelle phan": "<en>michelle phann</en>",
        "mini cooper s": "<en>mini cooper s</en>",
        "miralax": "<en>miralax</en>",
        "mkbhd": "<en>mkbhd</en>",
        "mlflow": "<en>mlflow</en>",
        "mmlu-pro": "<en>mmlu pro</en>",
        "model s": "<en>model s</en>",
        "model s plaid": "<en>model s plaid</en>",
        "moma": "<en>moma</en>",
        "moocs": "<en>moocs</en>",
        "morris chang": "<en>morris change</en>",
        "motogp": "<en>motogp</en>",
        "motorola razr+": "<en>motorola razr+</en>",
        "mp3": "<en>m p</en> 3",
        "mp4": "<en>m p</en> 4",
        "mrna": "<en>mrna</en>",
        "mrna vaccine": "<en>mrna vaccine</en>",
        "msnbc": "<en>msnbc</en>",
        "mx master 3s": "<en>m x master</en> 3 <en>s</en>",
        "n seoul tower": "<en>n seoul tower</en>",
        "n8n": "<en>n</en> 8 <en>n</en>",
        "nad+": "<en>nad+</en>",
        "nafld": "<en>nafld</en>",
        "nam joo-hyuk": "<en>namm joo hyuk</en>",
        "nbcuniversal": "<en>nbcuniversal</en>",
        "nestjs": "<en>nestjs</en>",
        "new balance 1906r": "<en>new balance</en> 1906 <en>r</en>",
        "new balance 2002r": "<en>new balance</en> 2002 <en>r</en>",
        "nfts": "<en>nfts</en>",
        "nhtsa": "<en>nhtsa</en>",
        "nissan gt-r": "<en>nissan gt r</en>",
        "nissan z": "<en>nissan z</en>",
        "notebooklm plus": "<en>notebooklm plus</en>",
        "nothing ear (a)": "<en>nothing ear (a)</en>",
        "nsaids": "<en>nsaids</en>",
        "nsuns": "<en>nsuns</en>",
        "nusrat fateh ali khan": "<en>nusrat fateh ali khann</en>",
        "nvlink": "<en>nvlink</en>",
        "nvme": "<en>nvme</en>",
        "ob-gyn": "<en>ob gyn</en>",
        "okrs": "<en>okrs</en>",
        "omega sa": "<en>omega s a</en>",
        "osiris-rex": "<en>osiris rex</en>",
        "otter.ai": "<en>otter dot aih</en>",
        "pac-man": "<en>pac man</en>",
        "pailin's kitchen": "<en>pailin s kitchen</en>",
        "palm": "<en>palm</en>",
        "palm 2": "<en>pa l m</en> 2",
        "pandora a/s": "<en>pandora a/s</en>",
        "paramount+": "<en>paramount+</en>",
        "park chan-wook": "<en>park chann wook</en>",
        "park hang-seo": "<en>park hange seo</en>",
        "ph": "<en>ph</en>",
        "pixel 7a": "<en>pixel</en> 7 <en>a</en>",
        "pixel 8a": "<en>pixel</en> 8 <en>a</en>",
        "pixel 9a": "<en>pixel</en> 9 <en>a</en>",
        "playstation vr2": "<en>play station v r</en> 2",
        "porsche 911 gt3": "<en>porsche</en> 911 <en>g t</en> 3",
        "proraw": "<en>proraw</en>",
        "ps2": "<en>p s</en> 2",
        "ps3": "<en>p s</en> 3",
        "ps4": "<en>p s</en> 4",
        "ps5": "<en>p s</en> 5",
        "ps5 pro": "<en>p s</en> 5 <en>pro</en>",
        "psvr2": "<en>p s v r</en> 2",
        "pull&bear": "<en>pull and bear</en>",
        "punkt mp02": "<en>punkt m p</en> 02",
        "qlora": "<en>qlora</en>",
        "qtcinderella": "<en>qtcinderella</en>",
        "radwimps": "<en>radwimps</en>",
        "ram dass": "<en>ramm dass</en>",
        "ram trx": "<en>ramm t r x</en>",
        "ray-ban": "<en>ray ban</en>",
        "re/max": "<en>re/max</en>",
        "readme": "<en>readme</en>",
        "reits": "<en>reits</en>",
        "restful api": "<en>restful api</en>",
        "rhino 3d": "<en>rhino</en> 3 <en>d</en>",
        "risc-v": "<en>risc v</en>",
        "rivian r1s": "<en>rivian r</en> 1 <en>s</en>",
        "rivian r1t": "<en>rivian r</en> 1 <en>t</en>",
        "rlaif": "<en>r l a i f</en>",
        "robots.txt": "<en>robots.txt</en>",
        "rode nt-usb": "<en>rode nt usb</en>",
        "rolex gmt-master ii": "<en>rolex gmt master ii</en>",
        "rolex sa": "<en>rolex s a</en>",
        "roth 401(k)": "<en>roth</en> 401 <en>k</en>",
        "rstudio": "<en>rstudio</en>",
        "s-log": "<en>s log</en>",
        "s.coups": "<en>s.coups</en>",
        "s1mple": "<en>s</en> 1 <en>mple</en>",
        "sagittarius a*": "<en>sagittarius a*</en>",
        "sal khan": "<en>sal khann</en>",
        "salman khan": "<en>salman khann</en>",
        "samuel l. jackson": "<en>samuel l jackson</en>",
        "sdgs": "<en>sdgs</en>",
        "security+": "<en>security+</en>",
        "serie a": "<en>serie a</en>",
        "shah rukh khan": "<en>shah rukh khann</en>",
        "shangri-la": "<en>shangri lah</en>",
        "shin min-a": "<en>shin min a</en>",
        "shinee": "<en>shinee</en>",
        "shure mv7": "<en>shure m v</en> 7",
        "shure sm7b": "<en>shure s m</en> 7 <en>b</en>",
        "sk-ii": "<en>sk ii</en>",
        "sk-ii facial treatment essence": "<en>sk ii facial treatment essence</en>",
        "smes": "<en>smes</en>",
        "solidjs": "<en>solidjs</en>",
        "sony a7c": "<en>sony a</en> 7 <en>c</en>",
        "sony a7r v": "<en>sony a</en> 7 <en>r v</en>",
        "spo2": "<en>sp o</en> 2",
        "sqlite": "<en>sqlite</en>",
        "ssense": "<en>ssense</en>",
        "ssris": "<en>ssris</en>",
        "stronglifts 5x5": "<en>strong lifts</en> 5 <en>x</en> 5",
        "subscribe & save": "<en>subscribe and save</en>",
        "swe-agent": "<en>swe agent</en>",
        "swe-bench": "<en>swe bench</en>",
        "swe-bench verified": "<en>swe bench verified</en>",
        "t-bone": "<en>t bone</en>",
        "t-mobile": "<en>t mobile</en>",
        "t.j. maxx": "<en>t dot j maxx</en>",
        "t3.gg": "<en>t</en> 3 <en>gg</en>",
        "tbjzl": "<en>tbjzl</en>",
        "tedx": "<en>tedx</en>",
        "tensorrt": "<en>tensorrt</en>",
        "tensorrt-llm": "<en>tensorrt llm</en>",
        "teresa teng": "<en>teresa tengg</en>",
        "tesla model s plaid": "<en>tesla model s plaid</en>",
        "tiffany & co.": "<en>tiffany and co.</en>",
        "tiffany t": "<en>tiffany t</en>",
        "timthetatman": "<en>timm the tatman</en>",
        "tobi lütke": "<en>tobi l tke</en>",
        "top-k": "<en>top k</en>",
        "toyota gr86": "<en>toyota g r</en> 86",
        "toyota rav4": "<en>toyota r a v</en> 4",
        "triple s": "<en>triple s</en>",
        "truthfulqa": "<en>truthfulqa</en>",
        "tu munich": "<en>t u munich</en>",
        "usmle": "<en>usmle</en>",
        "usmnt": "<en>usmnt</en>",
        "uswnt": "<en>uswnt</en>",
        "viktor&rolf flowerbomb": "<en>viktor and rolf flowerbomb</en>",
        "vinfast lux a2.0": "<en>vin fast lux a</en> 2.0",
        "vinfast lux sa2.0": "<en>vin fast lux s a</en> 2.0",
        "vivian tu": "<en>vivian tuh</en>",
        "vlookup": "<en>vlookup</en>",
        "vng corporation": "<en>vng corporation</en>",
        "vnpay": "<en>vnpay</en>",
        "vram": "<en>vram</en>",
        "vtsax": "<en>vtsax</en>",
        "w2s": "<en>w</en> 2 <en>s</en>",
        "wahoo kickr": "<en>wahoo kickr</en>",
        "wahoo tickr": "<en>wahoo tickr</en>",
        "wall-e": "<en>wall e</en>",
        "walmart+": "<en>walmart+</en>",
        "webgl": "<en>webgl</en>",
        "webrtc": "<en>webrtc</en>",
        "weights & biases": "<en>weights and biases</en>",
        "west ham united": "<en>west hamm united</en>",
        "wet n wild": "<en>wet n wild</en>",
        "wi ha-joon": "<en>wi hah joon</en>",
        "xanh sm": "<en>xahnhh s m</en>",
        "xbox series s": "<en>xbox series s</en>",
        "xgboost": "<en>xgboost</en>",
        "xiaomi su7": "<en>xiaomi s u</en> 7",
        "xlookup": "<en>xlookup</en>",
        "y2k": "<en>y</en> 2 <en>k</en>",
        "yagni": "<en>yagni</en>",
        "yamaha hs8": "<en>yamaha h s</en> 8",
        "yolov8": "<en>y o l ov</en> 8",
        "zalo oa": "<en>zalo o a</en>",
        "zing mp3": "<en>zing m p</en> 3"
    };
    // @generated glossary-say end

    // ---- Lexicon: names worth knowing. [surface, category, say]. `say` only where VieNeu's reading of
    // the surface is wrong, each one checked on its phonemizer (tools/pron-eval.js). A lexicon entry
    // is also evidence: a Vietnamese-syllable word inside one is an English name ("Tom Hanks").
    const ENTRIES = [
        // brands, products, companies
        ["Google", "brand"], ["Google Ads", "brand"], ["Google Cloud", "brand"], ["Google Cloud Next", "product"],
        ["YouTube", "brand"], ["YouTube Shorts", "product"], ["TikTok", "brand"], ["Facebook", "brand"], ["Instagram", "brand"],
        ["WhatsApp", "brand"], ["Netflix", "brand"], ["Spotify", "brand"], ["Apple", "brand"], ["iPhone", "product"], ["iPad", "product"],
        ["MacBook", "product"], ["MacBook Pro", "product"], ["MacBook Air", "product"], ["Microsoft", "brand"], ["Microsoft Excel", "product"],
        ["PowerPoint", "product"], ["Amazon", "brand"], ["Tesla", "brand"], ["SpaceX", "brand"], ["LinkedIn", "brand"], ["GitHub", "brand"],
        ["PlayStation", "product"], ["OpenAI", "brand"], ["ChatGPT", "product"], ["Claude", "product"], ["Anthropic", "brand"],
        ["Gemini", "product"], ["DeepMind", "brand"], ["Canva", "brand"], ["Adobe", "brand"], ["Photoshop", "product"],
        ["Midjourney", "product"], ["McDonald's", "brand", "<en>mcdonald's</en>"], ["Performance Max", "product"],
        ["Python", "product"], ["JavaScript", "product"], ["PyTorch", "product"], ["TensorFlow", "product"],
        // people
        ["Leonardo DiCaprio", "person", "Leonardo <en>dicaprio</en>"], ["DiCaprio", "person", "<en>dicaprio</en>"],
        ["Timothée Chalamet", "person", "<en>timothee shalamay</en>"], ["Chalamet", "person", "<en>shalamay</en>"],
        ["Saoirse Ronan", "person", "<en>seersha</en> Ronan"], ["Cillian Murphy", "person", "<en>killian</en> Murphy"],
        ["Christopher Nolan", "person"], ["Scarlett Johansson", "person"], ["Emma Stone", "person"], ["Ryan Gosling", "person"],
        ["Tom Hanks", "person"], ["Tom Cruise", "person"], ["Elon Musk", "person"], ["Bill Gates", "person"], ["Steve Jobs", "person"],
        ["Mark Zuckerberg", "person"], ["Taylor Swift", "person"],
        // places
        ["New York", "place"], ["Los Angeles", "place"], ["San Francisco", "place"], ["San Diego", "place"], ["San Jose", "place"],
        ["Las Vegas", "place"], ["Silicon Valley", "place"], ["Hollywood", "place"], ["London", "place"],
        // 1.9.5: a first word that is also a Vietnamese syllable, read Vietnamese unless known (RESPELL)
        ["Long Beach", "place"], ["Long Island", "place"], ["Bay Area", "place"],
        // titles
        ["La La Land", "title", "<en>lah lah land</en>"], ["Oppenheimer", "title"],
        // terms said as one unit
        ["machine learning", "term"], ["deep learning", "term"], ["large language model", "term"], ["neural network", "term"],
        ["reinforcement learning", "term"], ["prompt engineering", "term"], ["performance marketing", "term"],
        ["conversion rate", "term"], ["computer vision", "term"], ["natural language processing", "term"], ["fine-tuning", "term"],
        ["landing page", "term"], ["call to action", "term"], ["search engine optimization", "term"], ["cost per click", "term"],
        ["return on investment", "term"], ["gradient descent", "term"],
        // all-caps said as a word, or said differently from its letters
        ["NVIDIA", "brand", "<en>nvidia</en>"],   // VieNeu drops both I's of the capitals: "n v d a"
        ["IKEA", "acronym"], ["NASA", "acronym"], ["NATO", "acronym"], ["FIFA", "acronym"], ["UEFA", "acronym"],
        ["UNESCO", "acronym"], ["UNICEF", "acronym"], ["ASEAN", "acronym"], ["OPEC", "acronym"], ["COVID", "acronym"],
        ["JPEG", "acronym", "<en>jay peg</en>"],
        // 2.5.8: brands and AI names VieNeu reads wrong as written, each checked on its phonemizer
        ["CRISPR", "acronym", "<en>crisper</en>"], ["Nginx", "product", "<en>engine x</en>"], ["NGINX", "product", "<en>engine x</en>"],
        ["Oura", "brand", "<en>ora</en>"], ["Oura Ring", "product", "<en>ora ring</en>"], ["Huawei", "brand", "<en>wahway</en>"],
        ["Xiaomi", "brand", "<en>shaomee</en>"], ["GoPro", "brand", "<en>go pro</en>"],
        ["Qwen", "product", "<en>chuen</en>"], ["Groq", "brand", "<en>grock</en>"], ["xAI", "brand", "<en>x a i</en>"],
        ["NotebookLM", "product", "<en>notebook l m</en>"], ["DALL-E", "product", "<en>dolly</en>"],
        ["LangChain", "product", "<en>langchain</en>"], ["OPENAI", "brand", "<en>open a i</en>"],
        ["WHOOP", "brand"], ["Garmin", "brand"], ["Strava", "brand"], ["Fitbit", "brand"], ["Apple Watch", "product"],
        ["DeepSeek", "brand"], ["Perplexity", "product"], ["Mistral", "brand"], ["Llama", "product"], ["Sora", "product"],
        ["Veo", "product"], ["ElevenLabs", "brand"], ["Hugging Face", "brand"], ["Stable Diffusion", "product"]
    ];
    const LEX = new Map();
    let LEX_MAX = 1;
    const memo = new Map(), renderMemo = new Map();
    function addEntry(surface, cat = "name", say = null) {
        const key = String(surface).trim().toLowerCase().replace(/\s+/g, " ");
        if (!key) return;
        LEX.set(key, { surface: String(surface).trim(), cat, say: say || null });
        LEX_MAX = Math.max(LEX_MAX, key.split(" ").length);
        memo.clear(); renderMemo.clear();
    }
    for (const [surface, cat, say] of ENTRIES) addEntry(surface, cat, say);
    // Optional local additions (no UI): root.CST_SPEECH_LEXICON = [[surface, category, say], ...] set
    // before the first analysis; addEntry() at any time.
    let extraLoaded = false;
    function loadExtra() {
        if (extraLoaded) return;
        extraLoaded = true;
        const extra = root && Array.isArray(root.CST_SPEECH_LEXICON) ? root.CST_SPEECH_LEXICON : [];
        for (const e of extra) if (Array.isArray(e) && typeof e[0] === "string") addEntry(e[0], e[1], e[2]);
        loadGlossaryNames();
    }

    // 2.6.0: every name and term the glossary keeps in English ("Kim Kardashian", "Eight Sleep",
    // "Long Beach") reaches the subtitle as written, so it is evidence that its words are English:
    // a lexicon unit, said in one piece, its Vietnamese-syllable words respelled the English way.
    // Not a term the glossary renders in Vietnamese, and never a Vietnamese name: none with
    // Vietnamese diacritics, no lone Vietnamese syllable ("Kim"), no two capitalised Vietnamese
    // syllables side by side ("Ho Chi Minh", "Ha Long Bay"). An entry already here keeps its reading.
    // Category "glossary" adds no all-caps reading of its own ("HRV" stays letters).
    function glossaryName(term) {
        const words = term.split(/\s+/);
        if (words.length > 6 || DIACRITIC.test(term)) return false;
        if (VI_CAPS.has(term)) return false;   // "SSI", "VTV": Vietnamese letter names, as Vietnamese say them
        const cores = words.map(w => possessive(w).replace(/[^A-Za-z]/g, ""));
        const viet = cores.map(w => !!w && isViet(w));
        if (viet.every(Boolean)) return false;
        for (let i = 1; i < cores.length; i++) if (viet[i] && viet[i - 1] && capitalised(cores[i]) && capitalised(cores[i - 1])) return false;
        return true;
    }
    function loadGlossaryNames() {
        const groups = root && root.CST_GLOSSARY_GROUPS;
        if (!groups) return;
        for (const g of Object.values(groups)) {
            const vi = g.vi || {};
            for (const t of g.terms || []) {
                const key = String(t).trim().toLowerCase().replace(/\s+/g, " ");
                if (!key || vi[key] || LEX.has(key) || !glossaryName(t)) continue;
                LEX.set(key, { surface: String(t).trim(), cat: "glossary", say: GLOSSARY_SAY[key] || null });
                LEX_MAX = Math.max(LEX_MAX, key.split(" ").length);
            }
        }
        memo.clear(); renderMemo.clear();
    }

    // All-caps codes VieNeu spells with Vietnamese letter names, and Vietnamese say that way too
    // (broadcasters, banks, firms): left alone
    const VI_CAPS = new Set(("VTV VOV HTV VTC VNPT EVN FPT VNG SJC PNJ BIDV VCB TCB ACB VIB SHB HDB VPB MSB OCB SCB TPB " +
        "XHCN CHXHCN VN TPHCM THPTQG " +
        // 2.2.4 (BACKLOG 24): common Vietnamese abbreviations and stock tickers VieNeu's table misses,
        // which were sent as English letters ("DN" doanh nghiệp read "dee en")
        "DN DNNVV NHNN CTCP TMCP TTCK XNK SXKD QH NQ TT BYT BGD BGDĐT SGK HS GV SV ThS HNX " +
        "HPG VNM MWG SSI VPS VIC VHM MSN VJC HVN GAS PLX VRE STB CTG").split(" "));
    // English codes VieNeu spells with Vietnamese letter names that stay English letters even when
    // the source line spells them out: a Vietnamese reader says these the English way
    const EN_SPELLED = new Set("QA PDF URL NFT TCP WAN SMB USB".split(" "));
    // English initialisms said letter by letter even where VieNeu reads a word, or where its table
    // stops (5 letters)
    const INITIALISMS = new Set("HTTPS HR PR CPC CPM CPA ROI TPM SEM AWS GCP ETL CSV UCLA USDA".split(" "));

    // 2.5.8: an all-caps code shaped like an English word ("WHOOP", "NIKE", "LEGO", "SONY") is a name
    // said as a word. VieNeu spells it with Vietnamese letter names ("vê kép hát ô ô phê"), and English
    // letters ("n i k e") are no better. Word-shaped: 4+ letters, every vowel run 1-2 letters, every
    // consonant run one English can start, end or join a word with. "UCLA", "USDA" pass the shape and
    // are letters (INITIALISMS); "HTML", "CPAP", "IELTS" fail it.
    const ONSETS = new Set("BL BR CH CL CR DR FL FR GL GR KL KN KR PH PL PR SC SH SK SL SM SN SP ST SW TH TR TW WH WR QU SCR SPR STR SPL THR SHR SCH".split(" "));
    const CODAS = new Set("CH CK CT FT GH LD LF LK LL LM LP LT MB MP MS ND NG NK NS NT PH PS PT RB RC RD RF RG RK RL RM RN RP RS RT SH SK SP SS ST TH TS XT FF ZZ DS GS".split(" "));
    function wordShaped(p) {
        if (p.length < 4 || !/^[A-Z]+$/.test(p)) return false;
        // Y is a vowel except before a vowel or at the start ("YOLO", "SONY")
        const kinds = [...p].map((c, i) => /[AEIOU]/.test(c) || (c === "Y" && i > 0 && !/[AEIOU]/.test(p[i + 1] || "")) ? "V" : "C");
        const runs = [];
        for (let i = 0; i < p.length; i++) {
            if (i && kinds[i] === kinds[i - 1]) runs[runs.length - 1].s += p[i];
            else runs.push({ k: kinds[i], s: p[i] });
        }
        if (!runs.some(r => r.k === "V")) return false;
        return runs.every((r, i) => {
            if (r.k === "V") return r.s.length <= 2;
            if (r.s.length === 1) return true;
            if (i === 0) return ONSETS.has(r.s);
            if (i === runs.length - 1) return CODAS.has(r.s);
            if (r.s.length === 2) return /^[LMNRS]/.test(r.s) || r.s[0] === r.s[1] || ONSETS.has(r.s) || CODAS.has(r.s);
            return r.s.length === 3 && (ONSETS.has(r.s.slice(1)) || CODAS.has(r.s.slice(0, 2)));
        });
    }

    // ---- How sure we are that a word is English (1.8.0) ----
    // A word VieNeu would read Vietnamese is rewritten only at HIGH_EN. Evidence adds up; a Vietnamese
    // name read the English way is heard at once, a missed English reading much less, so one decisive
    // Vietnamese clue outweighs any English one and a lone clue of either kind is not enough.
    const CONF = { decisive: 10, strong: 5, weak: 2, high: 3 };
    const HIGH_EN = "high-en", AMBIGUOUS = "ambiguous", HIGH_VI = "high-vi";
    const confState = score => score >= CONF.high ? HIGH_EN : score <= -CONF.high ? HIGH_VI : AMBIGUOUS;
    // Vietnamese titles before a name ("chị Kim", "ông Dan"): weak, a translator adds them to foreign
    // names too ("anh Tom" for "Tom")
    const TITLES = new Set("anh chị ông bà cô chú bác em cậu thầy dì mợ thím".split(" "));
    // Respelled words that are mostly a first name or a name particle, not a Vietnamese function word
    // ("Con", "So", "In", "Ca" at the start of a sentence are Vietnamese): only these are a name at the
    // start of a sentence, before an English surname ("Sam Altman ...", "Don Norman ...")
    const NAME_WORDS = new Set("ben dan don kim lee lin ron sam san sue tim tom van vic".split(" "));
    // English given names no Vietnamese person carries unaccented: a lone one is English when the
    // English source line names them ("Tom said ..."). Not Lan, An, Kim, Dan (Dân), Van (Văn), Tan
    // (Tân): an English video about a Vietnamese person writes those the same way. "Ben" is no
    // Vietnamese word unaccented (VieNeu still reads it as one)
    const EN_GIVEN = new Set("ben tom tim ron don sue vic lee sam".split(" "));
    const ENGLISH_LINE = /(^|[^\p{L}])(the|a|an|is|are|was|were|and|to|of|he|she|it|i|you|we|they|said|says|told|me|my|his|her|just|has|had|have)(?![\p{L}])/iu;
    const VOWEL_CAPS = /[AEIOUY]/;

    const possessive = s => s.replace(/['’]s$/i, "");
    const capitalised = s => /^\p{Lu}/u.test(s);
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // ---- token shapes ----
    function shapeOf(s) {
        const p = possessive(s);
        if (!/\p{L}/u.test(p)) return /\d/.test(p) ? "num" : "other";
        if (/^\d+[a-z]{1,2}$/.test(p)) return "num";                             // 4o, 70b
        if (/^[A-ZĐ]{2,12}$/.test(p)) return "caps";                          // "SAMSUNG" too (2.5.8)
        if (/^[A-Z]\d{1,4}[a-z]?$/.test(p)) return "code";                        // M3, S25, A100
        if (/^[A-Za-z]+$/.test(p) && /[a-z][A-Z]|[A-Z]{2}[a-z]/.test(p)) return "camel";
        if (/^[A-Za-z]+(?:-[A-Za-z]+)+$/.test(p)) return p.split("-").every(isViet) ? "vi" : "en";   // machine-learning
        if (DIACRITIC.test(p)) return /^[\p{Script=Latin}'’-]+$/u.test(p) && !isViet(p) && !/[ăâđêôơư]/i.test(p) ? "en" : "vi";
        if (/^[A-Za-z'’]+$/.test(p)) return isViet(p) ? "ambig" : "en";
        return "other";
    }

    // How VieNeu reads an all-caps code: "en" English already, "vi" its Vietnamese expansion, "word"
    // read as one word, "spelled" Vietnamese letter names (the one to fix). Its table covers 2-4 letters;
    // a longer code inside a Vietnamese sentence it spells too unless its own dictionary knows the word
    // ("NASDAQ", "UNESCO"), which cannot be listed here (measured 2026-10-17: "WHOOP", "GARMIN").
    function capsClass(p) {
        if (/Đ/.test(p) || VI_CAPS.has(p)) return "vi";
        if (INITIALISMS.has(p)) return CAPS_EN.has(p) ? "en" : "spelled";
        if (p.length > 4) return "spelled";
        if (CAPS_EN.has(p)) return "en";
        if (CAPS_VI.has(p)) return "vi";
        if (CAPS_WORD.has(p)) return "word";
        return "spelled";
    }

    // camelCase pieces: "ChatGPT" -> Chat GPT, "DiCaprio" -> Di Caprio, "iPhone" -> i Phone
    const camelPieces = s => s.match(/[A-Z]{2,}(?![a-z])|[A-Z]?[a-z]+|[A-Z]/g) || [s];

    // ---- analysis ----
    function analyze(text, ctx = {}) {
        loadExtra();
        const key = String(text || "") + "\u0001" + (ctx.source || "");
        let hit = memo.get(key);
        if (hit) return hit;
        hit = analyzeUncached(String(text || ""), ctx);
        if (memo.size >= 600) memo.clear();
        memo.set(key, hit);
        return hit;
    }

    function analyzeUncached(text, ctx) {
        const toks = SEG ? SEG.tokenize(text) : text.split(/\s+/).filter(Boolean).map(raw => ({ raw, lead: "", trail: "" }));
        const source = String(ctx.source || "");
        const englishSource = !!source && ENGLISH_LINE.test(source);
        const inSource = w => new RegExp(`(^|[^\\p{L}])${esc(w)}(?![\\p{L}])`, "u").test(source);
        const inSourceAnyCase = w => new RegExp(`(^|[^\\p{L}])${esc(w)}(?![\\p{L}])`, "iu").test(source);
        const tokens = toks.map((t, i) => {
            const lead = t.lead || "", trail = t.trail || "";
            const s = t.raw.slice(lead.length, t.raw.length - trail.length);
            return { i, raw: t.raw, lead, trail, s, shape: shapeOf(s), unit: -1, span: -1, strong: false, score: 0, conf: null };
        });
        const joined = (a, b) => !tokens[a].trail && !tokens[b].lead;
        // A line in capitals ("ĐỪNG BAO GIỜ"): its capital words are Vietnamese
        const capsWords = tokens.filter(t => /^\p{Lu}{2,}$/u.test(t.s));
        const shouting = capsWords.some(t => DIACRITIC.test(t.s)) || (capsWords.length >= 3 && capsWords.some(t => isViet(t.s)));
        const startsSentence = k => k === 0 || /[.!?…:;"“(]$/.test(tokens[k - 1].trail) || /^["“(]/.test(tokens[k].lead);

        // 1. lexicon units, longest match first, never across punctuation
        const units = [];
        for (let i = 0; i < tokens.length; i++) {
            for (let len = Math.min(LEX_MAX, tokens.length - i); len >= 1; len--) {
                let ok = true;
                for (let k = i; k < i + len - 1; k++) if (!joined(k, k + 1)) { ok = false; break; }
                if (!ok) continue;
                const words = tokens.slice(i, i + len).map(t => t.s);
                const k1 = words.join(" ").toLowerCase();
                const k2 = words.slice(0, -1).concat(possessive(words[len - 1])).join(" ").toLowerCase();
                // a name ending in a full stop ("M.D.", "e.l.f."): the tokenizer gives the stop to the trail
                const e = LEX.get(k1) || LEX.get(k2) || (/^\./.test(tokens[i + len - 1].trail) ? LEX.get(k1 + ".") : undefined);
                if (!e) continue;
                // a one-word entry that is also a Vietnamese word counts only with its own case
                if (len === 1 && tokens[i].shape === "ambig" && possessive(tokens[i].s) !== e.surface) continue;
                const id = units.length;
                units.push({ a: i, b: i + len - 1, cat: e.cat, say: e.say && k1 === e.surface.toLowerCase() ? e.say : null, surface: e.surface });
                for (let k = i; k < i + len; k++) tokens[k].unit = id;
                i += len - 1;
                break;
            }
        }

        // 2. runs: lexicon units, English words, capitalised names, and the numbers of a model or
        //    version ("Gemini 2 chấm 5 Flash", "RTX 5090", "iPhone 17 Pro")
        // A code the glossary keeps in English that VieNeu's own table expands to Vietnamese words
        // ("CUDA", "BTC") is English letters or a word; the Vietnamese codes we know (VI_CAPS) stay
        for (const t of tokens) {
            if (t.shape !== "caps") continue;
            const p = possessive(t.s);
            t.cls = capsClass(p);
            if (t.cls === "vi" && t.unit >= 0 && units[t.unit].cat === "glossary" && !VI_CAPS.has(p) && !/Đ/.test(p)) t.cls = "spelled";
        }
        const englishCaps = t => {
            if (t.shape !== "caps") return false;
            const p = possessive(t.s), c = t.cls;
            if (c === "vi" || (shouting && isViet(p))) return false;
            if (c === "word") return !isViet(p);
            // an unknown code the English source line does not have was written by the translator,
            // so it is a Vietnamese abbreviation ("DN" for "businesses"), read with Vietnamese letters
            // ("Whoop" in the source and "WHOOP" here is the same name)
            if (c === "spelled" && englishSource && !INITIALISMS.has(p) && !EN_SPELLED.has(p) && !inSourceAnyCase(p)) return false;
            return true;
        };
        const english = t => t.unit >= 0 || t.shape === "en" || (t.shape === "camel" && !VI_CAPS.has(possessive(t.s))) || englishCaps(t);
        const num = t => t.shape === "num";
        const member = t => english(t) || t.shape === "code" || (t.shape === "ambig" && capitalised(t.s));
        const spans = [];
        let i = 0;
        while (i < tokens.length) {
            if (!member(tokens[i])) { i++; continue; }
            let j = i;
            for (;;) {
                const n = tokens[j + 1];
                if (!n || !joined(j, j + 1)) break;
                const prev = tokens[j];
                let ok = false;
                if (english(n) || n.shape === "code") ok = true;
                else if (n.shape === "ambig") ok = capitalised(n.s) && capitalised(prev.s) && !num(prev);
                else if (num(n)) ok = true;
                else if (n.s === "chấm") ok = num(prev) && !!tokens[j + 2] && num(tokens[j + 2]) && joined(j + 1, j + 2);
                if (!ok) break;
                j++;
            }
            const run = tokens.slice(i, j + 1);
            if (run.some(english)) {
                const id = spans.length;
                const inUnits = [...new Set(run.filter(t => t.unit >= 0).map(t => t.unit))].map(u => units[u]);
                let cat;
                if (inUnits.length === 1 && inUnits[0].a === i && inUnits[0].b === j) cat = inUnits[0].cat;
                else if (run.some(t => num(t) || t.shape === "code")) cat = "model";
                else if (run.length === 1 && run[0].shape === "caps") cat = "initialism";
                else if (run.every(t => capitalised(t.s))) cat = "name";
                else cat = "term";
                spans.push({ id, a: i, b: j, cat, text: run.map(t => t.s).join(" ") });
                for (let k = i; k <= j; k++) tokens[k].span = id;
            }
            i = j + 1;
        }

        // 3. how sure we are that a word is English where VieNeu would read it Vietnamese (1.8.0: a
        //    score, see CONF). English clues: inside a lexicon unit; the English source line has it next
        //    to the same word ("Dan Brown"); capitalised mid-sentence next to a capitalised English word
        //    ("của Tom Cruise"); a first name opening the sentence before an English surname that is not a
        //    brand ("Sam Altman ...", not "So Google"); a lone given name the English source line names
        //    ("Tom said" -> "Tom kể"). Vietnamese clues: a Vietnamese name word beside it ("Nguyễn Văn
        //    Dan", decisive), a title before it ("chị Kim", weak), a line in capitals (decisive).
        const pair = (x, y) => source && new RegExp(`(^|[^\\p{L}])${esc(x.s)}\\s+${esc(y.s)}([^\\p{L}]|$)`, "u").test(source);
        const named = x => englishSource && new RegExp(`(^|[^\\p{L}])${esc(possessive(x.s))}(?![\\p{L}])`, "u").test(source);
        // a capitalised Vietnamese word that is part of a name: not a title, not just the sentence's first word
        const viName = x => x && capitalised(x.s) && x.shape === "vi" && !TITLES.has(x.s.toLowerCase()) && !startsSentence(x.i);
        const ambigScore = (k, sp) => {
            const t = tokens[k];
            if (t.unit >= 0) return CONF.decisive;
            if (shouting) return -CONF.decisive;
            const w = possessive(t.s).toLowerCase();
            const before = k > 0 && joined(k - 1, k) ? tokens[k - 1] : null, after = k + 1 < tokens.length && joined(k, k + 1) ? tokens[k + 1] : null;
            const prev = sp && k > sp.a ? tokens[k - 1] : null, next = sp && k < sp.b ? tokens[k + 1] : null;
            const nameBeside = x => x && capitalised(x.s) && x.shape !== "ambig" && english(x);
            let score = 0;
            if (viName(before) || viName(after)) score -= CONF.decisive;
            if ((next && pair(t, next)) || (prev && pair(prev, t))) score += CONF.decisive;
            else if (!startsSentence(k) && (nameBeside(prev) || nameBeside(next))) score += CONF.strong;
            else if (startsSentence(k) && NAME_WORDS.has(w) && next && next.shape === "en" && next.unit < 0 && capitalised(next.s)) score += CONF.strong;
            else if (!sp && EN_GIVEN.has(w) && capitalised(t.s) && named(t)) score += CONF.strong;
            if (before && TITLES.has(before.s.toLowerCase())) score -= CONF.weak;
            return score;
        };
        for (const sp of spans) {
            for (let k = sp.a; k <= sp.b; k++) {
                const t = tokens[k];
                if (t.unit >= 0) { t.strong = true; t.score = CONF.decisive; t.conf = HIGH_EN; continue; }
                if (t.shape === "ambig") {
                    t.score = ambigScore(k, sp);
                    t.conf = confState(t.score);
                    t.strong = t.conf === HIGH_EN;
                } else if (t.shape === "code") {
                    // "MacBook Pro M3", "Galaxy S25": a product name around it; "giấy A4", "U23" stay Vietnamese
                    t.strong = tokens.slice(sp.a, sp.b + 1).some(x => x !== t && capitalised(x.s) && !num(x) && x.shape !== "code" && english(x));
                    t.conf = t.strong ? HIGH_EN : AMBIGUOUS;
                } else if (english(t)) t.conf = HIGH_EN;
            }
        }
        // a lone capitalised word outside any span ("Tom kể rằng ..."): English only on the source line's word
        for (const t of tokens) {
            if (t.shape !== "ambig" || t.span >= 0 || !capitalised(t.s)) continue;
            t.score = ambigScore(t.i, null);
            t.conf = confState(t.score);
            if (t.conf !== HIGH_EN) continue;
            t.strong = true;
            t.span = spans.length;
            spans.push({ id: t.span, a: t.i, b: t.i, cat: "name", text: t.s });
        }
        // An all-caps code of 5+ letters with no vowel (Y counts) can only be letters, and VieNeu spells
        // it with Vietnamese letter names unless its own table knows it ("THPTQG" tê hát phê..., but
        // "SMTPS" too). Whether it is English or a Vietnamese abbreviation cannot be told from its
        // letters, so English letters only on evidence: the English source line has the code (strong),
        // an English word beside it or a letter Vietnamese never starts a word with, F J W Z (weak
        // each). A code with a vowel may be said as a word ("CRISPR" is "crisper", "NGINX" "engine x";
        // VieNeu spells both Vietnamese): its reading is unknown, so it is left to the voice.
        for (const t of tokens) {
            if (t.shape !== "caps" || t.span < 0) continue;
            const p = possessive(t.s);
            // a code the source line writes as a word ("Whoop") or one shaped like a word is said as one
            // (2.6.0: also inside a glossary name, and a code VieNeu "reads as a word" of 4+ letters:
            // it reads "CUDA" as Vietnamese syllables, cu đa)
            const own = t.unit < 0 || units[t.unit].cat === "glossary";
            const cls = t.cls;
            if (own && (cls === "spelled" || (cls === "word" && p.length >= 4 && wordShaped(p))) && !INITIALISMS.has(p) &&
                !EN_SPELLED.has(p) && !isViet(p) &&
                ((englishSource && inSourceAnyCase(p) && !inSource(p)) || wordShaped(p))) { t.asWord = true; continue; }
            if (p.length < 5 || INITIALISMS.has(p) || cls === "vi" || VOWEL_CAPS.test(p)) continue;
            const sp = spans[t.span];
            let score = 0;
            if (englishSource && inSource(p)) score += CONF.strong;
            if (tokens.slice(sp.a, sp.b + 1).some(x => x !== t && (x.shape === "en" || x.shape === "camel" || x.unit >= 0))) score += CONF.weak;
            if (/[FJWZ]/.test(p)) score += CONF.weak;
            t.score = score;
            t.conf = confState(score);
            t.letters = t.conf === HIGH_EN;
        }
        // what each token is for both readers of this analysis (pronunciation and prosody, 1.8.0):
        // lang en / vi / num / other, the span's entity kind, and how the voice is to say it
        for (const t of tokens) {
            t.lang = t.shape === "num" || t.shape === "code" ? "num" : t.shape === "other" ? "other" :
                t.span >= 0 && (t.shape !== "ambig" || t.strong) ? "en" : t.shape === "ambig" && t.conf !== HIGH_VI ? (t.span >= 0 ? "en?" : "vi") : t.shape === "en" || t.shape === "camel" ? "en" : "vi";
            t.entity = t.span >= 0 ? spans[t.span].cat : null;
        }
        return { text, tokens, spans, units };
    }

    // ---- rendering for VieNeu ----
    // One token -> { say, pri } or null (leave it). pri decides which tags survive the budget.
    function sayToken(t) {
        const s = t.s, p = possessive(s), ps = s.slice(p.length).toLowerCase();
        switch (t.shape) {
            case "caps": {
                if (t.letters) return { say: `<en>${p.toLowerCase().split("").join(" ")}${ps}</en>`, pri: 2 };
                if (t.asWord) return { say: `<en>${p.toLowerCase()}${ps}</en>`, pri: 3 };
                if (t.span < 0 || (t.cls || capsClass(p)) !== "spelled") return null;
                const e = LEX.get(p.toLowerCase());
                if (e && e.cat !== "initialism" && e.cat !== "glossary") return { say: `<en>${p.toLowerCase()}${ps}</en>`, pri: 3 };
                // a longer code with a vowel that is no word shape: its reading is unknown, left to the voice
                if (p.length > 4 && !INITIALISMS.has(p)) return null;
                return { say: `<en>${p.toLowerCase().split("").join(" ")}${ps}</en>`, pri: 2 };
            }
            case "camel": {
                const known = LEX.get(p.toLowerCase());
                if (known && known.cat !== "glossary") return null;  // in the lexicon: VieNeu reads it well
                if (VI_CAPS.has(p)) return null;                     // "ThS" (thạc sĩ)
                const pieces = camelPieces(p);
                if (pieces.some(x => /^[A-Z]{2,}$/.test(x))) return null;      // "ChatGPT": VieNeu knows the acronym
                // a piece VieNeu would read as a Vietnamese syllable ("Di", "Le"), or cannot say ("Mc")
                const bad = pieces.some((x, k) => (k > 0 || x.length > 1) && /^[A-Z]?[a-z]+$/.test(x) &&
                    ((x.length <= 4 && isViet(x)) || !/[aeiouy]/i.test(x)));
                return bad ? { say: `<en>${s.toLowerCase()}</en>`, pri: 2 } : null;
            }
            case "code":
                return t.strong ? { say: `<en>${s[0].toLowerCase()}</en> ${s.slice(1)}`, pri: 1 } : null;
            case "ambig": {
                const r = t.strong && RESPELL[p.toLowerCase()];
                return r ? { say: `<en>${r}${ps}</en>`, pri: 1 } : null;
            }
            default: {
                // 2.6.0: a JavaScript library name, "Node.js": the voice said "chấm" and Vietnamese
                // letter names for the suffix
                const js = /^([A-Za-z][A-Za-z0-9]*)\.js$/i.exec(p);
                return js ? { say: `<en>${js[1].toLowerCase()} j s</en>${ps}`, pri: 2 } : null;
            }
        }
    }

    function render(text, ctx = {}) {
        loadExtra();
        const key = String(text || "") + "\u0001" + (ctx.source || "");
        let hit = renderMemo.get(key);
        if (hit) return hit;
        hit = renderUncached(String(text || ""), ctx);
        if (renderMemo.size >= 600) renderMemo.clear();
        renderMemo.set(key, hit);
        return hit;
    }

    function renderUncached(text, ctx) {
        const a = analyze(text, ctx);
        const out = a.tokens.map(t => ({ t, say: null, pri: 0 }));
        // a lexicon unit with its own reading replaces its words ("La La Land" -> <en>lah lah land</en>)
        for (const u of a.units) {
            if (!u.say) continue;
            out[u.a].say = u.say; out[u.a].pri = 3;
            for (let k = u.a + 1; k <= u.b; k++) out[k].say = "";
        }
        for (const o of out) {
            if (o.say !== null) continue;
            const r = sayToken(o.t);
            if (r) { o.say = r.say; o.pri = r.pri; }
        }
        // 2.6.0: initials inside an English name, "Samuel L. Jackson", "T.J. Maxx", "e.l.f.": English
        // letter names (VieNeu said "lờ", "tê dờ"), and the initial's own full stop dropped, so the
        // voice does not end a sentence on it
        const englishNext = k => { const n = a.tokens[k + 1]; return !!n && n.lang === "en"; };
        a.tokens.forEach((t, k) => {
            if (out[k].say !== null) return;
            const dotted = /^(?:[A-Za-z]\.){1,3}[A-Za-z]?$/.test(t.s + (t.trail === "." ? "." : "")) && /^[A-Za-z.]+$/.test(t.s);
            const single = /^[A-Z]$/.test(t.s) && t.trail === ".";
            if (!dotted && !single) return;
            const prev = k > 0 ? a.tokens[k - 1] : null;
            const inName = (prev && /^\p{Lu}/u.test(prev.s) && prev.lang === "en") || englishNext(k);
            const lettersOnly = t.s.replace(/\./g, "");
            if (!(single ? inName : lettersOnly.length >= 2 && (inName || t.span >= 0 || t.unit >= 0))) return;
            out[k].say = `<en>${lettersOnly.toLowerCase().split("").join(" ")}</en>`;
            out[k].pri = 2;
            // the stop is the abbreviation's when the sentence goes on ("M.D. ở Mỹ"), the sentence's when
            // a capital follows ("... e.l.f. Sau đó")
            const n = a.tokens[k + 1];
            out[k].dropDot = englishNext(k) || single || (!!n && !/^\p{Lu}/u.test(n.s));
        });
        // a model number after a code: "RTX 5090" is "năm không chín không", not a quantity; "RAM 4096
        // MB" is (the planner's numberRole: a unit after it wins)
        const P = planner();
        for (let k = 1; k < a.tokens.length; k++) {
            const t = a.tokens[k], prev = a.tokens[k - 1], next = a.tokens[k + 1];
            if (P && P.numberRole && P.numberRole(prev.s, next ? next.s : "") === "quantity" && next && !t.trail) continue;
            if (t.span >= 0 && t.span === prev.span && out[k].say === null && /^\d{4}$/.test(t.s) && /^[A-Z]{2,5}$/.test(prev.s)) {
                out[k].say = t.s.split("").join(" "); out[k].pri = 2;
            }
        }
        // tag budget: VieNeu's normalizer breaks past 10 tags in a sentence; drop the least needed
        const tagged = out.filter(o => o.say && o.say.includes("<en>"));
        if (tagged.length > TAG_MAX) {
            const keep = new Set(tagged.slice().sort((x, y) => y.pri - x.pri || x.t.i - y.t.i).slice(0, TAG_MAX));
            for (const o of tagged) {
                if (keep.has(o)) continue;
                o.say = null;
                if (o.t.unit >= 0) for (const q of out) if (q.t.unit === o.t.unit && q.say === "") q.say = null;
            }
        }
        if (!out.some(o => o.say !== null)) return { text, changed: false };
        const words = [];
        for (const o of out) {
            if (o.say === "") { if (o.t.trail && words.length) words[words.length - 1] += o.t.trail; continue; }
            words.push(o.t.lead + (o.say === null ? o.t.s : o.say) + (o.dropDot ? o.t.trail.replace(/^\./, "") : o.t.trail));
        }
        return { text: words.join(" "), changed: true };
    }

    // The text VieNeu is sent for a speech line: breathing commas (dub-prosody) on the plain text,
    // then the English spans rendered. ctx.source: the English source line (evidence that a
    // capitalised Vietnamese-looking word is an English name).
    const prosody = () => (root && root.CST_DUB_PROSODY) ||
        (typeof require === "function" ? (() => { try { return require("./dub-prosody.js"); } catch (e) { return null; } })() : null);
    function vieneuText(text, ctx = {}) {
        const P = prosody();
        const s = P ? P.breathText(text) : String(text || "");
        return render(s, ctx).text;
    }

    // For the prosody model: for each gap between two words of `text` (tokenised as vi-segmenter
    // does), whether it lies inside an English span
    function spanGaps(text) {
        const a = analyze(text);
        const inside = new Array(Math.max(0, a.tokens.length - 1)).fill(false);
        for (const sp of a.spans) for (let k = sp.a; k < sp.b; k++) inside[k] = true;
        return inside;
    }

    // Version of the pronunciation data and policy (lexicon, tables, CONF). Not part of any cache key:
    // the free voice's audio key holds the rendered text itself, so a policy change re-renders exactly
    // the lines whose rendered text changed, and nothing reaches the paid voice or the translation cache.
    const PRONUNCIATION_VERSION = "2.0.0";
    const api = { analyze, render, vieneuText, spanGaps, shapeOf, capsClass, addEntry, glossaryName, GLOSSARY_SAY, RESPELL, LEX, TAG_MAX, CONF,
        HIGH_EN, AMBIGUOUS, HIGH_VI, PRONUNCIATION_VERSION };
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.CST_DUB_SPEECH = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
