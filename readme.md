# Metronome

This metronome is a single-page application with three views:

- Settings
- Execution
- Report

Only one view is visible at a time. The application is implemented with plain
JavaScript, with all markup in `index.html` and all behavior in
`metronome.js`.

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

### BPM (beats per minute)

Whole-number input.

- Default: 120
- Allowed starting range: 20-300

### Accentuate first beat

Checkbox, enabled by default. When enabled, the first beat and every configured
interval are accented.

#### Repeat accent every N beats

Whole-number input inside the Accentuate option card.

- Default: 10
- Minimum: 1

### Increase tempo

Checkbox, enabled by default. Its dependent settings remain visible inside the
Increase tempo option card and are disabled when the checkbox is unchecked.

#### Increase by

Whole-number BPM increment.

- Default: 1
- Allowed range: 1-20

#### Increase after

Whole-number beat interval.

- Default: 10
- Minimum: 1

#### Maximum

Radio options. Each option has its own bordered card and preserves its own
values.

- **None**: tempo increases without a configured limit.
- **Stick when met**: the tempo holds at the configured limit.
- **Reset when met**: the next beat uses the initial BPM after the limit is
  reached.
- **Reverse when met**: the tempo reaches the limit, then decreases using its
  own Decrease By and Decrease After values before cycling again.

Limit inputs accept whole numbers from 60-400 and must be greater than the
starting BPM. Reverse values use the following defaults:

- Decrease By: 1 BPM, allowed range 1-50
- Decrease After: 10 beats, minimum 1

### Breaks

Radio options. Each option is displayed in its own bordered card.

- **None**: the Pause control is unavailable during execution.
- **Unlimited**: pauses are allowed without a count limit.
- **Limited**: Count and Seconds remain visible in the Limited card and are
  active when Limited is selected.

Count accepts a blank value or a positive whole number. Seconds accepts a
positive whole number, or an expression such as `BPM/2`, `BPM+5`, `BPM-2`, or
`BPM*1.5`.

### Session end

The **End session automatically** checkbox is unchecked by default. Its
dependent **End after (beats)** input remains visible and is disabled until
the checkbox is selected.

- Default value: 100 beats
- Minimum: 1 beat
- Counts completed audible metronome beats only
- The session ends immediately after the configured beat, even when the
  manual Stop button is still locked

#### Lock

Checkbox in the Session end section. Its beat threshold is always visible and
becomes active when Lock is selected.

- Default: unchecked
- Default threshold: 10 beats
- When automatic session end is also enabled, Lock must be less than or equal
  to the automatic end threshold

### Start

The Start button validates the active settings and navigates to the Execution
view.

## View "Execution"

The view starts with a visible 3, 2, 1 countdown and three tones separated by
one second. It then executes the configured tempo.

During the initial countdown, **Abort** cancels the run immediately and returns
to Settings without creating a report. Form values are preserved. Stop is
available after the first beat starts.

The view displays:

- During startup, Countdown and Initial BPM in the two metric cards
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
- Total completed beats
- Each break's beat number, active BPM, allowance status, and end reason

The settings summary uses **Settings locked** with the value
`until N beats are passed` when locking is enabled. It also reports whether
the session ended manually or automatically after a configured number of
beats.

The Ended column records durations for breaks, such as
`Auto-resumed after 30 seconds` or `Manually resumed after 5 seconds`.

The **Copy to clipboard** button copies all report information as labeled plain
text. Each item is separated by a newline, with a separate newline-delimited
section for break records. The button announces success or failure and returns
to its normal label after a successful copy.

The **Back to settings** button returns to the Settings view while preserving
the form values for another run.
