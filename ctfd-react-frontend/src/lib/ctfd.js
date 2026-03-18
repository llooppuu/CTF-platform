const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const APP_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

let nonceCache = null;
let bootstrapCache = null;

function buildUrl(path) {
  if (!API_BASE_URL) {
    return `${APP_BASE}${path}`;
  }
  return `${API_BASE_URL}${path}`;
}

async function fetchText(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    ...options
  });
  return response.text();
}

function parseHtml(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

function extractErrorsFromHtml(html) {
  const doc = parseHtml(html);
  return [...doc.querySelectorAll(".alert-danger span")]
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

function extractNonceFromHtml(html) {
  const doc = parseHtml(html);
  const hiddenInput = doc.querySelector('input[name="nonce"]');
  if (hiddenInput?.value) {
    return hiddenInput.value;
  }

  const csrfMatch = html.match(/["']csrfNonce["']\s*:\s*["']([^"']+)["']/);
  return csrfMatch?.[1] || "";
}

function extractUserModeFromHtml(html) {
  const modeMatch = html.match(/["']userMode["']\s*:\s*["']([^"']+)["']/);
  return modeMatch?.[1] || "users";
}

function extractTitleFromHtml(html) {
  const doc = parseHtml(html);
  return doc.querySelector("title")?.textContent?.trim() || "CTFd React";
}

export async function getBootstrapInfo(force = false) {
  if (bootstrapCache && !force) {
    return bootstrapCache;
  }

  const html = await fetchText("/login");
  const info = {
    csrfNonce: extractNonceFromHtml(html),
    userMode: extractUserModeFromHtml(html),
    siteTitle: extractTitleFromHtml(html)
  };

  nonceCache = info.csrfNonce || nonceCache;
  bootstrapCache = info;
  return info;
}

async function getCsrfNonce() {
  if (nonceCache) {
    return nonceCache;
  }
  const info = await getBootstrapInfo();
  nonceCache = info.csrfNonce;
  return nonceCache;
}

async function apiRequest(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const isMutating = method !== "GET";
  const requestHeaders = { ...headers };

  if (body !== undefined && !raw) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (isMutating) {
    const nonce = await getCsrfNonce();
    if (nonce) {
      requestHeaders["CSRF-Token"] = nonce;
    }
  }

  const response = await fetch(buildUrl(path), {
    method,
    credentials: "include",
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : raw
          ? body
          : JSON.stringify(body)
  });

  if ((response.status === 401 || response.status === 403) && (path === "/api/v1/users/me" || path === "/api/v1/teams/me")) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.errors
      ? Object.values(data.errors).flat().join(", ")
      : data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

export async function getCurrentUser() {
  const response = await apiRequest("/api/v1/users/me");
  return response?.data || null;
}

export async function getCurrentTeam() {
  const response = await apiRequest("/api/v1/teams/me");
  return response?.data || null;
}

export async function getChallenges() {
  const response = await apiRequest("/api/v1/challenges");
  return response?.data || [];
}

export async function getChallenge(challengeId) {
  const response = await apiRequest(`/api/v1/challenges/${challengeId}`);
  return response?.data || null;
}

export async function attemptChallenge(challengeId, submission) {
  return apiRequest("/api/v1/challenges/attempt", {
    method: "POST",
    body: {
      challenge_id: challengeId,
      submission
    }
  });
}

export async function getScoreboard() {
  const response = await apiRequest("/api/v1/scoreboard");
  return response?.data || [];
}

export async function updateCurrentUser(payload) {
  const response = await apiRequest("/api/v1/users/me", {
    method: "PATCH",
    body: payload
  });
  return response?.data;
}

export async function updateCurrentTeam(payload) {
  const response = await apiRequest("/api/v1/teams/me", {
    method: "PATCH",
    body: payload
  });
  return response?.data;
}

async function submitForm(path, values) {
  const nonce = await getCsrfNonce();
  const form = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      form.set(key, String(value));
    }
  });

  if (nonce) {
    form.set("nonce", nonce);
  }

  const response = await fetch(buildUrl(path), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const html = await response.text();

  if (response.redirected || !response.url.endsWith(path)) {
    return { success: true, errors: [] };
  }

  return { success: false, errors: extractErrorsFromHtml(html) };
}

export async function login(values) {
  return submitForm("/login", values);
}

export async function register(values) {
  return submitForm("/register", values);
}

export function logout() {
  window.location.assign(buildUrl("/logout"));
}
