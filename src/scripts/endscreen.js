const $ = H5P.jQuery;

/** Class representing an endscreen. */
class Endscreen extends H5P.EventDispatcher {

  /**
   * Create a new end screen.
   *
   * @param {object} parent - Parent object, right now quite tied to Interactive Video.
   * @param {object} [params] - Parameters.
   * @param {object} [params.l10n] - Localization.
   * @param {string} [params.l10n.title] - Title message.
   * @param {string} [params.l10n.information] - Information message.
   * @param {string} [params.l10n.submitButton] - Label for the submit button.
   * @param {string} [params.l10n.submitMessage] - Message after submission.
   * @param {string} [params.l10n.tableRowAnswered] - Row title for answered questions.
   * @param {string} [params.l10n.tableRowScore] - Row title for score.
   * @param {string} [params.l10n.answeredScore] - Label for answered questions without score.
   */
  constructor (parent, params = {}) {
    super();

    this.STYLE_BASE = 'h5p-interactive-video-endscreen';
    this.STYLE_BUTTON_HIDDEN = 'h5p-interactive-video-endscreen-submit-button-hidden';

    this.parent = parent;
    this.l10n = $.extend({
      title: '@answered Questions answered',
      information: 'You have answered @answered questions, click below to submit your answers.',
      informationNoAnswers: 'You have not answered any questions.',
      informationMustHaveAnswer: 'You have to answer at least one question before you can submit your answers.',
      submitButton: 'Submit Answers',
      submitMessage: 'Your answers have been submitted!',
      tableRowAnswered: 'Answered questions',
      tableRowScore: 'Score',
      answeredScore: 'answered'
    }, params.l10n);

    // Keep track of the last xAPI statement of each interaction
    this.xAPILog = {};

    // We are listening for all events here
    H5P.externalDispatcher.on('xAPI', (event) => {
      if (event.data.statement.object) {
        const subContentID = /[\?|\&]subContentId=([a-f0-9\-]+)/g.exec(event.data.statement.object.id);
        if (subContentID !== null) {
          this.xAPILog[subContentID[1]] = event.data.statement;
        }
      }
    });

    this.buildDOM();
  }

  /**
   * Build the DOM elements for the endscreen.
   */
  buildDOM () {
    // Title Bar with text and close button
    this.$endscreenTopTitleText = $('<div/>', {class: this.STYLE_BASE + '-introduction-title-text'});

    const $endscreenTopTitleButton = $('<div>', {'role': 'button', 'class': this.STYLE_BASE + '-close-button', 'tabindex': '0', 'aria-label': this.parent.l10n.close})
      .click(() => {
        // This is a little bit like Minsky's useless machine, but necessary because of the dual use of the bubble class.
        this.parent.toggleEndscreen(false);
      })
      .keydown((event) => {
        if (event.which === KEY_CODE_ENTER || event.which === KEY_CODE_SPACE) {
          this.parent.toggleEndscreen(false);
          event.preventDefault();
        }
      });

    const $endscreenTopTitle = $('<div/>', {class: this.STYLE_BASE + '-introduction-title'})
      .append([this.$endscreenTopTitleText, $endscreenTopTitleButton]);

    // Description
    this.$endscreenTopText = $('<div/>', {class: this.STYLE_BASE + '-introduction-text'});

    // Submit button
    this.$endscreenTopButton = $('<div/>', {class: this.STYLE_BASE + '-introduction-button-container'})
      .addClass(this.STYLE_BUTTON_HIDDEN)
      .append(H5P.JoubelUI.createButton({class: this.STYLE_BASE + '-submit-button', html: this.l10n.submitButton})
        .click((event) => {
          this.handleSubmit();
          event.preventDefault();
        })
        .keydown((event) => {
          switch (event.which) {
            case 13: // Enter
            case 32: // Space
              this.handleSubmit();
              event.preventDefault();
          }
        })
      );

    // Title row for the table at the bottom
    this.$endscreenBottomTitle = $('<div/>', {class: this.STYLE_BASE + '-overview-title'})
      .append($('<div/>', {class: this.STYLE_BASE + '-overview-title-answered-questions', 'html': this.l10n.tableRowAnswered}))
      .append($('<div/>', {class: this.STYLE_BASE + '-overview-title-score', 'html': this.l10n.tableRowScore}));

    // Table for answered interactions
    this.$endscreenBottomTable = $('<div/>', {class: this.STYLE_BASE + '-overview-table'});

    // Endscreen DOM root
    this.$endscreen = $('<div/>', {class: this.STYLE_BASE})
      .append($('<div/>', {class: this.STYLE_BASE + '-introduction'})
        .append($('<div/>', {class: this.STYLE_BASE + '-star-symbol'}))
        .append($('<div/>', {class: this.STYLE_BASE + '-introduction-container'})
          .append([$endscreenTopTitle, this.$endscreenTopText, this.$endscreenTopButton])))
      .append($('<div/>', {class: this.STYLE_BASE + '-overview'})
        .append(this.$endscreenBottomTitle)
        .append(this.$endscreenBottomTable));
  }

