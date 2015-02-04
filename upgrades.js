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
      }
    }
  };
})(H5P.jQuery);
