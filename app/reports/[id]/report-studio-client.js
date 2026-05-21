"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SidebarBrandLogo } from "@/components/sidebar-brand-logo";
import { BarChart, DonutChart, SparklineChart } from "@/components/charts";
import { StatusPill, Surface } from "@/components/ui";
import { apiGet, apiPatch, apiPost, openGeneratedAsset, startSprintAnalysis } from "@/lib/api";
import {
  buildAssigneeLoad,
  buildCompletionTrendFromSprints,
  buildVelocityTrendFromSprints,
  formatDate,
  mapInsight
} from "@/lib/view-models";

const PAGE_ORDER = [1];
const PAGE_LABELS = {
  1: "Sprint Executive Summary and Complete Delivery Report"
};
const WIDGET_LIBRARY = [
  {
    id: "header",
    label: "Report Header",
    type: "Rich text",
    description: "Sprint title, project context, executive summary, and report metadata.",
    defaultPage: 1,
    defaultSize: "full"
  },
  {
    id: "completion",
    label: "Completion KPI",
    type: "KPI",
    description: "Sprint completion rate and movement versus the previous sprint.",
    defaultPage: 1,
    defaultSize: "small"
  },
  {
    id: "velocity",
    label: "Velocity KPI",
    type: "KPI",
    description: "Delivered story points and recent throughput change.",
    defaultPage: 1,
    defaultSize: "small"
  },
  {
    id: "confidence",
    label: "Confidence KPI",
    type: "KPI",
    description: "Stakeholder-facing confidence score for sprint closeout.",
    defaultPage: 1,
    defaultSize: "small"
  },
  {
    id: "bugs",
    label: "Quality KPI",
    type: "KPI",
    description: "Bug load and blocker pressure affecting delivery quality.",
    defaultPage: 1,
    defaultSize: "small"
  },
  {
    id: "delivered",
    label: "Delivered KPI",
    type: "KPI",
    description: "Completed work items and delivered story points.",
    defaultPage: 1,
    defaultSize: "small"
  },
  {
    id: "risk",
    label: "Risk KPI",
    type: "KPI",
    description: "Overall delivery risk and release posture.",
    defaultPage: 1,
    defaultSize: "small"
  },
  {
    id: "burndown",
    label: "Burndown Chart",
    type: "Chart",
    description: "Recent completion movement for a print-ready progress view.",
    defaultPage: 1,
    defaultSize: "medium"
  },
  {
    id: "velocityTrend",
    label: "Velocity Trend",
    type: "Chart",
    description: "Throughput trend across recent sprint cycles.",
    defaultPage: 1,
    defaultSize: "medium"
  },
  {
    id: "goal",
    label: "Goal Achievement",
    type: "Executive",
    description: "Sprint goal progress and what was actually delivered.",
    defaultPage: 1,
    defaultSize: "medium"
  },
  {
    id: "deliveryAnalytics",
    label: "Delivery Analytics",
    type: "Analytics",
    description: "Scope, QA load, confidence, and bottleneck signals.",
    defaultPage: 1,
    defaultSize: "full"
  },
  {
    id: "insights",
    label: "SprintView Insights",
    type: "AI",
    description: "Top AI-generated findings for leadership review.",
    defaultPage: 1,
    defaultSize: "full"
  },
  {
    id: "teamHealth",
    label: "Team Health",
    type: "Health",
    description: "Workload balance, blocker pressure, and ownership spread.",
    defaultPage: 1,
    defaultSize: "medium"
  },
  {
    id: "businessImpact",
    label: "Business Impact",
    type: "Executive",
    description: "Operational delivery signals translated into business language.",
    defaultPage: 1,
    defaultSize: "medium"
  },
  {
    id: "completedWork",
    label: "Completed Work",
    type: "Table",
    description: "Completed sprint work for the final appendix.",
    defaultPage: 1,
    defaultSize: "full"
  },
  {
    id: "risks",
    label: "Risks and Blockers",
    type: "Table",
    description: "Priority risks, blockers, and watch items.",
    defaultPage: 1,
    defaultSize: "medium"
  },
  {
    id: "outlook",
    label: "Next Sprint Outlook",
    type: "Rich text",
    description: "Recommended actions and focus areas for the next sprint.",
    defaultPage: 1,
    defaultSize: "medium"
  }
];
const TEMPLATE_PRESETS = {
  executive: [
    { id: "header", page: 1, size: "full", visible: true },
    { id: "completion", page: 1, size: "small", visible: true },
    { id: "velocity", page: 1, size: "small", visible: true },
    { id: "confidence", page: 1, size: "small", visible: true },
    { id: "bugs", page: 1, size: "small", visible: true },
    { id: "delivered", page: 1, size: "small", visible: true },
    { id: "risk", page: 1, size: "small", visible: true },
    { id: "burndown", page: 1, size: "medium", visible: true },
    { id: "velocityTrend", page: 1, size: "medium", visible: true },
    { id: "goal", page: 1, size: "medium", visible: true },
    { id: "deliveryAnalytics", page: 1, size: "full", visible: true },
    { id: "insights", page: 1, size: "full", visible: true },
    { id: "teamHealth", page: 1, size: "medium", visible: true },
    { id: "businessImpact", page: 1, size: "medium", visible: true },
    { id: "completedWork", page: 1, size: "full", visible: true },
    { id: "risks", page: 1, size: "medium", visible: true },
    { id: "outlook", page: 1, size: "medium", visible: true }
  ],
  health: [
    { id: "header", page: 1, size: "full", visible: true },
    { id: "completion", page: 1, size: "small", visible: true },
    { id: "confidence", page: 1, size: "small", visible: true },
    { id: "risk", page: 1, size: "small", visible: true },
    { id: "delivered", page: 1, size: "small", visible: true },
    { id: "teamHealth", page: 1, size: "full", visible: true },
    { id: "burndown", page: 1, size: "medium", visible: true },
    { id: "velocityTrend", page: 1, size: "medium", visible: true },
    { id: "deliveryAnalytics", page: 1, size: "full", visible: true },
    { id: "insights", page: 1, size: "full", visible: true },
    { id: "businessImpact", page: 1, size: "medium", visible: true },
    { id: "completedWork", page: 1, size: "full", visible: true },
    { id: "risks", page: 1, size: "medium", visible: true },
    { id: "outlook", page: 1, size: "medium", visible: true },
    { id: "velocity", page: 1, size: "small", visible: true },
    { id: "bugs", page: 1, size: "small", visible: true },
    { id: "goal", page: 1, size: "medium", visible: true }
  ],
  delivery: [
    { id: "header", page: 1, size: "full", visible: true },
    { id: "completion", page: 1, size: "small", visible: true },
    { id: "velocity", page: 1, size: "small", visible: true },
    { id: "delivered", page: 1, size: "small", visible: true },
    { id: "risk", page: 1, size: "small", visible: true },
    { id: "burndown", page: 1, size: "medium", visible: true },
    { id: "velocityTrend", page: 1, size: "medium", visible: true },
    { id: "deliveryAnalytics", page: 1, size: "full", visible: true },
    { id: "businessImpact", page: 1, size: "medium", visible: true },
    { id: "teamHealth", page: 1, size: "medium", visible: true },
    { id: "completedWork", page: 1, size: "full", visible: true },
    { id: "risks", page: 1, size: "medium", visible: true },
    { id: "outlook", page: 1, size: "medium", visible: true },
    { id: "insights", page: 1, size: "full", visible: true },
    { id: "confidence", page: 1, size: "small", visible: true },
    { id: "bugs", page: 1, size: "small", visible: true },
    { id: "goal", page: 1, size: "medium", visible: true }
  ]
};
const STUDIO_NAV_ITEMS = [
  { href: "/app", label: "Dashboard" },
  { href: "/sprints", label: "Sprints" },
  { href: "/reports", label: "Reports" }
];

