import Link from "next/link";
import { MarketingNavbar } from "@/components/marketing-navbar";

export default function HomePage() {
  return (
    <div className="landing-page">
      <MarketingNavbar />

      <main className="landing-main">
        <section id="platform" className="landing-hero">
          <div className="landing-hero-copy">
            <p className="eyebrow">AI Sprint Intelligence</p>
            <h1>See sprint health, delivery risk, and executive-ready reporting in one place.</h1>
            <p className="landing-description">
              Zord SprintView turns Jira delivery signals into clear operational visibility for engineering teams and
              stakeholders without becoming another project management tool.
            </p>

            <div className="landing-actions">
              <Link href="/signup" className="button">
                Start free
              </Link>
              <Link href="/signin" className="button-secondary">
                Sign in
              </Link>
            </div>
          </div>

          <div className="landing-preview">
            <div className="landing-preview-card">
              <div className="landing-preview-head">
                <span>Current Sprint</span>
                <strong>Health 82</strong>
              </div>
              <div className="landing-metric-grid">
                <article>
                  <span>Completion</span>
                  <strong>74%</strong>
                </article>
                <article>
                  <span>Blockers</span>
                  <strong>4</strong>
                </article>
                <article>
                  <span>Pending</span>
                  <strong>11</strong>
                </article>
              </div>
              <div className="landing-insight-strip">
                <strong>AI Insight</strong>
                <p>Backend validation is the only material delivery risk across the current sprint.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section-stack">
          <div className="landing-section-heading">
            <p className="eyebrow">Core Workflow</p>
            <h2>From sprint import to stakeholder-ready reporting without the manual churn.</h2>
          </div>

          <div className="landing-feature-grid">
            <article className="landing-feature">
              <strong>Import from Jira</strong>
              <p>Connect boards, select a sprint, and pull delivery data into a clean reporting workflow.</p>
            </article>
            <article className="landing-feature">
              <strong>AI-generated insights</strong>
              <p>Highlight blockers, workload imbalance, and confidence gaps without manual analysis.</p>
            </article>
            <article className="landing-feature">
              <strong>Stakeholder-ready reports</strong>
              <p>Generate public links and PDF summaries that are structured for leadership review.</p>
            </article>
          </div>
        </section>

        <section id="sharing" className="landing-section-stack">
          <div className="landing-section-heading">
            <p className="eyebrow">Enterprise Sharing</p>
            <h2>Built to present, export, and share sprint narratives with clients and leadership.</h2>
          </div>

          <div className="landing-proof-grid">
            <article className="landing-proof-card">
              <span>Public and private distribution</span>
              <strong>Share executive dashboards with the right audience controls.</strong>
              <p>Publish reports for stakeholders, keep internal workspaces private, and present progress in fullscreen.</p>
            </article>
            <article className="landing-proof-card">
              <span>Reusable report layouts</span>
              <strong>Standardize delivery updates across teams with templates and saved widget layouts.</strong>
              <p>Move faster with consistent executive summaries, engineering deep dives, and client-facing formats.</p>
            </article>
            <article className="landing-proof-card">
              <span>Presentation-first output</span>
              <strong>Turn sprint metrics into a narrative that leadership can read in minutes.</strong>
              <p>Use clean layouts, branded exports, and AI context instead of spreadsheets and scattered screenshots.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
