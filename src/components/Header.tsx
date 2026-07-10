import Link from "next/link";

import { auth } from "@/lib/auth";
import { landingBrand } from "@/lib/landing";
import { NotificationBell } from "@/components/NotificationBell";

export async function Header() {
  const session = await auth();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" href="/">
          <img className="brand-logo" src={landingBrand.logoSrc} alt="" />
          <span className="brand-copy">
            <span>{landingBrand.name}</span>
            <span>{landingBrand.subline}</span>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/courses">Courses</Link>
          <Link href="/#about">About</Link>
          {session?.user ? <Link href="/course/ai-vfx-video-creation">Community</Link> : null}
        </nav>
        <div className="header-actions">
          {session?.user ? (
            <>
              <NotificationBell />
              <Link className="header-login" href="/dashboard">
                Dashboard
              </Link>
              <Link className="header-login" href="/profile">
                Profile
              </Link>
              {session.user.role === "ADMIN" ? (
                <Link className="header-login" href="/admin">
                  Admin
                </Link>
              ) : null}
            </>
          ) : (
            <Link className="header-login" href="/login">
              Login
            </Link>
          )}
          <Link className="btn btn-primary header-join" href="/courses">
            Join Now!
          </Link>
        </div>
      </div>
    </header>
  );
}
