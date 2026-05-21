"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageIntro, Surface } from "@/components/ui";
import { apiGet, apiPatch, apiRequest } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [meta, setMeta] = useState({
    name: "",
    email: "",
    workspaceName: "",
    hasPassword: true,
    role: "viewer"
  });
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    slug: "",
    description: "",
    timezone: "UTC",
    companyName: "",
    companyTagline: "",
    logoUrl: "",
    alertChannel: "email",
    digestWindow: "monday-0900",
    defaultShareMode: "team",
    allowPublicLinks: true
  });
  const [members, setMembers] = useState([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [deleteForm, setDeleteForm] = useState({
    confirmation: "",
    password: ""
  });
  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canManageWorkspace = meta.role === "owner" || meta.role === "admin";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const [session, settings, membersResult] = await Promise.all([
          apiGet("/users/me"),
          apiGet("/settings").catch(() => null),
          apiGet("/users/workspace/members").catch(() => ({ items: [] }))
        ]);
        if (!active) {
          return;
        }

        const providers = session?.user?.authProviders || [];
        setMeta({
          name: session?.user?.name || "Workspace user",
          email: session?.user?.email || "",
          workspaceName: session?.workspace?.name || "Workspace",
          hasPassword: providers.includes("password"),
          role: session?.user?.role || "viewer"
        });
        setWorkspaceForm({
          name: settings?.workspace?.name || session?.workspace?.name || "",
          slug: settings?.workspace?.slug || session?.workspace?.slug || "",
          description: settings?.workspace?.description || session?.workspace?.description || "",
          timezone: settings?.workspace?.timezone || session?.workspace?.timezone || "UTC",
          companyName: settings?.branding?.companyName || session?.workspace?.branding?.companyName || "",
          companyTagline: settings?.branding?.companyTagline || session?.workspace?.branding?.companyTagline || "",
          logoUrl: settings?.branding?.logoUrl || session?.workspace?.branding?.logoUrl || "",
          alertChannel: settings?.notifications?.alertChannel || "email",
          digestWindow: settings?.notifications?.digestWindow || "monday-0900",
          defaultShareMode: settings?.accessControl?.defaultShareMode || session?.workspace?.accessControl?.defaultShareMode || "team",
          allowPublicLinks:
            settings?.accessControl?.allowPublicLinks ?? session?.workspace?.accessControl?.allowPublicLinks ?? true
        });
        setMembers(membersResult?.items || []);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Unable to load account settings.");
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
  }, []);

  function updatePasswordField(key, value) {
    setPasswordForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateDeleteField(key, value) {
    setDeleteForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateWorkspaceField(key, value) {
    setWorkspaceForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleWorkspaceSave(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSavingWorkspace(true);
      await apiPatch("/settings", {
        name: workspaceForm.name,
        slug: workspaceForm.slug,
        description: workspaceForm.description,
        timezone: workspaceForm.timezone,
        branding: {
          companyName: workspaceForm.companyName,
          companyTagline: workspaceForm.companyTagline,
          logoUrl: workspaceForm.logoUrl
        },
        notifications: {
          alertChannel: workspaceForm.alertChannel,
          digestWindow: workspaceForm.digestWindow
        },
        accessControl: {
          defaultShareMode: workspaceForm.defaultShareMode,
          allowPublicLinks: workspaceForm.allowPublicLinks
        }
      });
      setMeta((current) => ({
        ...current,
        workspaceName: workspaceForm.name
      }));
      setSuccess("Workspace settings updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update workspace settings.");
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function handlePasswordSave(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (meta.hasPassword && !passwordForm.currentPassword) {
      setError("Current password is required.");
      return;
    }

    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      setSavingPassword(true);
      await apiPatch("/auth/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      router.replace("/signin");
      router.refresh();
    } catch (saveError) {
      setError(saveError.message || "Unable to update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (deleteForm.confirmation !== "DELETE") {
      setError('Type "DELETE" to confirm account removal.');
      return;
    }

    if (meta.hasPassword && !deleteForm.password) {
      setError("Password is required to delete this account.");
      return;
    }

    try {
      setDeletingAccount(true);
      await apiRequest("/auth/account", {
        method: "DELETE",
        body: {
          confirmation: deleteForm.confirmation,
          password: deleteForm.password
        }
      });
      router.replace("/signin");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <AppShell>
      <PageIntro
        eyebrow="Enterprise Settings"
        title="Settings"
        description="Manage workspace governance, sharing defaults, account access, and lifecycle controls."
      />

      {error ? <div className="auth-alert">{error}</div> : null}
      {success ? <div className="manual-sprint-success">{success}</div> : null}

      <section className="settings-layout">
        <aside className="settings-local-nav">
          <div className="settings-local-nav-card">
            <p className="eyebrow">Account</p>
            <strong>{meta.name || "Workspace user"}</strong>
            <span>{meta.email || "Loading..."}</span>
            <span>{meta.workspaceName || "Workspace"}</span>
            <span>{meta.role ? `${meta.role} role` : "viewer role"}</span>
          </div>

          <nav className="settings-local-nav-list" aria-label="Settings sections">
            <a href="#general" className="settings-local-link is-active">General</a>
            <a href="#workspace" className="settings-local-link">Workspace</a>
            <a href="#members" className="settings-local-link">Members</a>
            <a href="#password" className="settings-local-link">Password</a>
            <a href="#delete-account" className="settings-local-link">Account</a>
          </nav>
        </aside>

        <div className="settings-detail-stack">
          <Surface
            title="Profile"
            subtitle="Current account identity for this workspace."
            className="settings-section"
          >
            <div id="general" className="settings-form-grid">
              <div className="settings-field">
                <label>Name</label>
                <input value={meta.name} disabled />
              </div>
              <div className="settings-field">
                <label>Email</label>
                <input value={meta.email} disabled />
              </div>
              <div className="settings-field settings-field-full">
                <label>Workspace Name</label>
                <input value={meta.workspaceName} disabled />
              </div>
              <div className="settings-field">
                <label>Role</label>
                <input value={meta.role} disabled />
              </div>
            </div>
          </Surface>

          <Surface
            title="Workspace Controls"
            subtitle="Branding, timezone, notifications, and default sharing policy."
            className="settings-section"
          >
            <form id="workspace" className="settings-form-grid" onSubmit={handleWorkspaceSave}>
              <div className="settings-field">
                <label>Workspace Name</label>
                <input
                  value={workspaceForm.name}
                  onChange={(event) => updateWorkspaceField("name", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field">
                <label>Slug</label>
                <input
                  value={workspaceForm.slug}
                  onChange={(event) => updateWorkspaceField("slug", event.target.value.toLowerCase())}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field settings-field-full">
                <label>Description</label>
                <input
                  value={workspaceForm.description}
                  onChange={(event) => updateWorkspaceField("description", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field">
                <label>Timezone</label>
                <input
                  value={workspaceForm.timezone}
                  onChange={(event) => updateWorkspaceField("timezone", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field">
                <label>Default Share Mode</label>
                <select
                  value={workspaceForm.defaultShareMode}
                  onChange={(event) => updateWorkspaceField("defaultShareMode", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                >
                  <option value="private">Private</option>
                  <option value="team">Team</option>
                  <option value="public">Public</option>
                  <option value="password">Password</option>
                </select>
              </div>
              <div className="settings-field">
                <label>Brand Company</label>
                <input
                  value={workspaceForm.companyName}
                  onChange={(event) => updateWorkspaceField("companyName", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field">
                <label>Brand Tagline</label>
                <input
                  value={workspaceForm.companyTagline}
                  onChange={(event) => updateWorkspaceField("companyTagline", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field settings-field-full">
                <label>Logo URL</label>
                <input
                  value={workspaceForm.logoUrl}
                  onChange={(event) => updateWorkspaceField("logoUrl", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                />
              </div>
              <div className="settings-field">
                <label>Alert Channel</label>
                <select
                  value={workspaceForm.alertChannel}
                  onChange={(event) => updateWorkspaceField("alertChannel", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                >
                  <option value="email">Email</option>
                  <option value="slack-email">Slack Email</option>
                  <option value="slack">Slack</option>
                </select>
              </div>
              <div className="settings-field">
                <label>Digest Window</label>
                <select
                  value={workspaceForm.digestWindow}
                  onChange={(event) => updateWorkspaceField("digestWindow", event.target.value)}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                >
                  <option value="monday-0900">Monday 09:00</option>
                  <option value="friday-1600">Friday 16:00</option>
                </select>
              </div>
              <div className="settings-field settings-field-full">
                <label>Public Links</label>
                <select
                  value={workspaceForm.allowPublicLinks ? "enabled" : "disabled"}
                  onChange={(event) => updateWorkspaceField("allowPublicLinks", event.target.value === "enabled")}
                  disabled={loading || savingWorkspace || !canManageWorkspace}
                >
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              {canManageWorkspace ? (
                <div className="settings-actions-bar settings-field-full">
                  <button className="button" type="submit" disabled={loading || savingWorkspace}>
                    {savingWorkspace ? "Saving..." : "Save Workspace Settings"}
                  </button>
                </div>
              ) : null}
            </form>
          </Surface>

          <Surface
            title="Workspace Members"
            subtitle="Current members and access roles for this workspace."
            className="settings-section"
          >
            <div id="members" className="settings-form-grid">
              {(members || []).length ? (
                members.map((member) => (
                  <div key={member.id} className="settings-field settings-field-full">
                    <label>{member.name}</label>
                    <input value={`${member.email} • ${member.role} • ${member.status}`} disabled />
                  </div>
                ))
              ) : (
                <div className="settings-field settings-field-full">
                  <label>Members</label>
                  <input value="No workspace members found." disabled />
                </div>
              )}
            </div>
          </Surface>

          <Surface
            title={meta.hasPassword ? "Password" : "Set Password"}
            subtitle={
              meta.hasPassword
                ? "Update the password used to sign in to this workspace."
                : "This account was created with a provider. Add a password for direct sign-in."
            }
            className="settings-section"
          >
            <form id="password" className="settings-form-grid" onSubmit={handlePasswordSave}>
              {meta.hasPassword ? (
                <div className="settings-field settings-field-full">
                  <label htmlFor="current-password">Current password</label>
                  <input
                    id="current-password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
                    disabled={loading || savingPassword}
                  />
                </div>
              ) : null}

              <div className="settings-field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => updatePasswordField("newPassword", event.target.value)}
                  disabled={loading || savingPassword}
                />
              </div>

              <div className="settings-field">
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
                  disabled={loading || savingPassword}
                />
              </div>

              <div className="settings-actions-bar settings-field-full">
                <button className="button" type="submit" disabled={loading || savingPassword}>
                  {savingPassword ? "Saving..." : meta.hasPassword ? "Update Password" : "Set Password"}
                </button>
              </div>
            </form>
          </Surface>

          <Surface
            title="Delete Account"
            subtitle="This permanently removes your workspace, sprints, reports, stories, insights, and access."
            className="settings-section danger-zone"
          >
            <form id="delete-account" className="settings-form-grid" onSubmit={handleDeleteAccount}>
              <div className="settings-field settings-field-full">
                <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
                <input
                  id="delete-confirmation"
                  value={deleteForm.confirmation}
                  onChange={(event) => updateDeleteField("confirmation", event.target.value.toUpperCase())}
                  placeholder="DELETE"
                  disabled={loading || deletingAccount}
                />
              </div>

              {meta.hasPassword ? (
                <div className="settings-field settings-field-full">
                  <label htmlFor="delete-password">Password</label>
                  <input
                    id="delete-password"
                    type="password"
                    value={deleteForm.password}
                    onChange={(event) => updateDeleteField("password", event.target.value)}
                    disabled={loading || deletingAccount}
                  />
                </div>
              ) : null}

              <div className="settings-actions-bar settings-field-full">
                <button className="danger-button" type="submit" disabled={loading || deletingAccount}>
                  {deletingAccount ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </form>
          </Surface>
        </div>
      </section>
    </AppShell>
  );
}
