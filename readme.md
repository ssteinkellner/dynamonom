# Metronom

## TODO

copilot please ignore this section.

- add "Lock abort" for exports

This is a browser-based metronome and ordered action runner. The application
uses plain JavaScript, with markup in `src/index.html`, behavior in
`src/metronome.js`, action data helpers in `src/action-model.js`, and built-in
presets in `src/presets.js`.

## Local development and phone installation

The project uses Vite with `src` as its application root:

```text
npm install
npm run dev
```

Vite listens on port `5173` on all network interfaces. A phone on the same
network can open `http://<computer-ip>:5173`; the computer's firewall must
allow incoming connections on that port. The app includes a web app manifest,
icons, standalone display metadata, and a service worker for offline caching.
Browsers may require HTTPS for a full installation prompt; over local HTTP, use
the browser's **Add to Home Screen** action when available. To run a production
preview, use `npm run build` followed by `npm run preview`.

## Presets and settings

The **Metronom - Voreinstellungen** view is shown on page load. Its single
vertical card contains the Import field, preset buttons, and **Manuell**.
Selecting a preset loads its ordered actions; presets with `autoStart: true`
start immediately. **Manuell** opens Settings.

The Settings view contains an ordered **Aktionen** table. Drag rows or use
Alt+Arrow keys to reorder them. Add an action with the plus button; choosing
its type opens its editor below the table. Action names are required and
unique, ignoring case. Editing is transactional: **Bestätigen** saves the
draft, **Abbrechen** discards it, and errors keep the editor open. Changing
actions, leaving Settings, starting, or exporting is blocked or confirmed as
appropriate while a draft is unresolved. The table can be empty while editing,
but starting requires at least one **Metronom** action.

**Globale Einstellungen** includes the unchecked-by-default **Fortschritt
ausblenden** option. Progress is otherwise shown as **Aktion n von N** on
each execution view.

### Action types

- **Metronom** has separate **Tempo**, **Pausen**, and **Ende** sections. Each
  metronome action starts with a fresh 3-2-1 countdown and resets its beat,
  tempo, and pause counters. **Weiter** ends that action and stays disabled
  until its configured lock threshold; an automatic Ende advances to the next
  action.
- **Sekunden** accepts a whole-number duration from 1 to 600 seconds and
  advances automatically when it expires. Continuing more than 10 seconds
  early requires confirmation.
- **Stoppuhr** counts elapsed time until **Weiter**. Its formula supports
  `minuten`, `summe-minuten`, `sekunden`, and `rest-sekunden`, whole-number
  literals, `+`, `-`, `*`, `/`, parentheses, and whitespace. Minute rounding
  is configured per action as floor, ceil, or round (30 seconds by default).
  A single integer literal has no Min/Max bounds. Other formulas use a
  required minimum (default 10 beats) and an optional maximum. Valid results
  are clamped to those bounds; an invalid runtime result uses that action's
  minimum.
- **Manuell** waits for **Weiter**. An optional 1-600 second limit is shown
  while running but never advances the action automatically.

Stoppuhr results since the previous Metronom are applied to the next
Metronom: each result is bounded or falls back independently, then the values
are summed to determine both automatic Ende and the Weiter lock. When such a
Stoppuhr group precedes a Metronom, that action's manual Ende and lock controls
are disabled with a note naming the source actions. Stoppuhren after the final
Metronom remain report-only.

### Settings import and export

The Import field accepts a bare query string, one prefixed with `?`, or a full
URL. It is processed when text is pasted or Enter is pressed. The versioned
format requires `version=1`, an explicit `auto-start=true|false`, and an
`actions` JSON array. `hide-progress=true` is optional and defaults to false.
Each action contains a type, name, and settings object; local action IDs are
generated when imported. Legacy flat settings and the former `pre-timers`
payload are not supported.

For example, the query has this shape (the browser-encoded value of `actions`
is longer):

```text
version=1&auto-start=false&actions=[{"type":"metronom","name":"Metronom","settings":{...}}]
```

The export controls copy either the parameter list or the current page URL with
its query replaced by the settings. Auto-Start is explicit in both formats;
the progress option is included only when enabled. Export is blocked until an
open action editor is confirmed or canceled. A copied import with
`auto-start=true` starts immediately when valid; an import with false opens
Settings. Invalid data is retained and shown in an import-error section, and
manual Start remains available after the actions are corrected.

## Execution and reports

Actions run in table order, each in its own view. **Abbrechen** is available
on every action view; after confirmation, the report contains all actions,
marks the current one aborted, and marks later actions as not started.

The report has one section per action, in execution order, titled
`<action type> - <action name>`. Metronome sections include tempo, pauses,
ending/lock details, and used breaks; Stoppuhr sections include the formula,
rounding, bounds, and applied result.

The long-copy report follows the UI and separates sections with headings such
as `**Metronom - Warm-up**`. The short-copy report uses `**<action name>**`
followed by one compact line containing that action's parameters and outcome.
For each Metronom, the next line is exactly **Keine Pausen gebraucht** when
there were no breaks, or starts with **Pausen gebraucht bei:** followed by the
used break list.

Report buttons are arranged in two rows: the copy actions first, then **Zurück
zu Voreinstellungen**, **Zurück zu Einstellungen**, and **Wiederholen**.
**Kurzbericht in Zwischenablage kopieren** and **Wiederholen** use the primary
style. Repeat starts a fresh sequence with the configured actions.
