export type FAQItem = {
  id: number;
  question: string;
  answer: string;
  category: string;
};

export const faqCategories = [
  "All Questions",
  "Getting Started",
  "Tracking",
  "ClickUp Integration",
  "Security & Privacy",
  "Billing",
];

export const faqItems: FAQItem[] = [
  {
    id: 1,
    question: "What is TrackUp?",
    answer:
      "TrackUp is a video tracking and analytics platform that helps teams understand how their videos are watched. You can see who watched, when, how much, and which parts they viewed — all connected with ClickUp.",
    category: "Getting Started",
  },
  {
    id: 2,
    question: "How does video tracking work?",
    answer:
      "TrackUp records video engagement data so you can understand viewing behavior, completion rates, watch time, and which parts of a video receive the most attention.",
    category: "Tracking",
  },
  {
    id: 3,
    question: "Which video sources are supported?",
    answer:
      "You can share videos from supported platforms such as YouTube, Google Drive, Telegram, or upload your own video files.",
    category: "Tracking",
  },
  {
    id: 4,
    question: "How does ClickUp integration work?",
    answer:
      "Connect your ClickUp workspace and link videos to tasks. Track learning progress and engagement directly alongside your team's workflow.",
    category: "ClickUp Integration",
  },
  {
    id: 5,
    question: "Do I need to upload videos to TrackUp?",
    answer:
      "Not necessarily. TrackUp can work with supported external video sources, allowing your team to share and track videos without maintaining duplicate copies.",
    category: "Getting Started",
  },
  {
    id: 6,
    question: "How accurate is the tracking data?",
    answer:
      "TrackUp is designed to provide detailed engagement information, including watch time, viewing frequency, completion, and the specific parts of a video that were watched.",
    category: "Tracking",
  },
  {
    id: 7,
    question: "Can I track videos shared outside my team?",
    answer:
      "Tracking depends on how the video is shared and the permissions configured for your workspace.",
    category: "Tracking",
  },
  {
    id: 8,
    question: "What kind of analytics will I get?",
    answer:
      "You can analyze watch time, completion rates, viewer activity, engagement patterns, and other video performance metrics.",
    category: "Tracking",
  },
  {
    id: 9,
    question: "Is my data secure?",
    answer:
      "Your workspace data is protected and remains under your control. TrackUp is designed around secure authentication and controlled access.",
    category: "Security & Privacy",
  },
  {
    id: 10,
    question: "What happens if someone watches a video multiple times?",
    answer:
      "Repeated viewing is tracked as engagement activity, allowing you to understand how frequently viewers return to specific content.",
    category: "Tracking",
  },
  {
    id: 11,
    question: "Can I use TrackUp on mobile devices?",
    answer:
      "TrackUp is designed to provide a responsive experience across desktop and mobile devices.",
    category: "Getting Started",
  },
  {
    id: 12,
    question: "How is pricing determined?",
    answer:
      "Pricing depends on the plan and the features available for your workspace. Check the latest pricing information before subscribing.",
    category: "Billing",
  },
  {
    id: 13,
    question: "Can I cancel my plan anytime?",
    answer:
      "Yes. You can manage your subscription and cancellation from your account settings.",
    category: "Billing",
  },
];