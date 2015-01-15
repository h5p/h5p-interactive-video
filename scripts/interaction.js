/** @namespace H5P */
H5P.InteractiveVideoInteraction = (function ($, EventDispatcher) {

  /**
   * Keeps control of interactions in the interactive video.
   *
   * @class
   * @param {Object} parameters describes action behavior
   * @param {H5P.InteractiveVideoDialog} dialog instance
   * @param {String} defaultInteractionLabel localization
   * @param {Number} oneSecondInPercentage
   * @param {Number} contentId
   */
  function Interaction(parameters, dialog, defaultInteractionLabel, oneSecondInPercentage, contentId) {
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    var $interaction;
    var action = parameters.action;

    // Find library name and title
    var library = action.library.split(' ')[0];
    var title = (action.params.contentName !== undefined ? action.params.contentName : defaultInteractionLabel);

    // Detect custom html class for interaction.
    var classes = parameters.className;
    if (classes === undefined) {
      var classParts = action.library.split(' ')[0].toLowerCase().split('.');
      classes = classParts[0] + '-' + classParts[1] + '-interaction';
    }

    /**
     * Display the current interaction as a button on top of the video.
     *
     * @private
     */
    var createButton = function () {
      $interaction = $('<div/>', {
        'class': 'h5p-interaction ' + classes + ' h5p-hidden',
        css: {
          left: parameters.x + '%',
          top: parameters.y + '%'
        },
        html: '<a href="#" class="h5p-interaction-button"></a>',
        on: {
          click: function () {
            openDialog();
          }
        }
      });

      // Check to see if we should add label
      var $label;
      if (library === 'H5P.Nil' || (parameters.label && $converter.html(parameters.label).text().length)) {
        $label = $('<div/>', {
          'class': 'h5p-interaction-label',
          html: parameters.label
        }).appendTo($interaction);
      }

      // TODO
      // if (this.editor !== undefined) {
      //   // Append editor magic
      //   this.editor.newInteraction($interaction);
      // }

      setTimeout(function () {
        // Transition in
        $interaction.removeClass('h5p-hidden');

        // Position label
        if (library !== 'H5P.Nil' && $label) {
          $label.removeClass('h5p-left-label');
          // TODO: Fix label pos
          // if (parseInt($interaction.css('left')) + $label.position().left + $label.outerWidth() > this.$videoWrapper.width()) {
          //   $label.addClass('h5p-left-label');
          // }
        }
      }, 1);
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

      // Add new instance to dialog and open
      instance = H5P.newRunnable(parameters.action, contentId, $dialogContent);
      dialog.open($dialogContent);

      if (library === 'H5P.Image') {
        // Special case for fitting images
        var max = dialog.getMaxSize($interaction);

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
          dialog.position($interaction);
        }
      }
      else if (!(library === 'H5P.Summary' || library === 'H5P.Blanks')) {
        // Only Summary and Blanks uses the dialog that covers the entire video
        dialog.position($interaction);
      }

      // TODO: Check if this is needed for any content types
      // if (instance.$ !== undefined) {
      //   instance.$.trigger('resize');
      // }

      if (library === 'H5P.Summary') {
        // Scroll summary to bottom if the task changes size
        var lastHeight = 0;
        instance.$.on('resize', function () {
          var height = $dialogContent.height();
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
    };

    /**
     * Resize the image so that it fits the available dialog space.
     *
     * @private
     * @param {jQuery} $img
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

      fontSizeRatio = 16 / Number($img.css('fontSize').replace('px',''));
      $img.css({
        width: (size.width * fontSizeRatio) + 'em',
        height: (size.height * fontSizeRatio) + 'em',
      });

      // Set dialog size and position
      dialog.position($interaction, size);
    };

    /**
     * Checks to see if the interaction should pause the video.
     *
     * @public
     * @returns {Boolean}
     */
    self.pause = function () {
      return interaction.pause;
    };

    /**
     * Create dot for displaying above the video timeline.
     * Append to given container.
     *
     * @public
     * @param {jQuery} $container
     */
    self.addDot = function ($container) {
      if (library === 'H5P.Nil') {
        return; // Skip "sub titles"
      }

      // One could also set width using ((parameters.duration.to - parameters.duration.from + 1) * oneSecondInPercentage)
      $('<div/>', {
        'class': 'h5p-seekbar-interaction ' + classes,
        title: title,
        css: {
          left: (parameters.duration.from * oneSecondInPercentage) + '%'
        }
      }).appendTo($container);
    };


    /**
     * Display or remove the interaction depending on the video time.
     *
     * @public
     * @param {Number} second video time
     * @returns {jQuery} interaction button or container
     */
    self.toggle = function (second) {
      if (second < parameters.duration.from || second > parameters.duration.to) {
        if ($interaction) {
          // Remove interaction from display
          $interaction.remove();
          $interaction = undefined;
        }
        return;
      }

      if ($interaction) {
        return; // Interaction already on display
      }

      if (parameters.displayAsButton === undefined || parameters.displayAsButton) {
        createButton();
      }
      else {
        console.log('Not displaying as button!');
        // TODO
      }

      return $interaction;
    };

    /**
     * Collect copyright information for the interaction.
     *
     * @public
     * @returns {H5P.ContentCopyrights}
     */
    self.getCopyrights = function () {
      var instance = H5P.newRunnable(parameters.action, contentId);

      if (instance !== undefined && instance.getCopyrights !== undefined) {
        var interactionCopyrights = instance.getCopyrights();
        if (interactionCopyrights !== undefined) {
          interactionCopyrights.setLabel(title + ' ' + humanizeTime(parameters.duration.from) + ' - ' + humanizeTime(parameters.duration.to));
          return interactionCopyrights;
        }
      }
    };
  }

  // Extends the event dispatcher
  Interaction.prototype = Object.create(EventDispatcher.prototype);
  Interaction.prototype.constructor = Interaction;

  // Tool for converting
  var $converter = $('<div/>');

  /** @constant {number} */
  var FONT_SIZE = 16;

  return Interaction;
})(H5P.jQuery, H5P.EventDispatcher);
