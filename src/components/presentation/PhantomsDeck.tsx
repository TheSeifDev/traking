"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  BookOpen,
  Box,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Columns3,
  Command,
  Cpu,
  Expand,
  Eye,
  Flag,
  Gauge,
  Grid2X2,
  Handshake,
  Hourglass,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  MessageCircleMore,
  Mic2,
  Pause,
  Play,
  Presentation,
  Printer,
  Quote,
  Radio,
  Rocket,
  RotateCcw,
  Send,
  Sparkles,
  SquareArrowOutUpRight,
  Target,
  TimerReset,
  Trophy,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./PhantomsDeck.module.css";

type Accent = "lime" | "orange" | "blue" | "pink" | "cream";
type SlideKind = "live" | "appendix";

type SlideMeta = {
  id: string;
  indexLabel: string;
  section: string;
  time: string;
  title: string;
  shortTitle: string;
  accent: Accent;
  kind: SlideKind;
  note: string;
};

const slides: SlideMeta[] = [
  {
    id: "waiting",
    indexLabel: "00",
    section: "قبل البداية",
    time: "10:00 — 10:10",
    title: "بنبدأ بعد شوية.",
    shortTitle: "مرحلة الانتظار",
    accent: "lime",
    kind: "live",
    note: "شغّل السلايد دي أثناء دخول الأعضاء. استقبل الناس بالاسم، وخلي الموسيقى خفيفة. لا تبدأ اعتذارات؛ البداية الرسمية 10:10.",
  },
  {
    id: "opening",
    indexLabel: "01",
    section: "الافتتاحية",
    time: "10:10 — 10:12",
    title: "أول اجتماع. أول خطوة بجد.",
    shortTitle: "الافتتاح",
    accent: "lime",
    kind: "live",
    note: "ادخل بالجملة المكتوبة حرفياً، ثم اسكت ثانية. نبرة هادئة وواثقة. الهدف هنا الاستحواذ على الانتباه، لا سرد الإنجازات.",
  },
  {
    id: "agenda",
    indexLabel: "02",
    section: "خريطة الاجتماع",
    time: "10:00 — 12:00",
    title: "120 دقيقة. كل دقيقة لها وظيفة.",
    shortTitle: "الجدول الزمني",
    accent: "cream",
    kind: "live",
    note: "اعرض الخريطة بسرعة. لا تقرأ كل سطر؛ ركّز على أننا سنسمع، نحدد طريقة العمل، ثم ننهي الرسميات في موعدها.",
  },
  {
    id: "identity",
    indexLabel: "03",
    section: "الهوية",
    time: "10:12 — 10:15",
    title: "إحنا مين؟",
    shortTitle: "هوية Phantoms",
    accent: "orange",
    kind: "live",
    note: "تعريفك الشخصي جملتان فقط: خبرتك + أقوى إنجاز رقمي موثوق. استبدل الحقل الصغير قبل العرض. اختم بأن دورك صناعة البيئة لا استعراض السيرة.",
  },
  {
    id: "early",
    indexLabel: "04",
    section: "ليه بدأنا بدري؟",
    time: "10:15 — 10:25",
    title: "إحنا بنشتري وقت.",
    shortTitle: "البدء المبكر",
    accent: "blue",
    kind: "live",
    note: "قارن بوضوح بين Reactive وProactive. الأساسيات الحالية ليست حملاً إضافياً؛ هي نفس مادة السنة ولكن بعمق وتطبيق قبل ضغط الترم.",
  },
  {
    id: "foundation",
    indexLabel: "05",
    section: "الأساس قبل الفكرة",
    time: "10:25 — 10:29",
    title: "السواقة قبل نوع العربية.",
    shortTitle: "ليه من غير فكرة؟",
    accent: "lime",
    kind: "live",
    note: "استخدم تشبيه العربية مرة واحدة فقط. الفكرة: لو اخترنا المشروع الآن سنحبس أنفسنا داخل سقف مهاراتنا الحالية.",
  },
  {
    id: "product-thinking",
    indexLabel: "06",
    section: "Product Thinking",
    time: "10:29 — 10:33",
    title: "الفكرة مش هي القيمة.",
    shortTitle: "عقلية المنتج",
    accent: "pink",
    kind: "live",
    note: "ازرع الأسئلة الثلاثة ولا تفتح ورشة اختيار فكرة الآن. قل بوضوح: سنعود لها بعد امتلاك الأدوات، وليس لأننا بلا اتجاه.",
  },
  {
    id: "permission",
    indexLabel: "07",
    section: "التفويض والتنظيم",
    time: "10:33 — 10:35",
    title: "امتياز… ومسؤولية.",
    shortTitle: "البرمشن",
    accent: "orange",
    kind: "live",
    note: "قل الصياغة الهادئة كما هي. لا تكرر كلمة السرية، ولا تصنع غموضاً مبالغاً فيه. الحزم مرة واحدة يكفي.",
  },
  {
    id: "committees",
    indexLabel: "08",
    section: "عروض اللجان",
    time: "10:35 — 11:15",
    title: "3 مسارات. منتج واحد.",
    shortTitle: "اللجان الثلاث",
    accent: "cream",
    kind: "live",
    note: "قف بجوار المتحدثين ولا تجلس. كل لجنة 12 دقيقة + انتقال سريع. نبّه قبلها بيوم أنك ستوقف العرض عند انتهاء الوقت.",
  },
  {
    id: "committee-brief",
    indexLabel: "09",
    section: "عروض اللجان",
    time: "12 دقيقة لكل لجنة",
    title: "كل عرض يجاوب على 5 أسئلة.",
    shortTitle: "قالب العرض",
    accent: "blue",
    kind: "live",
    note: "هذه هي الشاشة المرجعية أثناء تبديل اللجان. المطلوب من Head + Monitor: كلام محدد وقابل للقياس، لا عناوين عامة.",
  },
  {
    id: "communication-chain",
    indexLabel: "10",
    section: "نظام العمل",
    time: "ضمن عروض اللجان",
    title: "المعلومة تمشي من أقصر طريق.",
    shortTitle: "التواصل والـ Strikes",
    accent: "orange",
    kind: "live",
    note: "اشرح أن التصعيد ليس تجاوزاً للأدوار. الأعذار والمتابعة اليومية تبدأ من Monitor، والمشكلة الفنية من Head، ثم سهيلة، ثم سيف عند الحاجة.",
  },
  {
    id: "black-box",
    indexLabel: "11",
    section: "الصندوق الأسود",
    time: "11:15 — 11:25",
    title: "سألتم. وإحنا سمعنا.",
    shortTitle: "أسئلة الفورم",
    accent: "pink",
    kind: "live",
    note: "اختر 3–4 أسئلة متكررة فقط، من غير أسماء. أعطِ مساحة أكبر لسؤال إدارة الوقت لأنه جسر طبيعي للفقرة التالية.",
  },
  {
    id: "mindset",
    indexLabel: "12",
    section: "Mindset",
    time: "11:25 — 11:33",
    title: "المشاعر محترمة. الكلمة مُلزمة.",
    shortTitle: "فصل المشاعر عن الالتزام",
    accent: "lime",
    kind: "live",
    note: "لا تقلل من ضغط أي شخص. فرّق بين احترام الظروف وبين اختفاء المسؤولية. المحترف يتواصل مبكراً، يعيد التخطيط، ثم يسلّم.",
  },
  {
    id: "pareto",
    indexLabel: "13",
    section: "إدارة الوقت",
    time: "11:33 — 11:43",
    title: "مش كل حاجة بنفس الأهمية.",
    shortTitle: "قاعدة 80/20",
    accent: "orange",
    kind: "live",
    note: "اطلب منهم اختيار تاسك حالي وتحديد الجزء صاحب أكبر أثر. المثال الأكاديمي: المفاهيم والأسئلة المتكررة أولاً، لا ترتيب صفحات الكتاب.",
  },
  {
    id: "twelve-week",
    indexLabel: "14",
    section: "نظام التنفيذ",
    time: "11:43 — 11:47",
    title: "12 أسبوع = سنة تنفيذ.",
    shortTitle: "The 12 Week Year",
    accent: "blue",
    kind: "live",
    note: "قدّم الفكرة فقط، لا التفاصيل. كل دورة لها نتيجة واحدة قابلة للقياس وتسليم أسبوعي. التطبيق الكامل موجود في الملحق الذي سيرسل بعد الاجتماع.",
  },
  {
    id: "presence",
    indexLabel: "15",
    section: "Communication",
    time: "11:47 — 11:53",
    title: "اشتغل كويس. وخلي شغلك ظاهر.",
    shortTitle: "الحضور الواثق",
    accent: "pink",
    kind: "live",
    note: "الثقة ليست صوتاً عالياً ولا عناداً. المقصود أن تأتي بحل، تتكلم بأرقام، وتعلن موقفاً واضحاً باحترام.",
  },
  {
    id: "owner-language",
    indexLabel: "16",
    section: "Communication",
    time: "11:53 — 11:55",
    title: "اتكلم كصاحب مسؤولية.",
    shortTitle: "لغة المسؤولية",
    accent: "cream",
    kind: "live",
    note: "اقرأ المثالين بصوتين مختلفين. اختم بالتمرين: قبل أي اجتماع، حضّر رأياً واحداً وسببه، ولا تدخل فاضي تستنى رأي الأغلبية.",
  },
  {
    id: "books",
    indexLabel: "17",
    section: "لمن يريد التعمّق",
    time: "90 ثانية",
    title: "4 كتب. 4 أدوات.",
    shortTitle: "مساحة الكتب",
    accent: "blue",
    kind: "live",
    note: "30 ثانية كحد أقصى لكل كتاب. لا تلخّص الفصول. اربط كل كتاب بأداة واحدة، وقل إن الملخصات الكاملة ستصل مكتوبة.",
  },
  {
    id: "closing",
    indexLabel: "18",
    section: "الختام",
    time: "11:55 — 12:00",
    title: "من هنا… يبدأ الأثر.",
    shortTitle: "الخلاصة",
    accent: "lime",
    kind: "live",
    note: "قدّر الحضور والالتزام أولاً. قل الخلاصة، ثم انتقل فوراً إلى السلايد التالي من غير أسئلة ولا فاصل.",
  },
  {
    id: "transition",
    indexLabel: "19",
    section: "التحوّل",
    time: "12:00",
    title: "كلام الشغل خلص.",
    shortTitle: "من هنا إحنا صحاب",
    accent: "orange",
    kind: "live",
    note: "ابتسم، شمّر الكم، انزل من مكان المنصة، وابدأ اللعب فوراً. الانتقال المفاجئ نفسه هو ما يكسر التوتر.",
  },
  {
    id: "appendix-cover",
    indexLabel: "A1",
    section: "يُرسل بعد الاجتماع",
    time: "مرجع مكتوب",
    title: "اللي ما قلناهوش… هنا.",
    shortTitle: "محتوى ما بعد الاجتماع",
    accent: "cream",
    kind: "appendix",
    note: "بداية الملحق. لا تعرض هذه الصفحات في الاجتماع إلا عند الحاجة. صدّرها PDF أو أرسل رابط العرض بعد ساعات من الاجتماع.",
  },
  {
    id: "twelve-week-detail",
    indexLabel: "A2",
    section: "12 Week Year",
    time: "خطوات التطبيق",
    title: "من هدف كبير إلى إيقاع أسبوعي.",
    shortTitle: "تطبيق 12 أسبوع",
    accent: "blue",
    kind: "appendix",
    note: "النسخة المكتوبة: خطوة بخطوة لتطبيق النظام على كل لجنة، مع هدف واضح وقياس أسبوعي ومراجعة دورية.",
  },
  {
    id: "scoreboard",
    indexLabel: "A3",
    section: "12 Week Year",
    time: "Scoreboard",
    title: "قِس التنفيذ… مش النوايا.",
    shortTitle: "لوحة القياس",
    accent: "lime",
    kind: "appendix",
    note: "فرّق بين Lag indicator: النتيجة النهائية، وLead indicator: السلوك الأسبوعي الذي يصنعها. راقب الاثنين.",
  },
  {
    id: "product-fit",
    indexLabel: "A4",
    section: "Product Thinking",
    time: "إطار اختيار الفكرة",
    title: "ابدأ من ألم حقيقي.",
    shortTitle: "اختيار فكرة المنتج",
    accent: "pink",
    kind: "appendix",
    note: "هذا الإطار يستخدم لاحقاً في جلسة اختيار المشروع. لا نختار التقنية أولاً؛ نختار مستخدماً ومشكلة وسلوكاً قابلاً للرصد.",
  },
  {
    id: "mvp",
    indexLabel: "A5",
    section: "Product Thinking",
    time: "MVP",
    title: "أصغر تجربة… بأكبر تعلّم.",
    shortTitle: "بناء الـ MVP",
    accent: "orange",
    kind: "appendix",
    note: "الـMVP ليس نسخة سيئة من المنتج؛ هو أصغر تجربة تختبر أخطر افتراض بسرعة وبتكلفة قليلة.",
  },
  {
    id: "book-notes",
    indexLabel: "A6",
    section: "مكتبة Phantoms",
    time: "ملخصات مرجعية",
    title: "اقرأ بهدف التطبيق.",
    shortTitle: "ملخصات الكتب",
    accent: "cream",
    kind: "appendix",
    note: "أرسل هذه الصفحة كمرجع. المطلوب تطبيق فكرة واحدة من كل كتاب، لا تحويل القراءة إلى مهمة استعراضية.",
  },
  {
    id: "roadmap",
    indexLabel: "A7",
    section: "Roadmap",
    time: "12 أسبوع",
    title: "التأسيس → البناء → الدمج.",
    shortTitle: "خارطة الطريق",
    accent: "blue",
    kind: "appendix",
    note: "هيكل زمني موحّد. على رؤساء اللجان استبدال الوصف العام بالتسليمات الفنية والتواريخ المعتمدة قبل إرسال النسخة النهائية.",
  },
];

