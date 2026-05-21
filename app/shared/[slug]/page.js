"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BarChart, DonutChart, SparklineChart } from "@/components/charts";
import { DataTable, StatusPill, Surface } from "@/components/ui";
import { apiGet, apiPost, resolveAssetUrl } from "@/lib/api";
import { buildAssigneeLoad, buildCompletionTrendFromSprints, buildVelocityTrendFromSprints, formatDate, mapInsight } from "@/lib/view-models";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function capitalize(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isDoneStory(story) {
  return /(done|complete|closed|resolved)/i.test(String(story?.status || ""));
}

function buildTone(value, thresholds) {
  if (value >= thresholds.healthy) return "healthy";
  if (value >= thresholds.warning) return "warning";
  return "risk";
}

function formatDelta(value, suffix = "%") {
  const numeric = Math.round(Number(value || 0));
  return `${numeric >= 0 ? "+" : ""}${numeric}${suffix}`;
}

export default function SharedReportPage({ params }) {
  const [passwordInput, setPasswordInput] = useState("");
  const [submittedPassword, setSubmittedPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentName, setCommentName] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const resolvedParams = await params;
        const query = submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : "";
        const result = await apiGet(`/report/public/${resolvedParams.slug}${query}`, { credentials: "omit" });

        if (!active) {
          return;
        }

        setPayload(result);
        setComments(result?.comments || []);
        setPasswordRequired(false);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setPayload(null);
        setComments([]);
        if (loadError?.status === 401) {
          setPasswordRequired(true);
          setError("This shared report requires a valid password.");
        } else {
          setPasswordRequired(false);
          setError(loadError.message || "Unable to load the shared report.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [params, submittedPassword]);

  async function handleSubmitComment(event) {
    event.preventDefault();
    if (!payload?.sharing?.allowComments || !commentMessage.trim()) {
      return;
    }

    try {
      setSubmittingComment(true);
      const resolvedParams = await params;
      const result = await apiPost(
        `/report/public/${resolvedParams.slug}/comments`,
        {
          authorName: commentName.trim() || "Anonymous",
          message: commentMessage.trim(),
          password: submittedPassword
        },
        { credentials: "omit" }
      );
      setComments((current) => [...current, result]);
      setCommentName("");
      setCommentMessage("");
    } catch (submitError) {
      setError(submitError.message || "Unable to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  }

  const viewModel = useMemo(() => {
    if (!payload) {
      return null;
    }

    const report = payload.report || null;
    const sprint = payload.sprint || null;
    const project = payload.project || null;
    const stories = payload.stories || [];
    const recentSprints = payload.recentSprints || [];
    const insights = (payload.insights || []).map(mapInsight);
    const completedStories = Number(sprint?.metrics?.completed || stories.filter(isDoneStory).length || 0);
    const totalStories = Number(sprint?.metrics?.totalStories || stories.length || 0);
    const blockedStories = Number(sprint?.metrics?.blocked || stories.filter((story) => story.blocked).length || 0);
    const totalStoryPoints = Number(sprint?.metrics?.totalStoryPoints || 0);
    const completedStoryPoints = Number(sprint?.metrics?.completedStoryPoints || completedStories || 0);
    const completionRate = Number(sprint?.metrics?.completionRate || 0);
    const healthScore = Number(sprint?.healthScore || 0);
    const reviewCount = stories.filter((story) => /(review|qa|test)/i.test(String(story.status || ""))).length;
    const qaPressure = totalStories ? clamp(Math.round((reviewCount / Math.max(totalStories, 1)) * 100), 0, 100) : 0;
    const confidenceScore = clamp(Math.round(healthScore * 0.55 + completionRate * 0.45 - blockedStories * 4), 0, 100);
    const deliveryConfidence = clamp(Math.round(confidenceScore * 0.92), 0, 100);
    const topOwner = buildAssigneeLoad(stories)[0] || null;
    const completionTrend = recentSprints.length
      ? buildCompletionTrendFromSprints(recentSprints)
      : [{ label: sprint?.sprintNumber ? `S${sprint.sprintNumber}` : "Current", value: completionRate }];
    const velocityTrend = recentSprints.length
      ? buildVelocityTrendFromSprints(recentSprints)
      : [{ label: sprint?.sprintNumber ? `S${sprint.sprintNumber}` : "Current", value: completedStoryPoints }];

    return {
      report,
      sprint,
      project,
      stories,
      insights: insights.slice(0, 4),
      completedWork: stories.filter(isDoneStory).slice(0, 8),
      assigneeLoad: buildAssigneeLoad(stories),
      completionTrend,
      velocityTrend,
      factRows: [
        { label: "Workspace", value: project?.name || "SprintView Workspace" },
        { label: "Sprint Goal", value: sprint?.goal || "No sprint goal recorded" },
        { label: "Updated", value: formatDate(report?.updatedAt || report?.createdAt) },
        { label: "Share Mode", value: capitalize(payload?.sharing?.mode || "team") }
      ],
      summaryCards: [
        {
          label: "Completion",
          value: `${completionRate}%`,
          detail: `${completedStories} of ${totalStories || 0} scoped items completed`,
          tone: buildTone(completionRate, { healthy: 80, warning: 60 })
        },
        {
          label: "Confidence",
          value: `${confidenceScore}%`,
          detail: deliveryConfidence >= 75 ? "Release communication is stable." : "Stakeholder review is recommended.",
          tone: buildTone(confidenceScore, { healthy: 75, warning: 55 })
        },
        {
          label: "Delivery Risk",
          value: capitalize(sprint?.deliveryRisk || "medium"),
          detail: blockedStories ? `${blockedStories} blocker-linked items remain open.` : "No active blocker cluster is visible.",
          tone: sprint?.deliveryRisk === "high" ? "risk" : sprint?.deliveryRisk === "medium" ? "warning" : "healthy"
        }
      ],
      healthScore,
      healthNarrative:
        sprint?.deliveryRisk === "high"
          ? "Delivery risk is elevated and this sprint should be reviewed with active mitigation owners."
          : sprint?.deliveryRisk === "medium"
            ? "Delivery is watchlisted but suitable for stakeholder review with clear next actions."
            : "Delivery posture is stable and suitable for executive communication.",
      spotlight: {
        title: topOwner ? `${topOwner.label} owns ${topOwner.value}% of scoped points` : "Ownership spread is balanced",
        detail: topOwner
          ? "Review concentration before publishing if the sprint depends too heavily on one owner."
          : "Ownership data will populate after assignees and points are available."
      },
      metricRows: [
        {
          label: "Story points delivered",
          value: `${completedStoryPoints}/${totalStoryPoints || 0}`,
          detail: `${formatDelta(completionRate)} sprint completion`,
          tone: "default"
        },
        {
          label: "QA pressure",
          value: `${qaPressure}%`,
          detail: qaPressure > 30 ? "Review load is above the preferred operating range." : "Review load is within a manageable band.",
          tone: qaPressure > 30 ? "risk" : qaPressure > 18 ? "warning" : "healthy"
        },
        {
          label: "Forecast confidence",
          value: `${deliveryConfidence}%`,
          detail: "Stakeholder-facing readiness score based on health and closeout progress.",
          tone: deliveryConfidence >= 75 ? "healthy" : deliveryConfidence >= 55 ? "warning" : "risk"
        },
        {
          label: "Blocker count",
          value: String(blockedStories),
          detail: blockedStories ? "Escalation ownership should remain explicit." : "No active blockers are recorded in the current sprint.",
          tone: blockedStories ? "risk" : "healthy"
        }
      ],
      workflowSteps: [
        {
          label: "Import",
          detail: "Sprint and issue data ingested from Jira or manual upload.",
          tone: "healthy",
          state: "complete"
        },
        {
          label: "Analyze",
          detail: sprint?.status === "processing" ? "AI is generating sprint intelligence right now." : "AI analysis completed for the report.",
          tone: sprint?.status === "processing" ? "warning" : "healthy",
          state: sprint?.status === "processing" ? "active" : "complete"
        },
        {
          label: "Format",
          detail: "Widgets, layout, and export formatting are aligned for leadership review.",
          tone: "healthy",
          state: sprint?.status === "ready" ? "complete" : "active"
        },
        {
          label: "Share",
          detail: payload?.sharing?.allowComments ? "Public review and comments are enabled." : "Share link ready for internal stakeholders.",
          tone: payload?.sharing?.mode === "public" ? "healthy" : "warning",
          state: payload?.sharing?.mode === "private" ? "pending" : "complete"
        }
      ]
    };
  }, [payload]);

  if (passwordRequired && !payload) {
    return (
      <AppShell
        requireAuth={false}
        publicHeader={{
          kicker: "Protected report",
          title: "Shared sprint report",
          secondaryHref: "/",
          secondaryLabel: "Back to Home"
        }}
      >
        <section className="public-report-layout public-report-layout-full">
          <Surface className="public-report-gate" title="Password Required" subtitle="Enter the report password to continue.">
            {error ? <div className="auth-alert">{error}</div> : null}
            <form
              className="public-report-gate-form"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmittedPassword(passwordInput.trim());
              }}
            >
              <label className="builder-field">
                <span>Report password</span>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  placeholder="Enter password"
                />
              </label>
              <div className="page-actions">
                <button className="button" type="submit" disabled={!passwordInput.trim() || loading}>
                  {loading ? "Opening..." : "Open Report"}
                </button>
              </div>
            </form>
          </Surface>
        </section>
      </AppShell>
    );
  }

  if (loading && !payload) {
    return (
      <AppShell requireAuth={false} publicHeader={{ kicker: "Shared report", title: "Loading report" }}>
        <section className="public-report-layout public-report-layout-full">
          <Surface title="Loading shared report" subtitle="Preparing sprint intelligence for stakeholder view." />
        </section>
      </AppShell>
    );
  }

  if (error && !payload) {
    return (
      <AppShell requireAuth={false} publicHeader={{ kicker: "Shared report", title: "Report unavailable", secondaryHref: "/", secondaryLabel: "Back to Home" }}>
        <section className="public-report-layout public-report-layout-full">
          <Surface title="Unable to load report" subtitle={error} className="public-report-empty" />
        </section>
      </AppShell>
    );
  }

  if (!viewModel) {
    return null;
  }

  return (
    <AppShell
      requireAuth={false}
      publicHeader={{
        kicker: "Published report",
        title: viewModel.report?.title || viewModel.sprint?.name || "Sprint report",
        meta: `${viewModel.project?.name || "Workspace"} · Updated ${formatDate(viewModel.report?.updatedAt || viewModel.report?.createdAt)}`,
        secondaryHref: "/",
        secondaryLabel: "Home",
        primaryHref: viewModel.report?.pdfUrl ? resolveAssetUrl(viewModel.report.pdfUrl) : "",
        primaryExternal: true,
        primaryLabel: viewModel.report?.pdfUrl ? "Download PDF" : ""
      }}
    >
      <section className="public-report-layout public-report-layout-full">
        <Surface className="public-report-hero" title={viewModel.report?.title || viewModel.sprint?.name || "Sprint report"}>
          <div className="public-report-hero-grid">
            <div className="public-report-hero-copy">
              <div className="page-actions public-report-banner">
                <StatusPill tone="ready">Stakeholder Ready</StatusPill>
                <StatusPill tone={viewModel.sprint?.deliveryRisk === "high" ? "risk" : viewModel.sprint?.deliveryRisk === "medium" ? "warning" : "healthy"}>
                  {capitalize(viewModel.sprint?.deliveryRisk || "medium")} risk
                </StatusPill>
                {payload?.sharing?.allowComments ? <StatusPill tone="default">Comments enabled</StatusPill> : null}
              </div>
              <p className="page-description">
                {viewModel.sprint?.aiSummary ||
                  "This sprint report summarizes delivery progress, operational risk, and the current readiness narrative for stakeholders."}
              </p>
              <div className="public-report-card-grid">
                {viewModel.summaryCards.map((item) => (
                  <article key={item.label} className={`metric-card public-report-summary-card tone-${item.tone}`}>
                    <span className="metric-label">{item.label}</span>
                    <div className="metric-value-row">
                      <strong>{item.value}</strong>
                    </div>
                    <p className="metric-detail">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="public-report-hero-aside">
              <span className="public-report-fact-kicker">Report Brief</span>
              <div className="public-report-fact-list">
                {viewModel.factRows.map((item) => (
                  <div key={item.label} className="public-report-fact-row">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <p className="public-report-fact-note">{viewModel.healthNarrative}</p>
            </aside>
          </div>
        </Surface>

        <Surface title="Workflow" subtitle="The end-to-end delivery path for this sample sprint report.">
          <div className="public-report-workflow-grid">
            {viewModel.workflowSteps.map((step, index) => (
              <article key={step.label} className={`public-report-workflow-card state-${step.state} tone-${step.tone}`}>
                <div className="public-report-workflow-top">
                  <span>Step {index + 1}</span>
                  <StatusPill tone={step.tone}>{step.state}</StatusPill>
                </div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </Surface>

        {payload?.sharing?.allowComments ? (
          <Surface title="Comments" subtitle="Stakeholder feedback is enabled for this shared report.">
            <div className="public-report-comment-grid">
              <form className="public-report-comment-form" onSubmit={handleSubmitComment}>
                <label className="builder-field">
                  <span>Your name</span>
                  <input
                    value={commentName}
                    onChange={(event) => setCommentName(event.target.value)}
                    placeholder="Anonymous"
                  />
                </label>
                <label className="builder-field">
                  <span>Comment</span>
                  <textarea
                    value={commentMessage}
                    onChange={(event) => setCommentMessage(event.target.value)}
                    placeholder="Add stakeholder notes, feedback, or follow-up items."
                    rows={4}
                  />
                </label>
                <div className="page-actions">
                  <button className="button" type="submit" disabled={!commentMessage.trim() || submittingComment}>
                    {submittingComment ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </form>

              <div className="public-report-comment-list">
                {comments.length ? (
                  comments.map((comment) => (
                    <article key={comment.id} className="public-report-comment-card">
                      <div className="public-report-comment-meta">
                        <strong>{comment.authorName || "Anonymous"}</strong>
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      <p>{comment.message}</p>
                    </article>
                  ))
                ) : (
                  <article className="public-report-empty">
                    <strong>No comments yet.</strong>
                    <p>Be the first to add a note on this stakeholder report.</p>
                  </article>
                )}
              </div>
            </div>
          </Surface>
        ) : null}

        <div className="public-report-overview-grid">
          <Surface className="public-report-health-surface" title="Sprint Health" subtitle="Executive-level interpretation of delivery posture and ownership concentration.">
            <div className="public-report-health-layout">
              <DonutChart
                data={[
                  { label: "Achieved", value: viewModel.healthScore, tone: "healthy" },
                  { label: "Remaining", value: Math.max(100 - viewModel.healthScore, 0), tone: "default" }
                ]}
              />
              <div className="public-report-health-copy">
                <strong>{viewModel.healthNarrative}</strong>
                <p>{viewModel.spotlight.detail}</p>
                <div className="public-report-health-note">
                  <span>Ownership spotlight</span>
                  <strong>{viewModel.spotlight.title}</strong>
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="public-report-snapshot-surface" title="Delivery Snapshot" subtitle="The current operating signal in a stakeholder-friendly summary.">
            <div className="public-report-stat-grid">
              {viewModel.metricRows.map((item) => (
                <article key={item.label} className={`report-stat tone-${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </Surface>
        </div>

        <div className="public-report-overview-grid">
          <Surface title="Completion Trend" subtitle="Recent sprint completion movement for a quick leadership read.">
            <SparklineChart data={viewModel.completionTrend} />
          </Surface>
          <Surface title="Velocity Trend" subtitle="Delivered story points across the available sprint history.">
            <SparklineChart data={viewModel.velocityTrend} />
          </Surface>
        </div>

        <div className="public-report-overview-grid">
          <Surface title="Team Load Distribution" subtitle="Assignee share of scoped work based on the imported sprint data.">
            <BarChart data={viewModel.assigneeLoad} />
          </Surface>
          <Surface title="AI Insights" subtitle="The most material findings surfaced from this sprint snapshot.">
            <div className="public-report-insight-grid">
              {viewModel.insights.length ? (
                viewModel.insights.map((item, index) => (
                  <article key={`${item.title}-${index}`} className="public-report-story-card">
                    <div className="public-report-story-top">
                      <strong>{item.title}</strong>
                      <StatusPill tone={item.severity}>{item.category}</StatusPill>
                    </div>
                    <p className="public-report-story-title">{item.summary}</p>
                  </article>
                ))
              ) : (
                <article className="public-report-story-card">
                  <strong>AI insights are not available yet.</strong>
                  <p className="public-report-story-title">Generate the sprint analysis again to populate risk and recommendation cards.</p>
                </article>
              )}
            </div>
          </Surface>
        </div>

        <Surface
          title="Completed Work"
          subtitle="A concise list of completed sprint items included for stakeholder visibility."
        >
          <DataTable
            compact
            columns={[
              { key: "issueKey", label: "ID" },
              { key: "name", label: "Task" },
              {
                key: "status",
                label: "Status",
                render: (row) => <StatusPill tone="healthy">{row.status || "Done"}</StatusPill>
              },
              { key: "storyPoints", label: "Points" }
            ]}
            rows={viewModel.completedWork.map((story, index) => ({
              id: story._id || story.issueKey || index,
              issueKey: story.issueKey || `Story ${index + 1}`,
              name: story.name || "Untitled task",
              status: story.status || "Done",
              storyPoints: story.storyPoints || 0
            }))}
          />
        </Surface>
      </section>
    </AppShell>
  );
}
