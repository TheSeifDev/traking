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
      "TrackUp is a ClickUp-connected video access and analytics application. It provides scoped viewer links, persisted viewer sessions, and workspace, video, viewer, and session views based on the evidence stored by the current provider integration.",
    category: "Getting Started",
  },
  {
    id: 2,
    question: "How does video tracking work?",
    answer:
      "TrackUp records server-created viewer sessions and provider playback events. Playhead position, duration, watch time, completion, and watched ranges appear only when the provider exposes reliable telemetry and the corresponding events are persisted; otherwise the UI marks the metric unavailable.",
    category: "Tracking",
  },
  {
    id: 3,
    question: "Which video sources are supported?",
    answer:
      "The current provider registry supports YouTube, Vimeo, browser-playable direct media URLs, Google Drive, and Telegram. Google Drive and Telegram are session-only in the current implementation, and TrackUp does not claim upload support.",
    category: "Tracking",
  },
  {
    id: 4,
    question: "How does ClickUp integration work?",
    answer:
      "ClickUp OAuth connects the authorized workspace identity to TrackUp. The current app supports workspace discovery and authorized task operations; video access and provider-aware playback evidence remain inside TrackUp’s scoped surfaces.",
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
      "Accuracy is evidence-dependent. TrackUp reports persisted sessions and events, while watch time, completion, position, and ranges are shown only for provider sessions with sufficient reliable telemetry. It does not infer playback from a page open or session record alone.",
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
      "You can review persisted workspace, video, viewer, and session activity, including event timelines and measured watch/completion fields where the provider contract and stored telemetry qualify them. Unsupported values remain explicitly unavailable.",
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
      "Each authorized viewing visit can produce its own persisted session. Session counts and lifecycle activity can be reviewed, while detailed playback metrics for each visit still depend on the provider’s available telemetry.",
    category: "Tracking",
  },
  {
    id: 11,
    question: "Can I use TrackUp on mobile devices?",
    answer:
      "The TrackUp application uses responsive layouts across desktop and mobile-sized screens. Actual embedded-provider playback and telemetry can still vary by provider, browser, device, and provider environment.",
    category: "Getting Started",
  },
  {
    id: 12,
    question: "How is pricing determined?",
    answer:
      "The current repository does not expose a public pricing page or subscription workflow. Contact the project maintainers for deployment-specific commercial terms before using TrackUp in a paid arrangement.",
    category: "Billing",
  },
  {
    id: 13,
    question: "Can I cancel my plan anytime?",
    answer:
      "Subscription management and cancellation are not implemented in the current TrackUp application. Use the project support path for deployment-specific account or commercial questions.",
    category: "Billing",
  },
];