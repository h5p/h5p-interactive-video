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

    var $interaction, $label;
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
    var classes = parameters.className;
    if (classes === undefined) {
      var classParts = action.library.split(' ')[0].toLowerCase().split('.');
      classes = classParts[0] + '-' + classParts[1] + '-interaction';
    }

    // Keep track of content instance
    var instance;

    // Only register listeners once
    var hasRegisteredListeners = false;

    /**
     * Display the current interaction as a button on top of the video.
     *
     * @private
     */
    var createButton = function () {
      $interaction = $('<div/>', {
        tabIndex: 0,
        role: 'button',
        'class': 'h5p-interaction ' + classes + ' h5p-hidden',
        css: {
          left: parameters.x + '%',
          top: parameters.y + '%'
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
          if (!$interaction.is(':focus')) {
            player.editor.showInteractionTitle(title, $interaction);
          } else {

            // Hide if interaction is focused, because of coordinates picker
            player.editor.hideInteractionTitle();
          }
        }, function () {

          // Hide on hover out
          player.editor.hideInteractionTitle();
        }).focus(function () {

          // Hide on focus, because of coord picker
          player.editor.hideInteractionTitle();
        });
      }

      // Check to see if we should add label
      if (library === 'H5P.Nil' || (parameters.label && $converter.html(parameters.label).text().length)) {
        $label = $('<div/>', {
          'class': 'h5p-interaction-label',
          html: parameters.label
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
     * Opens button dialog.
     *
     * @private
     */
    var openDialog = function () {
      // Create wrapper for dialog content
      var $dialogContent = $('<div/>', {
        'class': 'h5p-dialog-interaction h5p-frame'
      });

      // Attach instance to dialog and open
      instance.attach($dialogContent);

      // Open dialog
      player.dialog.open($dialogContent, title);
      player.dialog.addLibraryClass(library);

      if (library === 'H5P.Image') {
        // Special case for fitting images
        var max = player.dialog.getMaxSize($interaction, player.isMobileView);

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
          player.dialog.position($interaction);
        }
      }
      else if (!(library === 'H5P.Summary' || library === 'H5P.Blanks')) {
        // Only Summary and Blanks uses the dialog that covers the entire video
        player.dialog.position($interaction);
      }

      if (library === 'H5P.Summary') {
        // Scroll summary to bottom if the task changes size
        var lastHeight = 0;
        H5P.on(instance, 'resize', function () {
          var height = $dialogContent.height();
          if (lastHeight > height + 10 || lastHeight < height - 10)  {
            setTimeout(function () {
              player.dialog.scroll(height, 300);
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
        player.dialog.position($interaction, size);
      }
    };

    /**
     * Display the current interaction as a poster on top of the video.
     *
     * @private
     */
    var createPoster = function () {
      $interaction = $('<div/>', {
        'class': 'h5p-interaction h5p-poster ' + classes + '',
        css: {
          left: parameters.x + '%',
          top: parameters.y + '%',
          width: (parameters.width ? parameters.width : 10) + 'em',
          height: (parameters.height ? parameters.height : 10) + 'em'
        }
      });

      // Reset link interaction dimensions
      if (library === 'H5P.Link') {
        $interaction.css('height', 'auto');
        $interaction.css('width', 'auto');

        // Set link functionality on whole button
        if (player.editor === undefined) {
          $interaction.click(function () {
            window.open(parameters.action.params.url);
            player.pause();
            return false;
          });
        }
      }

      $inner = $('<div/>', {
        'class': 'h5p-interaction-inner h5p-frame'
      }).appendTo($interaction);
      instance.attach($inner);

      // Trigger event listeners
      self.trigger('display', $interaction);

      setTimeout(function () {
        H5P.trigger(instance, 'resize');
      }, 0);
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
                player.dialog.close();
              } else {
                if (player.isMobileView) {
                  player.dialog.close();
                }
                // Remove interaction posters
                $interaction.remove();
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

      if (!adaptivity.allowOptOut) {
        // Make sure only the interaction is useable.
        if (self.isButton()) {
          player.dialog.disableOverlay = true;
          player.dialog.hideCloseButton();
        }
        else {
          $interaction.css('zIndex', 52);
          player.dialog.openOverlay();
        }
      }

      var adaptivityId = (fullScore ? 'correct' : 'wrong');
      var adaptivityLabel = adaptivity.seekLabel ? adaptivity.seekLabel : player.l10n.defaultAdaptivitySeekLabel;

      // add and show adaptivity button, hide continue button
      instance.hideButton('iv-continue')
        .addButton('iv-adaptivity-' + adaptivityId, adaptivityLabel, function () {
          if (self.isButton() || player.isMobileView) {
            player.dialog.close();
          }
          if (!adaptivity.allowOptOut) {
            if (!self.isButton()) {
              player.dialog.closeOverlay();
              $interaction.css('zIndex', '');
            }
          }

          // Reset interaction
          instance.hideButton('iv-adaptivity-' + adaptivityId);
          if (!fullScore && instance.resetTask) {
            instance.resetTask();
          }

          // Remove interaction
          self.remove();
          player.seek(adaptivity.seekTo);
          player.play();
        }
      ).showButton('iv-adaptivity-' + adaptivityId);

      // Disable any input
      if (instance.disableInput !== undefined &&
          (instance.disableInput instanceof Function ||
           typeof instance.disableInput === 'function')) {
        instance.disableInput();
      }

      // Wait for any modifications Question does to feedback and buttons
      setTimeout(function () {
        // Set adaptivity message and hide interaction flow controls, strip adaptivity message of p tags
        instance.updateFeedbackContent(adaptivity.message.replace('<p>', '').replace('</p>', ''), true)
          .hideButton('check-answer')
          .hideButton('show-solution')
          .hideButton('try-again');
      }, 0);
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
      return parameters.displayType === 'button' || library === 'H5P.Nil';
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

      // One could also set width using ((parameters.duration.to - parameters.duration.from + 1) * player.oneSecondInPercentage)
      $('<div/>', {
        'class': 'h5p-seekbar-interaction ' + classes,
        title: title,
        css: {
          left: (parameters.duration.from * player.oneSecondInPercentage) + '%'
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
      if (second < parameters.duration.from || second > parameters.duration.to) {
        if ($interaction) {
          // Remove interaction from display
          self.remove();
        }
        return;
      }

      if ($interaction) {
        return; // Interaction already on display
      }

      if (self.isButton() || player.isMobileView) {
        createButton();
      }
      else {
        createPoster();
      }

      // Make sure listeners are only registered once
      if (!hasRegisteredListeners && library !== 'H5P.Nil') {
        instance.on('xAPI', function (event) {
          if (!event.getMaxScore() ||
            event.getScore() === null) {
            return;
          }
          if (event.getVerb() === 'completed' ||
            event.getVerb() === 'answered') {
            self.score = event.getScore();
            self.maxScore = event.getMaxScore();
            self.trigger(event);
            adaptivity($interaction);
          }
        });

        hasRegisteredListeners = true;
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
      // Only recreate existing interactions
      if ($interaction) {
        $interaction.detach();

        if (self.isButton() || player.isMobileView) {
          createButton();
        } else {
          createPoster();
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
    };

    /**
     * Update element size. This function is needed by the IV editor
     *
     * @param {number} width in ems
     * @param {number} height in ems
     */
    self.setSize = function (width, height) {
      parameters.width = width;
      parameters.height = height;

      H5P.trigger(instance, 'resize');
    };

    /**
     * Removes interaction from display.
     *
     * @param {boolean} [updateSize] Used when re-creating element
     */
    self.remove = function (updateSize) {
      if ($interaction) {
        $interaction.detach();
        $interaction = undefined;
      }
    };

    /**
     * Create a new instance of the interaction.
     * Useful if the input parameters have changes.
     */
    self.reCreate = function () {
      if (library !== 'H5P.Nil') {
        instance = H5P.newRunnable(action, player.contentId, undefined, undefined, {parent: player});
      }
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

      var interactionCopyrights;
      if (instance !== undefined && instance.getCopyrights !== undefined) {
        interactionCopyrights = instance.getCopyrights();
      }
      else if (instance !== undefined) {
        interactionCopyrights = H5P.getCopyrights(instance, parameters, player.contentId);
      }
      if (interactionCopyrights !== undefined) {
        interactionCopyrights.setLabel(title + ' ' + H5P.InteractiveVideo.humanizeTime(parameters.duration.from) + ' - ' + H5P.InteractiveVideo.humanizeTime(parameters.duration.to));
        return interactionCopyrights;
      }
      return undefined;
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
