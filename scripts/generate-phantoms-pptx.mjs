import pptxgen from "pptxgenjs";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Phantoms Team";
pptx.company = "Phantoms";
pptx.subject = "الخطة الكاملة لأول اجتماع لفريق Phantoms";
pptx.title = "Phantoms — First Assembly 2026";
pptx.lang = "ar-EG";
pptx.rtlMode = true;
pptx.theme = {
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  lang: "ar-EG",
};
pptx.defineSlideMaster({
  title: "PHANTOMS_DARK",
  background: { color: "11110F" },
  objects: [],
  slideNumber: { x: 12.2, y: 7.14, w: 0.45, h: 0.18, color: "76766E", fontFace: "Arial", fontSize: 7, align: "center" },
});
pptx.defineSlideMaster({
  title: "PHANTOMS_APPENDIX",
  background: { color: "15140F" },
  objects: [],
  slideNumber: { x: 12.2, y: 7.14, w: 0.45, h: 0.18, color: "76766E", fontFace: "Arial", fontSize: 7, align: "center" },
});
pptx.sectionTitle = "Phantoms First Assembly";
pptx.layout = "LAYOUT_WIDE";

const W = 13.333;
const H = 7.5;
const BG = "11110F";
const APP_BG = "15140F";
const PAPER = "F5EFDF";
const MUTED = "A9A59A";
const GRID = "292922";
const LIME = "C7FF42";
const ORANGE = "FF6B35";
const BLUE = "4CA6FF";
const PINK = "FF67B3";
const RED = "FF765D";
const BLACK = "0B0C09";
const ACCENTS = { lime: LIME, orange: ORANGE, blue: BLUE, pink: PINK, cream: PAPER };
const phantomImage = path.resolve(__dirname, "../public/phantoms/phantom-cutout.png");
const outputDir = path.resolve(__dirname, "../deliverables");
const outputFile = path.join(outputDir, "Phantoms-First-Assembly-2026.pptx");

const meta = [
  ["00", "قبل البداية", "10:00 — 10:10", "lime", "شغّل السلايد دي أثناء دخول الأعضاء. استقبل الناس بالاسم، وخلي الموسيقى خفيفة. لا تبدأ اعتذارات؛ البداية الرسمية 10:10."],
  ["01", "الافتتاحية", "10:10 — 10:12", "lime", "ادخل بالجملة المكتوبة حرفياً، ثم اسكت ثانية. نبرة هادئة وواثقة. الهدف هنا الاستحواذ على الانتباه، لا سرد الإنجازات."],
  ["02", "خريطة الاجتماع", "10:00 — 12:00", "cream", "اعرض الخريطة بسرعة. لا تقرأ كل سطر؛ ركّز على أننا سنسمع، نحدد طريقة العمل، ثم ننهي الرسميات في موعدها."],
  ["03", "الهوية", "10:12 — 10:15", "orange", "تعريفك الشخصي جملتان فقط: خبرتك + أقوى إنجاز رقمي موثوق. استبدل الحقل الصغير قبل العرض. اختم بأن دورك صناعة البيئة لا استعراض السيرة."],
  ["04", "ليه بدأنا بدري؟", "10:15 — 10:25", "blue", "قارن بوضوح بين Reactive وProactive. الأساسيات الحالية ليست حملاً إضافياً؛ هي نفس مادة السنة ولكن بعمق وتطبيق قبل ضغط الترم."],
  ["05", "الأساس قبل الفكرة", "10:25 — 10:29", "lime", "استخدم تشبيه العربية مرة واحدة فقط. الفكرة: لو اخترنا المشروع الآن سنحبس أنفسنا داخل سقف مهاراتنا الحالية."],
  ["06", "Product Thinking", "10:29 — 10:33", "pink", "ازرع الأسئلة الثلاثة ولا تفتح ورشة اختيار فكرة الآن. قل بوضوح: سنعود لها بعد امتلاك الأدوات، وليس لأننا بلا اتجاه."],
  ["07", "التفويض والتنظيم", "10:33 — 10:35", "orange", "قل الصياغة الهادئة كما هي. لا تكرر كلمة السرية، ولا تصنع غموضاً مبالغاً فيه. الحزم مرة واحدة يكفي."],
  ["08", "عروض اللجان", "10:35 — 11:15", "cream", "قف بجوار المتحدثين ولا تجلس. كل لجنة 12 دقيقة + انتقال سريع. نبّه قبلها بيوم أنك ستوقف العرض عند انتهاء الوقت."],
  ["09", "عروض اللجان", "12 دقيقة لكل لجنة", "blue", "هذه هي الشاشة المرجعية أثناء تبديل اللجان. المطلوب من Head + Monitor: كلام محدد وقابل للقياس، لا عناوين عامة."],
  ["10", "نظام العمل", "ضمن عروض اللجان", "orange", "اشرح أن التصعيد ليس تجاوزاً للأدوار. الأعذار والمتابعة اليومية تبدأ من Monitor، والمشكلة الفنية من Head، ثم سهيلة، ثم سيف عند الحاجة."],
  ["11", "الصندوق الأسود", "11:15 — 11:25", "pink", "اختر 3–4 أسئلة متكررة فقط، من غير أسماء. أعطِ مساحة أكبر لسؤال إدارة الوقت لأنه جسر طبيعي للفقرة التالية."],
  ["12", "Mindset", "11:25 — 11:33", "lime", "لا تقلل من ضغط أي شخص. فرّق بين احترام الظروف وبين اختفاء المسؤولية. المحترف يتواصل مبكراً، يعيد التخطيط، ثم يسلّم."],
  ["13", "إدارة الوقت", "11:33 — 11:43", "orange", "اطلب منهم اختيار تاسك حالي وتحديد الجزء صاحب أكبر أثر. المثال الأكاديمي: المفاهيم والأسئلة المتكررة أولاً، لا ترتيب صفحات الكتاب."],
  ["14", "نظام التنفيذ", "11:43 — 11:47", "blue", "قدّم الفكرة فقط، لا التفاصيل. كل دورة لها نتيجة واحدة قابلة للقياس وتسليم أسبوعي. التطبيق الكامل موجود في الملحق الذي سيرسل بعد الاجتماع."],
  ["15", "Communication", "11:47 — 11:53", "pink", "الثقة ليست صوتاً عالياً ولا عناداً. المقصود أن تأتي بحل، تتكلم بأرقام، وتعلن موقفاً واضحاً باحترام."],
  ["16", "Communication", "11:53 — 11:55", "cream", "اقرأ المثالين بصوتين مختلفين. اختم بالتمرين: قبل أي اجتماع، حضّر رأياً واحداً وسببه، ولا تدخل فاضي تستنى رأي الأغلبية."],
  ["17", "لمن يريد التعمّق", "90 ثانية", "blue", "30 ثانية كحد أقصى لكل كتاب. لا تلخّص الفصول. اربط كل كتاب بأداة واحدة، وقل إن الملخصات الكاملة ستصل مكتوبة."],
  ["18", "الختام", "11:55 — 12:00", "lime", "قدّر الحضور والالتزام أولاً. قل الخلاصة، ثم انتقل فوراً إلى السلايد التالي من غير أسئلة ولا فاصل."],
  ["19", "التحوّل", "12:00", "orange", "ابتسم، شمّر الكم، انزل من مكان المنصة، وابدأ اللعب فوراً. الانتقال المفاجئ نفسه هو ما يكسر التوتر."],
  ["A1", "يُرسل بعد الاجتماع", "مرجع مكتوب", "cream", "بداية الملحق. لا تعرض هذه الصفحات في الاجتماع إلا عند الحاجة. أرسل ملف العرض بعد ساعات من الاجتماع."],
  ["A2", "12 Week Year", "خطوات التطبيق", "blue", "النسخة المكتوبة: خطوة بخطوة لتطبيق النظام على كل لجنة، مع هدف واضح وقياس أسبوعي ومراجعة دورية."],
  ["A3", "12 Week Year", "Scoreboard", "lime", "فرّق بين Lag indicator: النتيجة النهائية، وLead indicator: السلوك الأسبوعي الذي يصنعها. راقب الاثنين."],
  ["A4", "Product Thinking", "إطار اختيار الفكرة", "pink", "هذا الإطار يستخدم لاحقاً في جلسة اختيار المشروع. لا نختار التقنية أولاً؛ نختار مستخدماً ومشكلة وسلوكاً قابلاً للرصد."],
  ["A5", "Product Thinking", "MVP", "orange", "الـMVP ليس نسخة سيئة من المنتج؛ هو أصغر تجربة تختبر أخطر افتراض بسرعة وبتكلفة قليلة."],
  ["A6", "مكتبة Phantoms", "ملخصات مرجعية", "cream", "أرسل هذه الصفحة كمرجع. المطلوب تطبيق فكرة واحدة من كل كتاب، لا تحويل القراءة إلى مهمة استعراضية."],
  ["A7", "Roadmap", "12 أسبوع", "blue", "هيكل زمني موحّد. على رؤساء اللجان استبدال الوصف العام بالتسليمات الفنية والتواريخ المعتمدة قبل إرسال النسخة النهائية."],
];

