"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { InsightCard, MetricCard, PageIntro, StatusPill, Surface } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate, mapInsight } from "@/lib/view-models";

function statusTone(status) {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  if (status === "imported") return "draft";
  return "processing";
}

function statusLabel(status) {
  if (status === "imported") return "awaiting ai";
  if (status === "processing") return "analysing";
  return status || "processing";
}

function sprintMessage(detail) {
  const status = detail?.sprint?.status;
  const insightCount = detail?.insights?.length || 0;

  if (status === "processing") {
    return "AI is analysing the sprint now. Insights will appear here automatically when processing completes.";
  }

  if (status === "ready") {
    return insightCount
      ? `${insightCount} AI insight${insightCount === 1 ? "" : "s"} generated for this sprint.`
      : "Analysis completed without any saved insight cards.";
  }

  if (status === "failed") {
    return "The previous AI run failed. Start the analysis again when you are ready.";
  }

  return "This sprint is saved, but AI has not started yet. Run analysis only when you want insights and report generation.";
}

export default function InsightsPage() {
  const [details, setDetails] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSprintId, setActiveSprintId] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const sprints = await apiGet("/sprints?limit=8&sortBy=createdAt&sortOrder=desc");
      const entries = sprints?.items || [];
      const sprintDetails = await Promise.all(
        entries
          .filter((entry) => entry?.sprint?._id)
          .map(async (entry) => {
            const detail = await apiGet(`/sprints/${entry.sprint._id}`);
            return {
              ...detail,
              sprint: detail?.sprint || entry.sprint,
              project: detail?.project || entry.project || null
            };
          })
      );

      setDetails(sprintDetails);
    } catch (loadError) {
      setError(loadError.message || "Unable to load AI insights.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAnalyze(sprintId) {
    if (!sprintId) {
      return;
    }

    try {
      setActiveSprintId(sprintId);
      setError("");
      setSuccess("");
      await apiPost(`/sprints/${sprintId}/analyze`, {});
      setSuccess("AI analysis started. Insight generation is now in progress.");
      await load();
    } catch (actionError) {
      setError(actionError.message || "Unable to start AI analysis.");
    } finally {
      setActiveSprintId("");
    }
  }

  const allInsights = details.flatMap((detail) =>
    (detail?.insights || []).map((insight, index) => ({
      ...mapInsight(insight, index),
      id: insight._id,
      title: `${detail?.sprint?.name || "Sprint"} • ${mapInsight(insight, index).category}`
    }))
  );
  const processingCount = details.filter((detail) => detail?.sprint?.status === "processing").length;
  const readyCount = details.filter((detail) => detail?.sprint?.status === "ready").length;

  return (
    <AppShell>
      <PageIntro
        eyebrow="AI Insight Layer"
        title="Insights"
        description="Review saved sprints, start AI analysis manually, and watch insight generation status from one place."
        actions={
          <button className="button-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {error ? <div className="auth-alert">{error}</div> : null}
      {success ? <div className="manual-sprint-success">{success}</div> : null}

      {processingCount ? (
        <div className="simple-dashboard-highlight">
          <strong>Insight generation is in progress</strong>
          <p>
            {processingCount} sprint{processingCount === 1 ? "" : "s"} {processingCount === 1 ? "is" : "are"} being analysed right now.
            Refresh this page in a moment to see the latest insight cards.
          </p>
        </div>
      ) : null}

      <section className="surface-grid three-up">
        <MetricCard label="Recent Sprints" value={String(details.length)} detail="Available for manual AI analysis" />
        <MetricCard
          label="Ready Insight Packs"
          value={String(readyCount)}
          detail="Sprints with completed AI insight generation"
          tone="healthy"
        />
        <MetricCard
          label="Processing"
          value={String(processingCount)}
          detail="Insight generation currently running"
          tone={processingCount ? "warning" : "healthy"}
        />
      </section>

      <Surface
        title="Analysis Queue"
        subtitle="Create or import a sprint first, then start AI only when you want insights and report generation."
      >
        {details.length ? (
          <div className="report-library-list">
            {details.map((detail) => (
              <article key={detail?.sprint?._id} className="report-library-row">
                <div className="report-library-row-copy">
                  <div className="table-badge-row">
                    <StatusPill tone={statusTone(detail?.sprint?.status)}>{statusLabel(detail?.sprint?.status)}</StatusPill>
                    <StatusPill tone={detail?.sprint?.deliveryRisk || "default"}>
                      {detail?.sprint?.deliveryRisk ? `${detail.sprint.deliveryRisk} risk` : "risk pending"}
                    </StatusPill>
                  </div>
                  <strong>{detail?.sprint?.name || "Untitled sprint"}</strong>
                  <span>{detail?.project?.name || "Unassigned project"}</span>
                  <p className="report-summary-snippet">{sprintMessage(detail)}</p>
                </div>

                <div className="report-library-strip">
                  <div className="report-library-mini">
                    <span>Created</span>
                    <strong>{formatDate(detail?.sprint?.createdAt)}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Stories</span>
                    <strong>{detail?.stories?.length || detail?.sprint?.metrics?.totalStories || 0}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Signals</span>
                    <strong>{detail?.insights?.length || 0}</strong>
                  </div>
                  <div className="report-library-mini">
                    <span>Health</span>
                    <strong>{detail?.sprint?.healthScore || 0}/100</strong>
                  </div>
                </div>

                <div className="report-library-row-actions">
                  <button
                    className="table-action"
                    onClick={() => handleAnalyze(detail?.sprint?._id)}
                    disabled={
                      !detail?.sprint?._id ||
                      detail?.sprint?.status === "processing" ||
                      activeSprintId === detail?.sprint?._id
                    }
                  >
                    {detail?.sprint?.status === "processing"
                      ? "Analysing..."
                      : activeSprintId === detail?.sprint?._id
                        ? "Starting..."
                        : detail?.sprint?.status === "ready"
                          ? "Re-run Insights"
                          : detail?.sprint?.status === "failed"
                            ? "Retry Analysis"
                            : "Generate Insights"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="simple-dashboard-empty">
            <strong>No sprint analysis queue yet</strong>
            <p>Create a sprint first, then come back here to manually generate AI insights.</p>
          </div>
        )}
      </Surface>

      <Surface title="Prioritized Signals" subtitle="The highest-value recommendations across velocity, risk, and workload.">
        <div className="insight-grid">
          {allInsights.length ? (
            allInsights.map((item) => <InsightCard key={item.id} {...item} />)
          ) : (
            <p className="page-description">No AI insights are available yet. Start analysis on any sprint to generate them.</p>
          )}
        </div>
      </Surface>
    </AppShell>
  );
}
