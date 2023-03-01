/** @namespace H5PUpgrades */
var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.InteractiveVideo'] = (function () {
  return {
    1: {
      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.1.
       *
       * Moves interactions into an assets container to be able to add more
       * properties to the video, i.e. a bookmark list
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      1: function (parameters, finished) {

        // Move interactions into assets container
        parameters.interactiveVideo.assets = {
          interactions: parameters.interactiveVideo.interactions,
          bookmarks: []
        };
        delete parameters.interactiveVideo.interactions;

        // Done
        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.3.
       *
       * Wraps summary in a container to be able to add IV specific options
       * to the summary task, i.e. when to display the task.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      3: function (parameters, finished) {

        // Move summary task into container
        parameters.interactiveVideo.summary = {
          task: parameters.interactiveVideo.summary,
          displayAt: 3
        };

        // Done
        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.5.
       *
       * Adds unique identifiers to sub content?
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      5: function (parameters, finished) {
        if (parameters.interactiveVideo && parameters.interactiveVideo.assets && parameters.interactiveVideo.assets.interactions) {
          var interactions = parameters.interactiveVideo.assets.interactions;
          for (var i = 0; i < interactions.length; i++) {
            if (interactions[i].action && interactions[i].action.subContentId === undefined) {
              // NOTE: We avoid using H5P.createUUID since this is an upgrade script and H5P function may change in the
              // future
              interactions[i].action.subContentId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
                var random = Math.random()*16|0, newChar = char === 'x' ? random : (random&0x3|0x8);
                return newChar.toString(16);
              });
            }
          }
        }
        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.7.
       *
       * Groups all UI text strings to make them eaiser to translate and handle.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      7: function (parameters, finished) {
        var i;
        parameters.l10n = {};

        var keys = ['interaction', 'play', 'pause', 'mute', 'quality', 'unmute', 'fullscreen', 'exitFullscreen', 'summary', 'bookmarks', 'defaultAdaptivitySeekLabel', 'playbackRate', 'rewind10'];
        for (i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (parameters.hasOwnProperty(key)) {
            parameters.l10n[key] = parameters[key];
            delete parameters[key];
          }
        }

        /* Move displayAsButton to displayType  */
        if (parameters.interactiveVideo && parameters.interactiveVideo.assets && parameters.interactiveVideo.assets.interactions) {
          var interactions = parameters.interactiveVideo.assets.interactions;
          for (i = 0; i < interactions.length; i++) {
            var interaction = interactions[i];
            interaction.displayType = (interaction.displayAsButton === undefined || interaction.displayAsButton) ? 'button' : 'poster';
            delete interaction.displayAsButton;

            // Set links displayType to poster
            if (interaction.action && interaction.action.library && interaction.action.library.split(' ')[0] === 'H5P.Link') {
              interaction.displayType = 'poster';
            }
          }
        }

        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.7.
       *
       * Groups all UI text strings to make them eaiser to translate and handle.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      10: function (parameters, finished) {
        if (parameters.override) {
          if (parameters.override.overrideButtons) {
            // Set new variables
            parameters.override.showSolutionButton =
                (parameters.override.overrideShowSolutionButton ? 'on' : 'off');
            parameters.override.retryButton =
                (parameters.override.overrideRetry ? 'on' : 'off');
          }

          // Remove old field variables
          delete parameters.override.overrideButtons;
          delete parameters.override.overrideShowSolutionButton;
          delete parameters.override.overrideRetry;
        }

        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       *
       * Groups start screen options under a group, hiding nonessential
       * information.
       *
       * Make existing posters have white background. I.e avoid existing posters
       * getting the new default, which is full transparency.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      11: function (parameters, finished) {
        if (parameters.interactiveVideo) {
          var videoParams = parameters.interactiveVideo.video;
          if (videoParams) {
            videoParams.advancedSettings = {};

            videoParams.startScreenOptions = videoParams.startScreenOptions || {};
            videoParams.advancedSettings.startScreenOptions = videoParams.startScreenOptions;
            videoParams.advancedSettings.startScreenOptions.poster = videoParams.poster;
            videoParams.advancedSettings.title = videoParams.title;
            videoParams.advancedSettings.copyright = videoParams.copyright;

            // Remove old fields
            delete videoParams.startScreenOptions;
            delete videoParams.poster;
            delete videoParams.title;
            delete videoParams.copyright;
          }

          if (parameters.interactiveVideo.assets && parameters.interactiveVideo.assets.interactions) {
            var interactions = parameters.interactiveVideo.assets.interactions;
            for (var i = 0; i < interactions.length; i++) {
              var interaction = interactions[i];

              // Set white background + boxShadow for images and textual posters:
              if (interaction && interaction.displayType === 'poster' && interaction.action && interaction.action.library) {
                var lib = interaction.action.library.split(' ')[0];
                if (['H5P.Text', 'H5P.Image', 'H5P.Table'].indexOf(lib) !== -1) {
                  interaction.visuals = {
                    backgroundColor: 'rgba(255,255,255,1)',
                    boxShadow: true
                  };
                }
                else if (lib === 'H5P.Link') {
                  interaction.visuals = {
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    boxShadow: true
                  };
                }
              }
            }
          }
        }

        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       *
       * Rename "Advanced settings: Interactive video" to "Start screen options"
       * Remove the group inside it that says "Video start screen options" and
       * puts options directly under the parent.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      12: function (parameters, finished) {

        function moveOldStartScreenOptions(video) {
          // Rename Advanced settings
          video.startScreenOptions = video.advancedSettings;

          // Remove old advanced settings
          delete video.advancedSettings;

          // Move old start screen options to parent
          video.startScreenOptions.poster = video.startScreenOptions.startScreenOptions.poster;
          video.startScreenOptions.hideStartTitle = video.startScreenOptions.startScreenOptions.hideStartTitle;
          video.startScreenOptions.shortStartDescription = video.startScreenOptions.startScreenOptions.shortStartDescription;

          delete video.startScreenOptions.startScreenOptions;

        }

        if (parameters.interactiveVideo && parameters.interactiveVideo.video) {
          moveOldStartScreenOptions (parameters.interactiveVideo.video);
        }

        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.17.
       *
       * Sets default value of new parameter buttonOnMobile
       * to true so that old content behaves correctly when transitioning
       * to small screens.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      17: function (parameters, finished) {

        if (parameters.interactiveVideo &&
            parameters.interactiveVideo.assets &&
            parameters.interactiveVideo.assets.interactions) {
          var interactions = parameters.interactiveVideo.assets.interactions;
          for (var i = 0; i < interactions.length; i++) {
            if (interactions[i].buttonOnMobile == undefined) {
              interactions[i].buttonOnMobile = true;
            }
          }
        }

        // Done
        finished(null, parameters);
      },

      20: function (parameters, finished, extras) {
        var title, copyright;

        if (parameters && parameters.interactiveVideo && parameters.interactiveVideo.video && parameters.interactiveVideo.video.startScreenOptions) {
          title = parameters.interactiveVideo.video.startScreenOptions.title;
          copyright = parameters.interactiveVideo.video.startScreenOptions.copyright;
        }

        extras = extras || {};
        extras.metadata = extras.metadata || {};
        extras.metadata.title = (title) ? title.replace(/<[^>]*>?/g, '') : ((extras.metadata.title) ? extras.metadata.title : 'Interactive Video');
        extras.metadata.licenseExtras = (copyright) ? copyright = copyright.replace(/<[^>]*>?/g, '') : ((extras.metadata.licenseExtras) ? extras.metadata.licenseExtras : undefined);

        finished(null, parameters, extras);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.21.
       *
       * Change data structure to allow new property defaultTrackLabel
       * inside textTracks group
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      21: function (parameters, finished) {
        if (parameters && parameters.interactiveVideo && parameters.interactiveVideo.video && parameters.interactiveVideo.video.textTracks) {
          parameters.interactiveVideo.video.textTracks = {
            videoTrack: parameters.interactiveVideo.video.textTracks
          };
        }
        finished(null, parameters);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support IV 1.25.
       *
       * Change data structure to increase skip prevention granularity
       *
       * @params {Object} parameters
       * @params {function} finished
       */
       25: function (parameters, finished) {
        if (parameters && parameters.override) {
          if (parameters.override.preventSkipping === true) {
            parameters.override.preventSkippingMode = 'both';
          }
          else {
            parameters.override.preventSkippingMode = 'none';
          }
          delete parameters.override.preventSkipping;
        }

        finished(null, parameters);
      }
    }
  };
})();
