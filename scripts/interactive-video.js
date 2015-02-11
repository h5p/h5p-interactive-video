/** @namespace H5P */
H5P.InteractiveVideo = (function ($, EventDispatcher, Dialog, Interaction) {

  /**
   * Initialize a new interactive video.
   *
   * @param {Array} params
   * @param {int} id
   * @returns {_L2.C}
   */
  function InteractiveVideo(params, id) {
    H5P.EventDispatcher.call(this);
    var self = this;
    self.$ = $(self);
    this.params = $.extend({
      video: {},
      assets: {}
    }, params.interactiveVideo);
    this.contentId = id;
    this.visibleInteractions = [];

    this.l10n = {
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
      defaultAdaptivitySeekLabel: 'Continue'
    };

    this.justVideo = navigator.userAgent.match(/iPhone|iPod/i) ? true : false;
    this.isCompleted = false;

    this.video = H5P.newRunnable({
      library: 'H5P.Video 1.1',
      params: {
        sources: this.params.video.files,
        controls: this.justVideo,
        fit: false
      }
    }, this.contentId);

    this.video.on('error', function (event) {
      // Make sure splash screen is removed so the error is visible.
      self.removeSplash();
    });

    var firstPlay = true;
    this.video.on('stateChange', function (event) {
      var state = event.data
      if (self.currentState === SEEKING) {
        return; // Prevent updateing UI while seeking
      }

      switch (state) {
        case H5P.Video.ENDED:
          self.currentState = ENDED;
          self.controls.$play.addClass('h5p-pause').attr('title', self.l10n.play);

          // Post user score
          if (self.postUserStatistics === true) {
            H5P.setFinished(self.contentId, 0, 0);
          }
          break;

        case H5P.Video.PLAYING:
          if (firstPlay) {
            firstPlay = false;

            // Qualities might not be available until after play.
            self.addQualityChooser();

            // Make sure splash screen is removed.
            self.removeSplash();

            // Make sure we track buffering of the video.
            self.startUpdatingBufferBar();
          }

          self.currentState = PLAYING;
          self.controls.$play.removeClass('h5p-pause').attr('title', self.l10n.pause);
          self.timeUpdate(self.video.getCurrentTime());
          break;

        case H5P.Video.PAUSED:
          self.currentState = PAUSED;
          self.controls.$play.addClass('h5p-pause').attr('title', self.l10n.play);
          break;

        case H5P.Video.BUFFERING:
          self.currentState = BUFFERING;

          // Make sure splash screen is removed.
          self.removeSplash();

          // Make sure we track buffering of the video.
          self.startUpdatingBufferBar();

          // Remove interactions while buffering
          self.timeUpdate(-1);
          break;
      }
    });

    this.video.on('qualityChange', function (event) {
      var quality = event.data;
      if (self.controls.$qualityChooser) {
        self.controls.$qualityChooser.find('li').removeClass('h5p-selected').filter('[data-quality="' + quality + '"]').addClass('h5p-selected');
      }
    });

    this.video.on('loaded', function (event) {
      self.loaded();
    });
  }
  
  InteractiveVideo.prototype = Object.create(H5P.EventDispatcher.prototype);
  InteractiveVideo.prototype.constructor = InteractiveVideo;

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
   * @param {jQuery} $container
   * @returns {undefined}
   */
  InteractiveVideo.prototype.attach = function ($container) {
    var that = this;
    this.$container = $container;

    $container.addClass('h5p-interactive-video').html('<div class="h5p-video-wrapper"></div><div class="h5p-controls"></div>');

    // Font size is now hardcoded, since some browsers (At least Android
    // native browser) will have scaled down the original CSS font size by the
    // time this is run. (It turned out to have become 13px) Hard coding it
    // makes it be consistent with the intended size set in CSS.
    // TODO: For this to be used inside something else, we cannot assume that the font size will be 16.
    this.fontSize = 16;
    this.width = 640; // parseInt($container.css('width')); // Get width in px

    // Video with interactions
    this.$videoWrapper = $container.children('.h5p-video-wrapper');
    this.attachVideo(this.$videoWrapper);

    if (this.justVideo) {
      this.$videoWrapper.find('video').css('minHeight', '200px');
      $container.children(':not(.h5p-video-wrapper)').remove();
      return;
    }

    // Controls
    this.$controls = $container.children('.h5p-controls');
    this.attachControls(this.$controls);

    // Create a popup dialog
    this.dialog = new Dialog($container, this.$videoWrapper);

    if (this.editor === undefined) {
      // Pause video when opening dialog
      this.dialog.on('open', function () {
        // Keep track of last state
        that.lastState = that.currentState;

        if (that.currentState !== PAUSED && that.currentState !== ENDED) {
          // Pause video
          that.video.pause();
        }
      });
    }
    else {
      this.dialog.disableOverlay = true;
    }

    // Resume playing when closing dialog
    this.dialog.on('close', function () {
      if (that.lastState !== PAUSED && that.lastState !== ENDED) {
        that.video.play();
      }
    });
  };

  /**
   * Attach the video to the given wrapper.
   *
   * @param {jQuery} $wrapper
   */
  InteractiveVideo.prototype.attachVideo = function ($wrapper) {
    var that = this;

    this.video.attach($wrapper);
    if (this.justVideo) {
      return;
    }

    this.$overlay = $('<div class="h5p-overlay h5p-ie-transparent-background"></div>').appendTo($wrapper);

    if (this.editor === undefined) {
      this.$splash = $('<div class="h5p-splash-wrapper"><div class="h5p-splash"><h2>Interactive Video</h2><p>Press the icons as the video plays for challenges and more information on the topics!</p><div class="h5p-interaction h5p-multichoice-interaction"><a href="#" class="h5p-interaction-button"></a><div class="h5p-interaction-label">Challenges</div></div><div class="h5p-interaction h5p-text-interaction"><a href="#" class="h5p-interaction-button"></a><div class="h5p-interaction-label">More information</div></div></div></div>')
        .click(function () {
          that.video.play();
        })
        .appendTo(this.$overlay)
        .find('.h5p-interaction-button')
          .click(function () {
            return false;
          })
          .end();
    }
  };

  /**
   * Unbind event listeners.
   *
   * @returns {undefined}
   */
  InteractiveVideo.prototype.loaded = function () {
    var that = this;

    var duration = this.video.getDuration();
    var time = humanizeTime(duration);
    this.controls.$totalTime.html(time);
    this.controls.$slider.slider('option', 'max', duration);

    // Set correct margins for timeline
    this.controls.$slider.parent().css({
      marginLeft: this.$controls.children('.h5p-controls-left').width(),
      marginRight: this.$controls.children('.h5p-controls-right').width()
    });
    this.controls.$currentTime.html(humanizeTime(0));

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
      var displayAt = duration - this.params.summary.displayAt;
      if (displayAt < 0) {
        displayAt = 0;
      }

      this.params.assets.interactions.push({
        action: this.params.summary.task,
        x: 80,
        y: 80,
        duration: {
          from: displayAt,
          to: duration
        },
        bigDialog: true,
        className: 'h5p-summary-interaction h5p-end-summary',
        label: this.l10n.summary,
        mainSummary: true
      });
    }

    // Determine how many percentage one second is.
    this.oneSecondInPercentage = (100 / this.video.getDuration());

    // Initialize interactions
    this.interactions = [];
    for (var i = 0; i < this.params.assets.interactions.length; i++) {
      this.initInteraction(i);
    }

    // Add dots above seeking line.
    this.addSliderInteractions();

    // Add bookmarks
    this.addBookmarks();
    //this.createInteractionsArray();
    this.trigger('resize');
  };
  
  InteractiveVideo.prototype.createInteractionsArray = function() {
    this.interactions = [];
    for (var i in this.params.assets.interactions) {
      this.interactions.push({
        score: null,
        maxScore: null
        // instances will probably be added to this object later
      });
    }
  };

  /**
   * Initialize interaction at the given index.
   *
   * @public
   * @param {Number} index
   * @returns {Interaction}
   */
  InteractiveVideo.prototype.initInteraction = function (index) {
    var self = this;
    var parameters = this.params.assets.interactions[index];

    if (self.params.override && self.params.override.overrideButtons) {
      // Extend interaction parameters
      H5P.jQuery.extend(parameters.action.params.behaviour, {
        enableSolutionsButton: self.params.override.overrideShowSolutionButton ? true : false,
        enableRetry: self.params.override.overrideRetry ? true : false
      });
    }

    var interaction = new Interaction(parameters, self);
    interaction.on('display', function (event) {
      var $interaction = event.data;
      $interaction.appendTo(self.$overlay);

      if (self.currentState === PLAYING && interaction.pause()) {
        self.video.pause();
      }

      setTimeout(function () {
        interaction.positionLabel(self.$videoWrapper.width());
      }, 0);
    });

    this.interactions.push(interaction);

    if (this.editor !== undefined) {
      this.editor.processInteraction(interaction, parameters);
    }

    return interaction;
  };

  /**
   * Does the interactive video have a main summary?
   *
   * This is the summary created in the summary tab of the editor
   *
   * @returns {Boolean}
   *   true if this interactive video has a summary
   *   false otherwise
   */
  InteractiveVideo.prototype.hasMainSummary = function() {
    var summary = this.params.summary;
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
    if (this.params.assets.bookmarks !== undefined) {
      for (var i = 0; i < this.params.assets.bookmarks.length; i++) {
        this.addBookmark(i);
      }
    }
  };

  /**
   * Puts a single cool narrow line around the slider / seek bar.
   */
  InteractiveVideo.prototype.addBookmark = function (id, tenth) {
    var self = this;
    var bookmark = self.params.assets.bookmarks[id];

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
        if (self.playing === undefined || self.playing === false) {
          $bookmark.mouseover().mouseout();
        }
        self.controls.$bookmarksChooser.removeClass('h5p-show');
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
        self.off('bookmarksChanged', this);
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
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  InteractiveVideo.prototype.attachControls = function ($wrapper) {
    var that = this;

    $wrapper.html('<div class="h5p-controls-left"><a href="#" class="h5p-control h5p-play h5p-pause" title="' + that.l10n.play + '"></a><a href="#" class="h5p-control h5p-bookmarks" title="' + that.l10n.bookmarks + '"></a><div class="h5p-chooser h5p-bookmarks"><h3>' + that.l10n.bookmarks + '</h3></div></div><div class="h5p-controls-right"><a href="#" class="h5p-control h5p-fullscreen"  title="' + that.l10n.fullscreen + '"></a><a href="#" class="h5p-control h5p-quality h5p-disabled"  title="' + that.l10n.quality + '"></a><div class="h5p-chooser h5p-quality"><h3>' + that.l10n.quality + '</h3></div><a href="#" class="h5p-control h5p-volume"  title="' + that.l10n.mute + '"></a><div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div></div><div class="h5p-control h5p-slider"><div class="h5p-interactions-container"></div><div class="h5p-bookmarks-container"></div><div></div></div>');
    this.controls = {};

    // Play/pause button
    this.controls.$play = $wrapper.find('.h5p-play').click(function () {
      if (that.controls.$play.hasClass('h5p-pause')) {
        that.video.play();
      }
      else {
        that.video.pause();
      }
      return false;
    });

    // Bookmark selector
    if ((this.params.assets.bookmarks === undefined || this.params.assets.bookmarks.length === 0) && this.editor === undefined) {
      // No bookmarks and no editor, remove button.
      $wrapper.find('.h5p-control.h5p-bookmarks').remove();
    }
    else {
      this.controls.$bookmarksChooser = $wrapper.find('.h5p-chooser.h5p-bookmarks');
      $wrapper.find('.h5p-control.h5p-bookmarks').click(function () {
        // TODO: Mark chooser buttons as active when open. (missing design)
        that.controls.$bookmarksChooser.toggleClass('h5p-show');
        return false;
      });
    }

    if (this.editor === undefined) {
      // Fullscreen button
      this.controls.$fullscreen = $wrapper.find('.h5p-fullscreen').click(function () {
        that.toggleFullScreen();
        return false;
      });

      // Video quality selector
      this.controls.$qualityChooser = $wrapper.find('.h5p-chooser.h5p-quality');
      this.controls.$qualityButton = $wrapper.find('.h5p-control.h5p-quality').click(function () {
        if (!that.controls.$qualityButton.hasClass('h5p-disabled')) {
          that.controls.$qualityChooser.toggleClass('h5p-show');
        }
        return false;
      });

      this.addQualityChooser();
    }
    else {
      // Remove buttons in editor mode.
      $wrapper.find('.h5p-fullscreen').remove();
      $wrapper.find('.h5p-quality, .h5p-quality-chooser').remove();
    }

    // Volume/mute button
    if (navigator.userAgent.indexOf('Android') === -1 && navigator.userAgent.indexOf('iPad') === -1) {
      this.controls.$volume = $wrapper.find('.h5p-volume').click(function () {
        if (that.controls.$volume.hasClass('h5p-muted')) {
          that.controls.$volume.removeClass('h5p-muted').attr('title', that.l10n.mute);
          that.video.unMute();
        }
        else {
          that.controls.$volume.addClass('h5p-muted').attr('title', that.l10n.unmute);
          that.video.mute();
        }
        return false;
      });
    }
    else {
      $wrapper.find('.h5p-volume').remove();
    }

    // Timer
    var $time = $wrapper.find('.h5p-time');
    this.controls.$currentTime = $time.children('.h5p-current');
    this.controls.$totalTime = $time.children('.h5p-total');

    // Timeline
    var $slider = $wrapper.find('.h5p-slider');
    this.controls.$slider = $slider.children(':last').slider({
      value: 0,
      step: 0.01,
      orientation: 'horizontal',
			range: 'min',
      max: 0,
      start: function () {
        if (that.currentState === SEEKING) {
          return; // Prevent double start on touch devies!
        }

        that.lastState = (that.currentState === ENDED ? PLAYING : that.currentState);
        that.video.pause();
        that.currentState = SEEKING;

        // Make sure splash screen is removed.
        that.removeSplash();
      },
      slide: function (e, ui) {
        // Update elapsed time
        that.controls.$currentTime.html(humanizeTime(ui.value));
      },
      stop: function (e, ui) {
        that.currentState = that.lastState;
        that.video.seek(ui.value);
        if (that.lastState === PLAYING) {
          that.video.play();
        }
        else {
          that.timeUpdate(ui.value);
        }
      }
    });

    // Slider bufferer
    this.controls.$buffered = $('<div class="h5p-buffered"></div>').prependTo(this.controls.$slider);

    // Slider containers
    this.controls.$interactionsContainer = $slider.find('.h5p-interactions-container');
    this.controls.$bookmarksContainer = $slider.find('.h5p-bookmarks-container');
  };

  /**
   *
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
      self.controls.$qualityChooser.removeClass('h5p-show');
    });

    // Enable quality chooser button
    this.controls.$qualityButton.removeClass('h5p-disabled');
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
   *
   * @param {Boolean} fullScreen
   * @returns {undefined}
   */
  InteractiveVideo.prototype.resize = function () {
    var fullscreenOn = this.$container.hasClass('h5p-fullscreen') || this.$container.hasClass('h5p-semi-fullscreen');

    // Resize the controls the first time we're visible
    if (this.controlsSized === undefined) {
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
    }

    this.$videoWrapper.css({
      marginTop: '',
      marginLeft: '',
      width: '',
      height: ''
    });
    this.video.trigger('resize');

    var width;
    var controlsHeight = this.$controls.height();
    var containerHeight = this.$container.height();
    if (fullscreenOn) {
      var videoHeight = this.$videoWrapper.height();

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
      if (this.controls.$fullscreen !== undefined && this.controls.$fullscreen.hasClass('h5p-exit')) {
        // Update icon if we some how got out of fullscreen.
        this.controls.$fullscreen.removeClass('h5p-exit').attr('title', this.l10n.fullscreen);
      }
      width = this.$container.width();
    }

    // Set base font size. Don't allow it to fall below original size.
    this.$container.css('fontSize', (width > this.width) ? (this.fontSize * (width / this.width)) : this.fontSize + 'px');

    this.$container.find('.h5p-chooser').css('maxHeight', (containerHeight - controlsHeight) + 'px');
  };

  /**
   * Enter/exit fullscreen.
   *
   * @returns {undefined}
   */
  InteractiveVideo.prototype.toggleFullScreen = function () {
    if (this.controls.$fullscreen.hasClass('h5p-exit')) {
      this.controls.$fullscreen.removeClass('h5p-exit').attr('title', this.l10n.fullscreen);
      if (H5P.fullScreenBrowserPrefix === undefined) {
        // Click button to disable fullscreen
        $('.h5p-disable-fullscreen').click();
      }
      else {
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
    }
    else {
      this.controls.$fullscreen.addClass('h5p-exit').attr('title', this.l10n.exitFullscreen);
      H5P.fullScreen(this.$container, this);
      if (H5P.fullScreenBrowserPrefix === undefined) {
        // Hide disable full screen button. We have our own!
        $('.h5p-disable-fullscreen').hide();
      }
    }
  };

  /**
   * Called when the time of the video changes.
   * Makes sure to update all UI elements.
   *
   * @param {Number} time
   */
  InteractiveVideo.prototype.timeUpdate = function (time) {
    var self = this;

    // Scroll slider
    if (time > 0) {
      self.controls.$slider.slider('option', 'value', time);
    }

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
      // TODO: Is it possible to move interactions to tenth of a second instead?
      // This would greatly improve precision of the interactions and UX. (now it feels a bit limited)
      self.toggleInteractions(second);

      if (self.editor !== undefined) {
        self.editor.dnb.blur();
      }
      if (self.currentState === PLAYING) {
        // Update elapsed time
        self.controls.$currentTime.html(humanizeTime(second));
      }
    }
    self.lastSecond = second;

    setTimeout(function () {
      if (self.currentState === PLAYING) {
        self.timeUpdate(self.video.getCurrentTime());
      }
    }, 40); // 25 fps
  };

  /**
   * Interactive video has ended.
   */
  InteractiveVideo.prototype.ended = function () {
    this.controls.$play.addClass('h5p-pause').attr('title', this.l10n.play);
    this.playing = false;
    this.hasEnded = true;

    this.video.pause();
    clearInterval(this.uiUpdater);
    this.complete();
  };
  
  InteractiveVideo.prototype.complete = function() {
    if (!this.isCompleted) {
      // Post user score. Max score is based on how many of the questions the user
      // actually answered
      this.triggerXAPICompleted(this.getUsersScore(), this.getUsersMaxScore());
    }
    this.isCompleted = true;
  }

  InteractiveVideo.prototype.getUsersScore = function() {
    var score = 0;
    for (var i = 0; i < this.interactions.length; i++) {
      if (this.interactions[i].score) {
        score += this.interactions[i].score;
      }
    }
    return score;
  };
  
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
   * Display and remove interactions for the given second.
   *
   * @param {int} second
   */
  InteractiveVideo.prototype.toggleInteractions = function (second) {
    for (var i = 0; i < this.interactions.length; i++) {
      this.interactions[i].toggle(second);
    }
  };

  /**
   * Start interactive video playback.
   *
   * @public
   */
  InteractiveVideo.prototype.play = function () {
    this.video.play();
  };

  /**
   * Seek interactive video to the given time
   *
   * @public
   * @param {Number} time
   */
  InteractiveVideo.prototype.seek = function (time) {
    this.video.seek(time);
  };

  /**
   * Pause interactive video playback.
   *
   * @public
   */
  InteractiveVideo.prototype.pause = function () {
    this.video.pause();
  };

  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyrights}
   */
  InteractiveVideo.prototype.getCopyrights = function () {
    var self = this;
    var info = new H5P.ContentCopyrights();

    var videoRights, video = self.params.video.files[0];
    if (video.copyright !== undefined) {
      videoRights = new H5P.MediaCopyright(video.copyright, self.l10n);
    }

    if ((videoRights === undefined || videoRights.undisclosed()) && self.params.video.copyright !== undefined) {
      // Use old copyright info as fallback.
      videoRights = self.params.video.copyright;
    }
    info.addMedia(videoRights);

    for (var i = 0; i < self.interactions.length; i++) {
      var interactionCopyrights = self.interactions[i].getCopyrights();
      if (interactionCopyrights) {
        info.addContent(interactionCopyrights);
      }
    }

    return info;
  };

  /** @constant {number} */
  var ENDED = 0;
  /** @constant {number} */
  var PLAYING = 1;
  /** @constant {number} */
  var PAUSED = 2;
  /** @constant {number} */
  var BUFFERING = 3;
  /** @constant {number} */
  var SEEKING = 4;

  /**
   * Formats time in H:MM:SS.
   *
   * @private
   * @param {float} seconds
   * @returns {string}
   */
  var humanizeTime = function (seconds) {
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
   * Only used by editor. TODO: move
   *
   * @private
   * @param {String} name of field
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

  return InteractiveVideo;
})(H5P.jQuery, H5P.EventDispatcher, H5P.InteractiveVideoDialog, H5P.InteractiveVideoInteraction);
