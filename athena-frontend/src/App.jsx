import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import MainExam from "./components/MainExam";

function App() {
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const mountedRef = useRef(true);
  const captureInFlightRef = useRef(false);
  const submittingRef = useRef(false);

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
  const [captureError, setCaptureError] = useState("");
  const [photosSaved, setPhotosSaved] = useState(0);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [examError, setExamError] = useState("");

  const finishExam = useCallback(async () => {
    if (!sessionId || submittingRef.current) return;
    submittingRef.current = true;
    setExamError("");
    try {
      const submitted = await window.electronAPI.submitExam(sessionId);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
      setStarted(false);
      setResult(submitted);
    } catch (error) {
      setExamError(error.message || "Could not submit the exam. Try again.");
    } finally {
      submittingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const session = await window.electronAPI.getActiveSession();
        if (!session || cancelled) return;
        setStudentName(session.name);
        setUrn(session.urn);
        setSessionId(session.sessionId);
        if (session.status === "submitted") {
          setResult(session.result);
          return;
        }
        const total = await window.electronAPI.getTotalMCQ();
        const remaining = await window.electronAPI.getRemainingTime();
        if (cancelled) return;
        setSavedAnswers(session.answers || {});
        setQuestionCount(total);
        setTime(remaining);
        setStarted(true);
        getCamera();
      } catch (error) {
        if (!cancelled) setStudentError(error.message || "Could not restore the exam session.");
      }
    }
    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(async () => {
      try {
        const remaining = await window.electronAPI.getRemainingTime();
        setTime(remaining);
        if (remaining === 0) finishExam();
      } catch {
        setStudentError("Could not refresh the exam timer.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [started, finishExam]);

  useEffect(() => {
    if (!started || !cameraReady) return;
    let cancelled = false;
    async function capturePhoto() {
      if (cancelled || captureInFlightRef.current) return;
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return;
      captureInFlightRef.current = true;
      try {
        if (await window.electronAPI.getRemainingTime() <= 0) return;
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Camera capture is unavailable.");
        context.drawImage(video, 0, 0);
        await window.electronAPI.savePhoto(canvas.toDataURL("image/png"));
        if (!cancelled) {
          setPhotosSaved((count) => count + 1);
          setCaptureError("");
        }
      } catch (error) {
        if (!cancelled) setCaptureError(error.message || "Could not save a camera photo.");
      } finally {
        captureInFlightRef.current = false;
      }
    }
    capturePhoto();
    const interval = setInterval(capturePhoto, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [started, cameraReady]);

  async function getCamera() {
    setCameraError("");
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable on this device.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!mountedRef.current || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        videoRef.current.srcObject = null;
        throw new Error("The camera opened but its preview could not start. Try again.");
      }
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (cameraStreamRef.current !== stream || !mountedRef.current) return;
        cameraStreamRef.current = null;
        setCameraReady(false);
        setCameraError("The camera disconnected. Reconnect it and try again.");
      });
      setCameraReady(true);
    } catch (error) {
      if (!mountedRef.current) return;
      setCameraReady(false);
      setCameraError(
        error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and try again."
          : error.name === "NotFoundError"
            ? "No camera was found. Connect a camera and try again."
            : error.message || "Could not open the camera. Try again."
      );
    } finally {
      if (mountedRef.current) setCameraLoading(false);
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
    let enteredFullScreen = false;

    try {
      const accepted = await window.electronAPI.showExamRules();
      if (!accepted) return;

      const total = await window.electronAPI.getTotalMCQ();
      if (!total) throw new Error("No exam questions are available yet.");
      if (!(await window.electronAPI.isFullScreen())) {
        await window.electronAPI.setFullScreen();
        setFullScreenReady(true);
        enteredFullScreen = true;
      }
      const id = await window.electronAPI.startExam(studentName.trim(), urn.trim());
      setSessionId(id);
      setSavedAnswers({});
      setQuestionCount(total);
      setTime(await window.electronAPI.getRemainingTime());
      setStarted(true);
    } catch (error) {
      if (enteredFullScreen) {
        await window.electronAPI.exitFullScreen().catch(() => {});
        setFullScreenReady(false);
      }
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
        playsInline
        aria-label="Camera preview"
        className={cameraReady ? "video-preview" : "hidden-video"}
      />

      {result ? (
        <div className="exam-page"><div className="exam-container question-card" role="status">
          <h2>Exam submitted</h2>
          <p>Attempted {result.attempted} · Correct {result.correct} · Wrong {result.wrong}</p>
          <button className="btn btn-dark" onClick={() => { setResult(null); setSessionId(""); setTime(0); setPhotosSaved(0); setCaptureError(""); }}>Start another exam</button>
        </div></div>
      ) : started ? (
        <MainExam
          time={formatTimeLeft(time)}
          totalQuestions={questionCount}
          sessionId={sessionId}
          captureError={captureError}
          photosSaved={photosSaved}
          savedAnswers={savedAnswers}
          examError={examError}
          cameraReady={cameraReady}
          cameraError={cameraError}
          onRetryCamera={getCamera}
          onFinish={() => { if (window.confirm("Submit your exam now?")) finishExam(); }}
        />
      ) : <div className="page-container">
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
      </div>
      }
    </>
  );
}

export default App;
