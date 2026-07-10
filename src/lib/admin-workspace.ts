export const adminWorkspaceNav = [
  { label: "Overview", href: "/admin" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Students CRM", href: "/admin/students" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Lessons", href: "/admin/lessons" },
  { label: "Prompts", href: "/admin/prompts" },
  { label: "Community", href: "/admin/community" },
];

export const adminCourseEditorTabs = [
  { label: "Basics", hint: "Title, slug, pricing, thumbnail, publish status" },
  { label: "Curriculum", hint: "Lesson order, source, duration, replacement uploads" },
  { label: "Resources", hint: "PDFs, files, links, and per-lesson downloads" },
  { label: "Access", hint: "Batch date, enrolled members, active or locked state" },
  { label: "Preview", hint: "Check the student-facing course before publishing" },
];

export const adminCrmColumns = [
  "Student",
  "Contact",
  "Courses",
  "Payment",
  "Progress",
  "Last Activity",
  "Actions",
];
