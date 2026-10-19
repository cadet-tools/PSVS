# Kopīgā MI starpnieks

Šī mape ir **Google Apps Script** kods un lokālie testi. Pilnā rokasgrāmata (ko neskart, atslēgas, būvēšana, kvalitāte): **[docs/MI.md](../MI.md)**.

| Fails | Loma |
|---|---|
| `Kods.gs` | Starpnieks → Groq. Ielīmē Apps Script. `RULES` = `src/js/ai.js`. |
| `mimock.js` | `node docs/mi/mimock.js [ports]` — izpilda šo `Kods.gs` + pasniedz rīku |
| `mi_test.mjs` | `node docs/mi/mi_test.mjs` — RULES + limiti bez īstas atslēgas |

`GROQ_KEY` ir tikai skripta rekvizītos vai `mimock` vidē. Repo to neliek.
