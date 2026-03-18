const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const APP_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

function buildUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : `${APP_BASE}${path}`;
}

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function api(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });

  return parseResponse(response);
}

export const authApi = {
  me: () => api("/api/auth/me"),
  login: (body) => api("/api/auth/login", { method: "POST", body }),
  register: (body) => api("/api/auth/register", { method: "POST", body }),
  logout: () => api("/api/auth/logout", { method: "POST" }),
  updateProfile: (body) => api("/api/profile", { method: "PATCH", body })
};

export const settingsApi = {
  get: () => api("/api/settings")
};

export const challengesApi = {
  list: () => api("/api/challenges"),
  get: (id) => api(`/api/challenges/${id}`),
  submit: (id, submission) => api(`/api/challenges/${id}/submit`, { method: "POST", body: { submission } }),
  unlockHint: (challengeId, hintId) => api(`/api/challenges/${challengeId}/hints/${hintId}/unlock`, { method: "POST" })
};

export const scoreboardApi = {
  get: () => api("/api/scoreboard")
};

export const teamsApi = {
  list: () => api("/api/teams")
};

export const adminApi = {
  challenges: () => api("/api/admin/challenges"),
  createChallenge: (body) => api("/api/admin/challenges", { method: "POST", body }),
  updateChallenge: (id, body) => api(`/api/admin/challenges/${id}`, { method: "PATCH", body }),
  deleteChallenge: (id) => api(`/api/admin/challenges/${id}`, { method: "DELETE" }),
  announcements: () => api("/api/admin/announcements"),
  createAnnouncement: (body) => api("/api/admin/announcements", { method: "POST", body }),
  updateAnnouncement: (id, body) => api(`/api/admin/announcements/${id}`, { method: "PATCH", body }),
  deleteAnnouncement: (id) => api(`/api/admin/announcements/${id}`, { method: "DELETE" }),
  updateSettings: (body) => api("/api/admin/settings", { method: "PATCH", body }),
  exportData: () => api("/api/admin/export"),
  importData: (data) => api("/api/admin/import", { method: "POST", body: { data } }),
  users: () => api("/api/admin/users"),
  teams: () => api("/api/admin/teams"),
  createTeam: (body) => api("/api/admin/teams", { method: "POST", body }),
  updateTeam: (id, body) => api(`/api/admin/teams/${id}`, { method: "PATCH", body }),
  deleteTeam: (id) => api(`/api/admin/teams/${id}`, { method: "DELETE" })
};