function tx(slide, text, x, y, w, h, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: "Arial",
    fontSize: 18,
    color: PAPER,
    margin: 0,
    breakLine: false,
    fit: "shrink",
    valign: "mid",
    align: "right",
    rtlMode: true,
    ...options,
  });
}

function rect(slide, x, y, w, h, options = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: options.fill || BG, transparency: options.transparency ?? 0 },
    line: { color: options.line || GRID, transparency: options.lineTransparency ?? 0, width: options.width || 1 },
    radius: options.radius,
  });
}

function line(slide, x, y, w, h = 0, color = GRID, width = 1, dash = "solid") {
  slide.addShape(pptx.ShapeType.line, { x, y, w, h, line: { color, width, dashType: dash } });
}

function circle(slide, x, y, d, fill, lineColor = fill, transparency = 0) {
  slide.addShape(pptx.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill, transparency }, line: { color: lineColor, width: 1 } });
}

function addGrid(slide) {
  for (let x = 0.45; x < W; x += 0.75) line(slide, x, 0, 0, H, GRID, 0.35);
  for (let y = 0.55; y < H; y += 0.75) line(slide, 0, y, W, 0, GRID, 0.35);
}

function addBase(slide, index, appendix = false) {
  const [label, section, time, accentName, note] = meta[index];
  const accent = ACCENTS[accentName];
  slide.background = { color: appendix ? APP_BG : BG };
  addGrid(slide);
  // Header
  circle(slide, 0.55, 0.31, 0.20, accent, accent, 100);
  circle(slide, 0.60, 0.36, 0.10, accent, accent, 65);
  tx(slide, "PHANTOMS", 0.83, 0.32, 1.2, 0.18, { fontSize: 9, bold: true, align: "left", rtlMode: false, charSpacing: 1.5 });
  tx(slide, "/ 26", 1.95, 0.32, 0.4, 0.18, { fontSize: 7, bold: true, color: accent, align: "left", rtlMode: false });
  tx(slide, appendix ? "APPENDIX" : "LIVE", 9.45, 0.31, 0.75, 0.20, { fontSize: 7, bold: true, color: accent, align: "center", rtlMode: false, fill: { color: accent, transparency: 88 }, line: { color: accent, transparency: 35 }, margin: 2, valign: "mid" });
  tx(slide, section, 10.25, 0.31, 1.25, 0.20, { fontSize: 8, color: MUTED });
  tx(slide, time, 11.55, 0.31, 1.15, 0.20, { fontSize: 8, bold: true, align: "left", rtlMode: false });
  // Footer
  tx(slide, "FIRST ASSEMBLY", 0.55, 7.10, 1.2, 0.16, { fontSize: 6.5, bold: true, color: "77766E", align: "left", rtlMode: false, charSpacing: 1.2 });
  line(slide, 1.75, 7.18, 0.55, 0, "5C5C55", 0.6);
  tx(slide, label, 2.35, 7.09, 0.35, 0.18, { fontSize: 7, bold: true, color: accent, align: "left", rtlMode: false });
  slide.addNotes(note);
  return accent;
}

function addKicker(slide, text, accent, x, y, w = 4.5) {
  tx(slide, text, x, y, w, 0.25, { fontSize: 9, bold: true, color: accent, align: "left", rtlMode: false, charSpacing: 1.0 });
}

function addTitle(slide, line1, line2, accent, x, y, w, fs = 36, align = "right") {
  tx(slide, line1, x, y, w, 0.62, { fontSize: fs, bold: true, color: PAPER, align });
  tx(slide, line2, x, y + 0.58, w, 0.68, { fontSize: fs, bold: true, color: accent, align });
}

function addQuote(slide, text, accent, x, y, w, h, label = "") {
  rect(slide, x, y, w, h, { fill: accent, transparency: 94, line: accent, lineTransparency: 80 });
  rect(slide, x + w - 0.05, y, 0.05, h, { fill: accent, line: accent });
  tx(slide, "“", x + w - 0.45, y + 0.08, 0.27, 0.35, { fontSize: 24, bold: true, color: accent });
  if (label) tx(slide, label, x + 0.22, y + 0.14, w - 0.8, 0.17, { fontSize: 7, bold: true, color: accent });
  tx(slide, text, x + 0.22, y + (label ? 0.38 : 0.22), w - 0.8, h - (label ? 0.50 : 0.33), { fontSize: 16, bold: true, color: PAPER, valign: "mid", paraSpaceAfterPt: 0 });
}

function addCard(slide, { x, y, w, h, number, title, body, accent, fill = BG, titleSize = 17, bodySize = 10, border = GRID }) {
  rect(slide, x, y, w, h, { fill, transparency: fill === BG ? 0 : 0, line: border });
  rect(slide, x + w - 0.04, y, 0.04, h, { fill: accent, line: accent });
  if (number) tx(slide, number, x + 0.2, y + 0.20, 0.45, 0.20, { fontSize: 9, bold: true, color: accent, align: "left", rtlMode: false });
  tx(slide, title, x + 0.25, y + 0.52, w - 0.5, 0.42, { fontSize: titleSize, bold: true });
  tx(slide, body, x + 0.25, y + 1.03, w - 0.5, h - 1.2, { fontSize: bodySize, color: MUTED, valign: "top", breakLine: true, paraSpaceAfterPt: 4 });
}

