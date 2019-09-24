const $ = H5P.jQuery;
const iDevice = navigator.userAgent.match(/iPod|iPhone|iPad/g) ? true : false;

/** Class representing a bubble. */
class Bubble {
  /**
   * Creates a new speech bubble
   *
   * @param {H5P.jQuery} $reference - The speaking object to attach to.
   * @param {object} [params] - Optional parameters.
   * @param {string} [params.content] - The content to display. Can be HTML.
   * @param {number|string} [params.maxWidth=auto] - The width of the bubble. Can be 'auto'.
   * @param {string} [params.style=h5p-interactive-video-bubble] - Selector for the CSS base class.
   * @param {string} [params.mode=centered] - 'centered' or 'full' (could be extended)
   * @return {Bubble} The bubble.
   */
  constructor($reference, params = {content: '', maxWidth: 'auto', style: 'h5p-interactive-video-bubble', mode: 'centered', focus: () => {}}) {
    this.$reference = $reference;
    this.maxWidth = params.maxWidth;
    this.style = params.style;
    this.mode = params.mode;
    this.focus = params.focus;

    this.$tail = $('<div/>', {class: `${this.style}-tail`});
    this.$innerTail = $('<div/>', {class: `${this.style}-inner-tail`});
    this.$content = $('<div/>', {class: `${this.style}-text`});
    if (typeof params.content === 'string') {
      this.$content.html(params.content);
    }
    else {
      this.$content.append(params.content);
    }
    this.$innerBubble = $('<div/>', {class: `${this.style}-inner`})
      .append(this.$content)
      .prepend(this.$innerTail);

    this.$h5pContainer = this.$reference.closest('.h5p-interactive-video');

    this.$bubble = $('<div/>', {
      'class': this.style,
      'aria-live': 'polite',
    }).append([this.$tail, this.$innerBubble])
      .addClass(`${this.style}-inactive`)
      .appendTo(this.$h5pContainer);

    if (iDevice) {
      H5P.$body.css('cursor', 'pointer');
    }

    if (this.mode === 'centered') {
      this.$bubble.css({
        width: (this.maxWidth === 'auto') ? 'auto' : `${this.maxWidth}px`
      });
    }

    this.update();
  }

  /**
   * Update position (and size) of bubble's elements.
   */
  update() {
    // Calculate offset between the button and the h5p frame
    const offset = this.getOffsetBetween(this.$h5pContainer, this.$reference);

    // Compute bubbleWidth (after changing the content)
    const bubbleWidth = (this.mode === 'full') ? this.$bubble.outerWidth() : Math.min(offset.outerWidth * 0.9, (this.maxWidth === 'auto') ? this.$bubble.outerWidth() : this.maxWidth);
    const bubblePosition = this.getBubblePosition(bubbleWidth, offset, this.mode);

    if (this.mode === 'centered') {
      // Set width and position of bubble, won't be handled by CSS
      this.$bubble.css({
        bottom: (bubblePosition.bottom === undefined) ? undefined : `${bubblePosition.bottom}px`,
        left: `${bubblePosition.left}px`
      });
    }

    /*
     * The DOM needs some time to keep up with the positining of the reference object (star in IV)
     * Smoothened with CSS transition ease-out when resizing
     */
    setTimeout(() => {
      const tailPosition = this.getTailPosition(this.$reference);
      const preparedTailCSS = {
        bottom: `${tailPosition.bottom}px`,
        left: (typeof tailPosition.left === 'string') ? tailPosition.left : `${tailPosition.left}px`
      };
      this.$tail.css(preparedTailCSS);
      this.$innerTail.css(preparedTailCSS);
    }, 75);
  }

  /**
   * Animate the bubble
   */
  animate() {
    if (this.$bubble.hasClass(`${this.style}-inactive`)) {
      this.$bubble
        .removeClass(`${this.style}-inactive`)
        .addClass(`${this.style}-active`);

      setTimeout(() => {
        this.$bubble
          .removeClass(`${this.style}-active`)
          .addClass(`${this.style}-inactive`);
      }, 2000);
    }
  }

