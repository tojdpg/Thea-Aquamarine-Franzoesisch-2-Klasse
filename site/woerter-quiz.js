const QUESTIONS = [
  {
    sentence: "Le perroquet parle beaucoup. Il est…",
    cue: "gesprächig",
    choices: ["bavard", "timide", "sportif"],
    answer: "bavard"
  },
  {
    sentence: "Elle prend son travail au sérieux. Elle est…",
    cue: "ernsthaft",
    choices: ["gentille", "sérieuse", "belle"],
    answer: "sérieuse"
  },
  {
    sentence: "La soupe est…",
    cue: "gut",
    choices: ["bonne", "belle", "gentille"],
    answer: "bonne"
  },
  {
    sentence: "Le pirate n'aime pas travailler. Il est…",
    cue: "faul",
    choices: ["sportif", "bavard", "paresseux"],
    answer: "paresseux"
  },
  {
    sentence: "Il aime courir et jouer au ballon. Il est…",
    cue: "sportlich",
    choices: ["sportif", "paresseux", "timide"],
    answer: "sportif"
  },
  {
    sentence: "Elle n'ose pas parler devant la classe. Elle est…",
    cue: "schüchtern",
    choices: ["belle", "timide", "sérieuse"],
    answer: "timide"
  },
  {
    sentence: "La robe est…",
    cue: "schön",
    choices: ["bonne", "belle", "gentille"],
    answer: "belle"
  },
  {
    sentence: "Le château est…",
    cue: "schön",
    choices: ["beau", "gentil", "bavard"],
    answer: "beau"
  },
  {
    sentence: "Le garçon aide son ami. Il est…",
    cue: "nett",
    choices: ["timide", "gentil", "beau"],
    answer: "gentil"
  },
  {
    sentence: "La fille aide son amie. Elle est…",
    cue: "nett",
    choices: ["gentille", "belle", "sérieuse"],
    answer: "gentille"
  }
];

const STORAGE_KEY = "thea-french-adjectifs-quiz-progress-v1";
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
    selected: QUESTIONS.map(() => ""),
    checked: QUESTIONS.map(() => false)
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.selected) && Array.isArray(saved.checked)
      && saved.selected.length === QUESTIONS.length && saved.checked.length === QUESTIONS.length) {
      return saved;
    }
  } catch (error) {
    saveStatus.textContent = "Speichern nicht verfügbar";
  }
  return newState();
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = "Automatisch gespeichert";
    saveHistorySnapshot();
  } catch (error) {
    saveStatus.textContent = "Speichern nicht verfügbar";
  }
}

function historyEntry() {
  const answers = QUESTIONS.flatMap((question, index) => {
    return state.selected[index] ? [{
      prompt: `${question.sentence} (${question.cue})`,
      answer: state.selected[index]
    }] : [];
  });
  const mistakes = QUESTIONS.flatMap((question, index) => {
    return state.checked[index] && state.selected[index] !== question.answer ? [{
      prompt: question.sentence,
      answer: state.selected[index],
      expected: question.answer
    }] : [];
  });
  const correct = QUESTIONS.filter((question, index) =>
    state.checked[index] && state.selected[index] === question.answer
  ).length;
  const mission = {
    id: "adjectifs",
    title: "Les adjectifs",
    total: QUESTIONS.length,
    correct,
    touched: answers.length,
    answers,
    mistakes
  };
  const now = new Date().toISOString();

  return {
    sessionId: state.sessionId,
    title: "Wörterquiz: Les adjectifs",
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
  if (!entry.workedMissions) {
    return;
  }
  let history;
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    if (!Array.isArray(history)) {
      return;
    }
  } catch (error) {
    return;
  }
  const existingIndex = history.findIndex((item) => item.sessionId === state.sessionId);
  if (existingIndex >= 0) {
    history[existingIndex] = { ...history[existingIndex], ...entry };
  } else {
    history.unshift({ createdAt: entry.updatedAt, ...entry });
  }
  history.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
}

function playResultSound(correct) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) {
    return;
  }
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
  const score = QUESTIONS.filter((question, index) =>
    state.checked[index] && state.selected[index] === question.answer
  ).length;
  scoreNode.textContent = String(score);
  progressLabel.textContent = `${checked} von ${QUESTIONS.length} geprüft`;
  progressFill.style.width = `${checked / QUESTIONS.length * 100}%`;
  resultNode.textContent = checked === QUESTIONS.length
    ? `Fertig! ${score} von ${QUESTIONS.length} richtig.`
    : "";
}

function render() {
  grid.replaceChildren();
  QUESTIONS.forEach((question, index) => {
    const article = document.createElement("article");
    article.className = "quiz-question";
    const selected = state.selected[index];
    const checked = state.checked[index];
    if (checked) {
      article.classList.add(selected === question.answer ? "is-correct" : "is-wrong");
    }

    const number = document.createElement("p");
    number.className = "quiz-number";
    number.textContent = `Question ${index + 1}`;
    const heading = document.createElement("h2");
    heading.textContent = question.sentence;
    const cue = document.createElement("p");
    cue.className = "quiz-cue";
    cue.textContent = `Deutsch: ${question.cue}`;
    const choices = document.createElement("div");
    choices.className = "quiz-choices";
    choices.setAttribute("role", "group");
    choices.setAttribute("aria-label", `Réponse à la question ${index + 1}`);

    question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice;
      button.setAttribute("aria-pressed", String(selected === choice));
      button.addEventListener("click", () => {
        state.selected[index] = choice;
        state.checked[index] = false;
        save();
        render();
        grid.children[index].querySelector(".quiz-check").focus();
      });
      choices.append(button);
    });

    const check = document.createElement("button");
    check.type = "button";
    check.className = "quiz-check";
    check.textContent = "Vérifier";
    check.disabled = !selected;
    check.addEventListener("click", () => {
      state.checked[index] = true;
      save();
      playResultSound(selected === question.answer);
      render();
      grid.children[index].querySelector(".quiz-check").focus();
    });

    const feedback = document.createElement("p");
    feedback.className = "quiz-feedback";
    feedback.setAttribute("role", "status");
    feedback.textContent = checked
      ? (selected === question.answer ? "Très bien !" : "Essaie encore.")
      : "";
    article.append(number, heading, cue, choices, check, feedback);
    grid.append(article);
  });
  updateProgress();
}

document.querySelector("#restartBtn").addEventListener("click", () => {
  if (!window.confirm("Neuen Versuch beginnen? Dein bisheriger Durchgang bleibt in der Übersicht.")) {
    return;
  }
  state = newState();
  save();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();
