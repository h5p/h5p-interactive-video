var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.InteractiveVideo'] = (function ($) {
  return {
    1: {
      1: function (parameters, finished) {
        // Move interactions into assets container
        parameters.interactiveVideo.assets = {
          interactions: parameters.interactiveVideo.interactions,
          bookmarks: []
        };
        delete parameters.interactiveVideo.interactions;
        
        finished(null, parameters);
      }
    }
  };
})(H5P.jQuery);