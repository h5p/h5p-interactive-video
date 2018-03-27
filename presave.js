var H5PPresave = H5PPresave || {};
var H5PEditor = H5PEditor || {};


/**
 * Function to go thr all elements of a Course Presentation and perform the separate calculations before returning a aggregated result
 *
 * @param content
 * @param finished
 * @constructor
 */
H5PPresave['H5P.InteractiveVideo'] = function (content, finished) {
  var presave = H5PEditor.Presave;

  if (isContentInValid(content)) {
    throw new presave.exceptions.InvalidContentSemanticsException('Invalid Interactive Video Error')
  }

  var score = content.interactiveVideo.assets.interactions
    .map(function (element) {
      if (element.hasOwnProperty('action')) {
        return element.action;
      }
      return {};
    })
    .filter(function (action) {
      return action.hasOwnProperty('library') && action.hasOwnProperty('params');
    })
    .map(function (action) {
      return (new presave).process(action.library, action.params).maxScore;
    })
    .reduce(function (currentScore, scoreToAdd) {
      if (presave.isInt(scoreToAdd)) {
        currentScore += scoreToAdd;
      }
      return currentScore;
    }, 0);

  presave.validateScore(score);

  if (finished) {
    finished({maxScore: score});
  }

  function isContentInValid(content) {
    return !presave.checkNestedRequirements(content, 'content.interactiveVideo.assets.interactions') || !Array.isArray(content.interactiveVideo.assets.interactions);
  }
};
