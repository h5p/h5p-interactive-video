const $ = H5P.jQuery;
const iDevice = navigator.userAgent.match(/iPod|iPhone|iPad/g) ? true : false;

/** Class representing a bubble. */
class Bubble {
  /**
   * Creates a new speech bubble
   *
   * @param {H5P.jQuery} $reference - The speaking object to attach to.
   * @param {object} params - Optional parameters.
   * @param {string=''} params.content - The content to display. Can be HTML.
   * @param {number|string='auto'} params.maxWidth - The width of the bubble. Can be 'auto'.
   * @param {string='h5p-interactive-video-bubble'} params.style - Selector for the CSS base class.
   * @param {string='centered'} params.mode - 'centered' or 'full' (could be extended)
   * @return {Bubble} The bubble.
   */
  constructor ($reference, params = {content: '', maxWidth: 'auto', style: 'h5p-interactive-video-bubble', mode: 'centered'}) {
    this.$reference = $reference;
    this.maxWidth = params.maxWidth;
    this.style = params.style;
    this.mode = params.mode;

    this.$tail = $('<div/>', {class: this.style + '-tail'});
    this.$innerTail = $('<div/>', {class: this.style + '-inner-tail'});
    this.$content = $('<div/>', {class: this.style + '-text', html: params.content});
    this.$innerBubble = $('<div/>', {class: this.style + '-inner'})
      .append(this.$content)
      .prepend(this.$innerTail);

    this.$h5pContainer = this.$reference.closest('.h5p-frame');
    // Check closest h5p frame first, then check for container in case there is no frame.
    if (!this.$h5pContainer.length) {
      this.$h5pContainer = this.$reference.closest('.h5p-container');
    }

    this.$bubble = $('<div/>', {class: this.style, 'aria-live': 'assertive'})
      .append([this.$tail, this.$innerBubble])
      .addClass(this.style + '-inactive')
      .appendTo(this.$h5pContainer);

    if (iDevice) {
      H5P.$body.css('cursor', 'pointer');
    }

    this.update();
  }

  /**
   * Update position (and size) of bubble's elements.
   */
  update () {
    // Calculate offset between the button and the h5p frame
    const offset = this.getOffsetBetween(this.$h5pContainer, this.$reference);

    // Compute bubbleWidth (after changing the content);
    const bubbleWidth = Math.min(offset.outerWidth * 0.9, (this.maxWidth === 'auto') ? this.$innerBubble.outerWidth() : this.maxWidth);
    const bubblePosition = this.getBubblePosition(bubbleWidth, offset);
    const tailPosition = this.getTailPosition(this.$reference, bubblePosition);
    // Need to set font-size, since element is appended to body.
    // Using same font-size as parent. In that way it will grow accordingly
    // when resizing
    const fontSize = 16;//parseFloat($parent.css('font-size'));

    // Set width and position of speech bubble
    this.$bubble.css({
      width: (this.maxWidth === 'auto') ? 'auto' : this.maxWidth + 'px',
      bottom: bubblePosition.bottom + 'px',
      left: bubblePosition.left + 'px',
      fontSize: fontSize + 'px'
    });

    const preparedTailCSS = {
      bottom: tailPosition.bottom + 'px',
      left: tailPosition.left + 'px'
    };
    this.$tail.css(preparedTailCSS);
    this.$innerTail.css(preparedTailCSS);
  }

  /**
   * Animate the bubble
   */
  animate () {
    if (this.$bubble.hasClass(this.style + '-inactive')) {
      this.$bubble
        .removeClass(this.style + '-inactive')
        .addClass(this.style + '-active');

      setTimeout(() => {
        this.$bubble
          .removeClass(this.style + '-active')
          .addClass(this.style + '-inactive');
      }, 2000);
    }
  }

  /**
   * Set the content for the bubble.
   *
   * @param {string=''} content - The content to be displayed.
   */
  setContent (content = '') {
    this.$content.html(content);
    this.update();
  }

  /**
   * Get the content of a bubble.
   *
   * @return {string} Text or outerHTML displayed in the bubble.
   */
  getContent () {
    return this.$content.get(0).outerHTML;
  }

  /**
   * Calculate position for speech bubble.
   *
   * @param {number} bubbleWidth - Width of the bubble.
   * @param {object} offset - Offset.
   * @param {number} offset.top - Top offset.
   * @param {number} offset.right - Right offset.
   * @param {number} offset.bottom - Bottom offset.
   * @param {number} offset.left - Left offset.
   * @param {number} offset.innerWidth - InnerWidth offset.
   * @param {number} offset.innerHeight - InnerHeight offset.
   * @param {number} offset.outerWidth - OuterWidth offset.
   * @param {number} offset.outerHeight- OuterHeight offset.
   * @return {object} Position for the bubble.
   */
  getBubblePosition (bubbleWidth, offset) {
    const tailOffset = 4;
    const widthOffset = bubbleWidth / 2;

    return {
      top: offset.top + offset.innerHeight,
      bottom: offset.bottom + offset.innerHeight + tailOffset,
      left: offset.left - widthOffset + 15
    };
  }

  /**
   * Calculate position for speech bubble tail.
   *
   * @param {jQuery} reference - Reference object for tail position.
   * @param {object} bubblePosition - Bubble position.
   * @param {number} bubblePosition.top - Top position.
   * @param {number} bubblePosition.bottom - Bottom position.
   * @param {number} bubblePosition.left - Left position.
   * @return {object} Position for the tail.
   */
  getTailPosition ($reference, bubblePosition) {
    // Magic numbers. Tuned by hand so that the tail fits visually within the bounds of the bubble.
    return {
      left: $reference.offset().left - bubblePosition.left + 6,
      top: -6,
      bottom: -6
    };
  }

  /**
   * Calculates the offset between an element inside a container and the
   * container. Only works if all the edges of the inner element is inside the
   * outer element.
   * Width/height of the elements is included as a convenience.
   *
   * @param {H5P.jQuery} $outer - Outer object.
   * @param {H5P.jQuery} $inner - Inner object.
   * @return {object} Position offset.
   */
  getOffsetBetween ($outer, $inner) {
    const outer = $outer[0].getBoundingClientRect();
    const inner = $inner[0].getBoundingClientRect();

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
  }
}

export default Bubble;
