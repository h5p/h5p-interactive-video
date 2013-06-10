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
      summary: 'Summary',
      copyright: 'View copyright information',
      contentType: 'Content type',
      title: 'Title',
      author: 'Author',
      source: 'Source',
      license: 'License',
      time: 'Time',
      interactionsCopyright: 'Copyright information regarding interactions used in this interactive video',
      error: 'Sorry, could not load the video.',
      "U": "Undisclosed",
      "CC BY": "Attribution",
      "CC BY-SA": "Attribution-ShareAlike",
      "CC BY-ND": "Attribution-NoDerivs",
      "CC BY-NC": "Attribution-NonCommercial",
      "CC BY-NC-SA": "Attribution-NonCommercial-ShareAlike",
      "CC BY-NC-ND": "Attribution-NonCommercial-NoDerivs",
      "PD": "Public Domain",
      "ODC PDDL": "Public Domain Dedication and Licence",
      "CC PDM": "Public Domain Mark",
      "C": "Copyright"
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

    this.video.errorCallback = function () {
      that.$container.html('<div class="h5p-video-error">' + that.l10n.error + '</div>');
      that.remove();
      if (that.editor !== undefined) {
        delete that.editor.IV;
      }
    };
    this.video.endedCallback = function () {
      that.ended();
    };
    this.video.loadedCallback = function () {
      that.loaded();
    };

    this.video.attach($wrapper);
    this.$overlay = $('<div class="h5p-overlay h5p-ie-transparent-background"></div>').appendTo($wrapper);

    if (this.editor === undefined) {
      this.$splash = $('<div class="h5p-splash"><h2>Interactive Video</h2><p>Press the icons as the video plays for challenges and more information on the topics!</p><div class="h5p-interaction h5p-multichoice-interaction"><a href="#" class="h5p-interaction-button"></a><div class="h5p-interaction-label">Challenges</div></div><div class="h5p-interaction h5p-text-interaction"><a href="#" class="h5p-interaction-button"></a><div class="h5p-interaction-label">More information</div></div></div>').appendTo(this.$overlay);
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
      var durationFields = this.editor.field.field.fields[0].fields;
      durationFields[0].max = durationFields[1].max = duration;
      durationFields[0].min = durationFields[1].min = 0;
    }

    // Add summary interaction to last second
    if (this.params.summary !== undefined && this.params.summary.params.summaries.length) {
      this.params.interactions.push({
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
  };

  /**
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachControls = function ($wrapper) {
    var that = this;

    $wrapper.html('<div class="h5p-controls-left"><a href="#" class="h5p-control h5p-play h5p-pause" title="' + that.l10n.play + '"></a></div><div class="h5p-controls-right"><a href="#" class="h5p-control h5p-fullscreen"  title="' + that.l10n.fullscreen + '"></a><a href="#" class="h5p-control h5p-copyright"  title="' + that.l10n.copyright + '"></a><a href="#" class="h5p-control h5p-volume"  title="' + that.l10n.mute + '"></a><div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div></div><div class="h5p-control h5p-slider"><div></div></div>');
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

    if (this.editor === undefined) {
      // Fullscreen button
      this.controls.$fullscreen = $wrapper.find('.h5p-fullscreen').click(function () {
        that.toggleFullScreen();
        return false;
      });

      // Copyright button
       $wrapper.find('.h5p-copyright').click(function () {
         // Display dialog
         that.showCopyrightInfo();
         return false;
       });
    }
    else {
      // Remove buttons in editor mode.
      $wrapper.find('.h5p-fullscreen').remove();
      $wrapper.find('.h5p-copyright').remove();
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

    if (fullscreenOn) {
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
    }
    else {
      if (this.controls.$fullscreen !== undefined && this.controls.$fullscreen.hasClass('h5p-exit')) {
        // Update icon if we some how got out of fullscreen.
        this.controls.$fullscreen.removeClass('h5p-exit').attr('title', this.l10n.fullscreen);
      }
      var width = this.$container.width();
    }

    this.$container.css('fontSize', (this.fontSize * (width / this.width)) + 'px');
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
        this.$container.children('.h5p-disable-fullscreen').click();
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
      this.controls.$fullscreen.addClass('h5p-exit').attr('title', this.l10n.exitFullscreen);
      H5P.fullScreen(this.$container, this);
      if (H5P.fullScreenBrowserPrefix === undefined) {
        this.$container.children('.h5p-disable-fullscreen').hide();
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
    var className;
    if (interaction.className === undefined) {
      var nameParts = interaction.action.library.split(' ')[0].toLowerCase().split('.');
      className = nameParts[0] + '-' + nameParts[1] + '-interaction';
    }
    else {
      className = interaction.className;
    }

    var $interaction = this.visibleInteractions[i] = $('<div class="h5p-interaction ' + className + ' h5p-hidden" data-id="' + i + '" style="top:' + interaction.y + '%;left:' + interaction.x + '%"><a href="#" class="h5p-interaction-button"></a>' + (interaction.label === undefined ? '' : '<div class="h5p-interaction-label">' + interaction.label + '</div>') + '</div>').appendTo(this.$overlay).children('a').click(function () {
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

    }, 1);

    if (interaction.pause && this.playing) {
      this.pause();
    }

    return $interaction;
  };

  /**
   * Displays a dialog with copyright information.
   *
   * @returns {undefined}
   */
  C.prototype.showCopyrightInfo = function () {
    var info = '';

    for (var i = 0; i < this.params.interactions.length; i++) {
      var interaction = this.params.interactions[i];
      var params = interaction.action.params;

      if (params.copyright === undefined) {
        continue;
      }

      info += '<dl class="h5p-copyinfo"><dt>' + this.l10n.contentType + '</dt><dd>' + params.contentName + '</dd>';
      if (params.copyright.title !== undefined) {
        info += '<dt>' + this.l10n.title + '</dt><dd>' + params.copyright.title + '</dd>';
      }
      if (params.copyright.author !== undefined) {
        info += '<dt>' + this.l10n.author + '</dt><dd>' + params.copyright.author + '</dd>';
      }
      if (params.copyright.license !== undefined) {
        info += '<dt>' + this.l10n.license + '</dt><dd>' + this.l10n[params.copyright.license] + ' (' + params.copyright.license + ')</dd>';
      }
      if (params.copyright.source !== undefined) {
        info += '<dt>' + this.l10n.source + '</dt><dd><a target="_blank" href="' + params.copyright.source + '">' + params.copyright.source + '</a></dd>';
      }
      info += '<dt>' + this.l10n.time + '</dt><dd>' + C.humanizeTime(interaction.duration.from) + ' - ' + C.humanizeTime(interaction.duration.to) + '</dd></dl>';
    }

    if (info) {
      info = '<h2 class="h5p-interactions-copyright">' + this.l10n.interactionsCopyright + '</h2>' + info;
    }

    this.$dialog.children('.h5p-dialog-inner').html('<div class="h5p-dialog-interaction">' + this.params.video.copyright + info + '</div>');
    this.showDialog();
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
          that.$dialog.css({
            height: ''
          });
          // Reposition after image has loaded.
          that.positionDialog(interaction, $button);
        });
      }
      else if (lib === 'H5P.Summary') {
        interaction.bigDialog = true;
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
    this.$dialog.removeClass('h5p-big').css({
        left: '',
        top: '',
        height: ''
      });
    if (interaction === undefined || interaction.bigDialog !== undefined && interaction.bigDialog) {
      this.$dialog.addClass('h5p-big');
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

      var marginLeft = parseInt(this.$videoWrapper.css('marginLeft'));
      if (!isNaN(marginLeft)) {
        left += marginLeft;
      }

      // Position dialog vertically
      var top = buttonPosition.top;
      var containerHeight = this.$container.height();
      var totalHeight = buttonPosition.top + this.$dialog.outerHeight(true);

      if (totalHeight > containerHeight) {
        top -= totalHeight - containerHeight;
      }
      var marginTop = parseInt(this.$videoWrapper.css('marginTop'));
      if (!isNaN(marginTop)) {
        top += marginTop;
      }

      this.$dialog.removeClass('h5p-big').css({
        top: (top / (containerHeight / 100)) + '%',
        left: (left / (containerWidth / 100)) + '%',
        height: Math.ceil(this.$dialog.height() / (containerHeight / 100)) + '%'
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

    this.play(this.playing ? true : undefined);
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