(() => {
  const loader = document.currentScript;
  const profile = loader?.dataset.profile;
  const apps = (loader?.dataset.apps || "").split("|").filter(Boolean);
  const profilePrefix = `${profile}-`;
  const apiRoot = "https://school.tokenwerk.eu/api";
  const tokenKey = `school-sync:${profile}:token`;
  const baselineKey = `school-sync:${profile}:baseline`;
  const pendingKey = `school-sync:${profile}:pending`;
  let applyingRemote = false;
  let syncPromise = null;
  let pendingConflict = null;
  let bootFinished = false;
  let bootBlocked = false;
  let reloadNeeded = false;

  if (!profile || !["mila", "thea"].includes(profile)) {
    loadApps();
    return;
  }

  const assetBase = new URL("./", loader.src);
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("school-sync.css", assetBase).href;
  document.head.append(style);

  function readMeta(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function writeMeta(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setStatus("Gerätespeicher voll");
    }
  }

  function readToken() {
    try {
      return localStorage.getItem(tokenKey);
    } catch {
      return null;
    }
  }

  function writeToken(token) {
    localStorage.setItem(tokenKey, token);
  }

  function collectState() {
    const state = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(profilePrefix)) state[key] = localStorage.getItem(key);
    }
    return state;
  }

  function mapsEqual(left, right) {
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    return [...keys].every((key) => left?.[key] === right?.[key]);
  }

  function diffState(next, previous) {
    const changes = {};
    const keys = new Set([...Object.keys(next || {}), ...Object.keys(previous || {})]);
    for (const key of keys) {
      if (next?.[key] !== previous?.[key]) changes[key] = next?.[key] ?? null;
    }
    return changes;
  }

  function mergeAgainstBaseline(local, remote, baseline) {
    const merged = {};
    const conflicts = [];
    const keys = new Set([
      ...Object.keys(local || {}),
      ...Object.keys(remote || {}),
      ...Object.keys(baseline || {})
    ]);
    for (const key of keys) {
      const localChanged = local?.[key] !== baseline?.[key];
      const remoteChanged = remote?.[key] !== baseline?.[key];
      if (localChanged && remoteChanged && local?.[key] !== remote?.[key]) {
        conflicts.push(key);
        continue;
      }
      const value = localChanged ? local?.[key] : remote?.[key];
      if (value !== undefined) merged[key] = value;
    }
    return { merged, conflicts };
  }

  function applyState(state) {
    applyingRemote = true;
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(profilePrefix) && !(key in state)) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(state)) {
        if (key.startsWith(profilePrefix) && localStorage.getItem(key) !== value) {
          localStorage.setItem(key, value);
        }
      }
    } finally {
      applyingRemote = false;
    }
  }

  async function request(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    const token = readToken();
    if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      response = await fetch(`${apiRoot}${path}`, {
        ...options,
        headers,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(controller.signal.aborted ? "Der VPS antwortet gerade nicht." : "Keine Verbindung zum Lernstand-Server.");
    } finally {
      clearTimeout(timeout);
    }
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      throw new Error("Der Lernstand-Server hat eine ungültige Antwort gesendet.");
    }
    if (!response.ok) {
      const error = new Error(payload.error || "Die Synchronisierung ist fehlgeschlagen.");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function setStatus(message, connected = Boolean(readToken())) {
    const status = document.querySelector("[data-sync-status]");
    const trigger = document.querySelector("[data-sync-open]");
    if (status) status.textContent = message;
    if (trigger) {
      trigger.dataset.connected = String(connected);
      trigger.setAttribute("aria-label", `Lernstand: ${message}. Synchronisierung öffnen.`);
    }
  }

  function showMessage(message, isError = false) {
    const element = document.querySelector("[data-sync-message]");
    if (!element) return;
    element.textContent = message;
    element.dataset.error = String(isError);
  }

  function showCode(code, note = "Dieser Code ist zehn Minuten gültig und kann nur einmal verwendet werden.") {
    const region = document.querySelector("[data-sync-code-region]");
    region.hidden = false;
    region.querySelector("[data-sync-code]").textContent = code;
    region.querySelector("[data-sync-code-note]").textContent = note;
  }

  function openDialog() {
    const dialog = document.querySelector("[data-sync-dialog]");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function renderDialog() {
    const host = document.querySelector(".top-actions") || document.querySelector("header") || document.body;
    if (!document.querySelector("[data-sync-open]")) {
      const trigger = document.createElement("button");
      trigger.className = "school-sync-trigger";
      trigger.type = "button";
      trigger.dataset.syncOpen = "";
      trigger.title = "Lernstand auf anderen Geräten";
      trigger.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 10.5 3.75 3.75 0 1 1 18.25 18H7Z"/><path d="M12 12v7m-3-3 3 3 3-3"/></svg><span>Sync</span>';
      trigger.addEventListener("click", () => {
        renderConnectedControls();
        openDialog();
      });
      host.append(trigger);
    }

    if (document.querySelector("[data-sync-dialog]")) return;
    const dialog = document.createElement("dialog");
    dialog.className = "school-sync-dialog";
    dialog.dataset.syncDialog = "";
    dialog.setAttribute("aria-labelledby", "school-sync-title");
    dialog.innerHTML = `
      <div class="school-sync-heading">
        <div><p class="school-sync-kicker">${profile === "mila" ? "Mila" : "Thea"} · Lernstand</p><h2 id="school-sync-title">Auf mehreren Geräten lernen</h2></div>
        <button class="school-sync-close" type="button" data-sync-close aria-label="Schließen">×</button>
      </div>
      <p class="school-sync-copy">Die Antworten bleiben auf diesem Gerät gespeichert. Mit einem einmaligen Code kannst du sie zusätzlich auf dem privaten Tokenwerk-Server sichern und auf einem anderen Gerät fortsetzen.</p>
      <p class="school-sync-status" data-sync-status role="status">Nur auf diesem Gerät gespeichert</p>
      <p class="school-sync-message" data-sync-message aria-live="polite"></p>
      <section class="school-sync-local" data-sync-local>
        <button class="school-sync-primary" type="button" data-sync-start>Dieses Gerät sichern und verbinden</button>
        <div class="school-sync-divider"><span>oder anderes Gerät verbinden</span></div>
        <label for="school-sync-pair-code">Pairing-Code vom verbundenen Gerät</label>
        <div class="school-sync-code-input"><input id="school-sync-pair-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="1234-5678"><button class="school-sync-secondary" type="button" data-sync-pair>Verbinden</button></div>
      </section>
      <section class="school-sync-connected" data-sync-connected hidden>
        <div class="school-sync-actions"><button class="school-sync-primary" type="button" data-sync-new-code>Anderes Gerät verbinden</button><button class="school-sync-secondary" type="button" data-sync-now>Jetzt synchronisieren</button></div>
      </section>
      <section class="school-sync-code" data-sync-code-region hidden>
        <p>Gib diesen Code auf dem anderen Gerät ein:</p>
        <strong data-sync-code></strong>
        <small data-sync-code-note></small>
      </section>
      <section class="school-sync-conflict" data-sync-conflict hidden>
        <p>Dieselbe Aufgabe wurde auf beiden Geräten verändert. Beide Speicherstände bleiben erhalten. Wähle, welche Antworten bei doppelten Aufgaben gelten sollen; einzelne Aufgaben werden zusammengeführt.</p>
        <div class="school-sync-actions"><button class="school-sync-secondary" type="button" data-sync-choose-remote>VPS-Antworten bevorzugen</button><button class="school-sync-primary" type="button" data-sync-choose-local>Dieses Gerät bevorzugen</button></div>
        <small>Vor der Übernahme wird die jeweils andere Version als JSON-Datei heruntergeladen.</small>
      </section>
      <p class="school-sync-footnote">Der Server akzeptiert nur Speicherstände dieser Schülerin. Mila und Thea sind getrennt; Grok und GitHub erhalten keine Antworten.</p>`;
    document.body.append(dialog);
    dialog.querySelector("[data-sync-close]").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-sync-start]").addEventListener("click", startSync);
    dialog.querySelector("[data-sync-pair]").addEventListener("click", pairDevice);
    dialog.querySelector("[data-sync-new-code]").addEventListener("click", makePairCode);
    dialog.querySelector("[data-sync-now]").addEventListener("click", () => syncFromRemote(false));
    dialog.querySelector("[data-sync-choose-remote]").addEventListener("click", () => resolveConflict("remote"));
    dialog.querySelector("[data-sync-choose-local]").addEventListener("click", () => resolveConflict("local"));
    dialog.querySelector("#school-sync-pair-code").addEventListener("input", (event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
      event.target.value = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
    });
    renderConnectedControls();
  }

  function renderConnectedControls() {
    const connected = Boolean(readToken());
    document.querySelector("[data-sync-local]").hidden = connected;
    document.querySelector("[data-sync-connected]").hidden = !connected;
    if (connected) setStatus("Gerät ist mit dem VPS verknüpft", true);
    else setStatus("Nur auf diesem Gerät gespeichert", false);
    const pending = pendingConflict || readMeta(pendingKey);
    if (pending) showConflict(pending, false);
  }

  function showConflict(conflict, blockBoot) {
    pendingConflict = conflict;
    bootBlocked = blockBoot || bootBlocked;
    writeMeta(pendingKey, conflict);
    document.querySelector("[data-sync-conflict]").hidden = false;
    showMessage("Es gibt zwei Versionen für einzelne Aufgaben. Nichts wird automatisch überschrieben.", true);
    openDialog();
  }

  function saveBackupDownload(which, state) {
    const payload = {
      student: profile,
      savedAt: new Date().toISOString(),
      source: which,
      answers: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${profile}-lernstand-${which}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function resolveConflict(preference) {
    const conflict = pendingConflict || readMeta(pendingKey);
    if (!conflict) return;
    const local = collectState();
    const remote = conflict.remote || {};
    if (preference === "remote") saveBackupDownload("geraet", local);
    else saveBackupDownload("vps", remote);
    const resultMerge = mergeAgainstBaseline(local, remote, conflict.baseline || {});
    const merged = resultMerge.merged;
    const collisionKeys = new Set([...(conflict.keys || []), ...resultMerge.conflicts]);
    for (const key of collisionKeys) {
      const source = preference === "local" ? local : remote;
      if (key in source) merged[key] = source[key];
      else delete merged[key];
    }
    try {
      showMessage("Sichere beide Versionen und gleiche die Antworten ab …");
      const changes = diffState(merged, remote);
      const result = Object.keys(changes).length
        ? await request("/v1/sync/state", { method: "PUT", body: JSON.stringify({ revision: conflict.revision, changes }) })
        : { revision: conflict.revision, state: remote };
      applyState(merged);
      writeMeta(baselineKey, { revision: result.revision, state: merged });
      localStorage.removeItem(pendingKey);
      pendingConflict = null;
      document.querySelector("[data-sync-conflict]").hidden = true;
      setStatus("Gesichert · beide Geräte verbunden", true);
      showMessage("Fertig. Die andere Version wurde ebenfalls als JSON-Datei gesichert.");
      if (bootBlocked) {
        bootBlocked = false;
        finishBoot();
      } else {
        setTimeout(() => location.reload(), 250);
      }
    } catch (error) {
      showMessage(error.message, true);
      if (error.status === 409) await syncFromRemote(false, true);
    }
  }

  async function startSync() {
    const button = document.querySelector("[data-sync-start]");
    button.disabled = true;
    showMessage("Sichere die vorhandenen Antworten dieses Geräts …");
    try {
      const result = await request("/v1/sync/start", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ profile, state: collectState() })
      });
      writeToken(result.token);
      writeMeta(baselineKey, { revision: result.revision, state: result.state });
      renderConnectedControls();
      showCode(result.code);
      setStatus("Gesichert · dieses Gerät ist verbunden", true);
      showMessage("Dein bisheriger Lernstand wurde gesichert und bleibt hier erhalten.");
      if (!bootFinished) finishBoot();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function pairDevice() {
    const button = document.querySelector("[data-sync-pair]");
    const input = document.querySelector("#school-sync-pair-code");
    const code = input.value.replace(/\D/g, "");
    if (code.length !== 8) {
      showMessage("Bitte gib den achtstelligen Code ein.", true);
      return;
    }
    button.disabled = true;
    showMessage("Verbinde dieses Gerät …");
    try {
      const local = collectState();
      const result = await request("/v1/sync/pair", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ profile, code })
      });
      writeToken(result.token);
      const remote = result.state || {};
      if (Object.keys(local).length && !mapsEqual(local, remote)) {
        showConflict({ local, remote, revision: result.revision, baseline: {}, kind: "pair" }, !bootFinished);
        setStatus("Gerät verbunden · Abgleich nötig", true);
        return;
      }
      applyState(remote);
      writeMeta(baselineKey, { revision: result.revision, state: remote });
      localStorage.removeItem(pendingKey);
      renderConnectedControls();
      document.querySelector("[data-sync-code-region]").hidden = true;
      showMessage("Verbunden. Der Lernstand wurde auf dieses Gerät geladen.");
      setStatus("Verbunden · Lernstand geladen", true);
      if (!bootFinished) finishBoot();
      else setTimeout(() => location.reload(), 250);
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function makePairCode() {
    const button = document.querySelector("[data-sync-new-code]");
    button.disabled = true;
    showMessage("Erzeuge einen einmaligen Code …");
    try {
      const result = await request("/v1/sync/pair-code", { method: "POST" });
      showCode(result.code, "Der Code läuft in zehn Minuten ab und funktioniert nur einmal.");
      showMessage("Gib diesen Code auf dem anderen Gerät ein.");
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  async function syncFromRemote(startup, force = false) {
    if (!force && (pendingConflict || readMeta(pendingKey))) return false;
    if (!readToken() || syncPromise) return syncPromise;
    syncPromise = performSync(startup).finally(() => { syncPromise = null; });
    return syncPromise;
  }

  async function performSync(startup) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const remote = await request("/v1/sync/state");
        const local = collectState();
        const baseline = readMeta(baselineKey);
        if (!baseline) {
          if (mapsEqual(local, remote.state) || Object.keys(local).length === 0) {
            applyState(remote.state);
            writeMeta(baselineKey, remote);
            setStatus("Gesichert · aktuell", true);
            return true;
          }
          showConflict({ local, remote: remote.state, revision: remote.revision, baseline: {}, kind: "recovery" }, startup);
          return false;
        }
        const { merged, conflicts } = mergeAgainstBaseline(local, remote.state, baseline.state || {});
        if (conflicts.length) {
          showConflict({ local, remote: remote.state, revision: remote.revision, baseline: baseline.state || {}, keys: conflicts }, startup);
          return false;
        }
        const changes = diffState(merged, remote.state);
        let result = remote;
        if (Object.keys(changes).length) {
          try {
            result = await request("/v1/sync/state", {
              method: "PUT",
              body: JSON.stringify({ revision: remote.revision, changes })
            });
          } catch (error) {
            if (error.status === 409) continue;
            throw error;
          }
        }
        const remoteChanged = !mapsEqual(remote.state, baseline.state || {});
        applyState(merged);
        writeMeta(baselineKey, { revision: result.revision, state: merged });
        setStatus("Gesichert · aktuell", true);
        if (remoteChanged && !startup) {
          reloadNeeded = true;
          showMessage("Neue Antworten wurden vom anderen Gerät übernommen. Lade diese Seite neu, um sie hier anzuzeigen.");
        } else if (startup) {
          showMessage("Der Lernstand ist auf diesem Gerät aktuell.");
        }
        return true;
      } catch (error) {
        setStatus("Offline · lokal gespeichert");
        showMessage(`${error.message} Deine Antworten bleiben auf diesem Gerät gespeichert.`, true);
        return false;
      }
    }
    showMessage("Zu viele gleichzeitige Änderungen. Bitte synchronisiere noch einmal.", true);
    return false;
  }

  function finishBoot() {
    if (bootFinished) return;
    bootFinished = true;
    loadApps();
  }

  function loadApps() {
    if (loader?.dataset.appsLoaded === "true") return;
    if (loader) loader.dataset.appsLoaded = "true";
    let index = 0;
    const next = () => {
      if (index >= apps.length) return;
      const script = document.createElement("script");
      script.async = false;
      script.src = new URL(apps[index], assetBase).href;
      index += 1;
      script.onload = next;
      script.onerror = () => setStatus("Übung konnte nicht geladen werden", Boolean(readToken()));
      document.body.append(script);
    };
    next();
  }

  function installStorageHooks() {
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
      const result = setItem.call(this, key, value);
      if (this === localStorage && key.startsWith(profilePrefix) && !applyingRemote && readToken()) {
        setStatus("Änderungen werden gesichert …", true);
        clearTimeout(window.schoolSyncTimer);
        window.schoolSyncTimer = setTimeout(() => syncFromRemote(false), 650);
      }
      return result;
    };
    Storage.prototype.removeItem = function (key) {
      const result = removeItem.call(this, key);
      if (this === localStorage && key.startsWith(profilePrefix) && !applyingRemote && readToken()) {
        clearTimeout(window.schoolSyncTimer);
        window.schoolSyncTimer = setTimeout(() => syncFromRemote(false), 650);
      }
      return result;
    };
    window.addEventListener("storage", (event) => {
      if (event.key?.startsWith(profilePrefix)) syncFromRemote(false);
    });
  }

  function bootstrap() {
    renderDialog();
    installStorageHooks();
    const token = readToken();
    if (!token) {
      bootFinished = true;
      loadApps();
      return;
    }
    const pending = readMeta(pendingKey);
    if (pending) {
      showConflict(pending, true);
      return;
    }
    syncFromRemote(true).then(() => {
      if (!bootBlocked) finishBoot();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
