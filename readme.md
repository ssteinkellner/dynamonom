# Metronome

This metronome is a single-page application with three views:

- Settings
- Execution
- Report

Only one view is visible at a time. The application is implemented with plain
JavaScript, with all markup in `index.html` and all behavior in
`metronome.js`. Preset definitions are kept in `presets.js`.

## Local development and phone installation

The project uses Vite with `src` as its application root. Install the
development dependency and start the LAN-accessible server with:

```text
npm install
npm run dev
```

Vite listens on port `5173` on all network interfaces. On a phone connected to
the same network, open `http://<computer-ip>:5173`. The computer's firewall
must allow incoming connections on that port.

The app includes a web app manifest, generated icons, standalone display
metadata, and a service worker for offline caching. Browsers may require HTTPS
before offering a full PWA installation prompt; over local HTTP, use the
browser's **Add to Home Screen** action if it is available. The Vite preview
server is also available with `npm run build` followed by `npm run preview`.

## View "Settings"

The settings view configures the run. Dependent settings are kept visible in
bordered option cards. When a parent checkbox or radio option is inactive, its
dependent inputs remain visible but are disabled. Values are preserved when
switching options. Checkbox cards keep their controls on one compact horizontal
value row below the checkbox label; long value rows can be scrolled
horizontally on narrow screens. Each field uses a vertical input wrapper for
its label, input, hint, and validation message. The Increase tempo card places
its checkbox and two primary values in one row, then stacks the Maximum groups
below a separator. Inputs within each group remain side by side.

### Presets

Preset buttons are generated from the dictionary in `presets.js`. Clicking a
preset applies its values and starts the session immediately. Each preset entry
supplies a `label` and a `values` object using the settings names from the
form. Add or remove presets by editing the dictionary in `presets.js`.

The **Import** field accepts a bare URL parameter list, a list with a leading
`?`, or a full URL. Settings are applied as the text changes. Unparseable
strings and invalid values are ignored without a message. The **Export
settings** button writes the current settings as a bare URL parameter list
into the Import field and copies it to the clipboard. The same recognized
parameters are applied automatically when they are present in the page URL;
loading parameters does not start a session. Settings feedback, including
clipboard confirmations, remains visible while scrolling.

### BPM (beats per minute)

Whole-number input.

- Default: 120
- Allowed starting range: 20-300

### Accentuate every N beats

Inline checkbox and whole-number input, enabled by default. When enabled, the
first beat and every configured interval are accented.

- Default: 10
- Minimum: 1

### Increase tempo

Inline checkbox and a summary button phrased **by N BPM every N beats**,
enabled by default. Activating the button opens a shared dialog for the two
values. Save validates and applies the values; Cancel restores the previous
values. The button remains visible but disabled when its parent option is
unchecked.

- Increase by: default 1 BPM, allowed range 1-20
- Increase after: default 10 beats, minimum 1

#### Maximum

Radio options. Each option has its own bordered card and preserves its own
values. The options are phrased inline as **Limit at N**, **Reset at N**, and
**Reverse at N**, followed by a summary button for the decrease values.

- **None**: tempo increases without a configured limit.
- **Limit at N**: the tempo holds at the configured limit.
- **Reset at N**: the next beat uses the initial BPM after the limit is
  reached.
- **Reverse at N**: the tempo reaches the limit, then decreases before
  cycling again. Its summary button opens the same two-value dialog for the
  decrease amount and interval.

Limit inputs accept whole numbers from 60-400 and must be greater than the
starting BPM. Reverse values use the following defaults:

- Decrease By: 1 BPM, allowed range 1-50
- Decrease After: 10 beats, minimum 1

### Breaks

Radio options. Each option is displayed in its own bordered card.

- **None**: the Pause control is unavailable during execution.
- **Unlimited**: pauses are allowed without a count limit.
- **Limited**: Count and Seconds remain visible in the Limited card and are
  active when Limited is selected. The Limited option stays vertically
  organized while Count and Seconds share one horizontal value row.

Count accepts a blank value or a positive whole number. Seconds accepts a
positive whole number, or an expression such as `BPM/2`, `BPM+5`, `BPM-2`, or
`BPM*1.5`.

### Session end

The unchecked-by-default option is phrased **End session automatically after N
beats**. Its value remains visible and is disabled until the checkbox is
selected.

- Default value: 100 beats
- Minimum: 1 beat
- Counts completed audible metronome beats only
- The session ends immediately after the configured beat, even when the
  manual Stop button is still locked

#### Lock

The unchecked-by-default option is phrased **Lock Stop until N beats**. Its
value remains visible and is disabled until Lock is selected.

- Default: unchecked
- Default threshold: 10 beats
- When automatic session end is also enabled, Lock must be less than or equal
  to the automatic end threshold

### Start

The Export settings button is positioned to the left of Start. Start validates
the active settings and navigates to the Execution view.

## View "Execution"

The view starts with a visible 3, 2, 1 countdown and three tones separated by
one second. It then executes the configured tempo.

During the initial countdown, **Abort** cancels the run immediately and returns
to Settings without creating a report. Form values are preserved. Stop is
available after the first beat starts.

The view displays:

- During startup, **Starting in** and Initial BPM in the two metric cards
- After startup, Current BPM and the next BPM change
- The next BPM change and its beat countdown when tempo progression is active
- Completed beat count
- Pause and Stop controls

For a timed break, the final available seconds are announced with the same
countdown tone used at startup. A 3-second-or-longer break announces 3, 2, 1;
shorter breaks announce every available second without extending the break.
The user can still resume manually during this countdown.
The countdown value is shown inside the Resume button while it is active.

## View "Report"

The report displays:

- A summary of the effective settings
- A combined BPM summary with the starting BPM, progression, and maximum
  information
- Total completed beats
- Each break's beat number, active BPM, allowance status, and end reason

The summary omits settings configured as **None**. When Lock is enabled, its
`Settings locked until N beats are passed` text is combined into the **Session
end** value, which also reports whether the session ended manually or
automatically after a configured number of beats.

The Ended column records durations for breaks, such as
`Auto-resumed after 30 seconds` or `Manually resumed after 5 seconds`.
When a break time limit is configured, the report's break section is labeled
`Breaks used (max Ns):` with the configured limit.

The **Copy to clipboard** button copies all report information as labeled plain
text. Each item is separated by a newline, with a separate newline-delimited
section for break records. The button announces success or failure and returns
to its normal label after a successful copy. Report feedback, including the
clipboard confirmation, remains visible while scrolling.

The **Copy short to Clipboard** button copies a compact summary with the total
beat count, BPM range, and progression tokens on the first line. When breaks
were used, `Pausen bei:` is added, followed by one beat and used
duration per line, such as:

```text
Pausen bei:
- 45 (30s)
- 71 (5s)
```

The **Back to settings** button returns to the Settings view while preserving
the form values for another run.
