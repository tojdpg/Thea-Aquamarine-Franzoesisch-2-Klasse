const scoreNode = document.querySelector("#score");
const totalNode = document.querySelector("#total");
const progressLabel = document.querySelector("#progressLabel");
const progressFill = document.querySelector("#progressFill");
const rankLabel = document.querySelector("#rankLabel");
const toast = document.querySelector("#toast");
const writingText = document.querySelector("#writingText");
const writingHelp = document.querySelector("#writingHelp");
const saveStatus = document.querySelector("#saveStatus");

const gradedTasks = Array.from(document.querySelectorAll("[data-task]"));
const writingTaskCount = 1;
const totalTasks = gradedTasks.length + writingTaskCount;
const correctTasks = new Set();
const STORAGE_KEY = "thea-french-2c-round2-progress-v1";
const HISTORY_KEY = "thea-french-2c-history-v1";
const SESSION_KEY = "thea-french-2c-round2-session-v1";
let saveTimer = 0;
let isRestoring = false;
let audioContext = null;
let sessionId = getSessionId();

totalNode.textContent = String(totalTasks);

document.querySelectorAll("input[type='text']").forEach((input) => {
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
});

function normalize(value) {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/^[\s"“”«».,;:!?]+|[\s"“”«».,;:!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function getTaskId(task) {
  if (!task.dataset.id) {
    task.dataset.id = `task-${gradedTasks.indexOf(task)}`;
  }
  return task.dataset.id;
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }
    const next = createSessionId();
    localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch (error) {
    return createSessionId();
  }
}

function startNewSession() {
  sessionId = createSessionId();
  try {
    localStorage.setItem(SESSION_KEY, sessionId);
  } catch (error) {
    setSaveStatus("Speichern nicht verfügbar");
  }
}

function setSaveStatus(message) {
  if (saveStatus) {
    saveStatus.textContent = message;
  }
}

function getValue(task) {
  if (task.classList.contains("choice-task")) {
    return task.dataset.selected || "";
  }
  const field = task.querySelector("input, textarea");
  return field ? field.value : "";
}

function expectedAnswer(task) {
  return task.dataset.answer?.split("|")[0] || "";
}

function answersFor(task) {
  return (task.dataset.answer || "")
    .split("|")
    .map(normalize)
    .filter(Boolean);
}

function collectState() {
  return {
    savedAt: new Date().toISOString(),
    fields: Array.from(document.querySelectorAll("input, textarea")).map((field) => field.value),
    tasks: gradedTasks.map((task) => ({
      id: getTaskId(task),
      selected: task.dataset.selected || "",
      isCorrect: task.classList.contains("is-correct"),
      isWrong: task.classList.contains("is-wrong"),
      feedback: task.querySelector(".feedback")?.textContent || ""
    })),
    writingOk: document.body.dataset.writingOk === "true",
    writingTextCorrect: writingText.classList.contains("is-correct"),
    writingTextWrong: writingText.classList.contains("is-wrong"),
    writingHelp: writingHelp.textContent
  };
}

function saveState() {
  if (isRestoring) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    setSaveStatus("Automatisch gespeichert");
  } catch (error) {
    setSaveStatus("Speichern nicht möglich");
  }
}

function queueSave() {
  if (isRestoring) {
    return;
  }
  setSaveStatus("Speichert ...");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveState, 250);
}

