import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Page not found</h1>
      <p className="muted">The requested resource does not exist.</p>
      <Link className="btn btn-primary" href="/">
        Back to home
      </Link>
    </div>
  );
}
