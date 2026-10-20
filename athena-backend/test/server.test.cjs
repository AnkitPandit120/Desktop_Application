const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "athena-test-"));
process.env.ATHENA_DATA_DIR = dataDir;
const app = require("../server.js");

test("students can complete an exam session", async (context) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => {
    server.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body) => fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const invalidStart = await post("/exam/start", { userId: "", name: "Test" });
  assert.equal(invalidStart.status, 400);

  const started = await post("/exam/start", { userId: "urn-1", name: "Test Student" });
  assert.equal(started.status, 201);
  const { sessionId } = await started.json();
  assert.match(sessionId, /^session-/);

  const question = await fetch(`${baseUrl}/exam/mcq/1`).then((response) => response.json());
  assert.equal(question.correctAnswer, undefined);

  const invalidAnswer = await post("/exam/answer", {
    sessionId,
    questionId: 1,
    selectedAnswer: 99,
  });
  assert.equal(invalidAnswer.status, 400);

  const firstAnswer = await post("/exam/answer", { sessionId, questionId: 1, selectedAnswer: 0 });
  assert.equal(firstAnswer.status, 200);
  assert.deepEqual(
    (({ attempted, correct, wrong }) => ({ attempted, correct, wrong }))(await firstAnswer.json()),
    { attempted: 1, correct: 0, wrong: 1 },
  );

  const changedAnswer = await post("/exam/answer", { sessionId, questionId: 1, selectedAnswer: 1 });
  assert.equal(changedAnswer.status, 200);
  assert.deepEqual(
    (({ attempted, correct, wrong }) => ({ attempted, correct, wrong }))(await changedAnswer.json()),
    { attempted: 1, correct: 1, wrong: 0 },
  );

  const submitted = await post("/exam/submit", { sessionId });
  assert.equal(submitted.status, 200);
  assert.deepEqual((await submitted.json()).result, { attempted: 1, correct: 1, wrong: 0 });

  const submittedAgain = await post("/exam/submit", { sessionId });
  assert.equal(submittedAgain.status, 200);

  const session = await fetch(`${baseUrl}/exam/session/${sessionId}`).then((response) => response.json());
  assert.equal(session.status, "submitted");
  assert.equal(session.answers.length, 1);

  const lateAnswer = await post("/exam/answer", { sessionId, questionId: 2, selectedAnswer: 0 });
  assert.equal(lateAnswer.status, 409);
});
