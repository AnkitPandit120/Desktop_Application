const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");

const apiBase = process.env.ATHENA_API_URL || "http://127.0.0.1:3000";
let mainWindow;
let examEndsAt = null;

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
  examEndsAt = Date.now() + 60 * 60 * 1000;
  return data.sessionId;
});

ipcMain.handle("get-time", () => Math.max(0, (examEndsAt || 0) - Date.now()));

ipcMain.handle("exam-question-count", async () => {
  const data = await requestExam("/exam/mcq/total");
  return data.total;
});

ipcMain.handle("exam-rules", async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Exam rules",
    message: "Please read the exam rules carefully.",
    detail: "Keep your camera enabled and remain in full screen during the exam.",
    buttons: ["Accept", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });
  return result.response === 0;
});

ipcMain.handle("full-screen", () => {
  mainWindow.setFullScreen(true);
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
