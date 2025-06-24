const $ = H5P.jQuery;

const ENDSCREEN_STYLE_BASE = 'h5p-interactive-video-endscreen';

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
      informationOnSubmitButtonDisabled: 'You have answered @answered questions.',
      informationNoAnswers: 'You have not answered any questions.',
      informationMustHaveAnswer: 'You have to answer at least one question before you can submit your answers.',
      submitButton: 'Submit Answers',
      submitMessage: 'Your answers have been submitted!',
      tableRowAnswered: 'Answered questions', // TODO: Remove incl. upgrade script for related l10n variable
      tableRowScore: 'Score', // TODO: Remove incl. upgrade script for related l10n variable
      question: 'Question', // Add in upgrade script
      answeredScore: 'answered',
      tableRowSummaryWithScore: 'You got @score out of @total points for the @question that appeared after @minutes minutes and @seconds seconds.',
      tableRowSummaryWithoutScore: 'You have answered the @question that appeared after @minutes minutes and @seconds seconds.',
    }, params.l10n);

    // Submit button needs to be enabled when the content type used as subcontent
    this.isSubmitButtonEnabled = this.parent.isSubmitButtonEnabled;

    this.buildDOM();
  }

  buildDOM() {
    this.endscreenDOM = document.createElement('div');
    this.endscreenDOM.className = ENDSCREEN_STYLE_BASE;
    this.endscreenDOM.setAttribute('role', 'dialog');
    this.endscreenDOM.setAttribute('aria-labelledby', `${ENDSCREEN_STYLE_BASE}-introduction-title-text`);
    this.endscreenDOM.setAttribute('aria-describedby', `${ENDSCREEN_STYLE_BASE}-introduction-text`);
  }

  /**
   * Handle click on the submit button.
   *
   * Will fire an 'answered' xAPI statement for all interactions that have
   * been interacted with but have not yet sent 'answered' or completed. Will send
   * a 'completed' xAPI statement for parent (IV) each time.
   */
  handleSubmit() {
    if (!this.isSubmitButtonEnabled) {
      return;
    }
    this.parent.setUserSubmitted(true);

    this.submitButton.remove();

    this.infoTextDOM.innerHTML = this.l10n.submitMessage;
    this.infoTextDOM.classList.add(`${ENDSCREEN_STYLE_BASE}-information-text-submitted`);

    this.answeredInteractions.forEach(interaction => {
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
    return this.endscreenDOM;
  }

  /**
   * Jump to a certain point in the video.
   *
   * @param {number} time - Time in seconds to jump to.
   */
  jump(time) {
    if (!this.parent.isSkippingProhibited(time)) {
      this.parent.seek(time);
      this.parent.toggleEndscreen(false);
    }
  }

  update(interactions = []) {
    this.endscreenDOM.innerHTML = '';

    this.answeredInteractions = interactions
      .filter((interaction) => interaction.getProgress() !== undefined)
      .sort((a, b) => a.getDuration().from - b.getDuration().from);

    const questions = this.answeredInteractions.map((interaction) => {
      const instance = interaction.getInstance();
      const time = interaction.getDuration().from;
      const score = instance?.getScore();
      const maxScore = instance?.getMaxScore();

      const formattedTitle = this.buildQuestionTitleHTML(
        H5P.InteractiveVideo.humanizeTime(time),
        this.getDescription(interaction)
      );
      const points = (isset(score) && isset(maxScore))
        ? `${score}/${maxScore}`
        : this.l10n.answeredScore;

      return {
        title: formattedTitle,
        points: points
      };
    });

    const numberOfCharsForTime = this.answeredInteractions.reduce((max, interaction) => {
      const humanizedTime = H5P.InteractiveVideo.humanizeTime(interaction.getDuration().from);
      return Math.max(max, humanizedTime.length);
    }, 0)
    this.endscreenDOM.style.setProperty('--h5p-theme-endscreen-time-width', `${numberOfCharsForTime}ch`);

    this.endscreenDOM.append(H5P.Components.ResultScreen({
      header: this.l10n.title.replace('@answered', questions.length),
      scoreHeader: '', // Needs to be a close button.
      questionGroups: [{
        listHeaders: [this.l10n.question, this.l10n.tableRowScore],
        questions: questions
      }]
    }));

    // Inject close button
    this.closeButton = new H5P.Components.Button({
      label: '',
      'aria-label': this.parent.l10n.close,
      styleType: 'secondary',
      icon: 'close',
      onClick: () => this.parent.toggleEndscreen(false)
    });

    const buttonContainer = document.querySelector('.h5p-theme-results-banner');
    if (buttonContainer) {
      const resultsScore = document.querySelector('.h5p-theme-results-score');
      resultsScore?.remove();
      buttonContainer.append(this.closeButton);
    }

    // Make questions clickable to jump to the question in the video
    const questionListItems = this.endscreenDOM.querySelectorAll(`.h5p-theme-results-list-item`);
    questionListItems?.forEach((listItem, index) => {
      const interaction = this.answeredInteractions[index];
      const hasScore = isset(interaction.instance?.getScore()) && isset(interaction.instance?.maxScore());

      let ariaLabel = hasScore ? this.l10n.tableRowSummaryWithScore : this.l10n.tableRowSummaryWithoutScore;
      ariaLabel = ariaLabel.replace('@score', interaction.instance?.getScore() || '0');
      ariaLabel = ariaLabel.replace('@total', interaction.instance?.getMaxScore() || '0');
      ariaLabel = ariaLabel.replace('@question', this.getDescription(interaction));
      ariaLabel = ariaLabel.replace('@minutes', Math.floor(interaction.getDuration().from / 60));
      ariaLabel = ariaLabel.replace('@seconds', interaction.getDuration().from % 60);

      listItem.classList.add(`is-jump-button`);
      if (this.parent.isSkippingProhibited(interaction.getDuration().from)) {
        listItem.classList.add('is-skipping-prevented');
      }
      listItem.setAttribute('tabindex', '0');
      listItem.setAttribute('role', 'button');
      listItem.setAttribute('aria-label', ariaLabel);
      listItem.addEventListener('click', (event) => {
        this.handleClickOnQuestion(event, index);
      });
      listItem.addEventListener('keydown', (event) => {
        this.handleClickOnQuestion(event, index);
      });
    });

    const additionalInfoDOM = document.createElement('div');
    additionalInfoDOM.className = `${ENDSCREEN_STYLE_BASE}-information`;
    this.endscreenDOM.append(additionalInfoDOM);

    this.infoTextDOM = document.createElement('div');
    this.infoTextDOM.className = `${ENDSCREEN_STYLE_BASE}-information-text`;

    if (questions.length === 0) {
      let text = `<div class='${ENDSCREEN_STYLE_BASE}-bold-text'>${this.l10n.informationNoAnswers}</div>`;
      if (this.isSubmitButtonEnabled) {
        text = `${text}<div>${this.l10n.informationMustHaveAnswer}</div>`;
      }
      this.infoTextDOM.innerHTML = text;
    }
    else if (this.isSubmitButtonEnabled) {
      this.infoTextDOM.innerHTML = this.l10n.information.replace('@answered', questions.length);
    }
    else {
      this.infoTextDOM.innerHTML = this.l10n.informationOnSubmitButtonDisabled.replace('@answered', questions.length);
    }
    additionalInfoDOM.append(this.infoTextDOM);

    if (this.isSubmitButtonEnabled && questions.length > 0) {
      this.submitButton = new H5P.Components.Button({
        label: this.l10n.submitButton,
        styleType: 'secondary',
        onClick: () => this.handleSubmit(),
        icon: 'check',
      });

      additionalInfoDOM.append(this.submitButton);
    }
  }

  handleClickOnQuestion(event, index) {
    if ((event instanceof KeyboardEvent) && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();

    const interaction = this.answeredInteractions[index];
    if (interaction) {
      this.jump(interaction.time);
    }
  }

  buildQuestionTitleHTML(humanizedTime, title) {
    const timeSpan = document.createElement('span');
    timeSpan.className = `${ENDSCREEN_STYLE_BASE}-overview-table-row-time`;
    timeSpan.setAttribute('aria-hidden', true);
    timeSpan.textContent = humanizedTime;

    const titleSpan = document.createElement('span');
    titleSpan.className = `${ENDSCREEN_STYLE_BASE}-overview-table-row-title`;
    titleSpan.setAttribute('aria-hidden', true);
    titleSpan.textContent = title;

    return `${timeSpan.outerHTML}${titleSpan.outerHTML}`;
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
    if (!this.isSubmitButtonEnabled || !this.submitButton) {
      this.closeButton?.focus();
    }
    else {
      this.submitButton.focus();
    }
  }
}

export default Endscreen;
