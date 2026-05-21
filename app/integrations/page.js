"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusPill, Surface } from "@/components/ui";
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
      <div className="integration-simple-shell">
        {error ? <div className="auth-alert">{error}</div> : null}
        {actionMessage ? <div className="manual-sprint-success">{actionMessage}</div> : null}

        <Surface
          className="integration-simple-card"
          title="Jira Integration"
          subtitle="Connect Jira, load a board, choose a sprint, and import it into SprintView."
        >
          <div className="integration-simple-header">
            <div className="integration-brand-chip">
              <div className="integration-brand-copy">
                <JiraBrandLogo />
                <div>
                  <strong>Jira Cloud</strong>
                  <span>{status.connected ? `Connected to ${status.siteName || "Atlassian"}` : "Not connected yet"}</span>
                </div>
              </div>
              <StatusPill tone={status.connected ? "healthy" : "warning"}>{status.connected ? "Connected" : "Offline"}</StatusPill>
            </div>

            <div className="integration-simple-actions">
              <button
                className={`integration-action ${status.connected ? "is-connected" : ""}`}
                type="button"
                disabled={status.connected || loading}
                onClick={handleConnect}
              >
                {loading ? "Checking..." : status.connected ? "Connected" : "Connect Jira"}
              </button>
              <button className="button-secondary" type="button" onClick={handleLoadBoards} disabled={!status.connected || loadingBoards}>
                {loadingBoards ? "Loading..." : "Load Boards"}
              </button>
            </div>
          </div>

          <div className="builder-panel-stack integration-simple-form">
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

            <div className="integration-simple-grid">
              <label className="builder-field">
                <span>Project name</span>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Neptune Commerce Platform" />
              </label>
              <label className="builder-field">
                <span>Project key</span>
                <input value={projectKey} onChange={(event) => setProjectKey(event.target.value.toUpperCase())} placeholder="NEP" />
              </label>
            </div>

            <div className="integration-simple-footer">
              <div className="integration-simple-summary">
                <span>Selected board</span>
                <strong>{selectedBoard?.name || "None"}</strong>
              </div>
              <div className="integration-simple-summary">
                <span>Selected sprint</span>
                <strong>{sprints.find((sprint) => String(sprint.id) === String(selectedSprintId))?.name || "None"}</strong>
              </div>
              <button
                className="button"
                type="button"
                onClick={handleImportSprint}
                disabled={!status.connected || importing || !selectedBoardId || !selectedSprintId}
              >
                {importing ? "Importing..." : "Import Jira Sprint"}
              </button>
            </div>
          </div>
        </Surface>
      </div>
    </AppShell>
  );
}
