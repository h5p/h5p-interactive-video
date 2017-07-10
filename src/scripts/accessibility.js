/**
 * @class
 * Makes it easier to manage accessibility
 */
export default class Accessibility {

  /**
   * Translations for assistive technologies
   *
   * @typedef {Object} IVAccessibilityTranslations
   * @property {string} navigationHotkeyInstructions
   *    Describes how to use hotkey(s)
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
    announcer.setAttribute('aria-hidden', 'true');
    this.interactionsAnnouncer = announcer;

    // Hot key instructions
    const hotkeyInstructor = document.createElement('div');
    hotkeyInstructor.classList.add('h5p-iv-hotkey-instructions');
    hotkeyInstructor.textContent = l10n.navigationHotkeyInstructions;
    this.hotkeyInstructor = hotkeyInstructor;
  }

  /**
   * Get element which describes hotkeys
   * @return {Element|*}
   */
  getHotkeyInstructor() {
    return this.hotkeyInstructor;
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
    let announcement = '';
    const visibleInteractions = interactions.filter(i => i.isVisible());
    const videoWillPause = visibleInteractions
      .filter(i => i.pause()).length;

    if (visibleInteractions.length) {
      announcement = `${this.l10n.singleInteractionAnnouncement} ${visibleInteractions[0].getTitle()}`;
      if (visibleInteractions.length > 1) {
        announcement = this.l10n.multipleInteractionsAnnouncement;
      }

      if (videoWillPause) {
        announcement += `. ${this.l10n.videoPausedAnnouncement}`;
      }
    }
    this.interactionsAnnouncer.textContent = announcement;
  }
}