function addSectionTitle(slide, kicker, l1, l2, accent, x = 0.7, y = 1.0, w = 5.4, fs = 34) {
  addKicker(slide, kicker, accent, x, y, w);
  addTitle(slide, l1, l2, accent, x, y + 0.48, w, fs);
}

function addBulletList(slide, items, x, y, w, h, accent, fontSize = 15) {
  const lineH = h / items.length;
  items.forEach((item, i) => {
    circle(slide, x + w - 0.16, y + i * lineH + lineH / 2 - 0.045, 0.09, accent);
    tx(slide, item, x, y + i * lineH, w - 0.28, lineH, { fontSize, color: PAPER, valign: "mid" });
  });
}

function newSlide(index, appendix = false) {
  const slide = pptx.addSlide(appendix ? "PHANTOMS_APPENDIX" : "PHANTOMS_DARK");
  const accent = addBase(slide, index, appendix);
  return { slide, accent };
}

// 00 — Waiting
{
  const { slide, accent } = newSlide(0);
  addKicker(slide, "FIRST SIGNAL / 2026", accent, 0.75, 1.12, 3.5);
  addTitle(slide, "بنبدأ", "بعد شوية.", accent, 0.75, 1.62, 6.0, 50);
  tx(slide, "خد مكانك. اعرف اللي جنبك.\nوسيـب الموبايل دقيقتين.", 0.75, 3.15, 5.0, 0.92, { fontSize: 17, color: MUTED, valign: "top", breakLine: true });
  // Event cards
  addCard(slide, { x: 0.75, y: 4.48, w: 2.45, h: 1.0, number: "10:10", title: "البداية الرسمية", body: "نبدأ في الميعاد", accent, titleSize: 12, bodySize: 8 });
  addCard(slide, { x: 3.38, y: 4.48, w: 2.45, h: 1.0, number: "110 MIN", title: "مدة الاجتماع", body: "حتى 12:00", accent, titleSize: 12, bodySize: 8 });
  // Cut-out photo with no background
  slide.addShape(pptx.ShapeType.ellipse, { x: 7.0, y: 0.85, w: 5.2, h: 5.2, fill: { color: accent, transparency: 100 }, line: { color: accent, transparency: 58, width: 1.2 } });
  slide.addImage({ path: phantomImage, x: 8.05, y: 0.63, w: 3.35, h: 5.94, transparency: 0 });
  tx(slide, "ASSEMBLE", 11.75, 1.3, 0.45, 4.8, { fontSize: 18, bold: true, color: "34352C", vert: "vert270", align: "center", rtlMode: false, charSpacing: 4 });
}

// 01 — Opening
{
  const { slide, accent } = newSlide(1);
  addKicker(slide, "OPENING LINE", accent, 4.5, 1.25, 4.3);
  addTitle(slide, "أول اجتماع.", "أول خطوة بجد.", accent, 2.0, 1.80, 9.3, 48, "center");
  addQuote(slide, "صباح الخير جميعاً. شكراً لالتزامكم وحضوركم في الميعاد، وشكراً لانتظاركم.", accent, 2.0, 3.75, 9.3, 1.25);
  tx(slide, "لا اعتذار  •  لا قصة حياة  •  ندخل في المعنى فوراً", 3.25, 5.42, 6.8, 0.30, { fontSize: 11, color: MUTED, align: "center" });
}

// 02 — Agenda
{
  const { slide, accent } = newSlide(2);
  addSectionTitle(slide, "THE REAL PLAN", "120 دقيقة.", "كل دقيقة لها وظيفة.", accent, 0.7, 1.05, 5.1, 35);
  tx(slide, "3 رسائل عميقة أفضل من 10 رسائل سطحية.", 0.7, 3.00, 4.7, 0.45, { fontSize: 14, color: MUTED });
  const agenda = [
    ["10:00", "انتظار ووصول", "10 د"], ["10:10", "الهوية + ليه بدري", "15 د"],
    ["10:25", "الأساس قبل الفكرة + التفويض", "10 د"], ["10:35", "عروض اللجان", "40 د"],
    ["11:15", "الصندوق الأسود", "10 د"], ["11:25", "Mindset + وقت + تواصل", "30 د"],
    ["11:55", "الختام والتحوّل", "5 د"],
  ];
  const x = 6.0, y = 1.12, w = 6.55, rowH = 0.69;
  line(slide, x, y, w, 0, "55554D", 1);
  agenda.forEach((row, i) => {
    const yy = y + i * rowH;
    tx(slide, String(i + 1).padStart(2, "0"), x, yy + 0.15, 0.38, 0.22, { fontSize: 8, bold: true, color: accent, align: "left", rtlMode: false });
    tx(slide, row[0], x + 0.48, yy + 0.13, 0.75, 0.26, { fontSize: 11, bold: true, align: "left", rtlMode: false });
    tx(slide, row[1], x + 1.42, yy + 0.10, 4.15, 0.31, { fontSize: 13, bold: true });
    tx(slide, row[2], x + 5.75, yy + 0.12, 0.70, 0.25, { fontSize: 9, color: MUTED });
    line(slide, x, yy + rowH, w, 0, "3B3B34", 0.7);
  });
}

// 03 — Identity
{
  const { slide, accent } = newSlide(3);
  addSectionTitle(slide, "IDENTITY / 02 MIN", "مش تيم بيحاول", "يبان كويس.", accent, 0.7, 1.02, 5.1, 34);
  tx(slide, "إحنا تيم بيبني منتجات حقيقية\nلناس حقيقية.", 0.7, 3.1, 5.1, 0.88, { fontSize: 20, bold: true, color: PAPER, breakLine: true });
  addCard(slide, { x: 6.15, y: 1.10, w: 6.45, h: 4.48, number: "02", title: "عرّف نفسك في جملتين", body: "1  الخبرة: أنا اشتغلت في [مجالك] وبنيت [نوع المنتج].\n\n2  الدليل: أقوى نتيجة حققتها كانت [رقم موثوق].", accent, titleSize: 21, bodySize: 16 });
  addQuote(slide, "أنا مش هنا أقولكم عملت إيه؛ أنا هنا أوفّر البيئة اللي تخليكم تعملوا أحسن.", accent, 6.47, 4.18, 5.78, 1.03);
  rect(slide, 0.7, 5.55, 11.9, 0.65, { fill: accent, line: accent });
  tx(slide, "شعار السنة:  بنبني بجد. وبنثبت بالنتيجة.", 1.0, 5.72, 11.3, 0.28, { fontSize: 17, bold: true, color: BLACK, align: "center" });
}

