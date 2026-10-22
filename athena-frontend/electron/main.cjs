const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

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
  if (!response.ok) throw new Error(data.message || "Exam request failed.");
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
  return data.sessionId;
});

ipcMain.handle("get-time", () => examEndsAt ? Math.max(0, examEndsAt - Date.now()) : 0);

ipcMain.handle("exam-active-session", async () => {
  if (!activeSessionId) return null;
  const session = await requestExam(`/exam/session/${encodeURIComponent(activeSessionId)}`);
  if (session.status !== "in-progress") {
    activeSessionId = null;
    examEndsAt = null;
    return null;
  }
  examEndsAt = Date.parse(session.endsAt);
  return { sessionId: session.sessionId, endsAt: session.endsAt, name: session.name, urn: session.userId };
});

ipcMain.handle("exam-question-count", async () => {
  const data = await requestExam("/exam/mcq/total");
  return data.total;
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

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
