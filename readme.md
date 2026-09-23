# Metronom

## TODO

copilot please ignore this section.

- add "Lock abort" for exports

This is a browser-based metronome and ordered action runner built with Vue 3,
TypeScript, and Pinia. `src/main.ts` mounts `src/App.vue`, which coordinates the
presets, settings, execution, and report views without a router. The
settings/action editors and each action's execution view are separate Vue
components under `src/components/`.

Typed action/timer models, the formula AST and evaluator, metronome validation,
built-in presets, settings transfer, and report text are implemented in
`src/action-model.ts`, `src/formula-model.ts`, `src/formula-engine.ts`,
`src/models/`, and `src/presets.ts`. Each formula node's UI is a separate
component under `src/components/formula/`. The Pinia session store is in
`src/stores/metronome.ts`; browser audio and timer resources are managed by
`src/services/session-engine.ts`. The standalone service worker, manifest, and
icons remain under `src/public/`.

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

## Tests and typechecking

Run the test suite with `npm test` (or use `npm run test:watch` while
developing). Run strict TypeScript checks with `npm run typecheck`; production
builds run the same check before Vite bundles the app.

## Presets and settings

The **Metronom - Voreinstellungen** view is shown on page load. Its single
vertical card contains the Import field, preset buttons, and **Manuell**.
Selecting a preset loads its ordered actions; presets with `autoStart: true`
start immediately. **Manuell** opens Settings.

The Settings view contains an ordered **Aktionen** table. Drag rows or use
Alt+Arrow keys to reorder them. Add an action with the full-width
**Aktion hinzufügen** dropdown; choosing a type opens its editor below the
table and resets the dropdown. Action names are required and unique, ignoring
case. Editing is transactional: **Bestätigen** saves the draft,
**Abbrechen** discards it, and errors keep the editor open. Changing actions,
leaving Settings, starting, or exporting is blocked or confirmed as appropriate
while a draft is unresolved. The table can be empty while editing, but
starting requires at least one **Metronom** action. The **Zurück zu den
Voreinstellungen** and **Starten** buttons appear below the final settings
section.

**Globale Einstellungen** includes the unchecked-by-default **Fortschritt
ausblenden** option. Progress is otherwise shown as **Aktion n von N** on
each execution view.

### Action types

- **Metronom** has separate **Tempo**, **Pausen**, and **Ende** sections. Each
  metronome action starts with a fresh 3-2-1 countdown and resets its beat,
  tempo, and pause counters. **Weiter** ends that action and stays disabled
  until its configured lock threshold; an automatic Ende advances to the next
  action. Tempo, pause, and end settings use the visual formula editor.
- **Sekunden** uses a formula-based duration from 1 to 600 seconds and
  advances automatically when it expires. Continuing more than 10 seconds
  early requires confirmation.
- **Stoppuhr** only measures elapsed time until **Weiter**. Its result can be
  referenced by formulas in later actions; it does not automatically set a
  later Metronome's end or lock.
- **Manuell** waits for **Weiter**. An optional 1-600 second limit is shown
  while running but never advances the action automatically. The limit can
  also be a formula.

Every editable numeric setting opens the drag-and-drop formula editor. Palette
items create formula nodes; existing nodes can be moved between empty drop
zones, staged in **Merken**, or removed through **Löschen**. The formula must
be complete and the Remember area empty before it can be confirmed. Each
number setting has an unremovable hard range; its visible formula bounds can
only tighten that range. Non-static expressions receive a field-specific
fallback value automatically.

Available nodes are integer numbers, `+`, `-`, `*`, `/`, Clamp, Fallback,
Reference, Round, and Aktuell. References select any earlier action for
elapsed-time values (Minuten, Summe Minuten, absolute seconds, and remaining
seconds); End-BPM is available only for earlier Metronome actions. Minuten
uses exact elapsed minutes, and Summe Minuten is the triangular sum of those
minutes. Round accepts only Minuten or Summe Minuten and rounds elapsed minutes
using a seconds threshold from 0 to 60 (default 30); for Summe Minuten, the
triangular sum is calculated after rounding. Aktuell can refer to another
enabled numeric setting of the same action. Pause-duration formulas can also
read live BPM and are evaluated each time a break begins. Formulas that create
a Current-property cycle block session start. Removing or reordering an action
that would invalidate a reference is rejected.

### Settings import and export

The Import field accepts a bare query string, one prefixed with `?`, or a full
URL. It is processed when text is pasted or Enter is pressed. The versioned
format requires `version=1`, an explicit `auto-start=true|false`, and an
`actions` JSON array. `hide-progress=true` is optional and defaults to false.
Each action contains its ID, type, name, and settings object, including its
formula trees. Existing IDs are preserved on import so formula references
remain valid; an ID is generated when an imported action does not have one.
Legacy flat settings and the former `pre-timers` payload are not supported.

For example, the query has this shape (the browser-encoded value of `actions`
is longer):

```text
version=1&auto-start=false&actions=[{"id":"action-id","type":"metronom","name":"Metronom","settings":{...}}]
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
`<action type> - <action name>`. Sections include each action's resolved
settings. Long reports also show formula expressions, resolved values,
fallbacks, clamp adjustments, and used breaks.

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
