export type CourseLike = {
  slug: string;
} | null;

export { coursePriceInr } from "./course-offer";

export const landingBrand = {
  name: "VFX COOK",
  subline: "ACADEMY",
  logoSrc: "/Logo_Small_Website.png",
};

export const landingBackgrounds = [
  { src: "/BG_Images/1.jpeg", label: "Cinematic studio background 1" },
  { src: "/BG_Images/2.jpeg", label: "Cinematic studio background 2" },
  { src: "/BG_Images/3.jpeg", label: "Cinematic studio background 3" },
  { src: "/BG_Images/4.jpeg", label: "Cinematic studio background 4" },
  { src: "/BG_Images/5.jpeg", label: "Cinematic studio background 5" },
  { src: "/BG_Images/6.jpeg", label: "Cinematic studio background 6" },
  { src: "/BG_Images/8.jpeg", label: "Cinematic studio background 8" },
  { src: "/BG_Images/9.jpeg", label: "Cinematic studio background 9" },
  { src: "/BG_Images/10.jpeg", label: "Cinematic studio background 10" },
  { src: "/BG_Images/11.jpeg", label: "Cinematic studio background 11" },
  { src: "/BG_Images/12.jpeg", label: "Cinematic studio background 12" },
  { src: "/BG_Images/13.jpeg", label: "Cinematic studio background 13" },
  { src: "/BG_Images/14.jpeg", label: "Cinematic studio background 14" },
  {
    src: "/BG_Images/WhatsApp%20Image%202026-07-07%20at%207.26.41%20PM.jpeg",
    label: "Cinematic studio background 15",
  },
];

export const galleryImages = landingBackgrounds;

export const heroCopy = {
  badge: "Malayalam Batch",
  eyebrow: "Showreel",
  titlePrefix: "Master",
  titlePrimary: "Cinematic AI",
  titleSuffix: "Video Creation in Malayalam",
  description:
    "Learn how to create professional-grade AI videos, cinematic shots, ads, reels, short films, and visual stories using today's most powerful AI tools, guided by the team behind VFX Cook.",
  primaryCta: "Join Now!",
  secondaryCta: "See Pricing",
  proof: "36M+ views generated through our AI video content and cinematic experiments.",
};

export const valueProps = [
  {
    icon: "FM",
    title: "Made by Filmmakers",
    text: "Learn from creators who live and breathe cinema.",
  },
  {
    icon: "PQ",
    title: "Production-Quality Training",
    text: "Move beyond prompts. Create content that looks truly cinematic.",
  },
  {
    icon: "CS",
    title: "Community & Support",
    text: "Join a growing community of creators, share, get feedback, and grow.",
  },
];

export const insightCards = [
  {
    title: "Why Learn from VFX Cook?",
    lines: [
      "VFX Cook has built a strong community around cinematic AI content.",
      "36M+ views across our cinematic AI content experiments.",
      "Production-quality thinking from VFX and animation background.",
      "Malayalam-first teaching for deeper understanding.",
    ],
  },
  {
    title: "Why AI Video Creation - Why Now?",
    lines: [
      "AI video creation is already happening.",
      "Creators, brands, agencies, and production teams now need people who can produce cinematic AI videos with quality and consistency.",
    ],
  },
  {
    title: "AI Tools Are Easy. Cinematic Output Is Not.",
    lines: [
      "Tools can generate.",
      "But only a filmmaker can guide.",
      "We teach the difference.",
    ],
  },
];

export const learningItems = [
  { icon: "PR", text: "Write cinematic image prompts" },
  { icon: "IV", text: "Convert images into high-quality AI videos" },
  { icon: "AD", text: "Create ad films, reels, and cinematic scenes" },
  { icon: "CC", text: "Maintain character consistency" },
  { icon: "CM", text: "Control camera movement and motion rhythm" },
  { icon: "LA", text: "Create premium lighting and atmosphere" },
  { icon: "QC", text: "Avoid fake AI-looking outputs" },
  { icon: "DR", text: "Build scenes like a director" },
  { icon: "SD", text: "Add sound, dialogue, and cinematic polish" },
  { icon: "WF", text: "End-to-end workflow from idea to final cut" },
];

export function getEnrollHref(_course: CourseLike) {
  return "/courses";
}
