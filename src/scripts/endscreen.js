import {onClick} from 'h5p-lib-controls/src/scripts/ui/input';

const $ = H5P.jQuery;

const ENDSCREEN_STYLE_BASE = 'h5p-interactive-video-endscreen';
const ENDSCREEN_STYLE_BUTTON_HIDDEN = 'h5p-interactive-video-endscreen-submit-button-hidden';

const isset = function (value) {
  return value !== undefined && value !== null;
}

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
  constructor(parent, params = {}) {
    super();

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
      answeredScore: 'answered',
      tableRowSummaryWithScore: 'You got @score out of @total points for the @question that appeared after @minutes minutes and @seconds seconds.',
      tableRowSummaryWithoutScore: 'You have answered the @question that appeared after @minutes minutes and @seconds seconds.',
    }, params.l10n);

    this.buildDOM();
  }

  /**
   * Build the DOM elements for the endscreen.
   */
  buildDOM() {
    // Title Bar with text and close button
    this.$endscreenIntroductionTitleText = $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-introduction-title-text`,
      'id': `${ENDSCREEN_STYLE_BASE}-introduction-title-text`
    });

    this.$closeButton = $('<div>', {
      'role': 'button',
      'class': `${ENDSCREEN_STYLE_BASE}-close-button`,
      'tabindex': '0',
      'aria-label': this.parent.l10n.close
    });

    // This is a little bit like Minsky's useless machine, but necessary because of the dual use of the bubble class.
    onClick(this.$closeButton, () => this.parent.toggleEndscreen(false));

    const $endscreenIntroductionTitle = $('<div/>', {'class': `${ENDSCREEN_STYLE_BASE}-introduction-title`})
      .append([this.$endscreenIntroductionTitleText, this.$closeButton]);

    // Description
    this.$endscreenIntroductionText = $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-introduction-text`,
      'id': `${ENDSCREEN_STYLE_BASE}-introduction-text`
    });

    // Submit button
    this.$submitButtonContainer = $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-submit-button-container ${ENDSCREEN_STYLE_BUTTON_HIDDEN}`
    });

    this.$submitButton = H5P.JoubelUI.createButton({
      'class': `${ENDSCREEN_STYLE_BASE}-submit-button`,
      html: this.l10n.submitButton,
      appendTo: this.$submitButtonContainer,
      click: () => this.handleSubmit()
    });

    // Title row for the table at the bottom
    this.$endscreenOverviewTitle = $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-title`
    }).append($('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-title-answered-questions`,
      'html': this.l10n.tableRowAnswered
    })).append($('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-title-score`,
      'html': this.l10n.tableRowScore
    }));

    // Table for answered interactions
    this.$endscreenBottomTable = $('<div/>', {'class': `${ENDSCREEN_STYLE_BASE}-overview-table`});

    // Endscreen DOM root
    this.$endscreen = $('<div/>', {
      'class': ENDSCREEN_STYLE_BASE,
      role: 'dialog',
      'aria-labelledby': `${ENDSCREEN_STYLE_BASE}-introduction-title-text`,
      'aria-describedby': `${ENDSCREEN_STYLE_BASE}-introduction-text`
    }).append($('<div/>', {'class': `${ENDSCREEN_STYLE_BASE}-introduction`})
        .append($('<div/>', {'class': `${ENDSCREEN_STYLE_BASE}-star-symbol`}))
        .append($('<div/>', {'class': `${ENDSCREEN_STYLE_BASE}-introduction-container`})
          .append([$endscreenIntroductionTitle, this.$endscreenIntroductionText, this.$submitButtonContainer])))
      .append($('<div/>', {'class': `${ENDSCREEN_STYLE_BASE}-overview`})
        .append(this.$endscreenOverviewTitle)
        .append(this.$endscreenBottomTable));
  }

  /**
   * Handle click on the submit button.
   *
   * Will fire an 'answered' xAPI statement for all interactions that have
   * been interacted with but have not yet sent 'answered' or completed. Will send
   * a 'completed' xAPI statement for parent (IV) each time.
   */
  handleSubmit() {
    if (this.$submitButtonContainer.hasClass(ENDSCREEN_STYLE_BUTTON_HIDDEN)) {
      return;
    }
    this.$submitButtonContainer.addClass(ENDSCREEN_STYLE_BUTTON_HIDDEN);
    this.$endscreenIntroductionText.html(`<div class="${ENDSCREEN_STYLE_BASE}-introduction-text-submitted">${this.l10n.submitMessage}</div>`);

    this.answered.forEach(interaction => {
      /*
       * We only need to fire an xAPI answered statement if the user
       * interacted with the content and the content has not sent it so far
       * itself.
       */
      if (interaction.getLastXAPIVerb() !== 'completed' && interaction.getLastXAPIVerb() !== 'answered') {
        const xAPIEvent = new H5P.XAPIEvent();
        xAPIEvent.data.statement = interaction.getXAPIData().statement;
        interaction.setLastXAPIVerb(xAPIEvent.getVerb());

        this.trigger(xAPIEvent);
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
  getDOM() {
    return this.$endscreen;
  }

  /**
   * Build one row of a table for the endscreen.
   *
   * @param {number} time - Popup time of an interaction in seconds.
   * @param {string} title - Title of the interaction.
   * @param {number} score
   * @param {number} maxScore
   * @return {jQuery} DOM element for the table row.
   */
  buildTableRow(time, title, score, maxScore) {
    const hasScore = isset(score) && isset(maxScore);
    const ariaLabel = hasScore ?
      this.l10n.tableRowSummaryWithScore : this.l10n.tableRowSummaryWithoutScore;
    const noLink = (this.parent.skippingPrevented()) ? ` ${ENDSCREEN_STYLE_BASE}-no-link` : '';
    const $row = $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-table-row${noLink}`,
      role: 'row',
      tabIndex: 0,
      'aria-label': ariaLabel.replace('@score', score)
        .replace('@total', maxScore)
        .replace('@question', title)
        .replace('@minutes', Math.floor(time / 60))
        .replace('@seconds', time % 60)
    });

    onClick($row, () => this.jump(time));

    $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-table-row-time`,
      html: H5P.InteractiveVideo.humanizeTime(time),
      appendTo: $row,
      'aria-hidden': true
    });

    $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-table-row-title`,
      html: title,
      appendTo: $row,
      'aria-hidden': true
    });

    $('<div/>', {
      'class': `${ENDSCREEN_STYLE_BASE}-overview-table-row-score`,
      html: hasScore ? `${score} / ${maxScore}` : this.l10n.answeredScore,
      appendTo: $row,
      'aria-hidden': true
    });

    return $row;
  }

  /**
   * Jump to a certain point in the video.
   *
   * @param {number} time - Time in seconds to jump to.
   */
  jump(time) {
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
  update(interactions = []) {
    // Filter for interactions that have been answered and sort chronologically
    this.answered = interactions
      .filter(interaction => interaction.getProgress() !== undefined)
      .sort((a, b) => a.getDuration().from - b.getDuration().from);

    this.$endscreenBottomTable.empty();

    // No chaining because we need the variable later
    this.answered.forEach(interaction => {
      const time = interaction.getDuration().from;
      const title = this.getDescription(interaction);
      const instance = interaction.getInstance();
      const score = instance.getScore ? instance.getScore() : undefined;
      const maxScore = instance.getMaxScore ? instance.getMaxScore() : undefined;
      this.$endscreenBottomTable.append(this.buildTableRow(time, title, score, maxScore));
    });

    const number = this.answered.length;

    this.$endscreenIntroductionTitleText.html(this.l10n.title.replace('@answered', number));

    if (number === 0) {
      this.$endscreenIntroductionText.html(`<div class="${ENDSCREEN_STYLE_BASE}-bold-text">${this.l10n.informationNoAnswers}</div><div>${this.l10n.informationMustHaveAnswer}<div>`);
    }
    else {
      this.$endscreenIntroductionText.html(this.l10n.information.replace('@answered', number));
    }

    // Only show submit button (again) if there are answered interactions
    if (number > 0) {
      this.$submitButtonContainer.removeClass(ENDSCREEN_STYLE_BUTTON_HIDDEN);
    }
  }

  /**
   * Get description of the interaction.
   *
   * @return {string} Task description or interaction title.
   */
  getDescription(interaction) {
    if (typeof interaction.getInstance === 'function' && typeof interaction.getInstance().getTitle === 'function') {
      return interaction.getInstance().getTitle();
    }
    return interaction.getTitle();
  }

  /**
   * Set focus on the close button
   */
  focus() {
    if (this.$submitButtonContainer.hasClass(ENDSCREEN_STYLE_BUTTON_HIDDEN)) {
      this.$closeButton.focus();
    }
    else {
      this.$submitButton.focus();
    }
  }
}

export default Endscreen;