function restoreState() {
  let rawState = "";
  try {
    rawState = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    setSaveStatus("Speichern nicht verfügbar");
    return;
  }
  if (!rawState) {
    saveState();
    return;
  }

  try {
    const state = JSON.parse(rawState);
    const fields = Array.from(document.querySelectorAll("input, textarea"));
    isRestoring = true;
    fields.forEach((field, index) => {
      field.value = state.fields?.[index] || "";
      field.classList.remove("is-correct", "is-wrong");
    });

    correctTasks.clear();
    gradedTasks.forEach((task, index) => {
      const taskState = state.tasks?.[index] || {};
      const feedback = task.querySelector(".feedback");
      task.classList.toggle("is-correct", Boolean(taskState.isCorrect));
      task.classList.toggle("is-wrong", Boolean(taskState.isWrong));
      if (feedback) {
        feedback.textContent = taskState.feedback || "";
      }
      if (taskState.selected) {
        task.dataset.selected = taskState.selected;
      } else {
        delete task.dataset.selected;
      }
      task.querySelectorAll("button").forEach((button) => {
        const value = button.dataset.value || button.textContent;
        button.setAttribute("aria-pressed", value === taskState.selected ? "true" : "false");
      });
      if (taskState.isCorrect) {
        correctTasks.add(getTaskId(task));
      }
    });

    document.body.dataset.writingOk = state.writingOk ? "true" : "false";
    writingText.classList.toggle("is-correct", Boolean(state.writingTextCorrect));
    writingText.classList.toggle("is-wrong", Boolean(state.writingTextWrong));
    writingHelp.textContent = state.writingHelp || "Écris 3 petites phrases.";
    setSaveStatus("Stand wiederhergestellt");
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
    setSaveStatus("Alter Stand konnte nicht geladen werden");
  } finally {
    isRestoring = false;
  }
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
  } catch (error) {
    setSaveStatus("Verlauf nicht gespeichert");
  }
}

function cleanPrompt(text) {
  return text.replace(/\s+/g, " ").trim();
}

function getPrompt(task) {
  const promptNode = task.querySelector("span, p");
  return cleanPrompt(promptNode ? promptNode.textContent : "");
}

function answerSummary(task) {
  const answer = getValue(task).trim();
  const touched = task.classList.contains("is-correct") ||
    task.classList.contains("is-wrong") ||
    Boolean(answer);

  if (!touched) {
    return null;
  }

  return {
    prompt: getPrompt(task),
    answer
  };
}

function missionSummary(section) {
  const title = section.querySelector("h2")?.textContent.trim() || section.id;
  const tasks = Array.from(section.querySelectorAll("[data-task]"));
  if (section.id === "ecriture") {
    const isCorrect = document.body.dataset.writingOk === "true";
    const isWrong = writingText.classList.contains("is-wrong");
    const touched = Boolean(writingText.value.trim() || isCorrect || isWrong);
    return {
      id: section.id,
      title,
      total: 1,
      correct: isCorrect ? 1 : 0,
      touched: touched ? 1 : 0,
      answers: touched ? [{
        prompt: "Mon mini-texte",
        answer: writingText.value.trim()
      }] : [],
      mistakes: isWrong ? [{
        prompt: "Mon mini-texte",
        answer: writingText.value.trim(),
        expected: "3 petites phrases"
      }] : []
    };
  }

  const mistakes = [];
  const correct = tasks.filter((task) => task.classList.contains("is-correct")).length;
  const touched = tasks.filter((task) => {
    return task.classList.contains("is-correct") ||
      task.classList.contains("is-wrong") ||
      Boolean(getValue(task).trim());
  }).length;

  tasks.forEach((task) => {
    if (task.classList.contains("is-wrong")) {
      mistakes.push({
        prompt: getPrompt(task),
        answer: getValue(task).trim(),
        expected: expectedAnswer(task)
      });
    }
  });

  return {
    id: section.id,
    title,
    total: tasks.length,
    correct,
    touched,
    answers: tasks.map(answerSummary).filter(Boolean),
    mistakes
  };
}

function collectHistoryEntry() {
  const missions = Array.from(document.querySelectorAll(".mission-band")).map(missionSummary);
  const writingOk = document.body.dataset.writingOk === "true" ? 1 : 0;
  const score = correctTasks.size + writingOk;
  const percent = Math.round((score / totalTasks) * 100);
  return {
    sessionId,
    title: "Thea Aquamarine - Mission de français 2",
    updatedAt: new Date().toISOString(),
    score,
    total: totalTasks,
    percent,
    completedMissions: missions.filter((mission) => mission.total > 0 && mission.correct === mission.total).length,
    workedMissions: missions.filter((mission) => mission.touched > 0).length,
    missions,
    answers: missions
      .filter((mission) => mission.answers?.length)
      .map((mission) => ({
        title: mission.title,
        items: mission.answers.map((answer) => [answer.prompt, answer.answer])
      })),
    mistakes: missions.flatMap((mission) => mission.mistakes.map((mistake) => ({ mission: mission.title, ...mistake })))
  };
}

