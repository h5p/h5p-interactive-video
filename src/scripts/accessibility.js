/**
 * Returns true if the value is not contained in the array
 *
 * @template T
 * @param {Array.<T>} arr
 * @param {T} val
 * @return {boolean}
 */
const contains = (arr, val) => (arr.indexOf(val) !== -1);

/**
 * @const {string}
 */
const NO_ANNOUNCEMENT = '';

/**
 * @class
 * Makes it easier to manage accessibility
 */
export default class Accessibility {

  /**
   * Translations for assistive technologies
   *
   * @typedef {Object} IVAccessibilityTranslations
   * @property {string} singleInteractionAnnouncement
   *    Prefix for announcing interaction by its title
   * @property {string} multipleInteractionsAnnouncement
   *    Lets user know there is multiple interactions available
   * @property {string} videoPausedAnnouncement
   *    Lets user know that video was paused by interaction(s)
   */

  /**
   * Initialize elements needed to manage accessibility
   * @param {IVAccessibilityTranslations} l10n
   */
  constructor(l10n) {
    this.l10n = l10n;

    // Create interactions announcer
    const announcer = document.createElement('div');
    announcer.classList.add('h5p-iv-interactions-announcer');
    announcer.setAttribute('aria-live', 'polite');
    this.interactionsAnnouncer = announcer;
  }

  /**
   * Get element which announces which interactions appears
   * @return {Element|*}
   */
  getInteractionAnnouncer() {
    return this.interactionsAnnouncer;
  }

  /**
   * Determine the correct announcement from a list of interactions
   * @param {H5P.InteractiveVideoInteraction[]} interactions
   */
  announceInteractions(interactions) {
    if (interactions.length > 0) {
      this.interactionsAnnouncer.textContent = ''; // reset content
      this.interactionsAnnouncer.textContent = `
        ${this.getAnnouncementMessage(interactions.length)}
        ${this.getTitleAnnouncement(interactions.length, interactions[0])}
        ${this.getPauseAnnouncement(interactions)}`;
    }
  }

  /**
   * Returns the appropriate announcement message
   *
   * @param {number} newInteractionCount
   * @return {string}
   */
  getAnnouncementMessage(newInteractionCount) {
    if (newInteractionCount === 0) {
      return NO_ANNOUNCEMENT;
    }
    else if (newInteractionCount === 1) {
      return this.l10n.singleInteractionAnnouncement;
    }
    else {
      return this.l10n.multipleInteractionsAnnouncement;
    }
  }

  /**
   * Returns the title of the content, if only single content appears
   *
   * @param {number} newInteractionCount
   * @param {H5P.InteractiveVideoInteraction} interaction
   * @return {string}
   */
  getTitleAnnouncement(newInteractionCount, interaction) {
    return  (newInteractionCount === 1) ? interaction.getTitle() : NO_ANNOUNCEMENT;
  }

  /**
   * Returns the paused announcement, if any of the newly appeared interactions should be paused
   *
   * @param interactions
   * @return {string}
   */
  getPauseAnnouncement(interactions) {
    return interactions.some(i => i.pause()) ? `. ${this.l10n.videoPausedAnnouncement}` : NO_ANNOUNCEMENT;
  }
}
