"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { ConfirmDialog, DataTable, MetricCard, PageIntro, StatusPill, Surface } from "@/components/ui";
import { apiDelete, apiGet, startSprintAnalysis } from "@/lib/api";
import { notifyShell, refreshShellNotifications } from "@/lib/notifications";
import { formatDate } from "@/lib/view-models";

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

export default function SprintsPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [analyzingSprintId, setAnalyzingSprintId] = useState("");

  async function load() {
    try {
      setLoading(true);
      const result = await apiGet("/sprints?limit=20&sortBy=createdAt&sortOrder=desc");
      setRows(result?.items || []);
      setPagination(result?.pagination || null);
    } catch (loadError) {
      notifyShell({
        type: "error",
        title: "Sprint loading failed",
        message: loadError.message || "Unable to load sprints."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAnalyze(id) {
    try {
      setAnalyzingSprintId(id);
      await startSprintAnalysis(id);
      notifyShell({
        type: "success",
        title: "AI analysis started",
        message: "Insights and report generation are now in progress."
      });
      refreshShellNotifications();
      await load();
    } catch (analyzeError) {
      notifyShell({
        type: "error",
        title: "Unable to start AI",
        message: analyzeError.message || "Unable to start AI analysis."
      });
    } finally {
      setAnalyzingSprintId("");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget?._id) {
      return;
    }

    try {
      setDeleteBusy(true);
      await apiDelete(`/sprints/${deleteTarget._id}/delete`);
      notifyShell({
        type: "success",
        title: "Sprint deleted",
        message: `${deleteTarget.name || "Sprint"} was removed successfully.`
      });
      setDeleteTarget(null);
      refreshShellNotifications();
      await load();
    } catch (deleteError) {
      notifyShell({
        type: "error",
        title: "Delete failed",
        message: deleteError.message || "Unable to delete sprint."
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  const columns = [
    {
      key: "name",
      label: "Sprint",
      render: (row) => (
        <Link className="sprint-table-link" href={row.sprint?._id ? `/sprints/${row.sprint._id}` : "/sprints"}>
          <span className="table-primary">
            <strong>{row.sprint?.name || "Untitled sprint"}</strong>
            <span>{row.project?.name || "Unassigned project"}</span>
          </span>
        </Link>
      )
    },
    {
      key: "window",
      label: "Date Range",
      render: (row) => formatDateRange(row.sprint?.dateRange)
    },
    {
      key: "stories",
      label: "Stories",
      render: (row) => row.sprint?.metrics?.totalStories || 0
    },
    {
      key: "health",
      label: "Health",
      render: (row) => <strong>{row.sprint?.healthScore || 0}/100</strong>
    },
    {
      key: "completion",
      label: "Completion",
      render: (row) => `${row.sprint?.metrics?.completionRate || 0}%`
    },
    {
      key: "risk",
      label: "Risk",
      render: (row) => <StatusPill tone={sprintTone(row.sprint?.deliveryRisk)}>{row.sprint?.deliveryRisk || "low"}</StatusPill>
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusPill tone={sprintStatusTone(row.sprint?.status)}>{sprintStatusLabel(row.sprint?.status)}</StatusPill>
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="table-actions">
          <Link
            className="table-action table-action-icon"
            href={row.sprint?._id ? `/sprints/${row.sprint._id}` : "/sprints"}
            aria-label="Open sprint"
            title="Open sprint"
          >
            <Icon name="open" className="icon" />
          </Link>
          <button
            className="table-action table-action-icon"
            type="button"
            onClick={() => handleAnalyze(row.sprint?._id)}
            disabled={!row.sprint?._id || row.sprint?.status === "processing" || analyzingSprintId === row.sprint?._id}
            aria-label={
              row.sprint?.status === "processing"
                ? "Sprint analysis in progress"
                : row.sprint?.status === "ready"
                  ? "Re-run AI analysis"
                  : row.sprint?.status === "failed"
                    ? "Retry AI analysis"
                    : "Generate AI analysis"
            }
            title={
              row.sprint?.status === "processing"
                ? "Analysing"
                : row.sprint?.status === "ready"
                  ? "Re-run AI"
                  : row.sprint?.status === "failed"
                    ? "Retry AI"
                    : "Generate AI"
            }
          >
            <Icon name="ai" className="icon" />
          </button>
          <button
            className="table-action table-action-icon is-danger"
            type="button"
            onClick={() => setDeleteTarget(row.sprint)}
            aria-label="Delete sprint"
            title="Delete sprint"
          >
            <Icon name="trash" className="icon" />
          </button>
        </div>
      )
    }
  ];
  const totalSprints = rows.length;
  const readySprints = rows.filter((row) => row.sprint?.status === "ready").length;
  const processingSprints = rows.filter((row) => row.sprint?.status === "processing").length;
  const averageHealth = totalSprints ? Math.round(rows.reduce((sum, row) => sum + Number(row.sprint?.healthScore || 0), 0) / totalSprints) : 0;

  return (
    <AppShell>
      <div className="management-page-shell">
        <PageIntro
          eyebrow="Sprint Management"
          title="Sprints"
          description="Create sprints on a dedicated page, review the scope, and only start AI analysis when you want insights and report generation."
          actions={
            <>
              <button className="button-secondary" onClick={load}>
                Refresh
              </button>
              <Link className="button" href="/sprints/new">
                Create New Sprint
              </Link>
            </>
          }
        />

        <section className="surface-grid metrics">
          <MetricCard label="Total Sprints" value={String(totalSprints)} detail="Visible in this workspace" tone="default" />
          <MetricCard label="Ready" value={String(readySprints)} detail="Reports available for review" tone="healthy" />
          <MetricCard label="Processing" value={String(processingSprints)} detail="AI generation in progress" tone={processingSprints ? "warning" : "healthy"} />
          <MetricCard label="Average Health" value={String(averageHealth)} unit="/100" detail="Workspace delivery posture" tone={averageHealth >= 75 ? "healthy" : averageHealth >= 55 ? "warning" : "risk"} />
        </section>

        <Surface
          title="Sprint Registry"
          subtitle="Click any sprint name to open the full details, stories, AI signals, and report status."
        >
          {loading ? (
            <div className="simple-dashboard-empty">
              <strong>Loading sprints</strong>
              <p>Fetching the latest sprint records for this workspace.</p>
            </div>
          ) : rows.length ? (
            <DataTable columns={columns} rows={rows} />
          ) : (
            <div className="simple-dashboard-empty">
              <strong>No sprints yet</strong>
              <p>Create your first sprint on the full page flow to start tracking delivery scope, AI analysis, and reporting readiness.</p>
              <Link className="button" href="/sprints/new">
                Create Your First Sprint
              </Link>
            </div>
          )}
        </Surface>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Sprint"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name} and its related stories, insights, and reports? This action cannot be undone.`
            : ""
        }
        tone="danger"
        confirmLabel="Delete Sprint"
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  );
}
