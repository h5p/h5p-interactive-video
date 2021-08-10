# Advance Interactive Video

## Installation

To install the additional features such as the Kaltura, Youtube and Vimeo Pro playlist follow the below instructions.

```
# For Kaltura integration:-

1) There is a folder KalturaGeneratedAPIClientsPHP place this 
   into your Project's root directory and copy its Path.

2) Now open this folder and inside 'get-kaltura-playlist.php'
   file add your Kaltura account login details.

3) Open custom-integration.js file inside the src/scripts and 
   replace the {DIRECTORY_PATH} with your copied path.

#For Youtube and Vimeo Pro Integration:-

Open src/scripts/config.js file and add your youtube API key
and channel Id. Whereas, for Vimeo pro you need to add token and channel ID.

```