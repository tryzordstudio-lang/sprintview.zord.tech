"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Surface, StatusPill } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";

function JiraBrandLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" className="integration-brand-icon" aria-hidden="true">
      <path fill="#fff" d="M0 24C0 10.745 10.745 0 24 0s24 10.745 24 24-10.745 24-24 24S0 37.255 0 24Z" />
      <path fill="#2684FF" d="M34.937 12H23.41a5.203 5.203 0 0 0 5.203 5.203h2.124v2.05a5.203 5.203 0 0 0 5.2 5.2V13a1 1 0 0 0-1-1Z" />
      <path fill="url(#jira-chip-a)" d="M29.233 17.743H17.707a5.203 5.203 0 0 0 5.2 5.2h2.123V25a5.203 5.203 0 0 0 5.203 5.197V18.743a1 1 0 0 0-1-1Z" />
      <path fill="url(#jira-chip-b)" d="M23.527 23.483H12a5.203 5.203 0 0 0 5.203 5.204h2.13v2.05a5.203 5.203 0 0 0 5.194 5.2V24.483a1 1 0 0 0-1-1Z" />
      <defs>
        <linearGradient id="jira-chip-a" x1="27.443" x2="22.57" y1="15.326" y2="20.411" gradientUnits="userSpaceOnUse">
          <stop offset=".18" stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
        <linearGradient id="jira-chip-b" x1="376.829" x2="167.455" y1="349.939" y2="557.146" gradientUnits="userSpaceOnUse">
          <stop offset=".18" stopColor="#0052CC" />
          <stop offset="1" stopColor="#2684FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState({ connected: false, siteName: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingSprints, setLoadingSprints] = useState(false);
  const [importing, setImporting] = useState(false);
  const [boards, setBoards] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const selectedBoard = useMemo(
    () => boards.find((board) => String(board.id) === String(selectedBoardId)) || null,
    [boards, selectedBoardId]
  );

  const heroStats = [
    {
      label: "Connection",
      value: status.connected ? "Active" : "Offline",
      detail: status.connected ? `Linked to ${status.siteName || "Atlassian"}` : "Connect Jira to unlock import actions.",
      tone: status.connected ? "healthy" : "warning"
    },
    {
      label: "Boards",
      value: boards.length || "0",
      detail: boards.length ? "Available for sprint sync." : "Load boards after connecting.",
      tone: boards.length ? "healthy" : "default"
    },
    {
      label: "Sprints",
      value: sprints.length || "0",
      detail: selectedBoard ? `Loaded from ${selectedBoard.name}` : "Select a board to populate sprints.",
      tone: sprints.length ? "healthy" : "default"
    }
  ];

  const journeySteps = [
    {
      step: "01",
      title: "Authenticate",
      detail: "Connect the Atlassian site and keep the session tied to the workspace."
    },
    {
      step: "02",
      title: "Select board",
      detail: "Load boards, choose the active source, and review the sprint list."
    },
    {
      step: "03",
      title: "Import sprint",
      detail: "Map the sprint into SprintView with project metadata and workspace context."
    }
  ];

  function normalizeBoards(values = []) {
    return values.map((board) => ({
      ...board,
      projectName: board.projectName || board.location?.projectName || board.location?.name || board.location?.key || ""
    }));
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await apiGet("/jira/status");
        if (!active) return;
        setStatus(data || { connected: false, siteName: null });
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Unable to load Jira integration status.");
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
  }, []);

  useEffect(() => {
    if (!status.connected || !selectedBoardId) {
      setSprints([]);
      setSelectedSprintId("");
      return undefined;
    }

    let active = true;

    async function loadSprints() {
      try {
        setLoadingSprints(true);
        const result = await apiGet(`/jira/sprints?boardId=${encodeURIComponent(selectedBoardId)}`);
        if (!active) return;
        const nextSprints = result?.values || [];
        setSprints(nextSprints);
        setSelectedSprintId((current) => current || String(nextSprints[0]?.id || ""));
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Unable to load Jira sprints.");
        setSprints([]);
      } finally {
        if (active) setLoadingSprints(false);
      }
    }

    loadSprints();
    return () => {
      active = false;
    };
  }, [selectedBoardId, status.connected]);

  useEffect(() => {
    if (status.connected && !loading && !boards.length && !loadingBoards) {
      handleLoadBoards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected, loading]);

  async function handleLoadBoards() {
    try {
      setLoadingBoards(true);
      setError("");
      setActionMessage("");
      const result = await apiGet("/jira/boards");
      const nextBoards = normalizeBoards(result?.values || []);
      setBoards(nextBoards);
      if (!selectedBoardId && nextBoards.length) {
        setSelectedBoardId(String(nextBoards[0].id));
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load Jira boards.");
    } finally {
      setLoadingBoards(false);
    }
  }

  async function handleConnect() {
    const result = await apiGet("/jira/connect");
    if (result?.authUrl) {
      window.location.href = result.authUrl;
    }
  }

  async function handleImportSprint() {
    if (!selectedBoardId || !selectedSprintId) {
      setError("Select a Jira board and sprint before importing.");
      return;
    }

    try {
      setImporting(true);
      setError("");
      setActionMessage("");
      const imported = await apiPost("/jira/import", {
        boardId: selectedBoardId,
        sprintId: selectedSprintId,
        projectName: projectName.trim() || selectedBoard?.name || "Imported Jira Project",
        projectKey: projectKey.trim() || undefined
      });

      setActionMessage(`Imported ${imported?.sprint?.name || "Jira sprint"} into the workspace.`);
      if (imported?.sprint?._id) {
        router.push(`/sprints/${imported.sprint._id}`);
      }
    } catch (importError) {
      setError(importError.message || "Unable to import the selected Jira sprint.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <section className="integration-page-shell">
        <section className="integration-hero">
          <div className="integration-hero-copy">
            <p className="eyebrow">Connected Systems</p>
            <h2>Integrations</h2>
            <p className="page-description">
              A focused Atlassian-style control surface for connecting Jira, selecting boards, and importing sprints into SprintView with clean spacing.
            </p>

            <div className="integration-hero-actions">
              <button
                className={`integration-action ${status.connected ? "is-connected" : ""}`}
                type="button"
                disabled={status.connected || loading}
                onClick={handleConnect}
              >
                {loading ? "Checking..." : status.connected ? "Connected" : "Connect Jira"}
              </button>
              <button className="button-secondary" type="button" onClick={handleLoadBoards} disabled={!status.connected || loadingBoards}>
                {loadingBoards ? "Loading..." : "Refresh boards"}
              </button>
              <StatusPill tone={status.connected ? "healthy" : "warning"}>{status.connected ? "Workspace linked" : "Not connected"}</StatusPill>
            </div>

            <div className="integration-hero-steps">
              {journeySteps.map((step) => (
                <article key={step.step} className="integration-step-card">
                  <span>{step.step}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="integration-hero-panel">
            <div className="integration-brand-chip integration-brand-chip-large">
              <div className="integration-brand-copy">
                <JiraBrandLogo />
                <div>
                  <strong>Jira Cloud</strong>
                  <span>{status.connected ? `Connected to ${status.siteName || "Atlassian"}` : "Primary sprint import source"}</span>
                </div>
              </div>
              <button
                className={`integration-action ${status.connected ? "is-connected" : ""}`}
                type="button"
                disabled={status.connected || loading}
                onClick={handleConnect}
              >
                {loading ? "Checking..." : status.connected ? "Connected" : "Connect"}
              </button>
            </div>

            <div className="integration-status-grid">
              {heroStats.map((stat) => (
                <MetricCard key={stat.label} {...stat} />
              ))}
            </div>

            <div className="integration-status-note">
              <strong>Operational notes</strong>
              <p>
                Load boards only after connection succeeds. Choose a board, review the sprint list, then import with local project metadata.
              </p>
            </div>
          </div>
        </section>

        {error ? <div className="auth-alert">{error}</div> : null}
        {actionMessage ? <div className="manual-sprint-success">{actionMessage}</div> : null}

        <div className="integration-grid">
          <Surface className="integration-card" title="Board sync" subtitle="Load available boards and choose the sprint source you want to import.">
            <div className="builder-panel-stack integration-stack">
              <div className="builder-inline-actions integration-inline-actions">
                <button className="button-secondary" type="button" onClick={handleLoadBoards} disabled={!status.connected || loadingBoards}>
                  {loadingBoards ? "Loading..." : "Load Boards"}
                </button>
                <StatusPill tone={boards.length ? "healthy" : "default"}>{boards.length ? `${boards.length} boards ready` : "No boards loaded"}</StatusPill>
              </div>

              <label className="builder-field">
                <span>Jira board</span>
                <select
                  value={selectedBoardId}
                  onChange={(event) => setSelectedBoardId(event.target.value)}
                  disabled={!status.connected || loadingBoards || !boards.length}
                >
                  <option value="">{boards.length ? "Select a board" : "Load boards first"}</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name} {board.projectName ? `• ${board.projectName}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="builder-field">
                <span>Jira sprint</span>
                <select
                  value={selectedSprintId}
                  onChange={(event) => setSelectedSprintId(event.target.value)}
                  disabled={!status.connected || loadingSprints || !selectedBoardId}
                >
                  <option value="">{selectedBoardId ? "Select a sprint" : "Choose a board first"}</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                      {sprint.sequence ? ` • #${sprint.sequence}` : ""}
                      {sprint.state ? ` • ${sprint.state}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Surface>

          <Surface className="integration-card" title="Import settings" subtitle="Set the local project identity before creating the sprint workspace.">
            <div className="builder-panel-stack integration-stack">
              <label className="builder-field">
                <span>Project name</span>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Neptune Commerce Platform" />
              </label>
              <label className="builder-field">
                <span>Project key</span>
                <input value={projectKey} onChange={(event) => setProjectKey(event.target.value.toUpperCase())} placeholder="NEP" />
              </label>

              <div className="integration-summary-strip">
                <div>
                  <span>Selected board</span>
                  <strong>{selectedBoard?.name || "None"}</strong>
                </div>
                <div>
                  <span>Selected sprint</span>
                  <strong>{sprints.find((sprint) => String(sprint.id) === String(selectedSprintId))?.name || "None"}</strong>
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="integration-card" title="Import execution" subtitle="Final validation before the sprint is created in SprintView.">
            <div className="integration-import-card">
              <p className="integration-import-copy">
                Keep the connection clean, confirm the sprint context, then import directly into the workspace with project metadata attached.
              </p>
              <div className="integration-import-actions">
                <button
                  className="button"
                  type="button"
                  onClick={handleImportSprint}
                  disabled={!status.connected || importing || !selectedBoardId || !selectedSprintId}
                >
                  {importing ? "Importing..." : "Import Jira Sprint"}
                </button>
                <span className="integration-import-hint">
                  {selectedBoardId && selectedSprintId ? "Ready for import" : "Select board and sprint"}
                </span>
              </div>
            </div>
          </Surface>
        </div>
      </section>
    </AppShell>
  );
}
