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

    var $interaction, $label, $continueButton;
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

    /**
     * Display the current interaction as a button on top of the video.
     *
     * @private
     */
    var createButton = function () {
      $interaction = $('<div/>', {
        tabIndex: 0,
        role: 'button',
        'class': 'h5p-interaction ' + classes + ' h5p-hidden',
        css: {
          left: parameters.x + '%',
          top: parameters.y + '%'
        },
        on: {
          click: function () {
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
      $('<div/>', {
        'class': 'h5p-interaction-button'
      }).appendTo($interaction);

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
        'class': 'h5p-dialog-interaction'
      });

      // Attach instance to dialog and open
      instance.attach($dialogContent);
      player.dialog.open($dialogContent);
      player.dialog.addLibraryClass(library);

      if (library === 'H5P.Image') {
        // Special case for fitting images
        var max = player.dialog.getMaxSize($interaction);

        var $img = $dialogContent.find('img');
        if (action.params.file.width && action.params.file.height) {
          // Use the image size info that is stored
          resizeImage($img, max, {
            width: action.params.file.width,
            height: action.params.file.height
          });
        }
        else {
          // Wait for image to load
          $img.load(function () {
            if ($img.is(':visible')) {
              resizeImage($img, max, {
                width: this.width,
                height: this.height
              });
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

     processInstance($dialogContent, instance);
    };

    /**
     * Resize the image so that it fits the available dialog space.
     *
     * @private
     * @param {H5P.jQuery} $img
     * @param {Object} max width,height in em
     * @param {Object} size width,height in px
     */
    var resizeImage = function ($img, max, size) {
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

      // Set dialog size and position
      player.dialog.position($interaction, size);
    };

    /**
     * Display the current interaction as a poster on top of the video.
     *
     * @private
     */
    var createPoster = function () {
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
        'class': 'h5p-interaction-inner'
      }).appendTo($interaction);
      instance.attach($inner);

      // Trigger event listeners
      self.trigger('display', $interaction);

      processInstance($inner, instance);
    };

    /**
     * Resizes the interaction at the next tick.
     * Binds event listeners.
     *
     * @private
     */
    var processInstance = function ($target, instance) {
      // Resize on next tick
      setTimeout(function () {
        H5P.trigger(instance, 'resize');
      }, 0);
      H5P.on(instance, 'xAPI', function (event) {
        if (!$.inArray(event.getVerb(), ['completed', 'answered']) ||
            !event.getMaxScore() ||
            event.getScore() === null) {
          return;
        }
        self.score = event.getScore();
        self.maxScore = event.getMaxScore();
        event.setVerb('answered');
        self.trigger(event);
        adaptivity($target);
      });
    };

    /**
     * Makes it easy to create buttons.
     *
     * @private
     * @param {H5P.jQuery} $container Where to append the button
     * @param {string} label Html
     * @param {function} handler What to do when clicked
     * @returns {H5P.jQuery}
     */
    var addButton = function ($container, label, handler) {
      return H5P.JoubelUI.createButton({
        tabIndex: 0,
        role: 'button',
        html: label,
        on: {
          click: function () {
            handler();
          },
          keypress: function (event) {
            if ((event.charCode || event.keyCode) === 32) {
              handler(); // Buttons must react to space
            }
          }
        },
        appendTo: $container
      });
    };

    /**
     * Adds adaptivity or continue button to exercies.
     *
     * @private
     * @param {H5P.jQuery} $target
     */
    var adaptivity = function ($target) {

      var adaptivity;
      if (parameters.adaptivity) {
        var fullScore = self.score >= self.maxScore;

        // Determine adaptivity
        adaptivity = (fullScore ? parameters.adaptivity.correct : parameters.adaptivity.wrong);
      }

      if (!adaptivity || adaptivity.seekTo === undefined) {
        // Add continue button if no adaptivity
        if (!$continueButton) {
          // Try to find suitable container
          var $container = $target.find('.h5p-show-solution-container'); // MC
          if (!$container.length) {
            $container = $target.find('.h5p-button-bar'); // B
          }
          if (!$container.length) {
            $container = $target.find('.h5p-drag-button-bar'); // DW
          }
          if (!$container.length) {
            $container = $target.find('.h5p-sc-set-results'); // SC
          }
          if (!$container.length) {
            $container = $target.find('.h5p-inner:first'); // DD
          }
          if ($container.length) {
            $continueButton = addButton($container, player.l10n.defaultAdaptivitySeekLabel, function () {
              if (self.isButton()) {
                // Close dialog
                player.dialog.close();
              }
              else {
                // Remove interaction posters
                $interaction.remove();
              }

              // Remove continue button
              $continueButton.remove();
              $continueButton = undefined;

              // Do not play if player is at the end, state 0 = ENDED
              if (player.currentState !== 0) {
                player.play();
              }
            });
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

      // Detach interaction elements to keep their bindings/events
      $target.children().detach();

      // Replace interaction with adaptivity screen
      var $adap = $('<div/>', {
        'class': 'h5p-iv-adap',
        html: adaptivity.message,
        appendTo: $target
      });

      // Add continue button
      addButton($adap, (adaptivity.seekLabel ? adaptivity.seekLabel : player.l10n.defaultAdaptivitySeekLabel), function () {
        if (self.isButton()) {
          player.dialog.close();
        }
        if (!adaptivity.allowOptOut) {
          if (!self.isButton()) {
            player.dialog.closeOverlay();
            $interaction.css('zIndex', '');
          }
        }

        self.remove();
        player.seek(adaptivity.seekTo);
        player.play();
      });
    };

    /**
     * Extract the current state of interactivity for serialization.
     *
     * @returns {Object}
     */
    self.getCurrentState = function () {
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

      if (self.isButton()) {
        createButton();
      }
      else {
        createPoster();
      }

      return $interaction;
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
     * Update element size.
     *
     * @param {number} width in ems
     * @param {number} height in ems
     */
    self.setSize = function (width, height) {
      parameters.width = width;
      parameters.height = height;

      if (library === 'H5P.DragQuestion') {
        // Re-create element to set new size
        self.remove(true);
        self.toggle(parameters.from);
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
        if (updateSize && library === 'H5P.DragQuestion') {
          // Update size
          var size = action.params.question.settings.size;
          var fontSize = Number($interaction.css('fontSize').replace('px', ''));
          if (self.isButton()) {
            // Update element size with drag question parameters
            parameters.width = size.width / fontSize;
            parameters.height = size.height / fontSize;
          }
          else {
            // Update drag question parameters with size set on element
            size.width = Math.round(parameters.width * fontSize);
            size.height = Math.round(parameters.height * fontSize);
          }
        }

        $interaction.remove();
        $interaction = undefined;
      }
    };

    /**
     * Create a new instance of the interaction.
     * Useful if the input parameters have changes.
     */
    self.reCreate = function () {
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

      if (instance !== undefined && instance.getCopyrights !== undefined) {
        var interactionCopyrights = instance.getCopyrights();
      } else if (instance !== undefined) {
        var interactionCopyrights = H5P.getCopyrights(instance, parameters, player.contentId);
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
