import SelectorControl from './selector-control';
import Controls from 'h5p-lib-controls/src/scripts/controls';
import UIKeyboard from 'h5p-lib-controls/src/scripts/ui/keyboard';
import Interaction from './interaction';
const $ = H5P.jQuery;

const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const KEYBOARD_STEP_LENGTH_SECONDS = 5;

/**
 * @typedef {Object} InteractiveVideoParameters
 * @property {Object} interactiveVideo View parameters
 * @property {Object} override Override settings
 * @property {number} startVideoAt Time-code to start video
 */
/**
 * @typedef {object} Time
 * @property {number} seconds
 * @property {number} minutes
 * @property {number} hours
 */

/**
 * Initialize a new interactive video.
 *
 * @class H5P.InteractiveVideo
 * @extends H5P.EventDispatcher
 * @property {Object|undefined} editor Set when editing
 * @param {InteractiveVideoParameters} params
 * @param {number} id
 * @param {Object} contentData
 */
function InteractiveVideo(params, id, contentData) {
  var self = this;
  var startAt;
  var loopVideo;

  // Inheritance
  H5P.EventDispatcher.call(self);

  // Keep track of content ID
  self.contentId = id;

  // Create dynamic ids
  self.bookmarksMenuId = 'interactive-video-' + this.contentId + '-bookmarks-chooser';
  self.qualityMenuId = 'interactive-video-' + this.contentId + '-quality-chooser';
  self.captionsMenuId = 'interactive-video-' + this.contentId + '-captions-chooser';
  self.playbackRateMenuId = 'interactive-video-' + this.contentId + '-playback-rate-chooser';

  self.isMinimal = false;

  // Insert default options
  self.options = $.extend({ // Deep is not used since editor uses references.
    video: {},
    assets: {}
  }, params.interactiveVideo);
  self.options.video.startScreenOptions = self.options.video.startScreenOptions || {};

  // Add default title
  if (!self.options.video.startScreenOptions.title) {
    self.options.video.startScreenOptions.title = 'Interactive Video';
  }

  // Set default splash options
  self.startScreenOptions = $.extend({
    hideStartTitle: false,
    shortStartDescription: ''
  }, self.options.video.startScreenOptions);

  // Set overrides for interactions
  if (params.override && (params.override.showSolutionButton || params.override.retryButton)) {
    self.override = {};

    if (params.override.showSolutionButton) {
      // Force "Show solution" button to be on or off for all interactions
      self.override.enableSolutionsButton = params.override.showSolutionButton === 'on';
    }

    if (params.override.retryButton) {
      // Force "Retry" button to be on or off for all interactions
      self.override.enableRetry = params.override.retryButton === 'on';
    }
  }

  if (params.override !== undefined) {
    self.showRewind10 = (params.override.showRewind10 !== undefined ? params.override.showRewind10 : false);
    self.showBookmarksmenuOnLoad = (params.override.showBookmarksmenuOnLoad !== undefined ? params.override.showBookmarksmenuOnLoad : false);
    self.preventSkipping = params.override.preventSkipping || false;
    self.deactivateSound = params.override.deactivateSound || false;
  }
  // Translated UI text defaults
  self.l10n = $.extend({
    interaction: 'Interaction',
    play: 'Play',
    pause: 'Pause',
    mute: 'Mute',
    unmute: 'Unmute',
    quality: 'Video quality',
    captions: 'Captions',
    close: 'Close',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    summary: 'Summary',
    bookmarks: 'Bookmarks',
    defaultAdaptivitySeekLabel: 'Continue',
    continueWithVideo: 'Continue with video',
    more: 'More',
    playbackRate: 'Playback rate',
    rewind10: 'Rewind 10 seconds',
    navDisabled: 'Navigation is disabled',
    sndDisabled: 'Sound is disabled',
    requiresCompletionWarning: 'You need to answer all the questions correctly before continuing.',
    back: 'Back',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    currentTime: 'Current time:',
    totalTime: 'Total time:'
  }, params.l10n);

  // Make it possible to restore from previous state
  if (contentData &&
    contentData.previousState !== undefined &&
    contentData.previousState.progress !== undefined &&
    contentData.previousState.answers !== undefined) {
    self.previousState = contentData.previousState;
  }

  // Initial state
  self.lastState = H5P.Video.ENDED;

  // Listen for resize events to make sure we cover our container.
  self.on('resize', function () {
    self.resize();
  });

  // Detect whether to add interactivies or just display a plain video.
  self.justVideo = false;
  var iOSMatches = navigator.userAgent.match(/(iPhone|iPod) OS (\d*)_/i);
  if (iOSMatches !== null && iOSMatches.length === 3) {
    // If iOS < 10, let's play video only...
    self.justVideo = iOSMatches[2] < 10;
  }

  // set start time
  startAt = (self.previousState && self.previousState.progress) ? Math.floor(self.previousState.progress) : 0;
  if (startAt === 0 && params.override && !!params.override.startVideoAt) {
    startAt = params.override.startVideoAt;
  }

  // determine if video should be looped
  loopVideo = params.override && !!params.override.loop;

  // determine if video should play automatically
  this.autoplay = params.override && !!params.override.autoplay;

  // Start up the video player
  self.video = H5P.newRunnable({
    library: 'H5P.Video 1.3',
    params: {
      sources: self.options.video.files,
      visuals: {
        poster: self.options.video.startScreenOptions.poster,
        controls: self.justVideo,
        fit: false
      },
      startAt: startAt,
      a11y: self.options.video.textTracks
    }
  }, self.contentId, undefined, undefined, {parent: self});

  // Listen for video events
  if (self.justVideo) {
    self.video.on('loaded', function () {
      // Make sure it fits
      self.trigger('resize');
    });

    // Do nothing more if we're just displaying a video
    return;
  }

  /**
   * Keep track if the video source is loaded.
   * @private
   */
  var isLoaded = false;

  // Handle video source loaded events (metadata)
  self.video.on('loaded', function () {
    isLoaded = true;
    // Update IV player UI
    self.loaded();
  });

  self.video.on('error', function () {
    // Make sure splash screen is removed so the error is visible.
    self.removeSplash();
  });

  // We need to initialize some stuff the first time the video plays
  var firstPlay = true;
  self.video.on('stateChange', function (event) {

    if (!self.controls && isLoaded) {
      // Add controls if they're missing and 'loaded' has happened
      self.addControls();
      self.trigger('resize');
    }

    var state = event.data;
    if (self.currentState === InteractiveVideo.SEEKING) {
      return; // Prevent updateing UI while seeking
    }

    switch (state) {
      case H5P.Video.ENDED:
        self.currentState = H5P.Video.ENDED;
        self.controls.$play
          .addClass('h5p-pause')
          .attr('title', self.l10n.play);

        self.timeUpdate(self.video.getCurrentTime());
        self.controls.$currentTime.html(self.controls.$totalTime.find('.human-time').html());

        self.complete();

        if (loopVideo) {
          self.video.play();
          // we must check the parameter because the video might have started at previousState.progress
          var loopTime = (params.override && !!params.override.startVideoAt) ? params.override.startVideoAt : 0;
          self.video.seek(loopTime);
        }

        break;

      case H5P.Video.PLAYING:
        if (firstPlay) {
          firstPlay = false;

          // Qualities might not be available until after play.
          self.addQualityChooser();

          self.addPlaybackRateChooser();

          // Make sure splash screen is removed.
          self.removeSplash();

          // Make sure we track buffering of the video.
          self.startUpdatingBufferBar();

          // Remove bookmarkchooser
          self.toggleBookmarksChooser(false);
        }

        self.currentState = H5P.Video.PLAYING;
        self.controls.$play
          .removeClass('h5p-pause')
          .attr('title', self.l10n.pause);

        // refocus for re-read button title by screen reader
        if (self.controls.$play.is(":focus")) {
          self.controls.$play.blur();
          self.controls.$play.focus();
        }

        self.timeUpdate(self.video.getCurrentTime());
        break;

      case H5P.Video.PAUSED:
        self.currentState = H5P.Video.PAUSED;
        self.controls.$play
          .addClass('h5p-pause')
          .attr('title', self.l10n.play);

        // refocus for re-read button title by screen reader
        if (self.controls.$play.is(":focus")) {
          self.controls.$play.blur();
          self.controls.$play.focus();
        }

        self.timeUpdate(self.video.getCurrentTime());
        break;

      case H5P.Video.BUFFERING:
        self.currentState = H5P.Video.BUFFERING;

        // Make sure splash screen is removed.
        self.removeSplash();

        // Make sure we track buffering of the video.
        self.startUpdatingBufferBar();

        break;
    }
  });

  self.video.on('qualityChange', function (event) {
    var quality = event.data;
    if (self.controls.$qualityChooser) {
      // Update quality selector
      self.controls.$qualityChooser.find('li').attr('aria-checked', 'false').filter('[data-quality="' + quality + '"]').attr('aria-checked', 'true');
    }
  });

  self.video.on('playbackRateChange', function (event) {
    var playbackRate = event.data;
    // Firefox fires a "ratechange" event immediately upon changing source, at this
    // point controls has not been initialized, so we must check for controls
    if (self.controls && self.controls.$playbackRateChooser) {
      // Update playbackRate selector
      self.controls.$playbackRateChooser.find('li').attr('aria-checked', 'false').filter('[playback-rate="' + playbackRate + '"]').attr('aria-checked', 'true');
    }
  });

  // Handle entering fullscreen
  self.on('enterFullScreen', function () {
    self.hasFullScreen = true;
    self.$container.parent('.h5p-content').css('height', '100%');
    self.controls.$fullscreen
      .addClass('h5p-exit')
      .attr('title', self.l10n.exitFullscreen);

    // refocus for re-read button title by screen reader
    self.controls.$fullscreen.blur();
    self.controls.$fullscreen.focus();

    self.resizeInteractions();
  });

  // Handle exiting fullscreen
  self.on('exitFullScreen', function () {
    if (self.$container.hasClass('h5p-standalone') && self.$container.hasClass('h5p-minimal')) {
      self.pause();
    }

    self.hasFullScreen = false;
    self.$container.parent('.h5p-content').css('height', '');
    self.controls.$fullscreen
      .removeClass('h5p-exit')
      .attr('title', self.l10n.fullscreen);

    // refocus for re-read button title by screen reader
    self.controls.$fullscreen.blur();
    self.controls.$fullscreen.focus();

    self.resizeInteractions();

    // Close dialog
    if (self.dnb && self.dnb.dialog && !self.hasUncompletedRequiredInteractions()) {
      self.dnb.dialog.close();
    }
  });

  // Handle video captions loaded
  self.video.on('captions', function (event) {
    if (!self.controls) {
      // Video is loaded but there are no controls
      self.addControls();
      self.trigger('resize');
    }

    // Add captions selector
    self.setCaptionTracks(event.data);
  });

  // Initialize interactions
  self.interactions = [];
  if (self.options.assets.interactions) {
    for (var i = 0; i < self.options.assets.interactions.length; i++) {
      this.initInteraction(i);
    }
  }
}

