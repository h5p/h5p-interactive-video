/**
 * Determine whether H5P instance is task.
 * @param {H5P.ContentType} instance Instance candidate.
 * @returns {boolean} True, if instance is task.
 */
export const isInstanceTask = (instance = {}) => {
  if (typeof instance !== 'object' || instance === null) {
    return false;
  }

  if (typeof instance.isTask === 'boolean') {
    return instance.isTask; // Content will declare if it's task on its own.
  }

  // Check for hasShowSolutions as indicator for being task.
  const hasShowSolutions = (typeof instance.hasShowSolutions === 'function');
  if (hasShowSolutions) {
    return true;
  }

  // Check for maxScore > 0 as indicator for being task
  const hasGetMaxScore = (typeof instance.getMaxScore === 'function');
  if (hasGetMaxScore && instance.getMaxScore() > 0) {
    return true;
  }

  return false;
};
