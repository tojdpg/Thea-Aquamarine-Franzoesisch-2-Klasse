const HISTORY_KEY = "thea-french-2c-history-v1";
const STORAGE_KEY = "thea-french-2c-progress-v1";
const ROUND2_STORAGE_KEY = "thea-french-2c-round2-progress-v1";
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

const ROUND2_MISSIONS = [
  { id: "petits-mots", title: "Les petits mots", start: 0, end: 4 },
  { id: "couleurs", title: "Les couleurs", start: 4, end: 8 },
  { id: "nombres", title: "Les nombres", start: 8, end: 13 },
  { id: "classe", title: "Dans la classe", start: 13, end: 17 },
  { id: "phrases", title: "Petites phrases", start: 17, end: 21 },
  { id: "sons", title: "Les sons secrets", start: 21, end: 25 },
  { id: "lecture", title: "Petite lecture", start: 25, end: 28 },
  { id: "ecriture", title: "Mon mini-texte", start: 28, end: 29 }
];

const ROUND2_TASK_PROMPTS = [
  "bonsoir", "pardon", "oui", "non",
  "orange", "lila", "weiß", "schwarz",
  "6 =", "7 =", "8 =", "9 =", "10 =",
  "______ règle", "______ stylo", "______ table", "______ sac",
  "______ Thea.", "______ sept ans.", "______ les dauphins.", "______ à l'école.",
  "rouge", "noir", "enfant", "lapin",
  "De quelle couleur est le sac ?",
  "Qu'est-ce qu'il y a dans le sac ?",
  "Avec qui Thea joue-t-elle ?",
  "Mon mini-texte"
];

const ROUND2_FIELD_INDEX_BY_TASK = new Map([
  [8, 0], [9, 1], [10, 2], [11, 3], [12, 4],
  [25, 5], [26, 6], [27, 7], [28, 8]
]);

const RUN_RECOVERY_CONFIGS = [
  {
    storageKey: STORAGE_KEY,
    sessionId: "recovered-thea-current-progress",
    title: "Thea Aquamarine - Mission de français",
    missions: MISSIONS,
    taskPrompts: TASK_PROMPTS,
    fieldIndexByTask: FIELD_INDEX_BY_TASK
  },
  {
    storageKey: ROUND2_STORAGE_KEY,
    sessionId: "recovered-thea-round2-current-progress",
    title: "Thea Aquamarine - Mission de français 2",
    missions: ROUND2_MISSIONS,
    taskPrompts: ROUND2_TASK_PROMPTS,
    fieldIndexByTask: ROUND2_FIELD_INDEX_BY_TASK
  }
];

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

function loadProgressState(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch (error) {
    return null;
  }
}

function taskAnswerFromState(state, index, config) {
  const writingIndex = config.taskPrompts.length - 1;
  if (index === writingIndex) {
    return state.fields?.[config.fieldIndexByTask.get(index)] || "";
  }

  const task = state.tasks?.[index] || {};
  if (task.selected) {
    return task.selected;
  }

  const fieldIndex = config.fieldIndexByTask.get(index);
  if (fieldIndex !== undefined) {
    return state.fields?.[fieldIndex] || "";
  }

  return "";
}

function taskTouchedFromState(state, index, config) {
  const writingIndex = config.taskPrompts.length - 1;
  if (index === writingIndex) {
    const fieldIndex = config.fieldIndexByTask.get(index);
    return Boolean(state.fields?.[fieldIndex]?.trim() || state.writingOk || state.writingTextCorrect || state.writingTextWrong);
  }

  const task = state.tasks?.[index] || {};
  return Boolean(task.selected || task.isCorrect || task.isWrong || taskAnswerFromState(state, index, config).trim());
}

function taskCorrectFromState(state, index, config) {
  const writingIndex = config.taskPrompts.length - 1;
  if (index === writingIndex) {
    return Boolean(state.writingOk || state.writingTextCorrect);
  }

  return Boolean(state.tasks?.[index]?.isCorrect);
}

