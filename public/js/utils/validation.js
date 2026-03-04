// public/js/utils/validation.js — Client-side validation and formatting
'use strict';

/**
 * Validation utilities for booking form
 */
const Validators = {
  /**
   * Validate name (2-80 characters, letters and spaces)
   * @param {string} name - Name to validate
   * @returns {object} - {valid: boolean, error?: string}
   */
  name(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name is required' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    
    if (trimmed.length > 80) {
      return { valid: false, error: 'Name must be less than 80 characters' };
    }
    
    // Allow letters, spaces, hyphens, apostrophes
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
      return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {object} - {valid: boolean, error?: string}
   */
  email(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    
    const trimmed = email.trim().toLowerCase();
    
    // RFC 5322 simplified
    const emailRegex = /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
    
    if (trimmed.length > 120) {
      return { valid: false, error: 'Email must be less than 120 characters' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate phone number (South African format)
   * @param {string} phone - Phone to validate
   * @returns {object} - {valid: boolean, error?: string}
   */
  phone(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number is required' };
    }
    
    // Remove formatting
    const digits = phone.replace(/[\s\-().]/g, '');
    
    // Check if it's a valid format
    if (!/^(\+27|0)[0-9]{9}$/.test(digits)) {
      return { valid: false, error: 'Please enter a valid South African phone number' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate address
   * @param {string} address - Address to validate
   * @param {boolean} confirmed - Whether address was confirmed via autocomplete
   * @returns {object} - {valid: boolean, error?: string}
   */
  address(address, confirmed = false) {
    if (!address || typeof address !== 'string') {
      return { valid: false, error: 'Address is required' };
    }
    
    const trimmed = address.trim();
    
    if (trimmed.length < 5) {
      return { valid: false, error: 'Address must be at least 5 characters' };
    }
    
    if (trimmed.length > 200) {
      return { valid: false, error: 'Address must be less than 200 characters' };
    }
    
    if (!confirmed) {
      return { valid: false, error: 'Please select an address from the suggestions' };
    }
    
    return { valid: true };
  },
};

/**
 * Formatting utilities
 */
const Formatters = {
  /**
   * Format phone number for display
   * @param {string} phone - Phone number
   * @returns {string} - Formatted phone
   */
  phone(phone) {
    if (!phone) return '';
    
    // Remove all non-digits except leading +
    let cleaned = phone.replace(/[^+0-9]/g, '');
    
    // Format South African numbers
    if (cleaned.startsWith('+27')) {
      // +27 82 123 4567
      return cleaned.replace(/^(\+27)(\d{2})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
    }
    
    if (cleaned.startsWith('0')) {
      // 082 123 4567
      return cleaned.replace(/^(0\d{2})(\d{3})(\d{4})$/, '$1 $2 $3');
    }
    
    return phone;
  },
  
  /**
   * Format currency (South African Rand)
   * @param {number} amount - Amount to format
   * @returns {string} - Formatted currency
   */
  currency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return 'R0.00';
    return 'R' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  
  /**
   * Format date for display (DD MMM YYYY)
   * @param {string} dateStr - Date string (YYYY-MM-DD)
   * @returns {string} - Formatted date
   */
  date(dateStr) {
    if (!dateStr) return '';
    
    const [year, month, day] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  },
  
  /**
   * Format time range for display
   * @param {string} timeStr - Time string (HH:MM-HH:MM)
   * @returns {string} - Formatted time range
   */
  time(timeStr) {
    if (!timeStr) return '';
    
    const [start, end] = timeStr.split('-');
    return `${start} - ${end}`;
  },
  
  /**
   * Format duration in minutes
   * @param {number} minutes - Duration in minutes
   * @returns {string} - Formatted duration
   */
  duration(minutes) {
    if (!minutes || minutes < 1) return '';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  },
};

/**
 * Form field validation with real-time feedback
 */
class FieldValidator {
  constructor(inputElement, validatorFn, options = {}) {
    this.input = inputElement;
    this.validatorFn = validatorFn;
    this.options = {
      validateOnBlur: true,
      validateOnInput: false,
      showSuccess: true,
      debounceMs: 300,
      ...options,
    };
    
    this.debounceTimer = null;
    this.isValid = false;
    
    this._attachListeners();
  }
  
  /**
   * Attach event listeners
   * @private
   */
  _attachListeners() {
    if (this.options.validateOnBlur) {
      this.input.addEventListener('blur', () => this.validate());
    }
    
    if (this.options.validateOnInput) {
      this.input.addEventListener('input', () => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.validate();
        }, this.options.debounceMs);
      });
    }
  }
  
  /**
   * Validate field
   * @returns {boolean} - True if valid
   */
  validate() {
    const value = this.input.value;
    const result = this.validatorFn(value);
    
    this.isValid = result.valid;
    
    // Update UI
    this.input.classList.remove('input-valid', 'input-error');
    
    if (result.valid && this.options.showSuccess) {
      this.input.classList.add('input-valid');
    } else if (!result.valid && value.length > 0) {
      this.input.classList.add('input-error');
    }
    
    // Show/hide error message
    const errorEl = this.input.nextElementSibling;
    if (errorEl && errorEl.classList.contains('field-error')) {
      if (!result.valid && value.length > 0) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
    }
    
    return result.valid;
  }
  
  /**
   * Clear validation state
   */
  clear() {
    this.input.classList.remove('input-valid', 'input-error');
    this.isValid = false;
    
    const errorEl = this.input.nextElementSibling;
    if (errorEl && errorEl.classList.contains('field-error')) {
      errorEl.style.display = 'none';
    }
  }
}

/**
 * Validate entire booking form
 * @param {object} formData - Form data object
 * @returns {object} - {valid: boolean, errors: object}
 */
function validateBookingForm(formData) {
  const errors = {};
  
  // Validate name
  const nameResult = Validators.name(formData.name);
  if (!nameResult.valid) errors.name = nameResult.error;
  
  // Validate email
  const emailResult = Validators.email(formData.email);
  if (!emailResult.valid) errors.email = emailResult.error;
  
  // Validate phone
  const phoneResult = Validators.phone(formData.phone);
  if (!phoneResult.valid) errors.phone = phoneResult.error;
  
  // Validate address
  const addressResult = Validators.address(formData.address, formData.addressConfirmed);
  if (!addressResult.valid) errors.address = addressResult.error;
  
  // Validate services
  if (!formData.services || formData.services.length === 0) {
    errors.services = 'Please select at least one service';
  }
  
  // Validate date and time
  if (!formData.date) errors.date = 'Please select a date';
  if (!formData.time) errors.time = 'Please select a time slot';
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Export
if (typeof window !== 'undefined') {
  window.Validators = Validators;
  window.Formatters = Formatters;
  window.FieldValidator = FieldValidator;
  window.validateBookingForm = validateBookingForm;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Validators,
    Formatters,
    FieldValidator,
    validateBookingForm,
  };
}