function buildWidgetLayout(presetName = "executive") {
  const preset = TEMPLATE_PRESETS[presetName] || TEMPLATE_PRESETS.executive;
  const presetMap = new Map(preset.map((item, index) => [item.id, { ...item, order: index }]));

  return WIDGET_LIBRARY.map((widget, index) => {
    const override = presetMap.get(widget.id);
    return {
      id: widget.id,
      title: widget.label,
      page: 1, // Enforce page 1
      size: override?.size || widget.defaultSize,
      visible: true, // Enforce visible: true
      order: override?.order ?? preset.length + index
    };
  }).sort((left, right) => left.order - right.order);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function formatDelta(value, suffix = "%") {
  const numeric = Math.round(Number(value || 0));
  return `${numeric >= 0 ? "+" : ""}${numeric}${suffix}`;
}

function capitalize(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isDoneStory(story) {
  return /(done|complete|closed|resolved)/i.test(String(story?.status || ""));
}

function summarizeConfidence(score) {
  if (score >= 80) return "High confidence";
  if (score >= 60) return "Measured confidence";
  return "Watchlisted confidence";
}

function getWidgetById(id) {
  return WIDGET_LIBRARY.find((widget) => widget.id === id) || null;
}

function canUseShortcuts(target) {
  const tagName = target?.tagName?.toLowerCase();
  if (!tagName) {
    return true;
  }

  if (["input", "textarea", "select", "button"].includes(tagName)) {
    return false;
  }

  return !target.isContentEditable;
}

function reorderWidgets(layout, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return layout;
  }

  const source = layout.find((item) => item.id === sourceId);
  const target = layout.find((item) => item.id === targetId);

  if (!source || !target) {
    return layout;
  }

  const next = layout.filter((item) => item.id !== sourceId);
  const targetIndex = next.findIndex((item) => item.id === targetId);

  if (targetIndex === -1) {
    return layout;
  }

  next.splice(targetIndex, 0, {
    ...source,
    page: target.page
  });

  return next.map((item, index) => ({
    ...item,
    order: index
  }));
}

function moveWidgetByStep(layout, widgetId, direction) {
  const index = layout.findIndex((item) => item.id === widgetId);
  if (index === -1) {
    return layout;
  }

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= layout.length) {
    return layout;
  }

  const next = [...layout];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);

  return next.map((item, itemIndex) => ({
    ...item,
    order: itemIndex
  }));
}

function serializeLayout(layout) {
  try {
    const essential = layout.map(item => ({
      i: item.id,
      t: item.title,
      p: item.page,
      s: item.size,
      v: item.visible ? 1 : 0,
      o: item.order
    }));
    const jsonStr = JSON.stringify(essential);
    return btoa(encodeURIComponent(jsonStr));
  } catch (e) {
    console.error("Layout serialization failed:", e);
    return "";
  }
}

function deserializeLayout(str, templatePreset = "executive") {
  try {
    const defaultLayout = buildWidgetLayout(templatePreset);
    if (!str) return defaultLayout;
    const jsonStr = decodeURIComponent(atob(str));
    const essential = JSON.parse(jsonStr);
    
    const essentialMap = new Map(essential.map((item, index) => [item.i, { ...item, index }]));
    
    return WIDGET_LIBRARY.map((widget, index) => {
      const serialized = essentialMap.get(widget.id);
      const defaultWidget = defaultLayout.find(w => w.id === widget.id) || {};
      
      if (serialized) {
        return {
          id: serialized.i,
          title: serialized.t || defaultWidget.title || widget.label || serialized.i,
          page: 1, // Enforce page 1
          size: serialized.s || defaultWidget.size || widget.defaultSize || "small",
          visible: true, // Force all widgets to be visible!
          order: Number(serialized.o ?? serialized.index)
        };
      } else {
        return {
          id: widget.id,
          title: defaultWidget.title || widget.label,
          page: 1, // Enforce page 1
          size: defaultWidget.size || widget.defaultSize || "small",
          visible: true, // Force all widgets to be visible!
          order: defaultWidget.order ?? defaultLayout.length + index
        };
      }
    }).sort((left, right) => left.order - right.order);
  } catch (e) {
    console.error("Layout deserialization failed:", e);
    return buildWidgetLayout(templatePreset);
  }
}

function hydrateStoredLayout(layout, templatePreset = "executive") {
  if (!Array.isArray(layout) || !layout.length) {
    return buildWidgetLayout(templatePreset);
  }

  const defaultLayout = buildWidgetLayout(templatePreset);
  const storedMap = new Map(layout.map((item, index) => [item.id, { ...item, order: Number(item.order ?? index) }]));

  return WIDGET_LIBRARY.map((widget, index) => {
    const stored = storedMap.get(widget.id);
    const fallback = defaultLayout.find((item) => item.id === widget.id);

    return {
      id: widget.id,
      title: stored?.title || fallback?.title || widget.label,
      page: Number(stored?.page || fallback?.page || 1),
      size: stored?.size || fallback?.size || widget.defaultSize,
      visible: typeof stored?.visible === "boolean" ? stored.visible : fallback?.visible ?? true,
      order: Number(stored?.order ?? fallback?.order ?? defaultLayout.length + index)
    };
  }).sort((left, right) => left.order - right.order);
}

function deriveRiskHighlights({ insights, blockedStories, qaPressure, topOwner }) {
  const items = [];

  if (blockedStories) {
    items.push({
      severity: "High",
      tone: "risk",
      content: `${blockedStories} blocker-linked items still require explicit closeout ownership.`
    });
  }

  for (const insight of insights) {
    if (!insight?.summary) continue;
    items.push({
      severity: insight.severity === "high" ? "High" : insight.severity === "medium" ? "Medium" : "Low",
      tone: insight.severity || "default",
      content: insight.summary
    });
  }

  if (qaPressure > 24) {
    items.push({
      severity: "Medium",
      tone: "warning",
      content: "Review and QA pressure is elevated enough to affect confidence at sprint closeout."
    });
  }

  if (Number(topOwner?.value || 0) > 50) {
    items.push({
      severity: "Low",
      tone: "warning",
      content: `${topOwner.label} owns a large share of scoped points, which reduces delivery resilience.`
    });
  }

  if (!items.length) {
    items.push({
      severity: "Low",
      tone: "healthy",
      content: "No material blocker pattern is visible in the current sprint snapshot."
    });
  }

  return items.slice(0, 3);
}

function deriveOutlookItems({ recommendations, blockedStories, qaPressure, completionRate }) {
  if (recommendations.length) {
    return recommendations.slice(0, 4);
  }

  const defaults = [];

  if (blockedStories) {
    defaults.push("Resolve blocker ownership earlier in sprint planning and review the escalation path.");
  }

  if (qaPressure > 18) {
    defaults.push("Rebalance QA and review capacity before the next closeout window.");
  }

  if (completionRate < 75) {
    defaults.push("Reduce carry-over by scoping work closer to recent delivery throughput.");
  }

  defaults.push("Preserve the highest-performing delivery pattern from this sprint and repeat it in planning.");
  defaults.push("Keep the next sprint report focused on confidence movement, risk, and stakeholder outcomes.");

  return defaults.slice(0, 4);
}

function buildTone(value, thresholds) {
  if (value >= thresholds.healthy) return "healthy";
  if (value >= thresholds.warning) return "warning";
  return "risk";
}

function getSprintStatusTone(status) {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  if (status === "processing") return "processing";
  return "draft";
}

