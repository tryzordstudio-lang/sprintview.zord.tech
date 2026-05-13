"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog, MetricCard, PageIntro, StatusPill, Surface } from "@/components/ui";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/view-models";

function truncate(value, maxLength = 120) {
  const normalized = String(value || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [actionSprintId, setActionSprintId] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [reportResult, sprintResult] = await Promise.all([
        apiGet("/report?limit=20&sortBy=updatedAt&sortOrder=desc"),
        apiGet("/sprints?limit=20&sortBy=createdAt&sortOrder=desc")
      ]);
      setRows(reportResult?.items || []);
      setSprints(sprintResult?.items || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePdf(reportId) {
    const result = await apiGet(`/report/${reportId}/pdf`);
    if (result?.pdfUrl) {
      window.open(result.pdfUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleWord(reportId) {
    const result = await apiGet(`/report/${reportId}/word`);
    if (result?.wordUrl) {
      window.open(result.wordUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleStatusConfirm() {
    if (!statusTarget?.reportId || !statusTarget?.nextStatus) {
      return;
    }

    try {
      setStatusBusy(true);
      await apiPatch(`/report/${statusTarget.reportId}/status`, { status: statusTarget.nextStatus });
      setStatusTarget(null);
      await load();
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleAnalyze(sprintId) {
    if (!sprintId) {
      return;
    }

    try {
      setActionSprintId(sprintId);
      setError("");
      setSuccess("");
      await apiPost(`/sprints/${sprintId}/analyze`, {});
      setSuccess("AI analysis started. Report generation is now in progress.");
      await load();
    } catch (actionError) {
      setError(actionError.message || "Unable to start report generation.");
    } finally {
      setActionSprintId("");
    }
  }

  const publishedCount = rows.filter((row) => row.report?.status === "published").length;
  const draftCount = rows.filter((row) => row.report?.status !== "published").length;
  const processingCount = sprints.filter((row) => row.sprint?.status === "processing").length;
  const averageHealth = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.sprint?.healthScore || 0), 0) / rows.length)
    : 0;
  const latestReadyReport = rows.find((row) => row.sprint?.status === "ready") || null;
  const latestPublished = rows.find((row) => row.report?.status === "published" && row.sprint?.status === "ready") || null;
  const reportBySprintId = new Map(rows.map((row) => [row?.sprint?._id, row]));
  const queueRows = sprints.map((entry) => ({
    sprint: entry.sprint,
    project: entry.project,
    report: reportBySprintId.get(entry?.sprint?._id)?.report || null
  }));
  const libraryMetrics = [
    {
      label: "Published Reports",
      value: String(publishedCount),
      detail: publishedCount ? "Stakeholder links currently active" : "No public reports available yet",
      tone: publishedCount ? "healthy" : "default"
    },
    {
      label: "Draft Reports",
      value: String(draftCount),
      detail: draftCount ? "Internal reviews waiting on publish approval" : "No reports waiting in draft",
      tone: draftCount ? "warning" : "healthy"
    },
    {
      label: "Average Health",
      value: String(averageHealth),
      unit: "/100",
      detail: rows.length ? "Cross-report delivery posture snapshot" : "No sprint health data available",
      tone: averageHealth >= 75 ? "healthy" : averageHealth >= 55 ? "warning" : "risk"
    },
    {
      label: "Generation Queue",
      value: String(processingCount),
      detail: processingCount ? "Reports currently being prepared by AI" : "No report generation in progress",
      tone: processingCount ? "warning" : "healthy"
    }
  ];
  const controlCards = [
    {
      label: "Executive Narrative",
      title: latestReadyReport?.sprint?.name || "No active sprint report",
      detail: truncate(latestReadyReport?.sprint?.aiSummary || "AI-generated board summaries appear here after sprint analysis completes.")
    },
    {
      label: "Governance",
      title: latestPublished ? "Stakeholder distribution active" : "Internal-only review mode",
      detail: latestPublished
        ? `${latestPublished.sprint?.name || "Latest report"} is currently shareable with stakeholders.`
        : "Publish a report to expose a stakeholder link and external review surface."
    },
    {
      label: "Export Pack",
      title: rows.length ? "PDF and Word export workflow ready" : "No export pack generated yet",
      detail: rows.length
        ? "Use each report card to open, publish, and export formal reporting packs."
        : "Generated report exports appear after the first sprint report is created."
    }
  ];

  return (
    <AppShell>
      <PageIntro
        eyebrow="AI Report Studio"
        title="Reports"
        description="Generate reports only when you want them. Save or import sprints first, then manually start AI reporting from this workspace."
        actions={
          <>
            {latestReadyReport?.report?._id ? (
              <Link href={`/reports/${latestReadyReport.report._id}`} className="button">
                Open Latest Report
              </Link>
            ) : null}
            <button className="button-secondary" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </>
        }
      />

      {error ? <div className="auth-alert">{error}</div> : null}
      {success ? <div className="manual-sprint-success">{success}</div> : null}

      {processingCount ? (
        <div className="simple-dashboard-highlight">
          <strong>Report generation is in progress</strong>
          <p>
            {processingCount} sprint{processingCount === 1 ? "" : "s"} {processingCount === 1 ? "is" : "are"} being analysed now.
            The report workspace and exports will update automatically after AI finishes.
          </p>
        </div>
      ) : null}

      <section className="surface-grid metrics">
        {libraryMetrics.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <Surface
        title="Report Control Center"
        subtitle="AI-generated executive summaries, governance controls, and stakeholder-ready distribution in one workspace."
      >
        <div className="report-control-grid">
          <article className="report-control-hero-card">
            <span className="report-control-kicker">Board-ready reporting</span>
            <strong>Turn sprint telemetry into a clean executive reporting stream.</strong>
            <p>
              Each report converts sprint metrics, blockers, and AI signals into a concise narrative that can be reviewed
              internally, published externally, and exported as a formal reporting pack.
            </p>
            <div className="report-control-actions">
              {latestPublished?.report?.shareToken ? (
                <Link href={`/report/${latestPublished.report.shareToken}`} className="button-secondary">
                  Open Public Report
                </Link>
              ) : null}
              {latestReadyReport?.report?._id ? (
                <Link href={`/reports/${latestReadyReport.report._id}`} className="button-secondary">
                  Review AI Brief
                </Link>
              ) : null}
            </div>
          </article>

          <div className="report-control-side">
            <article className="report-control-side-card">
              <span className="report-control-kicker">{controlCards[0].label}</span>
              <strong>{controlCards[0].title}</strong>
              <p>{controlCards[0].detail}</p>
            </article>

            <div className="report-control-side-stack">
              {controlCards.slice(1).map((item) => (
                <article key={item.label} className="report-control-card">
                  <span className="report-control-kicker">{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </Surface>

      <Surface
        title="Report Generation Queue"
        subtitle="Use this queue to start AI report generation only when you want insights, summaries, and exports."
      >
        {queueRows.length ? (
          <div className="report-library-list">
            {queueRows.map((row, index) => (
              <article key={row.sprint?._id || index} className="report-library-row">
                <div className="report-library-row-copy">
                  <div className="table-badge-row">
                    <StatusPill
                      tone={
                        row.sprint?.status === "ready"
                          ? "ready"
                          : row.sprint?.status === "failed"
                            ? "failed"
                            : row.sprint?.status === "imported"
                              ? "draft"
                              : "processing"
                      }
                    >
                      {row.sprint?.status === "imported"
                        ? "awaiting ai"
                        : row.sprint?.status === "processing"
                          ? "generating"
                          : row.sprint?.status || "processing"}
                    </StatusPill>
                    <StatusPill tone={row.sprint?.deliveryRisk || "default"}>
                      {row.sprint?.deliveryRisk ? `${row.sprint.deliveryRisk} risk` : "risk pending"}
                    </StatusPill>
                  </div>
                  <strong>{row.sprint?.name || "Untitled sprint"}</strong>
                  <span>{row.project?.name || "Unassigned project"}</span>
                  <p className="report-summary-snippet">
                    {row.sprint?.status === "processing"
                      ? "AI is generating the insight pack and report now."
                      : row.sprint?.status === "ready"
                        ? row.sprint?.aiSummary || "AI analysis completed. Open the report workspace or export the pack."
                        : row.sprint?.status === "failed"
                          ? "The previous report generation failed. Start it again when ready."
                          : "This sprint is saved without AI output. Start report generation only when you need the briefing."}
                  </p>
                </div>

                <div className="report-library-strip">
                  <div className="report-library-mini">
                    <span>Created</span>
                    <strong>{formatDate(row.sprint?.createdAt)}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Stories</span>
                    <strong>{row.sprint?.metrics?.totalStories || 0}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Health</span>
                    <strong>{row.sprint?.healthScore || 0}/100</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Report</span>
                    <strong>{row.report?._id ? "Ready" : "Not started"}</strong>
                  </div>
                </div>

                <div className="report-library-row-actions">
                  <button
                    className="table-action"
                    onClick={() => handleAnalyze(row.sprint?._id)}
                    disabled={!row.sprint?._id || row.sprint?.status === "processing" || actionSprintId === row.sprint?._id}
                  >
                    {row.sprint?.status === "processing"
                      ? "Generating..."
                      : actionSprintId === row.sprint?._id
                        ? "Starting..."
                        : row.sprint?.status === "ready"
                          ? "Re-generate Report"
                          : row.sprint?.status === "failed"
                            ? "Retry Generation"
                            : "Generate Insights & Report"}
                  </button>
                  {row.report?._id && row.sprint?.status === "ready" ? (
                    <Link href={`/reports/${row.report._id}`} className="table-action">
                      Open Report
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="simple-dashboard-empty">
            <strong>No sprints available for report generation</strong>
            <p>Create or import a sprint first, then start AI reporting manually from this page.</p>
          </div>
        )}
      </Surface>

      <Surface title="Report Library" subtitle="Published and draft report states with clean governance-ready actions.">
        {rows.length ? (
          <div className="report-library-list">
            {rows.map((row, index) => (
              <article key={row.report?._id || `${row.sprint?.name}-${index}`} className="report-library-row">
                <div className="report-library-row-copy">
                  <div className="table-badge-row">
                    <StatusPill tone={row.report?.status || "draft"}>{row.report?.status || "draft"}</StatusPill>
                    <StatusPill tone={row.sprint?.deliveryRisk || "default"}>
                      {row.sprint?.deliveryRisk ? `${row.sprint.deliveryRisk} risk` : "signal pending"}
                    </StatusPill>
                  </div>
                  <strong>{row.sprint?.name || "Untitled sprint"}</strong>
                  <span>{row.project?.name || "No project"}</span>
                  <p className="report-summary-snippet">
                    {truncate(row.sprint?.aiSummary || "AI summary is still being generated for this report.", 96)}
                  </p>
                </div>

                <div className="report-library-strip">
                  <div className="report-library-mini">
                    <span>Generated</span>
                    <strong>{formatDate(row.report?.updatedAt || row.report?.createdAt)}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Health</span>
                    <strong>{row.sprint?.healthScore || 0}/100</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Completion</span>
                    <strong>{row.sprint?.metrics?.completionRate || 0}%</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Stories</span>
                    <strong>{row.sprint?.metrics?.totalStories || 0}</strong>
                  </div>
                </div>

                <div className="report-library-row-actions">
                  <Link href={`/reports/${row.report?._id}`} className="table-action">
                    Open
                  </Link>
                  {row.report?.status === "published" ? (
                    <Link href={`/report/${row.report.shareToken}`} className="table-action">
                      Public View
                    </Link>
                  ) : null}
                  <button className="table-action" onClick={() => handlePdf(row.report?._id)} disabled={row.sprint?.status !== "ready"}>
                    Export PDF
                  </button>
                  <button className="table-action" onClick={() => handleWord(row.report?._id)} disabled={row.sprint?.status !== "ready"}>
                    Export Word
                  </button>
                  <button
                    className="table-action"
                    disabled={row.sprint?.status !== "ready"}
                    onClick={() =>
                      setStatusTarget({
                        reportId: row.report?._id,
                        sprintName: row.sprint?.name || "this report",
                        nextStatus: row.report?.status === "published" ? "draft" : "published"
                      })
                    }
                  >
                    {row.report?.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="simple-dashboard-empty">
            <strong>No reports yet</strong>
            <p>Create or import a sprint first, then click Generate Insights & Report to create the first report pack.</p>
          </div>
        )}
      </Surface>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.nextStatus === "published" ? "Publish Report" : "Move Report To Draft"}
        description={
          statusTarget
            ? statusTarget.nextStatus === "published"
              ? `Publish the report for ${statusTarget.sprintName}? Stakeholders with the share link will be able to access it.`
              : `Move the report for ${statusTarget.sprintName} back to draft? The public link will no longer be available.`
            : ""
        }
        confirmLabel={statusTarget?.nextStatus === "published" ? "Publish Report" : "Move To Draft"}
        busy={statusBusy}
        onCancel={() => !statusBusy && setStatusTarget(null)}
        onConfirm={handleStatusConfirm}
      />
    </AppShell>
  );
}
