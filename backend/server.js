import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dbPath = path.join(__dirname, "data", "db.json");
const frontendDist = path.join(rootDir, "ctfd-react-frontend", "dist");
const port = Number(process.env.PORT || 4000);
const devOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

function nowIso() {
  return new Date().toISOString();
}

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function ensureAdmin() {
  const db = readDb();
  const existing = db.users.find((user) => user.username === "admin");
  if (existing) return;
  db.users.push({
    id: crypto.randomUUID(),
    username: "admin",
    displayName: "Administrator",
    email: "admin@example.com",
    bio: "Seed admin account",
    passwordHash: hashPassword("Admin123!"),
    isAdmin: true,
    createdAt: nowIso()
  });
  writeDb(db);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  const [salt, hash] = String(storedValue).split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function setCookie(response, name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || "/"}`, `HttpOnly`, `SameSite=Lax`];
  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  response.setHeader("Set-Cookie", segments.join("; "));
}

function clearCookie(response, name) {
  setCookie(response, name, "", { maxAge: 0, expires: new Date(0) });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(text);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function getCurrentUser(request, db = readDb()) {
  const cookies = parseCookies(request);
  const token = cookies.session;
  if (!token) return null;
  const session = db.sessions.find((entry) => entry.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function getUserScore(db, userId) {
  const solvePoints = db.solves.filter((solve) => solve.userId === userId).reduce((total, solve) => total + Number(solve.points || 0), 0);
  const hintPenalty = db.hintUnlocks.filter((hint) => hint.userId === userId).reduce((total, hint) => total + Number(hint.cost || 0), 0);
  return solvePoints - hintPenalty;
}

function listChallengesForUser(db, user) {
  return db.challenges
    .filter((challenge) => challenge.visible !== false)
    .map((challenge) => {
      const solved = !!db.solves.find((solve) => solve.userId === user?.id && solve.challengeId === challenge.id);
      const hintPenalty = db.hintUnlocks.filter((hint) => hint.userId === user?.id && hint.challengeId === challenge.id).reduce((sum, item) => sum + Number(item.cost || 0), 0);
      return {
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        category: challenge.category,
        difficulty: challenge.difficulty,
        points: challenge.points,
        lat: challenge.lat,
        lng: challenge.lng,
        tags: challenge.tags || [],
        solved,
        hintPenalty,
        visible: challenge.visible !== false
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.points - b.points || a.title.localeCompare(b.title));
}

function getChallengeDetail(db, user, challengeId) {
  const challenge = db.challenges.find((item) => item.id === challengeId && item.visible !== false);
  if (!challenge) return null;
  const solved = !!db.solves.find((solve) => solve.userId === user?.id && solve.challengeId === challenge.id);
  const unlockedHintIds = new Set(db.hintUnlocks.filter((entry) => entry.userId === user?.id && entry.challengeId === challenge.id).map((entry) => entry.hintId));
  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    category: challenge.category,
    difficulty: challenge.difficulty,
    points: challenge.points,
    description: challenge.description,
    descriptionHtml: challenge.description,
    lat: challenge.lat,
    lng: challenge.lng,
    tags: challenge.tags || [],
    files: challenge.files || [],
    solved,
    hints: (challenge.hints || []).map((hint) => ({
      id: hint.id,
      title: hint.title,
      cost: hint.cost,
      unlocked: unlockedHintIds.has(hint.id),
      content: unlockedHintIds.has(hint.id) ? hint.content : null,
      contentHtml: unlockedHintIds.has(hint.id) ? hint.content : null
    }))
  };
}

function getAdminChallenge(db, id) {
  return db.challenges.find((challenge) => challenge.id === id) || null;
}

function ensureDefaults(db) {
  if (!db.settings || typeof db.settings !== "object") {
    db.settings = {};
  }
  if (typeof db.settings.siteTitle !== "string") db.settings.siteTitle = "Eesti Attack Map CTF";
  if (typeof db.settings.registrationOpen !== "boolean") db.settings.registrationOpen = true;
  if (typeof db.settings.challengeVisibility !== "string") db.settings.challengeVisibility = "private";
  if (typeof db.settings.accountVisibility !== "string") db.settings.accountVisibility = "public";
  if (typeof db.settings.scoreVisibility !== "string") db.settings.scoreVisibility = "public";
  if (typeof db.settings.registrationVisibility !== "string") {
    db.settings.registrationVisibility = db.settings.registrationOpen ? "public" : "disabled";
  }
  if (typeof db.settings.paused !== "boolean") db.settings.paused = false;
  if (typeof db.settings.registrationCode !== "string") db.settings.registrationCode = "";
  if (typeof db.settings.logoUrl !== "string") db.settings.logoUrl = "";
  if (typeof db.settings.theme !== "string") db.settings.theme = "default";
  if (typeof db.settings.localization !== "string") db.settings.localization = "en";
  if (!Array.isArray(db.settings.customFields)) db.settings.customFields = [];
  if (!Array.isArray(db.settings.scoreboardBrackets)) db.settings.scoreboardBrackets = [];
  if (typeof db.settings.sanitizeHtml !== "boolean") db.settings.sanitizeHtml = true;
  if (typeof db.settings.announcement !== "string") db.settings.announcement = "";
  if (!("startTime" in db.settings)) db.settings.startTime = null;
  if (!("endTime" in db.settings)) db.settings.endTime = null;
  if (!Array.isArray(db.announcements)) db.announcements = [];
  if (!Array.isArray(db.teams)) db.teams = [];
}

function canViewByScope(scope, user) {
  if (scope === "public") return true;
  if (scope === "users") return Boolean(user);
  if (scope === "admins") return Boolean(user?.isAdmin);
  if (scope === "hidden") return Boolean(user?.isAdmin);
  return true;
}

function getTeamScore(db, teamId) {
  return db.users
    .filter((user) => user.teamId === teamId && !user.isAdmin)
    .reduce((sum, user) => sum + getUserScore(db, user.id), 0);
}

function getChallengeAdminStats(db, challengeId) {
  const solves = db.solves.filter((solve) => solve.challengeId === challengeId);
  const submissions = db.submissions.filter((submission) => submission.challengeId === challengeId);
  const wrongSubmissions = submissions.filter((submission) => !submission.correct).length;
  const firstSolve = solves
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] || null;

  return {
    solveCount: solves.length,
    submissionCount: submissions.length,
    incorrectSubmissionCount: wrongSubmissions,
    firstBloodAt: firstSolve?.createdAt || null,
    firstBloodUserId: firstSolve?.userId || null
  };
}

function buildChallengeAdminView(db, challenge) {
  const stats = getChallengeAdminStats(db, challenge.id);
  return {
    ...challenge,
    descriptionHtml: undefined,
    flag: challenge.flag,
    stats
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function matchesApi(pathname) {
  return pathname.startsWith("/api/");
}

function handleCors(request, response) {
  const origin = request.headers.origin;
  if (origin && origin === devOrigin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return true;
  }
  return false;
}

function requireAuth(request, response, db) {
  const user = getCurrentUser(request, db);
  if (!user) {
    sendJson(response, 401, { message: "Login required" });
    return null;
  }
  return user;
}

function requireAdmin(request, response, db) {
  const user = requireAuth(request, response, db);
  if (!user) return null;
  if (!user.isAdmin) {
    sendJson(response, 403, { message: "Admin only" });
    return null;
  }
  return user;
}

async function handleApi(request, response, url) {
  const db = readDb();
  ensureDefaults(db);
  const pathname = url.pathname;
  const user = getCurrentUser(request, db);

  if (request.method === "GET" && pathname === "/api/health") {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && pathname === "/api/settings") {
    const announcements = db.announcements
      .filter((item) => item.visible !== false)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return sendJson(response, 200, { settings: db.settings, announcements });
  }

  if (request.method === "GET" && pathname === "/api/auth/me") {
    const team = user?.teamId ? db.teams.find((item) => item.id === user.teamId) : null;
    return sendJson(response, 200, {
      user: user ? { ...sanitizeUser(user), score: getUserScore(db, user.id), team: team ? { id: team.id, name: team.name } : null } : null
    });
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    if (db.settings.registrationVisibility === "disabled" || !db.settings.registrationOpen) {
      return sendJson(response, 403, { message: "Registration is closed" });
    }
    const body = await readBody(request);
    if (db.settings.registrationCode) {
      const code = String(body.registrationCode || "").trim();
      if (code !== db.settings.registrationCode) {
        return sendJson(response, 403, { message: "Invalid registration code" });
      }
    }
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (username.length < 3) return sendJson(response, 400, { message: "Username must be at least 3 chars" });
    if (password.length < 6) return sendJson(response, 400, { message: "Password must be at least 6 chars" });
    if (db.users.some((item) => item.username === username)) return sendJson(response, 400, { message: "Username already exists" });

    const newUser = {
      id: crypto.randomUUID(),
      username,
      displayName: String(body.displayName || username).trim() || username,
      email: String(body.email || "").trim(),
      bio: "",
      passwordHash: hashPassword(password),
      isAdmin: false,
      createdAt: nowIso()
    };
    db.users.push(newUser);
    const token = crypto.randomBytes(32).toString("hex");
    db.sessions.push({ token, userId: newUser.id, createdAt: nowIso() });
    writeDb(db);
    setCookie(response, "session", token, { maxAge: 60 * 60 * 24 * 7 });
    return sendJson(response, 201, { user: sanitizeUser(newUser) });
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(request);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const matchedUser = db.users.find((item) => item.username === username);
    if (!matchedUser || !verifyPassword(password, matchedUser.passwordHash)) {
      return sendJson(response, 401, { message: "Invalid credentials" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    db.sessions.push({ token, userId: matchedUser.id, createdAt: nowIso() });
    writeDb(db);
    setCookie(response, "session", token, { maxAge: 60 * 60 * 24 * 7 });
    return sendJson(response, 200, { user: sanitizeUser(matchedUser) });
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const cookies = parseCookies(request);
    const token = cookies.session;
    if (token) {
      db.sessions = db.sessions.filter((entry) => entry.token !== token);
      writeDb(db);
    }
    clearCookie(response, "session");
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "PATCH" && pathname === "/api/profile") {
    const current = requireAuth(request, response, db);
    if (!current) return;
    const body = await readBody(request);
    current.displayName = String(body.displayName || current.displayName).trim() || current.displayName;
    current.email = String(body.email || current.email || "").trim();
    current.bio = String(body.bio || current.bio || "").trim();
    if (body.password) {
      if (String(body.password).length < 6) return sendJson(response, 400, { message: "Password must be at least 6 chars" });
      current.passwordHash = hashPassword(String(body.password));
    }
    writeDb(db);
    return sendJson(response, 200, { user: sanitizeUser(current) });
  }

  if (request.method === "GET" && pathname === "/api/challenges") {
    if (db.settings.challengeVisibility === "private" && !user) {
      return sendJson(response, 401, { message: "Login required to view challenges" });
    }
    return sendJson(response, 200, { challenges: listChallengesForUser(db, user) });
  }

  const challengeMatch = pathname.match(/^\/api\/challenges\/([^/]+)$/);
  if (request.method === "GET" && challengeMatch) {
    if (db.settings.challengeVisibility === "private" && !user) {
      return sendJson(response, 401, { message: "Login required to view challenge" });
    }
    const challenge = getChallengeDetail(db, user, challengeMatch[1]);
    if (!challenge) return sendJson(response, 404, { message: "Challenge not found" });
    return sendJson(response, 200, { challenge });
  }

  const submitMatch = pathname.match(/^\/api\/challenges\/([^/]+)\/submit$/);
  if (request.method === "POST" && submitMatch) {
    const current = requireAuth(request, response, db);
    if (!current) return;
    const challenge = getAdminChallenge(db, submitMatch[1]);
    if (!challenge || challenge.visible === false) return sendJson(response, 404, { message: "Challenge not found" });
    if (db.settings.paused && !current.isAdmin) {
      return sendJson(response, 403, { message: "CTF is paused" });
    }
    const body = await readBody(request);
    const submission = String(body.submission || "").trim();
    const alreadySolved = db.solves.find((solve) => solve.userId === current.id && solve.challengeId === challenge.id);
    db.submissions.push({
      id: crypto.randomUUID(),
      userId: current.id,
      challengeId: challenge.id,
      submission,
      createdAt: nowIso(),
      correct: submission === challenge.flag
    });
    if (alreadySolved) {
      writeDb(db);
      return sendJson(response, 200, { status: "already_solved", message: "See challenge on juba lahendatud." });
    }
    if (submission === challenge.flag) {
      db.solves.push({ id: crypto.randomUUID(), userId: current.id, challengeId: challenge.id, points: Number(challenge.points || 0), createdAt: nowIso() });
      writeDb(db);
      return sendJson(response, 200, { status: "correct", message: "Õige flag!" });
    }
    writeDb(db);
    return sendJson(response, 200, { status: "incorrect", message: "Vale flag." });
  }

  const hintMatch = pathname.match(/^\/api\/challenges\/([^/]+)\/hints\/([^/]+)\/unlock$/);
  if (request.method === "POST" && hintMatch) {
    const current = requireAuth(request, response, db);
    if (!current) return;
    const challenge = getAdminChallenge(db, hintMatch[1]);
    if (!challenge) return sendJson(response, 404, { message: "Challenge not found" });
    if (db.settings.paused && !current.isAdmin) {
      return sendJson(response, 403, { message: "CTF is paused" });
    }
    const hint = (challenge.hints || []).find((entry) => entry.id === hintMatch[2]);
    if (!hint) return sendJson(response, 404, { message: "Hint not found" });
    const exists = db.hintUnlocks.find((entry) => entry.userId === current.id && entry.challengeId === challenge.id && entry.hintId === hint.id);
    if (exists) return sendJson(response, 200, { ok: true, message: "Hint on juba avatud." });
    db.hintUnlocks.push({ id: crypto.randomUUID(), userId: current.id, challengeId: challenge.id, hintId: hint.id, cost: Number(hint.cost || 0), createdAt: nowIso() });
    writeDb(db);
    return sendJson(response, 200, { ok: true, message: `Hint avatud (${hint.cost} punkti).` });
  }

  if (request.method === "GET" && pathname === "/api/scoreboard") {
    if (!canViewByScope(db.settings.accountVisibility, user)) {
      return sendJson(response, user ? 403 : 401, { message: "Account visibility restricted" });
    }
    if (!canViewByScope(db.settings.scoreVisibility, user)) {
      return sendJson(response, user ? 403 : 401, { message: "Scoreboard visibility restricted" });
    }
    const entries = db.users
      .filter((entry) => !entry.isAdmin)
      .map((entry) => ({
        userId: entry.id,
        username: entry.username,
        displayName: entry.displayName,
        teamId: entry.teamId || null,
        teamName: entry.teamId ? (db.teams.find((team) => team.id === entry.teamId)?.name || null) : null,
        score: getUserScore(db, entry.id),
        solveCount: db.solves.filter((solve) => solve.userId === entry.id).length,
        hintPenalty: db.hintUnlocks.filter((hint) => hint.userId === entry.id).reduce((sum, hint) => sum + Number(hint.cost || 0), 0)
      }))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));

    const teamEntries = db.teams
      .map((team) => {
        const members = db.users.filter((userItem) => userItem.teamId === team.id && !userItem.isAdmin);
        return {
          teamId: team.id,
          name: team.name,
          memberCount: members.length,
          score: getTeamScore(db, team.id)
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return sendJson(response, 200, { entries, topTen: entries.slice(0, 10), teamEntries });
  }

  if (request.method === "GET" && pathname === "/api/teams") {
    if (!canViewByScope(db.settings.accountVisibility, user)) {
      return sendJson(response, user ? 403 : 401, { message: "Account visibility restricted" });
    }
    const teams = db.teams
      .map((team) => ({
        id: team.id,
        name: team.name,
        bio: team.bio || "",
        memberCount: db.users.filter((userItem) => userItem.teamId === team.id && !userItem.isAdmin).length,
        score: getTeamScore(db, team.id)
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return sendJson(response, 200, { teams });
  }

  if (request.method === "GET" && pathname === "/api/admin/challenges") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    return sendJson(response, 200, {
      challenges: db.challenges.map((challenge) => buildChallengeAdminView(db, challenge))
    });
  }

  if (request.method === "POST" && pathname === "/api/admin/challenges") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const body = await readBody(request);
    if (!body.title || !body.slug || !body.flag) return sendJson(response, 400, { message: "title, slug and flag are required" });
    if (db.challenges.some((challenge) => challenge.slug === body.slug)) return sendJson(response, 400, { message: "Slug already exists" });
    const challenge = {
      id: crypto.randomUUID(),
      title: String(body.title),
      slug: String(body.slug),
      category: String(body.category || "misc"),
      difficulty: String(body.difficulty || "easy"),
      points: Number(body.points || 0),
      description: String(body.description || ""),
      flag: String(body.flag),
      lat: Number(body.lat),
      lng: Number(body.lng),
      tags: Array.isArray(body.tags) ? body.tags : [],
      files: Array.isArray(body.files) ? body.files : [],
      hints: Array.isArray(body.hints) ? body.hints.map((hint) => ({ ...hint, id: hint.id || crypto.randomUUID() })) : [],
      positionLocked: body.positionLocked === true,
      visible: body.visible !== false,
      createdAt: nowIso()
    };
    db.challenges.push(challenge);
    writeDb(db);
    return sendJson(response, 201, { challenge: buildChallengeAdminView(db, challenge) });
  }

  const adminChallengeMatch = pathname.match(/^\/api\/admin\/challenges\/([^/]+)$/);
  if (request.method === "PATCH" && adminChallengeMatch) {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const challenge = getAdminChallenge(db, adminChallengeMatch[1]);
    if (!challenge) return sendJson(response, 404, { message: "Challenge not found" });
    const body = await readBody(request);
    Object.assign(challenge, {
      title: String(body.title ?? challenge.title),
      slug: String(body.slug ?? challenge.slug),
      category: String(body.category ?? challenge.category),
      difficulty: String(body.difficulty ?? challenge.difficulty),
      points: Number(body.points ?? challenge.points),
      description: String(body.description ?? challenge.description),
      flag: String(body.flag ?? challenge.flag),
      lat: Number(body.lat ?? challenge.lat),
      lng: Number(body.lng ?? challenge.lng),
      tags: Array.isArray(body.tags) ? body.tags : challenge.tags,
      files: Array.isArray(body.files) ? body.files : challenge.files,
      hints: Array.isArray(body.hints) ? body.hints.map((hint) => ({ ...hint, id: hint.id || crypto.randomUUID() })) : challenge.hints,
      positionLocked: body.positionLocked !== undefined ? Boolean(body.positionLocked) : Boolean(challenge.positionLocked),
      visible: body.visible !== undefined ? Boolean(body.visible) : challenge.visible
    });
    writeDb(db);
    return sendJson(response, 200, { challenge: buildChallengeAdminView(db, challenge) });
  }

  if (request.method === "DELETE" && adminChallengeMatch) {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const challengeIndex = db.challenges.findIndex((challenge) => challenge.id === adminChallengeMatch[1]);
    if (challengeIndex === -1) return sendJson(response, 404, { message: "Challenge not found" });
    const [challenge] = db.challenges.splice(challengeIndex, 1);
    db.solves = db.solves.filter((solve) => solve.challengeId !== challenge.id);
    db.hintUnlocks = db.hintUnlocks.filter((hint) => hint.challengeId !== challenge.id);
    db.submissions = db.submissions.filter((submission) => submission.challengeId !== challenge.id);
    writeDb(db);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && pathname === "/api/admin/announcements") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const announcements = db.announcements
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return sendJson(response, 200, { announcements });
  }

  if (request.method === "POST" && pathname === "/api/admin/announcements") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const body = await readBody(request);
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!title || !content) return sendJson(response, 400, { message: "title and content are required" });

    const announcement = {
      id: crypto.randomUUID(),
      title,
      content,
      visible: body.visible !== false,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.announcements.push(announcement);
    writeDb(db);
    return sendJson(response, 201, { announcement });
  }

  const adminAnnouncementMatch = pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (request.method === "PATCH" && adminAnnouncementMatch) {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const announcement = db.announcements.find((item) => item.id === adminAnnouncementMatch[1]);
    if (!announcement) return sendJson(response, 404, { message: "Announcement not found" });
    const body = await readBody(request);

    announcement.title = String(body.title ?? announcement.title).trim();
    announcement.content = String(body.content ?? announcement.content).trim();
    announcement.visible = body.visible !== undefined ? Boolean(body.visible) : announcement.visible;
    announcement.updatedAt = nowIso();

    if (!announcement.title || !announcement.content) {
      return sendJson(response, 400, { message: "title and content are required" });
    }

    writeDb(db);
    return sendJson(response, 200, { announcement });
  }

  if (request.method === "DELETE" && adminAnnouncementMatch) {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const announcementIndex = db.announcements.findIndex((item) => item.id === adminAnnouncementMatch[1]);
    if (announcementIndex === -1) return sendJson(response, 404, { message: "Announcement not found" });
    db.announcements.splice(announcementIndex, 1);
    writeDb(db);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "PATCH" && pathname === "/api/admin/settings") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const body = await readBody(request);
    db.settings = {
      ...db.settings,
      siteTitle: body.siteTitle !== undefined ? String(body.siteTitle).trim() || db.settings.siteTitle : db.settings.siteTitle,
      registrationOpen: body.registrationOpen !== undefined ? Boolean(body.registrationOpen) : db.settings.registrationOpen,
      challengeVisibility: body.challengeVisibility !== undefined ? String(body.challengeVisibility) : db.settings.challengeVisibility,
      accountVisibility: body.accountVisibility !== undefined ? String(body.accountVisibility) : db.settings.accountVisibility,
      scoreVisibility: body.scoreVisibility !== undefined ? String(body.scoreVisibility) : db.settings.scoreVisibility,
      registrationVisibility: body.registrationVisibility !== undefined ? String(body.registrationVisibility) : db.settings.registrationVisibility,
      paused: body.paused !== undefined ? Boolean(body.paused) : db.settings.paused,
      registrationCode: body.registrationCode !== undefined ? String(body.registrationCode) : db.settings.registrationCode,
      logoUrl: body.logoUrl !== undefined ? String(body.logoUrl) : db.settings.logoUrl,
      theme: body.theme !== undefined ? String(body.theme) : db.settings.theme,
      localization: body.localization !== undefined ? String(body.localization) : db.settings.localization,
      customFields: Array.isArray(body.customFields) ? body.customFields : db.settings.customFields,
      scoreboardBrackets: Array.isArray(body.scoreboardBrackets) ? body.scoreboardBrackets : db.settings.scoreboardBrackets,
      sanitizeHtml: body.sanitizeHtml !== undefined ? Boolean(body.sanitizeHtml) : db.settings.sanitizeHtml,
      announcement: body.announcement !== undefined ? String(body.announcement) : db.settings.announcement,
      startTime: body.startTime !== undefined ? body.startTime : db.settings.startTime,
      endTime: body.endTime !== undefined ? body.endTime : db.settings.endTime
    };
    writeDb(db);
    return sendJson(response, 200, { settings: db.settings });
  }

  if (request.method === "GET" && pathname === "/api/admin/users") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const users = db.users
      .filter((userItem) => !userItem.isAdmin)
      .map((userItem) => ({
        id: userItem.id,
        username: userItem.username,
        displayName: userItem.displayName,
        teamId: userItem.teamId || null,
        score: getUserScore(db, userItem.id)
      }))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
    return sendJson(response, 200, { users });
  }

  if (request.method === "GET" && pathname === "/api/admin/teams") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const teams = db.teams
      .map((team) => ({
        ...team,
        members: db.users
          .filter((userItem) => userItem.teamId === team.id && !userItem.isAdmin)
          .map((userItem) => ({ id: userItem.id, username: userItem.username, displayName: userItem.displayName }))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return sendJson(response, 200, { teams });
  }

  if (request.method === "POST" && pathname === "/api/admin/teams") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const body = await readBody(request);
    const name = String(body.name || "").trim();
    if (!name) return sendJson(response, 400, { message: "Team name is required" });
    if (db.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      return sendJson(response, 400, { message: "Team name already exists" });
    }
    const team = {
      id: crypto.randomUUID(),
      name,
      bio: String(body.bio || ""),
      createdAt: nowIso()
    };
    db.teams.push(team);
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
    db.users.forEach((userItem) => {
      if (memberIds.includes(userItem.id) && !userItem.isAdmin) {
        userItem.teamId = team.id;
      }
    });
    writeDb(db);
    return sendJson(response, 201, { team });
  }

  const adminTeamMatch = pathname.match(/^\/api\/admin\/teams\/([^/]+)$/);
  if (request.method === "PATCH" && adminTeamMatch) {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const team = db.teams.find((item) => item.id === adminTeamMatch[1]);
    if (!team) return sendJson(response, 404, { message: "Team not found" });
    const body = await readBody(request);
    const nextName = String(body.name ?? team.name).trim();
    if (!nextName) return sendJson(response, 400, { message: "Team name is required" });
    const duplicate = db.teams.find((item) => item.id !== team.id && item.name.toLowerCase() === nextName.toLowerCase());
    if (duplicate) return sendJson(response, 400, { message: "Team name already exists" });

    team.name = nextName;
    team.bio = String(body.bio ?? team.bio ?? "");

    if (Array.isArray(body.memberIds)) {
      const memberSet = new Set(body.memberIds);
      db.users.forEach((userItem) => {
        if (userItem.isAdmin) return;
        if (memberSet.has(userItem.id)) {
          userItem.teamId = team.id;
        } else if (userItem.teamId === team.id) {
          userItem.teamId = null;
        }
      });
    }

    writeDb(db);
    return sendJson(response, 200, { team });
  }

  if (request.method === "DELETE" && adminTeamMatch) {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const teamIndex = db.teams.findIndex((item) => item.id === adminTeamMatch[1]);
    if (teamIndex === -1) return sendJson(response, 404, { message: "Team not found" });
    const [team] = db.teams.splice(teamIndex, 1);
    db.users.forEach((userItem) => {
      if (userItem.teamId === team.id) userItem.teamId = null;
    });
    writeDb(db);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && pathname === "/api/admin/export") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const exported = { ...db, sessions: [] };
    return sendJson(response, 200, { data: exported });
  }

  if (request.method === "POST" && pathname === "/api/admin/import") {
    const current = requireAdmin(request, response, db);
    if (!current) return;
    const body = await readBody(request);
    const incoming = body?.data;
    if (!incoming || typeof incoming !== "object") {
      return sendJson(response, 400, { message: "Invalid import payload" });
    }

    const nextDb = {
      settings: incoming.settings && typeof incoming.settings === "object" ? incoming.settings : {},
      users: Array.isArray(incoming.users) ? incoming.users : [],
      sessions: Array.isArray(incoming.sessions) ? incoming.sessions : [],
      challenges: Array.isArray(incoming.challenges) ? incoming.challenges : [],
      solves: Array.isArray(incoming.solves) ? incoming.solves : [],
      hintUnlocks: Array.isArray(incoming.hintUnlocks) ? incoming.hintUnlocks : [],
      submissions: Array.isArray(incoming.submissions) ? incoming.submissions : [],
      announcements: Array.isArray(incoming.announcements) ? incoming.announcements : [],
      teams: Array.isArray(incoming.teams) ? incoming.teams : []
    };

    ensureDefaults(nextDb);
    writeDb(nextDb);
    return sendJson(response, 200, { ok: true });
  }

  return sendJson(response, 404, { message: "Not found" });
}

function tryServeStatic(request, response, url) {
  if (!fs.existsSync(frontendDist)) return false;
  let filePath = path.join(frontendDist, url.pathname === "/" ? "index.html" : url.pathname);
  if (url.pathname.endsWith("/")) filePath = path.join(frontendDist, url.pathname, "index.html");
  if (!filePath.startsWith(frontendDist)) {
    sendText(response, 403, "Forbidden");
    return true;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml"
    }[ext] || "application/octet-stream";
    sendText(response, 200, fs.readFileSync(filePath), mime);
    return true;
  }
  const indexPath = path.join(frontendDist, "index.html");
  if (fs.existsSync(indexPath)) {
    sendText(response, 200, fs.readFileSync(indexPath), "text/html; charset=utf-8");
    return true;
  }
  return false;
}

ensureAdmin();

const server = http.createServer(async (request, response) => {
  try {
    if (handleCors(request, response)) return;
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (matchesApi(url.pathname)) {
      await handleApi(request, response, url);
      return;
    }
    if (tryServeStatic(request, response, url)) return;
    sendText(response, 200, "Backend is running. Build the frontend to serve the UI.");
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { message: error.message || "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`CTF backend running on http://localhost:${port}`);
});
