# Metronome
This metronome is a single page application, consisting of multiple views
It allows for dynamically increasing bpm counts.  
Only one Page is visible at a time.  
For further informations see the sections below. 

## Page "Settings"
Allows setting up the application, by using the following settings:

### BPM (beats per minute)
Number input  
Default: 120

###  accentuate first beat
Checkbox  
Default: checked  
When checked, the following settings appear:

#### repeat after every x beat
Number input  
Default: 10

### increase tempo
Checkbox  
Default: checked  
when checked, the following settings appear:

#### increase by
Number input  
Updating the beats per minute automatically on the second page by a specified amount

#### increase after
Number input  
To define after how many beats the bpm should be increased

#### Maximum
A checkbox group To define, how the app should behave, when a specific value is reached
Available values:  
- "None"  
  Tempo increases without limit
- "Stick when met"  
  Once the BPM matches, it is no longer increased
- "Reset when met"  
  Contains an additional number field "Limit" to configure the limit. once the current BPM matches or is greater, it gets reset to the initial value from Field 1
- "Reverse when met"  
  Contains an additional number field "Limit", to configure the limit.  
  once the current BPM matches or is greater, it starts decreasing following the increase logic but with 2 additional fields "Decrease By", "Decrease After" to override the increasing values

#### Breaks
Checkbox group   
Values:
- "None"
- "Unlimited" (default)
- "Limited"  
  when checked, the following settings appear:
  - nullable Number input "Count"
  - text input "Seconds"  
    allowing following input filtered by regex:  
    either just a number  
    or  
    the text "BPM" followed by [+-*/] and a number > 0

#### Lock Settings
Checkbox  
only visible, when "increase tempo" is checked
when checked, another input "beats" gets visibile and navigating back from view "execution" to "settings" is only possible, once this amount of beats was executed.

#### Start
Button  
the application navigates to view "execution"

## View "Execution"
Starts by displaying a count down from 3 and playing 3 tones seperated by 1 second, to inform the user about the upcoming start.
once started, the BPM are executed as configured.  
Following elements are displayed during execution

### BPM
displays the current BPM

### {Next BPM} in
only visible when increasing was set  
displays the number of beats until next increase

### Pause
Only visible, when Settings "Breaks" is not "None"  
When clicked, the metronome is paused. Once clicked, the following scenarios are possible: 
- When a Count limit was configured, the button contains a text "x left". when no break is left, the button color changes to read. it can still be clicked, but the amount of exceeding clicks is counted and displayed in the button.  
- When a time limit was configured, the button shows the remaining time limit. the user can end the break manually, but when the time limit is reached, the break ends automatically
- When no count or time limit was set, the user has to manually end the break

### Stop
navigates to view "Report".  
when "lock settings" was set, the button is disabled and contains a text "x beats left", telling the user when the button will be available.  

## View "Report"
this view shows:
- a summary of the settings in text form
- how many beats were executed in total
- at which beats a break was used (and which bpm was active a that time)

it contains a button "Back to settings" to go back to the first view