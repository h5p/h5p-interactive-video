var H5P = H5P || {};

/**
 * Interactive Video module
 *
 * @param {jQuery} $
 */
H5P.InteractiveVideo = (function ($) {

  /**
   * Initialize a new interactive video.
   *
   * @param {Array} params
   * @param {int} id
   * @returns {_L2.C}
   */
  function C(params, id) {
    var self = this;
    self.$ = $(self);

    this.params = $.extend({
      video: {},
      assets: {}
    }, params.interactiveVideo);
    this.contentId = id;
    this.visibleInteractions = [];
    this.postUserStatistics = (H5P.postUserStatistics === true);

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
      bookmarks: 'Bookmarks'
    };

    if (params.override !== undefined) {
      this.overrideButtons = (params.override.overrideButtons === undefined ? false : params.override.overrideButtons);
      this.overrideShowSolutionButton = (params.override.overrideShowSolutionButton === undefined ? false : params.override.overrideShowSolutionButton);
      this.overrideRetry = (params.override.overrideRetry === undefined ? false : params.override.overrideRetry);
    }

    this.justVideo = navigator.userAgent.match(/iPhone|iPod/i) ? true : false;

    this.video = H5P.newRunnable({
      library: 'H5P.Video 1.1',
      params: {
        files: this.params.video.files,
        controls: this.justVideo,
        autoplay: false,
        fitToWrapper: false
      }
    }, this.contentId);

    this.video.on('error', function (message) {
      // Make sure splash screen is removed so the error is visible.
      self.removeSplash();
    });

    var firstPlay = true;
    this.video.on('stateChange', function (state) {
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

    this.video.on('qualityChange', function (quality) {
      self.controls.$qualityChooser.find('li').removeClass('h5p-selected').filter('[data-quality="' + quality + '"]').addClass('h5p-selected');
    });

    this.video.on('loaded', function (state) {
      self.loaded();
    });
  }

  /**
   * Removes splash screen.
   */
  C.prototype.removeSplash = function () {
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
  C.prototype.attach = function ($container) {
    var that = this;
    this.$container = $container;

    $container.addClass('h5p-interactive-video').html('<div class="h5p-video-wrapper"></div><div class="h5p-controls"></div><div class="h5p-dialog-wrapper h5p-ie-transparent-background h5p-hidden"><div class="h5p-dialog"><div class="h5p-dialog-inner"></div><a href="#" class="h5p-dialog-hide">&#xf00d;</a></div></div>');

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

    // Dialog
    this.$dialogWrapper = $container.children('.h5p-dialog-wrapper').click(function () {
      if (that.editor === undefined) {
        that.hideDialog();
      }
    });
    this.$dialog = this.$dialogWrapper.children('.h5p-dialog').click(function (event) {
      event.stopPropagation();
    });
    this.$dialog.children('.h5p-dialog-hide').click(function () {
      that.hideDialog();
      return false;
    });
  };

  /**
   * Attach the video to the given wrapper.
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachVideo = function ($wrapper) {
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
  C.prototype.loaded = function () {
    var that = this;

    var duration = this.video.getDuration();
    var time = C.humanizeTime(duration);
    this.controls.$totalTime.html(time);
    this.controls.$slider.slider('option', 'max', duration);

    // Set correct margins for timeline
    this.controls.$slider.parent().css({
      marginLeft: this.$controls.children('.h5p-controls-left').width(),
      marginRight: this.$controls.children('.h5p-controls-right').width()
    });
    this.controls.$currentTime.html(C.humanizeTime(0));

    duration = Math.floor(duration);

    // Set max/min for editor duration fields
    if (this.editor !== undefined) {
      var durationFields = this.editor.field.fields[0].field.fields[0].fields;
      durationFields[0].max = durationFields[1].max = duration;
      durationFields[0].min = durationFields[1].min = 0;
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
        label: this.l10n.summary
      });
    }

    //Extend subcontent with overrided button settings.
    if (this.overrideButtons) {
      that.params.assets.interactions.forEach( function (subcontent) {
        //Extend subcontent parameters
        H5P.jQuery.extend(subcontent.action.params.behaviour, {
          enableSolutionsButton: that.overrideShowSolutionButton,
          enableRetry: that.overrideRetry
        });
      });
    }

    this.oneSecondInPercentage = (100 / this.video.getDuration());
    this.addSliderInteractions();
    this.addBookmarks();

    this.$.trigger('resize');
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
  C.prototype.hasMainSummary = function() {
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
  C.prototype.addSliderInteractions = function () {
    // Remove old dots
    this.controls.$slider.children('.h5p-seekbar-interaction').remove();

    for (var i = 0; i < this.params.assets.interactions.length; i++) {
      var interaction = this.params.assets.interactions[i];
      if (interaction.action.library.split(' ')[0] === 'H5P.Nil') {
        continue; // Skip "sub titles"
      }

      var title = (interaction.action.params.contentName !== undefined ? interaction.action.params.contentName : this.l10n.interaction);
      // One could also set width using ((interaction.duration.to - interaction.duration.from + 1) * this.oneSecondInPercentage)
      $('<div class="h5p-seekbar-interaction ' + this.getClassName(interaction) + '" style="left:' + (interaction.duration.from * this.oneSecondInPercentage) + '%" title="' + title + '"></div>').appendTo(this.controls.$interactionsContainer);
    }
  };

  /**
   * Puts all the cool narrow lines around the slider / seek bar.
   */
  C.prototype.addBookmarks = function () {
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
  C.prototype.addBookmark = function (id, tenth) {
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
    self.$.on('bookmarksChanged', function (event, index, number) {
      if (index === id && number < 0) {
        // We are removing this item.
        $li.remove();
        delete self.bookmarksMap[tenth];
        $(this).unbind(event);
      }
      else if (id >= index) {
        // We must update our id.
        id += number;
        $bookmark.data('id', id);
      }
    });

    // Tell others we have added a new bookmark.
    self.$.trigger('bookmarkAdded', [$bookmark]);
    return $bookmark;
  };

  /**
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachControls = function ($wrapper) {
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
        that.controls.$currentTime.html(C.humanizeTime(ui.value));
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
  C.prototype.addQualityChooser = function () {
    var self = this;

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
  C.prototype.startUpdatingBufferBar = function () {
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
  C.prototype.resize = function () {
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
    this.video.$.trigger('resize');

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
      this.video.$.trigger('resize');
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
  C.prototype.toggleFullScreen = function () {
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
  C.prototype.timeUpdate = function (time) {
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
        self.controls.$currentTime.html(C.humanizeTime(second));
      }
    }
    self.lastSecond = second;

    self.toggleInteractions(Math.floor(time));

    setTimeout(function () {
      if (self.currentState === PLAYING) {
        self.timeUpdate(self.video.getCurrentTime());
      }
    }, 40); // 25 fps
  };

  /**
   * Display and remove interactions for the given second.
   *
   * @param {int} second
   */
  C.prototype.toggleInteractions = function (second) {
    for (var i = 0; i < this.params.assets.interactions.length; i++) {
      this.toggleInteraction(i, second);
    }
  };

  /**
   * Display or remove an interaction on the video.
   *
   * @param {int} i Interaction index in params.
   * @param {int} second Optional. Current video time second.
   * @returns {unresolved}
   */
  C.prototype.toggleInteraction = function (i, second) {
    var that = this;
    var interaction = this.params.assets.interactions[i];

    if (second === undefined) {
      second = Math.floor(this.video.getCurrentTime());
    }

    if (second < interaction.duration.from || second > interaction.duration.to) {
      // Remove interaction
      if (this.visibleInteractions[i] !== undefined) {
        this.visibleInteractions[i].remove();
        delete this.visibleInteractions[i];
      }
      return;
    }

    if (this.visibleInteractions[i] !== undefined) {
      return; // Interaction already exists.
    }

    // Add interaction
    var className = this.getClassName(interaction);
    var showLabel = (className === 'h5p-nil-interaction') || (interaction.label !== undefined && $("<div/>").html(interaction.label).text().length > 0);

    var $interaction = this.visibleInteractions[i] = $('<div class="h5p-interaction ' +
            className + ' h5p-hidden" data-id="' + i + '" style="top:' + interaction.y +
            '%;left:' + interaction.x + '%"><a href="#" class="h5p-interaction-button"></a>' +
            (showLabel ? '<div class="h5p-interaction-label">' + interaction.label +
            '</div>' : '') + '</div>')
      .appendTo(this.$overlay)
      .click(function () {
        if (that.editor === undefined) {
          that.showDialog(interaction, $interaction);
        }
        return false;
      })
      .end();

    if (this.editor !== undefined) {
      // Append editor magic
      this.editor.newInteraction($interaction);
    }

    // Transition in
    setTimeout(function () {
      $interaction.removeClass('h5p-hidden');
      if (className !== 'h5p-nil-interaction') {
        that.positionLabel($interaction);
      }
    }, 1);

    if (interaction.pause && this.playing) {
      this.video.pause();
    }

    return $interaction;
  };

  /**
   * Detect custom html class for interaction.
   *
   * @param {Object} interaction
   * @return {String} HTML class
   */
  C.prototype.getClassName = function (interaction) {
    if (interaction.className === undefined) {
      var nameParts = interaction.action.library.split(' ')[0].toLowerCase().split('.');
      return nameParts[0] + '-' + nameParts[1] + '-interaction';
    }
    else {
      return interaction.className;
    }
  };

  /**
   *
   * @param {type} $interaction
   * @returns {undefined}
   */
  C.prototype.positionLabel = function ($interaction) {
    var $label = $interaction.children('.h5p-interaction-label');
    if ($label.length) {
      $label.removeClass('h5p-left-label');
      if (parseInt($interaction.css('left')) + $label.position().left + $label.outerWidth() > this.$videoWrapper.width()) {
        $label.addClass('h5p-left-label');
      }
    }
  };

  /**
   * Display interaction dialog.
   *
   * @param {Object} interaction
   * @param {jQuery} $button
   * @returns {undefined}
   */
  C.prototype.showDialog = function (interaction, $button) {
    var that = this;
    var instance;

    this.lastState = this.currentState;
    this.video.pause();

    if (interaction !== undefined) {
      var $inner = this.$dialog.children('.h5p-dialog-inner');
      var $dialog = $inner.html('<div class="h5p-dialog-interaction"></div>').children();
      instance = H5P.newRunnable(interaction.action, this.contentId, $dialog);

      var lib = interaction.action.library.split(' ')[0];

      if (lib === 'H5P.Summary' || lib === 'H5P.Blanks') {
        interaction.bigDialog = true;

        if (lib === 'H5P.Summary') {
          // Scroll summary to bottom if the task changes size
          var lastHeight = 0;
          instance.$.on('resize', function () {
            var height = $dialog.height();
            if (lastHeight > height + 10 || lastHeight < height - 10)  {
              setTimeout(function () {
                $inner.stop().animate({
                  scrollTop: height
                }, 300);
              }, 500);
            }
            lastHeight = height;
          });
        }
      }
    }

    this.$dialogWrapper.show();
    this.positionDialog(interaction, $button, instance);

    setTimeout(function () {
      that.$dialogWrapper.removeClass('h5p-hidden');
    }, 1);
  };

  /**
   * Position current dialog.
   *
   * @param {object} interaction
   * @param {jQuery} $button
   * @param {object} instance
   * @returns {undefined}
   */
  C.prototype.positionDialog = function (interaction, $button, instance) {
    // Reset dialog styles
    this.$dialog.removeClass('h5p-big').css({
      left: '',
      top: '',
      height: '',
      width: '',
      fontSize: ''
    }).children().css('width', '');

    if (interaction === undefined || interaction.bigDialog !== undefined && interaction.bigDialog) {
      this.$dialog.addClass('h5p-big');
    }
    else {
      if (instance.$ !== undefined) {
        instance.$.trigger('resize');
      }

      // TODO: Just let image implement resize or something? If so make sure
      // in image class that it only runs once.

      // How much of the player should the interaction cover?
      var interactionMaxFillRatio = 0.8;
      var buttonWidth = $button.outerWidth(true);
      var buttonPosition = $button.position();
      var containerWidth = this.$container.width();
      var containerHeight = this.$container.height();
      var that = this;

      // Special case for images
      if (interaction.action.library.split(' ')[0] === 'H5P.Image') {
        var $img = this.$dialog.find('img');
        var imgHeight, imgWidth, maxWidth;
        if (buttonPosition.left > (containerWidth / 2) - (buttonWidth / 2)) {
          // Space to the left of the button minus margin
          maxWidth = buttonPosition.left * (1 - (1 - interactionMaxFillRatio)/2);
        }
        else {
          // Space to the right of the button minus margin
          maxWidth = (containerWidth - buttonPosition.left - buttonWidth) * (1 - (1 - interactionMaxFillRatio)/2);
        }
        var maxHeight = containerHeight * interactionMaxFillRatio;

        // Use image size info if it is stored
        if (interaction.action.params.file.height !== undefined) {
          imgHeight = interaction.action.params.file.height;
          imgWidth = interaction.action.params.file.width;
        }
        // Image size info is missing. We must find image size
        else {
          // TODO: Note that we allready have an img with the approperiate
          // source attached to the DOM, wouldn't attaching another cause
          // double loading?
          $("<img/>") // Make in memory copy of image to avoid css issues
            .attr("src", $img.attr("src")) // TODO: Check img.complete ? The image might be in cache.
            .load(function() { // TODO: Is load needed multiple times or would one('load') suffice?
              // Note that we're actually changing the params here if we're in the editor.
              interaction.action.params.file.width = this.width;   // Note: $(this).width() will not work for in memory images.
              interaction.action.params.file.height = this.height;
              that.positionDialog(interaction, $button);
          });
          // TODO: What happens to our in memory img now? Could we reuse it?
        }
        // Resize image and dialog container
        if (typeof imgWidth != "undefined") { // TODO: imgWidth !== undefined is insanely faster than string comparison...
          if (imgHeight > maxHeight) {
            imgWidth = imgWidth * maxHeight / imgHeight;
            imgHeight = maxHeight;
          }
          if (imgWidth > maxWidth) {
            imgHeight = imgHeight * maxWidth / imgWidth;
            imgWidth = maxWidth;
          }
          $img.css({
            width: imgWidth,
            height: imgHeight
          });
          this.$dialog.css({
            width: imgWidth + 1.5 * this.fontSize, // TODO: What is 1.5? Where are the docs?
            height: imgHeight
          })
          .children('.h5p-dialog-inner').css('width', 'auto');
        }
      }

      // TODO: This function is HUGE, could some of it maybe be moved to
      // H5P.Image? Content sizing shouldn't be a part of positioning the
      // dialog, it should happen before. If we're waiting for something to
      // load show a dialog with a throbber or something...

      // Position dialog horizontally
      var left = buttonPosition.left;

      var dialogWidth = this.$dialog.outerWidth(true);

      // If dialog is too big to fit within the container, display as h5p-big instead.
      if (dialogWidth > containerWidth) {
        this.$dialog.addClass('h5p-big');
        return;
      }

      if (buttonPosition.left > (containerWidth / 2) - (buttonWidth / 2)) {
        // Show on left
        left -= dialogWidth - buttonWidth;
      }

      // Make sure the dialog is within the video on the right.
      if ((left + dialogWidth) > containerWidth) {
        left = containerWidth - dialogWidth;
      }

      var marginLeft = parseInt(this.$videoWrapper.css('marginLeft'));
      if (isNaN(marginLeft)) {
        marginLeft = 0;
      }

      // And finally, make sure we're within bounds on the left hand side too...
      if (left < marginLeft) {
        left = marginLeft;
      }

      // Position dialog vertically
      var marginTop = parseInt(this.$videoWrapper.css('marginTop'));
      if (isNaN(marginTop)) {
        marginTop = 0;
      }

      var top = buttonPosition.top + marginTop;
      var totalHeight = top + this.$dialog.outerHeight(true);

      if (totalHeight > containerHeight) {
        top -= totalHeight - containerHeight;
      }

      this.$dialog.removeClass('h5p-big').css({
        top: (top / (containerHeight / 100)) + '%',
        left: (left / (containerWidth / 100)) + '%'
      });
    }
  };

  /**
   * Hide current dialog.
   *
   * @returns {Boolean}
   */
  C.prototype.hideDialog = function () {
    var that = this;

    this.$dialogWrapper.addClass('h5p-hidden');

    setTimeout(function () {
      that.$dialogWrapper.hide();
    }, 201);

    if (this.editor === undefined && that.lastState === PLAYING) {
      this.video.play();
    }
  };

  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyrights}
   */
  C.prototype.getCopyrights = function () {
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

    for (var i = 0; i < self.params.assets.interactions.length; i++) {
      var interaction = self.params.assets.interactions[i];
      var instance = H5P.newRunnable(interaction.action, self.contentId);

      if (instance !== undefined && instance.getCopyrights !== undefined) {
        var interactionCopyrights = instance.getCopyrights();
        if (interactionCopyrights !== undefined) {
          interactionCopyrights.setLabel((interaction.action.params.contentName !== undefined ? interaction.action.params.contentName : 'Interaction') + ' ' + C.humanizeTime(interaction.duration.from) + ' - ' + C.humanizeTime(interaction.duration.to));
          info.addContent(interactionCopyrights);
        }
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
   * @param {float} seconds
   * @returns {string}
   */
  C.humanizeTime = function (seconds) {
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

  return C;
})(H5P.jQuery);