// Inheritance
InteractiveVideo.prototype = Object.create(H5P.EventDispatcher.prototype);
InteractiveVideo.prototype.constructor = InteractiveVideo;

/**
 * Set caption tracks for current interactive video
 *
 * @param {H5P.Video.LabelValue[]} tracks
 */
InteractiveVideo.prototype.setCaptionTracks = function (tracks) {
  var self = this;

  // Add option to turn off captions
  tracks.unshift(new H5P.Video.LabelValue('Off', 'off'));

  if (self.captionsTrackSelector) {
    // Captions track selector already exists, simply update with new options
    self.captionsTrackSelector.updateOptions(tracks);
    return;
  }

  // Determine current captions track
  var currentTrack = self.video.getCaptionsTrack();
  if (!currentTrack) {
    // Set default off when no track is selected
    currentTrack = tracks[0];
  }

  // Create new track selector
  self.captionsTrackSelector = new SelectorControl('captions', tracks, currentTrack, 'menuitemradio', self.l10n, self.contentId);
  self.captionsTrackSelector.on('select', function (event) {
    self.video.setCaptionsTrack(event.data.value === 'off' ? null : event.data);
  });
  self.captionsTrackSelector.on('close', function (event) {
    if (self.controls.$more.attr('aria-expanded') === 'true') {
      self.controls.$more.click();
    }
  });
  self.captionsTrackSelector.on('open', function (event) {
    self.controls.$overlayButtons.addClass('h5p-hide');
  });

  // Insert popup and button
  $(self.captionsTrackSelector.control).insertAfter(self.controls.$volume);
  $(self.captionsTrackSelector.popup).css(self.controlsCss).insertAfter($(self.captionsTrackSelector.control));
  $(self.captionsTrackSelector.overlayControl).insertAfter(self.controls.$qualityButtonMinimal);
  self.controls.$overlayButtons = self.controls.$overlayButtons.add(self.captionsTrackSelector.overlayControl);

  self.minimalMenuKeyboardControls.insertElementAt(self.captionsTrackSelector.overlayControl, 2);
};

/**
 * Returns the current state of the interactions
 *
 * @returns {Object|undefined}
 */
InteractiveVideo.prototype.getCurrentState = function () {
  var self = this;

  if (!self.video.play) {
    return; // Missing video
  }

  var state = {
    progress: self.video.getCurrentTime(),
    answers: []
  };

  for (var i = 0; i < self.interactions.length; i++) {
    state.answers[i] = self.interactions[i].getCurrentState();
  }

  if (state.progress) {
    return state;
  }
};

/**
 * Removes splash screen.
 */
InteractiveVideo.prototype.removeSplash = function () {
  if (this.$splash === undefined) {
    return;
  }

  this.$splash.remove();
  delete this.$splash;
};

/**
 * Attach interactive video to DOM element.
 *
 * @param {H5P.jQuery} $container
 */
InteractiveVideo.prototype.attach = function ($container) {
  var that = this;
  // isRoot is undefined in the editor
  if (this.isRoot !== undefined && this.isRoot()) {
    this.setActivityStarted();
  }
  this.$container = $container;

  $container.addClass('h5p-interactive-video').html('<div class="h5p-video-wrapper"></div><div role="toolbar" class="h5p-controls"></div>');

  // Font size is now hardcoded, since some browsers (At least Android
  // native browser) will have scaled down the original CSS font size by the
  // time this is run. (It turned out to have become 13px) Hard coding it
  // makes it be consistent with the intended size set in CSS.
  this.fontSize = 16;
  this.width = 640; // parseInt($container.css('width')); // Get width in px

  // 'video only' fallback has no interactions
  if (this.interactions) {
    // interactions require parent $container, recreate with input
    this.interactions.forEach(function (interaction) {
      interaction.reCreate();
    });
  }

  // Video with interactions
  this.$videoWrapper = $container.children('.h5p-video-wrapper');
  this.attachVideo(this.$videoWrapper);

  if (this.justVideo) {
    this.$videoWrapper.find('video').css('minHeight', '200px');
    $container.children(':not(.h5p-video-wrapper)').remove();
    return;
  }
  // read speaker
  this.$read = $('<div/>', {
    'aria-live': 'polite',
    'class': 'hidden-but-read',
    appendTo: $container
  });
  this.readText = null;

  // Controls
  this.$controls = $container.children('.h5p-controls').hide();

  if (this.editor === undefined) {
    this.dnb = new H5P.DragNBar([], this.$videoWrapper, this.$container, {disableEditor: true});
    // Pause video when opening dialog
    this.dnb.dialog.on('open', function () {
      // Keep track of last state
      that.lastState = that.currentState;

      if (that.currentState !== H5P.Video.PAUSED && that.currentState !== H5P.Video.ENDED) {
        // Pause video
        that.video.pause();
      }
    });

    // Resume playing when closing dialog
    this.dnb.dialog.on('close', function () {
      if (that.lastState !== H5P.Video.PAUSED && that.lastState !== H5P.Video.ENDED) {
        that.video.play();
      }
    });
  }
  else {
    that.on('dnbEditorReady', function () {
      that.dnb = that.editor.dnb;
      that.dnb.dialog.disableOverlay = true;
    });
  }

  if (!this.video.pressToPlay) {
    if (this.currentState === InteractiveVideo.LOADED) {
      // Add all controls
      this.addControls();
    }
    else {
      // Add splash to allow start playing before video load
      // (play may be needed to trigger load incase preloaded="none" is default)
      this.addSplash();
    }
  }


  this.currentState = InteractiveVideo.ATTACHED;

  if (this.autoplay) {
    that.video.play();
  }
};

/**
 * Attach the video to the given wrapper.
 *
 * @param {H5P.jQuery} $wrapper
 */
InteractiveVideo.prototype.attachVideo = function ($wrapper) {
  this.video.attach($wrapper);
  if (!this.justVideo) {
    this.$overlay = $('<div class="h5p-overlay h5p-ie-transparent-background"></div>').appendTo($wrapper);
  }
};

/**
 * Add splash screen
 */