function ReportWidgetBody({ widgetId, data }) {
  const {
    report,
    sprint,
    project,
    heroKpis,
    completionTrend,
    velocityTrend,
    goalAchievementData,
    deliveryAnalytics,
    teamHealthRows,
    businessImpactRows,
    insightCards,
    completedWork,
    riskHighlights,
    nextOutlookItems,
    assigneeLoad,
    topOwner,
    summaryCards,
    metrics
  } = data;

  switch (widgetId) {
    case "header":
      return (
        <div className="builder-header-widget">
          <div className="builder-header-main">
            <div className="builder-section-kicker">Sprint Report</div>
            <h2>{sprint?.name || "Current Sprint"}</h2>
            <p>
              {sprint?.aiSummary ||
                "This report summarizes sprint progress, delivery risk, and next-step recommendations for stakeholder review."}
            </p>
            <div className="builder-header-badges">
              <StatusPill tone="ready">Internal Report</StatusPill>
              <span>Prepared in SprintView</span>
              <span>Ready for review</span>
            </div>
          </div>
          <aside className="builder-header-aside">
            <div className="builder-meta-block">
              <span>Project</span>
              <strong>{project?.name || "Workspace"}</strong>
            </div>
            <div className="builder-meta-block">
              <span>Sprint Goal</span>
              <strong>{sprint?.goal || "No sprint goal recorded."}</strong>
            </div>
            <div className="builder-meta-block">
              <span>Last updated</span>
              <strong>{formatDate(report?.updatedAt || report?.createdAt)}</strong>
            </div>
          </aside>
          <div className="builder-header-summary-grid">
            {summaryCards.map((item) => (
              <article key={item.label} className="builder-summary-card">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      );

    case "completion":
    case "velocity":
    case "confidence":
    case "bugs":
    case "delivered":
    case "risk": {
      const kpi = heroKpis[widgetId];
      let pill = null;
      let detailText = kpi.detail;
      if (kpi.detail && kpi.detail.includes(" vs ")) {
        const parts = kpi.detail.split(" vs ");
        if (parts.length === 2) {
          const deltaVal = parts[0];
          const isNegative = deltaVal.startsWith("-");
          const isZero = deltaVal === "+0" || deltaVal === "+0%" || deltaVal === "0" || deltaVal === "0%";
          const pillTone = isNegative ? "risk" : (isZero ? "warning" : "healthy");
          pill = <span className={`builder-kpi-widget-pill tone-${pillTone}`}>{deltaVal}</span>;
          detailText = `vs ${parts[1]}`;
        }
      }
      return (
        <div className={`builder-kpi-widget tone-${kpi.tone}`}>
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
            {pill}
            <p style={{ margin: 0 }}>{detailText}</p>
          </div>
        </div>
      );
    }

    case "burndown":
      return (
        <div className="builder-chart-widget">
          <div className="builder-chart-copy">
            <strong>Burndown Signal</strong>
            <span>Completion movement across comparable sprint closeouts.</span>
          </div>
          <SparklineChart data={completionTrend} />
        </div>
      );

    case "velocityTrend":
      return (
        <div className="builder-chart-widget">
          <div className="builder-chart-copy">
            <strong>Velocity Trend</strong>
            <span>Throughput across recent sprint cycles.</span>
          </div>
          <SparklineChart data={velocityTrend} />
        </div>
      );

    case "goal":
      return (
        <div className="builder-goal-widget">
          <div className="builder-goal-visual">
            <DonutChart data={goalAchievementData} />
          </div>
          <div className="builder-goal-copy">
            <span className="builder-section-kicker">Goal Achievement</span>
            <strong>{metrics.goalAchievement}% achieved</strong>
            <p>{sprint?.goal || "No sprint objective was recorded for this cycle."}</p>
            <ul className="builder-list">
              <li>{metrics.completedStories} completed work items are contributing to sprint closure.</li>
              <li>{metrics.completedStoryPoints} story points have been delivered in the current sprint.</li>
              <li>
                {metrics.blockedStories
                  ? `${metrics.blockedStories} blocker-linked items still need closeout attention.`
                  : "No active blockers are currently limiting final sprint sign-off."}
              </li>
            </ul>
          </div>
        </div>
      );

    case "deliveryAnalytics":
      return (
        <div className="builder-stat-grid">
          {deliveryAnalytics.map((item) => (
            <article key={item.label} className={`builder-stat-card tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      );

    case "insights":
      return (
        <div className="builder-insight-grid">
          {insightCards.length ? (
            insightCards.map((item, index) => (
              <article key={`${item.title}-${index}`} className={`builder-insight-card tone-${item.severity}`}>
                <div className="builder-insight-meta">
                  <span>{item.title}</span>
                  <StatusPill tone={item.severity}>{item.category}</StatusPill>
                </div>
                <p>{item.summary}</p>
              </article>
            ))
          ) : (
            <article className="builder-empty-card">
              <strong>No AI insight cards are available yet.</strong>
              <p>Generate the AI report to populate key findings and recommendations.</p>
            </article>
          )}
        </div>
      );

    case "teamHealth":
      return (
        <div className="builder-team-health">
          <div className="builder-health-list">
            {teamHealthRows.map((item) => (
              <div key={item.label} className="builder-health-row">
                <div className="builder-health-copy">
                  <strong>{item.label}</strong>
                  <span>{item.status}</span>
                </div>
                <div className="builder-health-track">
                  <div className={`builder-health-fill tone-${item.tone}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="builder-owner-chart">
            <BarChart data={assigneeLoad} />
          </div>
          <div className="builder-owner-note">
            <span>Ownership balance</span>
            <strong>{topOwner ? `${topOwner.label} leads with ${topOwner.value}%` : "No ownership concentration available"}</strong>
          </div>
        </div>
      );

    case "businessImpact":
      return (
        <div className="builder-impact-grid">
          {businessImpactRows.map((item) => (
            <article key={item.label} className={`builder-impact-card tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      );

    case "completedWork":
      return completedWork.length ? (
        <div className="builder-table-wrap">
          <table className="builder-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Task</th>
                <th>Status</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {completedWork.map((story, index) => (
                <tr key={story._id || story.issueKey || index}>
                  <td>
                    <span className="builder-story-tag">
                      {story.issueKey || `Story ${index + 1}`}
                    </span>
                  </td>
                  <td>{story.name || "Untitled task"}</td>
                  <td>
                    <StatusPill tone="healthy">{story.status || "Done"}</StatusPill>
                  </td>
                  <td>{story.storyPoints || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <article className="builder-empty-card">
          <strong>No completed work is available yet.</strong>
          <p>Completed tasks will appear here once work reaches a done state.</p>
        </article>
      );

    case "risks":
      return (
        <div className="builder-risk-stack">
          {riskHighlights.map((item, index) => (
            <article key={`${item.severity}-${index}`} className={`builder-risk-card tone-${item.tone}`}>
              <span>{item.severity}</span>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      );

    case "outlook":
      return (
        <div className="builder-outlook-card">
          <ul className="builder-list">
            {nextOutlookItems.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      );

    default:
      return (
        <article className="builder-empty-card">
          <strong>Widget unavailable</strong>
          <p>This widget has no renderer yet.</p>
        </article>
      );
  }
}

function WidgetFrame({
  widget,
  viewMode,
  selected,
  onSelect,
  onDragStart,
  onDrop,
  onSizeCycle,
  onMove,
  onHide,
  children
}) {
  const metadata = getWidgetById(widget.id);
 
  return (
    <article
      className={`report-widget-card span-${widget.size} ${selected ? "is-selected" : ""}`}
      data-widget-id={widget.id}
      data-widget-size={widget.size}
      draggable={viewMode === "edit"}
      onDragStart={() => onDragStart(widget.id)}
      onDragOver={(event) => {
        if (viewMode === "edit") {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(widget.id);
      }}
      onClick={() => onSelect(widget.id)}
    >
      {viewMode === "print" ? (
        widget.id !== "header" ? (
          <div className="report-widget-print-head">
            <span>{metadata?.type || "Widget"}</span>
            <strong>{widget.title}</strong>
          </div>
        ) : null
      ) : (
        <div className="report-widget-toolbar">
          <div className="report-widget-toolbar-copy" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {viewMode === "edit" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, color: "var(--text-muted)", cursor: "grab", flexShrink: 0 }}>
                <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
              </svg>
            ) : null}
            <div>
              <span style={{ display: "block" }}>{metadata?.type || "Widget"}</span>
              <strong>{widget.title}</strong>
            </div>
          </div>
          <div className="report-widget-toolbar-meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {viewMode === "edit" ? (
              <div className="widget-direct-controls" style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 4 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="widget-control-btn"
                  title={`Resize: ${widget.size} (Cycle small ➔ medium ➔ full)`}
                  onClick={() => onSizeCycle(widget.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M21 9H12v12" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="widget-control-btn"
                  title="Move earlier in layout"
                  onClick={() => onMove(widget.id, "up")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="widget-control-btn"
                  title="Move later in layout"
                  onClick={() => onMove(widget.id, "down")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="widget-control-btn btn-danger"
                  title="Hide section from canvas"
                  onClick={() => onHide(widget.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.77 21.77 0 0 1 5.06-6.94" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.17 4.77" />
                    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                </button>
              </div>
            ) : null}
            <StatusPill tone="default">{widget.size}</StatusPill>
          </div>
        </div>
      )}
      <div className="report-widget-content">{children}</div>
    </article>
  );
}

export default function ReportStudioClientPage({ params }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [actionState, setActionState] = useState({ busy: false, message: "", error: "" });
  const [state, setState] = useState({
    error: "",
    payload: null,
    recentSprints: []
  });
  const [viewMode, setViewMode] = useState("edit");
  const [themeVariant, setThemeVariant] = useState("enterprise");
  const [templatePreset, setTemplatePreset] = useState("executive");
  const [widgetLayout, setWidgetLayout] = useState(() => buildWidgetLayout("executive"));
  const [selectedWidgetId, setSelectedWidgetId] = useState("header");
  const [draggingWidgetId, setDraggingWidgetId] = useState("");
  const [sidebarTab, setSidebarTab] = useState("setup");
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasHydratedPreferences, setHasHydratedPreferences] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateDraft, setTemplateDraft] = useState({ name: "", scope: "workspace" });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingSharing, setSavingSharing] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState("idle");
  const [reportTitle, setReportTitle] = useState("");
  const [sectionQuery, setSectionQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [sharingForm, setSharingForm] = useState({
    mode: "team",
    publicSlug: "",
    password: "",
    allowComments: false,
    expiresAt: "",
    hasPassword: false
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const resolvedParams = await params;
        const [payload, sprintData, templateData] = await Promise.all([
          apiGet(`/report/internal/${resolvedParams.id}`),
          apiGet("/sprints?limit=7&sortBy=createdAt&sortOrder=desc").catch(() => null),
          apiGet("/templates?limit=50").catch(() => ({ items: [] }))
        ]);

        if (!active) return;

        setState({
          error: "",
          payload,
          recentSprints: (sprintData?.items || []).map((entry) => entry.sprint).reverse()
        });
        setTemplates(templateData?.items || []);
      } catch (error) {
        if (!active) return;

        setState({
          error: error.message || "Unable to load report.",
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

  const report = state.payload?.report || null;
  const sprint = state.payload?.sprint || null;

  // Background polling during AI analysis generation
  useEffect(() => {
    if (sprint?.status !== "processing" || !report?._id) {
      return;
    }

    let active = true;
    const interval = setInterval(async () => {
      try {
        const payload = await apiGet(`/report/internal/${report._id}`);
        if (!active) return;

        if (payload?.sprint?.status !== "processing") {
          const sprintData = await apiGet("/sprints?limit=7&sortBy=createdAt&sortOrder=desc").catch(() => null);
          setState({
            error: "",
            payload,
            recentSprints: (sprintData?.items || []).map((entry) => entry.sprint).reverse()
          });
        } else {
          setState((prev) => ({
            ...prev,
            payload
          }));
        }
      } catch (err) {
        console.error("Report workspace polling error:", err);
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sprint?.status, report?._id]);
  const project = state.payload?.project || null;
  const stories = state.payload?.stories || [];
  const insights = useMemo(() => (state.payload?.insights || []).map(mapInsight), [state.payload]);

  // Load state from URL on mount
  useEffect(() => {
    const mode = searchParams.get("mode");
    const theme = searchParams.get("theme");
    const preset = searchParams.get("preset");
    const tab = searchParams.get("tab");
    const widget = searchParams.get("widget");
    const layoutStr = searchParams.get("layout");

    if (mode && ["edit", "print", "view"].includes(mode)) {
      setViewMode(mode);
    }
    if (theme && ["enterprise", "minimal", "print"].includes(theme)) {
      setThemeVariant(theme);
    }
    if (preset && ["executive", "health", "delivery"].includes(preset)) {
      setTemplatePreset(preset);
    }
    if (tab && ["setup", "sections"].includes(tab)) {
      setSidebarTab(tab);
    }
    if (widget) {
      setSelectedWidgetId(widget);
    }
    if (layoutStr) {
      const decoded = deserializeLayout(layoutStr, preset || "executive");
      if (decoded && decoded.length) {
        setWidgetLayout(decoded);
      }
    } else if (preset) {
      setWidgetLayout(buildWidgetLayout(preset));
    }
    
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!report?._id) {
      return;
    }

    setReportTitle(report?.title || sprint?.name || "Sprint Report");
    setSharingForm({
      mode: report?.sharing?.mode || "team",
      publicSlug: report?.sharing?.publicSlug || "",
      password: "",
      allowComments: Boolean(report?.sharing?.allowComments),
      expiresAt: report?.sharing?.expiresAt
        ? new Date(report.sharing.expiresAt).toISOString().slice(0, 16)
        : "",
      hasPassword: Boolean(report?.sharing?.hasPassword)
    });
  }, [report?._id, report?.sharing?.mode, report?.sharing?.publicSlug, report?.sharing?.allowComments, report?.sharing?.expiresAt, report?.sharing?.hasPassword]);

  useEffect(() => {
    if (!report?._id && !sprint?.name) {
      return;
    }

    setReportTitle((current) => current || report?.title || sprint?.name || "Sprint Report");
  }, [report?._id, report?.title, sprint?.name]);

  // Hydrate persisted report preferences when URL does not explicitly override them.
  useEffect(() => {
    if (!report?._id || !isInitialized || hasHydratedPreferences) {
      return;
    }

    const explicitTheme = searchParams.get("theme");
    const explicitPreset = searchParams.get("preset");
    const explicitLayout = searchParams.get("layout");
    const explicitWidget = searchParams.get("widget");
    const persistedPreferences = report?.preferences || {};

    if (!explicitTheme && persistedPreferences.themeVariant) {
      setThemeVariant(persistedPreferences.themeVariant);
    }
    if (!explicitPreset && persistedPreferences.templatePreset) {
      setTemplatePreset(persistedPreferences.templatePreset);
    }
    if (!explicitLayout && persistedPreferences.widgetLayout?.length) {
      const hydrated = hydrateStoredLayout(
        persistedPreferences.widgetLayout,
        persistedPreferences.templatePreset || templatePreset
      );
      setWidgetLayout(hydrated);
      if (!explicitWidget && hydrated[0]?.id) {
        setSelectedWidgetId(hydrated[0].id);
      }
    }

    setHasHydratedPreferences(true);
  }, [report?._id, report?.preferences, isInitialized, hasHydratedPreferences, searchParams, templatePreset]);

  // Set default layout when neither URL nor persisted preferences provide one.
  useEffect(() => {
    if ((report?._id || sprint?._id) && !searchParams.get("layout") && !hasHydratedPreferences) {
      setWidgetLayout(buildWidgetLayout(templatePreset));
      setSelectedWidgetId("header");
    }
  }, [report?._id, sprint?._id, hasHydratedPreferences, searchParams, templatePreset]);

  // Sync state changes back to URL query parameters
  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", viewMode);
    params.set("theme", themeVariant);
    params.set("preset", templatePreset);
    params.set("tab", sidebarTab);
    params.set("widget", selectedWidgetId);

    const serialized = serializeLayout(widgetLayout);
    if (serialized) {
      params.set("layout", serialized);
    } else {
      params.delete("layout");
    }

    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery !== nextQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [viewMode, themeVariant, templatePreset, sidebarTab, selectedWidgetId, widgetLayout, isInitialized]);

  useEffect(() => {
    if (!report?._id || !isInitialized || !hasHydratedPreferences) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setPreferencesStatus("saving");
        const result = await apiPatch(`/report/internal/${report._id}/preferences`, {
          title: reportTitle.trim() || sprint?.name || "Sprint Report",
          themeVariant,
          templatePreset,
          widgetLayout
        });

        setState((current) =>
          current.payload
            ? {
                ...current,
                payload: {
                  ...current.payload,
                  report: {
                    ...current.payload.report,
                    title: result?.title || current.payload.report?.title || "",
                    preferences: result?.preferences || current.payload.report?.preferences
                  }
                }
              }
            : current
        );
        setPreferencesStatus("saved");
      } catch (error) {
        console.error("Unable to persist report preferences", error);
        setPreferencesStatus("error");
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [report?._id, reportTitle, sprint?.name, themeVariant, templatePreset, widgetLayout, isInitialized, hasHydratedPreferences]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (!canUseShortcuts(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = String(event.key || "").toLowerCase();
      if (key === "e") {
        event.preventDefault();
        setViewMode("edit");
      } else if (key === "r") {
        event.preventDefault();
        setViewMode("view");
      } else if (key === "p") {
        event.preventDefault();
        setViewMode((current) => (current === "print" ? "edit" : "print"));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const widgetData = useMemo(() => {
    const completedStories = Number(sprint?.metrics?.completed || stories.filter(isDoneStory).length || 0);
    const totalStories = Number(sprint?.metrics?.totalStories || stories.length || 0);
    const blockedStories = Number(sprint?.metrics?.blocked || stories.filter((story) => story.blocked).length || 0);
    const pendingStories = Number(sprint?.metrics?.pending || Math.max(totalStories - completedStories - blockedStories, 0));
    const inProgressStories = Number(
      sprint?.metrics?.inProgress || Math.max(totalStories - completedStories - pendingStories - blockedStories, 0)
    );
    const totalStoryPoints = Number(sprint?.metrics?.totalStoryPoints || 0);
    const completedStoryPoints = Number(sprint?.metrics?.completedStoryPoints || completedStories || 0);
    const healthScore = Number(sprint?.healthScore || 0);
    const completionRate = Number(sprint?.metrics?.completionRate || 0);
    const bugsCount = stories.filter((story) => /bug/i.test(String(story.issueType || ""))).length;
    const reviewCount = stories.filter((story) => /(review|qa|test)/i.test(String(story.status || ""))).length;
    const confidenceScore = clamp(Math.round(healthScore * 0.55 + completionRate * 0.45 - blockedStories * 4), 0, 100);
    const completionLabel = sprint?.sprintNumber ? `S${sprint.sprintNumber}` : "Current";
    const completionTrend = state.recentSprints.length
      ? buildCompletionTrendFromSprints(state.recentSprints)
      : [{ label: completionLabel, value: completionRate }];
    const velocityTrend = state.recentSprints.length
      ? buildVelocityTrendFromSprints(state.recentSprints)
      : [{ label: completionLabel, value: completedStoryPoints }];
    const topOwner = buildAssigneeLoad(stories)[0] || null;
    const assigneeLoad = buildAssigneeLoad(stories);
    const previousCompletion = completionTrend.length > 1 ? Number(completionTrend[completionTrend.length - 2]?.value || 0) : completionRate;
    const previousVelocity = velocityTrend.length > 1 ? Number(velocityTrend[velocityTrend.length - 2]?.value || 0) : completedStoryPoints;
    const completionDelta = completionRate - previousCompletion;
    const velocityDelta = completedStoryPoints - previousVelocity;
    const goalAchievement = totalStoryPoints
      ? clamp(Math.round((completedStoryPoints / Math.max(totalStoryPoints, 1)) * 100), 0, 100)
      : completionRate;
    const scopeVolatility = totalStories
      ? clamp(Math.round(((pendingStories + inProgressStories + blockedStories) / Math.max(totalStories, 1)) * 100), 0, 100)
      : 0;
    const qaPressure = totalStories ? clamp(Math.round((reviewCount / Math.max(totalStories, 1)) * 100), 0, 100) : 0;
    const deliveryConfidence = clamp(Math.round(confidenceScore * 0.92), 0, 100);
    const healthTone = buildTone(confidenceScore, { healthy: 75, warning: 55 });
    const riskTone = sprint?.deliveryRisk === "high" ? "risk" : sprint?.deliveryRisk === "medium" ? "warning" : "healthy";

    return {
      report,
      sprint,
      project,
      completionTrend,
      velocityTrend,
      assigneeLoad,
      topOwner,
      summaryCards: [
        {
          label: "Delivery status",
          title: sprint?.healthLabel || "Delivery narrative pending",
          detail:
            sprint?.deliveryRisk === "high"
              ? "Escalation risk is elevated and leadership review is recommended."
              : sprint?.deliveryRisk === "medium"
                ? "Delivery risk is watchlisted and should remain visible through sprint closeout."
                : "Delivery posture is stable for routine stakeholder communication."
        },
        {
          label: "Ownership spread",
          title: topOwner ? `${topOwner.label} carries ${topOwner.value}% of scoped points` : "Ownership view not available",
          detail: topOwner
            ? "Review concentration before publishing if the work mix is heavily owner-dependent."
            : "Ownership balance will populate after story assignment and point allocation are available."
        },
        {
          label: "Last updated",
          title: formatDate(report?.updatedAt || report?.createdAt),
          detail: project?.name || "Unassigned project"
        }
      ],
      heroKpis: {
        completion: {
          label: "Completion",
          value: `${completionRate}%`,
          detail: `${formatDelta(completionDelta)} vs prior sprint`,
          tone: buildTone(completionRate, { healthy: 80, warning: 60 })
        },
        velocity: {
          label: "Velocity",
          value: `${completedStoryPoints} SP`,
          detail: `${formatDelta(velocityDelta, "")} vs prior sprint`,
          tone: velocityDelta >= 0 ? "healthy" : "warning"
        },
        confidence: {
          label: "Confidence",
          value: `${confidenceScore}%`,
          detail: summarizeConfidence(confidenceScore),
          tone: healthTone
        },
        bugs: {
          label: "Quality",
          value: String(bugsCount || blockedStories),
          detail: bugsCount ? `${bugsCount} bug-focused items in scope` : `${blockedStories} blocker-linked items tracked`,
          tone: bugsCount <= 2 && blockedStories === 0 ? "healthy" : bugsCount <= 4 ? "warning" : "risk"
        },
        delivered: {
          label: "Delivered",
          value: String(completedStories),
          detail: `${completedStoryPoints} story points completed`,
          tone: "default"
        },
        risk: {
          label: "Risk",
          value: capitalize(sprint?.deliveryRisk || "medium"),
          detail: sprint?.healthLabel || "No health label available",
          tone: riskTone
        }
      },
      deliveryAnalytics: [
        {
          label: "Scope Stability",
          value: `${100 - scopeVolatility}%`,
          detail:
            scopeVolatility > 45
              ? "Scope movement is elevated and should remain visible in leadership review."
              : "Scope remained comparatively stable through the sprint window.",
          tone: scopeVolatility > 45 ? "risk" : scopeVolatility > 25 ? "warning" : "healthy"
        },
        {
          label: "QA Pressure",
          value: `${qaPressure}%`,
          detail:
            qaPressure > 30
              ? "Review and testing demand exceeded the recommended operating range."
              : "Review workload remained within a manageable threshold.",
          tone: qaPressure > 30 ? "risk" : qaPressure > 18 ? "warning" : "healthy"
        },
        {
          label: "Delivery Confidence",
          value: `${deliveryConfidence}%`,
          detail:
            deliveryConfidence >= 75
              ? "Forecasted stakeholder confidence is strong for release communication."
              : "Confidence remains watchlisted and should stay visible during closeout.",
          tone: deliveryConfidence >= 75 ? "healthy" : deliveryConfidence >= 55 ? "warning" : "risk"
        },
        {
          label: "Bottleneck Detection",
          value: blockedStories ? "Escalated" : qaPressure > 20 ? "Review Cycle" : "Stable Flow",
          detail: blockedStories
            ? "Blocked work and dependencies are the primary sprint constraint."
            : qaPressure > 20
              ? "Review throughput is the slowest-moving phase in this sprint."
              : topOwner
                ? `${topOwner.label} currently holds the highest ownership share at ${topOwner.value}%.`
                : "No major bottleneck signal was detected in the current sprint data.",
          tone: blockedStories ? "risk" : qaPressure > 20 ? "warning" : "healthy"
        }
      ],
      teamHealthRows: [
        {
          label: "Delivery Flow",
          value: completionRate,
          status: completionRate >= 80 ? "Stable" : completionRate >= 60 ? "Medium Load" : "High Load",
          tone: buildTone(completionRate, { healthy: 80, warning: 60 })
        },
        {
          label: "QA Review",
          value: qaPressure,
          status: qaPressure > 30 ? "High Load" : qaPressure > 18 ? "Medium Load" : "Stable",
          tone: qaPressure > 30 ? "risk" : qaPressure > 18 ? "warning" : "healthy"
        },
        {
          label: "Blocker Pressure",
          value: clamp(blockedStories * 18, 0, 100),
          status: blockedStories ? "Elevated" : "Low Risk",
          tone: blockedStories ? "risk" : "healthy"
        },
        {
          label: "Release Readiness",
          value: deliveryConfidence,
          status: deliveryConfidence >= 75 ? "Ready" : deliveryConfidence >= 55 ? "Watch" : "Risk",
          tone: deliveryConfidence >= 75 ? "healthy" : deliveryConfidence >= 55 ? "warning" : "risk"
        }
      ],
      businessImpactRows: [
        {
          label: "Completion change",
          value: formatDelta(completionDelta),
          detail: "Measured against the previous sprint completion rate.",
          tone: completionDelta >= 0 ? "healthy" : "warning"
        },
        {
          label: "Quality load",
          value: bugsCount ? `${bugsCount} active` : "0 active",
          detail: bugsCount ? "Bug-focused work remains visible in the sprint mix." : "No active bug-heavy workload is highlighted.",
          tone: bugsCount > 3 ? "risk" : bugsCount > 0 ? "warning" : "healthy"
        },
        {
          label: "Forecast confidence",
          value: `${deliveryConfidence}%`,
          detail: "Confidence score for executive stakeholder communication.",
          tone: deliveryConfidence >= 75 ? "healthy" : deliveryConfidence >= 55 ? "warning" : "risk"
        },
        {
          label: "Release Stability",
          value: sprint?.healthLabel || "Unknown",
          detail: "Sprint health translated into release-readiness language.",
          tone: healthTone
        }
      ],
      insightCards: insights.slice(0, 3),
      completedWork: stories.filter(isDoneStory).slice(0, 10),
      riskHighlights: deriveRiskHighlights({
        insights,
        blockedStories,
        qaPressure,
        topOwner
      }),
      nextOutlookItems: deriveOutlookItems({
        recommendations: sprint?.recommendations || [],
        blockedStories,
        qaPressure,
        completionRate
      }),
      goalAchievementData: [
        { label: "Achieved", value: goalAchievement, tone: "healthy" },
        { label: "Remaining", value: Math.max(100 - goalAchievement, 0), tone: "default" }
      ],
      metrics: {
        goalAchievement,
        blockedStories,
        completedStories,
        completedStoryPoints
      }
    };
  }, [insights, project, report, sprint, state.recentSprints, stories]);

  const selectedWidget = widgetLayout.find((widget) => widget.id === selectedWidgetId) || widgetLayout[0] || null;
  const visibleWidgetCount = widgetLayout.filter((widget) => widget.visible).length;
  const hiddenWidgetCount = widgetLayout.length - visibleWidgetCount;
  const pageWidgets = PAGE_ORDER.map((page) =>
    widgetLayout.filter((widget) => widget.visible && widget.page === page).sort((left, right) => left.order - right.order)
  );
  const pageSummaries = PAGE_ORDER.map((page, index) => ({
    page,
    label: PAGE_LABELS[page],
    shortLabel: "Report Page",
    description: "Executive summary, headline metrics, delivery analysis, AI insights, completed work, and risks.",
    widgetCount: pageWidgets[index].length
  }));
  const studioStats = [
    {
      label: "Completion",
      value: widgetData.heroKpis.completion.value,
      detail: widgetData.heroKpis.completion.detail,
      tone: widgetData.heroKpis.completion.tone
    },
    {
      label: "Confidence",
      value: widgetData.heroKpis.confidence.value,
      detail: widgetData.heroKpis.confidence.detail,
      tone: widgetData.heroKpis.confidence.tone
    },
    {
      label: "Risk",
      value: widgetData.heroKpis.risk.value,
      detail: widgetData.heroKpis.risk.detail,
      tone: widgetData.heroKpis.risk.tone
    },
    {
      label: "Visible Modules",
      value: String(visibleWidgetCount),
      detail: `${pageSummaries.filter((item) => item.widgetCount > 0).length} pages currently populated`,
      tone: visibleWidgetCount >= 10 ? "healthy" : visibleWidgetCount >= 6 ? "warning" : "default"
    }
  ];
  const selectedWidgetMeta = selectedWidget ? getWidgetById(selectedWidget.id) : null;
  const normalizedSectionQuery = sectionQuery.trim().toLowerCase();
  const filteredWidgetLibrary = WIDGET_LIBRARY.filter((item) => {
    const current = widgetLayout.find((widget) => widget.id === item.id);
    const matchesQuery =
      !normalizedSectionQuery ||
      `${item.label} ${item.type} ${item.description}`.toLowerCase().includes(normalizedSectionQuery);
    const matchesFilter =
      sectionFilter === "all"
        ? true
        : sectionFilter === "active"
          ? Boolean(current?.visible)
          : !current?.visible;

    return matchesQuery && matchesFilter;
  });
  const shareUrl =
    typeof window !== "undefined" && sharingForm.publicSlug
      ? `${window.location.origin}/shared/${sharingForm.publicSlug}`
      : sharingForm.publicSlug
        ? `/shared/${sharingForm.publicSlug}`
        : "";
  const shareStatusLabel =
    sharingForm.mode === "private"
      ? "Private workspace report"
      : sharingForm.mode === "team"
        ? "Workspace-only share mode"
        : sharingForm.mode === "password"
          ? "Password-protected external sharing"
          : "Public stakeholder link";
  const presentationReadiness =
    sprint?.status === "ready" && visibleWidgetCount >= 8
      ? "Presentation ready"
      : sprint?.status === "processing"
        ? "Awaiting AI report generation"
        : "Needs final review";

  async function handleDownload(kind) {
    if (!report?._id || sprint?.status !== "ready") {
      return;
    }

    await openGeneratedAsset(apiGet(`/report/${report._id}/${kind}`), kind === "pdf" ? "pdfUrl" : "wordUrl");
  }

  async function handleAnalyze() {
    if (!sprint?._id) {
      return;
    }

    try {
      setActionState({ busy: true, message: "", error: "" });
      await startSprintAnalysis(sprint._id);
      setActionState({
        busy: false,
        message: "AI analysis started. Report generation is now in progress.",
        error: ""
      });
      setState((current) => ({
        ...current,
        payload: current.payload
          ? {
              ...current.payload,
              sprint: current.payload.sprint
                ? { ...current.payload.sprint, status: "processing" }
                : current.payload.sprint
            }
          : current.payload
      }));
    } catch (error) {
      setActionState({
        busy: false,
        message: "",
        error: error.message || "Unable to start report generation."
      });
    }
  }

  function updateWidget(widgetId, patch) {
    setWidgetLayout((current) =>
      current.map((item) => (item.id === widgetId ? { ...item, ...patch } : item))
    );
  }

  function handleWidgetSizeCycle(widgetId) {
    setWidgetLayout((current) =>
      current.map((item) => {
        if (item.id !== widgetId) return item;
        let nextSize = "small";
        if (item.size === "small") nextSize = "medium";
        else if (item.size === "medium") nextSize = "full";
        return { ...item, size: nextSize };
      })
    );
  }

  function handleWidgetMove(widgetId, direction) {
    setWidgetLayout((current) => moveWidgetByStep(current, widgetId, direction));
  }

  function handleWidgetHide(widgetId) {
    setWidgetLayout((current) =>
      current.map((item) => (item.id === widgetId ? { ...item, visible: false } : item))
    );
    if (selectedWidgetId === widgetId) {
      setSelectedWidgetId("header");
    }
  }

  function handleWidgetToggle(widgetId) {
    const currentWidget = widgetLayout.find((item) => item.id === widgetId);
    if (!currentWidget) {
      return;
    }

    updateWidget(widgetId, { visible: !currentWidget.visible });
    setSelectedWidgetId(widgetId);
  }

  function handleResetLayout() {
    setWidgetLayout(buildWidgetLayout(templatePreset));
    setSelectedWidgetId("header");
  }

  function handlePrintPreview() {
    setViewMode((current) => (current === "edit" ? "print" : "edit"));
  }

  async function handleCopyShareLink() {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLinkCopied(true);
      window.setTimeout(() => setShareLinkCopied(false), 1800);
    } catch (_error) {
      setShareLinkCopied(false);
    }
  }

  async function handleSaveTemplate() {
    if (!templateDraft.name.trim()) {
      setActionState({
        busy: false,
        message: "",
        error: "Template name is required."
      });
      return;
    }

    try {
      setSavingTemplate(true);
      const result = await apiPost("/templates", {
        name: templateDraft.name.trim(),
        description: `${capitalize(templatePreset)} template saved from Report Studio`,
        themeVariant,
        templatePreset,
        widgetLayout,
        scope: templateDraft.scope
      });
      setTemplates((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      setTemplateDraft((current) => ({ ...current, name: "" }));
      setActionState({
        busy: false,
        message: "Template saved to the workspace library.",
        error: ""
      });
    } catch (error) {
      setActionState({
        busy: false,
        message: "",
        error: error.message || "Unable to save template."
      });
    } finally {
      setSavingTemplate(false);
    }
  }

  function handleApplyTemplate(template) {
    if (!template) {
      return;
    }

    setThemeVariant(template.themeVariant || "enterprise");
    setTemplatePreset(template.templatePreset || "executive");
    setWidgetLayout(hydrateStoredLayout(template.widgetLayout || [], template.templatePreset || "executive"));
    setSelectedWidgetId("header");
    setActionState({
      busy: false,
      message: `Applied template: ${template.name}.`,
      error: ""
    });
  }

  async function handleSaveSharing() {
    if (!report?._id) {
      return;
    }

    try {
      setSavingSharing(true);
      const result = await apiPatch(`/report/internal/${report._id}/sharing`, {
        mode: sharingForm.mode,
        publicSlug: sharingForm.publicSlug,
        password: sharingForm.password,
        allowComments: sharingForm.allowComments,
        expiresAt: sharingForm.expiresAt ? new Date(sharingForm.expiresAt).toISOString() : ""
      });
      setState((current) =>
        current.payload
          ? {
              ...current,
              payload: {
                ...current.payload,
                report: {
                  ...current.payload.report,
                  sharing: result?.sharing || current.payload.report?.sharing
                }
              }
            }
          : current
      );
      setSharingForm((current) => ({
        ...current,
        publicSlug: result?.sharing?.publicSlug || current.publicSlug,
        password: "",
        hasPassword: Boolean(result?.sharing?.hasPassword)
      }));
      setActionState({
        busy: false,
        message: "Sharing settings updated.",
        error: ""
      });
    } catch (error) {
      setActionState({
        busy: false,
        message: "",
        error: error.message || "Unable to save sharing settings."
      });
    } finally {
      setSavingSharing(false);
    }
  }

  return (
    <AppShell bare>
      <div className={`report-studio-page report-studio-page-fullscreen mode-${viewMode}`}>
      <nav className="report-studio-navbar" aria-label="Primary">
        <Link href="/app" className="report-studio-navbar-brand" aria-label="SprintView dashboard">
          <SidebarBrandLogo className="report-studio-navbar-brand-mark" title="SprintView" />
          <span className="report-studio-navbar-brand-copy">
            <strong>SprintView</strong>
            <span>Report Studio</span>
          </span>
        </Link>

        <div className="report-studio-navbar-links">
          {STUDIO_NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/app" ? pathname === "/app" : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`report-studio-navbar-link ${isActive ? "is-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="report-studio-navbar-actions">
          <Link href="/reports" className="button-secondary">
            Back to Library
          </Link>
        </div>
      </nav>

      <div className="report-studio-fullscreen-header">
          <div className="report-studio-fullscreen-main">
            <div className="report-studio-fullscreen-copy">
            <div className="premium-breadcrumbs">
              <Link href="/reports">Reports</Link>
              <svg className="separator-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <path d="m9 18 6-6-6-6" />
              </svg>
              {sprint?._id ? (
                <Link href={`/sprints/${sprint._id}`}>{sprint.name || "Sprint details"}</Link>
              ) : (
                <span>Sprint details</span>
              )}
              <svg className="separator-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="current">Layout Studio</span>
            </div>
            <h1>{reportTitle || sprint?.name || "Report builder"}</h1>
            <p className="page-description">
              Full-screen report layout editing with the same section customization, ordering, theme, and print controls.
            </p>
            </div>
            <div className="report-studio-action-stack">
              <div className="premium-action-group report-studio-action-group">
                {sprint?.status !== "ready" ? (
                  <button
                    className="premium-btn premium-btn-primary"
                    onClick={handleAnalyze}
                    disabled={!sprint?._id || sprint?.status === "processing" || actionState.busy}
                  >
                    {sprint?.status === "processing" || actionState.busy ? (
                      <svg className="premium-spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, marginRight: 8 }}>
                        <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                        <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                        <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
                      </svg>
                    )}
                    {sprint?.status === "processing" ? "Generating..." : actionState.busy ? "Starting..." : "Generate AI Report"}
                  </button>
                ) : null}

                <button
                  className="premium-btn premium-btn-secondary"
                  onClick={() => setViewMode((current) => (current === "view" ? "edit" : "view"))}
                >
                  {viewMode === "view" ? "Back to Editor" : "Open Review Mode"}
                </button>

                <button className="premium-btn premium-btn-secondary" onClick={handlePrintPreview}>
                  {viewMode === "print" ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Back to Editor
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Open Print Preview
                    </>
                  )}
                </button>
              </div>

              <div className="premium-action-group report-studio-action-group is-secondary">
                {viewMode === "print" ? (
                  <button className="premium-btn premium-btn-primary" onClick={() => window.print()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Print Report
                  </button>
                ) : null}

                <button
                  className="premium-btn premium-btn-secondary"
                  onClick={() => handleDownload("word")}
                  disabled={!report?._id || sprint?.status !== "ready"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Export Word
                </button>

                <button
                  className="premium-btn premium-btn-secondary"
                  onClick={() => handleDownload("pdf")}
                  disabled={!report?._id || sprint?.status !== "ready"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, marginRight: 6 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 18 15 15" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>
          </div>

        <div className="report-studio-fullscreen-stats">
          {studioStats.map((item) => (
            <article key={item.label} className={`report-builder-command-card tone-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
          <article className="report-builder-command-card">
            <span>Selected section</span>
            <strong>{selectedWidget?.title || "Report Header"}</strong>
            <p>{selectedWidgetMeta?.description || "Choose a section to change title, width, and order."}</p>
          </article>
          <article className="report-builder-command-card">
            <span>Presentation readiness</span>
            <strong>{presentationReadiness}</strong>
            <p>{shareStatusLabel}</p>
          </article>
          <article className={`report-builder-command-card tone-${preferencesStatus === "error" ? "risk" : preferencesStatus === "saved" ? "healthy" : "default"}`}>
            <span>Workspace sync</span>
            <strong>{preferencesStatus === "saving" ? "Saving layout..." : preferencesStatus === "saved" ? "Layout saved" : preferencesStatus === "error" ? "Save failed" : "Ready"}</strong>
            <p>Report theme, preset, and widget layout now persist to the workspace report record.</p>
          </article>
        </div>
      </div>

      {state.error ? <div className="auth-alert">{state.error}</div> : null}
      {actionState.error ? <div className="auth-alert">{actionState.error}</div> : null}
      {actionState.message ? <div className="manual-sprint-success">{actionState.message}</div> : null}

      {sprint?.status === "processing" ? (
        <div className="simple-dashboard-highlight">
          <strong>Report generation is in progress</strong>
          <p>The executive summary, insight cards, and export files will appear here when processing finishes.</p>
        </div>
      ) : null}

      <div className={`report-builder-shell theme-${themeVariant} mode-${viewMode}`}>
        {viewMode === "edit" ? (
          <aside className="report-builder-sidebar">
            <Surface className="premium-sidebar-surface">
              {/* Tab Header Group */}
              <div className="sidebar-tab-header">
                <button
                  type="button"
                  className={`sidebar-tab-btn ${sidebarTab === "setup" ? "is-active" : ""}`}
                  onClick={() => setSidebarTab("setup")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <rect x="3" y="3" width="7" height="9" />
                    <rect x="14" y="3" width="7" height="5" />
                    <rect x="14" y="12" width="7" height="9" />
                    <rect x="3" y="16" width="7" height="5" />
                  </svg>
                  Layout Setup
                </button>
                <button
                  type="button"
                  className={`sidebar-tab-btn ${sidebarTab === "sections" ? "is-active" : ""}`}
                  onClick={() => setSidebarTab("sections")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  Report Sections
                </button>
              </div>

              {/* Tab Content Panels */}
              <div className="sidebar-tab-content">
                {sidebarTab === "setup" ? (
                  <div className="builder-panel-stack animate-fade-in">
                    <p className="tab-pane-description">Choose a preset, refine the report identity, and prepare a clean stakeholder-ready layout.</p>
                    <div className="builder-panel-section">
                      <div className="builder-panel-section-head">
                        <span>Basics</span>
                        <strong>Identity and layout mode</strong>
                      </div>
                      <label className="builder-field">
                        <span>Report title</span>
                        <input
                          value={reportTitle}
                          onChange={(event) => setReportTitle(event.target.value)}
                          placeholder="Q2 Sprint Executive Update"
                        />
                      </label>
                      <label className="builder-field">
                        <span>Template preset</span>
                        <select
                          value={templatePreset}
                          onChange={(event) => {
                            const nextPreset = event.target.value;
                            setTemplatePreset(nextPreset);
                            setWidgetLayout(buildWidgetLayout(nextPreset));
                            setSelectedWidgetId("header");
                          }}
                        >
                          <option value="executive">Executive Sprint Review</option>
                          <option value="health">Engineering Health Report</option>
                          <option value="delivery">Delivery Intelligence Summary</option>
                        </select>
                      </label>
                      <label className="builder-field">
                        <span>Theme variant</span>
                        <select value={themeVariant} onChange={(event) => setThemeVariant(event.target.value)}>
                          <option value="enterprise">Enterprise</option>
                          <option value="minimal">Minimal</option>
                          <option value="print">Print Optimized</option>
                        </select>
                      </label>
                      <div className="builder-option-group">
                        <span>Workspace mode</span>
                        <div className="builder-chip-row">
                          <button
                            type="button"
                            className={`builder-chip ${viewMode === "edit" ? "is-active" : ""}`}
                            onClick={() => setViewMode("edit")}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`builder-chip ${viewMode === "view" ? "is-active" : ""}`}
                            onClick={() => setViewMode("view")}
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            className={`builder-chip ${viewMode === "print" ? "is-active" : ""}`}
                            onClick={() => setViewMode("print")}
                          >
                            Print
                          </button>
                        </div>
                      </div>
                      <div className="builder-inline-actions">
                        <button className="button-secondary" type="button" onClick={handleResetLayout}>
                          Reset Layout
                        </button>
                        <button className="button-secondary" type="button" onClick={handlePrintPreview}>
                          Open Print Preview
                        </button>
                      </div>
                    </div>

                    <div className="builder-panel-section">
                      <div className="builder-panel-section-head">
                        <span>Templates</span>
                        <strong>Save and reuse report layouts</strong>
                      </div>
                      <label className="builder-field">
                        <span>Save current layout as template</span>
                        <input
                          value={templateDraft.name}
                          onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Template name"
                        />
                      </label>
                      <label className="builder-field">
                        <span>Template scope</span>
                        <select
                          value={templateDraft.scope}
                          onChange={(event) => setTemplateDraft((current) => ({ ...current, scope: event.target.value }))}
                        >
                          <option value="workspace">Workspace</option>
                          <option value="private">Private</option>
                        </select>
                      </label>
                      <div className="builder-inline-actions">
                        <button className="button-secondary" type="button" onClick={handleSaveTemplate} disabled={savingTemplate}>
                          {savingTemplate ? "Saving..." : "Save Template"}
                        </button>
                      </div>

                      <div className="builder-page-map">
                        {(templates || []).slice(0, 6).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="builder-page-map-item"
                            onClick={() => handleApplyTemplate(item)}
                          >
                            <div>
                              <span>{capitalize(item.scope)}</span>
                              <strong>{item.name}</strong>
                              <p>{item.description || `${capitalize(item.templatePreset)} • ${capitalize(item.themeVariant)}`}</p>
                            </div>
                            <em>{item.widgetLayout?.length || 0}</em>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="builder-panel-section">
                      <div className="builder-panel-section-head">
                        <span>Sharing</span>
                        <strong>Access control and stakeholder publishing</strong>
                      </div>
                      <label className="builder-field">
                        <span>Sharing mode</span>
                        <select
                          value={sharingForm.mode}
                          onChange={(event) => setSharingForm((current) => ({ ...current, mode: event.target.value }))}
                        >
                          <option value="private">Private</option>
                          <option value="team">Team Only</option>
                          <option value="public">Public Link</option>
                          <option value="password">Password Protected</option>
                        </select>
                      </label>
                      {sharingForm.mode === "public" || sharingForm.mode === "password" ? (
                        <label className="builder-field">
                          <span>Public slug</span>
                          <input
                            value={sharingForm.publicSlug}
                            onChange={(event) => setSharingForm((current) => ({ ...current, publicSlug: event.target.value }))}
                            placeholder="executive-sprint-update"
                          />
                        </label>
                      ) : null}
                      {sharingForm.mode === "team" ? (
                        <p className="builder-inline-note">
                          Team-only sharing stays inside the workspace and does not generate a public link.
                        </p>
                      ) : null}
                      {sharingForm.mode === "password" ? (
                        <label className="builder-field">
                          <span>{sharingForm.hasPassword ? "Replace share password" : "Share password"}</span>
                          <input
                            type="password"
                            value={sharingForm.password}
                            onChange={(event) => setSharingForm((current) => ({ ...current, password: event.target.value }))}
                            placeholder="Enter report password"
                          />
                        </label>
                      ) : null}
                      <label className="builder-field">
                        <span>Access expires at</span>
                        <input
                          type="datetime-local"
                          value={sharingForm.expiresAt}
                          onChange={(event) => setSharingForm((current) => ({ ...current, expiresAt: event.target.value }))}
                        />
                      </label>
                      <label className="builder-field">
                        <span>Annotations & comments</span>
                        <select
                          value={sharingForm.allowComments ? "enabled" : "disabled"}
                          onChange={(event) =>
                            setSharingForm((current) => ({
                              ...current,
                              allowComments: event.target.value === "enabled"
                            }))
                          }
                        >
                          <option value="disabled">Disabled</option>
                          <option value="enabled">Enabled</option>
                        </select>
                      </label>
                      <div className="builder-inline-actions">
                        <button className="button-secondary" type="button" onClick={handleSaveSharing} disabled={savingSharing}>
                          {savingSharing ? "Saving..." : "Save Sharing"}
                        </button>
                        {shareUrl ? (
                          <button className="button-secondary" type="button" onClick={handleCopyShareLink}>
                            {shareLinkCopied ? "Link Copied" : "Copy Share Link"}
                          </button>
                        ) : null}
                      </div>
                      {shareUrl ? (
                        <div className="builder-share-preview">
                          <span>Share preview</span>
                          <code>{shareUrl}</code>
                          <p>Use review mode before sending this link to stakeholders.</p>
                        </div>
                      ) : (
                        <p className="builder-inline-note">Set a public or password-protected share mode to generate a share link.</p>
                      )}
                    </div>

                    <div className="builder-panel-section">
                      <div className="builder-panel-section-head">
                        <span>Navigation</span>
                        <strong>Fast access to the canvas and sections</strong>
                      </div>
                      <div className="builder-shortcut-grid">
                        <article className="builder-shortcut-card">
                          <span>Keyboard shortcuts</span>
                          <strong>`E` edit · `R` review · `P` print</strong>
                          <p>Switch workspace modes without breaking your layout flow.</p>
                        </article>
                        <article className="builder-shortcut-card">
                          <span>Section coverage</span>
                          <strong>{visibleWidgetCount} active · {hiddenWidgetCount} hidden</strong>
                          <p>Keep the report concise by moving low-signal sections out of the active canvas.</p>
                        </article>
                      </div>

                      <div className="builder-page-map">
                        {pageSummaries.map((item) => (
                          <a key={item.page} href={`#report-page-${item.page}`} className="builder-page-map-item">
                            <div>
                              <span>{item.shortLabel}</span>
                              <strong>{item.label.split("·")[1]?.trim() || item.label}</strong>
                              <p>{item.description}</p>
                            </div>
                            <em>{item.widgetCount}</em>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="builder-panel-stack animate-fade-in">
                    <p className="tab-pane-description">Search, activate, and tune sections with a cleaner report operations workflow.</p>
                    <label className="builder-search-field">
                      <span>Search sections</span>
                      <input
                        className="builder-search-input"
                        value={sectionQuery}
                        onChange={(event) => setSectionQuery(event.target.value)}
                        placeholder="Search KPI, AI, table, risk..."
                      />
                    </label>
                    <div className="builder-filter-row">
                      {[
                        { id: "all", label: "All" },
                        { id: "active", label: "Active" },
                        { id: "hidden", label: "Hidden" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`builder-filter-chip ${sectionFilter === item.id ? "is-active" : ""}`}
                          onClick={() => setSectionFilter(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="builder-widget-library">
                      {filteredWidgetLibrary.length ? filteredWidgetLibrary.map((item) => {
                        const current = widgetLayout.find((widget) => widget.id === item.id);
                        const isSelected = selectedWidgetId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`builder-library-item-wrap ${isSelected ? "is-expanded" : ""}`}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              className={`builder-library-item ${isSelected ? "is-selected" : ""}`}
                              onClick={() => setSelectedWidgetId(item.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedWidgetId(item.id);
                                }
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="builder-library-meta">
                                  <span>{item.type}</span>
                                  <span>{current?.page ? `Page ${current.page}` : `Page ${item.defaultPage}`}</span>
                                  {current?.visible ? (
                                    <span className="canvas-widget-status-badge">Active</span>
                                  ) : null}
                                </div>
                                <strong>{item.label}</strong>
                                <p>{item.description}</p>
                              </div>
                            </div>

                            {/* Collapsible Inline Accordion Content */}
                            {isSelected && current && (
                              <div className="accordion-settings-drawer animate-slide-down">
                                <label className="builder-field">
                                  <span>Section Title</span>
                                  <input
                                    value={current.title}
                                    onChange={(event) => updateWidget(current.id, { title: event.target.value })}
                                    placeholder="Custom section title"
                                  />
                                </label>

                                <div className="builder-option-group">
                                  <span>Section Width</span>
                                  <div className="builder-chip-row">
                                    {["small", "medium", "full"].map((size) => (
                                      <button
                                        key={size}
                                        type="button"
                                        className={`builder-chip ${current.size === size ? "is-active" : ""}`}
                                        onClick={() => updateWidget(current.id, { size })}
                                      >
                                        {capitalize(size)}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="builder-option-group">
                                  <span>Assign to Page</span>
                                  <div className="builder-chip-row">
                                    {PAGE_ORDER.map((page) => (
                                      <button
                                        key={page}
                                        type="button"
                                        className={`builder-chip ${current.page === page ? "is-active" : ""}`}
                                        onClick={() => updateWidget(current.id, { page })}
                                      >
                                        Page {page}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="builder-inline-actions">
                                  <button
                                    className="button-secondary"
                                    type="button"
                                    onClick={() => handleWidgetToggle(current.id)}
                                  >
                                    {current.visible ? "Hide Section" : "Show Section"}
                                  </button>
                                  <button className="button-secondary" type="button" onClick={() => setWidgetLayout((curr) => moveWidgetByStep(curr, current.id, "up"))}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, marginRight: 5 }}>
                                      <polyline points="18 15 12 9 6 15" />
                                    </svg>
                                    Move Up
                                  </button>
                                  <button className="button-secondary" type="button" onClick={() => setWidgetLayout((curr) => moveWidgetByStep(curr, current.id, "down"))}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, marginRight: 5 }}>
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                    Move Down
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <article className="builder-library-empty">
                          <strong>No sections match this filter.</strong>
                          <p>Try a different keyword or switch from hidden to active sections.</p>
                        </article>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Surface>
          </aside>
        ) : null}

        <section className="report-builder-canvas">
          <div className="report-builder-canvas-head">
            <div className="report-builder-canvas-title">
              <span>Report layout</span>
              <strong>{reportTitle || "Sprint Report"} · {visibleWidgetCount} active sections across {pageSummaries.length} report pages</strong>
              <p>Use the page map to keep the story clear: summary first, analysis second, actions last.</p>
            </div>
            <div className="report-builder-canvas-pills">
              {pageSummaries.map((item) => (
                <a key={item.page} href={`#report-page-${item.page}`} className="report-builder-canvas-pill">
                  <span>{item.shortLabel}</span>
                  <strong>{item.widgetCount} sections</strong>
                </a>
              ))}
            </div>
          </div>

          {pageWidgets.map((widgets, index) => {
            const page = PAGE_ORDER[index];
            return (
              <div key={page} id={`report-page-${page}`} className={`report-builder-page ${widgets.length ? "" : "is-empty"}`}>
                <div className="report-builder-page-top">
                  <div className="report-builder-page-heading">
                    <span className="builder-section-kicker">Report page</span>
                    <strong>{PAGE_LABELS[page]}</strong>
                    <p>{pageSummaries[index].description}</p>
                  </div>
                  <div className="report-builder-page-meta">
                    <span>{widgets.length} widget{widgets.length === 1 ? "" : "s"}</span>
                    <span>{viewMode === "edit" ? "Reorder sections while editing" : "Layout locked for review"}</span>
                  </div>
                </div>
                <div className="report-widget-grid">
                  {widgets.length ? (
                    widgets.map((widget) => (
                      <WidgetFrame
                        key={widget.id}
                        widget={widget}
                        viewMode={viewMode}
                        selected={selectedWidgetId === widget.id}
                        onSelect={setSelectedWidgetId}
                        onDragStart={setDraggingWidgetId}
                        onDrop={(targetId) => {
                          setWidgetLayout((current) => reorderWidgets(current, draggingWidgetId, targetId));
                          setDraggingWidgetId("");
                        }}
                        onSizeCycle={handleWidgetSizeCycle}
                        onMove={handleWidgetMove}
                        onHide={handleWidgetHide}
                      >
                        <ReportWidgetBody widgetId={widget.id} data={widgetData} />
                      </WidgetFrame>
                    ))
                  ) : (
                    <article className="builder-empty-page">
                      <strong>No sections are on this page yet.</strong>
                      <p>Show a block from the library and assign it to this page.</p>
                    </article>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
      </div>

    </AppShell>
  );
}
