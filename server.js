const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const RSVP_FILE = path.join(DATA_DIR, "rsvps.json");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "lagoo2026";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "edi-lorena-lagoo-2026-local-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

let writeQueue = Promise.resolve();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sanitizeText(value, maxLength = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, index)),
          decodeURIComponent(part.slice(index + 1))
        ];
      })
  );
}

function hmac(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(username) {
  const payload = {
    sub: username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${hmac(encoded)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) return false;
  const [encoded, signature] = token.split(".");
  const expected = hmac(encoded);
  if (!signature || signature.length !== expected.length) return false;
  const validSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.sub === ADMIN_USER && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies.session);
}

async function readBody(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      throw new Error("Payload prea mare.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(req) {
  const body = await readBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(RSVP_FILE);
  } catch {
    await fs.writeFile(RSVP_FILE, "[]\n", "utf8");
  }
}

async function readRsvps() {
  await ensureDataFile();
  const raw = await fs.readFile(RSVP_FILE, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "") || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

async function writeRsvps(rsvps) {
  await fs.writeFile(RSVP_FILE, `${JSON.stringify(rsvps, null, 2)}\n`, "utf8");
}

function normalizeRsvp(input, existingRsvp = null) {
  const responseType = sanitizeText(input.responseType, 24);
  if (!["attend", "decline"].includes(responseType)) {
    throw new Error("Alegeți o opțiune validă de confirmare.");
  }

  const message = sanitizeText(input.message, 1000);
  const base = {
    id: existingRsvp?.id || crypto.randomUUID(),
    responseType,
    message,
    submittedAt: existingRsvp?.submittedAt || new Date().toISOString()
  };

  if (existingRsvp) {
    base.updatedAt = new Date().toISOString();
  }

  if (responseType === "decline") {
    const firstName = sanitizeText(input.firstName, 80);
    const lastName = sanitizeText(input.lastName, 80);
    if (!firstName || !lastName) {
      throw new Error("Completați prenumele și numele.");
    }
    return {
      ...base,
      guestCount: 0,
      primaryName: `${firstName} ${lastName}`,
      guests: [{ firstName, lastName, menu: "" }]
    };
  }

  const guests = Array.isArray(input.guests) ? input.guests : [];
  if (!guests.length || guests.length > 8) {
    throw new Error("Selectați între 1 și 8 persoane.");
  }

  const normalizedGuests = guests.map((guest, index) => {
    const firstName = sanitizeText(guest.firstName, 80);
    const lastName = sanitizeText(guest.lastName, 80);
    const menu = sanitizeText(guest.menu, 80);
    if (!firstName || !lastName || !menu) {
      throw new Error(`Completați toate câmpurile pentru persoana ${index + 1}.`);
    }
    return { firstName, lastName, menu };
  });

  return {
    ...base,
    guestCount: normalizedGuests.length,
    primaryName: `${normalizedGuests[0].firstName} ${normalizedGuests[0].lastName}`,
    guests: normalizedGuests
  };
}

async function handleLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    if (body.username !== ADMIN_USER || body.password !== ADMIN_PASSWORD) {
      return sendJson(res, 401, { ok: false, message: "Date de autentificare incorecte." });
    }

    const token = createSessionToken(ADMIN_USER);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    });
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
  }
}

function handleLogout(_req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie": "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  });
  res.end(JSON.stringify({ ok: true }));
}

async function handleCreateRsvp(req, res) {
  try {
    const body = await readJsonBody(req);
    const rsvp = normalizeRsvp(body);

    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const rsvps = await readRsvps();
      rsvps.unshift(rsvp);
      await writeRsvps(rsvps);
    });
    await writeQueue;

    sendJson(res, 201, { ok: true, id: rsvp.id });
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
  }
}

async function handleListRsvps(req, res) {
  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { ok: false, message: "Autentificare necesară." });
  }
  const rsvps = await readRsvps();
  sendJson(res, 200, { ok: true, rsvps });
}

async function handleUpdateRsvp(req, res, id) {
  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { ok: false, message: "Autentificare necesară." });
  }

  try {
    const body = await readJsonBody(req);
    let updatedRsvp = null;

    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const rsvps = await readRsvps();
      const index = rsvps.findIndex((rsvp) => rsvp.id === id);
      if (index === -1) {
        throw new Error("Răspunsul nu a fost găsit.");
      }
      updatedRsvp = normalizeRsvp(body, rsvps[index]);
      rsvps[index] = updatedRsvp;
      await writeRsvps(rsvps);
    });
    await writeQueue;

    sendJson(res, 200, { ok: true, rsvp: updatedRsvp });
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
  }
}

async function handleDeleteRsvp(req, res, id) {
  if (!isAuthenticated(req)) {
    return sendJson(res, 401, { ok: false, message: "Autentificare necesară." });
  }

  try {
    let deleted = false;
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      const rsvps = await readRsvps();
      const nextRsvps = rsvps.filter((rsvp) => rsvp.id !== id);
      deleted = nextRsvps.length !== rsvps.length;
      if (!deleted) {
        throw new Error("Răspunsul nu a fost găsit.");
      }
      await writeRsvps(nextRsvps);
    });
    await writeQueue;

    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 400, { ok: false, message: error.message });
  }
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/admin") pathname = "/admin.html";

  const normalized = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!normalized.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const content = await fs.readFile(normalized);
    const ext = path.extname(normalized).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "POST" && requestUrl.pathname === "/api/login") {
      return handleLogin(req, res);
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/logout") {
      return handleLogout(req, res);
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/rsvp") {
      return handleCreateRsvp(req, res);
    }
    if (req.method === "GET" && requestUrl.pathname === "/api/rsvps") {
      return handleListRsvps(req, res);
    }
    const rsvpItemMatch = requestUrl.pathname.match(/^\/api\/rsvps\/([^/]+)$/);
    if (rsvpItemMatch && req.method === "PUT") {
      return handleUpdateRsvp(req, res, decodeURIComponent(rsvpItemMatch[1]));
    }
    if (rsvpItemMatch && req.method === "DELETE") {
      return handleDeleteRsvp(req, res, decodeURIComponent(rsvpItemMatch[1]));
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { ok: false, message: "Metodă neacceptată." });
    }
    return serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { ok: false, message: "A apărut o eroare pe server." });
  }
});

ensureDataFile()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Edi & Lorena invitation running at http://localhost:${PORT}`);
      console.log(`Admin page: http://localhost:${PORT}/admin`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
