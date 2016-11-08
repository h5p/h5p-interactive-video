# Interactive Video Testplan

## Uploading/embedding 

Test Case Description                 | Acceptance Criteria                                 | Results | Comments
------------------------------------- | ----------------------------------------------------| --------| --------
Create empty IV                       | Error message :"Video is missing sources." is shown |         |  
Upload mp4 file  		                  | No errors shown                                     |         |
Replace mp4 file with webm file       | No errors shown                                     |         |
Replace mp4 file with a youtube link  | No errors shown                                     |         |
Upload a poster image (any file type) | Poster is shown before the video is played          |         |


## Static changes

(It's easier to create all the interactions before saving the video) 

Test Case Description                 | Acceptance Criteria                                    | Results | Comments
------------------------------------- | -------------------------------------------------------| --------| --------
Create a bookmark                     | The bookmark can be jumped to when the video is played |         |
Create a label                        | Label is shown at the time specified                   |         |
Create some text to send user to url  | Text is shown time specified, satisfies description    |         |
Create a table                        | Table is visible                                       |         |
Create a link                         | Link sends user to specified destination               |         |
Create an image as a button           | Image is shown as a button                             |         | 
Create an image as a poster           | Image is shown as a poster                             |         |
Create a Summary Task (last tab)      | Text is shown as specified                             |         |



## Sub Content and Interactive Navigation

Check to see if the following can be added, testing their functionality is out of the scope of this testplan. 

Do not delete interactive content, they will be necessary for the final test cases.


Test Case Description | Acceptance Criteria | Results | Comments
--------------------- | --------------------| --------| --------
Create 'statements'   | 'statements' statements are shown
Create a 'Single Choice Set'   | 'Single Choice Set' is shown
Create 'Multiple Choice'   | 'Multiple Choice' is shown
Create 'True false'   | 'True False' is shown
Create 'Fill in the Blanks'   | 'Fill in the Blanks' is shown
Create 'Drag and Drop' | 'Drag and Drop' is shown 
Create 'Mark the Words' | 'Mark the Words' is shown
Create 'Drag Text' | 'Drag Text' is shown 
Create 'Questionnaire' | 'Questionnaire' is shown 
Create 'Crossroads' and set each option to a different time | Clicking on options takes users to specified times
Create 'Navigation hotspot' | Clicking on hotspot takes users to specified time

## Adaptivity

Test Case Description                                     | Acceptance Criteria                         | Results | Comments
--------------------------------------------------------- | --------------------------------------------| --------| --------
Test action on all correct/wrong for 'Statements'         | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'Single Choice Set'  | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'Multiple Choice'    | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'True false'         | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'Fill in the Blanks' | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'Drag & drop'        | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'Mark the Words'     | Buttons are displayed, and will seek to correct time |         |
Test action on all correct/wrong for 'Drag text'          | Buttons are displayed, and will seek to correct time |         | 


## Require completion (all types except Statements)

Test Case Description                                     | Acceptance Criteria                         | Results | Comments
--------------------------------------------------------- | --------------------------------------------| --------| --------
Set wrong adaptivity, and choose "require completion"     | Wrong adaptivity is not shown
Add two "required completion" interactions at same second | 
Click outside "require completion" interaction            | Mask with warning should display in front
Turn on fullscreen before entering interaction. Scale screen to mobile size, and then  to normal | Mask over video and controls should remain

## Behavioral Settings


Test Case Description | Acceptance Criteria | Results | Comments
--------------------- | --------------------| --------| --------
Set override "Show Solution" button to 'Disabled'| "Show Solution" button not visible for any sub content types
Set overrride "Retry" button to 'Disabled' | "Retry" button is disabled for all content types
Enable "Start with bookmarks menu open" | Bookmarks menu is visible at the start
Enable "Show button for rewinding ..." | Button for rewinding is visible