// 04 — Why early
{
  const { slide, accent } = newSlide(4);
  addSectionTitle(slide, "WHY NOW?", "إحنا بنشتري وقت،", "مش بنسرقه من حد.", accent, 0.7, 1.02, 4.8, 31);
  addCard(slide, { x: 5.35, y: 1.12, w: 3.28, h: 4.65, number: "REACTIVE", title: "تبدأ مع أول محاضرة", body: "ضغط أكاديمي\n\nتعلّم بنصف طاقة\n\nطول الوقت بتلحق\n\nالوقت هو اللي بيتحكم فيك", accent: RED, border: "62352D", titleSize: 18, bodySize: 13 });
  addCard(slide, { x: 8.95, y: 1.12, w: 3.68, h: 4.65, number: "PROACTIVE", title: "تبدأ قبل الزحمة", body: "أساس متين\n\nتطبيق بدل حفظ\n\nإيقاع تحت سيطرتك\n\nإنت اللي بتتحكم في الوتيرة", accent, border: "35566D", titleSize: 18, bodySize: 13 });
  tx(slide, "الأساسيات الحالية مش حمل زيادة؛ هي نفس مواد السنة لكن بعمق وتطبيق قبل الضغط.", 0.7, 4.38, 4.35, 1.05, { fontSize: 15, color: MUTED, valign: "top" });
}

// 05 — Foundation first
{
  const { slide, accent } = newSlide(5);
  tx(slide, "01", 8.4, 0.85, 4.1, 4.2, { fontSize: 160, bold: true, color: "272C1E", align: "left", rtlMode: false });
  addSectionTitle(slide, "FOUNDATION FIRST", "السواقة قبل", "نوع العربية.", accent, 0.7, 1.02, 5.2, 39);
  tx(slide, "مانيوال أو أوتوماتيك؟ الاختيار ييجي بعد ما تتعلم أساسيات السواقة.", 0.7, 3.15, 4.8, 0.68, { fontSize: 15, color: MUTED });
  addCard(slide, { x: 6.0, y: 1.30, w: 6.15, h: 1.35, number: "NOW", title: "فكرة محددة الآن  ←  سقف مهاراتنا الحالية", body: "هنحبس نفسنا في اللي نعرفه دلوقتي.", accent: RED, titleSize: 17, bodySize: 10, border: "61352B" });
  addCard(slide, { x: 6.0, y: 2.95, w: 6.15, h: 1.35, number: "NEXT", title: "أدوات قوية أولاً  ←  نقدر ننفذ أي فكرة", body: "السوفت + الهارد + AI يمتلكوا أدواتهم بالكامل.", accent, titleSize: 17, bodySize: 10, border: "4E6427" });
  addQuote(slide, "الفريق الضعيف يضيّع الفكرة الكويسة. الفريق القوي يحوّل أي فكرة لمنتج ينافس.", accent, 0.7, 5.03, 11.45, 1.02, "القانون");
}

// 06 — Product thinking
{
  const { slide, accent } = newSlide(6);
  addSectionTitle(slide, "PRODUCT THINKING", "الفكرة مش", "هي القيمة.", accent, 0.7, 1.02, 4.5, 38);
  tx(slide, "القيمة هي المهارة اللي هتنفّذ بيها، والدليل اللي هتتعلم منه.", 0.7, 3.05, 4.3, 0.78, { fontSize: 15, color: MUTED });
  const cards = [
    ["01", "المشكلة", "بنحل مشكلة حقيقية لمين بالظبط؟"],
    ["02", "الاستخدام", "هل حد مستعد يستخدم أو يدفع للحل فعلاً؟"],
    ["03", "الاختبار", "إيه أصغر MVP نجربه قبل ما نبني كل حاجة؟"],
  ];
  cards.forEach((c, i) => addCard(slide, { x: 5.35 + i * 2.48, y: 1.35 + (i === 1 ? 0.36 : 0), w: 2.22, h: 4.22, number: c[0], title: c[1], body: c[2], accent, titleSize: 18, bodySize: 12 }));
  circle(slide, 8.57, 5.42, 0.8, accent);
  tx(slide, "IDEA", 8.69, 5.69, 0.56, 0.18, { fontSize: 8, bold: true, color: BLACK, align: "center", rtlMode: false });
}

// 07 — Permission
{
  const { slide, accent } = newSlide(7);
  // Lock visual
  rect(slide, 0.85, 1.2, 3.7, 4.82, { fill: "0A0B08", line: "5D432B" });
  slide.addShape(pptx.ShapeType.arc, { x: 1.77, y: 1.70, w: 1.85, h: 1.95, adjustPoint: 0.3, rotate: 0, fill: { color: BG, transparency: 100 }, line: { color: accent, width: 4, beginArrowType: "none", endArrowType: "none" } });
  rect(slide, 1.55, 3.05, 2.30, 1.70, { fill: accent, transparency: 88, line: accent, width: 2 });
  circle(slide, 2.50, 3.53, 0.38, accent);
  tx(slide, "AUTHORIZED", 1.55, 5.15, 2.3, 0.25, { fontSize: 10, bold: true, color: accent, align: "center", rtlMode: false, charSpacing: 1.5 });
  addSectionTitle(slide, "OFFICIAL PERMISSION", "امتياز…", "ومسؤولية.", accent, 5.35, 1.05, 6.6, 38);
  addQuote(slide, "إحنا بدأنا بتفويض رسمي من الجهة المسؤولة، وده امتياز مانحطّش تفاصيله برّه التيم لأسباب تنظيمية — مش لأنه سر مخيف.", accent, 5.35, 3.13, 6.65, 1.62);
  tx(slide, "جملة واحدة واضحة تكفي. الغموض الزيادة يولّد قلق، مش هيبة.", 5.35, 5.08, 6.65, 0.42, { fontSize: 13, color: MUTED });
}

// 08 — Committees
{
  const { slide, accent } = newSlide(8);
  addSectionTitle(slide, "HEADS + MONITORS", "3 مسارات.", "منتج واحد.", accent, 0.7, 1.02, 4.2, 38);
  tx(slide, "40 دقيقة إجمالي — الانتقال محسوب.", 0.7, 3.1, 4.0, 0.35, { fontSize: 13, color: MUTED });
  const cards = [
    ["TRACK / 01", "Software", "السوفت يبني التجربة والنظام.", LIME],
    ["TRACK / 02", "Hardware", "الهارد يحوّل الفكرة لشيء ملموس.", ORANGE],
    ["TRACK / 03", "AI", "الـAI يحوّل البيانات لقرار.", BLUE],
  ];
  cards.forEach((c, i) => addCard(slide, { x: 5.05 + i * 2.53, y: 1.3, w: 2.28, h: 4.48, number: c[0], title: c[1], body: `${c[2]}\n\n\n12 دقيقة`, accent: c[3], titleSize: 20, bodySize: 11 }));
  tx(slide, "المتحدث يعرض  •  القائد واقف بجانبه  •  الانتقال بدون فراغ", 2.05, 6.12, 9.2, 0.33, { fontSize: 11, bold: true, color: accent, align: "center" });
}

// 09 — Committee brief
{
  const { slide, accent } = newSlide(9);
  addSectionTitle(slide, "12 MIN / HARD STOP", "كل عرض يجاوب", "على 5 أسئلة.", accent, 0.7, 1.02, 4.2, 34);
  const items = [
    ["01", "الرؤية الفنية", "هنوصل لإيه تقنياً؟"], ["02", "الوضع الحالي", "جاهزيتنا دلوقتي كام؟"],
    ["03", "الـ Roadmap", "هنبني بإيه وبأي ترتيب؟"], ["04", "الأدوار", "مين مسؤول عن إيه؟"],
    ["05", "الاستمرار", "إيه معيار الالتزام الواضح؟"],
  ];
  const positions = [[5.15,1.2],[7.62,1.2],[10.09,1.2],[6.38,3.62],[8.85,3.62]];
  items.forEach((it, i) => addCard(slide, { x: positions[i][0], y: positions[i][1], w: 2.22, h: 2.12, number: it[0], title: it[1], body: it[2], accent, titleSize: 16, bodySize: 10 }));
}

