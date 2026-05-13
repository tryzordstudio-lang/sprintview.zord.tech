"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppLoadingScreen } from "@/components/app-loading-screen";
import { Icon } from "@/components/icons";
import { SidebarBrandLogo } from "@/components/sidebar-brand-logo";
import { apiGet, apiPost } from "@/lib/api";
import { buildNotifications } from "@/lib/view-models";

const navItems = [
  { href: "/app", label: "Dashboard", icon: "dashboard", section: "Overview" },
  { href: "/sprints", label: "Sprints", icon: "sprints", section: "Delivery" },
  { href: "/reports", label: "Reports", icon: "reports", section: "Delivery" },
  { href: "/insights", label: "Insights", icon: "insights", section: "Intelligence" },
  { href: "/analytics", label: "Analytics", icon: "analytics", section: "Intelligence" },
  { href: "/integrations", label: "Integrations", icon: "integrations", section: "Administration" }
];

const bottomNavItem = { href: "/settings", label: "Settings", icon: "settings", section: "Administration" };

function getSearchContext(pathname) {
  if (pathname.startsWith("/sprints")) {
    return {
      scope: "sprints",
      placeholder: "Search sprints...",
      ariaLabel: "Search sprints"
    };
  }

  if (pathname.startsWith("/reports") || pathname.startsWith("/report/")) {
    return {
      scope: "reports",
      placeholder: "Search reports...",
      ariaLabel: "Search reports"
    };
  }

  if (pathname.startsWith("/insights")) {
    return {
      scope: "insights",
      placeholder: "Search insight sprints...",
      ariaLabel: "Search insight sprints"
    };
  }

  if (pathname.startsWith("/analytics")) {
    return {
      scope: "analytics",
      placeholder: "Search sprint analytics...",
      ariaLabel: "Search sprint analytics"
    };
  }

  if (pathname.startsWith("/integrations") || pathname.startsWith("/settings")) {
    return {
      scope: "admin",
      placeholder: "Search admin pages...",
      ariaLabel: "Search admin pages"
    };
  }

  return {
    scope: "overview",
    placeholder: "Search overview...",
    ariaLabel: "Search overview"
  };
}

function buildScopedSearchResults({ scope, sprintEntries = [], reportEntries = [], navEntries = [] }) {
  const sprintMatches = sprintEntries.map((entry, index) => ({
    id: `sprint-${entry.sprint?._id || index}`,
    label: entry.sprint?.name || "Sprint",
    meta: entry.project?.name || "Sprint",
    href: entry.sprint?._id ? `/sprints/${entry.sprint._id}` : "/sprints",
    kind: scope === "insights" ? "Insight Sprint" : scope === "analytics" ? "Analytics Sprint" : "Sprint"
  }));

  const reportMatches = reportEntries.map((entry, index) => ({
    id: `report-${entry.report?._id || index}`,
    label: entry.sprint?.name || "Report",
    meta: entry.project?.name || "Report",
    href: entry.report?._id ? `/reports/${entry.report._id}` : "/reports",
    kind: "Report"
  }));

  switch (scope) {
    case "sprints":
    case "insights":
    case "analytics":
      return sprintMatches;
    case "reports":
      return reportMatches;
    case "admin":
      return navEntries;
    case "overview":
    default:
      return [...sprintMatches, ...reportMatches];
  }
}

