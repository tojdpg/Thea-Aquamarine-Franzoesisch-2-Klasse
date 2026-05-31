const HISTORY_KEY = "thea-french-2c-history-v1";
const STORAGE_KEY = "thea-french-2c-progress-v1";
const historyList = document.querySelector("#historyList");
const summaryGrid = document.querySelector("#summaryGrid");

const MISSIONS = [
  { id: "bonjour", title: "Bonjour !", start: 0, end: 4 },
  { id: "couleurs", title: "Les couleurs", start: 4, end: 8 },
  { id: "nombres", title: "Les nombres", start: 8, end: 13 },
  { id: "articles", title: "Un ou une ?", start: 13, end: 17 },
  { id: "phrases", title: "Petites phrases", start: 17, end: 21 },
  { id: "sons", title: "Les sons", start: 21, end: 25 },
  { id: "lecture", title: "Petite lecture", start: 25, end: 28 },
  { id: "ecriture", title: "Mon mini-texte", start: 28, end: 29 }
];

const TASK_PROMPTS = [
  "bonjour", "merci", "au revoir", "s'il te plaît",
  "blau", "rot", "grün", "gelb",
  "1 =", "2 =", "3 =", "4 =", "5 =",
  "______ livre", "______ trousse", "______ crayon", "______ gomme",
  "______ Thea.", "______ un cartable.", "______ à l'école.", "______ le français.",
  "souris", "trois", "bonbon", "maison",
  "Quelle est la couleur du cartable ?",
  "Qu'est-ce qu'il y a dans le cartable ?",
  "Combien de crayons y a-t-il ?",
  "Mon mini-texte"
];

const FIELD_INDEX_BY_TASK = new Map([
  [8, 0], [9, 1], [10, 2], [11, 3], [12, 4],
  [25, 5], [26, 6], [27, 7], [28, 8]
]);

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
    // Rendering should still work if storage is blocked.
  }
}

function loadProgressState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function taskAnswerFromState(state, index) {
  if (index === 28) {
    return state.fields?.[8] || "";
  }

  const task = state.tasks?.[index] || {};
  if (task.selected) {
    return task.selected;
  }

  const fieldIndex = FIELD_INDEX_BY_TASK.get(index);
  if (fieldIndex !== undefined) {
    return state.fields?.[fieldIndex] || "";
  }

  return "";
}

function taskTouchedFromState(state, index) {
  if (index === 28) {
    return Boolean(state.fields?.[8]?.trim() || state.writingOk || state.writingTextCorrect || state.writingTextWrong);
  }

  const task = state.tasks?.[index] || {};
  return Boolean(task.selected || task.isCorrect || task.isWrong || taskAnswerFromState(state, index).trim());
}

function taskCorrectFromState(state, index) {
  if (index === 28) {
    return Boolean(state.writingOk || state.writingTextCorrect);
  }

  return Boolean(state.tasks?.[index]?.isCorrect);
}

function entryFromProgressState(state) {
  if (!state?.tasks?.length && !state?.fields?.length) {
    return null;
  }

  const total = 29;
  const score = Array.from({ length: 29 }, (_, index) => index)
    .filter((index) => taskCorrectFromState(state, index)).length;
  const missions = MISSIONS.map((mission) => {
    const indexes = Array.from(
      { length: mission.end - mission.start },
      (_, offset) => mission.start + offset
    );
    const correct = indexes.filter((index) => taskCorrectFromState(state, index)).length;
    const touched = indexes.filter((index) => taskTouchedFromState(state, index)).length;
    const answers = indexes
      .filter((index) => taskTouchedFromState(state, index))
      .map((index) => ({
        prompt: TASK_PROMPTS[index],
        answer: taskAnswerFromState(state, index)
      }));
    const mistakes = indexes
      .filter((index) => taskTouchedFromState(state, index) && !taskCorrectFromState(state, index))
      .map((index) => ({
        prompt: TASK_PROMPTS[index],
        answer: taskAnswerFromState(state, index),
        expected: index === 28 ? "3 petites phrases" : ""
      }));

    return {
      id: mission.id,
      title: mission.title,
      total: indexes.length,
      correct,
      touched,
      answers,
      mistakes
    };
  });
  const workedMissions = missions.filter((mission) => mission.touched > 0).length;

  if (workedMissions === 0) {
    return null;
  }

  return {
    sessionId: "recovered-thea-current-progress",
    title: "Thea Aquamarine - Mission de français",
    createdAt: state.savedAt || new Date().toISOString(),
    updatedAt: state.savedAt || new Date().toISOString(),
    score,
    total,
    percent: Math.round((score / total) * 100),
    completedMissions: missions.filter((mission) => mission.correct === mission.total).length,
    workedMissions,
    note: "Aus dem gespeicherten Aufgabenstand auf diesem Gerät wiederhergestellt.",
    missions,
    answers: missions
      .filter((mission) => mission.answers.length)
      .map((mission) => ({
        title: mission.title,
        items: mission.answers.map((answer) => [answer.prompt, answer.answer])
      })),
    mistakes: missions.flatMap((mission) => {
      return mission.mistakes.map((mistake) => ({
        mission: mission.title,
        ...mistake
      }));
    })
  };
}

