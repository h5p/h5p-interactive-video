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
    this.$ = $(this);
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
      bookmarks: 'Bookmarks'
    };

    this.justVideo = navigator.userAgent.match(/iPhone|iPod/i) ? true : false;
  }

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

    this.video = new H5P.Video({
      files: this.params.video.files,
      controls: this.justVideo,
      autoplay: false,
      fitToWrapper: false
    }, this.contentId);

    this.video = H5P.newRunnable({
      library: 'H5P.Video 1.0',
      params: {
        files: this.params.video.files,
        controls: this.justVideo,
        autoplay: false,
        fitToWrapper: false
      }
    }, this.contentId);

    if (this.justVideo) {
      this.video.attach($wrapper);
      return;
    }

    this.video.errorCallback = function (errorCode, errorMessage) {
      if (errorCode instanceof Event) {
        // Video
        switch (errorCode.target.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Media playback has been aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network failure';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Unable to decode media';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported';
            break;
          case MediaError.MEDIA_ERR_ENCRYPTED:
            errorMessage = 'Encrypted';
            break;
        }
      }

      that.$container.html('<div class="h5p-video-error">Error: ' + errorMessage + '.</div>');
      if (that.editor !== undefined) {
        delete that.editor.IV;
      }
    };
    this.video.endedCallback = function () {
      if (this.controls === undefined) return; // Might fail before we are ready.
      that.ended();
    };
    this.video.loadedCallback = function () {
      that.loaded();
    };

    this.video.attach($wrapper);
    this.$overlay = $('<div class="h5p-overlay h5p-ie-transparent-background"></div>').appendTo($wrapper);

    if (this.editor === undefined) {
      this.$splash = $('<div class="h5p-splash-wrapper"><div class="h5p-splash"><h2>Interactive Video</h2><p>Press the icons as the video plays for challenges and more information on the topics!</p><div class="h5p-interaction h5p-multichoice-interaction"><a href="#" class="h5p-interaction-button"></a><div class="h5p-interaction-label">Challenges</div></div><div class="h5p-interaction h5p-text-interaction"><a href="#" class="h5p-interaction-button"></a><div class="h5p-interaction-label">More information</div></div></div></div>')
      .click(function(){
        that.play();
        H5P.jQuery(this).remove();
      })
      .appendTo(this.$overlay);
      this.$splash.find('.h5p-interaction-button').click(function () {
        return false;
      });
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

    // Add summary interaction to last second
    if (this.hasMainSummary()) {
      this.params.assets.interactions.push({
        action: this.params.summary,
        x: 80,
        y: 80,
        duration: {
          from: duration - 3,
          to: duration
        },
        bigDialog: true,
        className: 'h5p-summary-interaction h5p-end-summary',
        label: this.l10n.summary
      });
    }

    this.oneSecondInPercentage = (100 / this.video.getDuration());
    this.addSliderInteractions();
    this.addBookmarks();

    this.triggerH5PEvent('resize');
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
    return this.params.summary !== undefined &&
      this.params.summary.params !== undefined &&
      this.params.summary.params.summaries !== undefined &&
      this.params.summary.params.summaries.length > 0 &&
      this.params.summary.params.summaries[0].summary !== undefined &&
      this.params.summary.params.summaries[0].summary.length > 0;
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
        self.seek(bookmark.time);
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
    self.registerH5PEventListener('bookmarksChanged', function (event, index, number) {
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
    self.triggerH5PEvent('bookmarkAdded', [$bookmark]);
    return $bookmark;
  };

  /**
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachControls = function ($wrapper) {
    var that = this;

    $wrapper.html('<div class="h5p-controls-left"><a href="#" class="h5p-control h5p-play h5p-pause" title="' + that.l10n.play + '"></a><a href="#" class="h5p-control h5p-bookmarks" title="' + that.l10n.bookmarks + '"></a><div class="h5p-chooser h5p-bookmarks"><h3>' + that.l10n.bookmarks + '</h3></div></div><div class="h5p-controls-right"><a href="#" class="h5p-control h5p-fullscreen"  title="' + that.l10n.fullscreen + '"></a><a href="#" class="h5p-control h5p-quality"  title="' + that.l10n.quality + '"></a><div class="h5p-chooser h5p-quality"><h3>' + that.l10n.quality + '</h3></div><a href="#" class="h5p-control h5p-volume"  title="' + that.l10n.mute + '"></a><div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div></div><div class="h5p-control h5p-slider"><div class="h5p-interactions-container"></div><div class="h5p-bookmarks-container"></div><div></div></div>');
    this.controls = {};

    // Play/pause button
    this.controls.$play = $wrapper.find('.h5p-play').click(function () {
      if (that.controls.$play.hasClass('h5p-pause')) {
        that.play();
      }
      else {
        that.pause();
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
      var $chooser = $wrapper.find('.h5p-chooser.h5p-quality');
      $wrapper.find('.h5p-control.h5p-quality').click(function () {
        $chooser.toggleClass('h5p-show');
        return false;
      });

      var qualities = '';
      for (var level in this.video.qualities) {
        if (this.video.qualities.hasOwnProperty(level)) {
          qualities += '<li role="button" tabIndex="1" data-level="' + level + '" class="' + (this.video.qualities[level]['default'] !== undefined ? 'h5p-selected' : '') + '">' + this.video.qualities[level].label + '</li>';
        }
      }
      if (qualities !== '') {
        $chooser.append('<ol>' + qualities + '</ol>');
        var $options = $chooser.find('li').click(function () {
          $options.removeClass('h5p-selected');
          that.video.setQuality($(this).addClass('h5p-selected').attr('data-level'));

          // Clear buffered canvas.
          var canvas = that.controls.$buffered[0];
          canvas.width = canvas.width;
        });
      }
      else {
        $wrapper.find('.h5p-quality, .h5p-quality-chooser').remove();
      }
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
          that.video.unmute();
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
        if (that.playing === undefined) {
          if (that.controls.$slider.slider('option', 'max') !== 0) {
            that.playing = false;
          }
        }
        else if (that.playing) {
          that.pause(true);
        }
      },
      slide: function (e, ui) {
        // Update timer
        that.controls.$currentTime.html(C.humanizeTime(ui.value));
      },
      stop: function (e, ui) {
        that.seek(ui.value);
        if (that.playing !== undefined && that.playing) {
          that.play(true);
        }
      }
    });

    // Slider bufferer
    this.controls.$buffered = $('<canvas class="h5p-buffered" width="100" height="8"></canvas>').prependTo(this.controls.$slider);

    // Slider containers
    this.controls.$interactionsContainer = $slider.find('.h5p-interactions-container');
    this.controls.$bookmarksContainer = $slider.find('.h5p-bookmarks-container');
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

    if (this.video.video !== undefined) {
      var that = this;
      setTimeout(function () {
        that.controls.$buffered.attr('width', that.controls.$slider.width());
        that.drawBufferBar();
      }, 1);
    }

    this.$videoWrapper.css({
      marginTop: '',
      marginLeft: '',
      width: '',
      height: ''
    });
    this.video.triggerH5PEvent('resize');

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
      this.video.triggerH5PEvent('resize');
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
   * Start the show.
   *
   * @param {Boolean} seeking
   * @returns {undefined}
   */
  C.prototype.play = function (seeking) {
    var that = this;

    if (seeking === undefined) {
      this.playing = true;

      if (this.$splash !== undefined) {
        this.$splash.remove();
        delete this.$splash;
      }

      if (this.hasEnded !== undefined && this.hasEnded) {
        // Start video over again
        this.video.seek(0);
        this.hasEnded = false;
      }

      this.controls.$play.removeClass('h5p-pause').attr('title', this.l10n.pause);
    }

    // Start video
    this.video.play();

    // Set interval that updates our UI as the video clip plays.
    this.uiUpdater = setInterval(function () {
      that.timeUpdate(that.video.getTime());
    }, 40); // 25 FPS
  };

  /**
   * Called when the time of the video changes.
   * Makes sure to update all UI elements.
   *
   * @params {Number} time new
   */
  C.prototype.timeUpdate = function (time) {
    var self = this;

    if (self.$splash !== undefined) {
      // Remove splash
      self.$splash.remove();
      delete self.$splash;
    }

    // Scroll slider
    self.controls.$slider.slider('option', 'value', time);

    // Update buffer bar
    if (self.video.video !== undefined) {
      self.drawBufferBar();
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

      // Update timer
      self.controls.$currentTime.html(C.humanizeTime(second));
    }
    self.lastSecond = second;

    self.controls.$currentTime.html(C.humanizeTime(time));

    self.toggleInteractions(Math.floor(time));
  };

  /**
   * Seek the interactive video to the given time.
   *
   * @param {Number} time
   */
  C.prototype.seek = function (time) {
    var self = this;

    self.video.seek(time); // Update video
    self.timeUpdate(time); // Update overlay

    if (self.hasEnded !== undefined && self.hasEnded) {
      // Prevent video from restarting when pressing play
      self.hasEnded = false;
    }
  };

  /**
   * Draw the buffer bar
   */
  C.prototype.drawBufferBar = function () {
    var canvas = this.controls.$buffered[0].getContext('2d');
    var width = parseFloat(this.controls.$buffered.attr('width'));
    var buffered = this.video.video.buffered;
    var duration = this.video.video.duration;

    canvas.fillStyle = '#5f5f5f';
    for (var i = 0; i < buffered.length; i++) {
      var from = buffered.start(i) / duration * width;
      var to = (buffered.end(i) / duration * width) - from;

      canvas.fillRect(from, 0, to, 8);
    }
  };

  /**
   * Pause our interactive video.
   *
   * @param {Boolean} seeking
   * @returns {undefined}
   */
  C.prototype.pause = function (seeking) {
    if (seeking === undefined) {
      this.controls.$play.addClass('h5p-pause').attr('title', this.l10n.play);
      this.playing = false;
    }

    this.video.pause();
    clearInterval(this.uiUpdater);
  };

  /**
   * Interactive video has ended.
   */
  C.prototype.ended = function () {
    this.controls.$play.addClass('h5p-pause').attr('title', this.l10n.play);
    this.playing = false;
    this.hasEnded = true;

    this.video.pause();
    clearInterval(this.uiUpdater);

    // Post user score
    this.triggerH5PxAPIEvent('completed', H5P.getxAPIScoredResult(0, 0));
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
      second = Math.floor(this.video.getTime());
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

    var $interaction = this.visibleInteractions[i] = $('<div class="h5p-interaction ' + className + ' h5p-hidden" data-id="' + i + '" style="top:' + interaction.y + '%;left:' + interaction.x + '%"><a href="#" class="h5p-interaction-button"></a>' + (showLabel ? '<div class="h5p-interaction-label">' + interaction.label + '</div>' : '') + '</div>').appendTo(this.$overlay).children('a').click(function () {
      if (that.editor === undefined) {
        that.showDialog(interaction, $interaction);
      }
      return false;
    }).end();

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
      this.pause();
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

    if (this.playing) {
      this.pause(true);
    }

    if (interaction !== undefined) {
      var $dialog = this.$dialog.children('.h5p-dialog-inner').html('<div class="h5p-dialog-interaction"></div>').children();
      instance = H5P.newRunnable(interaction.action, this.contentId, $dialog);

      var lib = interaction.action.library.split(' ')[0];

      if (lib === 'H5P.Summary' || lib === 'H5P.Blanks') {
        interaction.bigDialog = true;
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
        instance.triggerH5PEvent('resize');
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

    if ((this.editor === undefined || this.playing) && (this.hasEnded === undefined || this.hasEnded === false)) {
      this.play(this.playing ? true : undefined);
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
