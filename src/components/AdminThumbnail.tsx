"use client";

import { useState } from "react";

export function AdminThumbnail({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  const [hasError, setHasError] = useState(false);
  const hasImage = Boolean(src) && !hasError;

  return (
    <div className="admin-course-thumb">
      {hasImage ? (
        <img
          src={src ?? ""}
          alt={alt}
          onError={() => setHasError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
        />
      ) : (
        <div className="admin-course-thumb-fallback">
          <span>Course Thumbnail</span>
        </div>
      )}
    </div>
  );
}
