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
          // TODO: Do not close for editor?
          self.close();
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
     * Opens a new dialog. Displays the given element.
     *
     * @public
     * @param {jQuery} $element
     * @param {jQuery} [$buttons] Use custom buttons for dialog
     */
    self.open = function ($element, $buttons) {
      $wrapper.show();
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
          height: (($inner.height() / fontSize) - ($buttons.height() / fontSize)) + 'em',
        });
      }

      // Remove class on next tick to ensure css animation
      setTimeout(function () {
        $wrapper.removeClass('h5p-hidden');
      }, 1);

      self.trigger('open');
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
          height: size.height + 'em',
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
     * Close the currently open dialog.
     *
     * @public
     */
    self.close = function () {
      $wrapper.addClass('h5p-hidden');

      setTimeout(function () {
        $wrapper.hide();
      }, 201);

      self.trigger('close');
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
