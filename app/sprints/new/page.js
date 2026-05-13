"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/ui";
import { apiPost } from "@/lib/api";
import {
  buildRiskPreview,
  collectStoryDiagnostics,
  createEmptyForm,
  createStoryRow,
  MANUAL_SPRINT_DRAFT_KEY,
  normalizeUploadRows,
  STORY_STATUSES
} from "@/lib/manual-sprint";
import { notifyShell, refreshShellNotifications } from "@/lib/notifications";

export default function NewSprintPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [form, setForm] = useState(() => ({
    ...createEmptyForm(),
    stories: [createStoryRow()]
  }));

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MANUAL_SPRINT_DRAFT_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") {
        return;
      }

      setForm({
        ...createEmptyForm(),
        ...parsed,
        stories: Array.isArray(parsed.stories) && parsed.stories.length ? parsed.stories.map((story) => createStoryRow(story)) : [createStoryRow()]
      });
      setDraftSavedAt("Restored from local draft");
    } catch (_error) {
      // Ignore invalid local drafts.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(MANUAL_SPRINT_DRAFT_KEY, JSON.stringify(form));
      if (
        form.projectName ||
        form.projectKey ||
        form.sprintName ||
        form.sprintNumber ||
        form.goal ||
        form.startDate ||
        form.endDate ||
        form.stories.some((story) => String(story.name || "").trim())
      ) {
        setDraftSavedAt(`Draft auto-saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      } else {
        setDraftSavedAt("");
      }
    } catch (_error) {
      // Ignore localStorage errors.
    }
  }, [form]);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateStory(id, key, value) {
    setForm((current) => ({
      ...current,
      stories: current.stories.map((story) => {
        if (story.id !== id) {
          return story;
        }

        if (key === "status") {
          return {
            ...story,
            status: value,
            blocked: value === "Blocked" ? true : story.blocked
          };
        }

        return {
          ...story,
          [key]: value
        };
      })
    }));
  }

  function addStoryRow() {
    setForm((current) => ({
      ...current,
      stories: [...current.stories, createStoryRow()]
    }));
  }

  function removeStoryRow(id) {
    setForm((current) => ({
      ...current,
      stories: current.stories.filter((story) => story.id !== id)
    }));
  }

  async function importStoriesFromFile(file) {
    if (!file) {
      return;
    }

    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const stories = normalizeUploadRows(parsedRows);

    if (!stories.length) {
      throw new Error("No valid story rows were found in the uploaded file.");
    }

    setForm((current) => ({
      ...current,
      stories
    }));
    notifyShell({
      type: "success",
      title: "Stories imported",
      message: `${stories.length} stories loaded from ${file.name}.`
    });
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setUploading(true);
      await importStoriesFromFile(file);
    } catch (uploadError) {
      notifyShell({
        type: "error",
        title: "Import failed",
        message: uploadError.message || "Unable to read the uploaded file."
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleStoryDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    try {
      setUploading(true);
      await importStoriesFromFile(file);
    } catch (uploadError) {
      notifyShell({
        type: "error",
        title: "Import failed",
        message: uploadError.message || "Unable to read the uploaded file."
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateSprint(event) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSubmitting(true);

    try {
      const fieldErrors = [];
      if (!form.projectName.trim()) {
        fieldErrors.push("Project name is required.");
      }
      if (!form.sprintName.trim()) {
        fieldErrors.push("Sprint name is required.");
      }
      if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
        fieldErrors.push("End date must be after the start date.");
      }

      const diagnostics = collectStoryDiagnostics(form.stories);
      if (fieldErrors.length || diagnostics.rowsWithIssues || !diagnostics.validStories) {
        throw new Error(fieldErrors[0] || "Resolve story validation issues before creating the sprint.");
      }

      const stories = form.stories
        .filter((story) => String(story.name || "").trim())
        .map((story, index) => ({
          issueKey: `MAN-${index + 1}`,
          name: String(story.name || "").trim(),
          status: STORY_STATUSES.includes(story.status) ? story.status : "To Do",
          assignee: String(story.assignee || "").trim() || "Unassigned",
          storyPoints: Number(story.storyPoints) || 0,
          blocked: Boolean(story.blocked || story.status === "Blocked")
        }));

      const payload = {
        projectName: form.projectName.trim(),
        projectKey: form.projectKey.trim().toUpperCase() || undefined,
        name: form.sprintName.trim(),
        sprintNumber: form.sprintNumber ? Number(form.sprintNumber) : undefined,
        goal: form.goal.trim() || undefined,
        dateRange:
          form.startDate || form.endDate
            ? {
                start: form.startDate ? new Date(`${form.startDate}T00:00:00.000Z`).toISOString() : undefined,
                end: form.endDate ? new Date(`${form.endDate}T00:00:00.000Z`).toISOString() : undefined
              }
            : undefined,
        stories
      };

      const created = await apiPost("/sprints/import", payload);
      const sprintId = created?.sprint?._id;
      window.localStorage.removeItem(MANUAL_SPRINT_DRAFT_KEY);
      notifyShell({
        type: "success",
        title: "Sprint created",
        message: "Opening the sprint workspace..."
      });
      refreshShellNotifications();

      if (sprintId) {
        router.push(`/sprints/${sprintId}`);
        return;
      }

      router.push("/sprints");
    } catch (submitError) {
      notifyShell({
        type: "error",
        title: "Sprint creation failed",
        message: submitError.message || "Unable to create sprint."
      });
    } finally {
      setSubmitting(false);
    }
  }

  const storyDiagnostics = collectStoryDiagnostics(form.stories);
  const snapshot = buildRiskPreview(form.stories);
  const hasDateError = form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate);

  return (
    <AppShell>
      <PageIntro
        eyebrow="Sprint Management"
        title="Create Sprint"
        description="Build the sprint on a full page, import stories in bulk, and save it first. AI analysis still starts only when you trigger it manually."
        actions={
          <Link className="button-secondary" href="/sprints">
            Back to Sprints
          </Link>
        }
      />

      <section className="manual-sprint-page-card">
        <div className="manual-sprint-shell">
          <div className="manual-sprint-topbar">
            <Link className="manual-sprint-back" href="/sprints">
              ← Back to Sprint Registry
            </Link>
            <span className="manual-sprint-helper">AI remains manual until you choose Generate AI.</span>
          </div>

          <div className="manual-sprint-hero">
            <p className="eyebrow">New Sprint</p>
            <h2>Create a sprint without the popup</h2>
            <p>Fill in the sprint details, import or add stories, and review the snapshot before saving the sprint record.</p>
          </div>

          <form className="manual-sprint-form" onSubmit={handleCreateSprint}>
            <div className="manual-sprint-layout">
              <section className="manual-sprint-panel manual-sprint-config-panel">
                <div className="manual-sprint-panel-header">
                  <div>
                    <h3>Sprint Details</h3>
                    <p>Project metadata, sprint timing, and objective framing for the sprint record.</p>
                  </div>
                </div>

                <div className="manual-sprint-section">
                  <span className="manual-sprint-section-label">Project Information</span>
                  <div className="manual-sprint-grid">
                    <div className="settings-field">
                      <label htmlFor="projectName">Project Name</label>
                      <input
                        id="projectName"
                        value={form.projectName}
                        onChange={(event) => updateField("projectName", event.target.value)}
                        placeholder="Platform Operations"
                      />
                      {submitAttempted && !form.projectName.trim() ? <small className="manual-sprint-error">Project name is required.</small> : null}
                    </div>
                    <div className="settings-field">
                      <label htmlFor="projectKey">Project Key</label>
                      <input
                        id="projectKey"
                        className="manual-sprint-key-input"
                        value={form.projectKey}
                        onChange={(event) => updateField("projectKey", event.target.value.toUpperCase())}
                        placeholder="PLAT"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>

                <div className="manual-sprint-section">
                  <span className="manual-sprint-section-label">Sprint Information</span>
                  <div className="manual-sprint-grid">
                    <div className="settings-field">
                      <label htmlFor="sprintName">Sprint Name</label>
                      <input
                        id="sprintName"
                        value={form.sprintName}
                        onChange={(event) => updateField("sprintName", event.target.value)}
                        placeholder="Sprint 24"
                      />
                      {submitAttempted && !form.sprintName.trim() ? <small className="manual-sprint-error">Sprint name is required.</small> : null}
                    </div>
                    <div className="settings-field">
                      <label htmlFor="sprintNumber">Sprint Number</label>
                      <input
                        id="sprintNumber"
                        type="number"
                        min="1"
                        value={form.sprintNumber}
                        onChange={(event) => updateField("sprintNumber", event.target.value)}
                        placeholder="24"
                      />
                    </div>
                  </div>

                  <div className="manual-sprint-grid">
                    <div className="settings-field">
                      <label htmlFor="startDate">Start Date</label>
                      <input id="startDate" type="date" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="endDate">End Date</label>
                      <input id="endDate" type="date" value={form.endDate} onChange={(event) => updateField("endDate", event.target.value)} />
                    </div>
                  </div>
                  {hasDateError ? <small className="manual-sprint-error">End date must be after the start date.</small> : null}

                  <div className="settings-field settings-field-full">
                    <label htmlFor="goal">Sprint Goal</label>
                    <textarea
                      id="goal"
                      rows="5"
                      value={form.goal}
                      onChange={(event) => updateField("goal", event.target.value)}
                      placeholder="Stabilize release readiness and close API validation gaps."
                    />
                    <small className="manual-sprint-helper">Briefly describe the expected sprint outcome.</small>
                  </div>
                </div>
              </section>

              <section className="manual-sprint-panel manual-sprint-stories-panel">
                <div className="manual-sprint-panel-header">
                  <div>
                    <h3>Sprint Stories</h3>
                    <p>Add stories manually or import from CSV/Excel.</p>
                  </div>
                  <button className="button-secondary" type="button" onClick={addStoryRow}>
                    + Add Story
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  id="storiesFile"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="manual-sprint-file-input"
                />

                <button
                  className={`manual-sprint-dropzone ${dragActive ? "is-dragging" : ""}`}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={handleStoryDrop}
                >
                  <strong>Drag & drop CSV or Excel file</strong>
                  <span>or browse files</span>
                  <small>Supported: CSV, XLSX. Required columns: name, status, assignee, points, blocked{uploading ? " • Reading file..." : ""}</small>
                </button>

                <div className="manual-sprint-divider">
                  <span>OR</span>
                </div>

                {storyDiagnostics.rowsWithIssues ? (
                  <div className="manual-sprint-validation-banner">
                    <strong>Validation in progress</strong>
                    <span>
                      {storyDiagnostics.rowsWithIssues} rows need attention
                      {storyDiagnostics.duplicateCount ? ` • ${storyDiagnostics.duplicateCount} duplicate signals` : ""}
                    </span>
                  </div>
                ) : null}

                {form.stories.length ? (
                  <div className="manual-sprint-story-table">
                    <div className="manual-sprint-story-head">
                      <span>Story</span>
                      <span>Status</span>
                      <span>Assignee</span>
                      <span>Points</span>
                      <span>Blocked</span>
                      <span></span>
                    </div>

                    <div className="manual-sprint-story-body">
                      {form.stories.map((story) => (
                        <div key={story.id} className="manual-sprint-story-card">
                          <div className="manual-sprint-story-row">
                            <div className="manual-sprint-story-field manual-sprint-story-name">
                              <input
                                value={story.name}
                                onChange={(event) => updateStory(story.id, "name", event.target.value)}
                                placeholder="Validate payment API"
                              />
                            </div>

                            <div className={`manual-sprint-story-field manual-sprint-status-field status-${String(story.status || "todo").toLowerCase().replace(/\s+/g, "-")}`}>
                              <select value={story.status} onChange={(event) => updateStory(story.id, "status", event.target.value)}>
                                {STORY_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="manual-sprint-story-field">
                              <input
                                value={story.assignee}
                                onChange={(event) => updateStory(story.id, "assignee", event.target.value)}
                                placeholder="Arun"
                              />
                            </div>

                            <div className="manual-sprint-story-field manual-sprint-story-points">
                              <input
                                type="number"
                                min="0"
                                value={story.storyPoints}
                                onChange={(event) => updateStory(story.id, "storyPoints", event.target.value)}
                                placeholder="5"
                              />
                            </div>

                            <label className="manual-sprint-story-toggle">
                              <input type="checkbox" checked={story.blocked} onChange={(event) => updateStory(story.id, "blocked", event.target.checked)} />
                              <span>{story.blocked ? "Yes" : "No"}</span>
                            </label>

                            <button className="manual-sprint-remove" type="button" onClick={() => removeStoryRow(story.id)}>
                              Remove
                            </button>
                          </div>

                          {storyDiagnostics.rowErrors[story.id]?.length ? (
                            <div className="manual-sprint-row-errors">
                              {storyDiagnostics.rowErrors[story.id].map((message) => (
                                <span key={`${story.id}-${message}`}>{message}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="manual-sprint-empty">
                    <strong>No sprint stories yet</strong>
                    <p>Add stories manually or import a file to create the sprint.</p>
                    <button className="button-secondary" type="button" onClick={addStoryRow}>
                      + Add Story
                    </button>
                  </div>
                )}

                <div className="manual-sprint-snapshot-card">
                  <div className="manual-sprint-snapshot-header">
                    <div>
                      <h4>Sprint Snapshot</h4>
                      <p>Auto-detect sprint risk before creation.</p>
                    </div>
                    <span className={`manual-sprint-risk-pill risk-${snapshot.risk.toLowerCase()}`}>{snapshot.risk} Risk</span>
                  </div>

                  <div className="manual-sprint-snapshot-grid">
                    <div>
                      <span>Stories</span>
                      <strong>{snapshot.storyCount}</strong>
                    </div>
                    <div>
                      <span>Total Points</span>
                      <strong>{snapshot.totalPoints}</strong>
                    </div>
                    <div>
                      <span>Blocked</span>
                      <strong>{snapshot.blockedCount}</strong>
                    </div>
                    <div>
                      <span>Health Prediction</span>
                      <strong>{snapshot.healthPrediction ? `${snapshot.healthPrediction}%` : "—"}</strong>
                    </div>
                  </div>

                  <p className="manual-sprint-snapshot-note">{snapshot.note}</p>
                </div>
              </section>
            </div>

            <div className="manual-sprint-footer">
              <div className="manual-sprint-footer-note">{draftSavedAt || "Draft auto-saved locally"} • Saving the sprint does not start AI automatically.</div>
              <div className="manual-sprint-footer-actions">
                <Link className="button-secondary" href="/sprints">
                  Cancel
                </Link>
                <button className="manual-sprint-submit" type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Sprint"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
