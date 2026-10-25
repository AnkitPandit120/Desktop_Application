const fs = require("node:fs");
const path = require("node:path");

function sessionFile(userData) {
  return path.join(userData, "exam-session.json");
}

function readSessionId(userData) {
  try {
    const value = JSON.parse(fs.readFileSync(sessionFile(userData), "utf8"));
    return typeof value.sessionId === "string" && value.sessionId ? value.sessionId : null;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

function writeSessionId(userData, sessionId) {
  fs.mkdirSync(userData, { recursive: true });
  const target = sessionFile(userData);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ sessionId }), { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function clearSessionId(userData) {
  try {
    fs.unlinkSync(sessionFile(userData));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = { readSessionId, writeSessionId, clearSessionId };
