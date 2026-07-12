"use client";

import { useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { formatInr } from "@/lib/utils";

type GiftCoupon = {
  id: string;
  code: string;
  courseId: string;
  amountInr: number;
  course: {
    slug: string;
    title: string;
    description: string;
  };
  purchaser: {
    name: string | null;
    email: string | null;
  };
};

export function GiftSuccessClient({ coupon }: { coupon: GiftCoupon }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy", e);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [800, 500]
    });

    // Background gradient (simulated using rects)
    doc.setFillColor(7, 12, 24);
    doc.rect(0, 0, 800, 500, "F");

    // Inner border
    doc.setDrawColor(79, 125, 255);
    doc.setLineWidth(2);
    doc.rect(20, 20, 760, 460);

    // Header
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("VFX COOK ACADEMY", 400, 70, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(153, 161, 179);
    doc.text("CERTIFICATE OF GIFT", 400, 95, { align: "center" });

    // Gift Info
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    const courseTitleLines = doc.splitTextToSize(coupon.course.title, 600);
    doc.text(courseTitleLines, 400, 160, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(153, 161, 179);
    doc.text(`Gifted by: ${coupon.purchaser.name || coupon.purchaser.email || "Someone Special"}`, 400, 220, { align: "center" });

    // Code Box
    doc.setFillColor(31, 41, 55);
    doc.rect(250, 260, 300, 60, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`Code: ${coupon.code}`, 400, 298, { align: "center" });

    // Instructions
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(153, 161, 179);
    doc.text("How to redeem:", 400, 370, { align: "center" });
    const appUrl = window.location.origin;
    doc.text(`1. Go to ${appUrl}/checkout/${coupon.course.slug}`, 400, 390, { align: "center" });
    doc.text("2. Enter the code in the 'Have a gift coupon?' section", 400, 410, { align: "center" });
    doc.text("3. Enjoy your lifetime access!", 400, 430, { align: "center" });

    doc.save(`Gift-Certificate-${coupon.code}.pdf`);
  };

  return (
    <div className="checkout-shell" style={{ maxWidth: "600px", margin: "0 auto", padding: "2rem 1rem" }}>
      <section className="card checkout-hero" style={{ textAlign: "center" }}>
        <p className="admin-eyebrow">Payment Successful</p>
        <h1 style={{ color: "#4f7dff" }}>Course Gifted Successfully!</h1>
        <p className="muted">
          Your gift coupon has been generated. You can now share this code with the recipient.
        </p>
      </section>

      <section className="card checkout-card" style={{ textAlign: "center" }}>
        <div style={{ marginBottom: "2rem" }}>
          <span className="muted">Course</span>
          <h2>{coupon.course.title}</h2>
          <p className="muted">{formatInr(coupon.amountInr)} paid</p>
        </div>

        <div style={{ background: "rgba(79, 125, 255, 0.1)", padding: "1.5rem", borderRadius: "12px", border: "1px dashed #4f7dff", marginBottom: "2rem" }}>
          <span className="muted" style={{ display: "block", marginBottom: "0.5rem" }}>Gift Code</span>
          <strong style={{ fontSize: "1.8rem", letterSpacing: "2px", userSelect: "all" }}>{coupon.code}</strong>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={copyToClipboard}>
            {copied ? "Copied!" : "Copy Code"}
          </button>
          <button className="btn btn-primary" onClick={downloadPDF}>
            Download Premium PDF
          </button>
        </div>

        <div style={{ marginTop: "2rem", borderTop: "1px solid #2f436a", paddingTop: "1.5rem" }}>
          <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
            The recipient can redeem this code at:<br />
            <a href={`/checkout/${coupon.course.slug}`} style={{ color: "#4f7dff", wordBreak: "break-all" }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/checkout/${coupon.course.slug}` : ''}
            </a>
          </p>
          <Link href="/dashboard" className="btn btn-secondary">
            Go to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
