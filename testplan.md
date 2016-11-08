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
Create a bookmark                     | The bookmark can be jumped to when the video is played | Pass    |
Create a label                        | Label is shown at the time specified                   | Pass    |
Create some text to send user to url  | Text is shown time specified, satisfies description    | Pass    |
Create a table                        | Table is visible                                       | Pass    |
Create a link                         | Link sends user to specified destination               | Pass    |
Create an image as a button           | Image is shown as a button                             | Pass    | 
Create an image as a poster           | Image is shown as a poster                             | Pass    |
Create a Summary Task (last tab)      | Text is shown as specified                             | Pass    |



## Sub Content and Interactive Navigation

Check to see if the following can be added, testing their functionality is out of the scope of this testplan. 

Do not delete interactive content, they will be necessary for the final test cases.


Test Case Description        | Acceptance Criteria                               | Results | Comments
---------------------------- | --------------------------------------------------| --------| --------
Create 'statements'          | 'statements' statements are shown                 | Pass    |
Create a 'Single Choice Set' | 'Single Choice Set' is shown                      | Pass    |
Create 'Multiple Choice'     | 'Multiple Choice' is shown                        | Pass    |
Create 'True false'          | 'True False' is shown                             | Pass    |
Create 'Fill in the Blanks'  | 'Fill in the Blanks' is shown                     | Pass    | 
Create 'Drag and Drop'       | 'Drag and Drop' is shown                          | Pass    |
Create 'Mark the Words'      | 'Mark the Words' is shown                         | Pass    |
Create 'Drag Text'           | 'Drag Text' is shown                              | Pass    |
Create 'Questionnaire'       | 'Questionnaire' is shown                          | Pass    |
Create 'Crossroads' and set each option to a different time | Clicking on options takes users to specified times | Pass
Create 'Navigation hotspot'  | Clicking on hotspot takes users to specified time | Pass

## Adaptivity

Test Case Description                                     | Acceptance Criteria                         | Results | Comments
--------------------------------------------------------- | --------------------------------------------| --------| --------
Test action on all correct/wrong for 'Statements'         | Buttons are displayed, and will seek to correct time | Pass    |
Test action on all correct/wrong for 'Single Choice Set'  | Buttons are displayed, and will seek to correct time | Pass    |
Test action on all correct/wrong for 'Multiple Choice'    | Buttons are displayed, and will seek to correct time | Pass    |
Test action on all correct/wrong for 'True false'         | Buttons are displayed, and will seek to correct time | Pass    |
Test action on all correct/wrong for 'Fill in the Blanks' | Buttons are displayed, and will seek to correct time | Pass    |
Test action on all correct/wrong for 'Drag & drop'        | Buttons are displayed, and will seek to correct time | Pass    |
Test action on all correct/wrong for 'Mark the Words'     | Buttons are displayed, and will seek to correct time | FAIL    | Text is not shown on correct button 
Test action on all correct/wrong for 'Drag text'          | Buttons are displayed, and will seek to correct time | FAIL    | Text is not shown on adaptive buttons

## Behavioral Settings


Test Case Description                            | Acceptance Criteria                                          | Results | Comments
------------------------------------------------ | -------------------------------------------------------------| --------| --------
Set override "Show Solution" button to 'Disabled'| "Show Solution" button not visible for any sub content types | Pass    | 
Set overrride "Retry" button to 'Disabled'       | "Retry" button is disabled for all content types             | Pass    |
Enable "Start with bookmarks menu open"          | Bookmarks menu is visible at the start                       | Pass    |
Enable "Show button for rewinding ..."           | Button for rewinding is visible                              | Pass    |
