# Thea Aquamarine Französisch 2. Klasse

Eigenes Git-Repository für Französisch-Übungsmaterial für Thea Aquamarine.

Kontext:

- Schülerin: Thea Aquamarine
- Schule: Judith Kerr Grundschule, Berlin
- Klasse: 2c
- Track: Deutsch-Track, also Französisch nicht als Muttersprache
- Ziel: spielerische, kurze Französisch-Übungen für die 2. Klasse

## Ordner

- `site/` - interaktive Übungswebsite mit Speicherstand und Übersicht
- `arbeitsblaetter/` - spätere druckbare Arbeitsblätter
- `lernzettel/` - spätere kompakte Wiederholungszettel
- `hinweise/` - pädagogische Notizen und Codex-Anweisungen

## Website lokal starten

```sh
python3 -m http.server 8766 --bind 0.0.0.0
```

Dann ist die Website im selben WLAN erreichbar, zum Beispiel:

`http://<mac-ip>:8766/`
