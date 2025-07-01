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
   * @param {object} parent Parent object, right now quite tied to Interactive Video.
   * @param {object} [params] Parameters.
   * @param {object} [params.l10n] Localization strings
   * @param {string} [params.l10n.title] Title message.
   * @param {string} [params.l10n.information] Information message.
   * @param {string} [params.l10n.informationOnSubmitButtonDisabled] Information message when submit button is disabled.
   * @param {string} [params.l10n.informationNoAnswers] Message when no questions have been answered.
   * @param {string} [params.l10n.informationMustHaveAnswer] Message when no questions have been answered but submit button is enabled.
   * @param {string} [params.l10n.submitButton] Label for the submit button.
   * @param {string} [params.l10n.submitMessage] Message after submission.
   * @param {string} [params.l10n.question] Title for the question column in the result screen.
   * @param {string} [params.l10n.answeredScore] Label for answered questions without score.
   * @param {string} [params.l10n.tableRowSummaryWithScore] Summary row with score.
   * @param {string} [params.l10n.tableRowSummaryWithoutScore] Summary row without score.
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
      tableRowScore: 'Score',
      question: 'Question',
      answeredScore: 'answered',
      tableRowSummaryWithScore: 'You got @score out of @total points for the @question that appeared after @minutes minutes and @seconds seconds.',
      tableRowSummaryWithoutScore: 'You have answered the @question that appeared after @minutes minutes and @seconds seconds.',
    }, params.l10n);

    // Submit button needs to be enabled when the content type used as subcontent
    this.isSubmitButtonEnabled = this.parent.isSubmitButtonEnabled;

    this.buildDOM();
  }

  /**
   * Build the DOM for the endscreen.
   */
  buildDOM() {
    this.endscreenDOM = document.createElement('div');
    this.endscreenDOM.className = ENDSCREEN_STYLE_BASE;
    this.endscreenDOM.setAttribute('role', 'dialog');
    this.endscreenDOM.setAttribute('aria-labelledby', `${ENDSCREEN_STYLE_BASE}-introduction-title-text`);
    this.endscreenDOM.setAttribute('aria-describedby', `${ENDSCREEN_STYLE_BASE}-introduction-text`);
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
   * Update the endscreen with the given interactions.
   * @param {Interaction[]} interactions - List of interactions to display.
   */
  update(interactions = []) {
    this.endscreenDOM.innerHTML = '';

    this.answeredInteractions = interactions
      .filter((interaction) => interaction.getProgress() !== undefined)
      .sort((a, b) => a.getDuration().from - b.getDuration().from);

    const questions = this.buildQuestionsForResultScreen(this.answeredInteractions);

    this.endscreenDOM.append(H5P.Components.ResultScreen({
      header: this.l10n.title.replace('@answered', questions.length),
      questionGroups: [{
        listHeaders: [this.l10n.question, this.l10n.tableRowScore],
        questions: questions
      }]
    }));

    this.customizeEndscreen();
    this.addInfoDOM(questions);
  }

  /**
   * Build questions for the result screen.
   * @param {Interaction[]} interactions List of interactions to derive questions from.
   * @return {object[]} title and points for each interaction suitable for ResultScreen params.
   */
  buildQuestionsForResultScreen(interactions) {
    return interactions.map((interaction) => {
      const instance = interaction.getInstance();
      const time = interaction.getDuration().from;
      const score = instance?.getScore();
      const maxScore = instance?.getMaxScore();

      return {
        title: this.buildQuestionTitleHTML(H5P.InteractiveVideo.humanizeTime(time), this.getDescription(interaction)),
        points: (isset(score) && isset(maxScore)) ? `${score}/${maxScore}` : this.l10n.answeredScore
      };
    });
  }

  /**
   * Build the HTML for the question title.
   * @param {string} humanizedTime Humanized time string.
   * @param {string} title Title of the question.
   * @return {string} HTML string containing the time and title.
   */
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
   * Customize the end screen.
   */
  customizeEndscreen() {
    this.hideThemeResultsListContainer();
    this.setNumberOfCharsForTime();
    this.injectCloseButton();
    this.makeListInteractive();
  }

  /**
   * Hide the theme results list container if no questions have been answered.
   */
  hideThemeResultsListContainer() {
    const themeResultScreen = this.endscreenDOM.querySelector('.h5p-theme-result-screen');
    if (!themeResultScreen) {
      return;
    }

    if (this.answeredInteractions.length === 0) {
      themeResultScreen.classList.add('no-questions-answered');
    }
  }

  /**
   * Set the number of characters for the time display in the end screen.
   */
  setNumberOfCharsForTime() {
    const numberOfCharsForTime = this.answeredInteractions.reduce((max, interaction) => {
      const humanizedTime = H5P.InteractiveVideo.humanizeTime(interaction.getDuration().from);
      return Math.max(max, humanizedTime.length);
    }, 0);

    this.endscreenDOM.style.setProperty('--h5p-theme-endscreen-time-width', `${numberOfCharsForTime}ch`);
  }

  /**
   * Inject a close button into the result screen.
   */
  injectCloseButton() {
      this.closeButton = new H5P.Components.Button({
      label: '',
      'aria-label': this.parent.l10n.close,
      styleType: 'secondary',
      icon: 'close',
      onClick: () => this.parent.toggleEndscreen(false)
    });

    const buttonContainer = document.querySelector('.h5p-theme-results-banner');
    if (!buttonContainer) {
      return;
    }

    const resultsScore = buttonContainer.querySelector('.h5p-theme-results-score');
    resultsScore?.remove();
    buttonContainer.append(this.closeButton);
  }

  /**
   * Make the question list interactive to allow jumping to the questions in the video.
   */
  makeListInteractive() {
    const questionListItems = this.endscreenDOM.querySelectorAll(`.h5p-theme-results-list-item`);
    if (!questionListItems) {
      return;
    }

    questionListItems.forEach((listItem, index) => {
      const interaction = this.answeredInteractions[index];
      const ariaLabel = this.buildQuestionAriaLabel(interaction);

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
  }

  /**
   * Build the aria label for a question in the end screen.
   * @param {Interaction} interaction The interaction to build the aria label for.
   * @return {string} The aria label for the question.
   */
  buildQuestionAriaLabel(interaction) {
    const hasScore = isset(interaction.instance?.getScore()) && isset(interaction.instance?.maxScore());
    const template = hasScore ? this.l10n.tableRowSummaryWithScore : this.l10n.tableRowSummaryWithoutScore;

    return template
      .replace('@score', interaction.instance?.getScore() || '0')
      .replace('@total', interaction.instance?.getMaxScore() || '0')
      .replace('@question', this.getDescription(interaction))
      .replace('@minutes', Math.floor(interaction.getDuration().from / 60))
      .replace('@seconds', interaction.getDuration().from % 60);
  }

  /**
   * Handle click on a question in the end screen.
   * @param {Event} event The click or keydown event.
   * @param {number} index The index of the interaction in the answeredInteractions array.
   */
  handleClickOnQuestion(event, index) {
    if ((event instanceof KeyboardEvent) && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();

    const interaction = this.answeredInteractions[index];
    if (!interaction) {
      return;
    }

    this.jump(interaction.getDuration().from);
  }

  /**
   * Jump to a certain point in the video.
   *
   * @param {number} time Time in seconds to jump to.
   */
  jump(time) {
    if (this.parent.isSkippingProhibited(time)) {
      return;
    }

    this.parent.seek(time);
    this.parent.toggleEndscreen(false);
  }

  /**
   *
   * @param {object[]} questions Questions
   */
  addInfoDOM(questions) {
    const additionalInfoDOM = document.createElement('div');
    additionalInfoDOM.className = `${ENDSCREEN_STYLE_BASE}-information`;
    this.endscreenDOM.append(additionalInfoDOM);

    this.infoTextDOM = document.createElement('div');
    this.infoTextDOM.className = `${ENDSCREEN_STYLE_BASE}-information-text`;

    if (questions.length === 0) {
      let html = `<div class='${ENDSCREEN_STYLE_BASE}-bold-text'>${this.l10n.informationNoAnswers}</div>`;
      if (this.isSubmitButtonEnabled) {
        html = `${html}<div>${this.l10n.informationMustHaveAnswer}</div>`;
      }
      this.setInfoText(html);
    }
    else if (this.isSubmitButtonEnabled) {
      this.setInfoText(this.l10n.information.replace('@answered', questions.length));
    }
    else {
      this.setInfoText(this.l10n.informationOnSubmitButtonDisabled.replace('@answered', questions.length));
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

  /**
   * Set the info text in the end screen.
   * @param {string} html HTML string to be set as info text.
   */
  setInfoText(html) {
    if (typeof html !== 'string') {
      return;
    }

    this.infoTextDOM.innerHTML = html;
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
    this.setInfoText(this.l10n.submitMessage);

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
