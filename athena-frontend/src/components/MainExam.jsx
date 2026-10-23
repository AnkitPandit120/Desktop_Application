import { useEffect, useState } from "react";

function MainExam({ time, totalQuestions, sessionId, captureError, photosSaved }) {
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadQuestions() {
    try {
      const items = await window.electronAPI.getQuestions();
      if (!Array.isArray(items) || items.length === 0) throw new Error("No exam questions are available.");
      setQuestions(items);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Could not load exam questions.");
    } finally {
      setLoading(false);
    }
  }

  function retry() {
    setLoading(true);
    setError("");
    loadQuestions();
  }

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.getQuestions()
      .then((items) => {
        if (cancelled) return;
        if (!Array.isArray(items) || items.length === 0) throw new Error("No exam questions are available.");
        setQuestions(items);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not load exam questions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const question = questions[questionIndex];

  return (
    <div className="exam-page">
      <div className="exam-container">
        <div className="exam-header">
          <h3>Time Left {time}</h3>
          <span>{questions.length || totalQuestions} questions</span>
        </div>
        <p className="exam-status">Session {sessionId} · Camera photos saved {photosSaved}</p>
        {captureError && <p className="permission-error" role="alert">{captureError}</p>}
        {loading && <p role="status">Loading questions...</p>}
        {error && (
          <div role="alert" className="question-card">
            <p>{error}</p>
            <button className="btn btn-dark" onClick={retry}>Retry</button>
          </div>
        )}
        {question && !loading && (
          <div className="question-card">
            <h2>Question {questionIndex + 1} of {questions.length}</h2>
            <p>{question.question}</p>
            {question.options.map((option, index) => (
              <label key={index} className="option-row">
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  checked={selectedOptions[question.id] === index}
                  onChange={() => setSelectedOptions((previous) => ({ ...previous, [question.id]: index }))}
                />
                <span>{option}</span>
              </label>
            ))}
            <div className="navigation-buttons">
              <button onClick={() => setQuestionIndex((index) => index - 1)} disabled={questionIndex === 0}>Previous</button>
              <button onClick={() => setQuestionIndex((index) => index + 1)} disabled={questionIndex === questions.length - 1}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainExam;
