const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  startExam: (name, urn) => ipcRenderer.invoke("exam-start", name, urn),
  getTotalMCQ: () => ipcRenderer.invoke("exam-question-count"),
  getQuestions: () => ipcRenderer.invoke("exam-questions"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  getActiveSession: () => ipcRenderer.invoke("exam-active-session"),
  showExamRules: () => ipcRenderer.invoke("exam-rules"),
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  isFullScreen: () => ipcRenderer.invoke("is-full-screen"),
  exitFullScreen: () => ipcRenderer.invoke("exit-full-screen"),
  savePhoto: (image) => ipcRenderer.invoke("save-photo", image),
});
