(() => {
  const entries = [
    ["bavard", "gesprächig (männlich)"],
    ["sérieuse", "ernsthaft / gewissenhaft (weiblich)"],
    ["bonne", "gut (weiblich)"],
    ["paresseux", "faul (männlich)"],
    ["sportif", "sportlich (männlich)"],
    ["timide", "schüchtern"],
    ["belle", "schön (weiblich)"],
    ["beau", "schön (männlich)"],
    ["gentil", "nett / freundlich (männlich)"],
    ["gentille", "nett / freundlich (weiblich)"],
    ["le mot manquant", "das fehlende Wort"],
    ["les adjectifs", "die Adjektive / Eigenschaftswörter"],
    ["complète chaque phrase avec un mot de la liste", "Ergänze jeden Satz mit einem Wort aus der Liste."],
    ["choisis le bon mot", "Wähle das richtige Wort."],
    ["le perroquet", "der Papagei"],
    ["la soupe", "die Suppe"],
    ["la robe", "das Kleid"],
    ["le château", "das Schloss"],
    ["le pirate", "der Pirat"],
    ["la princesse", "die Prinzessin"],
    ["le roi", "der König"],
    ["la classe", "die Klasse / der Unterricht"],
    ["le travail", "die Arbeit"],
    ["la chambre", "das Zimmer"],
    ["le ballon", "der Ball"],
    ["le garçon", "der Junge"],
    ["la fille", "das Mädchen"],
    ["les crayons", "die Stifte"],
    ["parle beaucoup", "spricht viel"],
    ["en classe", "im Unterricht"],
    ["elle écoute", "sie hört zu"],
    ["termine son travail", "beendet ihre Arbeit"],
    ["il ne veut pas", "er will nicht"],
    ["ranger sa chambre", "sein Zimmer aufräumen"],
    ["il court", "er rennt"],
    ["joue souvent au ballon", "spielt oft Ball"],
    ["elle n'ose pas parler", "sie traut sich nicht zu sprechen"],
    ["devant la classe", "vor der Klasse"],
    ["il aide son petit frère", "er hilft seinem kleinen Bruder"],
    ["elle partage ses crayons", "sie teilt ihre Stifte"],
    ["le perroquet parle beaucoup. il est…", "Der Papagei spricht viel. Er ist …"],
    ["elle prend son travail au sérieux. elle est…", "Sie nimmt ihre Arbeit ernst. Sie ist …"],
    ["la soupe est…", "Die Suppe ist …"],
    ["le pirate n'aime pas travailler. il est…", "Der Pirat arbeitet nicht gern. Er ist …"],
    ["il aime courir et jouer au ballon. il est…", "Er rennt und spielt gern Ball. Er ist …"],
    ["elle n'ose pas parler devant la classe. elle est…", "Sie traut sich nicht, vor der Klasse zu sprechen. Sie ist …"],
    ["la robe est…", "Das Kleid ist …"],
    ["le château est…", "Das Schloss ist …"],
    ["le garçon aide son ami. il est…", "Der Junge hilft seinem Freund. Er ist …"],
    ["la fille aide son amie. elle est…", "Das Mädchen hilft ihrer Freundin. Sie ist …"],
    ["Hugo est ______ : il parle beaucoup en classe.", "Hugo ist … : Er spricht viel im Unterricht."],
    ["Emma est ______ : elle écoute et termine son travail.", "Emma ist … : Sie hört zu und beendet ihre Arbeit."],
    ["Cette tarte aux pommes est ______.", "Dieser Apfelkuchen ist … ."],
    ["Tom est ______ : il ne veut pas ranger sa chambre.", "Tom ist … : Er will sein Zimmer nicht aufräumen."],
    ["Noé est ______ : il court et joue souvent au ballon.", "Noé ist … : Er rennt und spielt oft Ball."],
    ["Inès est ______ : elle n’ose pas parler devant la classe.", "Inès ist … : Sie traut sich nicht, vor der Klasse zu sprechen."],
    ["La robe de la princesse est ______.", "Das Kleid der Prinzessin ist … ."],
    ["Le château du roi est ______.", "Das Schloss des Königs ist … ."],
    ["Paul est ______ : il aide son petit frère.", "Paul ist … : Er hilft seinem kleinen Bruder."],
    ["Lina est ______ : elle partage ses crayons.", "Lina ist … : Sie teilt ihre Stifte."]
  ];

  function normalize(value) {
    return value.normalize("NFKC").trim().toLocaleLowerCase("fr")
      .replace(/[’‘`]/g, "'")
      .replace(/œ/g, "oe")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/_{2,}|…/g, "...")
      .replace(/\s*\.\.\.\s*/g, " ... ")
      .replace(/\s*:\s*/g, " : ")
      .replace(/\s+/g, " ")
      .replace(/[\s.!?…]+$/g, "")
      .trim();
  }

  const dictionary = new Map(entries.map(([french, german]) => [normalize(french), german]));
  for (const [french, german] of entries) {
    const withoutArticle = normalize(french).replace(/^(?:le |la |les |l')/, "");
    if (!dictionary.has(withoutArticle)) dictionary.set(withoutArticle, german);
  }

  function lookup(text) {
    return dictionary.get(normalize(text));
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { entries, lookup };
  if (typeof document === "undefined") return;

  const root = document.createElement("aside");
  root.className = "dictionary";
  root.setAttribute("aria-label", "Wörtermuschel");
  root.innerHTML = `
    <section class="dictionary-panel" id="dictionaryPanel" aria-labelledby="dictionaryTitle" hidden>
      <div class="dictionary-heading">
        <img src="assets/aquamarine-shell.svg" width="42" height="42" alt="">
        <div>
          <p class="dictionary-eyebrow">Français → Deutsch</p>
          <h2 id="dictionaryTitle">Wörtermuschel</h2>
        </div>
        <button class="dictionary-close" type="button" aria-label="Wörtermuschel schließen" title="Schließen">×</button>
      </div>
      <form class="dictionary-form">
        <label for="dictionaryInput">Wort oder Satz aus Theas Quizzen</label>
        <textarea id="dictionaryInput" rows="2" maxlength="300" placeholder="z. B. sérieuse"></textarea>
        <button class="dictionary-submit" type="submit">Übersetzen</button>
      </form>
      <div class="dictionary-answer" role="status" aria-live="polite" hidden></div>
    </section>
    <button class="dictionary-launcher" type="button" aria-controls="dictionaryPanel" aria-expanded="false" title="Wörtermuschel öffnen">
      <img src="assets/aquamarine-shell.svg" width="40" height="40" alt="">
      <span>Wörtermuschel</span>
    </button>
  `;
  document.body.append(root);

  const launcher = root.querySelector(".dictionary-launcher");
  const panel = root.querySelector(".dictionary-panel");
  const close = root.querySelector(".dictionary-close");
  const form = root.querySelector(".dictionary-form");
  const input = root.querySelector("#dictionaryInput");
  const answer = root.querySelector(".dictionary-answer");

  function showAnswer(message) {
    answer.textContent = message;
    answer.hidden = false;
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", () => {
    if (!panel.hidden) return closePanel();
    const selected = window.getSelection()?.toString().trim();
    if (selected && selected.length <= 300) input.value = selected;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    input.focus();
  });
  close.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closePanel();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      showAnswer("Schreib zuerst ein französisches Wort oder einen Satz hinein.");
      input.focus();
      return;
    }
    showAnswer(lookup(text) || "Das kenne ich noch nicht. Versuch ein Wort oder einen Satz aus diesen Quizzen.");
  });
})();
