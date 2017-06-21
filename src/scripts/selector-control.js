/**
 * Enum for button types
 *
 * @enum {number}
 * @readonly
 */
const ButtonType = {
  ICON: 0,
  TEXT: 1
};

/**
* Makes it easy to create popup controls for videos
*
* @class SelectorControl
* @extends H5P.EventDispatcher
* @param {string} name Use to identify this control
* @param {H5P.Video.LabelValue[]} options To select from
* @param {H5P.Video.LabelValue} selectedOption Default selected option
* @param {l10n} l10n Translations
*/
const SelectorControl = function (name, options, selectedOption, menuItemType, l10n) {
  /** @alias H5P.InteractiveVideo.SelectorControl# */
  var self = this;

  // Inheritance
  H5P.EventDispatcher.call(self);

  // Presents the available options
  var list;

  /**
   * Toggle show/hide popup
   * @private
   */
  var toggle = function () {
    var isExpanded = self.control.getAttribute('aria-expanded') === 'true';

    if(isExpanded) {
      self.control.setAttribute('aria-expanded', 'false');
      self.popup.classList.remove('h5p-show');
      self.trigger('close');
    }
    else {
      self.control.setAttribute('aria-expanded', 'true');
      self.popup.classList.add('h5p-show');
      self.trigger('open');
    }
  };

  /**
   * @private
   * @param {H5P.Video.LabelValue} option
   * @return {Element} li button
   */
  var createOption = function (option) {
    var isSelected = option.value === selectedOption.value;

    var result = button(null, ButtonType.TEXT, option.label, function () {
      // New option selected
      selectedOption = option;
      list.querySelectorAll('[aria-checked="true"]').forEach(function(element) {
        element.setAttribute('aria-checked', 'false');
      });

      this.setAttribute('aria-checked', 'true');
      toggle();

      self.trigger('select', option);
    }, 'li', menuItemType);

    result.setAttribute('aria-checked', isSelected.toString());

    return result;
  };

  /**
   * Update available options inside selector
   *
   * @param {H5P.Video.LabelValue[]} newOptions
   */
  self.updateOptions = function (newOptions) {
    if (list) {
      // Remove old list
      list.remove();
    }

    // Create a new list
    list = element(null, null, 'ol');
    list.setAttribute('role', 'menu');

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
  var closeButton = button('h5p-chooser-close-button', ButtonType.ICON, l10n.close, toggle, 'div', 'button');
  self.popup.appendChild(closeButton);

  // Create button for toggling the popup
  self.control = button('h5p-control h5p-' + name, ButtonType.ICON, l10n[name], toggle, 'div', 'button');
  self.control.setAttribute('aria-haspopup', 'true');
  // Create button for overlay controls
  self.overlayControl = button('h5p-minimal-button h5p-' + name, ButtonType.TEXT, l10n[name], toggle, 'div', 'button');

  // Generate initial options
  self.updateOptions(options);
};

// Inheritance
SelectorControl.prototype = Object.create(H5P.EventDispatcher.prototype);
SelectorControl.prototype.constructor = SelectorControl;

/**
 * Factory function for creating elements
 * @private
 * @param {string} className
 * @param {string} innerHTML
 * @param {string} [tag] type
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
 * @param {number} type Determine if the button should have text
 * @param {string} label Human identifier
 * @param {function} handler When clicked
 * @param {string} tag type
 * @param {string} role
 *
 * @return {Element} button
 */
var button = function (className, type, label, handler, tag, role) {
  var button = element(className, (type === ButtonType.TEXT ? label : ''), tag);
  button.tabIndex = 0;
  button.setAttribute('role', role);
  if (type === ButtonType.ICON) {
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

export default SelectorControl;