function truncateText(value, maxLength) {
  const normalized = String(value || "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function AppShell({ children, requireAuth = true, publicHeader = null, bare = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchShellRef = useRef(null);
  const notificationPanelRef = useRef(null);
  const toastTimersRef = useRef(new Map());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [minimumLoaderComplete, setMinimumLoaderComplete] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [session, setSession] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [shellToasts, setShellToasts] = useState([]);
  const currentItem =
    [...navItems, bottomNavItem].find((item) => item.href === pathname) ||
    [...navItems, bottomNavItem].find((item) => pathname.startsWith(item.href)) ||
    navItems[0];
  const navSections = ["Overview", "Delivery", "Intelligence", "Administration"].map((section) => ({
    section,
    items: navItems.filter((item) => item.section === section)
  }));
  const searchContext = getSearchContext(pathname);

  useEffect(() => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
    setSearchFocused(false);
    setSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    setMinimumLoaderComplete(false);
    const timer = window.setTimeout(() => {
      setMinimumLoaderComplete(true);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchShellRef.current && !searchShellRef.current.contains(event.target)) {
        setSearchFocused(false);
      }

      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) {
        const trigger = event.target.closest?.(".topbar-notification-button");
        if (!trigger) {
          setNotificationsOpen(false);
        }
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSearchFocused(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    function handleShellNotification(event) {
      const detail = event.detail || {};
      if (!detail.message) {
        return;
      }

      const toast = {
        id: detail.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: detail.type || "info",
        title: detail.title || "",
        message: detail.message
      };

      setShellToasts((current) => [...current, toast].slice(-4));

      if (!detail.persist) {
        const timer = window.setTimeout(() => {
          setShellToasts((current) => current.filter((item) => item.id !== toast.id));
          toastTimersRef.current.delete(toast.id);
        }, toast.type === "error" ? 6500 : 4200);

        toastTimersRef.current.set(toast.id, timer);
      }
    }

    window.addEventListener("sprintview:notify", handleShellNotification);

    return () => {
      window.removeEventListener("sprintview:notify", handleShellNotification);
      for (const timer of toastTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!requireAuth) {
      setSessionResolved(true);
      return undefined;
    }

    let active = true;

    async function loadSession() {
      try {
        const result = await apiGet("/users/me");
        if (!active) return;
        setSession(result);
      } catch (error) {
        if (!active) return;
        setSession(null);
        if (error?.status === 401) {
          router.replace("/signin");
        }
      } finally {
        if (active) {
          setSessionResolved(true);
        }
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [requireAuth, router]);

  useEffect(() => {
    if (!requireAuth || !session?.user?.workspaceId) {
      setNotifications([]);
      return undefined;
    }

    let active = true;

    async function loadNotifications() {
      try {
        const [sprintData, reportData] = await Promise.all([
          apiGet("/sprints?limit=6&sortBy=createdAt&sortOrder=desc"),
          apiGet("/report?limit=6&sortBy=updatedAt&sortOrder=desc")
        ]);
        const sprints = (sprintData?.items || []).map((entry) => entry.sprint).filter(Boolean);

        const latestSprintId = sprintData?.items?.[0]?.sprint?._id;
        const latestSprintDetail = latestSprintId ? await apiGet(`/sprints/${latestSprintId}`) : null;

        if (!active) {
          return;
        }

        setNotifications(
          buildNotifications({
            sprints,
            latestSprint: latestSprintDetail?.sprint,
            reports: reportData?.items || []
          })
        );
      } catch (_error) {
        if (!active) {
          return;
        }

        setNotifications([]);
      }
    }

    loadNotifications();
    window.addEventListener("sprintview:notifications-refresh", loadNotifications);

    return () => {
      active = false;
      window.removeEventListener("sprintview:notifications-refresh", loadNotifications);
    };
  }, [requireAuth, session?.user?.workspaceId, pathname]);

  useEffect(() => {
    if (!requireAuth || !session?.user?.workspaceId) {
      setSearchResults([]);
      return undefined;
    }

    let active = true;

    async function loadSearchResults() {
      try {
        const needSprints = ["overview", "sprints", "insights", "analytics"].includes(searchContext.scope);
        const needReports = ["overview", "reports"].includes(searchContext.scope);
        const requests = [
          needSprints ? apiGet("/sprints?limit=8&sortBy=updatedAt&sortOrder=desc") : Promise.resolve(null),
          needReports ? apiGet("/report?limit=8&sortBy=updatedAt&sortOrder=desc") : Promise.resolve(null)
        ];
        const [sprintData, reportData] = await Promise.all(requests);

        if (!active) {
          return;
        }

        const navMatches = [...navItems, bottomNavItem]
          .filter((item) => item.section === "Administration")
          .map((item) => ({
          id: `nav-${item.href}`,
          label: item.label,
          meta: item.section,
          href: item.href,
          kind: "Navigation"
        }));

        setSearchResults(
          buildScopedSearchResults({
            scope: searchContext.scope,
            sprintEntries: sprintData?.items || [],
            reportEntries: reportData?.items || [],
            navEntries: navMatches
          })
        );
      } catch (_error) {
        if (active) {
          setSearchResults(searchContext.scope === "admin" ? [...navItems, bottomNavItem]
            .filter((item) => item.section === "Administration")
            .map((item) => ({
              id: `nav-${item.href}`,
              label: item.label,
              meta: item.section,
              href: item.href,
              kind: "Navigation"
            })) : []);
        }
      }
    }

    loadSearchResults();

    return () => {
      active = false;
    };
  }, [requireAuth, session?.user?.workspaceId, searchContext.scope]);

  if (!minimumLoaderComplete || (requireAuth && !sessionResolved)) {
    return <AppLoadingScreen />;
  }

  if (requireAuth && !session) {
    return null;
  }

  async function handleLogout() {
    try {
      await apiPost("/auth/logout", {});
    } catch (_error) {
      // Keep the redirect behavior deterministic even if the session is already invalid.
    }

    router.push("/signin");
    router.refresh();
  }

  const userName = session?.user?.name || "Account";
  const userDetail = session?.user?.email || "Workspace user";
  const workspaceName = session?.workspace?.name || "Workspace";
  const userNameLabel = truncateText(userName, 18);
  const workspaceLabel = truncateText(workspaceName, 18);
  const hasNotifications = notifications.length > 0;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleSearchResults = normalizedSearchQuery
    ? searchResults
        .filter((item) => `${item.label} ${item.meta} ${item.kind}`.toLowerCase().includes(normalizedSearchQuery))
        .slice(0, 6)
    : searchResults.slice(0, 6);
  const avatarText = workspaceName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SV";

  function handleSearchSubmit(event) {
    event.preventDefault();
    const target = visibleSearchResults[0];
    if (!target?.href) {
      return;
    }

    router.push(target.href);
    setSearchFocused(false);
  }

  if (bare) {
    return (
      <div className="app-shell bare-shell">
        <main className="page-content bare-page-content">{children}</main>
      </div>
    );
  }

  if (publicHeader) {
    return (
      <div className="app-shell public-shell">
        <div className="app-main public-app-main">
          <header className="topbar public-topbar">
            <div className="topbar-inner public-topbar-inner">
              <Link href="/" className="public-topbar-brand" aria-label="SprintView home">
                <SidebarBrandLogo className="public-topbar-brand-mark" />
                <span className="public-topbar-brand-copy">
                  <strong>SprintView</strong>
                  <span>Shared Sprint Report</span>
                </span>
              </Link>

              <div className="public-topbar-copy">
                <span className="public-topbar-kicker">{publicHeader.kicker || "Published report"}</span>
                <strong>{publicHeader.title || "Sprint report"}</strong>
                {publicHeader.meta ? <span>{publicHeader.meta}</span> : null}
              </div>

              <div className="public-topbar-actions">
                {publicHeader.secondaryHref ? (
                  <Link href={publicHeader.secondaryHref} className="button-secondary">
                    {publicHeader.secondaryLabel || "Open Workspace"}
                  </Link>
                ) : null}
                {publicHeader.primaryHref ? (
                  <a
                    href={publicHeader.primaryHref}
                    target={publicHeader.primaryExternal ? "_blank" : undefined}
                    rel={publicHeader.primaryExternal ? "noreferrer" : undefined}
                    className="button"
                  >
                    {publicHeader.primaryLabel || "Download PDF"}
                  </a>
                ) : null}
              </div>
            </div>
          </header>

          <main className="page-content public-page-content">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <button
        className={`sidebar-scrim ${sidebarOpen ? "is-visible" : ""}`}
        aria-label="Close navigation"
        onClick={() => setSidebarOpen(false)}
      />
      <button
        className={`notification-scrim ${notificationsOpen ? "is-visible" : ""}`}
        aria-label="Close notifications"
        onClick={() => setNotificationsOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <SidebarBrandLogo className="sidebar-brand-mark" />
          <div className="sidebar-brand-copy">
            <h1>Spring View</h1>
            <p>By Zord</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navSections.map((group) => (
            <div key={group.section} className="sidebar-nav-group">
              <p className="sidebar-section-title">{group.section}</p>
              <div className="sidebar-nav-list">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${active ? "is-active" : ""}`}
                    >
                      <span className="sidebar-link-icon-wrap">
                        <Icon name={item.icon} className="sidebar-link-icon" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-group">
            <p className="sidebar-section-title">Workspace</p>
            <Link
              href={bottomNavItem.href}
              className={`sidebar-link sidebar-link-bottom ${pathname === bottomNavItem.href ? "is-active" : ""}`}
            >
              <span className="sidebar-link-icon-wrap">
                <Icon name={bottomNavItem.icon} className="sidebar-link-icon" />
              </span>
              <span>{bottomNavItem.label}</span>
            </Link>
          </div>
          <div className="sidebar-footer-group sidebar-footer-utilities">
            <button className="sidebar-link sidebar-link-bottom sidebar-link-button" type="button" onClick={handleLogout}>
              <span className="sidebar-link-icon-wrap">
                <Icon name="logout" className="sidebar-link-icon" />
              </span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-left">
              <button
                className="icon-button mobile-only"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Icon name="menu" className="icon" />
              </button>
              <div className="topbar-context">
                <div className="topbar-title-row">
                  <h2>{currentItem.label}</h2>
                  <span className="topbar-status">Workspace Active</span>
                </div>
              </div>
            </div>

            <div className="topbar-center">
              <form ref={searchShellRef} className="search-shell" onSubmit={handleSearchSubmit}>
                <label className="search-field" aria-label={searchContext.ariaLabel}>
                  <Icon name="search" className="icon" />
                  <input
                    type="search"
                    placeholder={searchContext.placeholder}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearchFocused(false);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </label>
                {searchFocused ? (
                  <div className="search-dropdown" role="listbox" aria-label="Search results">
                    {visibleSearchResults.length ? (
                      visibleSearchResults.map((item) => (
                        <button
                          key={item.id}
                          className="search-result"
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            router.push(item.href);
                            setSearchFocused(false);
                          }}
                        >
                          <strong>{item.label}</strong>
                          <span>{item.kind} • {item.meta}</span>
                        </button>
                      ))
                    ) : (
                      <div className="search-empty">No matching results in this tab.</div>
                    )}
                  </div>
                ) : null}
              </form>
            </div>
            <div className="topbar-actions">
              <button
                className={`icon-button topbar-notification-button ${hasNotifications ? "is-alert" : ""}`}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                aria-controls="notification-panel"
                type="button"
                onClick={() => setNotificationsOpen(true)}
              >
                <Icon name="bell" className="icon" />
                {hasNotifications ? <span className="notification-dot" /> : null}
              </button>
              <button
                className="profile-chip"
                type="button"
                aria-label="Active workspace account"
                title={`${workspaceName} • ${userName} • ${userDetail}`}
              >
                <span className="profile-avatar-shell">
                  <span className="profile-avatar">{avatarText}</span>
                  <span className="profile-status-dot" />
                </span>
                <span className="profile-copy">
                  <strong title={workspaceName}>{workspaceLabel}</strong>
                  <span className="profile-subline" title={`${userName} • ${userDetail}`}>{userNameLabel}</span>
                </span>
              </button>
            </div>
          </div>
        </header>

        {shellToasts.length ? (
          <div className="shell-toast-stack" aria-live="polite" aria-atomic="true">
            {shellToasts.map((toast) => (
              <article key={toast.id} className={`shell-toast tone-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
                <span className="shell-toast-icon">
                  <Icon
                    name={toast.type === "error" ? "alert" : toast.type === "success" ? "check" : "info"}
                    className="icon"
                  />
                </span>
                <div className="shell-toast-copy">
                  {toast.title ? <strong>{toast.title}</strong> : null}
                  <p>{toast.message}</p>
                </div>
                <button
                  className="shell-toast-close"
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => {
                    const timer = toastTimersRef.current.get(toast.id);
                    if (timer) {
                      window.clearTimeout(timer);
                      toastTimersRef.current.delete(toast.id);
                    }
                    setShellToasts((current) => current.filter((item) => item.id !== toast.id));
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </article>
            ))}
          </div>
        ) : null}

        <main className="page-content">{children}</main>
      </div>

      <aside
        ref={notificationPanelRef}
        id="notification-panel"
        className={`notification-panel ${notificationsOpen ? "is-open" : ""}`}
        aria-hidden={!notificationsOpen}
      >
        <div className="notification-panel-header">
          <div>
            <p className="eyebrow">Notifications</p>
            <h3>Recent Activity</h3>
          </div>
          <button
            className="icon-button"
            aria-label="Close notifications"
            type="button"
            onClick={() => setNotificationsOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="notification-panel-body">
          {hasNotifications ? (
            notifications.map((item, index) => (
              <article key={`${item}-${index}`} className="notification-item">
                <span className="notification-item-dot" />
                <div className="notification-item-content">
                  <div>
                    <strong>Platform update</strong>
                    <p>{item}</p>
                  </div>
                  <button
                    className="notification-item-close"
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => setNotifications((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="notification-empty">
              <strong>All caught up</strong>
              <p>There are no new notifications right now.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