  /**
   * Handle click on the submit button.
   *
   * Will fire an 'answered' xAPI statement for all interactions that have
   * been interacted with but have not yet sent 'answered'. Will send
   * a 'completed' xAPI statement for parent (IV) each time.
   */
  handleSubmit () {
    if (this.$endscreenTopButton.hasClass(this.STYLE_BUTTON_HIDDEN)) {
      return;
    }
    this.$endscreenTopButton.addClass(this.STYLE_BUTTON_HIDDEN);
    this.$endscreenTopText.html('<span class="h5p-interactive-video-endscreen-introduction-text-submitted">' + this.l10n.submitMessage + '</span>');

    this.answered.forEach((interaction) => {
      const id = interaction.getSubcontentId();
      /*
       * We only need to fire an xAPI answered statement if the user
       * interacted with the content and the content has not sent it so far
       * itself.
       */
      let statement = this.xAPILog[id];
      if (statement === undefined || !statement.verb.id.endsWith('/answered')) {
        // This should always be true if the contract is really implemented.
        if (typeof interaction.getInstance().getXAPIData === 'function') {
          statement = interaction.getInstance().getXAPIData().statement;
          const xAPIEvent = new H5P.Event('xAPI', {'statement': statement}, {bubbles: true, external: true});
          this.trigger(xAPIEvent);
        }
      }
    });

    /*
     * Override the "completeSent" variable of the parent here, because new
     * submissions basically mean a new attempt of the parent (IV).
     * This is subject to being changed.
     */
    this.parent.triggerXAPIScored(this.parent.getUsersScore(), this.parent.getUsersMaxScore(), 'completed');
  }

  /**
   * Get the DOM of the endscreen.
   *
   * @return {jQuery} DOM of the endscreen.
   */
  getDOM () {
    return this.$endscreen;
  }

  /**
   * Build one row of a table for the endscreen.
   *
   * @param {number} time - Popup time of an interaction in seconds.
   * @param {string} title - Title of the interaction.
   * @param {string} [score=this.l10n.answered] - Score as "score / maxscore" for the interaction, 'answered' if undefined.
   * @return {jQuery} DOM element for the table row.
   */
  buildTableRow (time, title, score = this.l10n.answered) {
    return $('<div/>', {class: this.STYLE_BASE + '-overview-table-row'})
      .append($('<div/>', {class: this.STYLE_BASE + '-overview-table-row-time', html: this.parent.humanizeTime(time)})
        .click(() => {this.jump(time);}))
      .append($('<div/>', {class: this.STYLE_BASE + '-overview-table-row-title', html: title}))
        .click(() => {this.jump(time);})
      .append($('<div/>', {class: this.STYLE_BASE + '-overview-table-row-score', html: score || this.l10n.tableAnswered}));
  }

  /**
   * Jump to a certain point in the video.
   *
   * @param {number} time - Time in seconds to jump to.
   */
  jump (time) {
    if (!this.parent.skippingPrevented()) {
      this.parent.seek(time);
      this.parent.toggleEndscreen(false);
    }
  }

  /**
   * Update the endscreen.
   *
   * @param {H5P.Interaction[]} [interactions] - Interactions from IV.
   */
  update (interactions = []) {
    // Filter for interactions that have been answered and sort chronologically
    this.answered = interactions
     .filter((interaction) => {
       return interaction.getProgress() !== undefined;
     })
     .sort((a, b) => {
       return a.getDuration().from > b.getDuration().from;
     });

    this.$endscreenBottomTable.empty();

    // No chaining because we need the variable later
    this.answered.forEach((interaction) => {
      const time = interaction.getDuration().from;
      const title = this.getDescription(interaction);
      const score = (interaction.getInstance().getScore && interaction.getInstance().getMaxScore) ? interaction.getInstance().getScore() + ' / ' + interaction.getInstance().getMaxScore() : this.l10n.answeredScore;
      this.$endscreenBottomTable.append(this.buildTableRow(time, title, score));
    });

    const number = this.answered.length;

    this.$endscreenTopTitleText.html(this.l10n.title.replace('@answered', number));

    if (number === 0) {
      this.$endscreenTopText.html('<span class="' + this.STYLE_BASE + '-bold-text">' + this.l10n.informationNoAnswers + '</span><br />' + this.l10n.informationMustHaveAnswer);
    }
    else {
      this.$endscreenTopText.html(this.l10n.information.replace('@answered', number));
    }

    // Only show submit button (again) if there are answered interactions
    if (number > 0) {
      this.$endscreenTopButton.removeClass(this.STYLE_BUTTON_HIDDEN);
    }
  }

  /**
   * Get description of the interaction.
   *
   * @return {string} Task description or interaction title.
   */
  getDescription (interaction) {
    if (typeof interaction.getInstance === 'function' && typeof interaction.getInstance().getTitle === 'function') {
      return interaction.getInstance().getTitle();
    }
    return interaction.getTitle();
  }
}

export default Endscreen;
