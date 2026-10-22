const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  startExam: (name, urn) => ipcRenderer.invoke("exam-start", name, urn),
  getTotalMCQ: () => ipcRenderer.invoke("exam-question-count"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  showExamRules: () => ipcRenderer.invoke("exam-rules"),
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  isFullScreen: () => ipcRenderer.invoke("is-full-screen"),
  exitFullScreen: () => ipcRenderer.invoke("exit-full-screen"),
});
