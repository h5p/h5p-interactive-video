var H5PPresave = H5PPresave || {};
var H5PEditor = H5PEditor || {};


/**
 * Function to go through all elements of a Course Presentation and perform the separate calculations before returning a aggregated result
 *
 * @param {object} content
 * @param finished
 * @constructor
 */
H5PPresave['H5P.InteractiveVideo'] = function (content, finished) {
  var presave = H5PEditor.Presave;

  if (isContentInvalid()) {
    throw new presave.exceptions.InvalidContentSemanticsException('Invalid Interactive Video Error');
  }

  var librariesToCheck = [].concat(content.interactiveVideo.assets.interactions);

  if (hasSummary()) {
    librariesToCheck.push({action: content.interactiveVideo.summary.task});
  }

  var score = librariesToCheck
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

  finished({maxScore: score});

  /**
   * Check if required parameters is present
   * @return {boolean}
   */
  function isContentInvalid() {
    return !presave.checkNestedRequirements(content, 'content.interactiveVideo.assets.interactions') || !Array.isArray(content.interactiveVideo.assets.interactions);
  }

  /**
   * Check if required summary is present
   * @return {boolean}
   */
  function hasSummary() {
    return presave.checkNestedRequirements(content, 'content.interactiveVideo.summary.task.library') && presave.checkNestedRequirements(content, 'content.interactiveVideo.summary.task.params');
  }

};
