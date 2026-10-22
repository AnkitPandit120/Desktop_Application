import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const videoRef = useRef(null);

  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [fullScreenReady, setFullScreenReady] = useState(false);
  const [fullScreenError, setFullScreenError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [urn, setUrn] = useState("");
  const [studentError, setStudentError] = useState("");

  async function getLaspedTime() {
    const currTime = await window.electronAPI.getRemainingTime();
    setTime(currTime);
  }

  useEffect(() => {
    if (!started) return;

    const interval = setInterval(() => {
      getLaspedTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [started]);

  async function getCamera() {
    setCameraError("");
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable on this device.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject?.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (error) {
      setCameraReady(false);
      setCameraError(
        error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and try again."
          : error.name === "NotFoundError"
            ? "No camera was found. Connect a camera and try again."
            : error.message || "Could not open the camera. Try again."
      );
    } finally {
      setCameraLoading(false);
    }
  }

  async function getFullscreen() {
    setFullScreenError("");
    try {
      await window.electronAPI.setFullScreen();
      setFullScreenReady(true);
    } catch (error) {
      setFullScreenReady(false);
      setFullScreenError(error.message || "Could not enter full screen. Try again.");
    }
  }

  async function startTest() {
    if (!studentName.trim() || !urn.trim()) {
      setStudentError("Enter your name and URN before starting the test.");
      return;
    }

    setStudentError("");
    setStarting(true);

    try {
      const accepted = await window.electronAPI.showExamRules();
      if (!accepted) return;

      const total = await window.electronAPI.getTotalMCQ();
      const id = await window.electronAPI.startExam(studentName.trim(), urn.trim());
      setSessionId(id);
      setQuestionCount(total);
      setStarted(true);
    } catch (error) {
      setStudentError(error.message || "Could not start the exam.");
    } finally {
      setStarting(false);
    }
  }

  function formatTimeLeft(ms) {
    const seconds = Math.floor((ms / 1000) % 60)
      .toString()
      .padStart(2, "0");

    const minutes = Math.floor((ms / (1000 * 60)) % 60)
      .toString()
      .padStart(2, "0");

    const hours = Math.floor(ms / (1000 * 60 * 60))
      .toString()
      .padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        className={cameraReady && !started ? "video-preview" : "hidden-video"}
      />

      <div className="page-container">
        <div className="header-section">
          <h1>Hi User!</h1>
          <p>Kindly Allow the following Permissions to Start the test:</p>
        </div>

        <div className="card-container">
          <div className="student-section">
            <h2>Student details</h2>
            <p>Enter your details before you start the test.</p>
            <div className="student-fields">
              <label htmlFor="student-name">
                Name
                <input
                  id="student-name"
                  name="student-name"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                />
              </label>
              <label htmlFor="student-urn">
                URN
                <input
                  id="student-urn"
                  name="student-urn"
                  type="text"
                  autoComplete="off"
                  maxLength={64}
                  value={urn}
                  onChange={(event) => setUrn(event.target.value)}
                />
              </label>
            </div>
            {studentError && <p className="student-error" role="alert">{studentError}</p>}
          </div>

          <div className="divider" />

          <div className="permission-item">
            <div className="permission-icon">↗</div>
            <div className="permission-content">
              <h3>Configure Camera</h3>
              <p>Kindly configure Camera to attempt quiz/contests.</p>
              <div className="action-row">
                <button onClick={getCamera} className="btn btn-dark" disabled={cameraLoading}>
                  {cameraLoading ? "Opening Camera..." : cameraReady ? "Retry Camera" : "Get Camera Access"}
                </button>
              </div>
              {cameraReady && <div className="camera-space" />}
              {cameraReady && <p className="permission-success" role="status">Camera is ready.</p>}
              {cameraError && <p className="permission-error" role="alert">{cameraError}</p>}
            </div>
          </div>

          <div className="divider" />

          {/* Fullscreen */}

          <div className="permission-item">
            <div className="permission-icon">⛶</div>

            <div className="permission-content">
              <h3>Switch to full screen</h3>

              <p>Kindly close all tabs and switch to full screen.</p>

              <button onClick={getFullscreen} className="btn btn-light-blue">
                Give Full Screen Permissions
              </button>
              {fullScreenReady && <p className="permission-success" role="status">Full screen is ready.</p>}
              {fullScreenError && <p className="permission-error" role="alert">{fullScreenError}</p>}
            </div>
          </div>
        </div>

        <div className="bottom-actions">
          <button onClick={startTest} className="btn btn-light-blue" disabled={starting || started}>
            {starting ? "Starting Test..." : "Go To Test"}
          </button>
          <button className="btn btn-outline">Need Help?</button>
        </div>
        {started && (
          <div className="session-summary" role="status">
            <p>Session {sessionId}</p>
            <p>Questions {questionCount}</p>
            <p>Time Left {formatTimeLeft(time)}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
