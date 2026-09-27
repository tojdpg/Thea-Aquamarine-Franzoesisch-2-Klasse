const QUESTIONS = [
  { before: "Hugo est ", after: " : il parle beaucoup en classe.", answer: "bavard" },
  { before: "Emma est ", after: " : elle écoute et termine son travail.", answer: "sérieuse" },
  { before: "Cette tarte aux pommes est ", after: ".", answer: "bonne" },
  { before: "Tom est ", after: " : il ne veut pas ranger sa chambre.", answer: "paresseux" },
  { before: "Noé est ", after: " : il court et joue souvent au ballon.", answer: "sportif" },
  { before: "Inès est ", after: " : elle n’ose pas parler devant la classe.", answer: "timide" },
  { before: "La robe de la princesse est ", after: ".", answer: "belle" },
  { before: "Le château du roi est ", after: ".", answer: "beau" },
  { before: "Paul est ", after: " : il aide son petit frère.", answer: "gentil" },
  { before: "Lina est ", after: " : elle partage ses crayons.", answer: "gentille" }
];

const STORAGE_KEY = "thea-french-adjectifs-dictee-progress-v1";
const HISTORY_KEY = "thea-french-2c-history-v1";
const grid = document.querySelector("#quizGrid");
const scoreNode = document.querySelector("#score");
const progressLabel = document.querySelector("#progressLabel");
const progressFill = document.querySelector("#progressFill");
const resultNode = document.querySelector("#quizResult");
const saveStatus = document.querySelector("#saveStatus");
let audioContext;

function newState() {
  return {
    sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    answers: QUESTIONS.map(() => ""),
    checked: QUESTIONS.map(() => false)
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved.sessionId === "string"
      && Array.isArray(saved.answers) && Array.isArray(saved.checked)
      && saved.answers.length === QUESTIONS.length && saved.checked.length === QUESTIONS.length
      && saved.answers.every((answer) => typeof answer === "string")) {
      return saved;
    }
  } catch (error) {
    saveStatus.textContent = "Speichern nicht verfügbar";
  }
  return newState();
}

let state = loadState();

function normalized(answer) {
  return answer.trim().replace(/[.!?]+$/, "").trim().normalize("NFC").toLocaleLowerCase("fr");
}

function isCorrect(index) {
  return state.checked[index] && normalized(state.answers[index]) === QUESTIONS[index].answer;
}

function historyEntry() {
  const answers = QUESTIONS.flatMap((question, index) => state.answers[index].trim() ? [{
    prompt: `${question.before}______${question.after}`,
    answer: state.answers[index].trim()
  }] : []);
  const mistakes = QUESTIONS.flatMap((question, index) => {
    return state.checked[index] && !isCorrect(index) ? [{
      prompt: `${question.before}______${question.after}`,
      answer: state.answers[index].trim(),
      expected: question.answer
    }] : [];
  });
  const correct = QUESTIONS.filter((_, index) => isCorrect(index)).length;
  const mission = {
    id: "adjectifs-dictee",
    title: "Le mot manquant",
    total: QUESTIONS.length,
    correct,
    touched: answers.length,
    answers,
    mistakes
  };
  const now = new Date().toISOString();
  return {
    sessionId: state.sessionId,
    title: "Lückendiktat: Le mot manquant",
    updatedAt: now,
    score: correct,
    total: QUESTIONS.length,
    percent: Math.round(correct / QUESTIONS.length * 100),
    completedMissions: correct === QUESTIONS.length ? 1 : 0,
    workedMissions: answers.length ? 1 : 0,
    missions: [mission],
    answers: [{ title: mission.title, items: answers.map(({ prompt, answer }) => [prompt, answer]) }],
    mistakes: mistakes.map((mistake) => ({ mission: mission.title, ...mistake }))
  };
}

function saveHistorySnapshot() {
  const entry = historyEntry();
  if (!entry.workedMissions) return;
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  if (!Array.isArray(history)) return;
  const existingIndex = history.findIndex((item) => item.sessionId === state.sessionId);
  if (existingIndex >= 0) {
    history[existingIndex] = { ...history[existingIndex], ...entry };
  } else {
    history.unshift({ createdAt: entry.updatedAt, ...entry });
  }
  history.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveHistorySnapshot();
    saveStatus.textContent = "Automatisch gespeichert";
  } catch (error) {
    saveStatus.textContent = "Speichern nicht verfügbar";
  }
}

function playResultSound(correct) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audioContext ||= new Context();
  const context = audioContext;
  const play = () => {
    const notes = correct ? [587.33, 739.99, 880] : [196, 146.83];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.12;
      oscillator.type = correct ? "sine" : "sawtooth";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.055, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
  };
  if (context.state === "suspended") {
    context.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

function updateProgress() {
  const checked = state.checked.filter(Boolean).length;
  const score = QUESTIONS.filter((_, index) => isCorrect(index)).length;
  scoreNode.textContent = String(score);
  progressLabel.textContent = `${checked} von ${QUESTIONS.length} geprüft`;
  progressFill.style.width = `${checked / QUESTIONS.length * 100}%`;
  resultNode.textContent = checked === QUESTIONS.length
    ? `Fertig! ${score} von ${QUESTIONS.length} richtig.` : "";
}

function updateQuestion(article, index) {
  article.classList.toggle("is-correct", isCorrect(index));
  article.classList.toggle("is-wrong", state.checked[index] && !isCorrect(index));
  article.querySelector(".quiz-check").disabled = !state.answers[index].trim();
  article.querySelector(".quiz-feedback").textContent = state.checked[index]
    ? (isCorrect(index) ? "Très bien !" : "Essaie encore.") : "";
  updateProgress();
}

function render() {
  grid.replaceChildren();
  QUESTIONS.forEach((question, index) => {
    const article = document.createElement("article");
    article.className = "quiz-question";

    const number = document.createElement("p");
    number.className = "quiz-number";
    number.textContent = `Phrase ${index + 1}`;

    const sentence = document.createElement("label");
    sentence.className = "dictation-sentence";
    sentence.append(document.createTextNode(question.before));
    const input = document.createElement("input");
    input.type = "text";
    input.value = state.answers[index];
    input.placeholder = "......";
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "none");
    input.setAttribute("autocorrect", "off");
    input.spellcheck = false;
    input.setAttribute("aria-label", `Mot manquant, phrase ${index + 1}`);
    sentence.append(input, document.createTextNode(question.after));

    const check = document.createElement("button");
    check.type = "button";
    check.className = "quiz-check";
    check.textContent = "Vérifier";
    const feedback = document.createElement("p");
    feedback.className = "quiz-feedback";
    feedback.setAttribute("role", "status");
    article.append(number, sentence, check, feedback);
    grid.append(article);

    input.addEventListener("input", () => {
      state.answers[index] = input.value;
      state.checked[index] = false;
      save();
      updateQuestion(article, index);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") check.click();
    });
    check.addEventListener("click", () => {
      if (!state.answers[index].trim()) return;
      state.checked[index] = true;
      save();
      playResultSound(isCorrect(index));
      updateQuestion(article, index);
    });
    updateQuestion(article, index);
  });
}

document.querySelector("#restartBtn").addEventListener("click", () => {
  if (!window.confirm("Neuen Versuch beginnen? Dein bisheriger Durchgang bleibt in der Übersicht.")) return;
  state = newState();
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();
