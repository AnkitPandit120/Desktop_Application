const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const savePhoto = require("./photo-store.cjs");
const { readSessionId, writeSessionId, clearSessionId } = require("./session-store.cjs");

if (process.env.ATHENA_USER_DATA_DIR) {
  fs.mkdirSync(process.env.ATHENA_USER_DATA_DIR, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") fs.chmodSync(process.env.ATHENA_USER_DATA_DIR, 0o700);
  app.setPath("userData", process.env.ATHENA_USER_DATA_DIR);
}

const apiBase = process.env.ATHENA_API_URL || "http://127.0.0.1:3000";
let mainWindow;
let examEndsAt = null;
let activeSessionId = null;

async function requestExam(route, options) {
  let response;

  try {
    response = await fetch(new URL(route, apiBase), options);
  } catch {
    throw new Error("Exam server is unavailable. Start the backend and try again.");
  }

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Exam request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173/");
  }
}

ipcMain.handle("exam-start", async (_event, name, urn) => {
  const data = await requestExam("/exam/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, userId: urn }),
  });
  activeSessionId = data.sessionId;
  examEndsAt = Date.parse(data.endsAt);
  writeSessionId(app.getPath("userData"), data.sessionId);
  return data.sessionId;
});

ipcMain.handle("get-time", () => examEndsAt ? Math.max(0, examEndsAt - Date.now()) : 0);

ipcMain.handle("exam-active-session", async () => {
  activeSessionId ||= readSessionId(app.getPath("userData"));
  if (!activeSessionId) return null;
  let session;
  try {
    session = await requestExam(`/exam/session/${encodeURIComponent(activeSessionId)}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    activeSessionId = null;
    examEndsAt = null;
    clearSessionId(app.getPath("userData"));
    return null;
  }
  examEndsAt = session.status === "in-progress" ? Date.parse(session.endsAt) : null;
  if (session.status === "submitted") mainWindow?.setFullScreen(false);
  return {
    sessionId: session.sessionId,
    endsAt: session.endsAt,
    name: session.name,
    urn: session.userId,
    status: session.status,
    result: session.status === "submitted" ? {
      attempted: session.attempted,
      correct: session.correct,
      wrong: session.wrong,
    } : null,
    answers: Object.fromEntries(session.answers.map((answer) => [answer.questionId, answer.selectedAnswer])),
  };
});

ipcMain.handle("exam-question-count", async () => {
  const data = await requestExam("/exam/mcq/total");
  return data.total;
});

ipcMain.handle("exam-questions", () => requestExam("/exam/mcq"));

ipcMain.handle("exam-answer", async (_event, sessionId, questionId, selectedAnswer) => {
  if (!activeSessionId || sessionId !== activeSessionId) throw new Error("No active exam session was found.");
  await requestExam("/exam/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, questionId, selectedAnswer }),
  });
});

ipcMain.handle("exam-submit", async (_event, sessionId) => {
  if (!activeSessionId || sessionId !== activeSessionId) throw new Error("No active exam session was found.");
  const data = await requestExam("/exam/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  examEndsAt = null;
  mainWindow?.setFullScreen(false);
  return data.result;
});

ipcMain.handle("exam-rules", async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Exam rules",
    message: "Read the exam rules before continuing",
    detail: [
      "Keep your camera enabled throughout the exam.",
      "Stay in full screen until you submit your answers.",
      "Your timer begins when the exam session starts.",
    ].join("\n"),
    buttons: ["Cancel", "Accept and start"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
});

ipcMain.handle("full-screen", () => {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error("Exam window is unavailable.");
  mainWindow.setFullScreen(true);
});

ipcMain.handle("is-full-screen", () => Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()));

ipcMain.handle("exit-full-screen", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setFullScreen(false);
});

ipcMain.handle("save-photo", (_event, image) => {
  if (!activeSessionId || !examEndsAt || examEndsAt <= Date.now()) {
    throw new Error("An active exam is required to save a camera image.");
  }
  return savePhoto(image, path.join(app.getPath("userData"), "camera-feed"));
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