// 10 — Communication chain
{
  const { slide, accent } = newSlide(10);
  addSectionTitle(slide, "ONE CLEAR ROUTE", "المعلومة تمشي", "من أقصر طريق.", accent, 0.7, 0.88, 5.0, 32);
  const chain = [
    ["01", "Monitor", "متابعة يومية + أعذار"], ["02", "Head", "مشكلة فنية + قرار مسار"],
    ["03", "سهيلة", "تنسيق + تصعيد"], ["04", "سيف", "قرار قيادي عند الحاجة"],
  ];
  chain.forEach((c, i) => {
    const x = 0.7 + i * 3.05;
    addCard(slide, { x, y: 3.22, w: 2.62, h: 1.72, number: c[0], title: c[1], body: c[2], accent, titleSize: 17, bodySize: 9 });
    if (i < 3) tx(slide, "←", x + 2.69, 3.84, 0.28, 0.32, { fontSize: 20, bold: true, color: accent, align: "center", rtlMode: false });
  });
  rect(slide, 0.7, 5.35, 11.92, 0.83, { fill: accent, transparency: 93, line: accent, lineTransparency: 70 });
  tx(slide, "نظام الـ Strikes", 9.85, 5.55, 2.4, 0.23, { fontSize: 13, bold: true, color: accent });
  tx(slide, "الالتزام = حضور + تواصل مبكر + تسليم. تفاصيل الحد وإعادة الضبط يعلنها كل Head بوضوح.", 1.15, 5.53, 8.55, 0.30, { fontSize: 11, color: PAPER });
}

// 11 — Black box
{
  const { slide, accent } = newSlide(11);
  rect(slide, 0.85, 1.3, 3.8, 4.55, { fill: "050504", line: accent, lineTransparency: 75, width: 1.3 });
  rect(slide, 1.05, 1.5, 3.8, 4.55, { fill: accent, line: accent, transparency: 88, lineTransparency: 100 });
  tx(slide, "؟", 1.42, 1.70, 2.65, 2.8, { fontSize: 130, bold: true, color: accent, align: "center" });
  tx(slide, "ANONYMOUS", 1.72, 5.15, 2.05, 0.22, { fontSize: 8, bold: true, color: MUTED, align: "center", rtlMode: false, charSpacing: 1.5 });
  addSectionTitle(slide, "FORM QUESTIONS / 10 MIN", "سألتم.", "وإحنا سمعنا.", accent, 5.35, 1.0, 6.6, 34);
  const qs = ["هوازن إزاي بين التيم والدراسة؟", "ليه لسه مفيش فكرة مشروع محددة؟", "إيه المتوقع مني كل أسبوع؟", "لو اتعطلت أو اتأخرت، أتصرف إزاي؟"];
  qs.forEach((q, i) => {
    const x = 5.35 + (i % 2) * 3.45;
    const y = 3.2 + Math.floor(i / 2) * 1.08;
    addCard(slide, { x, y, w: 3.16, h: 0.88, number: String(i+1).padStart(2,"0"), title: q, body: "", accent, titleSize: 11, bodySize: 8 });
  });
  tx(slide, "إجابات مباشرة  •  بدون أسماء  •  3–4 أسئلة فقط", 5.35, 5.62, 6.6, 0.30, { fontSize: 10, color: MUTED, align: "center" });
}

// 12 — Mindset
{
  const { slide, accent } = newSlide(12);
  addSectionTitle(slide, "RULE / 01", "المشاعر محترمة.", "الكلمة مُلزمة.", accent, 0.7, 0.88, 5.0, 32);
  addCard(slide, { x: 5.35, y: 1.12, w: 3.0, h: 3.4, number: "إنساني", title: "ضغطك\nمزاجك\nظروفك", body: "مفهومة ومحترمة", accent, titleSize: 24, bodySize: 11 });
  tx(slide, "≠", 8.45, 2.35, 0.75, 0.75, { fontSize: 42, bold: true, color: accent, align: "center", rtlMode: false });
  addCard(slide, { x: 9.25, y: 1.12, w: 3.0, h: 3.4, number: "احترافي", title: "تواصل\nالتزام\nتسليم", body: "مسؤوليتك أمام التيم", accent, titleSize: 24, bodySize: 11 });
  addQuote(slide, "المحترف مش اللي معندوش ضغط؛ المحترف هو اللي يتواصل بدري، يعيد ترتيب خطته، ويسلّم حتى تحت الضغط.", accent, 0.7, 4.92, 11.55, 1.02);
  tx(slide, "متقولش هتعمل إيه. اعمله — وخلي النتيجة تتكلم.", 2.2, 6.16, 8.6, 0.30, { fontSize: 12, bold: true, color: accent, align: "center" });
}

// 13 — Pareto
{
  const { slide, accent } = newSlide(13);
  tx(slide, "20%", 0.8, 1.28, 2.15, 0.78, { fontSize: 45, bold: true, color: accent, align: "center", rtlMode: false });
  rect(slide, 1.64, 2.18, 0.52, 2.55, { fill: "2A2A24", line: "2A2A24" });
  rect(slide, 1.64, 4.22, 0.52, 0.51, { fill: accent, line: accent });
  tx(slide, "من المجهود", 0.75, 4.98, 2.25, 0.28, { fontSize: 11, color: MUTED, align: "center" });
  tx(slide, "←", 3.08, 2.75, 0.8, 0.8, { fontSize: 37, bold: true, color: accent, align: "center", rtlMode: false });
  tx(slide, "80%", 4.05, 1.28, 2.15, 0.78, { fontSize: 45, bold: true, color: accent, align: "center", rtlMode: false });
  rect(slide, 4.88, 2.18, 0.52, 2.55, { fill: "2A2A24", line: "2A2A24" });
  rect(slide, 4.88, 2.69, 0.52, 2.04, { fill: accent, line: accent });
  tx(slide, "من النتيجة", 4.0, 4.98, 2.25, 0.28, { fontSize: 11, color: MUTED, align: "center" });
  addSectionTitle(slide, "RULE / 02 — PARETO", "مش كل حاجة", "بنفس الأهمية.", accent, 6.85, 1.05, 5.2, 34);
  addBulletList(slide, [
    "اسأل: إيه الجزء اللي لو خلصته يحقق أغلب أثر التاسك؟",
    "ابدأ بأعلى ساعة طاقة — مش بالإيميل والتنضيف.",
    "في المذاكرة: المفاهيم والأسئلة المتكررة قبل التفاصيل.",
  ], 6.85, 3.28, 5.25, 2.1, accent, 13);
}

