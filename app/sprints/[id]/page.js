"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BarChart, DonutChart, SparklineChart } from "@/components/charts";
import { HealthRing, InsightCard, KeyValueList, StatusPill, Surface } from "@/components/ui";
import { apiGet, startSprintAnalysis } from "@/lib/api";
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

export default function SprintDetailsPage({ params }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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

  // Sync tab parameter from URL on load and changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["summary", "insights", "stories"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", newTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const sprint = state.payload?.sprint || null;
  const project = state.payload?.project || null;
  const stories = state.payload?.stories || [];
  const rawInsights = state.payload?.insights || [];
  const insights = useMemo(() => rawInsights.map(mapInsight), [rawInsights]);
  const report = state.payload?.report || null;
  const storyDistribution = buildStoryDistribution(stories);
  const assigneeLoad = buildAssigneeLoad(stories);
  const blockedStories = Number(sprint?.metrics?.blocked || 0);
  const completedStories = Number(sprint?.metrics?.completed || 0);
  const totalStories = Number(sprint?.metrics?.totalStories || stories.length || 0);
  const completionLabel = sprint?.sprintNumber ? `S${sprint.sprintNumber}` : "Current";
  const completionTrend = state.recentSprints.length
    ? buildCompletionTrendFromSprints(state.recentSprints)
    : [{ label: completionLabel, value: sprint?.metrics?.completionRate || 0 }];
  const velocityTrend = state.recentSprints.length
    ? buildVelocityTrendFromSprints(state.recentSprints)
    : [{ label: completionLabel, value: sprint?.metrics?.completedStoryPoints || completedStories }];

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

  // Polling when sprint analysis is processing
  useEffect(() => {
    if (sprint?.status !== "processing" || !sprint?._id) {
      return;
    }

    let active = true;
    const interval = setInterval(async () => {
      try {
        const payload = await apiGet(`/sprints/${sprint._id}`);
        if (!active) return;

        if (payload?.sprint?.status !== "processing") {
          // Refresh the sprint list as well when status transitions out of processing
          const sprintData = await apiGet("/sprints?limit=7&sortBy=createdAt&sortOrder=desc").catch(() => null);
          setState(prev => ({
            ...prev,
            payload,
            recentSprints: (sprintData?.items || []).map((entry) => entry.sprint).reverse()
          }));
        } else {
          setState(prev => ({
            ...prev,
            payload
          }));
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sprint?.status, sprint?._id]);


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
      await startSprintAnalysis(sprint._id);
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
        <div className="enterprise-layout">
          {/* Top Premium Header & Actions */}
          <div className="premium-header">
            <div className="premium-breadcrumbs">
              <Link href="/sprints">Sprints</Link>
              <svg className="separator-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span>{project?.name || "Workspace"}</span>
              <svg className="separator-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="current">{sprint?.name || "Sprint Details"}</span>
            </div>
            <div className="premium-action-group">
               <button
                className="premium-btn premium-btn-primary"
                onClick={handleAnalyze}
                disabled={!sprint?._id || sprint?.status === "processing" || actionState.busy}
              >
                {sprint?.status === "processing" || actionState.busy ? (
                  <svg className="premium-spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, marginRight: 8 }}>
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                    <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
                  </svg>
                )}
                {sprint?.status === "processing" ? "Analysing..." : actionState.busy ? "Starting..." : sprint?.status === "ready" ? "Re-run AI" : "Generate AI"}
              </button>
              {report?._id ? (
                <Link href={`/reports/${report._id}/layout`} className="premium-btn premium-btn-secondary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                    <path d="M7.5 3.5h6.5l4 4V19a1.5 1.5 0 0 1-1.5 1.5H7.5A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5z" />
                    <path d="M14 3.5V8h4.5" />
                  </svg>
                  Open Report Workspace
                </Link>
              ) : null}
            </div>
          </div>

          {actionState.error ? <div className="auth-alert">{actionState.error}</div> : null}
          {actionState.message ? <div className="manual-sprint-success">{actionState.message}</div> : null}

          {/* Core Metric Cards Grid */}
          <section className="premium-metric-grid">
            <article className="premium-metric-card glow-info">
              <div className="premium-metric-header">
                <span className="premium-metric-label">Status</span>
                <span style={{ color: "var(--primary)", fontSize: "1.1rem" }}>⚬</span>
              </div>
              <div className="premium-metric-value-row">
                <strong className="premium-metric-value">{sprintStatusLabel(sprint.status)}</strong>
              </div>
              <p className="premium-metric-detail">
                {report?._id ? "Report workspace ready" : "Report pending AI analysis"}
              </p>
            </article>

            <article className={`premium-metric-card glow-${sprint.deliveryRisk === "high" ? "danger" : sprint.deliveryRisk === "medium" ? "warning" : "success"}`}>
              <div className="premium-metric-header">
                <span className="premium-metric-label">Sprint Health</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{sprint.healthScore || 0}/100</span>
              </div>
              <div className="premium-metric-value-row">
                <strong className="premium-metric-value">{sprint.healthLabel || "Healthy"}</strong>
              </div>
              <p className="premium-metric-detail">
                {sprint.deliveryRisk ? `${sprint.deliveryRisk.toUpperCase()} risk profile` : "Low risk profile"}
              </p>
            </article>

            <article className="premium-metric-card glow-success">
              <div className="premium-metric-header">
                <span className="premium-metric-label">Completion</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{sprint?.metrics?.completionRate || 0}%</span>
              </div>
              <div className="premium-metric-value-row" style={{ display: "grid", gap: "6px", width: "100%" }}>
                <strong className="premium-metric-value">
                  {completedStories} <span style={{ fontSize: "0.92rem", color: "var(--text-soft)", fontWeight: 400 }}>of {stories.length} stories</span>
                </strong>
                <div className="report-health-progress-track" style={{ height: "6px", margin: "4px 0" }}>
                  <div
                    className="report-health-progress-fill"
                    style={{ width: `${sprint?.metrics?.completionRate || 0}%`, background: "var(--success)" }}
                  />
                </div>
              </div>
              <p className="premium-metric-detail">
                {stories.length - completedStories} remaining active items
              </p>
            </article>

            <article className={`premium-metric-card ${blockedStories ? "glow-warning" : "glow-info"}`}>
              <div className="premium-metric-header">
                <span className="premium-metric-label">AI Signals</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>{insights.length} total</span>
              </div>
              <div className="premium-metric-value-row">
                <strong className="premium-metric-value">{insights.length}</strong>
              </div>
              <p className="premium-metric-detail">
                {blockedStories ? `${blockedStories} blocker-linked alerts` : "No active blocker alerts"}
              </p>
            </article>
          </section>

          {/* AI Copilot summary narrative Banner */}
          <section className="premium-ai-banner">
            <div className="premium-ai-header">
              <div className="premium-ai-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
                </svg>
                AI Executive Summary
              </div>
              <div className="table-badge-row">
                <StatusPill tone={sprintStatusTone(sprint.status)}>{sprintStatusLabel(sprint.status)}</StatusPill>
                <StatusPill tone={sprintTone(sprint.deliveryRisk)}>{sprint.deliveryRisk || "low"} risk</StatusPill>
              </div>
            </div>
            {sprint?.status === "processing" ? (
              <div className="premium-ai-loading-container">
                <div className="premium-ai-loading-pulse-bar" style={{ width: "90%" }} />
                <div className="premium-ai-loading-pulse-bar" style={{ width: "75%" }} />
                <div className="premium-ai-loading-pulse-bar" style={{ width: "80%" }} />
                <div className="premium-ai-loading-text">
                  <svg className="premium-spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                  <span>AI analysis is in progress. Surfacing critical delivery signals and key risk items...</span>
                </div>
              </div>
            ) : (
              <p className="premium-ai-body">
                {buildSprintNarrative({ sprint, project, report })}
              </p>
            )}
          </section>

          {/* Workspace Tabs Navigation */}
          <div className="premium-tabs-wrapper">
            <div className="premium-tabs">
              <button
                className={`premium-tab-btn ${activeTab === "summary" ? "is-active" : ""}`}
                onClick={() => handleTabChange("summary")}
              >
                <span>Summary & Charts</span>
                <span className="premium-tab-count">3</span>
              </button>
              <button
                className={`premium-tab-btn ${activeTab === "insights" ? "is-active" : ""}`}
                onClick={() => handleTabChange("insights")}
              >
                <span>AI Signals</span>
                <span className="premium-tab-count">{insights.length}</span>
              </button>
              <button
                className={`premium-tab-btn ${activeTab === "stories" ? "is-active" : ""}`}
                onClick={() => handleTabChange("stories")}
              >
                <span>Work Ledger</span>
                <span className="premium-tab-count">{stories.length}</span>
              </button>
            </div>
          </div>

          {/* Tab Panels */}
          {activeTab === "summary" ? (
            <section className="premium-split-grid">
              {/* Left Column: Recommendations & Visual Charts */}
              <div className="premium-split-column">
                <Surface title="Delivery Recommendations" subtitle="Latest action items surfaced from the AI analysis layers.">
                  <div className="premium-insight-list">
                    {(sprint?.recommendations || []).length ? (
                      sprint.recommendations.map((item, index) => {
                        const tone = sprint.deliveryRisk || "low";
                        return (
                          <article key={`${item}-${index}`} className="premium-insight-item">
                            <div className={`premium-insight-indicator type-${tone}`}>
                              <span className="premium-recommendation-number">#{index + 1}</span>
                            </div>
                            <div className="premium-insight-item-body">
                              <strong>Action Recommendation</strong>
                              <p>{item}</p>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="page-description">No recommendations are available yet.</p>
                    )}
                  </div>
                </Surface>

                <Surface title="Scope & Ownership" subtitle="Point allocation and execution breakdown.">
                  <div className="chart-grid-two" style={{ marginTop: "12px" }}>
                    <div style={{ display: "grid", gap: "12px", padding: "18px", background: "rgba(148, 163, 184, 0.03)", borderRadius: "14px", border: "1px solid var(--border)", minWidth: 0 }}>
                      <header style={{ marginBottom: "4px" }}>
                        <h4 style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>Story Distribution</h4>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-soft)", margin: "2px 0 0" }}>Mix of delivery states.</p>
                      </header>
                      <DonutChart data={storyDistribution} />
                    </div>
                    <div style={{ display: "grid", gap: "12px", padding: "18px", background: "rgba(148, 163, 184, 0.03)", borderRadius: "14px", border: "1px solid var(--border)", minWidth: 0 }}>
                      <header style={{ marginBottom: "4px" }}>
                        <h4 style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>Ownership Balance</h4>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-soft)", margin: "2px 0 0" }}>Assignee load by story points.</p>
                      </header>
                      <BarChart data={assigneeLoad} />
                    </div>
                  </div>
                </Surface>
              </div>

              {/* Right Column: Key Details, Sparklines & Health Ring */}
              <div className="premium-split-column">
                <Surface title="Sprint Metadata" subtitle="Timeline and scope configuration.">
                  <KeyValueList
                    items={[
                      { label: "Project", value: project?.name || "Unassigned" },
                      { label: "Sprint Number", value: sprint?.sprintNumber || "Not set" },
                      { label: "Date Window", value: formatDateRange(sprint?.dateRange) },
                      { label: "Created On", value: formatDate(sprint?.createdAt) },
                      { label: "Total Stories", value: `${stories.length} items` },
                      { label: "AI Indicators", value: `${insights.length} signals` }
                    ]}
                  />
                </Surface>

                <Surface title="Sprint Health" subtitle="Aggregated delivery profile.">
                  <div className="report-health-card" style={{ padding: 0, border: 0, boxShadow: "none", background: "transparent" }}>
                    <div className="report-health-header" style={{ padding: 0 }}>
                      <HealthRing score={sprint?.healthScore || 0} label={sprint?.healthLabel || "Healthy"} hideLabel={true} />
                      <div className="report-health-copy">
                        <span className="report-health-kicker">Delivery posture</span>
                        <strong>{sprint?.healthLabel || "Healthy"}</strong>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>
                          {blockedStories
                            ? `${blockedStories} blocker-linked signal${blockedStories === 1 ? "" : "s"} ${blockedStories === 1 ? "is" : "are"} shaping the delivery posture.`
                            : "No blocked items are currently dragging progression."}
                        </p>
                      </div>
                    </div>
                  </div>
                </Surface>

                <Surface title="Sprint Trends" subtitle="Historical workspace performance.">
                  <div className="premium-trend-group">
                    <div>
                      <span className="premium-trend-label">Completion Trend</span>
                      <SparklineChart data={completionTrend} />
                    </div>
                    <div>
                      <span className="premium-trend-label">Velocity Trend</span>
                      <SparklineChart data={velocityTrend} />
                    </div>
                  </div>
                </Surface>
              </div>
            </section>
          ) : null}

          {activeTab === "insights" ? (
            <div className="premium-insight-list">
              <div className="sprint-insight-head" style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-soft)" }}>AI Signal Review</span>
                <p style={{ margin: "4px 0 0" }}>Review generated delivery signals and critical risk items before exporting report workspace.</p>
              </div>
              <div className="chart-grid-two">
                {insights.length ? (
                  insights.map((insight) => <InsightCard key={insight.id} {...insight} />)
                ) : (
                  <p className="page-description">No AI insights are available yet.</p>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "stories" ? (
            <div className="premium-table-card">
              <div className="premium-table-header">
                <div>
                  <h4 className="premium-table-title">Sprint Work Ledger</h4>
                  <p className="premium-table-subtitle">{stories.length} tracked items in scope</p>
                </div>
              </div>
              <div className="premium-table-wrap">
                {stories.length ? (
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Summary</th>
                        <th className="hide-mobile">Type</th>
                        <th>Status</th>
                        <th className="hide-mobile">Assignee</th>
                        <th className="hide-mobile">Story Points</th>
                        <th>Alerts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stories.map((story, index) => {
                        const normalizedStatus = String(story.status || "").toLowerCase();
                        const isCompleted = /(done|complete|closed|resolved)/i.test(normalizedStatus);
                        const isBlocked = story.blocked || normalizedStatus.includes("block");
                        const statusTone = isBlocked ? "high" : isCompleted ? "low" : "medium";

                        const typeClass = String(story.issueType || "").toLowerCase() === "bug" ? "bug" : String(story.issueType || "").toLowerCase() === "task" ? "task" : "story";

                        const assigneeName = story.assignee || "Unassigned";
                        const initials = assigneeName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

                        return (
                          <tr key={story._id || story.issueKey || index}>
                            <td className="ledger-key">{story.issueKey || `NEP-${index + 1}`}</td>
                            <td className="ledger-title">{story.name || "Untitled story"}</td>
                            <td className="hide-mobile">
                              <span className={`ledger-type-badge ${typeClass}`}>
                                {story.issueType || "Story"}
                              </span>
                            </td>
                            <td>
                              <StatusPill tone={statusTone}>{story.status || "To Do"}</StatusPill>
                            </td>
                            <td className="hide-mobile">
                              <div className="ledger-assignee">
                                <div className="ledger-avatar" title={assigneeName}>{initials}</div>
                                <span>{assigneeName}</span>
                              </div>
                            </td>
                            <td className="ledger-points hide-mobile">{story.storyPoints || 0} pts</td>
                            <td>
                              {isBlocked ? (
                                <span className="ledger-blocked-flag">Blocked</span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: "32px", textAlign: "center" }}>
                    <p className="page-description">No story ledger entries are available yet.</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