  /**
   * Set the content for the bubble.
   *
   * @param {string} [content] - The content to be displayed.
   */
  setContent(content = '') {
    this.$content.html(content);
    this.update();
  }

  /**
   * Get the content of a bubble.
   *
   * @return {string} Text or outerHTML displayed in the bubble.
   */
  getContent() {
    return this.$content.get(0).outerHTML;
  }

  /**
   * Determine whether the bubble is active
   *
   * @return {boolean} True, if bubble is active
   */
  isActive() {
    return this.$bubble.hasClass(`${this.style}-active`);
  }

  /**
   * Change activity of this bubble.
   *
   * @param {boolean} [show] - True: show, false: hide, undefined: toggle.
   * @param {boolean} [animate=false] - True: animate the bubble in.
   */
  toggle(show, animate = false) {
    show = (show === undefined) ? !this.isActive() : show;

    if (show && animate) {
      /*
       * If in CSS you transition from display: none (inactive) to inherit (active),
       * the element won't translate but just be visible even with a delay set.
       * Still, for the animation, we need the element below the content, and
       * it's height will be considered on resize even with visibility: hidden.
       */
      setTimeout(() => {
        this.$bubble
          .removeClass(`${this.style}-preparing`)
          .addClass(`${this.style}-active`);

          setTimeout(() => this.focus(), 400);
      }, 100); // 100ms seem to do the trick
      this.$bubble
        .removeClass(`${this.style}-inactive`)
        .addClass(`${this.style}-preparing`);
    }
    else {
      this.$bubble
        .toggleClass(`${this.style}-inactive`, !show)
        .toggleClass(`${this.style}-active`, show);
    }

    // Need to update tail position
    this.update();
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
   * @param {number} offset.outerHeight - OuterHeight offset.
   * @param {string} mode - 'centered' for score bubble, 'full' for endscreen
   * @return {object} Position for the bubble.
   */
  getBubblePosition(bubbleWidth, offset, mode) {
    const tailOffset = 4;
    const widthOffset = bubbleWidth / 2;

    const bottom = (mode === 'full') ? undefined : offset.bottom + offset.innerHeight + tailOffset;
    const left = (mode === 'full') ? (offset.outerWidth - bubbleWidth) / 2 : offset.left - widthOffset + 16; // 16 ~ half of star icons width

    return {
      bottom: bottom,
      left: left
    };
  }

  /**
   * Calculate position for speech bubble tail.
   *
   * @param {jQuery} $reference - Reference object for tail position.
   * @return {object} Position for the tail.
   */
  getTailPosition($reference) {
    // Magic numbers. Tuned by hand so that the tail fits visually within the bounds of the bubble.
    return {
      left: $reference.offset().left - this.$tail.parent().offset().left + 8,
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
  getOffsetBetween($outer, $inner) {
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

  /**
   * Set offset and font for fullscreen mode.
   *
   * This is only used for the endscreen right now.
   *
   * @param {number} [fullscreen=false] - True if fullscreen.
   * @param {number} [containerHeight] - Container height.
   * @param {number} [videoHeight] - Height of video.
   */
  fullscreen(fullscreen = false, containerHeight = undefined, videoHeight = undefined) {
    const isMobile = this.isMobilePhone();
    const setMaxHeight = fullscreen && !isMobile && containerHeight !== undefined && videoHeight !== undefined;
    let css = {
      maxHeight: '',
      top: ''
    };

    if (setMaxHeight) {
      css.maxHeight = `calc(${videoHeight}px - 1em - 9px)`;
      css.top = `calc(((${containerHeight-videoHeight}px + 1em) / 2) - 9px)`;
    }

    this.$bubble.toggleClass('mobile-fullscreen', isMobile && fullscreen);
    this.$bubble.css(css);
  }

  /**
   * Detect if we are using a mobile phone
   */
  isMobilePhone() {
    return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)|| /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(navigator.userAgent.substr(0,4));
  }
}

export default Bubble;
