const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { readSessionId, writeSessionId, clearSessionId } = require("./session-store.cjs");

test("exam session id survives a reload and can be replaced or cleared", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "athena-session-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.equal(readSessionId(directory), null);
  writeSessionId(directory, "session-one");
  assert.equal(readSessionId(directory), "session-one");
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(path.join(directory, "exam-session.json")).mode & 0o777, 0o600);
  }
  writeSessionId(directory, "session-two");
  assert.equal(readSessionId(directory), "session-two");
  clearSessionId(directory);
  assert.equal(readSessionId(directory), null);
});
