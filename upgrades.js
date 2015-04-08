/** @namespace H5PUpgrades */
var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.InteractiveVideo'] = (function ($) {
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
       * @params {Function} finished
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
       * @params {Function} finished
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
      5: function (parameters, finished) {
        var interactions = parameters.interactiveVideo.assets.interactions;
        for (var i = 0; i < slides.length; i++) {
          if (interactions[i].action && interactions[i].action.subContentId === undefined) {
            // NOTE: We avoid using H5P.createUUID since this is an upgrade script and H5P function may change in the
            // future
            interactions[i].action.subContentId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(char) {
              var random = Math.random()*16|0, newChar = char === 'x' ? random : (random&0x3|0x8);
              return newChar.toString(16);
            });
          }
        }
        finished(null, parameters);
      }
    }
  };
})(H5P.jQuery);
