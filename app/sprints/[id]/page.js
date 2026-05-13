"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BarChart, DonutChart, SparklineChart } from "@/components/charts";
import { InsightCard, KeyValueList, MetricCard, StatusPill, Surface } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import {
  buildAssigneeLoad,
  buildCompletionTrendFromSprints,
  buildStoryDistribution,
  buildVelocityTrendFromSprints,
  deriveDashboardMetrics,
  formatDate,
  mapInsight
} from "@/lib/view-models";

function sprintTone(risk) {
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

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

function formatDateRange(dateRange) {
  if (!dateRange?.start && !dateRange?.end) {
    return "No sprint window set";
  }

  const start = dateRange?.start ? formatDate(dateRange.start) : "Start TBD";
  const end = dateRange?.end ? formatDate(dateRange.end) : "End TBD";
  return `${start} - ${end}`;
}

function buildSprintNarrative({ sprint }) {
  if (sprint?.status === "processing") {
    return "AI is currently analysing this sprint. Insights and report output will appear automatically when processing completes.";
  }

  if (sprint?.status === "ready" && sprint?.aiSummary) {
    return sprint.aiSummary;
  }

  if (sprint?.goal) {
    return sprint.goal;
  }

  if (sprint?.status === "failed") {
    return "The previous AI analysis failed. Review the sprint and restart the analysis when ready.";
  }

  return "This sprint is saved and ready for manual analysis when you want insights and report generation.";
}

function tabClass(active, value) {
  return `report-tab ${active === value ? "is-active" : ""}`;
}

export default function SprintDetailsPage({ params }) {
  const [activeTab, setActiveTab] = useState("summary");
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: null,
    recentSprints: []
  });
  const [actionState, setActionState] = useState({
    busy: false,
    error: "",
    message: ""
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const resolvedParams = await params;
        const [payload, sprintData] = await Promise.all([
          apiGet(`/sprints/${resolvedParams.id}`),
          apiGet("/sprints?limit=7&sortBy=createdAt&sortOrder=desc").catch(() => null)
        ]);

        if (!active) return;

        setState({
          loading: false,
          error: "",
          payload,
          recentSprints: (sprintData?.items || []).map((entry) => entry.sprint).reverse()
        });
      } catch (error) {
        if (!active) return;

        setState({
          loading: false,
          error: error.message || "Unable to load sprint details.",
          payload: null,
          recentSprints: []
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [params]);

  const sprint = state.payload?.sprint || null;
  const project = state.payload?.project || null;
  const stories = state.payload?.stories || [];
  const rawInsights = state.payload?.insights || [];
  const insights = useMemo(() => rawInsights.map(mapInsight), [rawInsights]);
  const report = state.payload?.report || null;
  const metrics = deriveDashboardMetrics(sprint);
  const storyDistribution = buildStoryDistribution(stories);
  const assigneeLoad = buildAssigneeLoad(stories);
  const blockedStories = Number(sprint?.metrics?.blocked || 0);
  const completedStories = Number(sprint?.metrics?.completed || 0);
  const totalStories = Number(sprint?.metrics?.totalStories || stories.length || 0);
  const topOwner = assigneeLoad[0] || null;
  const completionLabel = sprint?.sprintNumber ? `S${sprint.sprintNumber}` : "Current";
  const completionTrend = state.recentSprints.length
    ? buildCompletionTrendFromSprints(state.recentSprints)
    : [{ label: completionLabel, value: sprint?.metrics?.completionRate || 0 }];
  const velocityTrend = state.recentSprints.length
    ? buildVelocityTrendFromSprints(state.recentSprints)
    : [{ label: completionLabel, value: sprint?.metrics?.completedStoryPoints || completedStories }];
  const heroStats = [
    {
      label: "Status",
      value: sprintStatusLabel(sprint?.status),
      detail: report?._id ? `Report ${report.status || "draft"} available` : "No generated report yet"
    },
    {
      label: "Health",
      value: `${sprint?.healthScore || 0}/100`,
      detail: sprint?.healthLabel || "No health label available"
    },
    {
      label: "Completion",
      value: `${sprint?.metrics?.completionRate || 0}%`,
      detail: `${completedStories} of ${stories.length} stories closed`
    },
    {
      label: "AI Signals",
      value: String(insights.length),
      detail: blockedStories ? `${blockedStories} blocker-linked signals surfaced` : "No blocker-linked AI signals"
    }
  ];
  const summaryCards = [
    {
      label: "Delivery Posture",
      title: sprint?.healthLabel || "Delivery narrative pending",
      detail:
        sprint?.deliveryRisk === "high"
          ? "Escalation risk is elevated and leadership review is recommended."
          : sprint?.deliveryRisk === "medium"
            ? "Delivery risk is watchlisted and should be monitored through closeout."
            : "Delivery posture is stable for standard stakeholder reporting."
    },
    {
      label: "Ownership",
      title: topOwner ? `${topOwner.label} carries ${topOwner.value}% of scoped points` : "No ownership concentration available",
      detail: topOwner
        ? "Review ownership balance if one owner is carrying an outsized share of the sprint scope."
        : "Ownership balance appears after story assignment and point allocation are available."
    },
    {
      label: "Sprint Window",
      title: formatDateRange(sprint?.dateRange),
      detail: project?.name || "Unassigned project"
    }
  ];

  async function handleAnalyze() {
    if (!sprint?._id) {
      return;
    }

    try {
      setActionState({
        busy: true,
        error: "",
        message: ""
      });
      await apiPost(`/sprints/${sprint._id}/analyze`, {});
      const [payload, sprintData] = await Promise.all([
        apiGet(`/sprints/${sprint._id}`),
        apiGet("/sprints?limit=7&sortBy=createdAt&sortOrder=desc").catch(() => null)
      ]);
      setState({
        loading: false,
        error: "",
        payload,
        recentSprints: (sprintData?.items || []).map((entry) => entry.sprint).reverse()
      });
      setActionState({
        busy: false,
        error: "",
        message: "AI analysis started. Sprint details refreshed with the latest status."
      });
    } catch (error) {
      setActionState({
        busy: false,
        error: error.message || "Unable to start AI analysis.",
        message: ""
      });
    }
  }

  return (
    <AppShell>
      {state.loading ? (
        <div className="simple-dashboard-empty">
          <strong>Loading sprint details</strong>
          <p>Fetching the latest stories, AI signals, and report status.</p>
        </div>
      ) : state.error ? (
        <div className="auth-alert">{state.error}</div>
      ) : sprint ? (
        <>
          <section className="report-studio-hero">
            <div className="report-studio-banner">
              <Link href="/sprints" className="table-action">
                Back To Sprints
              </Link>
              <span>
                {project?.name || "Workspace"} / {sprint?.name || "Sprint"}
              </span>
            </div>
            <div className="report-studio-heading">
              <div>
                <p className="eyebrow">Sprint Workspace</p>
                <h1>{sprint?.name || "Sprint"}</h1>
                <p className="page-description">{buildSprintNarrative({ sprint, project, report })}</p>
              </div>
              <div className="page-actions">
                <button
                  className="button"
                  onClick={handleAnalyze}
                  disabled={!sprint?._id || sprint?.status === "processing" || actionState.busy}
                >
                  {sprint?.status === "processing" ? "Analysing..." : actionState.busy ? "Starting..." : sprint?.status === "ready" ? "Re-run AI" : "Generate AI"}
                </button>
                {report?._id ? (
                  <Link href={`/reports/${report._id}`} className="button-secondary">
                    Open Report
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="table-badge-row">
              <StatusPill tone={sprintStatusTone(sprint.status)}>{sprintStatusLabel(sprint.status)}</StatusPill>
              <StatusPill tone={sprintTone(sprint.deliveryRisk)}>{sprint.deliveryRisk || "low"} risk</StatusPill>
              {report?.status ? <StatusPill tone={report.status}>{report.status}</StatusPill> : <StatusPill tone="draft">report not started</StatusPill>}
            </div>
            <div className="report-hero-stat-grid">
              {heroStats.map((item) => (
                <article key={item.label} className="report-hero-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>

          {actionState.error ? <div className="auth-alert">{actionState.error}</div> : null}
          {actionState.message ? <div className="manual-sprint-success">{actionState.message}</div> : null}

          {sprint?.status === "processing" ? (
            <div className="simple-dashboard-highlight">
              <strong>AI analysis is in progress</strong>
              <p>The AI summary, insights, and report output will appear here after processing completes.</p>
            </div>
          ) : null}

          {sprint?.status === "imported" ? (
            <div className="simple-dashboard-highlight">
              <strong>AI analysis has not started yet</strong>
              <p>Use Generate AI to manually start the insight and reporting workflow for this sprint.</p>
            </div>
          ) : null}

          <section className="report-executive-grid">
            <Surface title="Executive Summary" subtitle={sprint?.goal || "No sprint goal recorded."}>
              <div className="report-summary-stack">
                <div className="simple-dashboard-highlight">
                  <strong>{sprint?.name || "Current sprint"}</strong>
                  <p>{sprint?.aiSummary || "AI summary is still being generated for this sprint."}</p>
                </div>
                <div className="report-summary-card-grid">
                  {summaryCards.map((item) => (
                    <article key={item.label} className="report-summary-card">
                      <span>{item.label}</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </Surface>

            <Surface title="Sprint Snapshot" subtitle="Core sprint metadata and delivery context.">
              <KeyValueList
                items={[
                  { label: "Project", value: project?.name || "Unassigned project" },
                  { label: "Sprint Number", value: sprint?.sprintNumber || "Not set" },
                  { label: "Date Range", value: formatDateRange(sprint?.dateRange) },
                  { label: "Created", value: formatDate(sprint?.createdAt) },
                  { label: "Stories", value: String(stories.length) },
                  { label: "AI Signals", value: String(insights.length) }
                ]}
              />
              <div className="report-snapshot-metrics">
                {metrics.map((item) => (
                  <MetricCard key={item.label} {...item} />
                ))}
              </div>
            </Surface>
          </section>

          <Surface
            title="Sprint Workspace"
            subtitle="Switch between summary, AI signals, and the story-level work ledger."
            actions={
              <div className="report-tabs">
                <button className={tabClass(activeTab, "summary")} type="button" onClick={() => setActiveTab("summary")}>
                  Summary
                </button>
                <button className={tabClass(activeTab, "insights")} type="button" onClick={() => setActiveTab("insights")}>
                  AI Signals
                </button>
                <button className={tabClass(activeTab, "stories")} type="button" onClick={() => setActiveTab("stories")}>
                  Work Ledger
                </button>
              </div>
            }
          >
            {activeTab === "summary" ? (
              <div className="report-tab-panel">
                <section className="surface-grid two-up">
                  <Surface title="Recommendations" subtitle="Latest actions surfaced from the AI analysis layer.">
                    <div className="simple-insight-list">
                      {(sprint?.recommendations || []).length ? (
                        sprint.recommendations.map((item, index) => (
                          <article key={`${item}-${index}`} className="simple-insight-item">
                            <strong>Recommendation {index + 1}</strong>
                            <p>{item}</p>
                          </article>
                        ))
                      ) : (
                        <p className="page-description">No recommendations are available yet.</p>
                      )}
                    </div>
                  </Surface>

                  <Surface title="Health Snapshot" subtitle={sprint?.healthLabel || "No health label available."}>
                    <div className="report-health-card">
                      <div className="report-health-header">
                        <div className="report-health-copy">
                          <span className="report-health-kicker">Sprint Health</span>
                          <strong>{sprint?.healthLabel || "Healthy"}</strong>
                          <p>
                            {blockedStories
                              ? `${blockedStories} blocker-linked signals are shaping the current delivery posture.`
                              : "No blocker-linked signals are currently dragging the sprint posture."}
                          </p>
                        </div>
                        <div className="report-health-score">
                          <span>Health Score</span>
                          <strong>{sprint?.healthScore || 0}</strong>
                        </div>
                      </div>

                      <div className="report-health-metrics">
                        <div className="report-health-metric">
                          <span>Completion</span>
                          <strong>{sprint?.metrics?.completionRate || 0}%</strong>
                        </div>
                        <div className="report-health-metric">
                          <span>Done</span>
                          <strong>{completedStories}</strong>
                        </div>
                        <div className="report-health-metric">
                          <span>Blocked</span>
                          <strong>{blockedStories}</strong>
                        </div>
                      </div>

                      <div className="report-health-chart-grid">
                        <div className="report-health-chart-card">
                          <div className="report-health-chart-copy">
                            <strong>Completion Trend</strong>
                            <span>Current sprint progression</span>
                          </div>
                          <div className="report-health-progress">
                            <div className="report-health-progress-top">
                              <strong>{completionLabel}</strong>
                              <span>{sprint?.metrics?.completionRate || 0}%</span>
                            </div>
                            <div className="report-health-progress-track">
                              <div
                                className="report-health-progress-fill"
                                style={{ width: `${Math.max(6, Number(sprint?.metrics?.completionRate || 0))}%` }}
                              />
                            </div>
                            <div className="report-health-progress-foot">
                              <span>{completedStories} delivered</span>
                              <span>{Math.max(totalStories - completedStories, 0)} remaining</span>
                            </div>
                          </div>
                        </div>
                        <div className="report-health-chart-card">
                          <div className="report-health-chart-copy">
                            <strong>Story Distribution</strong>
                            <span>Execution mix across tracked work</span>
                          </div>
                          <div className="report-health-distribution">
                            {storyDistribution.map((item) => {
                              const share = totalStories ? Math.round((item.value / totalStories) * 100) : 0;
                              return (
                                <div key={item.label} className="report-health-distribution-row">
                                  <div className="report-health-distribution-copy">
                                    <strong>{item.label}</strong>
                                    <span>{item.value}</span>
                                  </div>
                                  <div className="report-health-distribution-track">
                                    <div
                                      className={`report-health-distribution-fill tone-${item.tone || "default"}`}
                                      style={{ width: `${Math.max(item.value ? 10 : 0, share)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Surface>
                </section>

                <section className="surface-grid three-up">
                  <Surface title="Completion Trend" subtitle="Completion rates across recent sprints in this workspace.">
                    <SparklineChart data={completionTrend} />
                  </Surface>

                  <Surface title="Velocity Trend" subtitle="Completed story-point throughput across recent sprints.">
                    <SparklineChart data={velocityTrend} />
                  </Surface>

                  <Surface title="Story Distribution" subtitle="Current delivery-state mix for this sprint.">
                    <DonutChart data={storyDistribution} />
                  </Surface>
                </section>

                <section className="surface-grid two-up">
                  <Surface title="Ownership Balance" subtitle="Current assignee distribution by story points.">
                    <BarChart data={assigneeLoad} />
                  </Surface>

                  <Surface title="Sprint Context" subtitle="How this sprint should be reviewed operationally.">
                    <div className="report-note-card">
                      <strong>Use this workspace for sprint reviews and delivery checkpoints</strong>
                      <p>
                        This view brings together scope, execution, risk, AI insight, and reporting readiness so the sprint can
                        be reviewed by engineering managers, delivery leads, and stakeholders from one place.
                      </p>
                    </div>
                  </Surface>
                </section>
              </div>
            ) : null}

            {activeTab === "insights" ? (
              <div className="report-tab-panel">
                <section className="surface-grid two-up">
                  {insights.length ? (
                    insights.map((insight) => <InsightCard key={insight.id} {...insight} />)
                  ) : (
                    <p className="page-description">No AI insights are available yet.</p>
                  )}
                </section>
              </div>
            ) : null}

            {activeTab === "stories" ? (
              <div className="report-tab-panel">
                <Surface title="Work Ledger" subtitle="Story-level delivery context presented in a responsive layout without horizontal scrolling.">
                  {stories.length ? (
                    <div className="report-work-ledger">
                      {stories.map((story, index) => (
                        <article key={story._id || story.issueKey || index} className="report-work-row">
                          <div className="report-work-main">
                            <div className="report-work-title">
                              <strong>{story.issueKey || `Story ${index + 1}`}</strong>
                              <span>{story.name || "Untitled story"}</span>
                            </div>
                            <div className="report-work-meta">
                              <StatusPill
                                tone={
                                  story.blocked ? "high" : /(done|complete|closed|resolved)/i.test(story.status || "") ? "low" : "medium"
                                }
                              >
                                {story.status || "To Do"}
                              </StatusPill>
                              <span>{story.assignee || "Unassigned"}</span>
                              <span>{story.storyPoints || 0} pts</span>
                              {story.blocked ? <span className="report-work-flag">Blocked</span> : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="page-description">No story ledger entries are available yet.</p>
                  )}
                </Surface>
              </div>
            ) : null}
          </Surface>

          {report?.status === "published" && report?.shareToken ? (
            <Surface title="Public Report" subtitle="Open the stakeholder-facing view for this sprint report.">
              <div className="page-actions">
                <Link href={`/report/${report.shareToken}`} className="button-secondary">
                  Open Public Report
                </Link>
              </div>
            </Surface>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
