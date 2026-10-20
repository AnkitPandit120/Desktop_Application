const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

function createSessionRouter(readQuestions) {
  const router = express.Router();
  const dataDir = process.env.ATHENA_DATA_DIR || path.join(__dirname, "data");
  const sessionsPath = path.join(dataDir, "sessions.json");

  function readSessions() {
    try {
      return JSON.parse(fs.readFileSync(sessionsPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  function saveSessions(sessions) {
    fs.mkdirSync(dataDir, { recursive: true });
    const temporaryPath = path.join(dataDir, `sessions-${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(temporaryPath, JSON.stringify(sessions, null, 2));
    fs.renameSync(temporaryPath, sessionsPath);
  }

  function resultFor(session) {
    return {
      attempted: session.attempted,
      correct: session.correct,
      wrong: session.wrong,
    };
  }

  router.post("/start", (request, response) => {
    const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
    const userId = typeof request.body?.userId === "string" ? request.body.userId.trim() : "";

    if (
      typeof name !== "string" ||
      typeof userId !== "string" ||
      !name ||
      !userId ||
      name.length > 120 ||
      userId.length > 64
    ) {
      response.status(400).json({ message: "A valid name and URN are required" });
      return;
    }

    const sessions = readSessions();
    const session = {
      sessionId: `session-${crypto.randomUUID()}`,
      userId,
      name,
      startedAt: new Date().toISOString(),
      submittedAt: null,
      status: "in-progress",
      attempted: 0,
      correct: 0,
      wrong: 0,
      answers: [],
    };

    sessions.push(session);
    saveSessions(sessions);
    response.status(201).json({ message: "Exam session started", sessionId: session.sessionId });
  });

  router.get("/session/:sessionId", (request, response) => {
    const session = readSessions().find(
      (item) => item.sessionId === request.params.sessionId,
    );

    if (!session) {
      response.status(404).json({ message: "Session not found" });
      return;
    }

    response.json(session);
  });

  router.post("/answer", (request, response) => {
    const { sessionId, questionId, selectedAnswer } = request.body || {};
    const question = readQuestions().find((item) => item.id === questionId);

    if (!question) {
      response.status(404).json({ message: "Question not found" });
      return;
    }

    if (
      typeof sessionId !== "string" ||
      !Number.isInteger(selectedAnswer) ||
      selectedAnswer < 0 ||
      selectedAnswer >= question.options.length
    ) {
      response.status(400).json({ message: "A valid answer is required" });
      return;
    }

    const sessions = readSessions();
    const session = sessions.find((item) => item.sessionId === sessionId);

    if (!session) {
      response.status(404).json({ message: "Session not found" });
      return;
    }

    if (session.status !== "in-progress") {
      response.status(409).json({ message: "Exam is already submitted" });
      return;
    }

    const answer = {
      questionId,
      selectedAnswer,
      isCorrect: selectedAnswer === question.correctAnswer,
      answeredAt: new Date().toISOString(),
    };
    const existingIndex = session.answers.findIndex((item) => item.questionId === questionId);

    if (existingIndex === -1) session.answers.push(answer);
    else session.answers[existingIndex] = answer;

    session.attempted = session.answers.length;
    session.correct = session.answers.filter((item) => item.isCorrect).length;
    session.wrong = session.attempted - session.correct;
    saveSessions(sessions);

    response.json({ message: "Answer saved", isCorrect: answer.isCorrect, ...resultFor(session) });
  });

  router.post("/submit", (request, response) => {
    const sessionId = request.body?.sessionId;

    if (typeof sessionId !== "string" || !sessionId) {
      response.status(400).json({ message: "sessionId is required" });
      return;
    }

    const sessions = readSessions();
    const session = sessions.find((item) => item.sessionId === sessionId);

    if (!session) {
      response.status(404).json({ message: "Session not found" });
      return;
    }

    if (session.status !== "submitted") {
      session.status = "submitted";
      session.submittedAt = new Date().toISOString();
      saveSessions(sessions);
    }

    response.json({ message: "Exam submitted successfully", result: resultFor(session) });
  });

  return router;
}

module.exports = createSessionRouter;