InteractiveVideo.prototype.addSplash = function () {
  var that = this;
  if (this.editor !== undefined || this.video.pressToPlay || !this.video.play || this.$splash) {
    return;
  }

  this.$splash = $(
    '<div class="h5p-splash-wrapper">' +
      '<div class="h5p-splash-outer">' +
        '<div class="h5p-splash" role="button" tabindex="0" ' +
              'aria-label="' + this.l10n.play + '" title="' + this.l10n.play + '">' +
          '<div class="h5p-splash-main">' +
            '<div class="h5p-splash-main-outer">' +
              '<div class="h5p-splash-main-inner">' +
                '<div class="h5p-splash-play-icon"></div>' +
                '<div class="h5p-splash-title">' + this.options.video.startScreenOptions.title + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="h5p-splash-footer">' +
            '<div class="h5p-splash-footer-holder">' +
              '<div class="h5p-splash-description">' + that.startScreenOptions.shortStartDescription + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>')
    .click(function () {
      that.video.play();
    })
    .appendTo(this.$overlay)
    .find('.h5p-interaction-button')
    .click(function () {
      return false;
    })
    .end();

  // Add play functionality and title to play icon
  $('.h5p-splash', this.$splash).keydown(function (e) {
    var code = e.which;
    // 32 = Space, 13 = enter
    if (code === 32 || code === 13) {
      that.video.play();
      e.preventDefault();

      // Focus pause button
      that.$controls.find('.h5p-play').focus();
    }
  });

  if (this.startScreenOptions.shortStartDescription === undefined || !this.startScreenOptions.shortStartDescription.length) {
    this.$splash.addClass('no-description');
  }

  if (this.startScreenOptions.hideStartTitle) {
    this.$splash.addClass('no-title');
  }
};

/**
 * Update and show controls for the interactive video.
 */
InteractiveVideo.prototype.addControls = function () {
  const self = this;
  // Display splash screen
  this.addSplash();

  this.attachControls(this.$controls.show());

  const duration = this.video.getDuration();
  const humanTime = InteractiveVideo.humanizeTime(duration);
  const a11yTime = InteractiveVideo.formatTimeForA11y(duration, self.l10n);
  this.controls.$totalTime.find('.human-time').html(humanTime);
  this.controls.$totalTime.find('.hidden-but-read').html(`${self.l10n.totalTime} ${a11yTime}`);
  this.controls.$slider.slider('option', 'max', duration);
  this.controls.$currentTime.html(InteractiveVideo.humanizeTime(0));

  // Add keyboard controls for Bookmarks
  this.bookmarkMenuKeyboardControls = new Controls([new UIKeyboard()]);
  this.bookmarkMenuKeyboardControls.on('close', () =>  this.toggleBookmarksChooser(false));

  // Add dots above seeking line.
  this.addSliderInteractions();

  // Add bookmarks
  this.addBookmarks();

  this.trigger('controls');
};

/**
 * Prepares the IV for playing.
 */
InteractiveVideo.prototype.loaded = function () {
  // Get duration
  var duration = this.video.getDuration();

  // Determine how many percentage one second is.
  this.oneSecondInPercentage = (100 / this.video.getDuration());

  duration = Math.floor(duration);

  if (this.editor !== undefined) {
    var interactions = findField('interactions', this.editor.field.fields);

    // Set max/min for editor duration fields
    var durationFields = findField('duration', interactions.field.fields).fields;
    durationFields[0].max = durationFields[1].max = duration;
    durationFields[0].min = durationFields[1].min = 0;

    // Set max value for adaptive seeking timecodes
    var adaptivityFields = findField('adaptivity', interactions.field.fields).fields;
    for (var i = 0; i < adaptivityFields.length; i++) {
      if (adaptivityFields[i].fields) {
        findField('seekTo', adaptivityFields[i].fields).max = duration;
      }
    }
  }

  // Add summary interaction
  if (this.hasMainSummary()) {
    var displayAt = duration - this.options.summary.displayAt;
    if (displayAt < 0) {
      displayAt = 0;
    }

    if (this.options.assets.interactions === undefined) {
      this.options.assets.interactions = [];
    }

    this.options.assets.interactions.push({
      action: this.options.summary.task,
      x: 80,
      y: 80,
      duration: {
        from: displayAt,
        to: duration
      },
      displayType: 'button',
      bigDialog: true,
      className: 'h5p-summary-interaction h5p-end-summary',
      label: '<p>' + this.l10n.summary + '</p>',
      mainSummary: true
    });
    this.initInteraction(this.options.assets.interactions.length - 1);
  }

  if (this.currentState === InteractiveVideo.ATTACHED) {
    if (!this.video.pressToPlay) {
      this.addControls();
    }

    this.trigger('resize');
  }

  this.currentState = InteractiveVideo.LOADED;
};

/**
 * Initialize interaction at the given index.
 *
 * @param {number} index
 * @returns {H5P.InteractiveVideoInteraction}
 */
InteractiveVideo.prototype.initInteraction = function (index) {
  var self = this;
  var parameters = self.options.assets.interactions[index];

  if (self.override) {
    // Extend interaction parameters
    var compatibilityLayer = {};
    if (parameters.adaptivity && parameters.adaptivity.requireCompletion) {
      compatibilityLayer.enableRetry = true;
    }
    H5P.jQuery.extend(parameters.action.params.behaviour, self.override, compatibilityLayer);
  }

  var previousState;
  if (self.previousState !== undefined && self.previousState.answers !== undefined && self.previousState.answers[index] !== null) {
    previousState = self.previousState.answers[index];
  }

  var interaction = new Interaction(parameters, self, previousState);

  // handle display event
  interaction.on('display', function (event) {
    var $interaction = event.data;
    $interaction.appendTo(self.$overlay);

    // Make sure the interaction does not overflow videowrapper.
    interaction.repositionToWrapper(self.$videoWrapper);

    // Determine source type
    var isYouTube = (self.video.pressToPlay !== undefined);

    // Consider pausing the playback
    delayWork(isYouTube ? 100 : null, function () {
      var isPlaying = self.currentState === H5P.Video.PLAYING ||
        self.currentState === H5P.Video.BUFFERING;
      if (isPlaying && interaction.pause()) {
        self.video.pause();
      }
    });

    // Position label on next tick
    setTimeout(function () {
      interaction.positionLabel(self.$videoWrapper.width());
    }, 0);
  });

  // handle xAPI event
  interaction.on('xAPI', function (event) {
    // update state
    if ($.inArray(event.getVerb(), ['completed', 'answered']) !== -1) {
      event.setVerb('answered');
      // IV is complete if:
      // - The event is sent from the "main" summary
      // - The event sent is not an child of a sub content (grandchild)
      if (interaction.isMainSummary() && event.isFromChild()) {
        // Send completed after summary's answered
        setTimeout(function () {
          self.complete();
        }, 0);
      }
    }
    if (event.data.statement.context.extensions === undefined) {
      event.data.statement.context.extensions = {};
    }
    event.data.statement.context.extensions['http://id.tincanapi.com/extension/ending-point'] = 'PT' + Math.floor(self.video.getCurrentTime()) + 'S';
  });

  self.interactions.push(interaction);

  return interaction;
};

/**
 * Checks if the interactive video should have summary task scheduled at
 * the end of the video.
 *
 * This is the summary created in the summary tab of the editor.
 *
 * @returns {boolean}
 *   true if this interactive video has a summary
 *   false otherwise
 */
InteractiveVideo.prototype.hasMainSummary = function () {
  var summary = this.options.summary;
  return !(summary === undefined ||
    summary.displayAt === undefined ||
    summary.task === undefined ||
    summary.task.params === undefined ||
    summary.task.params.summaries === undefined ||
    !summary.task.params.summaries.length ||
    summary.task.params.summaries[0].summary === undefined ||
    !summary.task.params.summaries[0].summary.length);
};

/**
 * Puts the tiny cute balls above the slider / seek bar.
 */
InteractiveVideo.prototype.addSliderInteractions = function () {
  // Remove old dots
  this.controls.$interactionsContainer.children().remove();

  // Add new dots
  H5P.jQuery.extend([], this.interactions)
    .sort((a, b) =>  a.getDuration().from - b.getDuration().from)
    .forEach(interaction => {
      const $menuitem = interaction.addDot();

      if ($menuitem !== undefined) {
        $menuitem.appendTo(this.controls.$interactionsContainer);

        if(!this.preventSkipping) {
          this.interactionKeyboardControls.addElement($menuitem.get(0));
        }
      }
    });
};

/**
 * Puts all the cool narrow lines around the slider / seek bar.
 */
InteractiveVideo.prototype.addBookmarks = function () {
  this.bookmarksMap = {};
  if (this.options.assets.bookmarks !== undefined && !this.preventSkipping) {
    for (var i = 0; i < this.options.assets.bookmarks.length; i++) {
      this.addBookmark(i);
    }
  }
};

/**
 * Toggle bookmarks menu
 *
 * @method toggleBookmarksChooser
 * @param {boolean} [show] Forces toggle state if set
 */
InteractiveVideo.prototype.toggleBookmarksChooser = function (show) {
  if (this.controls.$bookmarksButton) {
    show = (show === undefined ? !this.controls.$bookmarksChooser.hasClass('h5p-show') : show);
    var hiding = this.controls.$bookmarksChooser.hasClass('h5p-show');

    if(show) {
      this.controls.$more.attr('aria-expanded', 'true');
      this.controls.$minimalOverlay.addClass('h5p-show');
      this.controls.$minimalOverlay.find('.h5p-minimal-button').addClass('h5p-hide');
      this.controls.$bookmarksButton.attr('aria-expanded', 'true');
      this.controls.$bookmarksChooser
        .css({maxHeight: show ? this.controlsCss.maxHeight : '32px'})
        .addClass('h5p-show');
      this.controls.$bookmarksChooser.find('[tabindex="0"]').first().focus();
    }
    else {
      this.controls.$more.attr('aria-expanded', 'false');
      this.controls.$minimalOverlay.removeClass('h5p-show');
      this.controls.$minimalOverlay.find('.h5p-minimal-button').removeClass('h5p-hide');
      this.controls.$bookmarksButton.attr('aria-expanded', 'false');

      this.controls.$bookmarksChooser
        .css({maxHeight: show ? this.controlsCss.maxHeight : '32px'})
        .removeClass('h5p-show');

      this.controls.$bookmarksButton.focus();
    }

    // Add classes if changing visibility
    this.controls.$bookmarksChooser.toggleClass('h5p-transitioning', show || hiding);
  }
};

/**
 * Show message saying that skipping in the video is not allowed.
 *
 * @param {number} offsetX offset in pixels from left side of the seek bar
 */
InteractiveVideo.prototype.showPreventSkippingMessage = function (offsetX) {
  var self = this;

  // Already displaying message
  if (self.preventSkippingWarningTimeout) {
    return;
  }

  // Create DOM element if not existing
  if (!self.$preventSkippingMessage) {
    self.$preventSkippingMessage = $('<div>', {
      'class': 'h5p-prevent-skipping-message',
      appendTo: self.controls.$bookmarksContainer
    });

    self.$preventSkippingMessageText = $('<div>', {
      'class': 'h5p-prevent-skipping-message-text',
      html: self.l10n.navDisabled,
      appendTo: self.$preventSkippingMessage
    });

    self.$preventSkippingMessageTextA11y = $('<div>', {
      'class': 'hidden-but-read',
      html: self.l10n.navDisabled,
      appendTo: self.controls.$slider
    });
  }


  // Move element to offset position
  self.$preventSkippingMessage.css('left', offsetX);

  // Show message
  setTimeout(function () {
    self.$preventSkippingMessage
      .addClass('h5p-show')
      .attr('aria-hidden', 'false');
  }, 0);

  // Wait for a while before removing message
  self.preventSkippingWarningTimeout = setTimeout(function () {

    // Remove message
    self.$preventSkippingMessage
      .removeClass('h5p-show')
      .attr('aria-hidden', 'true');

    // Wait a while before allowing to display warning again.
    setTimeout(function () {
      self.preventSkippingWarningTimeout = undefined;
    }, 500);
  }, 2000);
};

/**
 * Update video to jump to position of selected bookmark
 *
 * @param {jQuery} $bookmark
 * @param {object} bookmark
 */
InteractiveVideo.prototype.onBookmarkSelect = function ($bookmark, bookmark) {
  var self = this;

  if (self.currentState !== H5P.Video.PLAYING) {
    $bookmark.mouseover().mouseout();
    setTimeout(function () {self.timeUpdate(self.video.getCurrentTime());}, 0);
  }

  if (self.controls.$more.attr('aria-expanded') === 'true' && self.$container.hasClass('h5p-minimal')) {
    self.controls.$more.click();
  }
  else {
    self.toggleBookmarksChooser(false);
  }
  self.video.play();
  self.video.seek(bookmark.time);

  const l11yTime = InteractiveVideo.formatTimeForA11y(bookmark.time, self.l10n);
  setTimeout(() => self.read(`${self.l10n.currentTime} ${l11yTime}`), 150);
};

/**
 * Puts a single cool narrow line around the slider / seek bar.
 *
 * @param {number} id
 * @param {number} [tenth]
 * @returns {H5P.jQuery}
 */
InteractiveVideo.prototype.addBookmark = function (id, tenth) {
  var self = this;
  var bookmark = self.options.assets.bookmarks[id];

  // Avoid stacking of bookmarks.
  if (tenth === undefined) {
    tenth = Math.floor(bookmark.time * 10) / 10;
  }

  // Create bookmark element for the seek bar.
  var $bookmark = self.bookmarksMap[tenth] = $('<div class="h5p-bookmark" style="left:' + (bookmark.time * self.oneSecondInPercentage) + '%"><div class="h5p-bookmark-label"><div class="h5p-bookmark-text">' + bookmark.label + '</div></div></div>')
    .appendTo(self.controls.$bookmarksContainer)
    .data('id', id)
    .hover(function () {
      if (self.bookmarkTimeout !== undefined) {
        clearTimeout(self.bookmarkTimeout);
      }
      self.controls.$bookmarksContainer.children('.h5p-show').removeClass('h5p-show');
      $bookmark.addClass('h5p-show');
    }, function () {
      self.bookmarkTimeout = setTimeout(function () {
        $bookmark.removeClass('h5p-show');
      }, 2000);
    });

  // Set max size of label to the size of the controls to the right.
  $bookmark.find('.h5p-bookmark-label').css('maxWidth', parseInt(self.controls.$slider.parent().css('marginRight')) - 35);

  // Creat list if non-existent (note that it isn't allowed to have empty lists in HTML)
  if (self.controls.$bookmarksList === undefined) {
    self.controls.$bookmarksList = $('<ul role="menu"></ul>')
      .insertAfter(self.controls.$bookmarksChooser.find('h3'));
  }

  // Create list element for bookmark
  var $li = $(`<li role="menuitem" aria-describedby="${self.bookmarksMenuId}">${bookmark.label}</li>`)
    .click(() => self.onBookmarkSelect($bookmark, bookmark))
    .keydown(e => {
      if(e.which === 32 || e.which === 13){
        self.onBookmarkSelect($bookmark, bookmark);
      }

      e.stopPropagation();
    });

  self.bookmarkMenuKeyboardControls.addElement($li.get(0));

  // Insert bookmark in the correct place.
  var $next = self.controls.$bookmarksList.children(':eq(' + id + ')');
  if ($next.length !== 0) {
    $li.insertBefore($next);
  }
  else {
    $li.appendTo(self.controls.$bookmarksList);
  }

  // Listen for changes to our id.
  self.on('bookmarksChanged', function (event) {
    var index = event.data.index;
    var number = event.data.number;
    if (index === id && number < 0) {
      // We are removing this item.
      $li.remove();
      delete self.bookmarksMap[tenth];
      // self.off('bookmarksChanged');
    }
    else if (id >= index) {
      // We must update our id.
      id += number;
      $bookmark.data('id', id);
    }
  });

  // Tell others we have added a new bookmark.
  self.trigger('bookmarkAdded', {'bookmark': $bookmark});
  return $bookmark;
};

/**
 * Attach video controls to the given wrapper.
 *
 * @param {H5P.jQuery} $wrapper
 */
InteractiveVideo.prototype.attachControls = function ($wrapper) {
  var self = this;

  // The controls consist of three different sections:
  var $left = $('<div/>', {'class': 'h5p-controls-left', appendTo: $wrapper});
  var $slider = $('<div/>', {'class': 'h5p-control h5p-slider', appendTo: $wrapper});
  var $right = $('<div/>', {'class': 'h5p-controls-right', appendTo: $wrapper});

  if (self.preventSkipping) {
    self.setDisabled($slider);
  }

  // Keep track of all controls
  self.controls = {};

  // Add play button/pause button
  self.controls.$play = self.createButton('play', 'h5p-control h5p-pause', $left, function () {
    var disabled = self.isDisabled(self.controls.$play);

    if (self.controls.$play.hasClass('h5p-pause') && !disabled) {

      // Auto toggle fullscreen on play if on a small device
      var isSmallDevice = screen ? Math.min(screen.width, screen.height) <= self.width : true;
      if (!self.hasFullScreen && isSmallDevice && self.$container.hasClass('h5p-standalone') && self.$container.hasClass('h5p-minimal')) {
        self.toggleFullScreen();
      }
      self.video.play();
    }
    else {
      self.video.pause();
    }
  });

  // Add button for rewinding 10 seconds

  if (self.showRewind10) {
    self.controls.$rewind10 = self.createButton('rewind10', 'h5p-control', $left, function () {
      if (self.video.getCurrentTime() > 0) { // video will play otherwise
        var newTime = Math.max(self.video.getCurrentTime()-10, 0);
        self.video.seek(newTime);
        if (self.currentState === H5P.Video.PAUSED) {
          self.timeUpdate(newTime);
        }
        if (self.currentState === H5P.Video.ENDED) {
          self.video.play();
        }
      }
    });
  }

  /**
   * Closes the More menu if it is expanded
   *
   * @return {boolean} if it was closed
   */
  const closeMoreMenuIfExpanded = function(){
    const isExpanded = self.$container.hasClass('h5p-minimal') &&
      self.controls.$more.attr('aria-expanded') === 'true';

    if(isExpanded) {
      self.controls.$more.click();
    }

    return isExpanded;
  };

  /**
   * Wraps a specifc handler to do some generic operations each time the handler is triggered.
   *
   * @private
   * @param {string} button Name of controls button
   * @param {string} menu Name of controls menu
   *
   * @return {function}
   */
  var createPopupMenuHandler = function (button, menu) {
    return function () {
      var $button = self.controls[button];
      var $menu = self.controls[menu];
      var isDisabled = $button.attr('aria-disabled') === 'true';
      var isExpanded = $button.attr('aria-expanded') === 'true';

      if (isDisabled) {
        return; // Not active
      }

      if (isExpanded) {
        // Closing
        $button.attr('aria-expanded', 'false');
        $menu.removeClass('h5p-show');
        $button.focus();

        closeMoreMenuIfExpanded();
      }
      else {
        // Opening
        $button.attr('aria-expanded', 'true');
        $menu.addClass('h5p-show');
        $menu.find('[tabindex="0"]').focus();
      }
    };
  };

  var isIpad = function () {
    return navigator.userAgent.indexOf('iPad') !== -1;
  };

  var isAndroid = function () {
    return navigator.userAgent.indexOf('Android') !== -1;
  };

  /**
   * Indicates if bookmarks are available.
   * Only available for controls.
   * @private
   */
  var hasBookmarks = self.options.assets.bookmarks && self.options.assets.bookmarks.length;
  var bookmarksEnabled = self.editor || (hasBookmarks && !self.preventSkipping);

  // Add bookmark controls
  if (bookmarksEnabled) {
    // Popup dialog for choosing bookmarks
    self.controls.$bookmarksChooser = H5P.jQuery('<div/>', {
      'class': 'h5p-chooser h5p-bookmarks',
      'role': 'dialog',
      html: `<h3 id="${self.bookmarksMenuId}">${self.l10n.bookmarks}</h3>`,
    });

    // Adding close button to bookmarks-menu
    self.controls.$bookmarksChooser.append($('<span>', {
      'role': 'button',
      'class': 'h5p-chooser-close-button',
      'tabindex': '0',
      'title': self.l10n.close,
      click: () => self.toggleBookmarksChooser(),
      keydown: event => {
        if (event.which === 32 || event.which === 13) {
          self.toggleBookmarksChooser();
          event.preventDefault();
        }
      }
    }));

    if (self.showRewind10) {
      self.controls.$bookmarksChooser.addClass('h5p-rewind-displacement');
    }

    // Button for opening bookmark popup
    self.controls.$bookmarksButton = self.createButton('bookmarks', 'h5p-control', $left, function () {
      self.toggleBookmarksChooser();
    });
    self.controls.$bookmarksButton.attr('aria-haspopup', 'true');
    self.controls.$bookmarksButton.attr('aria-expanded', 'false');
    self.controls.$bookmarksChooser.insertAfter(self.controls.$bookmarksButton);
    self.controls.$bookmarksChooser.bind('transitionend', function () {
      self.controls.$bookmarksChooser.removeClass('h5p-transitioning');
    });
  }

  // Current time for minimal display
  var $simpleTime = $('<div class="h5p-control h5p-simple-time"><time class="h5p-current"><span class="human-time">0:00</span></time></div>').appendTo($left);
  self.controls.$currentTime = $simpleTime.find('.h5p-current').find('human-time');
  self.controls.$currentTimeA11y = $simpleTime.find('.h5p-current').find('hidden-but-read');

  // Add display for time elapsed and duration
  const textStartTime = InteractiveVideo.formatTimeForA11y(0, self.l10n);
  const textFullTime = InteractiveVideo.formatTimeForA11y(0, self.l10n);

  const $time = $(`<div class="h5p-control h5p-time">
    <time class="h5p-current">
      <span class="hidden-but-read">${self.l10n.currentTime} ${textStartTime}</span>
      <span class="human-time" aria-hidden="true">0:00</span>
    </time>
    <span>
      <span class=hidden-but-read> of </span>
      <span aria-hidden="true"> / </span>
    </span>
    <time class="h5p-total">
      <span class="hidden-but-read">${self.l10n.totalTime} ${textFullTime}</span>
      <span class="human-time" aria-hidden="true">0:00</span>
    </time>
  </div>`).appendTo($right);

  self.controls.$currentTime = self.controls.$currentTime.add($time.find('.h5p-current').find('.human-time'));
  self.controls.$currentTimeA11y = $time.find('.h5p-current').find('.hidden-but-read');
  self.controls.$totalTime = $time.find('.h5p-total');

  /**
   * Closes the minimal button overlay
   */
  const closeOverlay = () => {
    self.controls.$minimalOverlay.removeClass('h5p-show');
    self.controls.$more.attr('aria-expanded', 'false');
    self.controls.$more.focus();
    self.toggleBookmarksChooser(false);
    if (self.controls.$qualityButton && self.controls.$qualityButton.attr('aria-expanded') === 'true') {
      self.controls.$qualityButton.click();
    }
    if (self.controls.$playbackRateButton && self.controls.$playbackRateButton.attr('aria-expanded') === 'true') {
      self.controls.$playbackRateButton.click();
    }
    setTimeout(function () {
      self.controls.$overlayButtons.removeClass('h5p-hide');
    }, 150);
  };

  // Add control for displaying overlay with buttons
  self.controls.$more = self.createButton('more', 'h5p-control', $right, function () {
    const isExpanded = self.controls.$more.attr('aria-expanded') === 'true';

    if (isExpanded) {
      closeOverlay();
    }
    else {
      // Open overlay
      self.controls.$minimalOverlay.addClass('h5p-show');
      self.controls.$more.attr('aria-expanded', 'true');
      // Make sure splash screen is removed.
      self.removeSplash();

      setTimeout(() => {
        self.controls.$minimalOverlay.find('[tabindex="0"]').focus();
      }, 150);
    }

    // Make sure sub menus are closed
    if (bookmarksEnabled) {
      self.controls.$bookmarksChooser.add(self.controls.$qualityChooser).removeClass('h5p-show');
    }
    else {
      self.controls.$qualityChooser.removeClass('h5p-show');
      self.controls.$playbackRateChooser.removeClass('h5p-show');
    }
  });

  // Add popup for selecting playback rate
  self.controls.$playbackRateChooser = H5P.jQuery('<div/>', {
    'class': 'h5p-chooser h5p-playbackRate',
    'role': 'dialog',
    html: `<h3 id="${self.playbackRateMenuId}">${self.l10n.playbackRate}</h3>`,
  });

  // Button for opening video playback rate selection dialog
  self.controls.$playbackRateButton = self.createButton('playbackRate', 'h5p-control', $right, createPopupMenuHandler('$playbackRateButton', '$playbackRateChooser'));
  self.setDisabled(self.controls.$playbackRateButton);
  self.controls.$playbackRateButton.attr('aria-haspopup', 'true');
  self.controls.$playbackRateButton.attr('aria-expanded', 'false');

  self.controls.$playbackRateChooser.insertAfter(self.controls.$playbackRateButton);

  // Add volume button control (toggle mute)
  if (!isAndroid() && !isIpad()) {
    self.controls.$volume = self.createButton('mute', 'h5p-control', $right, function () {
      const $muteButton = self.controls.$volume;

      if (!self.deactivateSound) {
        if ($muteButton.hasClass('h5p-muted')) {
          $muteButton
            .removeClass('h5p-muted')
            .attr('title', self.l10n.mute);

          self.video.unMute();
        }
        else {
          $muteButton
            .addClass('h5p-muted')
            .attr('title', self.l10n.unmute);

          self.video.mute();
        }

        // refocus for reread button title by screen reader
        $muteButton.blur();
        $muteButton.focus();
      }
    });
    if (self.deactivateSound) {
      self.controls.$volume
        .addClass('h5p-muted')
        .attr('title', self.l10n.sndDisabled);

      self.setDisabled(self.controls.$volume);
    }
  }

  if (self.deactivateSound) {
    self.video.mute();
  }

  // TODO: Do not add until qualities are present?
  // Add popup for selecting video quality
  self.controls.$qualityChooser = H5P.jQuery('<div/>', {
    'class': 'h5p-chooser h5p-quality',
    'role': 'dialog',
    html: `<h3 id="${self.qualityMenuId}">${self.l10n.quality}</h3>`,
  });

  const closeQualityMenu = () => {
    if (self.isMinimal) {
      self.controls.$more.click();
    }
    else {
      self.controls.$qualityButton.click();
    }
  };

  // Adding close button to quality-menu
  self.controls.$qualityChooser.append($('<span>', {
    'role': 'button',
    'class': 'h5p-chooser-close-button',
    'tabindex': '0',
    'title': self.l10n.close,
    click: () => closeQualityMenu(),
    keydown: event => {
      if (event.which === 32 || event.which === 13) {
        closeQualityMenu();
        event.preventDefault();
      }
    }
  }));

  // Button for opening video quality selection dialog
  self.controls.$qualityButton = self.createButton('quality', 'h5p-control', $right, createPopupMenuHandler('$qualityButton', '$qualityChooser'));
  self.setDisabled(self.controls.$qualityButton);
  self.controls.$qualityButton.attr('aria-haspopup', 'true');
  self.controls.$qualityButton.attr('aria-expanded', 'false');
  self.controls.$qualityChooser.insertAfter(self.controls.$qualityButton);


  // Add fullscreen button
  if (!self.editor && H5P.fullscreenSupported !== false) {
    self.controls.$fullscreen = self.createButton('fullscreen', 'h5p-control', $right, function () {
      self.toggleFullScreen();
    });
  }

  // Add overlay for display controls inside
  self.controls.$minimalOverlay = H5P.jQuery('<div/>', {
    'class': 'h5p-minimal-overlay',
    appendTo: self.$container
  });

  // Use wrapper to center controls
  var $minimalWrap = H5P.jQuery('<div/>', {
    'role': 'menu',
    'class': 'h5p-minimal-wrap',
    appendTo: self.controls.$minimalOverlay
  });

  self.minimalMenuKeyboardControls = new Controls([new UIKeyboard()]);
  // close overlay on ESC
  self.minimalMenuKeyboardControls.on('close', () => closeOverlay());

  // Add buttons to wrapper
  self.controls.$overlayButtons = H5P.jQuery([]);

  // Bookmarks
  if (bookmarksEnabled) {
    self.controls.$bookmarkButtonMinimal = self.createButton('bookmarks', 'h5p-minimal-button', $minimalWrap, function () {
      self.controls.$overlayButtons.addClass('h5p-hide');
      self.toggleBookmarksChooser(true);
    }, true);
    self.controls.$bookmarkButtonMinimal.attr('role', 'menuitem');
    self.controls.$bookmarkButtonMinimal.attr('tabindex', '-1');

    self.controls.$overlayButtons = self.controls.$overlayButtons.add(self.controls.$bookmarkButtonMinimal);
    self.minimalMenuKeyboardControls.addElement(self.controls.$bookmarkButtonMinimal.get(0));
  }

  // Quality
  self.controls.$qualityButtonMinimal = self.createButton('quality', 'h5p-minimal-button', $minimalWrap, function () {
    if (!self.isDisabled(self.controls.$qualityButton)) {
      self.controls.$overlayButtons.addClass('h5p-hide');
      self.controls.$qualityButton.click();
    }
  }, true);
  self.setDisabled(self.controls.$qualityButtonMinimal);
  self.controls.$qualityButtonMinimal.attr('role', 'menuitem');
  self.controls.$overlayButtons = self.controls.$overlayButtons.add(self.controls.$qualityButtonMinimal);
  self.minimalMenuKeyboardControls.addElement(self.controls.$qualityButtonMinimal.get(0));

  // Playback rate
  self.controls.$playbackRateButtonMinimal = self.createButton('playbackRate', 'h5p-minimal-button', $minimalWrap, function () {
    if (!self.isDisabled(self.controls.$playbackRateButton)) {
      self.controls.$overlayButtons.addClass('h5p-hide');
      self.controls.$playbackRateButton.click();
    }
  }, true);
  self.controls.$playbackRateButtonMinimal.attr('role', 'menuitem');
  self.setDisabled(self.controls.$playbackRateButtonMinimal);
  self.controls.$overlayButtons = self.controls.$overlayButtons.add(self.controls.$playbackRateButtonMinimal);
  self.minimalMenuKeyboardControls.addElement(self.controls.$playbackRateButtonMinimal.get(0));

  self.addQualityChooser();
  self.addPlaybackRateChooser();

  self.interactionKeyboardControls = new Controls([new UIKeyboard()]);

  // Add containers for objects that will be displayed around the seekbar
  self.controls.$interactionsContainer = $('<div/>', {
    'role': 'menu',
    'class': 'h5p-interactions-container',
    appendTo: $slider
  });

  self.controls.$bookmarksContainer = $('<div/>', {
    'class': 'h5p-bookmarks-container',
    appendTo: $slider
  });

  // Add seekbar/timeline
  self.hasPlayPromise = false;
  self.hasQueuedPause = false;
  self.delayed = false;
  self.controls.$slider = $('<div/>', {appendTo: $slider}).slider({
    value: 0,
    step: 0.01,
    orientation: 'horizontal',
    range: 'min',
    max: 0,
    create: function (event, ui) {
      const $handle = $(event.target).find('.ui-slider-handle');

      $handle
        .attr('role', 'slider')
        .attr('aria-valuemin', '0')
        .attr('aria-valuemax',  self.video.getDuration().toString())
        .attr('aria-valuetext', InteractiveVideo.formatTimeForA11y(0, self.l10n))
        .attr('aria-valuenow', '0');

      if (self.preventSkipping) {
        self.setDisabled($handle).attr('aria-hidden', 'true');
      }
    },

    start: function () {
      if (self.currentState === InteractiveVideo.SEEKING) {
        return; // Prevent double start on touch devies!
      }

      if (!self.delayedState) {

        // Set play state if video was ended
        if (self.currentState === H5P.Video.ENDED) {
          self.lastState = H5P.Video.PLAYING;
        }
        // Set current state if it is not buffering, otherwise keep last state
        else if (self.currentState !== H5P.Video.BUFFERING || !self.lastState) {
          self.lastState = self.currentState;
        }
      }

      // Delay state change to prevent double clicks registering
      self.delayedState = true;
      clearTimeout(self.delayTimeout);
      self.delayTimeout = setTimeout(function () {
        self.delayedState = false;
      }, 200);

      if (self.hasPlayPromise) {
        // Queue pause if play has not been resolved
        self.hasQueuedPause = true;
      }
      else {
        self.video.pause();
      }
      self.currentState = InteractiveVideo.SEEKING;

      // Make sure splash screen is removed.
      self.removeSplash();

      // Make overlay visible to catch mouseup/move events.
      self.$overlay.addClass('h5p-visible');
    },
    slide: function (event, ui) {
      const arrowKeys = ['Right', 'Left', 'ArrowRight', 'ArrowLeft'];
      const isKeyboardNav = arrowKeys.indexOf(event.key) !== -1;
      const continueHandlingEvents = !isKeyboardNav;
      let time = ui.value;

      if(isKeyboardNav) {
        const endTime = self.video.getDuration();
        const currentTime = self.video.getCurrentTime();

        time = (event.key.indexOf('Right') !== -1) ?
          Math.min(currentTime + KEYBOARD_STEP_LENGTH_SECONDS, endTime) :
          Math.max(currentTime - KEYBOARD_STEP_LENGTH_SECONDS, 0);

        self.timeUpdate(time);
      }

      // Update elapsed time
      self.video.seek(time);
      self.updateInteractions(time);

      const humanTime = InteractiveVideo.humanizeTime(time);
      const a11yTime = InteractiveVideo.formatTimeForA11y(time, self.l10n);

      self.controls.$currentTime.html(humanTime);
      self.controls.$currentTimeA11y.html(`${self.l10n.currentTime} ${a11yTime}`);

      return continueHandlingEvents;
    },
    stop: function (e, ui) {
      self.currentState = self.lastState;
      self.video.seek(ui.value);

      // Must recreate interactions because "continue" detaches them and they
      // are not "re-updated" if they have only been detached (not completely removed)
      self.recreateCurrentInteractions();

      var startPlaying = self.lastState === H5P.Video.PLAYING ||
        self.lastState === H5P.Video.VIDEO_CUED || self.hasQueuedPause;
      if (self.hasPlayPromise) {
        // Skip pausing when play promise is resolved
        self.hasQueuedPause = false;
      }
      else if (startPlaying) {
        self.hasQueuedPause = false;
        var play = self.video.play();
        self.hasQueuedPause = false;

        // Handle play as a Promise
        if (play && play.then) {
          self.hasPlayPromise = true;
          play.then(function () {

            // Pause at next cycle to not conflict with play
            setTimeout(function () {

              // Pause on queue or on interactions without having to recreate them
              if (self.hasQueuedPause || self.hasActivePauseInteraction()) {
                self.video.pause();
              }
              self.hasPlayPromise = false;
            }, 0);
          });
        }
        else {
          // Pause on interactions without having to recreate them
          if (self.hasActivePauseInteraction()) {
            // YouTube needs to play after seek to not get stuck buffering.
            self.video.play();
            setTimeout(function () {
              self.video.pause();
            }, 50);
          }
        }
      }
      else {
        self.timeUpdate(ui.value);
      }

      // Done catching mouse events
      self.$overlay.removeClass('h5p-visible');
    }
  });

  // Disable slider
  if (self.preventSkipping) {
    self.controls.$slider.slider('disable');
    self.controls.$slider.click(function (e) {
      self.showPreventSkippingMessage(e.offsetX);
      return false;
    });
  }

  /* Show bookmarks, except when youtube is used on iPad */
  if (self.showBookmarksmenuOnLoad && self.video.pressToPlay === false) {
    self.toggleBookmarksChooser(true);
  }

  // Add buffered status to seekbar
  self.controls.$buffered = $('<div/>', {'class': 'h5p-buffered', prependTo: self.controls.$slider});
};

/**
 * Check if any active interactions should be paused
 * @return {boolean} True if an interaction should be paused
 */
InteractiveVideo.prototype.hasActivePauseInteraction = function () {
  var hasActivePauseInteractions = false;
  this.interactions.forEach(function (interaction) {

    // Interaction is visible and should be paused
    if (interaction.getElement() && interaction.pause()) {
      hasActivePauseInteractions = true;
    }
  });

  return hasActivePauseInteractions;
};

/**
 * Help create control buttons.
 *
 * @param {string} type
 * @param {string} extraClass
 * @param {H5P.jQuery} $target
 * @param {function} handler
 * @param {boolean} [text] Determines if button should set text or title
 */
InteractiveVideo.prototype.createButton = function (type, extraClass, $target, handler, text) {
  var self = this;
  var options = {
    role: 'button',
    tabindex: 0,
    'class': (extraClass === undefined ? '' : extraClass + ' ') + 'h5p-' + type,
    on: {
      click: function () {
        handler.call(this);
      },
      keydown: function (event) {
        if (event.which === 32 || event.which === 13) { // Space or enter
          handler.call(this);
          event.preventDefault();
          event.stopPropagation();
        }
      }
    },
    appendTo: $target
  };
  options[text ? 'text' : 'title'] = self.l10n[type];
  return H5P.jQuery('<div/>', options);
};

/**
 * Add a dialog for selecting video quality.
 */
InteractiveVideo.prototype.addQualityChooser = function () {
  var self = this;
  self.qualityMenuKeyboardControls = new Controls([new UIKeyboard()]);
  self.qualityMenuKeyboardControls.on('close', () => self.controls.$qualityButton.click());

  if (!this.video.getQualities) {
    return;
  }

  var qualities = this.video.getQualities();
  if (!qualities || this.controls.$qualityButton === undefined || !(self.isDisabled(self.controls.$qualityButton))) {
    return;
  }

  var currentQuality = this.video.getQuality();

  var html = '';
  for (var i = 0; i < qualities.length; i++) {
    var quality = qualities[i];
    const isChecked = quality.name === currentQuality;
    html += `<li role="menuitemradio" data-quality="${quality.name}" aria-checked="${isChecked}" aria-describedby="${self.qualityMenuId}">${quality.label}</li>`;
  }

  var $list = $(`<ul role="menu">${html}</ul>`).appendTo(this.controls.$qualityChooser);

  $list.children()
    .click(function() {
      const quality = $(this).attr('data-quality');
      self.updateQuality(quality);
    })
    .keydown(function(e) {
      if(e.which === 32 || e.which === 13) {
        const quality = $(this).attr('data-quality');
        self.updateQuality(quality);
      }

      e.stopPropagation();
    });

  const menuElements = $list.find('li').get();
  menuElements.forEach((el, index) => {
    self.qualityMenuKeyboardControls.addElement(el);

    // updates tabindex based on if it's selected
    const isSelected = el.getAttribute('aria-checked') === 'true';
    toggleTabIndex(el, isSelected);
  });

  // Enable quality chooser button
  self.removeDisabled(this.controls.$qualityButton.add(this.controls.$qualityButtonMinimal));
};



/**
 * Updates the quality of the video, and toggles menus
 *
 * @param {string} quality
 */
InteractiveVideo.prototype.updateQuality = function (quality) {
  var self = this;
  self.video.setQuality(quality);
  if (self.controls.$more.attr('aria-expanded') === 'true') {
    self.controls.$more.click();
  }
  else {
    self.controls.$qualityButton.click();
    self.controls.$qualityButton.focus();
  }
};

/**
 * Add a dialog for selecting video playback rate.
 */
InteractiveVideo.prototype.addPlaybackRateChooser = function () {
  var self = this;

  this.playbackRateMenuKeyboardControls = new Controls([new UIKeyboard()]);
  this.playbackRateMenuKeyboardControls.on('close', () => self.controls.$playbackRateButton.click());
  if (!this.video.getPlaybackRates) {
    return;
  }

  var playbackRates = this.video.getPlaybackRates();

  // don't enable playback rate chooser if only default rate can be chosen
  if (playbackRates.length < 2) {
    return;
  }

  if (!playbackRates || this.controls.$playbackRateButton === undefined ||
    !(self.isDisabled(this.controls.$playbackRateButton))) {
    return;
  }

  var currentPlaybackRate = this.video.getPlaybackRate();

  var html = '';
  for (var i = 0; i < playbackRates.length; i++) {
    var playbackRate = playbackRates[i];
    var isSelected = (playbackRate === currentPlaybackRate);
    html += `<li role="menuitemradio" playback-rate="${playbackRate}" aria-checked="${isSelected}" aria-describedby="${self.playbackRateMenuId}">${playbackRate}</li>`;
  }

  var $list = $('<ul role="menu">' + html + '</ul>').appendTo(this.controls.$playbackRateChooser);

  $list.children()
    .click(function() {
      const rate = $(this).attr('playback-rate');
      self.updatePlaybackRate(rate);
    })
    .keydown(function(e) {
      if(e.which === 32 || e.which === 13){
        const rate = $(this).attr('playback-rate');
        self.updatePlaybackRate(rate);
      }
      e.stopPropagation();
    });

  // add keyboard controls
  $list.find('li').get().forEach(el => {
    this.playbackRateMenuKeyboardControls.addElement(el);

    // updates tabindex based on if it's selected
    const isSelected = el.getAttribute('aria-checked') === 'true';
    toggleTabIndex(el, isSelected);
  });

  // Enable playback rate chooser button
  self.removeDisabled(this.controls.$playbackRateButton.add(this.controls.$playbackRateButtonMinimal));
};

InteractiveVideo.prototype.updatePlaybackRate = function (rate) {
  var self = this;

  self.video.setPlaybackRate(rate);
  if (self.controls.$more.attr('aria-expanded') === 'true') {
    self.controls.$more.click();
  }
  else {
    self.controls.$playbackRateButton.click();
  }
};

/**
 * Create loop that constantly updates the buffer bar
 */
InteractiveVideo.prototype.startUpdatingBufferBar = function () {
  var self = this;
  if (self.bufferLoop) {
    return;
  }

  var updateBufferBar = function () {
    var buffered = self.video.getBuffered();
    if (buffered && self.controls.$buffered) {
      self.controls.$buffered.css('width', buffered + '%');
    }
    self.bufferLoop = setTimeout(updateBufferBar, 500);
  };
  updateBufferBar();
};

/**
 * Resize the video to fit the wrapper.
 */
InteractiveVideo.prototype.resize = function () {
  // Not yet attached
  if (!this.$container) {
    return;
  }

  var self = this;
  var fullscreenOn = this.$container.hasClass('h5p-fullscreen') || this.$container.hasClass('h5p-semi-fullscreen');

  this.$videoWrapper.css({
    marginTop: '',
    marginLeft: '',
    width: '',
    height: ''
  });
  this.video.trigger('resize');

  var width;
  var videoHeight;
  var controlsHeight = this.justVideo ? 0 : this.$controls.height();
  var containerHeight = this.$container.height();
  if (fullscreenOn) {
    videoHeight = this.$videoWrapper.height();

    if (videoHeight + controlsHeight <= containerHeight) {
      this.$videoWrapper.css('marginTop', (containerHeight - controlsHeight - videoHeight) / 2);
      width = this.$videoWrapper.width();
    }
    else {
      var ratio = this.$videoWrapper.width() / videoHeight;
      var height = containerHeight - controlsHeight;
      width = height * ratio;
      this.$videoWrapper.css({
        marginLeft: (this.$container.width() - width) / 2,
        width: width,
        height: height
      });
    }

    // Resize again to fit the new container size.
    this.video.trigger('resize');
  }
  else {
    width = this.$container.width();
  }

  // Set base font size. Don't allow it to fall below original size.
  this.scaledFontSize = (width > this.width) ? (this.fontSize * (width / this.width)) : this.fontSize;
  this.$container.css('fontSize', this.scaledFontSize + 'px');

  if (!this.editor) {
    if (width < this.width) {
      if (!this.$container.hasClass('h5p-minimal')) {
        // Use minimal controls
        this.$container.addClass('h5p-minimal');
      }
    }
    else if (this.$container.hasClass('h5p-minimal')) {
      // Use normal controls
      this.$container.removeClass('h5p-minimal');
    }
  }

  this.isMinimal = this.$container.hasClass('h5p-minimal');

  // Reset control popup calculations
  var popupControlsHeight = this.$videoWrapper.height();
  this.controlsCss = {
    bottom: '',
    maxHeight: popupControlsHeight + 'px'
  };

  if (fullscreenOn) {

    // Make sure popup controls are on top of video wrapper
    var offsetBottom = controlsHeight;

    // Center popup menus
    if (videoHeight + controlsHeight <= containerHeight) {
      offsetBottom = controlsHeight + ((containerHeight - controlsHeight - videoHeight) / 2);
    }
    this.controlsCss.bottom = offsetBottom + 'px';
  }

  if (this.controls && this.controls.$minimalOverlay) {
    this.controls.$minimalOverlay.css(this.controlsCss);
  }
  this.$container.find('.h5p-chooser').css(this.controlsCss);

  // Resize start screen
  if (!this.editor) {
    this.resizeMobileView();
    if (this.$splash !== undefined) {
      this.resizeStartScreen();
    }
  }
  else if (this.editor.dnb) {
    this.editor.dnb.dnr.setContainerEm(this.scaledFontSize);
  }

  this.resizeInteractions();
};

/**
 * Determine if interactive video should be in mobile view.
 */
InteractiveVideo.prototype.resizeMobileView = function () {
  // IV not init
  if (isNaN(this.currentState)) {
    return;
  }
  // Width to font size ratio threshold
  var widthToEmThreshold = 30;
  var ivWidth = this.$container.width();
  var fontSize = parseInt(this.$container.css('font-size'), 10);
  var widthToEmRatio = ivWidth / fontSize;
  if (widthToEmRatio < widthToEmThreshold) {
    // Resize interactions in mobile view
    this.resizeInteractions();

    if (!this.isMobileView) {
      this.$container.addClass('mobile');
      this.isMobileView = true;

      // should not close overlay for required interactions, but still show dialog
      if (this.hasUncompletedRequiredInteractions()) {
        var $dialog = $('.h5p-dialog', this.$container);
        $dialog.show();
      } else {
        this.dnb.dialog.closeOverlay();
      }

      this.recreateCurrentInteractions();
    }
  }
  else {
    if (this.isMobileView) {
      // Close dialog because we can not know if it will turn into a poster
      if (this.dnb && this.dnb.dialog && !this.hasUncompletedRequiredInteractions()) {
        this.dnb.dialog.close();
      }
      this.$container.removeClass('mobile');
      this.isMobileView = false;
      this.recreateCurrentInteractions();
    }
  }
};

/**
 * Resize all interactions.
 */
InteractiveVideo.prototype.resizeInteractions = function () {
  // IV not init
  if (isNaN(this.currentState)) {
    return;
  }

  var self = this;
  this.interactions.forEach(function (interaction) {
    interaction.resizeInteraction();
    interaction.repositionToWrapper(self.$videoWrapper);
    interaction.positionLabel(self.$videoWrapper.width());
  });
};

/**
 * Recreate interactions
 */
InteractiveVideo.prototype.recreateCurrentInteractions = function () {
  this.dnb.blurAll();
  this.interactions.forEach(function (interaction) {
    interaction.reCreateInteraction();
  });
};

/**
 * Resizes the start screen.
 */
InteractiveVideo.prototype.resizeStartScreen = function () {
  var descriptionSizeEm = 0.8;
  var titleSizeEm = 1.5;

  var playFontSizeThreshold = 10;

  var staticWidthToFontRatio = 50;
  var staticMobileViewThreshold = 510;

  var hasDescription = true;
  var hasTitle = true;

  // Scale up width to font ratio if one component is missing
  if (this.startScreenOptions.shortStartDescription === undefined ||
    !this.startScreenOptions.shortStartDescription.length) {
    hasDescription = false;
    if (this.startScreenOptions.hideStartTitle) {
      hasTitle = false;
      staticWidthToFontRatio = 45;
    }
  }

  var $splashDescription = $('.h5p-splash-description', this.$splash);
  var $splashTitle = $('.h5p-splash-title', this.$splash);
  var $tmpDescription = $splashDescription.clone()
    .css('position', 'absolute')
    .addClass('minimum-font-size')
    .appendTo($splashDescription.parent());
  var $tmpTitle = $splashTitle.clone()
    .css('position', 'absolute')
    .addClass('minimum-font-size')
    .appendTo($splashTitle.parent());
  var descriptionFontSizeThreshold = parseInt($tmpDescription.css('font-size'), 10);
  var titleFontSizeThreshold = parseInt($tmpTitle.css('font-size'), 10);

  // Determine new font size for splash screen from container width
  var containerWidth = this.$container.width();
  var newFontSize = parseInt(containerWidth / staticWidthToFontRatio, 10);

  if (!hasDescription) {
    if (hasTitle && newFontSize < descriptionFontSizeThreshold) {
      newFontSize = descriptionFontSizeThreshold;
    }
    else if (newFontSize < playFontSizeThreshold) {
      newFontSize = playFontSizeThreshold;
    }
  }

  // Determine if we should add mobile view
  if (containerWidth < staticMobileViewThreshold) {
    this.$splash.addClass('mobile');
  }
  else {
    this.$splash.removeClass('mobile');
  }

  // Minimum font sizes
  if (newFontSize * descriptionSizeEm < descriptionFontSizeThreshold) {
    $splashDescription.addClass('minimum-font-size');
  }
  else {
    $splashDescription.removeClass('minimum-font-size');
  }

  if (newFontSize * titleSizeEm < titleFontSizeThreshold) {
    $splashTitle.addClass('minimum-font-size');
  }
  else {
    $splashTitle.removeClass('minimum-font-size');
  }

  // Set new font size
  this.$splash.css('font-size', newFontSize);
  $tmpDescription.remove();
  $tmpTitle.remove();
};

/**
 * Toggle enter or exit fullscreen mode.
 */
InteractiveVideo.prototype.toggleFullScreen = function () {
  var self = this;

  if (H5P.isFullscreen || this.$container.hasClass('h5p-fullscreen') || this.$container.hasClass('h5p-semi-fullscreen')) {
    // Cancel fullscreen
    if (H5P.exitFullScreen !== undefined && H5P.fullScreenBrowserPrefix !== undefined) {
      H5P.exitFullScreen();
    }
    else {
      // Use old system
      if (H5P.fullScreenBrowserPrefix === undefined) {
        // Click button to disable fullscreen
        $('.h5p-disable-fullscreen').click();
      }
      else {
        // Exit full screen
        if (H5P.fullScreenBrowserPrefix === '') {
          window.top.document.exitFullScreen();
        }
        else if (H5P.fullScreenBrowserPrefix === 'ms') {
          window.top.document.msExitFullscreen();
        }
        else {
          window.top.document[H5P.fullScreenBrowserPrefix + 'CancelFullScreen']();
        }
      }

      // Manually trigger event that updates fullscreen icon
      self.trigger('exitFullScreen');
    }
  }
  else {
    H5P.fullScreen(this.$container, this);

    if (H5P.exitFullScreen === undefined) {
      // Old system; manually trigger the event that updates the fullscreen icon
      self.trigger('enterFullScreen');
    }
  }

  // Resize all interactions
  this.resizeInteractions();
};

/**
 * Called when the time of the video changes.
 * Makes sure to update all UI elements.
 *
 * @param {number} time
 */
InteractiveVideo.prototype.timeUpdate = function (time) {
  var self = this;

  // Scroll slider
  if (time >= 0) {
    try {
      const sliderHandle = self.controls.$slider.find('.ui-slider-handle');
      const timePassedText = InteractiveVideo.formatTimeForA11y(time, self.l10n);

      self.controls.$slider.slider('option', 'value', time);
      sliderHandle.attr('aria-valuetext', timePassedText);
      sliderHandle.attr('aria-valuenow', time.toString());
    }
    catch (err) {
      // Prevent crashing when changing lib. Exit function
      return;
    }
  }

  self.updateInteractions(time);

  setTimeout(function () {
    if (self.currentState === H5P.Video.PLAYING ||
      (self.currentState === H5P.Video.BUFFERING && self.lastState === H5P.Video.PLAYING)
    ) {
      self.timeUpdate(self.video.getCurrentTime());
    }
  }, 40); // 25 fps
};

/**
 * Updates interactions
 *
 * @param {number} time
 */
InteractiveVideo.prototype.updateInteractions = function (time) {
  var self = this;

  // Some UI elements are updated every 10th of a second.
  var tenth = Math.floor(time * 10) / 10;
  if (tenth !== self.lastTenth) {
    // Check for bookmark
    if (self.bookmarksMap !== undefined && self.bookmarksMap[tenth] !== undefined) {
      // Show bookmark
      self.bookmarksMap[tenth].mouseover().mouseout();
    }
  }
  self.lastTenth = tenth;

  // Some UI elements are updated every second.
  var second = Math.floor(time);
  if (second !== self.lastSecond) {
    self.toggleInteractions(second);

    if (self.currentState === H5P.Video.PLAYING || self.currentState === H5P.Video.PAUSED) {
      // Update elapsed time
      self.controls.$currentTime.html(InteractiveVideo.humanizeTime(Math.max(second, 0)));
      self.controls.$currentTimeA11y.html(InteractiveVideo.formatTimeForA11y(Math.max(second, 0), self.l10n));
    }
  }
  self.lastSecond = second;
};

/**
 * Call xAPI completed only once
 *
 * @public
 */
InteractiveVideo.prototype.complete = function () {
  // Skip for editor
  if (this.editor) {
    return;
  }

  if (!this.completedSent) {
    // Post user score. Max score is based on how many of the questions the user
    // actually answered
    this.triggerXAPIScored(this.getUsersScore(), this.getUsersMaxScore(), 'completed');
  }
  this.completedSent = true;
};

/**
 * Gets the users score
 * @returns {number}
 */
InteractiveVideo.prototype.getUsersScore = function () {
  var score = 0;

  for (var i = 0; i < this.interactions.length; i++) {
    if (this.interactions[i].score) {
      score += this.interactions[i].score;
    }
  }

  return score;
};

/**
 * Gets the users max score
 * @returns {number}
 */
InteractiveVideo.prototype.getUsersMaxScore = function () {
  var maxScore = 0;

  for (var i = 0; i < this.interactions.length; i++) {
    if (this.interactions[i].maxScore) {
      maxScore += this.interactions[i].maxScore;
    }
  }

  return maxScore;
};

/**
 * Implements getScore from the question type contract
 * @returns {number}
 */
InteractiveVideo.prototype.getScore = function () {
  return this.getUsersScore();
};

/**
 * Implements getMaxScore from the question type contract
 * @returns {number}
 */
InteractiveVideo.prototype.getMaxScore = function () {
  return this.getUsersMaxScore();
};


/**
 * Show a mask behind the interaction to prevent the user from clicking the video or controls
 *
 * @return {jQuery} the dialog wrapper element
 */
InteractiveVideo.prototype.showOverlayMask = function () {
  var self = this;

  self.$videoWrapper.addClass('h5p-disable-opt-out');
  self.dnb.dialog.openOverlay();

  var $dialogWrapper = self.$container.find('.h5p-dialog-wrapper');
  $dialogWrapper.click(function () {
    if (self.hasUncompletedRequiredInteractions()) {
      self.showWarningMask();
    }
  });
};

/**
 * Hides the mask behind the interaction
 * @return {jQuery} the dialog wrapper element
 */
InteractiveVideo.prototype.hideOverlayMask = function () {
  var self = this;

  self.dnb.dialog.closeOverlay();
  self.$videoWrapper.removeClass('h5p-disable-opt-out');

  return self.$container.find('.h5p-dialog-wrapper');
};


/**
 * Shows the warning mask.
 * The mask is shared by all interactions
 */
InteractiveVideo.prototype.showWarningMask = function () {
  var self = this;

  // create mask if doesn't exist
  if (!self.$mask) {
    self.$mask = $(
      '<div class="h5p-warning-mask">' +
      '<div class="h5p-warning-mask-wrapper">' +
      '<div class="h5p-warning-mask-content">' + self.l10n.requiresCompletionWarning + '</div>' +
      '<button type="button" class="h5p-joubelui-button h5p-button-back">' + self.l10n.back + '</button>' +
      '</div>' +
      '</div>'
    ).click(function () {
      self.$mask.hide();
    }).appendTo(self.$container);
  }

  self.$mask.show();
};

/**
 * Sets aria-disabled and removes tabindex from an element
 *
 * @param {jQuery} $element
 * @return {jQuery}
 */
InteractiveVideo.prototype.setDisabled = $element => {
  return $element
    .attr('aria-disabled', 'true')
    .attr('tabindex', '-1');
};

/**
 * Returns true if the element has aria-disabled
 *
 * @param {jQuery} $element
 * @return {boolean}
 */
InteractiveVideo.prototype.isDisabled = $element => {
  return $element.attr('aria-disabled') === 'true';
};

/**
 * Removes aria-disabled and adds tabindex to an element
 *
 * @param {jQuery} $element
 * @return {jQuery}
 */
InteractiveVideo.prototype.removeDisabled = $element => {
  return $element
    .removeAttr('aria-disabled')
    .attr('tabindex', '0');
};

/**
 * Returns true if there are visible interactions that require completed
 * and the user doesn't have full score
 *
 * @param {number} second
 * @returns {boolean} If any required interaction is not completed with full score
 */
InteractiveVideo.prototype.hasUncompletedRequiredInteractions = function (second) {
  var self = this;

  // Find interactions
  var interactions = (second !== undefined ?
    self.getVisibleInteractionsAt(second) : self.getVisibleInteractions());

  return interactions.some(function (interaction) {
    return interaction.getRequiresCompletion () && !interaction.hasFullScore();
  });
};

/**
 * Returns an array of interactions currently visible
 *
 * @return {H5P.InteractiveVideoInteraction[]} visible interactions
 */
InteractiveVideo.prototype.getVisibleInteractions = function () {
  return this.interactions.filter(function (interaction) {
    return interaction.isVisible();
  });
};

/**
 * Returns an array of interactions currently visible
 *
 * @return {H5P.InteractiveVideoInteraction[]} visible interactions
 */
InteractiveVideo.prototype.getVisibleInteractionsAt = function (second) {
  return this.interactions.filter(function (interaction) {
    return interaction.visibleAt(second);
  });
};

/**
 * Implements showSolutions from the question type contract
 */
InteractiveVideo.prototype.showSolutions = function () {
  // Intentionally left empty. Function makes IV pop up in CP summary
};

/**
 * Implements getTitle from the question type contract
 * @returns {string}
 */
InteractiveVideo.prototype.getTitle = function () {
  return H5P.createTitle(this.options.video.startScreenOptions.title);
};

/**
 * Display and remove interactions for the given second.
 * @param {number} second
 */
InteractiveVideo.prototype.toggleInteractions = function (second) {
  for (var i = 0; i < this.interactions.length; i++) {
    this.interactions[i].toggle(second);
    this.interactions[i].repositionToWrapper(this.$videoWrapper);
  }
};

/**
 * Start interactive video playback.
 */
InteractiveVideo.prototype.play = function () {
  this.video.play();
};

/**
 * Seek interactive video to the given time
 * @param {number} time
 */
InteractiveVideo.prototype.seek = function (time) {
  this.video.seek(time);
};

/**
 * Pause interactive video playback.
 */
InteractiveVideo.prototype.pause = function () {
  if (this.video && this.video.pause) {
    this.video.pause();
  }
};

/**
 * Reset all interaction progress and answers
 */
InteractiveVideo.prototype.resetTask = function () {
  if (this.controls === undefined) {
    return; // Content has not been used
  }

  this.seek(0); // Rewind
  this.timeUpdate(-1);
  this.controls.$slider.slider('option', 'value', 0);

  for (var i = 0; i < this.interactions.length; i++) {
    this.interactions[i].resetTask();
  }
};

/**
 * Force readspeaker to read text. Useful when you have to use
 * setTimeout for animations.
 */
InteractiveVideo.prototype.read = function (content) {
  const self = this;

  if (!self.$read) {
    return; // Not ready yet
  }

  if (self.readText) {
    // Combine texts if called multiple times
    self.readText += (self.readText.substr(-1, 1) === '.' ? ' ' : '. ') + content;
  }
  else {
    self.readText = content;
  }

  // Set text
  self.$read.html(self.readText);

  setTimeout(() => {
    // Stop combining when done reading
    self.readText = null;
    self.$read.html('');
  }, 100);
};

/**
 * Gather copyright information for the current content.
 *
 * @returns {H5P.ContentCopyrights}
 */
InteractiveVideo.prototype.getCopyrights = function () {
  var self = this;
  var info = new H5P.ContentCopyrights();

  // Adding video file copyright info
  if (self.options.video.files !== undefined && self.options.video.files[0] !== undefined) {
    info.addMedia(new H5P.MediaCopyright(self.options.video.files[0].copyright, self.l10n));
  }

  // Adding info from copyright field
  if (self.options.video.startScreenOptions.copyright !== undefined) {
    info.addMedia(self.options.video.startScreenOptions.copyright);
  }

  // Adding copyrights for poster
  var poster = self.options.video.startScreenOptions.poster;
  if (poster && poster.copyright !== undefined) {
    var image = new H5P.MediaCopyright(poster.copyright, self.l10n);
    var imgSource = H5P.getPath(poster.path, self.contentId);
    image.setThumbnail(new H5P.Thumbnail(imgSource, poster.width, poster.height));
    info.addMedia(image);
  }

  // Adding copyrights for interactions
  for (var i = 0; i < self.interactions.length; i++) {
    var interactionCopyrights = self.interactions[i].getCopyrights();
    if (interactionCopyrights) {
      info.addContent(interactionCopyrights);
    }
  }

  return info;
};

// Additional player states
/** @constant {number} */
InteractiveVideo.SEEKING = 4;
/** @constant {number} */
InteractiveVideo.LOADED = 5;
/** @constant {number} */
InteractiveVideo.ATTACHED = 6;

/**
 * Formats time in H:MM:SS.
 *
 * @public
 * @param {number} seconds
 * @returns {string}
 */
InteractiveVideo.humanizeTime = function (seconds) {
  const time = InteractiveVideo.secondsToMinutesAndHours(seconds);
  let result = '';

  if (time.hours !== 0) {
    result += time.hours + ':';

    if (time.minutes < 10) {
      result += '0';
    }
  }

  result += time.minutes + ':';

  if (time.seconds < 10) {
    result += '0';
  }

  result += time.seconds;

  return result;
};

/**
 * Returns a string for reading out time passed
 *
 * @param {number} seconds
 * @param {object} labels
 * @return {string}
 */
InteractiveVideo.formatTimeForA11y = function(seconds, labels) {
  const time = InteractiveVideo.secondsToMinutesAndHours(seconds);
  const hoursText = time.hours > 0 ? `${time.hours} ${labels.hours}, ` : '';

  return `${hoursText}${time.minutes} ${labels.minutes}, ${time.seconds} ${labels.seconds}`;
};

/**
 * Takes seconds as a number, and splits it into seconds,
 * minutes and hours
 *
 * @param {number} seconds
 * @return {Time}
 */
InteractiveVideo.secondsToMinutesAndHours = function(seconds) {
  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);

  return {
    seconds: Math.floor(seconds % SECONDS_IN_MINUTE),
    minutes: minutes % MINUTES_IN_HOUR,
    hours: Math.floor(minutes / MINUTES_IN_HOUR)
  };
};