// 14 — 12 Week Year
{
  const { slide, accent } = newSlide(14);
  addSectionTitle(slide, "EXECUTION SYSTEM", "12 أسبوع", "= سنة تنفيذ.", accent, 0.7, 1.0, 4.6, 40);
  tx(slide, "لما المدى يقصر، الإلحاح يرجع.", 0.7, 3.28, 4.0, 0.32, { fontSize: 14, color: MUTED });
  circle(slide, 7.6, 1.35, 3.3, accent, accent, 90);
  circle(slide, 8.45, 2.20, 1.60, accent);
  tx(slide, "12", 8.63, 2.38, 1.24, 0.55, { fontSize: 36, bold: true, color: BLACK, align: "center", rtlMode: false });
  tx(slide, "WEEKS", 8.73, 2.93, 1.05, 0.16, { fontSize: 7, bold: true, color: BLACK, align: "center", rtlMode: false, charSpacing: 1.4 });
  const nodes = [["01","هدف واضح",7.0,1.08],["02","خطة أسبوعية",10.45,2.2],["03","قياس صريح",8.75,4.72],["04","مراجعة وتعديل",6.58,3.56]];
  nodes.forEach(n => addCard(slide, { x:n[2], y:n[3], w:2.0, h:0.95, number:n[0], title:n[1], body:"", accent, titleSize:12, bodySize:8 }));
  rect(slide, 0.7, 5.45, 11.5, 0.72, { fill: accent, transparency: 92, line: accent, lineTransparency: 70 });
  tx(slide, "تطبيق Phantoms:  كل دورة = هدف تقني واحد قابل للقياس + تسليم صغير كل أسبوع.", 1.05, 5.64, 10.8, 0.28, { fontSize: 13, bold: true, color: accent, align: "center" });
}

// 15 — Presence
{
  const { slide, accent } = newSlide(15);
  addSectionTitle(slide, "RULE / 03 — COMMUNICATION", "اشتغل كويس.", "وخلي شغلك ظاهر.", accent, 0.7, 1.0, 4.6, 34);
  tx(slide, "الشغل الكويس مش دايماً بيتكلم عن نفسه.", 0.7, 3.05, 4.2, 0.45, { fontSize: 14, color: MUTED });
  const rules = [
    ["01", "حلول قبل الأسئلة", "متقولش «نعمل إيه؟» بس؛ اقترح مسارين ورشّح واحد."],
    ["02", "أرقام قبل الانطباع", "قول «قلّلنا الوقت 30%» بدل «الدنيا اتحسنت»."],
    ["03", "موقف قبل الحياد", "اختار رأياً واضحاً، واذكر السبب بهدوء."],
  ];
  rules.forEach((r,i)=>addCard(slide,{x:5.15+i*2.55,y:1.3,w:2.3,h:4.3,number:r[0],title:r[1],body:r[2],accent,titleSize:16,bodySize:11}));
  tx(slide, "الثقة = وضوح + هدوء. مش عناد، ومش صوت عالي.", 2.45, 6.05, 8.5, 0.3, { fontSize: 12, bold: true, color: accent, align: "center" });
}

// 16 — Owner language
{
  const { slide, accent } = newSlide(16);
  addSectionTitle(slide, "OWNER LANGUAGE", "اتكلم كصاحب", "مسؤولية.", accent, 0.7, 1.0, 4.0, 35);
  addCard(slide, { x: 4.95, y: 1.25, w: 3.35, h: 3.75, number: "موظف", title: "“أنا عملت اللي طلبتوه.”", body: "نفّذ الطلب فقط", accent: RED, border: "62352D", titleSize: 21, bodySize: 11 });
  tx(slide, "←", 8.36, 2.65, 0.5, 0.5, { fontSize: 27, bold: true, color: accent, align: "center", rtlMode: false });
  addCard(slide, { x: 8.9, y: 1.25, w: 3.65, h: 3.75, number: "صاحب مسؤولية", title: "“عملت X، لاحظت Y، فعملت Z كمان.”", body: "فهم النتيجة وحرّكها", accent, border: accent, titleSize: 21, bodySize: 11 });
  rect(slide, 0.7, 5.35, 11.85, 0.85, { fill: accent, line: accent });
  tx(slide, "تمرين الاجتماع القادم", 9.6, 5.55, 2.45, 0.25, { fontSize: 12, bold: true, color: BLACK });
  tx(slide, "حضّر جملة واحدة تعبّر عن رأيك + سبب واحد يدعمه. متدخلش فاضي تستنى الكل يقول إيه.", 1.1, 5.50, 8.3, 0.34, { fontSize: 11, bold: true, color: BLACK });
}

// 17 — Books
{
  const { slide, accent } = newSlide(17);
  addSectionTitle(slide, "30 SEC / BOOK", "4 كتب.", "4 أدوات.", accent, 0.7, 1.0, 4.0, 40);
  tx(slide, "اقرأ عشان تطبّق، مش عشان تجمع عناوين.", 0.7, 3.08, 4.1, 0.65, { fontSize: 14, color: MUTED });
  const books = [
    ["01","Atomic Habits","James Clear","نظام صغير يتكرر، فيصنع فرقاً كبيراً.",LIME],
    ["02","Deep Work","Cal Newport","ساعتان بتركيز أفضل من أسبوع مشتت.",BLUE],
    ["03","The 12 Week Year","Brian Moran","حوّل الهدف البعيد إلى إلحاح أسبوعي.",ORANGE],
    ["04","The Daily Stoic","Ryan Holiday","ثبات انفعالي تحت الضغط.",PINK],
  ];
  books.forEach((b,i)=>{
    const x=5.05+(i%2)*3.75, y=1.18+Math.floor(i/2)*2.35;
    addCard(slide,{x,y,w:3.45,h:2.05,number:b[0],title:b[1],body:`${b[2]}\n\n${b[3]}`,accent:b[4],titleSize:17,bodySize:10});
  });
}

// 18 — Closing
{
  const { slide, accent } = newSlide(18);
  circle(slide, 0.95, 1.35, 3.75, accent, accent, 100);
  circle(slide, 1.35, 1.75, 2.95, accent, accent, 100);
  circle(slide, 2.30, 2.68, 1.05, accent, accent, 100);
  circle(slide, 2.52, 2.89, 0.63, accent, accent, 78);
  tx(slide, "PHANTOMS", 1.48, 4.72, 2.7, 0.27, { fontSize: 13, bold: true, color: PAPER, align: "center", rtlMode: false, charSpacing: 2 });
  tx(slide, "EST. 2026", 1.75, 5.08, 2.15, 0.18, { fontSize: 7, bold: true, color: accent, align: "center", rtlMode: false, charSpacing: 1.5 });
  addSectionTitle(slide, "ONE LAST SIGNAL", "من هنا…", "يبدأ الأثر.", accent, 5.35, 1.05, 6.2, 41);
  addQuote(slide, "النهارده مش بس سمعتوا خطة؛ إنتوا بقيتوا جزء من كيان بيصنع فرق.", accent, 5.35, 3.47, 6.5, 1.22);
  tx(slide, "شكراً لحضوركم، لالتزامكم، وللطاقة اللي كل واحد قرر يحطها هنا.", 5.35, 5.05, 6.5, 0.5, { fontSize: 13, color: MUTED });
}