function saveHistorySnapshot() {
  const entry = collectHistoryEntry();
  const history = loadHistory();
  const existingIndex = history.findIndex((item) => item.sessionId === sessionId);
  if (existingIndex >= 0) {
    history[existingIndex] = { ...history[existingIndex], ...entry };
  } else {
    history.unshift({ createdAt: entry.updatedAt, ...entry });
  }
  history.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  saveHistory(history);
}

function exportStateBundle() {
  saveState();
  if (collectHistoryEntry().workedMissions > 0) {
    saveHistorySnapshot();
  }

  const bundle = {
    app: "thea-french-2c",
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    progress: localStorage.getItem(STORAGE_KEY),
    history: localStorage.getItem(HISTORY_KEY),
    sessionId: localStorage.getItem(SESSION_KEY)
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(bundle))));
}

async function copyStateBundle() {
  const code = exportStateBundle();

  try {
    await navigator.clipboard.writeText(code);
    showToast("Stand-Code kopiert.");
  } catch (error) {
    window.prompt("Stand-Code kopieren:", code);
  }
}

function importStateBundle() {
  const code = window.prompt("Stand-Code einfügen:");
  if (!code) {
    return;
  }

  try {
    const bundle = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));

    if (bundle.app !== "thea-french-2c") {
      throw new Error("wrong app");
    }

    if (bundle.progress) {
      localStorage.setItem(STORAGE_KEY, bundle.progress);
    }
    if (bundle.history) {
      localStorage.setItem(HISTORY_KEY, bundle.history);
    }
    if (bundle.sessionId) {
      localStorage.setItem(SESSION_KEY, bundle.sessionId);
    }

    showToast("Stand importiert.");
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    showToast("Stand-Code konnte nicht gelesen werden.");
  }
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playTone(context, frequency, offset, duration, type, volume) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + offset;
  const end = start + duration;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

