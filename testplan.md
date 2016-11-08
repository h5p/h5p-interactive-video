# Interactive Video Testplan

## Uploading/embedding 

Test Case Description                 | Acceptance Criteria                                 | Results | Comments
------------------------------------- | ----------------------------------------------------| --------| --------
Create empty IV                       | Error message :"Video is missing sources." is shown | Pass    |  
Upload mp4 file  		                  | No errors shown                                     | Pass    |
Replace mp4 file with webm file       | No errors shown                                     | Pass    |
Replace mp4 file with a youtube link  | No errors shown                                     | Pass    |
Upload a poster image (any file type) | Poster is shown before the video is played          | Pass    |


## Static changes

(It's easier to create all the interactions before saving the video) 

Test Case Description                 | Acceptance Criteria                                    | Results | Comments
------------------------------------- | -------------------------------------------------------| --------| --------
Create a bookmark                     | The bookmark can be jumped to when the video is played |         |
Create a label                        | Label is shown at the time specified                   | 
Create some text to send user to url  | Text is shown time specified, satisfies description    |
Create a table                        | Table is visible                                       |
Create a link                         | Link sends user to specified destination               |
Create an image as a button           | Image is shown as a button                             |
Create an image as a poster           | Image is shown as a poster                             |
Create a Summary Task (last tab)      | Text is shown as specified                             |



## Sub Content and Interactive Navigation

Check to see if the following can be added, testing their functionality is out of the scope of this testplan. 

Do not delete interactive content, they will be necessary for the final test cases.


Test Case Description | Acceptance Criteria | Results | Comments
--------------------- | --------------------| --------| --------
Create 'statements'   | 'statements' statements are shown
Create a 'Single Choice Set'   | 'Single Choice Set' is shown
Create 'Multiple Choice'   | 'Multiple Choice' is shown
Create 'Fill in the Blanks'   | 'Fill in the Blanks' is shown
Create 'Drag and Drop' | 'Drag and Drop' is shown 
Create 'Mark the Words' | 'Mark the Words' is shown
Create 'Drag Text' | 'Drag Text' is shown 
Create 'Questionnaire' | 'Questionnaire' is shown 
Create 'Crossroads' and set each option to a different time | Clicking on options takes users to specified times
Create 'Navigation hotspot' | Clicking on hotspot takes users to specified time

## Behavioral Settings


Test Case Description | Acceptance Criteria | Results | Comments
--------------------- | --------------------| --------| --------
Set override "Show Solution" button to 'Disabled'| "Show Solution" button not visible for any sub content types
Set overrride "Retry" button to 'Disabled' | "Retry" button is disabled for all content types
Enable "Start with bookmarks menu open" | Bookmarks menu is visible at the start
Enable "Show button for rewinding ..." | Button for rewinding is visible