// 19 — Transition
{
  const { slide } = newSlide(19);
  slide.background = { color: ORANGE };
  for (let x=0;x<W;x+=0.75) line(slide,x,0,0,H,"E45C30",0.5);
  for (let y=0;y<H;y+=0.75) line(slide,0,y,W,0,"E45C30",0.5);
  slide.addImage({ path: phantomImage, x: 0.95, y: 0.48, w: 3.65, h: 6.47, transparency: 0 });
  addKicker(slide, "SWITCH THE MODE", BLACK, 5.15, 1.15, 4.5);
  tx(slide, "كلام الشغل", 5.15, 1.72, 6.6, 0.78, { fontSize: 49, bold: true, color: BLACK });
  tx(slide, "خلص.", 5.15, 2.48, 6.6, 0.84, { fontSize: 49, bold: true, color: "B54928" });
  tx(slide, "من اللحظة دي إحنا إخوات وصحاب.", 5.15, 3.60, 6.4, 0.42, { fontSize: 20, bold: true, color: BLACK });
  rect(slide, 5.15, 4.55, 6.7, 1.05, { fill: ORANGE, line: BLACK, width: 2 });
  tx(slide, "يلا نفصل… ونشوف مين هيسد ومين هيخسر في اللعب.", 5.45, 4.79, 6.1, 0.48, { fontSize: 16, bold: true, color: BLACK });
  tx(slide, "PHANTOMS / FIRST ASSEMBLY", 5.15, 6.25, 4.5, 0.22, { fontSize: 8, bold: true, color: "9A3D22", align: "left", rtlMode: false, charSpacing: 1.5 });
}

// A1 — Appendix cover
{
  const { slide, accent } = newSlide(20, true);
  tx(slide, "A", 0.35, 0.95, 3.55, 4.7, { fontSize: 210, bold: true, color: "38362E", align: "left", rtlMode: false });
  addSectionTitle(slide, "SEND LATER / NOT LIVE", "اللي ما قلناهوش…", "موجود هنا.", accent, 3.55, 1.15, 5.2, 35);
  tx(slide, "مرجع مكتوب يوصل بعد الاجتماع بساعات — كامل، واضح، ويرجعوله وقت ما يحتاجوه.", 3.55, 3.42, 4.9, 0.75, { fontSize: 14, color: MUTED });
  const list = ["تطبيق 12 Week Year خطوة بخطوة", "إطار اختيار فكرة + MVP", "ملخصات الكتب الأربعة", "Roadmap اللجان بالتواريخ"];
  list.forEach((v,i)=>{
    tx(slide, String(i+1).padStart(2,"0"), 9.05, 1.35+i*1.08, 0.42, 0.24, { fontSize: 9, bold:true, color:accent, align:"left", rtlMode:false });
    tx(slide, v, 9.60, 1.24+i*1.08, 2.65, 0.48, { fontSize:13, bold:true });
    line(slide,9.05,2.05+i*1.08,3.25,0,"3B3932",0.8);
  });
}

// A2 — 12-week detail
{
  const { slide, accent } = newSlide(21, true);
  addSectionTitle(slide, "STEP BY STEP", "من هدف كبير", "لإيقاع أسبوعي.", accent, 0.7, 1.0, 4.1, 35);
  const steps = [
    ["01","اختار نتيجة واحدة","واضحة، محددة، وممكن قياسها بنهاية الأسبوع 12."],
    ["02","حدّد دليل النجاح","Demo، مشروع شغال، اختبار، أو مستخدم حقيقي — مش إحساس."],
    ["03","قسّمها لـ12 تسليم","كل أسبوع حركة صغيرة تقرّبك من النتيجة النهائية."],
    ["04","احجز وقت التنفيذ","جلسات ثابتة في التقويم قبل ما الأسبوع يتملي."],
    ["05","راجع كل أسبوع","إيه اتنفّذ؟ إيه اتعطّل؟ وإيه التعديل الضروري؟"],
    ["06","أغلق الدورة","احتفل، وثّق الدروس، ثم صمّم الدورة التالية."],
  ];
  steps.forEach((s,i)=>{const x=5.0+(i%3)*2.52,y=1.17+Math.floor(i/3)*2.45;addCard(slide,{x,y,w:2.27,h:2.17,number:s[0],title:s[1],body:s[2],accent,titleSize:15,bodySize:9});});
}

// A3 — Scoreboard
{
  const { slide, accent } = newSlide(22, true);
  addSectionTitle(slide, "WEEKLY SCOREBOARD", "قِس التنفيذ…", "مش النوايا.", accent, 0.7, 1.0, 4.2, 37);
  tx(slide, "لو مش شايف الرقم، مش هتعرف تصلّح المسار.", 0.7, 3.22, 4.0, 0.42, { fontSize: 14, color: MUTED });
  rect(slide, 5.15, 1.25, 7.0, 4.55, { fill: BG, line: "4A4B40" });
  tx(slide, "WEEK 06 / 12", 5.55, 1.60, 2.1, 0.22, { fontSize: 9, bold:true, color:MUTED, align:"left",rtlMode:false,charSpacing:1.2 });
  tx(slide, "78%", 10.65, 1.45, 1.1, 0.55, { fontSize:35,bold:true,color:accent,align:"left",rtlMode:false });
  rect(slide, 5.55, 2.22, 6.2, 0.10, { fill:"2C2D26",line:"2C2D26" });
  rect(slide, 5.55, 2.22, 4.84, 0.10, { fill:accent,line:accent });
  const metrics=[["LEAD","7 / 9","تاسكات الأسبوع"],["LAG","01","Demo قابل للتجربة"],["RHYTHM","4×","جلسات Deep Work"]];
  metrics.forEach((m,i)=>addCard(slide,{x:5.55+i*2.08,y:2.78,w:1.86,h:1.68,number:m[0],title:m[1],body:m[2],accent,titleSize:23,bodySize:8}));
  tx(slide, "المطلوب ≥ 85% تنفيذ أسبوعي، ثم نراجع جودة الناتج.", 5.55, 4.82, 6.2, 0.38, { fontSize:11,color:MUTED,align:"center" });
  addQuote(slide, "الهدف السنوي يحفّزك يومين. لوحة القياس الأسبوعية تغيّر سلوكك 12 أسبوع.", accent, 0.7, 5.45, 11.45, 0.80);
}

// A4 — Product fit
{
  const { slide, accent } = newSlide(23, true);
  addSectionTitle(slide, "PRODUCT–MARKET FIT / LITE", "ابدأ من", "ألم حقيقي.", accent, 0.7, 1.0, 4.1, 39);
  tx(slide, "مش من تقنية نفسك تجربها.", 0.7, 3.18, 3.8, 0.35, { fontSize:14,color:MUTED });
  const funnel=[
    ["WHO","مستخدم محدد","مين الشخص؟ وإمتى تظهر مشكلته؟",6.9],
    ["PAIN","مشكلة متكررة","إيه تكلفتها: وقت، فلوس، مخاطرة؟",6.2],
    ["PROOF","دليل على الطلب","هل جرّب حل؟ هل سيدفع أو يغيّر سلوكه؟",5.5],
    ["VALUE","وعد واحد واضح","إيه التحسّن المحدد اللي هنصنعه؟",4.8],
  ];
  funnel.forEach((f,i)=>addCard(slide,{x:5.2,y:1.05+i*1.18,w:f[3],h:0.95,number:f[0],title:f[1],body:f[2],accent,titleSize:13,bodySize:8}));
  rect(slide,0.7,5.65,11.4,0.56,{fill:accent,transparency:92,line:accent,lineTransparency:75});
  tx(slide,"لو معرفتش تقول المستخدم والمشكلة في جملة واحدة، الفكرة لسه مش ناضجة.",1.1,5.80,10.6,0.25,{fontSize:12,bold:true,color:accent,align:"center"});
}

