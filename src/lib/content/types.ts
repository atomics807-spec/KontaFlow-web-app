export type CardCopy = { title: string; body: string };

export type FaqItem = { question: string; answer: string };

export type StepCopy = { title: string; body: string; detail: string };

export type HomeCopy = {
  metaTitle: string;
  metaDescription: string;
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    subtitle: string;
    primary: string;
    secondary: string;
    note: string;
    imageAlt: string;
    overlayTitle: string;
    overlayBody: string;
    channels: string[];
    trust: { value: string; label: string }[];
  };
  position: {
    eyebrow: string;
    title: string;
    body: string;
    note: string;
    stack: string[];
    points: CardCopy[];
  };
  problem: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cards: CardCopy[];
    imageAlt: string;
    imageCaption: string;
  };
  solution: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cards: CardCopy[];
    ledgerNote: string;
  };
  ai: {
    eyebrow: string;
    title: string;
    subtitle: string;
    prompt: string;
    reply: string;
    bullets: string[];
    imageAlt: string;
    note: string;
    confirm: string;
    edit: string;
  };
  dashboard: {
    eyebrow: string;
    title: string;
    subtitle: string;
    bullets: string[];
    note: string;
    weekdays: string[];
    sampleRows: { label: string; channel: string }[];
  };
  incomeExpense: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cards: CardCopy[];
    imageAlt: string;
    caption: string;
  };
  analysis: {
    eyebrow: string;
    title: string;
    subtitle: string;
    note: string;
    cards: CardCopy[];
    chart: {
      kicker: string;
      title: string;
      sample: string;
      period: string;
      categories: { label: string; pct: number }[];
      note: string;
    };
  };
  offline: {
    eyebrow: string;
    title: string;
    subtitle: string;
    bullets: string[];
    queued: string;
    synced: string;
    imageAlt: string;
  };
  whatsapp: {
    eyebrow: string;
    title: string;
    subtitle: string;
    chat: { from: "them" | "us"; text: string }[];
    bullets: string[];
    note: string;
    imageAlt: string;
    businessLabel: string;
    messagePlaceholder: string;
  };
  ussd: {
    eyebrow: string;
    title: string;
    subtitle: string;
    screenTitle: string;
    screenLines: string[];
    screenFooter: string;
    bullets: string[];
    note: string;
    imageAlt: string;
  };
  reports: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: string[];
    body: string;
    imageAlt: string;
    packTitle: string;
    packLine: string;
  };
  intelligence: {
    eyebrow: string;
    title: string;
    subtitle: string;
    insights: { label: string; value: string; note: string }[];
    bullets: string[];
    note: string;
  };
  subscription: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tiers: { name: string; price: string; period: string; description: string; features: string[]; cta: string; featured?: boolean }[];
    footnote: string;
    includedTitle: string;
    included: string[];
  };
  faq: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: FaqItem[];
    viewAll: string;
  };
  finalCta: { title: string; subtitle: string; primary: string; secondary: string };
};

export type PageSection = {
  title: string;
  body?: string;
  cards?: CardCopy[];
};

export type SimplePageCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  accent?: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  imageCaption: string;
  introTitle: string;
  introBody: string;
  sections: PageSection[];
  cta: { title: string; body: string; primary: string; secondary: string };
};

export type HowPageCopy = SimplePageCopy & {
  steps: StepCopy[];
  matrixTitle: string;
  matrixSubtitle: string;
  matrix: { channel: string; data: string; smartphone: string; offline: string }[];
};

export type FaqPageCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  groups: { title: string; items: FaqItem[] }[];
  cta: { title: string; body: string; primary: string; secondary: string };
};

export type ArticleSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  readingMinutes: number;
  image: string;
  imageAlt: string;
  intro: string;
  sections: ArticleSection[];
  takeaway: string;
};

export type BlogCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  imageAlt: string;
  imageCaption: string;
  featuredImage: string;
  featuredImageAlt: string;
  featuredLabel: string;
  readArticle: string;
  allArticles: string;
  minRead: string;
  articles: Article[];
};

export type LegalDoc = {
  slug: string;
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};

export type ContactCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  nextTitle: string;
  nextSteps: string[];
  email: string;
  privacyEmail: string;
  location: string;
  hours: string;
};

export type PhotoCredit = {
  file: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  note: string;
};

export type SiteContent = {
  home: HomeCopy;
  about: SimplePageCopy;
  features: SimplePageCopy;
  services: SimplePageCopy;
  how: HowPageCopy;
  faq: FaqPageCopy;
  blog: BlogCopy;
  contact: ContactCopy;
  legal: LegalDoc[];
  photoCredits: { title: string; intro: string; items: PhotoCredit[] };
  common: {
    breadcrumb: string;
    readMore: string;
    backToResources: string;
    related: string;
    legalStatus: string;
    legalNav: string;
    talkToUs: string;
    startTrial: string;
    illustrative: string;
    illustrativePhoto: string;
    illustrativePhotoAlt: string;
    home: string;
    resources: string;
    takeaway: string;
    editorial: string;
    source: string;
  };
};
