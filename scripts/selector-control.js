(function (InteractiveVideo, EventDispatcher) {

/**
 * Makes it easy to create popup controls for videos
 *
 * @class H5P.InteractiveVideo.SelectorControl
 * @extends H5P.EventDispatcher
 * @param {string} name Use to identify this control
 * @param {H5P.Video.LabelValue[]} options To select from
 * @param {H5P.Video.LabelValue} selectedOption Default selected option
 * @param {l10n} l10n Translations
 */
InteractiveVideo.SelectorControl = function (name, options, selectedOption, l10n) {
  /** @alias H5P.InteractiveVideo.SelectorControl# */
  var self = this;

  // Inheritance
  EventDispatcher.call(self);

  // Presents the available options
  var list;

  /**
   * Toggle show/hide popup
   * @private
   */
  var toggle = function () {
    var action = (self.control.classList.contains('h5p-active') ? 'remove' : 'add');
    self.control.classList[action]('h5p-active');
    self.popup.classList[action]('h5p-show');
    self.trigger(action === 'remove' ? 'close' : 'open');
  };

  /**
   * @private
   * @param {H5P.Video.LabelValue} option
   * @return {Element} li button
   */
  var createOption = function (option) {
    var selectedClass = (option.value === selectedOption.value ? ' h5p-selected' : '');
    return button(selectedClass, TEXT, option.label, function () {
      // New option selected
      selectedOption = option;
      list.querySelector('.h5p-selected').classList.remove('h5p-selected');
      this.classList.add('h5p-selected');
      toggle();
      self.trigger('select', option);
    }, 'li');
  };

  /**
   * Update available options inside selector
   *
   * @param {H5P.Video.LabelValue[]} newOptions
   */
  self.updateOptions = function (newOptions) {
    if (list) {
      // Remove old list
      list.remove();
    }

    // Create a new list
    list = element(null, null, 'ol');

    // Create options and add to new list
    for (var i = 0; i < newOptions.length; i++) {
      list.appendChild(createOption(newOptions[i]));
    }

    // Add new list of options to popup
    self.popup.appendChild(list);
  };

  // Create the popup which will contain the list of options
  self.popup = element('h5p-chooser h5p-' + name, '<h3>' + l10n[name] + '</h3>');

  // Add a close button inside the popup
  var closeButton = button('h5p-chooser-close-button', ICON, l10n.close, toggle);
  self.popup.appendChild(closeButton);

  // Create button for toggling the popup
  self.control = button('h5p-control h5p-' + name, ICON, l10n[name], toggle);

  // Create button for overlay controls
  self.overlayControl = button('h5p-minimal-button h5p-' + name, TEXT, l10n[name], toggle);

  // Generate initial options
  self.updateOptions(options);
};

// Inheritance
InteractiveVideo.SelectorControl.prototype = Object.create(EventDispatcher.prototype);
InteractiveVideo.SelectorControl.prototype.constructor = InteractiveVideo.SelectorControl;

// Button types
var ICON = 0;
var TEXT = 1;

/**
 * Factory function for creating elements
 * @private
 * @param {string} className
 * @param {string} innerHTML
 * @param {string} tag type
 * @return {Element}
 */
var element = function (className, innerHTML, tag) {
  var element = document.createElement(tag || 'div');
  if (className) {
    element.className = className;
  }
  if (innerHTML) {
    element.innerHTML = innerHTML;
  }
  return element;
};

/**
 * Factory function for creating buttons
 * @private
 * @param {string} className Machine identifier
 * @param {ICON|TEXT} type Determine if the button should have text
 * @param {string} label Human identifier
 * @param {function} handler When clicked
 * @param {string} tag type
 * @return {Element} button
 */
var button = function (className, type, label, handler, tag) {
  var button = element(className, (type === TEXT ? label : ''), tag);
  button.tabIndex = 0;
  button.setAttribute('role', 'button');
  if (type === ICON) {
    button.title = label
  }
  button.addEventListener('click', function (event) {
    handler.call(button, event);
  }, false);
  button.addEventListener('keypress', function (event) {
    if (event.which === 32 || event.which === 13) {
      event.preventDefault();
      handler.call(button, event);
    }
  }, false);
  return button;
};

})(H5P.InteractiveVideo, H5P.EventDispatcher);
