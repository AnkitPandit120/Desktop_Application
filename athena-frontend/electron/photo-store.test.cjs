const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const savePhoto = require("./photo-store.cjs");

test("camera images are validated and saved with unique names", (context) => {
  const directory = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "athena-photo-")), "camera-feed");
  context.after(() => fs.rmSync(path.dirname(directory), { recursive: true, force: true }));
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";

  const first = savePhoto(png, directory);
  const second = savePhoto(png, directory);
  assert.notEqual(first, second);
  assert.equal(fs.readFileSync(first).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(first).mode & 0o777, 0o600);
  }
  assert.throws(() => savePhoto("data:image/png;base64,Zm9v", directory), /invalid or too large/);
  assert.throws(() => savePhoto("data:text/plain;base64,Zm9v", directory), /PNG camera image/);
});
