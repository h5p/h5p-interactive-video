/** @namespace H5P */
H5P.InteractiveVideoDialog = (function ($, EventDispatcher) {

  /**
   * Controls the dialog in the interactive video.
   *
   * @class
   * @param {jQuery} $container for dialog
   * @param {jQuery} $videoWrapper needed for positioning of dialog
   */
  function Dialog($container, $videoWrapper) {
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Create DOM elements for dialog
    var $wrapper = $('<div/>', {
      'class': 'h5p-dialog-wrapper h5p-ie-transparent-background h5p-hidden',
      on: {
        click: function () {
          if (!self.disableOverlay)  {
            self.close();
          }
        }
      }
    });
    var $dialog = $('<div/>', {
      'class': 'h5p-dialog h5p-big',
      on: {
        click: function (event) {
          event.stopPropagation();
        }
      }
    }).appendTo($wrapper);

    // Create inner DOM elements for dialog
    var $inner = $('<div/>', {
      'class': 'h5p-dialog-inner'
    }).appendTo($dialog);
    var $close = $('<a/>', {
      href: '#',
      'class': 'h5p-dialog-hide',
      html: '&#xf00d;',
      on: {
        click: function () {
          self.close();
          return false;
        }
      }
    }).appendTo($dialog);
    var $customButtons;

    // Add all to DOM
    $wrapper.appendTo($container);

    /**
     * Reset the dialog's positioning
     *
     * @private
     */
    var resetPosition = function () {
      // Reset positioning
      $dialog.css({
        left: '',
        top: '',
        height: '',
        width: '',
        fontSize: ''
      });
      $inner.css({
        'width': '',
        'height': ''
      });
    };

    /**
     * Display overlay.
     *
     * @private
     * @param {Function} next callback
     */
    var showOverlay = function (next) {
      $wrapper.show();
      setTimeout(function () {
        // Remove class on next tick to ensure css animation
        $wrapper.removeClass('h5p-hidden');
        if (next) {
          next();
        }
      }, 0);
    };

    /**
     * Close overlay.
     *
     * @private
     * @param {Function} next callback
     */
    var hideOverlay = function (next) {
      $wrapper.addClass('h5p-hidden');
      setTimeout(function () {
        // Hide when animation is done
        $wrapper.hide();
        if (next) {
          next();
        }
      }, 200);
    };

    /**
     * Opens a new dialog. Displays the given element.
     *
     * @public
     * @param {jQuery} $element
     * @param {jQuery} [$buttons] Use custom buttons for dialog
     */
    self.open = function ($element, $buttons) {
      showOverlay();
      $inner.html('').append($element);

      // Reset positioning
      resetPosition();
      $dialog.addClass('h5p-big');

      if ($customButtons) {
        // Clean up after previous custom buttons
        $customButtons.remove();
        $close.show();
      }
      if ($buttons) {
        $customButtons = $buttons;

        // Hide default close button
        $close.hide();

        // Add custom buttons
        $dialog.append($buttons);
        var fontSize = toNum($inner.css('fontSize'));
        $inner.css({
          width: '100%',
          height: (($inner.height() / fontSize) - ($buttons.height() / fontSize)) + 'em'
        });
      }

      self.trigger('open');
    };

    /**
     * Adds a name to the dialog for identifying what it contains.
     *
     * @public
     * @param {string} machineName Name of library inside dialog.
     */
    self.addLibraryClass = function (machineName) {
      $dialog.attr('data-lib', machineName);
    };

    self.isOpen = function () {
      return $wrapper.is(':visible');
    };

    /**
     * Reposition the currently open dialog relative to the given button.
     *
     * @public
     * @param {jQuery} $button
     * @param {Object} [size] Sets a size for the dialog, useful for images.
     */
    self.position = function ($button, size) {
      resetPosition();
      $dialog.removeClass('h5p-big');

      if (size) {
        var fontSizeRatio = 16 / toNum($container.css('fontSize'));
        size.width = (size.width * fontSizeRatio) + 1.5; // padding for close button
        size.height = (size.height * fontSizeRatio);

        // Use a fixed size
        $dialog.css({
          width: size.width + 'em',
          height: size.height + 'em'
        });
        $inner.css('width', 'auto');
      }

      var buttonWidth = $button.outerWidth(true);
      var buttonPosition = $button.position();
      var containerWidth = $container.width();
      var containerHeight = $container.height();

      // Position dialog horizontally
      var left = buttonPosition.left;
      var dialogWidth = $dialog.outerWidth(true);

      if (dialogWidth > containerWidth) {
        // If dialog is too big to fit within the container, display as h5p-big instead.
        $dialog.addClass('h5p-big');
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

      var marginLeft = parseInt($videoWrapper.css('marginLeft'));
      if (isNaN(marginLeft)) {
        marginLeft = 0;
      }

      // And finally, make sure we're within bounds on the left hand side too...
      if (left < marginLeft) {
        left = marginLeft;
      }

      // Position dialog vertically
      var marginTop = parseInt($videoWrapper.css('marginTop'));
      if (isNaN(marginTop)) {
        marginTop = 0;
      }

      var top = buttonPosition.top + marginTop;
      var totalHeight = top + $dialog.outerHeight(true);
      if (totalHeight > containerHeight) {
        top -= totalHeight - containerHeight;
      }

      // Set dialog size
      $dialog.css({
        top: (top / (containerHeight / 100)) + '%',
        left: (left / (containerWidth / 100)) + '%'
      });
    };

    /**
     * Find max available space inside dialog when positioning relative to
     * given button.
     *
     * @public
     * @param {jQuery} $button
     * @returns {Object} Attrs: width, height
     */
    self.getMaxSize = function ($button) {
      var buttonWidth = $button.outerWidth(true);
      var buttonPosition = $button.position();
      var containerWidth = $container.width();
      var containerHeight = $container.height();
      var interactionMaxFillRatio = 0.8;

      var max = {};
      if (buttonPosition.left > (containerWidth / 2) - (buttonWidth / 2)) {
        // Space to the left of the button minus margin
        max.width = buttonPosition.left * (1 - (1 - interactionMaxFillRatio) / 2);
      }
      else {
        // Space to the right of the button minus margin
        max.width = (containerWidth - buttonPosition.left - buttonWidth) * (1 - (1 - interactionMaxFillRatio) / 2);
      }
      max.height = containerHeight * interactionMaxFillRatio;

      // Use em
      var fontSize = toNum($container.css('fontSize'));
      max.width = (max.width / fontSize) * (fontSize / 16);
      max.height = (max.height / fontSize) * (fontSize / 16);

      return max;
    };

    /**
     * Scroll to given position in current dialog.
     *
     * @public
     * @param {Number} to Scroll position
     * @param {Number} ms Time the animation takes.
     */
    self.scroll = function (to, ms) {
      $inner.stop().animate({
        scrollTop: to
      }, ms);
    };

    /**
     * Close the currently open dialog.
     *
     * @public
     */
    self.close = function () {
      $wrapper.addClass('h5p-hidden');


      setTimeout(function () {
        $wrapper.hide();
        self.disableOverlay = false;
        $close.show();
      }, 201);

      self.trigger('close');
    };

    /**
     * Open overlay only.
     *
     * @public
     */
    self.openOverlay = function () {
      self.disableOverlay = true;
      $dialog.hide();
      showOverlay();
    };

    /**
     * Close overlay only.
     *
     * @public
     */
    self.closeOverlay = function () {
      $wrapper.addClass('h5p-hidden');
      hideOverlay(function () {
        $dialog.show();
        self.disableOverlay = false;
      });
    };

    /**
     * Removes the close button from the current dialog.
     *
     * @public
     */
    self.hideCloseButton = function () {
      $close.hide();
    };
  }

  // Extends the event dispatcher
  Dialog.prototype = Object.create(EventDispatcher.prototype);
  Dialog.prototype.constructor = Dialog;

  /**
   * @private
   */
  var toNum = function (num) {
    return Number(num.replace('px',''));
  };

  return Dialog;
})(H5P.jQuery, H5P.EventDispatcher);
