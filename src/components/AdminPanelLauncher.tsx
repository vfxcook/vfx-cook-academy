"use client";

export function AdminPanelLauncher({
  targetId,
  label,
  variant = "secondary",
}: {
  targetId: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  function openPanel() {
    const element = document.getElementById(targetId);
    if (!element) return;
    if (element instanceof HTMLDetailsElement) {
      element.open = true;
    }
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`} type="button" onClick={openPanel}>
      {label}
    </button>
  );
}
