import Link from "next/link";
import { SidebarBrandLogo } from "@/components/sidebar-brand-logo";

export default function NotFound() {
  return (
    <main className="branded-not-found">
      <div className="branded-not-found-card">
        <Link href="/" className="landing-brand branded-not-found-brand">
          <SidebarBrandLogo className="landing-brand-mark" title="Zord SprintView" />
          <span className="landing-brand-copy">
            <strong>Zord SprintView</strong>
            <small>Sprint intelligence workspace</small>
          </span>
        </Link>

        <div className="branded-not-found-copy">
          <p className="eyebrow">Page Not Found</p>
          <h1>That page does not exist.</h1>
          <p className="page-description">
            The link may be invalid, the page may have moved, or this route is no longer available.
          </p>
        </div>

        <div className="page-actions">
          <Link href="/" className="button">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
