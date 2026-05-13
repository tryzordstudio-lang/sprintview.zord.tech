export const STORY_STATUSES = ["To Do", "In Progress", "Blocked", "Done"];
export const MANUAL_SPRINT_DRAFT_KEY = "sprintview.manual-sprint-draft.v2";

export function createStoryRow(overrides = {}) {
  return {
    id: overrides.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name || "",
    status: overrides.status || "To Do",
    assignee: overrides.assignee || "",
    storyPoints: overrides.storyPoints ?? "",
    blocked: Boolean(overrides.blocked)
  };
}

export function createEmptyForm() {
  return {
    projectName: "",
    projectKey: "",
    sprintName: "",
    sprintNumber: "",
    goal: "",
    startDate: "",
    endDate: "",
    stories: []
  };
}

function normalizeStatus(value) {
  const raw = String(value || "").trim();
  const matched = STORY_STATUSES.find((status) => status.toLowerCase() === raw.toLowerCase());
  return matched || "To Do";
}

export function normalizeUploadRows(rows = []) {
  return rows
    .map((row, index) => {
      const source = row || {};
      const getValue = (...keys) => {
        for (const key of keys) {
          const matchedKey = Object.keys(source).find((item) => item.toLowerCase().replace(/\s+/g, "") === key);
          if (matchedKey && source[matchedKey] !== undefined && source[matchedKey] !== null && source[matchedKey] !== "") {
            return source[matchedKey];
          }
        }
        return "";
      };

      const name = String(getValue("name", "story", "storyname", "summary", "title", "task") || "").trim();
      if (!name) {
        return null;
      }

      const pointsValue = getValue("storypoints", "points", "estimate");
      const numericPoints = Number(pointsValue);

      return createStoryRow({
        id: `upload-${index + 1}`,
        name,
        status: normalizeStatus(getValue("status", "state") || "To Do"),
        assignee: String(getValue("assignee", "owner", "assignedto") || "").trim(),
        storyPoints: Number.isFinite(numericPoints) && numericPoints >= 0 ? String(numericPoints) : "",
        blocked: /^(yes|true|blocked|1)$/i.test(String(getValue("blocked", "isblocked") || "").trim())
      });
    })
    .filter(Boolean);
}

export function collectStoryDiagnostics(stories = []) {
  const counts = new Map();

  for (const story of stories) {
    const name = String(story.name || "").trim().toLowerCase();
    if (name) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  const rowErrors = {};
  let rowsWithIssues = 0;
  let duplicateCount = 0;
  let validStories = 0;

  for (const story of stories) {
    const errors = [];
    const name = String(story.name || "").trim();
    const normalizedName = name.toLowerCase();
    const pointsValue = String(story.storyPoints ?? "").trim();
    const status = String(story.status || "").trim();

    if (!name) {
      errors.push("Story name is required.");
    }

    if (status && !STORY_STATUSES.includes(status)) {
      errors.push("Select a valid status.");
    }

    if (pointsValue !== "") {
      const parsed = Number(pointsValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push("Points must be 0 or greater.");
      }
    }

    if (name && counts.get(normalizedName) > 1) {
      errors.push("Duplicate story name.");
      duplicateCount += 1;
    }

    if (errors.length) {
      rowErrors[story.id] = errors;
      rowsWithIssues += 1;
    } else if (name) {
      validStories += 1;
    }
  }

  return {
    rowErrors,
    rowsWithIssues,
    duplicateCount,
    validStories
  };
}

export function buildRiskPreview(stories = []) {
  const validStories = stories.filter((story) => String(story.name || "").trim());
  const storyCount = validStories.length;
  const totalPoints = validStories.reduce((sum, story) => sum + (Number(story.storyPoints) || 0), 0);
  const blockedCount = validStories.filter((story) => story.blocked || story.status === "Blocked").length;
  const blockedRatio = storyCount ? blockedCount / storyCount : 0;

  let risk = "Low";
  if (blockedCount >= 2 || blockedRatio >= 0.25 || totalPoints >= 40) {
    risk = "High";
  } else if (blockedCount >= 1 || totalPoints >= 20 || storyCount >= 10) {
    risk = "Medium";
  }

  const rawHealth = 92 - blockedCount * 16 - Math.max(0, totalPoints - 30) * 0.55 - Math.max(0, storyCount - 8) * 1.5;
  const healthPrediction = storyCount ? Math.max(48, Math.min(96, Math.round(rawHealth))) : 0;

  let note = "Sprint scope looks balanced for AI analysis.";
  if (risk === "High") {
    note = "Blocked work or scope size suggests elevated delivery risk before analysis.";
  } else if (risk === "Medium") {
    note = "Scope is workable, but one or two signals may affect delivery posture.";
  }

  return {
    storyCount,
    totalPoints,
    blockedCount,
    risk,
    healthPrediction,
    note
  };
}
