/**
 * Creates a new speech bubble
 *
 * @param {H5P.jQuery} $container The speaking object
 * @param {string} text The text to display
 * @param {number} maxWidth The maximum width of the bubble
 * @return {InteractiveVideo.Bubble}
 */
function Bubble($container, text, maxWidth) {
  'use strict';
  const $ = H5P.jQuery;
  const iDevice = navigator.userAgent.match(/iPod|iPhone|iPad/g) ? true : false;

  /**
   * Calculate position for speech bubble
   *
   * @param {number} bubbleWidth The width of the speech bubble
   * @param {object} offset
   * @return {object} Return position for the speech bubble
   */
  const getBubblePosition = function (bubbleWidth, offset) {
    var bubblePosition = {};

    var tailOffset = 4;
    var widthOffset = bubbleWidth / 2;

    // Calculate top position
    bubblePosition.top = offset.top + offset.innerHeight;

    // Calculate bottom position
    bubblePosition.bottom = offset.bottom + offset.innerHeight + tailOffset;

    // Calculate left position
    if (offset.left < widthOffset) {
      bubblePosition.left = 3;
    }
    else if ((offset.left + widthOffset) > offset.outerWidth) {
      bubblePosition.left = offset.outerWidth - bubbleWidth - 3;
    }
    else {
      bubblePosition.left = offset.left - widthOffset + (offset.innerWidth / 2);
    }

    return bubblePosition;
  };

  /**
   * Calculate position for speech bubble tail
   *
   * @param {number} bubbleWidth The width of the speech bubble
   * @param {object} bubblePosition Speech bubble position
   * @param {object} offset
   * @param {number} iconWidth The width of the tip icon
   * @return {object} Return position for the tail
   */
  const getTailPosition = function (bubbleWidth, bubblePosition, offset, iconWidth) {
    var tailPosition = {};
    // Magic numbers. Tuned by hand so that the tail fits visually within
    // the bounds of the speech bubble.
    var leftBoundary = 9;
    var rightBoundary = bubbleWidth - 20;

    tailPosition.left = offset.left - bubblePosition.left + (iconWidth / 2) - 6;
    if (tailPosition.left < leftBoundary) {
      tailPosition.left = leftBoundary;
    }
    if (tailPosition.left > rightBoundary) {
      tailPosition.left = rightBoundary;
    }

    tailPosition.top = -6;
    tailPosition.bottom = -6;

    return tailPosition;
  };

  /**
   * Return bubble CSS for the desired growth direction
   *
   * @param {string} direction The direction the speech bubble will grow
   * @param {number} width The width of the speech bubble
   * @param {object} position Speech bubble position
   * @param {number} fontSize The size of the bubbles font
   * @return {object} Return CSS
   */
  const bubbleCSS = function (direction, width, position, fontSize) {
    if (direction === 'top') {
      return {
        width: width + 'px',
        bottom: position.bottom + 'px',
        left: position.left + 'px',
        fontSize: fontSize + 'px'
      };
    }
    else {
      return {
        width: width + 'px',
        top: position.top + 'px',
        left: position.left + 'px',
        fontSize: fontSize + 'px'
      };
    }
  };

  /**
   * Return tail CSS for the desired growth direction
   *
   * @param {string} direction The direction the speech bubble will grow
   * @param {object} position Tail position
   * @return {object} Return CSS
   */
  const tailCSS = function (direction, position) {
    if (direction === 'top') {
      return {
        bottom: position.bottom + 'px',
        left: position.left + 'px'
      };
    }
    else {
      return {
        top: position.top + 'px',
        left: position.left + 'px'
      };
    }
  };

  /**
   * Calculates the offset between an element inside a container and the
   * container. Only works if all the edges of the inner element is inside the
   * outer element.
   * Width/height of the elements is included as a convenience.
   *
   * @param {H5P.jQuery} $outer
   * @param {H5P.jQuery} $inner
   * @return {object} Position offset
   */
  const getOffsetBetween = function ($outer, $inner) {
    var outer = $outer[0].getBoundingClientRect();
    var inner = $inner[0].getBoundingClientRect();

    return {
      top: inner.top - outer.top,
      right: outer.right - inner.right,
      bottom: outer.bottom - inner.bottom,
      left: inner.left - outer.left + parseInt($inner.css('marginLeft')),
      innerWidth: inner.width,
      innerHeight: inner.height,
      outerWidth: outer.width,
      outerHeight: outer.height
    };
  };

  // Create bubble

  var $tail = $('<div class="h5p-interactive-video-bubble-tail"></div>');
  var $innerTail = $('<div class=".h5p-interactive-video-bubble-inner-tail"></div>');
  var $innerBubble = $(
    '<div class="h5p-interactive-video-bubble-inner">' +
      '<div class="h5p-interactive-video-bubble-text">' + text + '</div>' +
    '</div>'
  ).prepend($innerTail);

  let $h5pContainer = $container.closest('.h5p-frame');
  // Check closest h5p frame first, then check for container in case there is no frame.
  if (!$h5pContainer.length) {
    $h5pContainer = $container.closest('.h5p-container');
  }

  let $currentSpeechBubble = $('<div class="h5p-interactive-video-bubble" aria-live="assertive">')
    .append([$tail, $innerBubble])
    .addClass('h5p-interactive-video-bubble-inactive')
    .appendTo($h5pContainer);

  // Calculate offset between the button and the h5p frame
  var offset = getOffsetBetween($h5pContainer, $container);

  var direction = (offset.bottom > offset.top ? 'bottom' : 'top');
  var tipWidth = offset.outerWidth * 0.9; // Var needs to be renamed to make sense
  if (maxWidth === 'auto') {
    maxWidth = offset.innerWidth;
  }
  var bubbleWidth = tipWidth > maxWidth ? maxWidth : tipWidth;
  var bubblePosition = getBubblePosition(bubbleWidth, offset);
  let offsetStar = (parseInt($container.css('marginLeft')) + parseInt($container.css('marginRight'))) / 2;
  var tailPosition = getTailPosition(bubbleWidth, bubblePosition, offset, $container.width() + offsetStar);
  // Need to set font-size, since element is appended to body.
  // Using same font-size as parent. In that way it will grow accordingly
  // when resizing
  var fontSize = 16;//parseFloat($parent.css('font-size'));

  // Set width and position of speech bubble
  $currentSpeechBubble.css(bubbleCSS(
    direction,
    'auto',
    bubblePosition,
    fontSize
  ));

  var preparedTailCSS = tailCSS(direction, tailPosition);
  $tail.css(preparedTailCSS);
  $innerTail.css(preparedTailCSS);

  if (iDevice) {
    H5P.$body.css('cursor', 'pointer');
  }

  return $currentSpeechBubble;
}

export default Bubble;