const accentMap: Record<Accent, string> = {
  lime: "#c7ff42",
  orange: "#ff6b35",
  blue: "#4ca6ff",
  pink: "#ff67b3",
  cream: "#f5efdf",
};

const agenda = [
  ["10:00", "انتظار ووصول", "10 د"],
  ["10:10", "الهوية + ليه بدري", "15 د"],
  ["10:25", "الأساس قبل الفكرة + التفويض", "10 د"],
  ["10:35", "عروض اللجان", "40 د"],
  ["11:15", "الصندوق الأسود", "10 د"],
  ["11:25", "Mindset + وقت + تواصل", "30 د"],
  ["11:55", "الختام والتحوّل", "5 د"],
];

const books = [
  { code: "01", title: "Atomic Habits", author: "James Clear", line: "نظام صغير يتكرر، فيصنع فرقاً كبيراً.", color: "lime" },
  { code: "02", title: "Deep Work", author: "Cal Newport", line: "ساعتان بتركيز أفضل من أسبوع مشتت.", color: "blue" },
  { code: "03", title: "The 12 Week Year", author: "Brian Moran", line: "حوّل الهدف البعيد إلى إلحاح أسبوعي.", color: "orange" },
  { code: "04", title: "The Daily Stoic", author: "Ryan Holiday", line: "ثبات انفعالي تحت الضغط.", color: "pink" },
];

