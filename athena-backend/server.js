const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const createSessionRouter = require("./sessions.cjs");

const app = express();
const questionsPath = path.join(__dirname, "data", "questions.json");

app.use(express.json({ limit: "16kb" }));

function readQuestions() {
  return JSON.parse(fs.readFileSync(questionsPath, "utf8"));
}

function questionForStudent(question) {
  return {
    id: question.id,
    question: question.question,
    options: question.options,
  };
}

app.get("/", (_request, response) => {
  response.json({ message: "Exam backend is running" });
});

app.get("/exam/mcq/total", (_request, response) => {
  response.json({ total: readQuestions().length });
});

app.get("/exam/mcq/:id", (request, response) => {
  const id = Number(request.params.id);
  const question = readQuestions().find((item) => item.id === id);

  if (!question) {
    response.status(404).json({ message: "Question not found" });
    return;
  }

  response.json(questionForStudent(question));
});

app.get("/exam/mcq", (_request, response) => {
  response.json(readQuestions().map(questionForStudent));
});

app.use("/exam", createSessionRouter(readQuestions));

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`Exam backend running at http://127.0.0.1:${port}`);
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = app;
