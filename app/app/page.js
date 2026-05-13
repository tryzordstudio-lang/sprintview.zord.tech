"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusPill, Surface } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { deriveDashboardMetrics, formatDate } from "@/lib/view-models";

function sprintStatusTone(status) {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  if (status === "imported") return "draft";
  return "processing";
}

function sprintStatusLabel(status) {
  if (status === "imported") return "awaiting ai";
  if (status === "processing") return "analysing";
  return status || "processing";
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState({
    loading: true,
    error: "",
    latestSprint: null,
    recentSprints: [],
    latestStories: [],
    latestInsights: [],
    reports: []
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [sprintData, reportData] = await Promise.all([
          apiGet("/sprints?limit=6&sortBy=createdAt&sortOrder=desc"),
          apiGet("/report?limit=6&sortBy=updatedAt&sortOrder=desc")
        ]);

        const recentSprints = sprintData?.items || [];
        const latestSprintId = recentSprints[0]?.sprint?._id;
        const latestSprintDetail = latestSprintId ? await apiGet(`/sprints/${latestSprintId}`) : null;

        if (!active) return;

        setState({
          loading: false,
          error: "",
          latestSprint: latestSprintDetail?.sprint || null,
          recentSprints,
          latestStories: latestSprintDetail?.stories || [],
          latestInsights: latestSprintDetail?.insights || [],
          reports: reportData?.items || []
        });
      } catch (error) {
        if (!active) return;

        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Unable to load dashboard data."
        }));
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const latestSprint = state.latestSprint;
  const latestSprintEntry = state.recentSprints.find((entry) => entry?.sprint?._id === latestSprint?._id) || null;
  const latestReportEntry = state.reports.find((row) => row?.sprint?._id === latestSprint?._id) || null;
  const latestPublishedReport = state.reports.find((row) => row?.report?.status === "published" && row?.report?.shareToken) || null;
  const showJourney = searchParams.get("welcome") === "1" || !latestSprint;
  const dashboardMetrics = deriveDashboardMetrics(latestSprint);
  const blockedStories = Number(latestSprint?.metrics?.blocked || 0);
  const currentCompletion = Number(latestSprint?.metrics?.completionRate || 0);
  const activeStories = Number(latestSprint?.metrics?.totalStories || state.latestStories.length || 0);
  const insightCount = state.latestInsights.length;
  const publicShareHref = latestPublishedReport?.report?.shareToken ? `/report/${latestPublishedReport.report.shareToken}` : "";
  const journeySteps = [
    {
      step: "Step 1",
      title: "Connect Jira or start with CSV",
      copy: "Begin from the main screen by connecting Jira or creating a sprint manually with CSV or Excel upload.",
      actionLabel: "Connect Jira",
      href: "/integrations"
    },
    {
      step: "Step 2",
      title: "Add the active sprint",
      copy: "Create the sprint record, upload ticket data, and keep the active sprint visible on the landing screen.",
      actionLabel: "Create Sprint",
      href: "/sprints/new"
    },
    {
      step: "Step 3",
      title: "Select sprint and generate report",
      copy: "Choose the sprint from the registry and trigger report generation only when the team is ready.",
      actionLabel: "Open Sprints",
      href: "/sprints"
    },
    {
      step: "Step 4",
      title: "Review the generated report",
      copy: "Open the generated report screen to review sprint score, sprint health, ticket progress, AI insights, and benchmarking from recent sprints.",
      actionLabel: latestReportEntry?.report?._id ? "Open Report" : "Open Reports",
      href: latestReportEntry?.report?._id ? `/reports/${latestReportEntry.report._id}` : "/reports"
    },
    {
      step: "Step 5",
      title: "Generate a shareable link",
      copy: "Publish the report and share the stakeholder-facing report link as the final step in the sprint journey.",
      actionLabel: publicShareHref ? "Open Share Link" : "Open Reports",
      href: publicShareHref || "/reports"
    }
  ];
  const headerStats = latestSprint
    ? [
        {
          label: "Active Sprint",
          value: latestSprint.name || "Current sprint",
          detail: latestSprint.goal || "No sprint goal recorded"
        },
        {
          label: "Completion",
          value: `${currentCompletion}%`,
          detail: `${latestSprint.metrics?.completed || 0} stories completed`
        },
        {
          label: "Blocked",
          value: String(blockedStories),
          detail: blockedStories ? "Needs follow-up before closeout" : "No active blockers detected"
        },
        {
          label: "Shareable Reports",
          value: latestPublishedReport ? "1+" : "0",
          detail: latestPublishedReport ? "Public stakeholder view available" : "No public report active yet"
        }
      ]
    : [];

  return (
    <AppShell>
      <section className="dashboard-hero-shell">
        <div className="dashboard-hero-main">
          <p className="eyebrow">Sprint Reporting Journey</p>
          <h1>Connect Jira, add a sprint, generate the report, and share it.</h1>
          <p className="dashboard-hero-description">
            {latestSprint
              ? `${latestSprint.name}${latestSprint.goal ? ` • ${latestSprint.goal}` : ""}`
              : "Start from the landing screen with Jira connection or CSV upload, then move sprint by sprint into AI reporting and stakeholder sharing."}
          </p>
          <div className="page-actions">
            <Link href="/integrations" className="button">
              Connect Jira
            </Link>
            <Link href="/sprints/new" className="button-secondary">
              Upload CSV / Create Sprint
            </Link>
            {latestSprint ? (
              <Link href={`/sprints/${latestSprint._id}`} className="button-secondary">
                Open Active Sprint
              </Link>
            ) : null}
          </div>
        </div>

        <div className="dashboard-hero-panel">
          {headerStats.length ? (
            <div className="dashboard-hero-stat-grid">
              {headerStats.map((item) => (
                <article key={item.label} className="dashboard-hero-stat-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-hero-empty">
              <strong>No active sprint yet</strong>
              <p>Use Jira connect or CSV upload first, then bring one active sprint into the reporting flow.</p>
            </div>
          )}
        </div>
      </section>

      {state.error ? <div className="auth-alert">{state.error}</div> : null}

      {latestSprint ? (
        <Surface
          title="Active Sprint"
          subtitle="This is the main landing summary for the sprint currently driving report generation and sharing."
        >
          <div className="surface-grid two-up">
            <div className="report-summary-stack">
              <div className="simple-dashboard-highlight">
                <strong>{latestSprint.name || "Current sprint"}</strong>
                <p>{latestSprint.aiSummary || latestSprint.goal || "No sprint summary is available yet."}</p>
                <div className="table-badge-row">
                  <StatusPill tone={sprintStatusTone(latestSprint.status)}>{sprintStatusLabel(latestSprint.status)}</StatusPill>
                  <StatusPill tone={latestSprint.deliveryRisk || "default"}>
                    {latestSprint.deliveryRisk ? `${latestSprint.deliveryRisk} risk` : "risk pending"}
                  </StatusPill>
                  {latestReportEntry?.report?.status ? (
                    <StatusPill tone={latestReportEntry.report.status}>{latestReportEntry.report.status}</StatusPill>
                  ) : (
                    <StatusPill tone="draft">report not started</StatusPill>
                  )}
                </div>
              </div>

              <div className="page-actions">
                <Link href={`/sprints/${latestSprint._id}`} className="button-secondary">
                  Open Sprint
                </Link>
                <Link
                  href={latestReportEntry?.report?._id ? `/reports/${latestReportEntry.report._id}` : "/reports"}
                  className="button"
                >
                  {latestReportEntry?.report?._id ? "Open Generated Report" : "Select Sprint / Generate Report"}
                </Link>
                {publicShareHref ? (
                  <Link href={publicShareHref} className="button-secondary">
                    Open Share Link
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="report-summary-card-grid">
              <article className="report-summary-card">
                <span>Project</span>
                <strong>{latestSprintEntry?.project?.name || "Unassigned project"}</strong>
                <p>{latestSprintEntry?.project?.projectKey || "Project key not set"}</p>
              </article>
              <article className="report-summary-card">
                <span>Sprint Window</span>
                <strong>
                  {latestSprint.dateRange?.start ? formatDate(latestSprint.dateRange.start) : "Start TBD"}
                </strong>
                <p>{latestSprint.dateRange?.end ? `Ends ${formatDate(latestSprint.dateRange.end)}` : "End date not set"}</p>
              </article>
              <article className="report-summary-card">
                <span>Work Summary</span>
                <strong>{activeStories} tickets tracked</strong>
                <p>{insightCount} AI insights saved for this sprint</p>
              </article>
            </div>
          </div>
        </Surface>
      ) : null}

      <section className="surface-grid metrics">
        {dashboardMetrics.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      {showJourney ? (
        <Surface
          title="Journey Flow"
          subtitle="This is the intended user path from login to shareable sprint reporting."
        >
          <div className="dashboard-onboarding-grid">
            {journeySteps.map((item) => (
              <article key={item.step} className="onboarding-step-card">
                <span className="onboarding-step-kicker">{item.step}</span>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
                <Link href={item.href} className="button-secondary onboarding-step-action">
                  {item.actionLabel}
                </Link>
              </article>
            ))}
          </div>
        </Surface>
      ) : null}

      <Surface
        title="Select Sprint And Continue"
        subtitle="Choose an active sprint, move into report generation, then continue to the generated report screen."
      >
        {state.recentSprints.length ? (
          <div className="report-library-list">
            {state.recentSprints.slice(0, 4).map((entry) => (
              <article key={entry?.sprint?._id} className="report-library-row">
                <div className="report-library-row-copy">
                  <div className="table-badge-row">
                    <StatusPill tone={sprintStatusTone(entry?.sprint?.status)}>{sprintStatusLabel(entry?.sprint?.status)}</StatusPill>
                    <StatusPill tone={entry?.sprint?.deliveryRisk || "default"}>
                      {entry?.sprint?.deliveryRisk ? `${entry.sprint.deliveryRisk} risk` : "risk pending"}
                    </StatusPill>
                  </div>
                  <strong>{entry?.sprint?.name || "Untitled sprint"}</strong>
                  <span>{entry?.project?.name || "Unassigned project"}</span>
                </div>

                <div className="report-library-strip">
                  <div className="report-library-mini">
                    <span>Score</span>
                    <strong>{entry?.sprint?.healthScore || 0}/100</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Progress</span>
                    <strong>{entry?.sprint?.metrics?.completionRate || 0}%</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Tickets</span>
                    <strong>{entry?.sprint?.metrics?.totalStories || 0}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Updated</span>
                    <strong>{formatDate(entry?.sprint?.updatedAt || entry?.sprint?.createdAt)}</strong>
                  </div>
                </div>

                <div className="report-library-row-actions">
                  <Link href={entry?.sprint?._id ? `/sprints/${entry.sprint._id}` : "/sprints"} className="button-secondary">
                    Open Sprint
                  </Link>
                  <Link
                    href={entry?.report?._id ? `/reports/${entry.report._id}` : "/reports"}
                    className="button"
                  >
                    {entry?.report?._id ? "Open Generated Report" : "Generate Report"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="simple-dashboard-empty">
            <strong>No sprints yet</strong>
            <p>Connect Jira or create a sprint with CSV upload to start the reporting journey.</p>
            <div className="page-actions">
              <Link href="/integrations" className="button">
                Connect Jira
              </Link>
              <Link href="/sprints/new" className="button-secondary">
                Upload CSV / Create Sprint
              </Link>
            </div>
          </div>
        )}
      </Surface>
    </AppShell>
  );
}