// A5 — MVP
{
  const { slide, accent } = newSlide(24, true);
  addSectionTitle(slide, "MVP ≠ MINI PRODUCT", "أصغر تجربة…", "بأكبر تعلّم.", accent, 0.7, 0.92, 4.0, 35);
  const cards=[
    ["01","أخطر افتراض","إيه الحاجة اللي لو طلعت غلط، الفكرة كلها تقع؟"],
    ["02","أسرع اختبار","Landing page، prototype، concierge، أو feature واحدة."],
    ["MVP","قرار مبني على دليل","نكمل؟ نعدّل؟ ولا نوقف قبل حرق الوقت؟"],
  ];
  cards.forEach((c,i)=>{
    const x=4.7+i*2.68;
    addCard(slide,{x,y:1.45,w:2.38,h:3.65,number:c[0],title:c[1],body:c[2],accent,titleSize:17,bodySize:11,border:i===2?accent:GRID});
    if(i<2)tx(slide,i===0?"+":"=",x+2.40,2.83,0.26,0.35,{fontSize:23,bold:true,color:accent,align:"center",rtlMode:false});
  });
  tx(slide,"BUILD",4.8,5.55,1.1,0.23,{fontSize:9,bold:true,color:MUTED,align:"center",rtlMode:false,charSpacing:1.2});
  tx(slide,"→",5.9,5.50,0.5,0.3,{fontSize:16,bold:true,color:accent,align:"center",rtlMode:false});
  tx(slide,"MEASURE",6.38,5.55,1.4,0.23,{fontSize:9,bold:true,color:MUTED,align:"center",rtlMode:false,charSpacing:1.2});
  tx(slide,"→",7.78,5.50,0.5,0.3,{fontSize:16,bold:true,color:accent,align:"center",rtlMode:false});
  tx(slide,"LEARN",8.28,5.55,1.1,0.23,{fontSize:9,bold:true,color:MUTED,align:"center",rtlMode:false,charSpacing:1.2});
}

// A6 — Book notes
{
  const { slide, accent } = newSlide(25, true);
  addSectionTitle(slide, "REFERENCE NOTES", "اقرأ بهدف", "التطبيق.", accent, 0.7, 1.0, 3.8, 39);
  const notes=[
    ["01","Atomic Habits","غيّر البيئة قبل ما تلوم الإرادة. صغّر العادة، اربطها بإشارة ثابتة، وتابع الاستمرارية.","تطبيق: 30 دقيقة تطوير بعد أول قهوة.",LIME],
    ["02","Deep Work","احمِ وقتاً بلا مقاطعات لمهمة معرفية صعبة. أغلق الإشعارات، حدّد نهاية، ثم قِس الناتج.","تطبيق: جلستان × 60 دقيقة أسبوعياً.",BLUE],
    ["03","The 12 Week Year","هدف قصير، خطة أسبوعية، وScoreboard. التنفيذ يُراجع كل أسبوع لا آخر السنة.","تطبيق: نسبة تنفيذ أسبوعية واضحة.",ORANGE],
    ["04","The Daily Stoic","فرّق بين ما تملكه وما لا تملكه. ركّز على قرارك واستجابتك وجودة فعلك تحت الضغط.","تطبيق: مراجعة هادئة في نهاية اليوم.",PINK],
  ];
  notes.forEach((n,i)=>{const x=4.65+(i%2)*3.78,y=1.05+Math.floor(i/2)*2.48;addCard(slide,{x,y,w:3.47,h:2.22,number:n[0],title:n[1],body:`${n[2]}\n\n${n[3]}`,accent:n[4],titleSize:16,bodySize:9});});
}

// A7 — Roadmap
{
  const { slide, accent } = newSlide(26, true);
  addSectionTitle(slide, "12-WEEK ROADMAP", "التأسيس → البناء", "→ الدمج.", accent, 0.7, 0.9, 4.1, 34);
  tx(slide, "ضع التواريخ المعتمدة بجانب كل أسبوع قبل الإرسال.", 0.7, 3.0, 3.9, 0.52, { fontSize:13,color:MUTED });
  const bx=4.8, by=1.15, bw=7.5;
  rect(slide,bx,by,bw,4.7,{fill:APP_BG,line:"414139"});
  // week labels
  for(let i=0;i<12;i++){
    const xx=bx+1.15+i*(6.08/12);
    tx(slide,`W${i+1}`,xx,by+0.22,0.45,0.18,{fontSize:6.5,bold:true,color:MUTED,align:"center",rtlMode:false});
  }
  const rows=[
    ["SOFTWARE",["أساس","تطبيق","Build","Integration"],LIME],
    ["HARDWARE",["أساس","Prototype","Build","Integration"],ORANGE],
    ["AI",["Data","Model","Evaluate","Integration"],BLUE],
  ];
  rows.forEach((r,ri)=>{
    const yy=by+0.85+ri*1.05;
    tx(slide,r[0],bx+0.12,yy+0.28,1.0,0.20,{fontSize:8,bold:true,color:PAPER,align:"left",rtlMode:false,charSpacing:.8});
    r[1].forEach((stage,si)=>{
      const xx=bx+1.16+si*1.52;
      rect(slide,xx,yy,1.38,0.70,{fill:r[2],transparency:91,line:r[2],lineTransparency:60});
      tx(slide,stage,xx+0.08,yy+0.22,1.22,0.22,{fontSize:8.5,bold:true,color:PAPER,align:"center",rtlMode:false});
    });
    line(slide,bx,yy+0.85,bw,0,"35352F",.6);
  });
  tx(slide,"CHECK",6.95,5.22,0.8,0.20,{fontSize:7,bold:true,color:accent,align:"center",rtlMode:false});
  tx(slide,"DEMO",8.55,5.22,0.8,0.20,{fontSize:7,bold:true,color:accent,align:"center",rtlMode:false});
  tx(slide,"REVIEW",10.15,5.22,0.8,0.20,{fontSize:7,bold:true,color:accent,align:"center",rtlMode:false});
  rect(slide,0.7,5.75,11.6,0.54,{fill:accent,transparency:92,line:accent,lineTransparency:70});
  tx(slide,"كل مرحلة تنتهي بتسليم يمكن رؤيته أو تجربته — مش عنوان «خلصنا المحتوى».",1.05,5.88,10.9,0.25,{fontSize:11.5,bold:true,color:accent,align:"center"});
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  await pptx.writeFile({ fileName: outputFile, compression: true });
  const stat = fs.statSync(outputFile);
  console.log(`Created ${outputFile}`);
  console.log(`Slides: ${pptx._slides.length}`);
  console.log(`Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
