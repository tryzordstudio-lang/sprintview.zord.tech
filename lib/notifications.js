export function notifyShell({ type = "info", title = "", message, persist = false } = {}) {
  if (typeof window === "undefined" || !message) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("sprintview:notify", {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        title,
        message,
        persist
      }
    })
  );
}

export function refreshShellNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("sprintview:notifications-refresh"));
}
