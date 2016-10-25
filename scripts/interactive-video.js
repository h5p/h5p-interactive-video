H5P.InteractiveVideo = (function ($, EventDispatcher, DragNBar, Interaction) {

  /**
   * Initialize a new interactive video.
   *
   * @class H5P.InteractiveVideo
   * @extends H5P.EventDispatcher
   * @param {Object} params
   * @param {number} id
   * @param {Object} contentData
   */
  function InteractiveVideo(params, id, contentData) {
    var self = this;
    var startAt;

    // Inheritance
    H5P.EventDispatcher.call(self);

    // Keep track of content ID
    self.contentId = id;

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
        self.override.enableSolutionsButton =
            (params.override.showSolutionButton === 'on' ? true : false);
      }

      if (params.override.retryButton) {
        // Force "Retry" button to be on or off for all interactions
        self.override.enableRetry =
            (params.override.retryButton === 'on' ? true : false);
      }
    }

    if (params.override !== undefined) {
      self.showRewind10 = (params.override.showRewind10 !== undefined ? params.override.showRewind10 : false);
      self.showBookmarksmenuOnLoad = (params.override.showBookmarksmenuOnLoad !== undefined ? params.override.showBookmarksmenuOnLoad : false);
      self.preventSkipping = params.override.preventSkipping || false;
    }
    // Translated UI text defaults
    self.l10n = $.extend({
      interaction: 'Interaction',
      play: 'Play',
      pause: 'Pause',
      mute: 'Mute',
      quality: 'Video quality',
      unmute: 'Unmute',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      summary: 'Summary',
      bookmarks: 'Bookmarks',
      defaultAdaptivitySeekLabel: 'Continue',
      continueWithVideo: 'Continue with video',
      more: 'More',
      playbackRate: 'Playback rate',
      rewind10: 'Rewind 10 seconds'
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
    if(iOSMatches !== null && iOSMatches.length === 3) {
      // If iOS < 10, let's play video only...
      self.justVideo = iOSMatches[2] < 10;
    }

    // set start time
    startAt = (self.previousState && self.previousState.progress) ? Math.floor(self.previousState.progress) : 0;
    if (startAt === 0 && params.override && !!params.override.startVideoAt) {
      startAt = params.override.startVideoAt;
    }

    // Start up the video player
    self.video = H5P.newRunnable({
      library: 'H5P.Video 1.2',
      params: {
        sources: self.options.video.files,
        visuals: {
          poster: self.options.video.startScreenOptions.poster,
          controls: self.justVideo,
          fit: false
        },
        startAt: startAt
      }
    }, self.contentId, undefined, undefined, {parent: self});

    // Listen for video events
    if (self.justVideo) {
      self.video.on('loaded', function (event) {
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
    self.video.on('loaded', function (event) {
      isLoaded = true;
      // Update IV player UI
      self.loaded();
    });

    self.video.on('error', function (event) {
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
          self.controls.$play.addClass('h5p-pause').attr('title', self.l10n.play);
          self.timeUpdate(self.video.getCurrentTime());
          self.controls.$currentTime.html(self.controls.$totalTime.html());

          self.complete();
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
          self.controls.$play.removeClass('h5p-pause').attr('title', self.l10n.pause);
          self.timeUpdate(self.video.getCurrentTime());
          break;

        case H5P.Video.PAUSED:
          self.currentState = H5P.Video.PAUSED;
          self.controls.$play.addClass('h5p-pause').attr('title', self.l10n.play);
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
        self.controls.$qualityChooser.find('li').removeClass('h5p-selected').filter('[data-quality="' + quality + '"]').addClass('h5p-selected');
      }
    });

    self.video.on('playbackRateChange', function (event) {
      var playbackRate = event.data;
      // Firefox fires a "ratechange" event immediately upon changing source, at this
      // point controls has not been initialized, so we must check for controls
      if (self.controls && self.controls.$playbackRateChooser) {
        // Update playbackRate selector
        self.controls.$playbackRateChooser.find('li').removeClass('h5p-selected').filter('[playback-rate="' + playbackRate + '"]').addClass('h5p-selected');
      }
    });

    // Handle entering fullscreen
    self.on('enterFullScreen', function () {
      self.hasFullScreen = true;
      self.$container.parent('.h5p-content').css('height', '100%');
      self.controls.$fullscreen.addClass('h5p-exit').attr('title', self.l10n.exitFullscreen);
      self.resizeInteractions();
    });

    // Handle exiting fullscreen
    self.on('exitFullScreen', function () {
      if (self.$container.hasClass('h5p-standalone') && self.$container.hasClass('h5p-minimal')) {
        self.pause();
      }

      self.hasFullScreen = false;
      self.$container.parent('.h5p-content').css('height', '');
      self.controls.$fullscreen.removeClass('h5p-exit').attr('title', self.l10n.fullscreen);
      self.resizeInteractions();

      // Close dialog
      if (self.dnb && self.dnb.dialog) {
        self.dnb.dialog.close();
      }
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
   * Returns the current state of the interactions
   *
   * @returns {Object}
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

    $container.addClass('h5p-interactive-video').html('<div class="h5p-video-wrapper"></div><div class="h5p-controls"></div>');

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

    // Controls
    this.$controls = $container.children('.h5p-controls').hide();

    if (this.editor === undefined) {
      this.dnb = new DragNBar([], this.$videoWrapper, this.$container, {disableEditor: true});
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
          '<div class="h5p-splash" role="button" tabindex="1" title="' + this.l10n.play + '">' +
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
      // 32 = Space
      if (code === 32) {
        that.video.play();
        e.preventDefault();
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
    // Display splash screen
    this.addSplash();

    this.attachControls(this.$controls.show());

    var duration = this.video.getDuration();
    var time = InteractiveVideo.humanizeTime(duration);
    this.controls.$totalTime.html(time);
    this.controls.$slider.slider('option', 'max', duration);

    // Set correct margins for timeline
    this.controls.$slider.parent().css({
      marginLeft: this.$controls.children('.h5p-controls-left').width(),
      marginRight: this.$controls.children('.h5p-controls-right').width()
    });
    this.controls.$currentTime.html(InteractiveVideo.humanizeTime(0));

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
    var that = this;

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
        findField('seekTo', adaptivityFields[i].fields).max = duration;
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
   * @returns {Interaction}
   */
  InteractiveVideo.prototype.initInteraction = function (index) {
    var self = this;
    var parameters = self.options.assets.interactions[index];

    if (self.override) {
      // Extend interaction parameters
      H5P.jQuery.extend(parameters.action.params.behaviour, self.override);
    }

    var previousState;
    if (self.previousState !== undefined && self.previousState.answers !== undefined && self.previousState.answers[index] !== null) {
      previousState = self.previousState.answers[index];
    }

    var interaction = new Interaction(parameters, self, previousState);
    interaction.on('display', function (event) {
      var $interaction = event.data;
      $interaction.appendTo(self.$overlay);

      // Make sure the interaction does not overflow videowrapper.
      interaction.repositionToWrapper(self.$videoWrapper);

      // Determine source type
      var isYouTube = (self.video.pressToPlay !== undefined);

      // Consider pausing the playback
      delayWork(isYouTube ? 100 : null, function () {
        if (self.currentState === H5P.Video.PLAYING && interaction.pause()) {
          self.video.pause();
        }
      });

      // Position label on next tick
      setTimeout(function () {
        interaction.positionLabel(self.$videoWrapper.width());
      }, 0);
    });
    interaction.on('xAPI', function(event) {
      if ($.inArray(event.getVerb(), ['completed', 'answered']) !== -1) {
        event.setVerb('answered');
        if (interaction.isMainSummary()) {
          self.complete();
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
  InteractiveVideo.prototype.hasMainSummary = function() {
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
    for (var i = 0; i < this.interactions.length; i++) {
      this.interactions[i].addDot(this.controls.$interactionsContainer);
    }
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
   * @param  {boolean}               show
   */
  InteractiveVideo.prototype.toggleBookmarksChooser = function (show) {
    if (this.controls.$bookmarks) {
      show = (show === undefined ? !this.controls.$bookmarksChooser.hasClass('h5p-show') : show);
      var hiding = this.controls.$bookmarksChooser.hasClass('h5p-show');

      this.controls.$more.toggleClass('h5p-active', show);
      this.controls.$minimalOverlay.toggleClass('h5p-show', show);
      this.controls.$minimalOverlay.find('.h5p-minimal-button').toggleClass('h5p-hide', show);
      this.controls.$bookmarks.toggleClass('h5p-active', show);
      this.controls.$bookmarksChooser.css({maxHeight: show ? this.controlsCss.maxHeight : '32px'}).toggleClass('h5p-show', show);

      // Add classes if changing visibility
      this.controls.$bookmarksChooser.toggleClass('h5p-transitioning', show || hiding);
    }
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
      self.controls.$bookmarksList = $('<ol></ol>')
        .insertAfter(self.controls.$bookmarksChooser.find('h3'));
    }

    // Create list element for bookmark
    var $li = $('<li role="button" tabindex="1">' + bookmark.label + '</li>')
      .click(function () {
        if (self.currentState !== H5P.Video.PLAYING) {
          $bookmark.mouseover().mouseout();
          setTimeout(function () {self.timeUpdate(self.video.getCurrentTime());}, 0);
        }

        if (self.controls.$more.hasClass('h5p-active')) {
          self.controls.$more.click();
        }
        else {
          self.toggleBookmarksChooser(false);
        }
        self.video.play();
        self.video.seek(bookmark.time);
      });

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
    var $right = $('<div/>', {'class': 'h5p-controls-right', appendTo: $wrapper});
    var $slider = $('<div/>', {'class': 'h5p-control h5p-slider', appendTo: $wrapper});
    if (self.preventSkipping) {
      $slider.addClass('disabled');
    }

    // Keep track of all controls
    self.controls = {};

    // Add play button/pause button
    self.controls.$play = self.createButton('play', 'h5p-control h5p-pause', $left, function () {
      if (self.controls.$play.hasClass('h5p-pause')) {

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
     * Wraps a specifc handler to do some generic operations each time the handler is triggered.
     *
     * @private
     * @param {function} action
     */
    var createPopupMenuHandler = function (button, menu) {
      return function () {
        var $button = self.controls[button];
        if ($button.hasClass('h5p-disabled')) {
          return; // Not active
        }

        var $menu = self.controls[menu];
        if (!$button.hasClass('h5p-active')) {
          // Opening
          $button.addClass('h5p-active');
          $menu.addClass('h5p-show');
        }
        else {
          // Closing
          $button.removeClass('h5p-active');
          $menu.removeClass('h5p-show');
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
        html: '<h3>' + self.l10n.bookmarks + '</h3>',
        appendTo: self.$container
      });

      // Adding close button to bookmarks-menu
      self.controls.$bookmarksChooser.append($('<span>', {
        'class': 'h5p-chooser-close-button',
        click: function () {
          self.toggleBookmarksChooser();
        }
      }));

      if (self.showRewind10) {
        self.controls.$bookmarksChooser.addClass('h5p-rewind-displacement');
      }

      // Button for opening bookmark popup
      self.controls.$bookmarks = self.createButton('bookmarks', 'h5p-control', $left, function () {
        self.toggleBookmarksChooser();
      });
      self.controls.$bookmarksChooser.bind('transitionend', function () {
        self.controls.$bookmarksChooser.removeClass('h5p-transitioning');
      })
    }

    // Current time for minimal display
    var $time = $('<div class="h5p-control h5p-simple-time"><span class="h5p-current">0:00</span></div>').appendTo($left);
    self.controls.$currentTime = $time.find('.h5p-current');

    // Add fullscreen button
    if (!self.editor && H5P.canHasFullScreen !== false) {
      self.controls.$fullscreen = self.createButton('fullscreen', 'h5p-control', $right, function () {
        self.toggleFullScreen();
      });
    }

    // TODO: Do not add until qualities are present?
    // Add popup for selecting video quality
    self.controls.$qualityChooser = H5P.jQuery('<div/>', {
      'class': 'h5p-chooser h5p-quality',
      html: '<h3>' + self.l10n.quality + '</h3>',
      appendTo: self.$container
    });

    // Adding close button to quality-menu
    self.controls.$qualityChooser.append($('<span>', {
      'class': 'h5p-chooser-close-button',
      click: function () {
        if (self.isMinimal) {
          self.controls.$more.click();
        }
        else {
          self.controls.$qualityButton.click();
        }
      }
    }));

    // Button for opening video quality selection dialog
    self.controls.$qualityButton = self.createButton('quality', 'h5p-control h5p-disabled', $right, createPopupMenuHandler('$qualityButton', '$qualityChooser'));

    // Add volume button control (toggle mute)
    if (!isAndroid() && !isIpad()) {
      self.controls.$volume = self.createButton('mute', 'h5p-control', $right, function () {
        if (self.controls.$volume.hasClass('h5p-muted')) {
          self.controls.$volume.removeClass('h5p-muted').attr('title', self.l10n.mute);
          self.video.unMute();
        }
        else {
          self.controls.$volume.addClass('h5p-muted').attr('title', self.l10n.unmute);
          self.video.mute();
        }
      });
    }

    // Add popup for selecting playback rate
    self.controls.$playbackRateChooser = H5P.jQuery('<div/>', {
      'class': 'h5p-chooser h5p-playbackRate',
      html: '<h3>' + self.l10n.playbackRate + '</h3>',
      appendTo: self.$container
    });

    // Button for opening video playback rate selection dialog
    self.controls.$playbackRateButton = self.createButton('playbackRate', 'h5p-control h5p-disabled', $right, createPopupMenuHandler('$playbackRateButton', '$playbackRateChooser'));

    // Add more button for collapsing controls when there's little space

    // Add overlay for display controls inside
    self.controls.$minimalOverlay = H5P.jQuery('<div/>', {
      'class': 'h5p-minimal-overlay',
      appendTo: self.$container
    });

    // Use wrapper to center controls
    var $minimalWrap = H5P.jQuery('<div/>', {
      'class': 'h5p-minimal-wrap',
      appendTo: self.controls.$minimalOverlay
    });

    // Add buttons to wrapper
    var $buttons = H5P.jQuery([]);

    // Bookmarks
    if (bookmarksEnabled) {
      $buttons = $buttons.add(self.createButton('bookmarks', 'h5p-minimal-button', $minimalWrap, function () {
        $buttons.addClass('h5p-hide');
        self.toggleBookmarksChooser(true);
      }, true));
    }

    // Quality
    self.controls.$qualityButtonMinimal = self.createButton('quality', 'h5p-minimal-button h5p-disabled', $minimalWrap, function () {
      if (!self.controls.$qualityButton.hasClass('h5p-disabled')) {
        $buttons.addClass('h5p-hide');
        self.controls.$qualityButton.click();
      }
    }, true);
    $buttons = $buttons.add(self.controls.$qualityButtonMinimal);

    // Playback rate
    self.controls.$playbackRateButtonMinimal = self.createButton('playbackRate', 'h5p-minimal-button h5p-disabled', $minimalWrap, function () {
      if (!self.controls.$playbackRateButton.hasClass('h5p-disabled')) {
        $buttons.addClass('h5p-hide');
        self.controls.$playbackRateButton.click();
      }
    }, true);
    $buttons = $buttons.add(self.controls.$playbackRateButtonMinimal);

    // Add control for displaying overlay with buttons
    self.controls.$more = self.createButton('more', 'h5p-control', $right, function () {
      if  (self.controls.$more.hasClass('h5p-active')) {
        // Close overlay
        self.controls.$minimalOverlay.removeClass('h5p-show');
        self.controls.$more.removeClass('h5p-active');
        self.toggleBookmarksChooser(false);
        if (self.controls.$qualityButton && self.controls.$qualityButton.hasClass('h5p-active')) {
          self.controls.$qualityButton.click();
        }
        if (self.controls.$playbackRateButton && self.controls.$playbackRateButton.hasClass('h5p-active')) {
          self.controls.$playbackRateButton.click();
        }
        setTimeout(function () {
          $buttons.removeClass('h5p-hide');
        }, 150);
      }
      else {
        // Open overlay
        self.controls.$minimalOverlay.addClass('h5p-show');
        self.controls.$more.addClass('h5p-active');

        // Make sure splash screen is removed.
        self.removeSplash();
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

    self.addQualityChooser();
    self.addPlaybackRateChooser();

    // Add display for time elapsed and duration
    $time = $('<div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div>').appendTo($right);
    self.controls.$currentTime = self.controls.$currentTime.add($time.find('.h5p-current'));
    self.controls.$totalTime = $time.find('.h5p-total');

    // Add containers for objects that will be displayed around the seekbar
    self.controls.$interactionsContainer = $('<div/>', {'class': 'h5p-interactions-container', appendTo: $slider});
    self.controls.$bookmarksContainer = $('<div/>', {'class': 'h5p-bookmarks-container', appendTo: $slider});

    // Add seekbar/timeline
    self.hasPlayPromise = false;
    self.hasQueuedPause = false;
    self.delayed = false;
    self.delayTimeout;
    self.controls.$slider = $('<div/>', {appendTo: $slider}).slider({
      value: 0,
      step: 0.01,
      orientation: 'horizontal',
      range: 'min',
      max: 0,
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
      },
      slide: function (e, ui) {
        // Update elapsed time
        self.video.seek(ui.value);
        self.updateInteractions(ui.value);
        self.controls.$currentTime.html(InteractiveVideo.humanizeTime(ui.value));
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
              self.video.pause();
            }
          }
        }
        else {
          self.timeUpdate(ui.value);
        }
      }
    });

    // Disable slider
    if (self.preventSkipping) {
      self.controls.$slider.slider('disable');
      self.controls.$slider.click(function () {
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
        keypress: function () {
          if (event.which === 32) { // Space
            handler.call(this);
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

    if (!this.video.getQualities) {
      return;
    }

    var qualities = this.video.getQualities();
    if (!qualities || this.controls.$qualityButton === undefined ||
        !this.controls.$qualityButton.hasClass('h5p-disabled')) {
      return;
    }

    var currentQuality = this.video.getQuality();

    var html = '';
    for (var i = 0; i < qualities.length; i++) {
      var quality = qualities[i];
      html += '<li role="button" tabIndex="1" data-quality="' + quality.name + '" class="' + (quality.name === currentQuality ? 'h5p-selected' : '') + '">' + quality.label + '</li>';
    }

    var $list = $('<ol>' + html + '</ol>').appendTo(this.controls.$qualityChooser);
    var $options = $list.children().click(function () {
      self.video.setQuality($(this).attr('data-quality'));
      if (self.controls.$more.hasClass('h5p-active')) {
        self.controls.$more.click();
      }
      else {
        self.controls.$qualityButton.click();
      }
    });

    // Enable quality chooser button
    this.controls.$qualityButton.add(this.controls.$qualityButtonMinimal).removeClass('h5p-disabled');
  };

  /**
   * Add a dialog for selecting video playback rate.
   */
  InteractiveVideo.prototype.addPlaybackRateChooser = function () {
    var self = this;

    if (!this.video.getPlaybackRates) {
      return;
    }

    /*
     * The IE 11 for no reason jumps to a playback rate of 1 if the slider is
     * moved or if you pause and restart the video. Until a workaround has been
     * found, the playback rate chooser is deactivated for the IE 11.
     */
    var isIE11 = navigator.userAgent.match(/Trident.*rv[ :]*11\./) ? true : false;
    if (isIE11) {
      return;
    }

    var playbackRates = this.video.getPlaybackRates();

    // don't enable playback rate chooser if only default rate can be chosen
    if (playbackRates.length < 2) {
      return;
    }

    if (!playbackRates || this.controls.$playbackRateButton === undefined ||
        !this.controls.$playbackRateButton.hasClass('h5p-disabled')) {
      return;
    }

    var currentPlaybackRate = this.video.getPlaybackRate();

    var html = '';
    for (var i = 0; i < playbackRates.length; i++) {
      var playbackRate = playbackRates[i];
      html += '<li role="button" tabIndex="1" playback-rate="' + playbackRate + '" class="' + (playbackRate === currentPlaybackRate ? 'h5p-selected' : '') + '">' + playbackRate + '</li>';
    }

    var $list = $('<ol>' + html + '</ol>').appendTo(this.controls.$playbackRateChooser);
    var $options = $list.children().click(function () {
      self.video.setPlaybackRate($(this).attr('playback-rate'));
      if (self.controls.$more.hasClass('h5p-active')) {
        self.controls.$more.click();
      }
      else {
        self.controls.$playbackRateButton.click();
      }
    });

    // Enable playback rate chooser button
    this.controls.$playbackRateButton.add(this.controls.$playbackRateButtonMinimal).removeClass('h5p-disabled');
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

    // Resize the controls the first time we're visible
    if (!this.justVideo && this.controlsSized === undefined) {
      this.resizeControls();
    }

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
          this.resizeControls();
        }
      }
      else if (this.$container.hasClass('h5p-minimal')) {
        // Use normal controls
        this.$container.removeClass('h5p-minimal');
        this.resizeControls();
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
   * Make sure that the jQuery UI scrollbar fits between the controls
   */
  InteractiveVideo.prototype.resizeControls = function () {
    var left = this.$controls.children('.h5p-controls-left').width();
    var right = this.$controls.children('.h5p-controls-right').width();
    if (left || right) {
      this.controlsSized = true;

      // Set correct margins for timeline
      this.controls.$slider.parent().css({
        marginLeft: left,
        marginRight: right
      });
    }
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
        this.dnb.dialog.closeOverlay();
        this.recreateCurrentInteractions();
      }
    }
    else {
      if (this.isMobileView) {
        // Close dialog because we can not know if it will turn into a poster
        if (this.dnb && this.dnb.dialog) {
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
        self.controls.$slider.slider('option', 'value', time);
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
        self.controls.$currentTime.html(InteractiveVideo.humanizeTime(second < 0 ? 0 : second));
      }
    }
    self.lastSecond = second;
  };

  /**
   * Call xAPI completed only once
   *
   * @public
   */
  InteractiveVideo.prototype.complete = function() {
    // Skip for editor
    if (this.editor) {
      return;
    }

    if (!this.isCompleted) {
      // Post user score. Max score is based on how many of the questions the user
      // actually answered
      this.triggerXAPIScored(this.getUsersScore(), this.getUsersMaxScore(), 'completed');
    }
    this.isCompleted = true;
  };

  /**
   * Gets the users score
   * @returns {number}
   */
  InteractiveVideo.prototype.getUsersScore = function() {
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
  InteractiveVideo.prototype.getUsersMaxScore = function() {
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
  InteractiveVideo.prototype.getScore = function() {
    return this.getUsersScore();
  };

  /**
   * Implements getMaxScore from the question type contract
   * @returns {number}
   */
  InteractiveVideo.prototype.getMaxScore = function() {
    return this.getUsersMaxScore();
  };

  /**
   * Implements showSolutions from the question type contract
   */
  InteractiveVideo.prototype.showSolutions = function() {
    // Intentionally left empty. Function makes IV pop up in CP summary
  };

  /**
   * Implements getTitle from the question type contract
   * @returns {string}
   */
  InteractiveVideo.prototype.getTitle = function() {
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
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);

    minutes = minutes % 60;
    seconds = Math.floor(seconds % 60);

    var time = '';

    if (hours !== 0) {
      time += hours + ':';

      if (minutes < 10) {
        time += '0';
      }
    }

    time += minutes + ':';

    if (seconds < 10) {
      time += '0';
    }

    time += seconds;

    return time;
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
  var delayWork = function (time, job) {
    if (time === null) {
      job();
    }
    else {
      setTimeout(job, time);
    }
  };

  return InteractiveVideo;
})(H5P.jQuery, H5P.EventDispatcher, H5P.DragNBar, H5P.InteractiveVideoInteraction);
