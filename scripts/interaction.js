H5P.InteractiveVideoInteraction = (function ($, EventDispatcher) {

  /**
   * Keeps control of interactions in the interactive video.
   *
   * @class H5P.InteractiveVideoInteraction
   * @extends H5P.EventDispatcher
   * @param {Object} parameters describes action behavior
   * @param {H5P.InteractiveVideo} player instance
   * @param {Object} previousState
   */
  function Interaction(parameters, player, previousState) {
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    var $interaction, $label, $inner, $outer;
    var action = parameters.action;
    if (previousState) {
      action.userDatas = {
        state: previousState
      };
    }

    // Find library name and title
    var library = action.library.split(' ')[0];
    var title = (action.params.contentName !== undefined ? action.params.contentName : player.l10n.interaction);

    // Detect custom html class for interaction.
    var classes;

    // Keep track of content instance
    var instance;

    // Keep track of DragNBarElement and related dialog/form
    var dnbElement;

    // Keep track of interaction element state
    var isShownAsButton = false;

    // Keep track of tooltip state
    var isHovered = false;

    // Changes if interaction has moved from original position
    var isRepositioned = false;

    var getVisuals = function () {
      return $.extend({}, {
        backgroundColor: 'rgb(255,255,255)',
        boxShadow: true
      }, parameters.visuals);
    };

    /**
     * Display the current interaction as a button on top of the video.
     *
     * @private
     */
    var createButton = function () {
      var hiddenClass = isShownAsButton ? '' : ' h5p-hidden';
      $interaction = $('<div/>', {
        tabIndex: 0,
        role: 'button',
        'class': 'h5p-interaction ' + classes + hiddenClass,
        css: {
          left: parameters.x + '%',
          top: parameters.y + '%',
          width: '',
          height: ''
        },
        on: {
          click: function () {
            if (!self.dialogDisabled && library !== 'H5P.Nil') {
              openDialog();
            }
          },
          keypress: function (event) {
            if ((event.charCode || event.keyCode) === 32) { // Space
              if (!self.dialogDisabled && library !== 'H5P.Nil') {
                openDialog();
              }
            }
          }
        }
      });

      // Touch area for button
      $('<div/>', {
        'class': 'h5p-touch-area'
      }).appendTo($interaction);

      $('<div/>', {
        'class': 'h5p-interaction-button',
        'aria-label': title
      }).appendTo($interaction);

      // Show label in editor on hover
      if (player.editor) {
        $interaction.hover(function () {
          if ((!$interaction.is('.focused') && !$interaction.is(':focus')) &&
              (!player.dnb || (player.dnb && !player.dnb.newElement))) {
            player.editor.showInteractionTitle(title, $interaction);
            isHovered = true;
          } else {

            // Hide if interaction is focused, because of coordinates picker
            player.editor.hideInteractionTitle();
            isHovered = false;
          }
        }, function () {

          // Hide on hover out
          player.editor.hideInteractionTitle();
          isHovered = false;
        }).focus(function () {

          // Hide on focus, because of coord picker
          player.editor.hideInteractionTitle();
          isHovered = false;
        });
      }

      // Check to see if we should add label
      if (library === 'H5P.Nil' || (parameters.label && $converter.html(parameters.label).text().length)) {
        $label = $('<div/>', {
          'class': 'h5p-interaction-label',
          html: '<div class="h5p-interaction-label-text">' + parameters.label + '</div>'
        }).appendTo($interaction);
      }

      self.trigger('display', $interaction);
      setTimeout(function () {
        if ($interaction) {
          // Transition in
          $interaction.removeClass('h5p-hidden');
        }
      }, 0);
    };

    /**
     * Make interaction go to somewhere depending on interaction params
     *
     * @private
     * @param {jQuery} $anchor Anchor element
     * @return {JQuery} Anchor element with click functionality
     */
    var makeInteractionGotoClickable = function ($anchor) {
      if (parameters.goto.type === 'timecode') {
        $anchor.click(function (event) {
          if (event.which === 1) {
            goto({data: parameters.goto.time});
          }
        }).keypress(function (event) {
          if (event.which === 32) {
            goto({data: parameters.goto.time});
          }
        }).attr('role', 'button')
          .attr('tabindex', '0');
      }
      else { // URL
        var url = parameters.goto.url;
        $anchor.attr({
          href: (url.protocol !== 'other' ? url.protocol : '') + url.url,
          target: '_blank'
        });
      }

      return $anchor.addClass('goto-clickable');
    };

    /**
     * Close interaction by closing dialog if the interaction is a button
     * or through detaching the interaction otherwise
     *
     * @private
     */
    var closeInteraction = function () {
      if (self.isButton()) {
        player.dnb.dialog.close();
      }
      else {
        $interaction.detach();
      }
    };

    /**
     * Create continue button for video
     *
     * @private
     * @return {Element}
     */
    var createContinueVideoButton = function () {
      var button = document.createElement('button');
      button.innerHTML = player.l10n.continueWithVideo;
      button.className = 'h5p-interaction-continue-button';
      button.addEventListener('click', function () {
        closeInteraction();
        player.play();
      });

      return button;
    };

    /**
     * Add continue button to interaction
     *
     * @private
     * @param {jQuery} $parent
     */
    var addContinueButton = function ($parent) {
      if (library === 'H5P.Questionnaire') {

        // Check if button already exists
        if ($parent.find('.h5p-interaction-continue-button').length) {
          return;
        }

        var button = createContinueVideoButton();
        var $successScreen = $parent.find('.h5p-questionnaire-success-center');
        if ($successScreen.length) {
          $successScreen.get(0).appendChild(button);
        }

        instance.on('noSuccessScreen', function () {
          closeInteraction();
          player.play();
        });
      }
    };

    /**
     * Opens button dialog.
     *
     * @private
     */
    var openDialog = function () {
      if (typeof instance.setActivityStarted === 'function' && typeof instance.getScore === 'function') {
        instance.setActivityStarted();
      }

      var isGotoClickable = self.isGotoClickable();

      // Create wrapper for dialog content
      var $dialogContent = $(isGotoClickable && parameters.goto.type === 'url' ? '<a>' : '<div>', {
        'class': 'h5p-dialog-interaction h5p-frame'
      });

      // Attach instance to dialog and open
      var $instanceParent = isGotoClickable ? makeInteractionGotoClickable($dialogContent) : $dialogContent;
      instance.attach($instanceParent);
      addContinueButton($instanceParent);

      // Open dialog
      player.dnb.dialog.open($dialogContent);
      player.dnb.dialog.addLibraryClass(library);
      player.dnb.dialog.toggleClass('goto-clickable-visualize', !!(isGotoClickable && parameters.goto.visualize));
      player.dnb.dialog.toggleClass('h5p-goto-timecode', !!(parameters.goto && parameters.goto.type === 'timecode'));

      /**
       * Handle dialog closing once.
       * @private
       */
      var dialogCloseHandler = function () {
        this.off('close', dialogCloseHandler); // Avoid running more than once

        // Try to pause any media when closing dialog
        try {
          if (instance.pause !== undefined &&
            (instance.pause instanceof Function ||
            typeof instance.pause === 'function')) {
            instance.pause();
          }
        }
        catch (err) {
          // Prevent crashing, log error.
          H5P.error(err);
        }
      };
      player.dnb.dialog.on('close', dialogCloseHandler);

      /**
       * Set dialog width of interaction and unregister dialog close listener
       * @private
       */
      var setDialogWidth = function () {
        self.dialogWidth = player.dnb.dialog.getDialogWidth();
        player.dnb.dialog.off('close', setDialogWidth);
      };

      // Keep dialog width when dialog closes.
      player.dnb.dialog.on('close', setDialogWidth);

      if (library === 'H5P.Image') {
        // Special case for fitting images
        var max = player.dnb.dialog.getMaxSize($interaction);

        var $img = $dialogContent.find('img');
        if (action.params.file.width && action.params.file.height) {
          // Use the image size info that is stored
          resizeImage($img, max, {
            width: action.params.file.width,
            height: action.params.file.height
          }, !player.isMobileView);
        }
        else {
          // Wait for image to load
          $img.load(function () {
            if ($img.is(':visible')) {
              resizeImage($img, max, {
                width: this.width,
                height: this.height
              }, !player.isMobileView);
            }
          });
          player.dnb.dialog.position($interaction);
        }
      }
      else {
        // Position dialog. Use medium dialog for all interactive dialogs.
        if (!player.isMobileView) {
          // Set size of dialog
          player.dnb.dialog.position($interaction, {width: self.dialogWidth / 16}, !(library === 'H5P.Text' || library === 'H5P.Table'));
        }
      }

      if (library === 'H5P.Summary') {
        // Scroll summary to bottom if the task changes size
        var lastHeight = 0;
        H5P.on(instance, 'resize', function () {
          var height = $dialogContent.height();
          if (lastHeight > height + 10 || lastHeight < height - 10)  {
            setTimeout(function () {
              player.dnb.dialog.scroll(height, 300);
            }, 500);
          }
          lastHeight = height;
        });
      }

      setTimeout(function () {
        H5P.trigger(instance, 'resize');
      }, 0);
    };

    /**
     * Resize the image so that it fits the available dialog space.
     *
     * @private
     * @param {H5P.jQuery} $img
     * @param {Object} max width,height in em
     * @param {Object} size width,height in px
     * @param {Boolean} positionDialog position dialog if true
     */
    var resizeImage = function ($img, max, size, positionDialog) {
      var fontSize = 16;
      size.width /= fontSize;
      size.height /= fontSize;

      if (size.height > max.height) {
        size.width = size.width * max.height / size.height;
        size.height = max.height;
      }
      if (size.width > max.width) {
        size.height = size.height * max.width / size.width;
        size.width = max.width;
      }

      var fontSizeRatio = 16 / Number($img.css('fontSize').replace('px',''));
      $img.css({
        width: (size.width * fontSizeRatio) + 'em',
        height: (size.height * fontSizeRatio) + 'em'
      });

      if (positionDialog) {
        // Set dialog size and position
        player.dnb.dialog.position($interaction, size);
      }
    };

    /**
     * Got to a given time code provided by an event
     *
     * @private
     * @param {Object} event
     * @param {number} event.data
     */
    var goto = function (event) {
      if (self.isButton()) {
        // Close dialog
        player.dnb.dialog.close();
      }
      if (player.currentState === H5P.Video.PAUSED ||
        player.currentState === H5P.Video.ENDED) {
        // Start playing again
        player.play();
      }

      // Jump to chosen timecode
      player.seek(event.data);
    };

    /**
     * Get the dimensions for the current interaction
     *
     * @method getDimensions
     * @return {Object}
     */
    var getDimensions = function () {
      var height = parameters.height || 10;
      var width = parameters.width || 10;

      if (library !== 'H5P.IVHotspot') {
        return {
          height: height + 'em',
          width: width + 'em'
        };
      }
      else {
        // Get original ratio of wrapper to font size of IV (default 40 x 22,5)
        // We can not rely on measuring font size.
        var widthRatio = player.width / player.fontSize;
        var heightRatio = widthRatio / (player.$videoWrapper.width() / player.$videoWrapper.height());

        return {
          height: ((height / heightRatio) * 100) + '%',
          width: ((width / widthRatio) * 100) + '%'
        };
      }
    };

    /**
     * Display the current interaction as a poster on top of the video.
     *
     * @private
     */
    var createPoster = function () {
      var isGotoClickable = self.isGotoClickable();
      var dimensions = getDimensions();
      var visuals = getVisuals();

      $interaction = $('<div/>', {
        'class': 'h5p-interaction h5p-poster ' + classes + (isGotoClickable && parameters.goto.visualize ? ' goto-clickable-visualize' : ''),
        css: {
          left: parameters.x + '%',
          top: parameters.y + '%',
          width: dimensions.width,
          height: dimensions.height
        }
      });

      if (library !== 'H5P.IVHotspot') {
        // Add background
        $interaction.css('background', visuals.backgroundColor);

        // Add transparency css
        var backgroundColors = visuals.backgroundColor.split(',');
        if (backgroundColors[3]) {
          var opacity = parseFloat(backgroundColors[3].replace(')', ''));
          if (opacity === 0) {
            $interaction.addClass('h5p-transparent-interaction');
          }
        }
      }

      if (visuals.boxShadow === false) {
        $interaction.addClass('h5p-box-shadow-disabled');
      }

      // Reset link interaction dimensions
      if (library === 'H5P.Link') {
        $interaction.css('height', 'auto');
        $interaction.css('width', 'auto');

        // Set link functionality on whole button
        if (player.editor === undefined) {
          $interaction.click(function () {
            window.open(instance.getUrl());
            player.pause();
            return false;
          });
        }
      }

      $outer = $('<div>', {
        'class': 'h5p-interaction-outer'
      }).appendTo($interaction);

      $inner = $(isGotoClickable && parameters.goto.type === 'url' ? '<a>' : '<div>', {
        'class': 'h5p-interaction-inner h5p-frame'
      }).appendTo($outer);

      if (player.editor !== undefined && instance.disableAutoPlay) {
        instance.disableAutoPlay();
      }

      var $instanceParent = isGotoClickable ? makeInteractionGotoClickable($inner) : $inner;
      instance.attach($instanceParent);
      addContinueButton($instanceParent);

      // Trigger event listeners
      self.trigger('display', $interaction);

      setTimeout(function () {
        H5P.trigger(instance, 'resize');
      }, 0);

      // Register that this interaction has started if it is a question
      if (typeof instance.setActivityStarted === 'function' && typeof instance.getScore === 'function') {
        instance.setActivityStarted();
      }
    };

    /**
     * Adds adaptivity or continue button to exercies.
     *
     * @private
     * @param {H5P.jQuery} $target
     */
    var adaptivity = function ($target) {

      var adaptivity, fullScore;
      if (parameters.adaptivity) {
        fullScore = self.score >= self.maxScore;

        // Determine adaptivity
        adaptivity = (fullScore ? parameters.adaptivity.correct : parameters.adaptivity.wrong);
      }

      if (!adaptivity || adaptivity.seekTo === undefined) {
        // Add continue button if no adaptivity
        if (instance.hasButton !== undefined) {
          if (!instance.hasButton('iv-continue')) {
            // Register continue button
            instance.addButton('iv-continue', player.l10n.defaultAdaptivitySeekLabel, function () {
              if (self.isButton()) {
                // Close dialog
                player.dnb.dialog.close();
              }
              else {
                if (player.isMobileView) {
                  player.dnb.dialog.close();
                }
                // Remove interaction posters
                $interaction.detach();
              }

              // Do not play if player is at the end, state 0 = ENDED
              if (player.currentState !== 0) {
                player.play();
              }
            });
          }
          else {
            instance.showButton('iv-continue');
          }
        }

        return;
      }

      // Stop playback
      player.pause();

      if (!adaptivity.allowOptOut && $interaction) {
        // Make sure only the interaction is useable.
        if (self.isButton()) {
          player.dnb.dialog.disableOverlay = true;
          player.dnb.dialog.hideCloseButton();
        }
        else {
          $interaction.css('zIndex', 52);
          player.$videoWrapper.addClass('h5p-disable-opt-out');
          player.dnb.dialog.openOverlay();
        }
      }

      var adaptivityId = (fullScore ? 'correct' : 'wrong');
      var adaptivityLabel = adaptivity.seekLabel ? adaptivity.seekLabel : player.l10n.defaultAdaptivitySeekLabel;

      // add and show adaptivity button, hide continue button
      instance.hideButton('iv-continue')
        .addButton('iv-adaptivity-' + adaptivityId, adaptivityLabel, function () {
          if (self.isButton()) {
            player.dnb.dialog.close();
          }
          if (!adaptivity.allowOptOut) {
            if (!self.isButton()) {
              player.dnb.dialog.closeOverlay();
              $interaction.css('zIndex', '');
              player.$videoWrapper.removeClass('h5p-disable-opt-out');
            }
          }

          // Reset interaction
          if (!fullScore && instance.resetTask) {
            instance.resetTask();
            instance.hideButton('iv-adaptivity-' + adaptivityId);
          }

          // Remove interaction
          self.remove();
          player.pause();
          player.seek(adaptivity.seekTo);
          player.play();
        }
      ).showButton('iv-adaptivity-' + adaptivityId, 1)
        .hideButton('check-answer', 1)
        .hideButton('show-solution', 1)
        .hideButton('try-again', 1);

      // Disable any input
      if (instance.disableInput !== undefined &&
          (instance.disableInput instanceof Function ||
           typeof instance.disableInput === 'function')) {
        instance.disableInput();
      }

      // Wait for any modifications Question does to feedback and buttons
      setTimeout(function () {
        // Set adaptivity message and hide interaction flow controls, strip adaptivity message of p tags
        instance.updateFeedbackContent(adaptivity.message.replace('<p>', '').replace('</p>', ''), true);
      }, 0);
    };

    /**
     * Determine css classes for interaction
     * @return {string} Css classes string separated by space
     */
    var determineClasses = function () {
      var classes = parameters.className;

      if (classes === undefined) {
        var classParts = action.library.split(' ')[0].toLowerCase().split('.');
        classes = classParts[0] + '-' + classParts[1] + '-interaction';
      }

      if (parameters.goto && parameters.goto.type === 'timecode') {
        classes += ' h5p-goto-timecode';
      }

      return classes;
    };

    /**
     * Check if interaction support linking on click
     *
     * @return {boolean} True if interaction has functionality for linking on click
     */
    self.isGotoClickable = function () {
      return ['H5P.Text', 'H5P.Image'].indexOf(library) !== -1 && parameters.goto && ['timecode', 'url'].indexOf(parameters.goto.type) !== -1;
    };

    /**
     * Extract the current state of interactivity for serialization.
     *
     * @returns {Object}
     */
    self.getCurrentState = function () {
      if (instance && (instance.getCurrentState instanceof Function ||
                       typeof instance.getCurrentState === 'function')) {
        return instance.getCurrentState();
      }
    };

    /**
     * Checks to see if the interaction should pause the video.
     *
     * @returns {boolean}
     */
    self.pause = function () {
      return parameters.pause;
    };

    /**
     * Check to see if interaction should be displayed as button.
     *
     * @returns {boolean}
     */
    self.isButton = function () {
      return parameters.displayType === 'button' || library === 'H5P.Nil' || (player.isMobileView && library !== 'H5P.IVHotspot');
    };

    /**
     * Checks if this is the end summary.
     *
     * @returns {boolean}
     */
    self.isMainSummary = function() {
      return parameters.mainSummary === true;
    };

    /**
     * Create dot for displaying above the video timeline.
     * Append to given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.addDot = function ($container) {
      if (library === 'H5P.Nil') {
        return; // Skip "sub titles"
      }

      var seekbarClasses = 'h5p-seekbar-interaction ' + classes;
      if (player.preventSkipping) {
        seekbarClasses += ' disabled';
      }

      // One could also set width using ((parameters.duration.to - parameters.duration.from + 1) * player.oneSecondInPercentage)
      $('<div/>', {
        'class': seekbarClasses,
        title: title,
        css: {
          left: (parameters.duration.from * player.oneSecondInPercentage) + '%'
        },
        on: {
          click: function () {
            if (player.preventSkipping) {
              return;
            }

            if (player.currentState === H5P.Video.VIDEO_CUED) {
              player.play();
              player.seek(parameters.duration.from);
            }
            else if (player.currentState === H5P.Video.PLAYING) {
              player.seek(parameters.duration.from);
            } else {
              player.play(); // for updating the slider
              player.seek(parameters.duration.from);
              player.pause();
            }
          }
        }
      }).appendTo($container);
    };

    /**
     * Display or remove the interaction depending on the video time.
     *
     * @param {number} second video time
     * @returns {H5P.jQuery} interaction button or container
     */
    self.toggle = function (second) {
      second = Math.floor(second);
      if (second < parameters.duration.from || second > parameters.duration.to) {
        if ($interaction) {
          // Remove interaction from display
          if (dnbElement) {
            dnbElement.hideContextMenu();
            if (dnbElement === player.dnb.focusedElement) {
              dnbElement.blur();
              delete player.dnb.focusedElement;
            }
          }
          if (player.editor && isHovered) {
            player.editor.hideInteractionTitle();
            isHovered = false;
          }
          self.remove();
        }
        return;
      }

      if ($interaction) {
        return; // Interaction already on display
      }

      if (self.isButton()) {
        createButton();
        isShownAsButton = true;
      }
      else {
        createPoster();
        isShownAsButton = false;
      }
      if (player.editor === undefined) {
        dnbElement = player.dnb.add($interaction, undefined, {dnbElement: dnbElement, disableContextMenu: true});
      }
      else {

        if (self.fit) {
          // Make sure player is inside video container
          player.editor.fit($interaction, parameters);
          self.fit = false;
        }

        // Pause video when interaction is focused
        $interaction.focus(function () {
          player.pause();
        });
      }

      return $interaction;
    };

    self.setTitle = function (customTitle) {
      if ($interaction) {
        $interaction.attr('aria-label', customTitle);
      }
      title = customTitle;
    };

    /**
     * Recreate interactions. Useful when an interaction or view has changed.
     */
    self.reCreateInteraction = function () {

      // Do not recreate IVHotspot since it should always be a poster
      if (library === 'H5P.IVHotspot') {
        return;
      }

      // Only recreate existing interactions
      if ($interaction) {
        $interaction.detach();

        if (self.isButton()) {
          createButton();
          isShownAsButton = true;
        } else {
          createPoster();
          isShownAsButton = false;
        }
      }
    };

    self.resizeInteraction = function () {
      if (library !== 'H5P.Nil') {
        H5P.trigger(instance, 'resize');
      }
    };

    /**
     * Position label to the left or right of the action button.
     *
     * @param {number} width Size of the container
     */
    self.positionLabel = function (width) {
      if (!$interaction || !self.isButton() || !$label || library === 'H5P.Nil') {
        return;
      }

      $label.removeClass('h5p-left-label');
      if (parseInt($interaction.css('left')) + $label.position().left + $label.outerWidth() > width) {
        $label.addClass('h5p-left-label');
      }
    };

    /**
     * Update element position.
     *
     * @param {number} x left
     * @param {number} y top
     */
    self.setPosition = function (x, y) {
      parameters.x = x;
      parameters.y = y;
      $interaction.css({
        'left': x + '%',
        'top': y + '%'
      });
    };

    /**
     * Update element size. This function is needed by the IV editor
     *
     * @param {number} width in ems
     * @param {number} height in ems
     */
    self.setSize = function (width, height) {
      if (width) {
        parameters.width = width;
      }
      if (height) {
        parameters.height = height;
      }

      H5P.trigger(instance, 'resize');
    };

    /**
     * Removes interaction from display.
     *
     * @param {boolean} [updateSize] Used when re-creating element
     */
    self.remove = function (updateSize) {
      if ($interaction) {
        // Let others reach to the hiding of this interaction
        self.trigger('domHidden', {
          '$dom': $interaction,
          'key': 'videoProgressedPast'
        }, {'bubbles': true, 'external': true});
        $interaction.detach();
        $interaction = undefined;
      }
    };

    /**
     * Create a new instance of the interaction.
     * Useful if the input parameters have changes.
     */
    self.reCreate = function () {
      classes = determineClasses();
      if (library !== 'H5P.Nil') {
        action.params = action.params || {};
        action.params.overrideSettings = action.params.overrideSettings || {};
        if (player.$container) {
          action.params.overrideSettings.$confirmationDialogParent = player.$container;
        }

        instance = H5P.newRunnable(action, player.contentId, undefined, undefined, {parent: player});

        // Set adaptivity if question is finished on attach
        if (instance.on) {

          // Handle question/task finished
          instance.on('xAPI', function (event) {
            if ((event.getMaxScore() && event.getScore() !== null) &&
                event.getVerb() === 'completed' ||
                event.getVerb() === 'answered') {
              self.score = event.getScore();
              self.maxScore = event.getMaxScore();
              adaptivity();
            }
            self.trigger(event);
          });
          instance.on('question-finished', function () {
            adaptivity();
          });

          instance.on('resize', function () {
            // Forget the static dialog width on resize
            delete self.dialogWidth;
            if (player && player.dnb) {
              player.dnb.dialog.removeStaticWidth();
            }
          });

          if (library === 'H5P.IVHotspot') {
            instance.on('goto', goto);
          }
          if (library === 'H5P.GoToQuestion') {
            instance.on('chosen', goto);
          }
        }
      }
    };

    /**
     * Set dnb element for interaction, connecting it to a dialog/form
     *
     * @param {H5P.DragNBarElement} newDnbElement
     * @returns {Boolean} True if a new DragNBarElement was set.
     */
    self.setDnbElement = function (newDnbElement) {
      if (dnbElement === newDnbElement) {
        return false;
      }
      dnbElement = newDnbElement;
      return true;
    };

    /**
     * Gets the name of the library used in the interaction.
     *
     * @returns {string}
     */
    self.getLibraryName = function () {
      return library;
    };

    /**
     * Returns the human readable label for the interaction.
     *
     * @returns {string}
     */
    self.getTitle = function () {
      return title;
    };

    /**
     * Get HTML class name
     *
     * @returns {string}
     */
    self.getClass = function () {
      return classes;
    };

    /**
     * Collect copyright information for the interaction.
     *
     * @returns {H5P.ContentCopyrights}
     */
    self.getCopyrights = function () {
      if (library === 'H5P.Nil') {
        return undefined;
      }

      var instance = H5P.newRunnable(action, player.contentId);

      if (instance !== undefined) {
        var interactionCopyrights = new H5P.ContentCopyrights();
        interactionCopyrights.addContent(H5P.getCopyrights(instance, parameters, player.contentId));
        interactionCopyrights.setLabel(title + ' ' + H5P.InteractiveVideo.humanizeTime(parameters.duration.from) + ' - ' + H5P.InteractiveVideo.humanizeTime(parameters.duration.to));
        return interactionCopyrights;
      }

      return undefined;
    };

    /**
     * Returns unique content id
     * @returns {String} Sub content Id
     */
    self.getSubcontentId = function () {
      return action.subContentId;
    };

    /**
     * Returns interaction element
     * @returns {*}
     */
    self.getElement = function () {
      return $interaction;
    };

    /**
     * Focus interaction element
     */
    self.focus = function () {
      if ($interaction) {
        $interaction.focus();
      }
    };

    /**
     * Create clipboard data object.
     * @returns {object}
     */
    self.getClipboardData = function () {
      return H5P.DragNBar.clipboardify(H5PEditor.InteractiveVideo.clipboardKey, parameters, 'action');
    };

    /**
     * Resize to fit wrapper so icon does not overflow
     * @param {H5P.jQuery} $wrapper
     */
    self.repositionToWrapper = function ($wrapper) {

      if ($interaction && library !== 'H5P.IVHotspot') {

        // Reset positions
        if (isRepositioned) {
          $interaction.css({
            'top': parameters.y + '%',
            'left': parameters.x + '%'
          });

          $interaction.css(self.isButton() ? {
            // Reset dimensions
            height: '',
            width: ''
          } : getDimensions()); // Posters reset to standard dimensions

          isRepositioned = false;
        }

        // Check if button overflows parent
        if ($interaction.position().top + $interaction.height() > $wrapper.height()) {
          var newTop = (($wrapper.height() - $interaction.height()) / $wrapper.height()) * 100;

          // We must reduce interaction height
          if (newTop < 0) {
            newTop = 0;
            var newHeight = $wrapper.height() / parseFloat($interaction.css('font-size'));
            $interaction.css('height', newHeight + 'em');
          }
          $interaction.css('top', newTop + '%');
          isRepositioned = true;
        }

        if ($interaction.position().left + $interaction.width() > $wrapper.width()) {
          var newLeft = (($wrapper.width() - $interaction.width()) / $wrapper.width()) * 100;

          // We must reduce interaction width
          if (newLeft < 0) {
            newLeft = 0;
            var newWidth = $wrapper.width() / parseFloat($interaction.css('font-size'));
            $interaction.css('width', newWidth + 'em');
          }

          $interaction.css('left', newLeft + '%');
          isRepositioned = true;
        }
      }
    };

    /**
     * Reset task.
     */
    self.resetTask = function () {
      if (action.userDatas !== undefined && action.userDatas.state !== undefined) {
        delete action.userDatas.state;
      }
      delete self.score;
      delete self.maxScore;

      self.reCreate();
    };

    // Create instance of content
    self.reCreate();
  }

  // Extends the event dispatcher
  Interaction.prototype = Object.create(EventDispatcher.prototype);
  Interaction.prototype.constructor = Interaction;

  /**
   * Tool for converting.
   *
   * @private
   * @type {H5P.jQuery}
   */
  var $converter = $('<div/>');

  return Interaction;
})(H5P.jQuery, H5P.EventDispatcher);
