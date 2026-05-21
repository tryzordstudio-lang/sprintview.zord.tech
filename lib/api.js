function resolveApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

  if (
    typeof window !== "undefined" &&
    window.location.hostname === "sprintview.zord.tech" &&
    /^https:\/\/api\.zord\.tech\/api\/v1\/?$/i.test(configured)
  ) {
    return "https://api.zord.tech/sprintview/api/v1";
  }

  return configured;
}

export const API_BASE_URL = resolveApiBaseUrl();

function getApiUrl() {
  try {
    return new URL(API_BASE_URL);
  } catch (_error) {
    return null;
  }
}

let refreshPromise = null;

function buildUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function executeRequest(path, options = {}) {
  const {
    body,
    headers = {},
    credentials = "include",
    cache = "no-store",
    skipAuthRefresh = false,
    ...rest
  } = options;
  const requestHeaders = new Headers(headers);

  let payloadBody = body;
  if (body && !(body instanceof FormData) && typeof body !== "string" && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
    payloadBody = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    body: payloadBody,
    headers: requestHeaders,
    credentials,
    cache
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  return {
    response,
    payload,
    skipAuthRefresh,
    credentials
  };
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = executeRequest("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true
    })
      .then(({ response, payload }) => {
        if (!response.ok || payload?.success === false) {
          const error = new Error(payload?.error?.message || payload?.message || "Session refresh failed");
          error.status = response.status;
          error.payload = payload;
          throw error;
        }

        return payload?.data ?? null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const result = await executeRequest(path, options);
  const { response, payload, skipAuthRefresh, credentials } = result;

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    credentials === "include" &&
    !String(path).startsWith("/auth/")
  ) {
    try {
      await refreshSession();
      const retried = await executeRequest(path, { ...options, skipAuthRefresh: true });

      if (!retried.response.ok || retried.payload?.success === false) {
        const error = new Error(retried.payload?.error?.message || retried.payload?.message || "Request failed");
        error.status = retried.response.status;
        error.payload = retried.payload;
        throw error;
      }

      return retried.payload?.data ?? null;
    } catch (_refreshError) {
      // Fall through to the original unauthorized error shape below.
    }
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.error?.message || payload?.message || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload?.data ?? null;
}

export function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: "GET" });
}

export function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "POST", body });
}

export function apiPatch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: "PATCH", body });
}

export function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: "DELETE" });
}

export function resolveAssetUrl(assetUrl) {
  if (!assetUrl) {
    return "";
  }

  const apiUrl = getApiUrl();
  const rawValue = String(assetUrl).trim();

  if (!rawValue) {
    return "";
  }

  try {
    const parsed = new URL(rawValue);
    if (!apiUrl) {
      return parsed.toString();
    }

    const generatedPathIndex = parsed.pathname.indexOf("/generated/");
    if (generatedPathIndex === -1) {
      return parsed.toString();
    }

    const appBasePath = apiUrl.pathname.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    const generatedPath = parsed.pathname.slice(generatedPathIndex);
    return `${apiUrl.origin}${appBasePath}${generatedPath}`;
  } catch (_error) {
    if (!apiUrl) {
      return rawValue;
    }

    const appBasePath = apiUrl.pathname.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    const normalizedPath = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
    return `${apiUrl.origin}${appBasePath}${normalizedPath}`;
  }
}

export async function openGeneratedAsset(assetRequest, urlKey) {
  const popup = typeof window !== "undefined" ? window.open("", "_blank", "noopener,noreferrer") : null;

  try {
    const result = await assetRequest;
    const resolvedUrl = resolveAssetUrl(result?.[urlKey]);

    if (!resolvedUrl) {
      throw new Error("Generated file URL was not returned");
    }

    if (popup) {
      popup.location.replace(resolvedUrl);
    } else if (typeof window !== "undefined") {
      window.location.assign(resolvedUrl);
    }

    return resolvedUrl;
  } catch (error) {
    if (popup) {
      popup.close();
    }

    throw error;
  }
}

export async function startSprintAnalysis(sprintId) {
  try {
    return await apiPost(`/sprints/${sprintId}/analyze`, {});
  } catch (error) {
    if (error?.status !== 404) {
      throw error;
    }

    return apiPost(`/sprints/${sprintId}/retry-ai`, {});
  }
}
