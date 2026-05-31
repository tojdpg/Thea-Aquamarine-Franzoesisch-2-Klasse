const HISTORY_KEY = "thea-french-2c-history-v1";
const historyList = document.querySelector("#historyList");
const summaryGrid = document.querySelector("#summaryGrid");

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (error) {
    return [];
  }
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

    return `
      <article class="history-card">
        <header>
          <div>
            <p class="eyebrow">${formatDate(entry.updatedAt)}</p>
            <h2>${htmlEscape(entry.title)}</h2>
            <p>Score: ${entry.score}/${entry.total} · ${entry.percent}% · Missionen: ${entry.completedMissions}/8 komplett</p>
          </div>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </header>
        <div class="mission-result-list">${missions}</div>
        ${mistakes ? `
          <div class="mistake-list">
            <h3>Noch anschauen</h3>
            <ul>${mistakes}</ul>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

const history = loadHistory();
renderSummary(history);
renderHistory(history);