/**
 * Sets tabindex="0" if selected removes attribute otherwise
 *
 * @param {element} el
 * @param {boolean} isSelected
 */
var toggleTabIndex = function(el, isSelected){
  if(isSelected) {
    el.setAttribute('tabindex', '0');
  }
  else {
    el.removeAttribute('tabindex');
  }
};

/**
 * Look for field with the given name in the given collection.
 * Only used by editor.
 *
 * @private
 * @param {string} name of field
 * @param {Array} fields collection to look in
 * @returns {Object} field object
 */
var findField = function (name, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].name === name) {
      return fields[i];
    }
  }
};

/**
 * Generic elseif for when to delay work or run straight away.
 *
 * @param {number} time null to carry out straight away
 * @param {function} job what to do
 */
var delayWork = function (time, job) {
  if (time === null) {
    job();
  }
  else {
    setTimeout(job, time);
  }
};

/**
 * Get xAPI data.
 * Contract used by report rendering engine.
 *
 * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
 */
InteractiveVideo.prototype.getXAPIData = function(){
  var self = this;
  var xAPIEvent = this.createXAPIEventTemplate('answered');
  addQuestionToXAPI(xAPIEvent);
  xAPIEvent.setScoredResult(self.getScore(),
    self.getMaxScore(),
    self,
    true,
    self.getScore() === self.getMaxScore()
  );

  var childrenData = getXAPIDataFromChildren(self.interactions);
  return {
    statement: xAPIEvent.data.statement,
    children: childrenData
  };
};

/**
 * Add the question itself to the definition part of an xAPIEvent
 */
var addQuestionToXAPI = function(xAPIEvent) {
  var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
  H5P.jQuery.extend(definition, getxAPIDefinition());
};

/**
 * Generate xAPI object definition used in xAPI statements.
 * @return {Object}
 */
var getxAPIDefinition = function () {
  var definition = {};

  definition.interactionType = 'compound';
  definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
  definition.description = {
    'en-US': ''
  };

  return definition;
};

/**
 * Get xAPI data from instances within a content type
 *
 * @param {Object} H5P instances
 * @returns {array}
 */
var getXAPIDataFromChildren = function(children) {
  return children.map(function(child) {
    return child.getXAPIData();
  });
};

export default InteractiveVideo;
