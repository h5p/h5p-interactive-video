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
    this.params = params.interactiveVideo;
    this.contentPath = H5P.getContentPath(id);

    this.visibleInteractions = [];

    this.l10n = {
      play: 'Play',
      pause: 'Pause',
      mute: 'Mute',
      unmute: 'Unmute',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen',
      summary: 'Summary'
    };
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

    this.fontSize = parseInt($container.css('fontSize')); // How large the interactions should be in px.
    this.width = parseInt($container.css('width'));
    $container.css('width', '100%');

    // Video with interactions
    this.$videoWrapper = $container.children('.h5p-video-wrapper');
    this.attachVideo(this.$videoWrapper);

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
      controls: false,
      autoplay: false,
      fitToWrapper: false
    }, this.contentPath);

    this.video.endedCallback = function () {
      that.ended();
    };
    this.video.loadedCallback = function () {
      that.loaded();
    };

    this.video.attach($wrapper);
    this.$overlay = $('<div class="h5p-overlay h5p-ie-transparent-background"></div>').appendTo($wrapper);
  };

  /**
   * Unbind event listeners.
   *
   * @returns {undefined}
   */
  C.prototype.remove = function () {
    if (this.resizeEvent !== undefined) {
      H5P.$window.unbind('resize', this.resizeEvent);
    }
  };

  /**
   * Unbind event listeners.
   *
   * @returns {undefined}
   */
  C.prototype.loaded = function () {
    var that = this;

    if (this.video.flowplayer !== undefined) {
      this.video.flowplayer.getPlugin('play').hide();
    }

    this.resizeEvent = function() {
      that.resize();
    };
    H5P.$window.resize(this.resizeEvent);
    this.resize();

    var duration = this.video.getDuration();
    var time = C.humanizeTime(duration);
    this.controls.$totalTime.html(time);
    this.controls.$slider.slider('option', 'max', duration);

    this.controls.$currentTime.html(time);
    // Set correct margins for timeline
    this.controls.$slider.parent().css({
      marginLeft: this.$controls.children('.h5p-controls-left').width(),
      marginRight: this.$controls.children('.h5p-controls-right').width()
    });
    this.controls.$currentTime.html(C.humanizeTime(0));

    duration = Math.floor(duration);

    // Set max/min for editor duration fields
    if (this.editor !== undefined) {
      var durationFields = this.editor.field.field.fields[4].fields;
      durationFields[0].max = durationFields[1].max = duration;
      durationFields[0].min = durationFields[1].min = 0;
    }

    // Add summary interaction to last second
    if (this.params.summary !== undefined) {
      this.params.interactions.push({
        action: this.params.summary,
        x: 80,
        y: 80,
        duration: {
          from: duration,
          to: duration
        },
        bigDialog: true,
        label: this.l10n.summary
      });
    }
  };

  /**
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachControls = function ($wrapper) {
    var that = this;

    $wrapper.html('<div class="h5p-controls-left"><a href="#" class="h5p-control h5p-play h5p-pause" title="' + that.l10n.play + '"></a></div><div class="h5p-controls-right"><a href="#" class="h5p-control h5p-fullscreen"  title="' + that.l10n.fullscreen + '"></a><a href="#" class="h5p-control h5p-volume"  title="' + that.l10n.mute + '"></a><div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div></div><div class="h5p-control h5p-slider"><div></div></div>');
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

    // Fullscreen button
    if (this.editor === undefined) {
      this.controls.$fullscreen = $wrapper.find('.h5p-fullscreen').click(function () {
        if (that.controls.$fullscreen.hasClass('h5p-exit')) {
          that.controls.$fullscreen.removeClass('h5p-exit').attr('title', that.l10n.fullscreen);
          if (H5P.fullScreenBrowserPrefix === undefined) {
            that.$container.children('.h5p-disable-fullscreen').click();
          }
          else {
            if (H5P.fullScreenBrowserPrefix === '') {
              document.exitFullScreen();
            }
            else {
              document[H5P.fullScreenBrowserPrefix + 'CancelFullScreen']();
            }
          }
        }
        else {
          that.controls.$fullscreen.addClass('h5p-exit').attr('title', that.l10n.exitFullscreen);
          H5P.fullScreen(that.$container, that);
          if (H5P.fullScreenBrowserPrefix === undefined) {
            that.$container.children('.h5p-disable-fullscreen').hide();
          }
        }
        return false;
      });
    }
    else {
      $wrapper.find('.h5p-fullscreen').remove();
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
    this.controls.$slider = $slider.children().slider({
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
        that.video.seek(ui.value);
        if (that.playing !== undefined && that.playing) {
          that.play(true);
        }
        else {
          that.toggleInteractions(Math.floor(ui.value));
        }
        if (that.hasEnded !== undefined && that.hasEnded) {
          that.hasEnded = false;
        }
      }
    });

    // Set correct margins for timeline
    $slider.css({
      marginLeft: that.$controls.children('.h5p-controls-left').width(),
      marginRight: that.$controls.children('.h5p-controls-right').width()
    });

    this.controls.$buffered = $('<canvas class="h5p-buffered" width="100" height="8"></canvas>').prependTo(this.controls.$slider);
  };

  /**
   * Resize the video to fit the wrapper.
   *
   * @param {Boolean} fullScreen
   * @returns {undefined}
   */
  C.prototype.resize = function (fullScreen) {
    var fullscreenOn = H5P.$body.hasClass('h5p-fullscreen') || H5P.$body.hasClass('h5p-semi-fullscreen');

    if (fullScreen === false && !this.$dialogWrapper.hasClass('.h5p-hidden')) {
      // Remove any open dialogs when exiting fullscreen.
      this.hideDialog();
    }

    this.controls.$buffered.attr('width', this.controls.$slider.width());

    this.$videoWrapper.css({
      marginTop: '',
      marginLeft: '',
      width: '',
      height: ''
    });
    this.video.resize();

    var width = this.$container.width();
    this.$container.css('fontSize', (this.fontSize * (width / this.width)) + 'px');

    if (!fullscreenOn) {
      if (this.controls.$fullscreen !== undefined && this.controls.$fullscreen.hasClass('h5p-exit')) {
        // Update icon if we some how got out of fullscreen.
        this.controls.$fullscreen.removeClass('h5p-exit').attr('title', this.l10n.fullscreen);
      }
      return;
    }

    var videoHeight = this.$videoWrapper.height();
    var controlsHeight = this.$controls.height();
    var containerHeight = this.$container.height();

    if (videoHeight + controlsHeight <= containerHeight) {
      this.$videoWrapper.css('marginTop', (containerHeight - controlsHeight - videoHeight) / 2);
    }
    else {
      var $video = this.$videoWrapper.find('.h5p-video, .h5p-video-flash > object');
      var ratio = this.$videoWrapper.width() / videoHeight;

      var height = containerHeight - controlsHeight;
      var width = height * ratio;
      $video.css('height', height);
      this.$videoWrapper.css({
        marginLeft: (this.$container.width() - width) / 2,
        width: width,
        height: height
      });
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
    var lastSecond;
    this.uiUpdater = setInterval(function () {
      var time = that.video.getTime();
      that.controls.$slider.slider('option', 'value', time);

      var second = Math.floor(time);
      if (Math.floor(lastSecond) !== second) {
        that.toggleInteractions(second);

        if (that.editor !== undefined && that.editor.dnb.dnd.$coordinates !== undefined) {
          // Remove coordinates picker while playing
          that.editor.dnb.dnd.$coordinates.remove();
          delete that.editor.dnb.dnd.$coordinates;
        }

        // Update timer
        that.controls.$currentTime.html(C.humanizeTime(second));
      }

      // Update buffer bar
      if (that.video.video !== undefined) {
        var canvas = that.controls.$buffered[0].getContext('2d');
        var width = parseFloat(that.controls.$buffered.attr('width'));
        var buffered = that.video.video.buffered;
        var duration = that.video.video.duration;

        canvas.fillStyle = '#5f5f5f';
        for (var i = 0; i < buffered.length; i++) {
          var from = buffered.start(i) / duration * width;
          var to = (buffered.end(i) / duration * width) - from;

          canvas.fillRect(from, 0, to, 8);
        }
      }

      lastSecond = second;
    }, 40); // 25 FPS
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
  };

  /**
   * Display and remove interactions for the given second.
   *
   * @param {int} second
   */
  C.prototype.toggleInteractions = function (second) {
    for (var i = 0; i < this.params.interactions.length; i++) {
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
    var interaction = this.params.interactions[i];

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
    var className = interaction.action.library.split(' ')[0].replace('.', '-').toLowerCase();
    if (interaction.label === undefined) {
      interaction.label = '';
    }

    var $interaction = this.visibleInteractions[i] = $('<a href="#" class="h5p-interaction ' + className + ' h5p-hidden" data-id="' + i + '" style="top:' + interaction.y + '%;left:' + interaction.x + '%">' + interaction.label + '</a>').appendTo(this.$overlay).click(function () {
      if (that.editor === undefined) {
        that.showDialog(interaction, $interaction);
      }
      return false;
    });

    if (this.editor !== undefined) {
      // Append editor magic
      this.editor.newInteraction($interaction);
    }

    // Transition in
    setTimeout(function () {
      $interaction.removeClass('h5p-hidden');
    }, 1);

    if (interaction.pause && this.playing) {
      this.pause();
    }

    return $interaction;
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

    if (this.playing) {
      this.pause(true);
    }

    if (interaction !== undefined) {
      var $dialog = this.$dialog.children('.h5p-dialog-inner').html('<div class="h5p-dialog-interaction"></div>').children();

      var lib = interaction.action.library.split(' ')[0];
      var interactionInstance = new (H5P.classFromName(lib))(interaction.action.params, this.contentPath);
      interactionInstance.attach($dialog);

      if (lib === 'H5P.Image') {
        // Make sure images dosn't strech.
        $dialog.children('img').load(function () {
          // Reposition after image has loaded.
          that.positionDialog(interaction, $button);
        });
      }
    }

    this.$dialogWrapper.show();
    this.positionDialog(interaction, $button);

    setTimeout(function () {
      that.$dialogWrapper.removeClass('h5p-hidden');
    }, 1);
  };

  /**
   * Position current dialog.
   *
   * @param {object} interaction
   * @param {jQuery} $button
   * @returns {undefined}
   */
  C.prototype.positionDialog = function (interaction, $button) {
    if (interaction === undefined || interaction.bigDialog !== undefined && interaction.bigDialog) {
      this.$dialog.addClass('h5p-big').css({
        left: '',
        top: '',
        height: ''
      });
    }
    else {
      // Position dialog horizontally
      var buttonWidth = $button.outerWidth(true);
      var containerWidth = this.$container.width();
      var buttonPosition = $button.position();
      var left = buttonPosition.left;
      if (buttonPosition.left > (containerWidth / 2) - (buttonWidth / 2)) {
        // Show on left
        left -= this.$dialog.outerWidth(true) - buttonWidth;
      }

      // Position dialog vertically
      var top = buttonPosition.top;
      var containerHeight = this.$container.height();
      var totalHeight = buttonPosition.top + this.$dialog.outerHeight(true);
      if (totalHeight > containerHeight) {
        top -= totalHeight - containerHeight;
      }

      this.$dialog.removeClass('h5p-big').css({
        top: (top / (containerHeight / 100)) + '%',
        left: (left / (containerWidth / 100)) + '%',
        height: (this.$dialog.height() / (containerHeight / 100)) + '%'
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

    if (this.playing) {
      this.play(true);
    }
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