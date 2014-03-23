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
    this.params = params.interactiveVideo;
    this.contentId = id;
    this.visibleInteractions = [];
    this.postUserStatistics = (H5P.postUserStatistics === true);

    this.l10n = {
      play: 'Play',
      pause: 'Pause',
      mute: 'Mute',
      quality: 'Video quality',
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

    this.justVideo = navigator.userAgent.match(/iPhone|iPod/i) ? true : false;
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
    this.fontSize = 16;
    this.width = parseInt($container.css('width'));
    $container.css('width', '100%');

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

    this.resize(false);

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
    
    this.drawSliderInteractions();
  };
  
  /**
   * Puts the tiny cute balls above the slider / seek bar.
   */
  C.prototype.drawSliderInteractions = function () {
    // Remove old dots
    this.controls.$slider.children('.h5p-seekbar-interaction').remove();
  
    // Detect the beginning of a second on the timeline
    var oneSecondInPercentage = (100 / this.video.getDuration());
     
    for (var i = 0; i < this.params.interactions.length; i++) {
      var interaction = this.params.interactions[i];
      if (interaction.action.library.split(' ')[0] === 'H5P.Nil') {
        continue; // Skip "sub titles"
      }
      
      // One could also set width using ((interaction.duration.to - interaction.duration.from + 1) * oneSecondInPercentage)
      $('<div class="h5p-seekbar-interaction ' + this.getClassName(interaction) + '" style="left:' + (interaction.duration.from * oneSecondInPercentage) + '%"></div>').appendTo(this.controls.$slider);
    }
  }

  /**
   * Attach video controls to the given wrapper
   *
   * @param {jQuery} $wrapper
   */
  C.prototype.attachControls = function ($wrapper) {
    var that = this;

    $wrapper.html('<div class="h5p-controls-left"><a href="#" class="h5p-control h5p-play h5p-pause" title="' + that.l10n.play + '"></a></div><div class="h5p-controls-right"><a href="#" class="h5p-control h5p-fullscreen"  title="' + that.l10n.fullscreen + '"></a><a href="#" class="h5p-control h5p-quality"  title="' + that.l10n.quality + '"></a><div class="h5p-quality-chooser h5p-hidden"><h3>' + that.l10n.quality + '</h3></div><a href="#" class="h5p-control h5p-copyright"  title="' + that.l10n.copyright + '"></a><a href="#" class="h5p-control h5p-volume"  title="' + that.l10n.mute + '"></a><div class="h5p-control h5p-time"><span class="h5p-current">0:00</span> / <span class="h5p-total">0:00</span></div></div><div class="h5p-control h5p-slider"><div></div></div>');
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
       
       // Video quality selector
      var $chooser = $wrapper.find('.h5p-quality-chooser');
      $wrapper.find('.h5p-quality').click(function () {
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
        $chooser.append('<ul>' + qualities + '</ul>');
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
      $wrapper.find('.h5p-copyright').remove();
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
    this.controls.$slider = $slider.children().slider({
      value: 0,
      step: 0.01,
      orientation: 'horizontal',
			range: 'min',
      max: 0,
      start: function () {
        if (that.$splash !== undefined) {
          that.$splash.remove();
          delete that.$splash;
        }

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

    var that = this;
    setTimeout(function () {
      that.controls.$buffered.attr('width', that.controls.$slider.width());
    }, 1);

    this.$videoWrapper.css({
      marginTop: '',
      marginLeft: '',
      width: '',
      height: ''
    });
    this.video.resize();

    var width;
    if (fullscreenOn) {
      var videoHeight = this.$videoWrapper.height();
      var controlsHeight = this.$controls.height();
      var containerHeight = this.$container.height();

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
      this.video.resize();
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
        var $disable = $('.h5p-disable-fullscreen');
        if ($disable.length) {
          $disable.click();
        }
        else {
          var button = $('#' + window.frameElement.id + '-wrapper', window.top.document).children('.h5p-disable-fullscreen')[0];
          if (button.dispatchEvent) {
            var event = document.createEvent('MouseEvents');
            event.initEvent('click', true, true);
            button.dispatchEvent(event);
          }
          else if (button.fireEvent) {
            button.fireEvent('onclick', document.createEventObject());
          }
        }
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
        var $disable = $('.h5p-disable-fullscreen');
        if ($disable.length) {
          $disable.hide();
        }
        else {
          $('#' + window.frameElement.id + '-wrapper', window.top.document).children('.h5p-disable-fullscreen').hide();
        }
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

        if (that.editor !== undefined) {
          // Remove coordinates picker while playing
          that.editor.removeCoordinatesPicker();
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

    // Post user score
    if (this.postUserStatistics === true) {
      H5P.setFinished(this.contentId, 0, 0);
    }
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
    var className = this.getClassName(interaction);
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
  }

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
      if (instance.resize !== undefined) {
        instance.resize();
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
          var maxWidth = buttonPosition.left * (1 - (1 - interactionMaxFillRatio)/2);
        }
        else {
          // Space to the right of the button minus margin
          var maxWidth = (containerWidth - buttonPosition.left - buttonWidth) * (1 - (1 - interactionMaxFillRatio)/2);
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
      videoRights = new H5P.MediaCopyright(video.copyright, self.l10n)
    }

    if ((videoRights === undefined || videoRights.undisclosed()) && self.params.video.copyright !== undefined) {
      // Use old copyright info as fallback.
      videoRights = self.params.video.copyright;
    }
    info.addMedia(videoRights);
    
    for (var i = 0; i < self.params.interactions.length; i++) {
      var interaction = self.params.interactions[i];
      var instance = H5P.newRunnable(interaction.action, self.contentId);
      
      if (instance.getCopyrights !== undefined) {
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
