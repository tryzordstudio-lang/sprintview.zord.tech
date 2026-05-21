import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const NAV_ITEMS = [
  { href: "#platform", label: "Platform" },
  { href: "#features", label: "Features" },
  { href: "#sharing", label: "Sharing" }
];

export function MarketingNavbar() {
  return (
    <header className="marketing-navbar-shell">
      <nav className="marketing-navbar" aria-label="Primary">
        <Link href="/" className="landing-brand" aria-label="Zord SprintView home">
          <BrandLogo className="landing-brand-mark" />
          <span className="landing-brand-copy">
            <strong>Zord SprintView</strong>
            <small>Sprint intelligence platform</small>
          </span>
        </Link>

        <div className="marketing-navbar-links">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="marketing-navbar-link">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="marketing-navbar-actions">
          <Link href="/signin" className="landing-nav-link">
            Sign in
          </Link>
          <Link href="/signup" className="button">
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
