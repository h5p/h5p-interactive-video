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
      $inner.css('width', '');
    };

    /**
     * Opens a new dialog. Displays the given element.
     *
     * @public
     * @param {jQuery} $element
     */
    self.open = function ($element) {
      $wrapper.show();
      $inner.html('').append($element);

      // Reset positioning
      resetPosition();
      $dialog.addClass('h5p-big');

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
        // Add padding
        size.width += toNum($dialog.css('paddingLeft')) + toNum($dialog.css('paddingRight'));
        size.height += toNum($dialog.css('paddingTop')) + toNum($dialog.css('paddingBottom'));

        // Use a fixed size
        $dialog.css(size);
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
        max.width = buttonPosition.left * (1 - (1 - interactionMaxFillRatio)/2);
      }
      else {
        // Space to the right of the button minus margin
        max.width = (containerWidth - buttonPosition.left - buttonWidth) * (1 - (1 - interactionMaxFillRatio)/2);
      }
      max.height = containerHeight * interactionMaxFillRatio;

      // Subtract dialog padding
      max.width -= toNum($dialog.css('paddingLeft')) + toNum($dialog.css('paddingRight'));
      max.height -= toNum($dialog.css('paddingTop')) + toNum($dialog.css('paddingBottom'));

      // Use em
      max.width /= FONT_SIZE;
      max.height /= FONT_SIZE;

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

  /** @constant {number} */
  var FONT_SIZE = 16;

  /**
   * @private
   */
  var toNum = function (num) {
    return Number(num.replace('px',''));
  };

  return Dialog;
})($, H5P.EventDispatcher);