function playResultSound(ok) {
  const context = getAudioContext();
  if (!context) {
    return;
  }
  const play = () => {
    if (ok) {
      playTone(context, 587.33, 0, 0.12, "sine", 0.08);
      playTone(context, 739.99, 0.1, 0.14, "sine", 0.075);
      playTone(context, 880, 0.22, 0.17, "triangle", 0.07);
      return;
    }
    playTone(context, 146.83, 0, 0.18, "sawtooth", 0.055);
    playTone(context, 110, 0.16, 0.2, "square", 0.04);
  };
  if (context.state === "suspended") {
    context.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

function setFeedback(task, ok, message) {
  const feedback = task.querySelector(".feedback");
  task.classList.toggle("is-correct", ok);
  task.classList.toggle("is-wrong", !ok);
  if (feedback) {
    feedback.textContent = message;
  }
  const id = getTaskId(task);
  if (ok) {
    correctTasks.add(id);
  } else {
    correctTasks.delete(id);
  }
}

function matchesKeywordSet(text, rawKeywords) {
  const normalizedText = normalize(text);
  return rawKeywords
    .split(",")
    .map((group) => group.split("|").map(normalize))
    .every((alternatives) => alternatives.some((word) => normalizedText.includes(word)));
}

function checkTask(task) {
  if (task.dataset.keywords) {
    const ok = matchesKeywordSet(getValue(task), task.dataset.keywords);
    setFeedback(task, ok, ok ? "Très bien." : "Regarde encore le texte.");
    return ok;
  }
  const ok = answersFor(task).includes(normalize(getValue(task)));
  setFeedback(task, ok, ok ? "Correct." : `Essaie encore. Réponse : ${expectedAnswer(task)}`);
  return ok;
}

function updateScore() {
  const writingOk = document.body.dataset.writingOk === "true" ? 1 : 0;
  const score = correctTasks.size + writingOk;
  const percent = Math.round((score / totalTasks) * 100);
  scoreNode.textContent = String(score);
  progressLabel.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  if (percent >= 90) {
    rankLabel.textContent = "Niveau actuel : reine des mots";
  } else if (percent >= 65) {
    rankLabel.textContent = "Niveau actuel : exploratrice française";
  } else if (percent >= 35) {
    rankLabel.textContent = "Niveau actuel : chasseuse de mots";
  } else {
    rankLabel.textContent = "Niveau actuel : débutante courageuse";
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function checkSection(selector) {
  const section = document.querySelector(selector);
  const tasks = Array.from(section.querySelectorAll("[data-task]"));
  const correct = tasks.filter(checkTask).length;
  updateScore();
  saveState();
  saveHistorySnapshot();
  playResultSound(correct === tasks.length);
  showToast(correct === tasks.length ? "Mission réussie." : `Score de la mission : ${correct}/${tasks.length}.`);
}

function countSentences(text) {
  const byPunctuation = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  if (byPunctuation.length > 1) {
    return byPunctuation.length;
  }
  return text.split(/\n+/).map((part) => part.trim()).filter(Boolean).length;
}

function checkWriting() {
  const text = writingText.value.trim();
  const sentenceCount = countSentences(text);
  const normalizedText = normalize(text);
  const hasUsefulStart = normalizedText.includes("je ") || normalizedText.includes("j'");
  const ok = sentenceCount >= 3 && hasUsefulStart;
  document.body.dataset.writingOk = ok ? "true" : "false";
  writingText.classList.toggle("is-correct", ok);
  writingText.classList.toggle("is-wrong", !ok);
  writingHelp.textContent = ok ? "Très bien : 3 petites phrases." : `Il y a ${sentenceCount} phrase(s). Il faut 3 phrases.`;
  updateScore();
  saveState();
  saveHistorySnapshot();
  playResultSound(ok);
  showToast(ok ? "Texte validé." : "Texte à améliorer.");
}

document.querySelectorAll("[data-check]").forEach((button) => {
  button.addEventListener("click", () => checkSection(button.dataset.check));
});

document.querySelectorAll("input, textarea").forEach((field) => {
  field.addEventListener("input", queueSave);
  field.addEventListener("change", queueSave);
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(button.dataset.jump).scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll(".choice-row button").forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const task = button.closest("[data-task]");
    task.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    task.dataset.selected = button.dataset.value || button.textContent;
    queueSave();
  });
});

document.querySelector("#checkWritingBtn").addEventListener("click", checkWriting);
document.querySelector("#exportStateBtn")?.addEventListener("click", copyStateBundle);
document.querySelector("#importStateBtn")?.addEventListener("click", importStateBundle);

document.querySelector("#resetBtn").addEventListener("click", () => {
  document.querySelectorAll("input, textarea").forEach((field) => {
    field.value = "";
    field.classList.remove("is-correct", "is-wrong");
  });
  document.querySelectorAll("[data-task]").forEach((task) => {
    task.classList.remove("is-correct", "is-wrong");
    delete task.dataset.selected;
    const feedback = task.querySelector(".feedback");
    if (feedback) {
      feedback.textContent = "";
    }
  });
  document.querySelectorAll(".choice-row button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  correctTasks.clear();
  document.body.dataset.writingOk = "false";
  writingHelp.textContent = "Écris 3 petites phrases.";
  localStorage.removeItem(STORAGE_KEY);
  startNewSession();
  updateScore();
  saveState();
  showToast("Tout est remis à zéro.");
});

restoreState();
updateScore();
if (collectHistoryEntry().workedMissions > 0) {
  saveHistorySnapshot();
}