function mergeProgressIntoHistory(history) {
  const recoveredEntry = entryFromProgressState(loadProgressState());

  if (!recoveredEntry) {
    return history;
  }

  const entriesBySession = new Map();
  [...history, recoveredEntry].forEach((entry) => {
    entriesBySession.set(entry.sessionId || `${entry.title}-${entry.updatedAt}`, entry);
  });

  const merged = Array.from(entriesBySession.values())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  saveHistory(merged);
  return merged;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSummary(history) {
  const latest = history[0];
  const best = history.reduce((max, item) => Math.max(max, item.percent || 0), 0);
  const totalRuns = history.length;
  const completed = history.filter((item) => item.percent >= 90).length;

  summaryGrid.innerHTML = `
    <div class="summary-item"><span>Durchgänge</span><strong>${totalRuns}</strong></div>
    <div class="summary-item"><span>Bester Score</span><strong>${best}%</strong></div>
    <div class="summary-item"><span>Sehr stark</span><strong>${completed}</strong></div>
    <div class="summary-item"><span>Letzter Stand</span><strong>${latest ? `${latest.score}/${latest.total}` : "-"}</strong></div>
  `;
}

function renderHistory(history) {
  if (history.length === 0) {
    historyList.innerHTML = `
      <section class="empty-state">
        <h1>Noch kein gespeicherter Durchgang</h1>
        <p>Wenn Thea eine Mission mit Vérifier prüft, erscheint sie hier.</p>
      </section>
    `;
    return;
  }

  historyList.innerHTML = history.map((entry) => {
    const badgeClass = entry.percent >= 90 ? "good" : "work";
    const badgeText = entry.percent >= 90 ? "Sehr stark" : "Weiter üben";
    const missions = (entry.missions || []).map((mission) => `
      <div class="mission-result">
        <div>
          <strong>${htmlEscape(mission.title)}</strong>
          <span>${mission.correct}/${mission.total} richtig</span>
        </div>
        <span>${mission.touched ? "gemacht" : "offen"}</span>
      </div>
    `).join("");
    const mistakes = (entry.mistakes || []).slice(0, 8).map((mistake) => `
      <li>
        <strong>${htmlEscape(mistake.mission)}:</strong>
        ${htmlEscape(mistake.prompt)}
        ${mistake.answer ? ` · Antwort: ${htmlEscape(mistake.answer)}` : ""}
        ${mistake.expected ? ` · Erwartet: ${htmlEscape(mistake.expected)}` : ""}
      </li>
    `).join("");
    const answers = (entry.answers || []).map((group) => `
      <section class="answer-group">
        <h3>${htmlEscape(group.title)}</h3>
        <dl>
          ${group.items.map(([prompt, answer]) => `
            <div>
              <dt>${htmlEscape(prompt)}</dt>
              <dd>${htmlEscape(answer).replaceAll("\n", "<br>")}</dd>
            </div>
          `).join("")}
        </dl>
      </section>
    `).join("");

    return `
      <article class="history-card">
        <header>
          <div>
            <p class="eyebrow">${formatDate(entry.updatedAt)}</p>
            <h2>${htmlEscape(entry.title)}</h2>
            <p>Score: ${entry.score}/${entry.total} · ${entry.percent}% · Missionen: ${entry.completedMissions}/8 komplett</p>
            ${entry.note ? `<p class="history-note">${htmlEscape(entry.note)}</p>` : ""}
          </div>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </header>
        <details class="run-details">
          <summary>
            <span>Bereiche anzeigen</span>
            <small>${entry.workedMissions || 0} Bereiche gemacht</small>
          </summary>
          <div class="mission-result-list">${missions}</div>
          ${answers ? `
            <details class="answer-review">
              <summary>Ausgefüllte Antworten anzeigen</summary>
              ${answers}
            </details>
          ` : ""}
          ${mistakes ? `
            <div class="mistake-list">
              <h3>Noch anschauen</h3>
              <ul>${mistakes}</ul>
            </div>
          ` : ""}
        </details>
      </article>
    `;
  }).join("");
}

const history = mergeProgressIntoHistory(loadHistory());
renderSummary(history);
renderHistory(history);