function Pill({ children }: { children: React.ReactNode }) {
  return <span className={styles.pill}>{children}</span>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className={styles.kicker}>{children}</div>;
}

function QuoteBlock({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className={styles.quoteBlock}>
      <Quote size={25} aria-hidden="true" />
      <div>
        {label ? <small>{label}</small> : null}
        <p>{children}</p>
      </div>
    </div>
  );
}

function MiniPhantom({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.miniPhantom} ${className}`} aria-hidden="true">
      <span />
      <i />
    </div>
  );
}

function SlideShell({ meta, children }: { meta: SlideMeta; children: React.ReactNode }) {
  return (
    <article
      className={`${styles.slide} ${meta.kind === "appendix" ? styles.appendixSlide : ""}`}
      style={{ "--accent": accentMap[meta.accent] } as React.CSSProperties}
      data-slide-id={meta.id}
      aria-label={`${meta.indexLabel}: ${meta.title}`}
    >
      <div className={styles.noise} />
      <header className={styles.slideHeader}>
        <div className={styles.brandLockup}>
          <MiniPhantom />
          <span>PHANTOMS</span>
          <b>/ 26</b>
        </div>
        <div className={styles.sectionMeta}>
          {meta.kind === "appendix" ? <Pill>APPENDIX</Pill> : <Pill>LIVE</Pill>}
          <span>{meta.section}</span>
          <time>{meta.time}</time>
        </div>
      </header>
      <div className={styles.slideBody}>{children}</div>
      <footer className={styles.slideFooter}>
        <span>FIRST ASSEMBLY</span>
        <span className={styles.footerLine} />
        <b>{meta.indexLabel}</b>
      </footer>
    </article>
  );
}

function SlideContent({ id }: { id: string }) {
  switch (id) {
    case "waiting":
      return (
        <div className={styles.heroLayout}>
          <div className={styles.heroCopy}>
            <Kicker><Radio size={16} /> FIRST SIGNAL / 2026</Kicker>
            <h1>بنبدأ<br /><em>بعد شوية.</em></h1>
            <p className={styles.heroLead}>خد مكانك. اعرف اللي جنبك.<br />وسيـب الموبايل دقيقتين.</p>
            <div className={styles.waitingMeta}>
              <div><Clock3 /><span>البداية الرسمية</span><strong>10:10</strong></div>
              <div><Hourglass /><span>مدة الاجتماع</span><strong>110 دقيقة</strong></div>
            </div>
          </div>
          <div className={styles.figureWrap}>
            <div className={styles.figureRing} />
            <Image src="/phantoms/phantom-cutout.png" alt="شخصية Phantoms التجريدية" width={757} height={1345} priority />
            <span className={styles.verticalWord}>ASSEMBLE</span>
          </div>
        </div>
      );
    case "opening":
      return (
        <div className={styles.centerStatement}>
          <Kicker><Mic2 size={17} /> جملة الدخول</Kicker>
          <h1>أول اجتماع.<br /><em>أول خطوة بجد.</em></h1>
          <QuoteBlock>صباح الخير جميعاً. شكراً لالتزامكم وحضوركم في الميعاد، وشكراً لانتظاركم.</QuoteBlock>
          <p className={styles.microNote}>لا اعتذار. لا قصة حياة. ندخل في المعنى فوراً.</p>
        </div>
      );
    case "agenda":
      return (
        <div className={styles.agendaLayout}>
          <div className={styles.titleRail}>
            <Kicker><Clock3 size={17} /> الخطة الواقعية</Kicker>
            <h2>120 دقيقة.<br /><em>كل دقيقة لها وظيفة.</em></h2>
            <p>3 رسائل عميقة أفضل من 10 رسائل سطحية.</p>
          </div>
          <div className={styles.agendaList}>
            {agenda.map(([time, label, duration], i) => (
              <div className={styles.agendaRow} key={time}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <time>{time}</time>
                <strong>{label}</strong>
                <b>{duration}</b>
              </div>
            ))}
          </div>
        </div>
      );
    case "identity":
      return (
        <div className={styles.identityLayout}>
          <div>
            <Kicker><UsersRound size={17} /> IDENTITY / 02 MIN</Kicker>
            <h2>مش تيم بيحاول<br /><em>يبان كويس.</em></h2>
            <p className={styles.largeParagraph}>إحنا تيم بيبني <strong>منتجات حقيقية</strong><br />لـ <strong>ناس حقيقية.</strong></p>
          </div>
          <div className={styles.identityCard}>
            <div className={styles.identityNumber}>02</div>
            <h3>عرّف نفسك في جملتين</h3>
            <ol>
              <li><b>الخبرة:</b> أنا اشتغلت في <span>[مجالك]</span> وبنيت <span>[نوع المنتج]</span>.</li>
              <li><b>الدليل:</b> أقوى نتيجة حققتها كانت <span>[رقم موثوق]</span>.</li>
            </ol>
            <blockquote>أنا مش هنا أقولكم عملت إيه؛ أنا هنا أوفّر البيئة اللي تخليكم تعملوا أحسن.</blockquote>
          </div>
          <div className={styles.sloganStrip}><Sparkles /> شعار السنة: <strong>بنبني بجد. وبنثبت بالنتيجة.</strong></div>
        </div>
      );
    case "early":
      return (
        <div className={styles.splitComparison}>
          <div className={styles.sectionTitle}>
            <Kicker><TimerReset size={17} /> WHY NOW?</Kicker>
            <h2>إحنا بنشتري وقت،<br /><em>مش بنسرقه من حد.</em></h2>
          </div>
          <div className={`${styles.modeCard} ${styles.badMode}`}>
            <div className={styles.modeTop}><Pause /><span>REACTIVE</span></div>
            <h3>تبدأ مع أول محاضرة</h3>
            <ul><li>ضغط أكاديمي</li><li>تعلّم بنصف طاقة</li><li>طول الوقت بتلحق</li></ul>
            <small>الوقت هو اللي بيتحكم فيك</small>
          </div>
          <div className={`${styles.modeCard} ${styles.goodMode}`}>
            <div className={styles.modeTop}><Play /><span>PROACTIVE</span></div>
            <h3>تبدأ قبل الزحمة</h3>
            <ul><li>أساس متين</li><li>تطبيق بدل حفظ</li><li>إيقاع تحت سيطرتك</li></ul>
            <small>إنت اللي بتتحكم في الوتيرة</small>
          </div>
        </div>
      );
    case "foundation":
      return (
        <div className={styles.metaphorLayout}>
          <div className={styles.giantIndex}>01</div>
          <div className={styles.metaphorCopy}>
            <Kicker><Gauge size={17} /> FOUNDATION FIRST</Kicker>
            <h2>السواقة قبل<br /><em>نوع العربية.</em></h2>
            <p>مانيوال أو أوتوماتيك؟ الاختيار ده ييجي بعد ما تتعلم أساسيات السواقة.</p>
          </div>
          <div className={styles.equationStack}>
            <div><span>فكرة محددة الآن</span><ArrowLeft /><b>سقف مهاراتنا الحالية</b></div>
            <div className={styles.positiveEquation}><span>أدوات قوية أولاً</span><ArrowLeft /><b>نقدر ننفّذ أي فكرة</b></div>
          </div>
          <QuoteBlock label="القانون">الفريق الضعيف يضيّع الفكرة الكويسة. الفريق القوي يحوّل أي فكرة لمنتج ينافس.</QuoteBlock>
        </div>
      );
    case "product-thinking":
      return (
        <div className={styles.productLayout}>
          <div className={styles.productTitle}>
            <Kicker><Lightbulb size={17} /> PRODUCT THINKING</Kicker>
            <h2>الفكرة مش<br /><em>هي القيمة.</em></h2>
            <p>القيمة هي المهارة اللي هتنفّذ بيها، والدليل اللي هتتعلم منه.</p>
          </div>
          <div className={styles.questionOrbit}>
            <div className={styles.orbitCenter}><Box /><span>IDEA</span></div>
            <article><b>01</b><h3>المشكلة</h3><p>بنحل مشكلة حقيقية لمين بالظبط؟</p></article>
            <article><b>02</b><h3>الاستخدام</h3><p>هل حد مستعد يستخدم أو يدفع للحل فعلاً؟</p></article>
            <article><b>03</b><h3>الاختبار</h3><p>إيه أصغر MVP نجرّبه قبل ما نبني كل حاجة؟</p></article>
          </div>
        </div>
      );
    case "permission":
      return (
        <div className={styles.permissionLayout}>
          <div className={styles.lockVisual}><LockKeyhole /><span>AUTHORIZED</span><i /></div>
          <div>
            <Kicker><Handshake size={17} /> تفويض رسمي</Kicker>
            <h2>امتياز…<br /><em>ومسؤولية.</em></h2>
            <QuoteBlock>إحنا بدأنا بتفويض رسمي من الجهة المسؤولة، وده امتياز مانحطّش تفاصيله برّه التيم لأسباب تنظيمية — مش لأنه سر مخيف.</QuoteBlock>
            <div className={styles.dontDo}><X /> جملة واحدة واضحة تكفي. الغموض الزيادة يولّد قلق، مش هيبة.</div>
          </div>
        </div>
      );
    case "committees":
      return (
        <div className={styles.committeesLayout}>
          <div className={styles.sectionTitle}>
            <Kicker><Columns3 size={17} /> HEADS + MONITORS</Kicker>
            <h2>3 مسارات.<br /><em>منتج واحد.</em></h2>
            <p>40 دقيقة إجمالي — الانتقال محسوب.</p>
          </div>
          <div className={styles.trackCards}>
            <article><Code2 /><span>TRACK / 01</span><h3>Software</h3><p>السوفت يبني التجربة والنظام.</p><b>12 دقيقة</b></article>
            <article><Cpu /><span>TRACK / 02</span><h3>Hardware</h3><p>الهارد يحوّل الفكرة لشيء ملموس.</p><b>12 دقيقة</b></article>
            <article><BrainCircuit /><span>TRACK / 03</span><h3>AI</h3><p>الـAI يحوّل البيانات لقرار.</p><b>12 دقيقة</b></article>
          </div>
          <div className={styles.stageCue}><ArrowUpLeft /> المتحدث يعرض. القائد واقف بجانبه. الانتقال بدون فراغ.</div>
        </div>
      );
    case "committee-brief":
      return (
        <div className={styles.briefLayout}>
          <div>
            <Kicker><Presentation size={17} /> 12 MIN / HARD STOP</Kicker>
            <h2>كل عرض يجاوب<br /><em>على 5 أسئلة.</em></h2>
          </div>
          <div className={styles.briefGrid}>
            {[
              [Eye, "الرؤية الفنية", "هنوصل لإيه تقنياً؟"],
              [Gauge, "الوضع الحالي", "جاهزيتنا دلوقتي كام؟"],
              [Rocket, "الـ Roadmap", "هنبني بإيه وبأي ترتيب؟"],
              [UsersRound, "الأدوار", "مين مسؤول عن إيه؟"],
              [ListChecks, "الاستمرار", "إيه معيار الالتزام الواضح؟"],
            ].map(([Icon, title, text], i) => {
              const C = Icon as typeof Eye;
              return <article key={String(title)}><span>{String(i + 1).padStart(2, "0")}</span><C /><h3>{String(title)}</h3><p>{String(text)}</p></article>;
            })}
          </div>
        </div>
      );
    case "communication-chain":
      return (
        <div className={styles.chainLayout}>
          <div className={styles.chainTitle}>
            <Kicker><MessageCircleMore size={17} /> ONE CLEAR ROUTE</Kicker>
            <h2>المعلومة تمشي<br /><em>من أقصر طريق.</em></h2>
          </div>
          <div className={styles.chainFlow}>
            <div><b>01</b><strong>Monitor</strong><span>متابعة يومية + أعذار</span></div><ChevronLeft />
            <div><b>02</b><strong>Head</strong><span>مشكلة فنية + قرار مسار</span></div><ChevronLeft />
            <div><b>03</b><strong>سهيلة</strong><span>تنسيق + تصعيد</span></div><ChevronLeft />
            <div><b>04</b><strong>سيف</strong><span>قرار قيادي عند الحاجة</span></div>
          </div>
          <div className={styles.strikesBar}>
            <Flag />
            <div><strong>نظام الـ Strikes</strong><span>الالتزام = حضور + تواصل مبكر + تسليم. تفاصيل الحدّ وإعادة الضبط يعلنها كل Head بوضوح.</span></div>
            <Pill>NO SURPRISES</Pill>
          </div>
        </div>
      );
    case "black-box":
      return (
        <div className={styles.questionsLayout}>
          <div className={styles.blackBoxVisual}><span>؟</span><i>ANONYMOUS</i></div>
          <div className={styles.questionsCopy}>
            <Kicker><MessageCircleMore size={17} /> FORM QUESTIONS / 10 MIN</Kicker>
            <h2>سألتم.<br /><em>وإحنا سمعنا.</em></h2>
            <div className={styles.questionList}>
              <div><b>01</b><span>هوازن إزاي بين التيم والدراسة؟</span></div>
              <div><b>02</b><span>ليه لسه مفيش فكرة مشروع محددة؟</span></div>
              <div><b>03</b><span>إيه المتوقع مني كل أسبوع؟</span></div>
              <div><b>04</b><span>لو اتعطلت أو اتأخرت، أتصرف إزاي؟</span></div>
            </div>
            <small>إجابات مباشرة • بدون أسماء • 3–4 أسئلة فقط</small>
          </div>
        </div>
      );
    case "mindset":
      return (
        <div className={styles.mindsetLayout}>
          <div className={styles.sectionTitle}>
            <Kicker><BrainCircuit size={17} /> RULE / 01</Kicker>
            <h2>المشاعر محترمة.<br /><em>الكلمة مُلزمة.</em></h2>
          </div>
          <div className={styles.balanceVisual}>
            <div><span>إنساني</span><strong>ضغطك<br />مزاجك<br />ظروفك</strong><small>مفهومة ومحترمة</small></div>
            <div className={styles.balanceEquals}>≠</div>
            <div><span>احترافي</span><strong>تواصل<br />التزام<br />تسليم</strong><small>مسؤوليتك أمام التيم</small></div>
          </div>
          <QuoteBlock>المحترف مش اللي معندوش ضغط؛ المحترف هو اللي يتواصل بدري، يعيد ترتيب خطته، ويسلّم حتى تحت الضغط.</QuoteBlock>
          <div className={styles.actionLine}><Zap /> متقولش هتعمل إيه. اعمله — وخلي النتيجة تتكلم.</div>
        </div>
      );
    case "pareto":
      return (
        <div className={styles.paretoLayout}>
          <div className={styles.paretoFigure}>
            <span>20%</span>
            <div className={styles.paretoBar}><i /></div>
            <strong>من المجهود</strong>
          </div>
          <div className={styles.paretoArrow}><ArrowLeft /></div>
          <div className={styles.paretoFigure}>
            <span>80%</span>
            <div className={`${styles.paretoBar} ${styles.paretoBarLarge}`}><i /></div>
            <strong>من النتيجة</strong>
          </div>
          <div className={styles.paretoCopy}>
            <Kicker><Target size={17} /> RULE / 02 — PARETO</Kicker>
            <h2>مش كل حاجة<br /><em>بنفس الأهمية.</em></h2>
            <ol>
              <li><b>اسأل:</b> إيه الجزء اللي لو خلصته يحقق أغلب أثر التاسك؟</li>
              <li><b>ابدأ:</b> بأعلى ساعة طاقة — مش بالإيميل والتنضيف.</li>
              <li><b>في المذاكرة:</b> المفاهيم والأسئلة المتكررة قبل التفاصيل.</li>
            </ol>
          </div>
        </div>
      );
    case "twelve-week":
      return (
        <div className={styles.twelveLayout}>
          <div>
            <Kicker><TimerReset size={17} /> EXECUTION SYSTEM</Kicker>
            <h2>12 أسبوع<br /><em>= سنة تنفيذ.</em></h2>
            <p>لما المدى يقصر، الإلحاح يرجع.</p>
          </div>
          <div className={styles.cycleVisual}>
            <div className={styles.cycleCenter}><strong>12</strong><span>WEEKS</span></div>
            {[["هدف", "واضح"], ["خطة", "أسبوعية"], ["قياس", "صريح"], ["مراجعة", "وتعديل"]].map(([a, b], i) => <div key={a} className={styles.cycleNode} data-node={i + 1}><b>0{i + 1}</b><strong>{a}</strong><span>{b}</span></div>)}
          </div>
          <div className={styles.teamApplication}><Trophy /><span>تطبيق Phantoms</span><strong>كل دورة = هدف تقني واحد قابل للقياس + تسليم صغير كل أسبوع.</strong></div>
        </div>
      );
    case "presence":
      return (
        <div className={styles.presenceLayout}>
          <div className={styles.sectionTitle}>
            <Kicker><Radio size={17} /> RULE / 03 — COMMUNICATION</Kicker>
            <h2>اشتغل كويس.<br /><em>وخلي شغلك ظاهر.</em></h2>
            <p>الشغل الكويس مش دايماً بيتكلم عن نفسه.</p>
          </div>
          <div className={styles.presenceRules}>
            <article><span>01</span><MessageCircleMore /><h3>حلول قبل الأسئلة</h3><p>متقولش «نعمل إيه؟» بس؛ اقترح مسارين ورشّح واحد.</p></article>
            <article><span>02</span><Gauge /><h3>أرقام قبل الانطباع</h3><p>قول «قلّلنا الوقت 30%» بدل «الدنيا اتحسنت».</p></article>
            <article><span>03</span><Flag /><h3>موقف قبل الحياد</h3><p>اختار رأياً واضحاً، واذكر السبب بهدوء.</p></article>
          </div>
          <div className={styles.confidenceNote}><Check /> الثقة = وضوح + هدوء. مش عناد، ومش صوت عالي.</div>
        </div>
      );
    case "owner-language":
      return (
        <div className={styles.ownerLayout}>
          <div>
            <Kicker><Command size={17} /> OWNER LANGUAGE</Kicker>
            <h2>اتكلم كصاحب<br /><em>مسؤولية.</em></h2>
          </div>
          <div className={styles.languageCards}>
            <article className={styles.employeeCard}><span>موظف</span><p>“أنا عملت اللي طلبتوه.”</p><small>نفّذ الطلب فقط</small></article>
            <ArrowLeft />
            <article className={styles.ownerCard}><span>صاحب مسؤولية</span><p>“عملت X، لاحظت Y، فعملت Z كمان.”</p><small>فهم النتيجة وحرّكها</small></article>
          </div>
          <div className={styles.meetingExercise}>
            <b>تمرين الاجتماع القادم</b>
            <p>حضّر جملة واحدة تعبّر عن رأيك + سبب واحد يدعمه. متدخلش فاضي تستنى الكل يقول إيه.</p>
            <ArrowUpLeft />
          </div>
        </div>
      );
    case "books":
      return (
        <div className={styles.booksLayout}>
          <div className={styles.booksTitle}>
            <Kicker><BookOpen size={17} /> 30 SEC / BOOK</Kicker>
            <h2>4 كتب.<br /><em>4 أدوات.</em></h2>
            <p>اقرأ عشان تطبّق، مش عشان تجمع عناوين.</p>
          </div>
          <div className={styles.bookShelf}>
            {books.map((book) => <article key={book.code} data-color={book.color}><span>{book.code}</span><div><small>{book.author}</small><h3>{book.title}</h3><p>{book.line}</p></div></article>)}
          </div>
        </div>
      );
    case "closing":
      return (
        <div className={styles.closingLayout}>
          <div className={styles.closingSeal}><MiniPhantom /><span>PHANTOMS</span><b>EST. 2026</b></div>
          <div>
            <Kicker><Sparkles size={17} /> ONE LAST SIGNAL</Kicker>
            <h2>من هنا…<br /><em>يبدأ الأثر.</em></h2>
            <QuoteBlock>النهارده مش بس سمعتوا خطة؛ إنتوا بقيتوا جزء من كيان بيصنع فرق.</QuoteBlock>
            <p>شكراً لحضوركم، لالتزامكم، وللطاقة اللي كل واحد قرر يحطها هنا.</p>
          </div>
        </div>
      );
    case "transition":
      return (
        <div className={styles.transitionLayout}>
          <Image src="/phantoms/phantom-cutout.png" alt="" width={757} height={1345} />
          <div className={styles.transitionCopy}>
            <Kicker><Zap size={17} /> SWITCH THE MODE</Kicker>
            <h1>كلام الشغل<br /><em>خلص.</em></h1>
            <p>من اللحظة دي إحنا إخوات وصحاب.</p>
            <div className={styles.gameCall}>يلا نفصل… ونشوف مين هيسد ومين هيخسر في اللعب. <ArrowLeft /></div>
          </div>
        </div>
      );
    case "appendix-cover":
      return (
        <div className={styles.appendixCover}>
          <span className={styles.appendixMark}>A</span>
          <div>
            <Kicker><Send size={17} /> SEND LATER / NOT LIVE</Kicker>
            <h1>اللي ما قلناهوش…<br /><em>موجود هنا.</em></h1>
            <p>مرجع مكتوب يوصل بعد الاجتماع بساعات — كامل، واضح، ويرجعوله وقت ما يحتاجوه.</p>
          </div>
          <div className={styles.appendixList}>
            <span>01</span><p>تطبيق 12 Week Year خطوة بخطوة</p>
            <span>02</span><p>إطار اختيار فكرة + MVP</p>
            <span>03</span><p>ملخصات الكتب الأربعة</p>
            <span>04</span><p>Roadmap اللجان بالتواريخ</p>
          </div>
        </div>
      );
    case "twelve-week-detail":
      return (
        <div className={styles.detailLayout}>
          <div className={styles.detailTitle}>
            <Kicker><TimerReset size={17} /> STEP BY STEP</Kicker>
            <h2>من هدف كبير<br /><em>لإيقاع أسبوعي.</em></h2>
          </div>
          <div className={styles.stepsGrid}>
            {[
              ["01", "اختار نتيجة واحدة", "واضحة، محددة، وممكن قياسها بنهاية الأسبوع 12."],
              ["02", "حدّد دليل النجاح", "Demo، مشروع شغال، اختبار، أو مستخدم حقيقي — مش إحساس."],
              ["03", "قسّمها لـ 12 تسليم", "كل أسبوع حركة صغيرة تقرّبك من النتيجة النهائية."],
              ["04", "احجز وقت التنفيذ", "جلسات ثابتة في التقويم قبل ما الأسبوع يتملي."],
              ["05", "راجع كل أسبوع", "إيه اتنفّذ؟ إيه اتعطّل؟ وإيه التعديل الضروري؟"],
              ["06", "أغلق الدورة", "احتفل، وثّق الدروس، ثم صمّم دورة الـ12 أسبوع التالية."],
            ].map(([n, title, text]) => <article key={n}><b>{n}</b><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      );
    case "scoreboard":
      return (
        <div className={styles.scoreLayout}>
          <div>
            <Kicker><Gauge size={17} /> WEEKLY SCOREBOARD</Kicker>
            <h2>قِس التنفيذ…<br /><em>مش النوايا.</em></h2>
            <p>لو مش شايف الرقم، مش هتعرف تصلّح المسار.</p>
          </div>
          <div className={styles.scoreCard}>
            <div className={styles.scoreHead}><span>WEEK 06 / 12</span><b>78%</b></div>
            <div className={styles.scoreProgress}><i /></div>
            <div className={styles.scoreMetrics}>
              <article><small>LEAD</small><strong>7 / 9</strong><span>تاسكات الأسبوع</span></article>
              <article><small>LAG</small><strong>01</strong><span>Demo قابل للتجربة</span></article>
              <article><small>RHYTHM</small><strong>4×</strong><span>جلسات Deep Work</span></article>
            </div>
            <div className={styles.scoreCheck}><Check /> المطلوب ≥ 85% تنفيذ أسبوعي، ثم نراجع جودة الناتج.</div>
          </div>
          <QuoteBlock>الهدف السنوي يحفّزك يومين. لوحة القياس الأسبوعية تغيّر سلوكك 12 أسبوع.</QuoteBlock>
        </div>
      );
    case "product-fit":
      return (
        <div className={styles.fitLayout}>
          <div className={styles.detailTitle}>
            <Kicker><Target size={17} /> PRODUCT–MARKET FIT / LITE</Kicker>
            <h2>ابدأ من<br /><em>ألم حقيقي.</em></h2>
            <p>مش من تقنية نفسك تجربها.</p>
          </div>
          <div className={styles.fitFunnel}>
            <article><b>WHO</b><div><h3>مستخدم محدد</h3><p>مين الشخص؟ وإمتى تظهر مشكلته؟</p></div></article>
            <article><b>PAIN</b><div><h3>مشكلة متكررة</h3><p>إيه تكلفتها: وقت، فلوس، مخاطرة؟</p></div></article>
            <article><b>PROOF</b><div><h3>دليل على الطلب</h3><p>هل جرّب حل؟ هل سيدفع أو يغيّر سلوكه؟</p></div></article>
            <article><b>VALUE</b><div><h3>وعد واحد واضح</h3><p>إيه التحسّن المحدد اللي هنصنعه؟</p></div></article>
          </div>
          <div className={styles.fitRule}><CircleDot /> لو معرفتش تقول المستخدم والمشكلة في جملة واحدة، الفكرة لسه مش ناضجة.</div>
        </div>
      );
    case "mvp":
      return (
        <div className={styles.mvpLayout}>
          <div>
            <Kicker><Rocket size={17} /> MVP ≠ MINI PRODUCT</Kicker>
            <h2>أصغر تجربة…<br /><em>بأكبر تعلّم.</em></h2>
          </div>
          <div className={styles.mvpEquation}>
            <article><span>01</span><h3>أخطر افتراض</h3><p>إيه الحاجة اللي لو طلعت غلط، الفكرة كلها تقع؟</p></article>
            <b>+</b>
            <article><span>02</span><h3>أسرع اختبار</h3><p>Landing page، prototype، concierge، أو feature واحدة.</p></article>
            <b>=</b>
            <article className={styles.mvpResult}><span>MVP</span><h3>قرار مبني على دليل</h3><p>نكمل؟ نعدّل؟ ولا نوقف قبل حرق الوقت؟</p></article>
          </div>
          <div className={styles.mvpLoop}><span>BUILD</span><ArrowRight /><span>MEASURE</span><ArrowRight /><span>LEARN</span><RotateCcw /></div>
        </div>
      );
    case "book-notes":
      return (
        <div className={styles.bookNotesLayout}>
          <div className={styles.detailTitle}>
            <Kicker><BookOpen size={17} /> REFERENCE NOTES</Kicker>
            <h2>اقرأ بهدف<br /><em>التطبيق.</em></h2>
          </div>
          <div className={styles.bookNotesGrid}>
            <article><b>01</b><h3>Atomic Habits</h3><p>غيّر البيئة قبل ما تلوم الإرادة. صغّر العادة، اربطها بإشارة ثابتة، وتابع الاستمرارية.</p><span>تطبيق: 30 دقيقة تطوير بعد أول قهوة.</span></article>
            <article><b>02</b><h3>Deep Work</h3><p>احمِ وقتاً بلا مقاطعات لمهمة معرفية صعبة. أغلق الإشعارات، حدّد نهاية، ثم قِس الناتج.</p><span>تطبيق: جلستان × 60 دقيقة أسبوعياً.</span></article>
            <article><b>03</b><h3>The 12 Week Year</h3><p>هدف قصير، خطة أسبوعية، وScoreboard. التنفيذ يُراجع كل أسبوع لا آخر السنة.</p><span>تطبيق: نسبة تنفيذ أسبوعية واضحة.</span></article>
            <article><b>04</b><h3>The Daily Stoic</h3><p>فرّق بين ما تملكه وما لا تملكه. ركّز على قرارك، استجابتك، وجودة فعلك تحت الضغط.</p><span>تطبيق: مراجعة هادئة في نهاية اليوم.</span></article>
          </div>
        </div>
      );
    case "roadmap":
      return (
        <div className={styles.roadmapLayout}>
          <div className={styles.roadmapTitle}>
            <Kicker><Rocket size={17} /> 12-WEEK ROADMAP</Kicker>
            <h2>التأسيس → البناء<br /><em>→ الدمج.</em></h2>
            <p>ضع التواريخ المعتمدة بجانب كل أسبوع قبل الإرسال.</p>
          </div>
          <div className={styles.roadmapBoard}>
            <div className={styles.roadmapWeeks}>{Array.from({ length: 12 }, (_, i) => <span key={i}>W{i + 1}</span>)}</div>
            {[
              ["SOFTWARE", "أساس", "تطبيق", "Build", "Integration"],
              ["HARDWARE", "أساس", "Prototype", "Build", "Integration"],
              ["AI", "Data", "Model", "Evaluate", "Integration"],
            ].map((row) => <div className={styles.roadmapRow} key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><span>{row[4]}</span></div>)}
            <div className={styles.roadmapMilestones}><i style={{ right: "24%" }} /><span style={{ right: "23%" }}>REVIEW</span><i style={{ right: "49%" }} /><span style={{ right: "48%" }}>DEMO</span><i style={{ right: "74%" }} /><span style={{ right: "73%" }}>CHECK</span></div>
          </div>
          <div className={styles.roadmapRule}><SquareArrowOutUpRight /> كل مرحلة تنتهي بتسليم يمكن رؤيته أو تجربته — مش عنوان «خلصنا المحتوى».</div>
        </div>
      );
    default:
      return null;
  }
}

export default function PhantomsDeck() {
  const [active, setActive] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const touchStart = useRef<number | null>(null);

  const current = slides[active];
  const liveCount = useMemo(() => slides.filter((slide) => slide.kind === "live").length, []);
  const goTo = useCallback((index: number) => {
    const next = Math.min(Math.max(index, 0), slides.length - 1);
    setActive(next);
    setOverviewOpen(false);
    window.history.replaceState(null, "", `#${slides[next].id}`);
  }, []);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const previous = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOverviewOpen(false);
        setNotesOpen(false);
        setHelpOpen(false);
        return;
      }
      if (overviewOpen || helpOpen) return;
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        previous();
      } else if (event.key === "Home") goTo(0);
      else if (event.key === "End") goTo(slides.length - 1);
      else if (event.key.toLowerCase() === "o") setOverviewOpen(true);
      else if (event.key.toLowerCase() === "n") setNotesOpen((value) => !value);
      else if (event.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, helpOpen, next, overviewOpen, previous]);

  useEffect(() => {
    if (!meetingStarted) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [meetingStarted]);

  const formattedElapsed = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <main
      className={styles.deck}
      dir="rtl"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (delta < -50) next();
        if (delta > 50) previous();
        touchStart.current = null;
      }}
    >
      <div className={styles.viewport}>
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`${styles.slideFrame} ${index === active ? styles.activeFrame : ""}`}
            aria-hidden={index !== active}
          >
            <SlideShell meta={slide}><SlideContent id={slide.id} /></SlideShell>
          </div>
        ))}
      </div>

      <nav className={styles.controls} aria-label="أدوات العرض">
        <div className={styles.controlGroup}>
          <button onClick={previous} disabled={active === 0} aria-label="السلايد السابق"><ChevronRight /></button>
          <button onClick={next} disabled={active === slides.length - 1} aria-label="السلايد التالي"><ChevronLeft /></button>
        </div>
        <button className={styles.slideCounter} onClick={() => setOverviewOpen(true)} aria-label="فتح نظرة عامة على الشرائح">
          <Grid2X2 /><b>{String(active + 1).padStart(2, "0")}</b><span>/ {slides.length}</span>
        </button>
        <div className={styles.progressTrack} aria-label={`التقدم ${Math.round(((active + 1) / slides.length) * 100)}%`}>
          <i style={{ width: `${((active + 1) / slides.length) * 100}%` }} />
        </div>
        <button className={`${styles.timerButton} ${meetingStarted ? styles.timerLive : ""}`} onClick={() => setMeetingStarted((value) => !value)} aria-label={meetingStarted ? "إيقاف مؤقت للمؤقت" : "بدء مؤقت الاجتماع"}>
          {meetingStarted ? <Pause /> : <Play />}<span>{meetingStarted ? formattedElapsed : "ابدأ الوقت"}</span>
        </button>
        <div className={styles.controlGroup}>
          <button onClick={() => setNotesOpen((value) => !value)} className={notesOpen ? styles.activeControl : ""} aria-label="ملاحظات المتحدث"><Mic2 /></button>
          <button onClick={() => window.print()} aria-label="طباعة العرض"><Printer /></button>
          <button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="ملء الشاشة"><Expand /></button>
          <button onClick={() => setHelpOpen(true)} aria-label="اختصارات العرض"><Command /></button>
        </div>
      </nav>

      {notesOpen ? (
        <aside className={styles.speakerNotes}>
          <div><Mic2 /><span>ملاحظة المتحدث</span><button onClick={() => setNotesOpen(false)} aria-label="إغلاق"><X /></button></div>
          <p>{current.note}</p>
        </aside>
      ) : null}

      {overviewOpen ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="كل الشرائح">
          <div className={styles.overviewPanel}>
            <header><div><Grid2X2 /><span>كل الشرائح</span><small>{liveCount} عرض حي · {slides.length - liveCount} ملحق</small></div><button onClick={() => setOverviewOpen(false)} aria-label="إغلاق"><X /></button></header>
            <div className={styles.overviewGrid}>
              {slides.map((slide, index) => (
                <button key={slide.id} onClick={() => goTo(index)} className={index === active ? styles.activeThumb : ""} style={{ "--thumb-accent": accentMap[slide.accent] } as React.CSSProperties}>
                  <span>{slide.indexLabel}</span>
                  <small>{slide.section}</small>
                  <strong>{slide.shortTitle}</strong>
                  <i>{slide.time}</i>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="اختصارات لوحة المفاتيح">
          <div className={styles.helpPanel}>
            <header><div><Command /><span>اختصارات العرض</span></div><button onClick={() => setHelpOpen(false)} aria-label="إغلاق"><X /></button></header>
            <div className={styles.shortcutGrid}>
              <div><kbd>→</kbd><kbd>Space</kbd><span>التالي</span></div>
              <div><kbd>←</kbd><span>السابق</span></div>
              <div><kbd>O</kbd><span>كل الشرائح</span></div>
              <div><kbd>N</kbd><span>ملاحظات المتحدث</span></div>
              <div><kbd>F</kbd><span>ملء الشاشة</span></div>
              <div><kbd>Esc</kbd><span>إغلاق النافذة</span></div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