function entryFromProgressState(state, config) {
  if (!state?.tasks?.length && !state?.fields?.length) {
    return null;
  }

  const total = config.taskPrompts.length;
  const writingIndex = total - 1;
  const score = Array.from({ length: total }, (_, index) => index)
    .filter((index) => taskCorrectFromState(state, index, config)).length;
  const missions = config.missions.map((mission) => {
    const indexes = Array.from(
      { length: mission.end - mission.start },
      (_, offset) => mission.start + offset
    );
    const correct = indexes.filter((index) => taskCorrectFromState(state, index, config)).length;
    const touched = indexes.filter((index) => taskTouchedFromState(state, index, config)).length;
    const answers = indexes
      .filter((index) => taskTouchedFromState(state, index, config))
      .map((index) => ({
        prompt: config.taskPrompts[index],
        answer: taskAnswerFromState(state, index, config)
      }));
    const mistakes = indexes
      .filter((index) => taskTouchedFromState(state, index, config) && !taskCorrectFromState(state, index, config))
      .map((index) => ({
        prompt: config.taskPrompts[index],
        answer: taskAnswerFromState(state, index, config),
        expected: index === writingIndex ? "3 petites phrases" : ""
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
    sessionId: config.sessionId,
    title: config.title,
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
  const recoveredEntries = RUN_RECOVERY_CONFIGS
    .map((config) => entryFromProgressState(loadProgressState(config.storageKey), config))
    .filter(Boolean);

  if (recoveredEntries.length === 0) {
    return history;
  }

  const entriesBySession = new Map();
  [...history, ...recoveredEntries].forEach((entry) => {
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

function storageDiagnostic() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(Boolean)
      .sort();

    const progressKeys = RUN_RECOVERY_CONFIGS
      .map((config) => config.storageKey)
      .filter((key) => Boolean(localStorage.getItem(key)));

    return {
      available: true,
      keys,
      hasHistory: Boolean(localStorage.getItem(HISTORY_KEY)),
      hasProgress: progressKeys.length > 0,
      progressKeys,
      origin: window.location.origin
    };
  } catch (error) {
    return {
      available: false,
      keys: [],
      hasHistory: false,
      hasProgress: false,
      progressKeys: [],
      origin: window.location.origin
    };
  }
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
    const diagnostic = storageDiagnostic();
    const storageText = diagnostic.available
      ? "Browser-Speicher ist erreichbar, aber für diese Adresse wurde kein alter Thea-Stand gefunden."
      : "Browser-Speicher ist für diese Seite nicht erreichbar.";

    historyList.innerHTML = `
      <section class="empty-state">
        <h1>Noch kein gespeicherter Durchgang</h1>
        <p>${storageText}</p>
        <div class="storage-diagnostic">
          <p><strong>Geprüfte Adresse:</strong> ${htmlEscape(diagnostic.origin)}</p>
          <p><strong>Verlauf gefunden:</strong> ${diagnostic.hasHistory ? "ja" : "nein"}</p>
          <p><strong>Aufgabenstand gefunden:</strong> ${diagnostic.hasProgress ? `ja (${htmlEscape(diagnostic.progressKeys.join(", "))})` : "nein"}</p>
          <p><strong>Speicher-Schlüssel auf dieser Adresse:</strong> ${diagnostic.keys.length ? htmlEscape(diagnostic.keys.join(", ")) : "keine"}</p>
        </div>
        <p>Wenn Theas erster Durchgang auf einem anderen Gerät, in einem anderen Browser oder unter einer anderen Adresse gemacht wurde, kann diese Seite ihn nicht automatisch sehen. Dann brauchen wir einen Screenshot oder PDF zum Nachtragen.</p>
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
            <p>Score: ${entry.score}/${entry.total} · ${entry.percent}% · Missionen: ${entry.completedMissions}/${entry.missions?.length || 8} komplett</p>
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
