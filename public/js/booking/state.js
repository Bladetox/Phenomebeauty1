// public/js/booking/state.js — Centralized state management
// Implements reactive state pattern for booking flow
'use strict';

/**
 * BookingState - Centralized state manager with observer pattern
 * Manages all booking data and notifies listeners of changes
 */
class BookingState {
  constructor() {
    this._state = {
      // Current step in booking flow
      step: 1,
      
      // Services data
      services: [],
      selectedServices: [],
      activeCategory: 'All',
      
      // Calendar data
      calendar: {
        year: null,
        month: null,
        selectedDate: '',
        selectedTime: '',
        monthCache: {}, // Cache availability data
      },
      
      // Client details
      client: {
        name: '',
        phone: '',
        email: '',
        address: '',
        divaType: 'existing', // 'existing' or 'new'
        safety: {
          skinConditions: '',
          medications: '',
          allergies: '',
          healthConditions: '',
          pregnant: false,
          environmental: '',
          physical: '',
          hairLengthOk: true,
          additionalInfo: '',
        },
      },
      
      // Pricing calculations
      pricing: {
        servicesTotal: 0,
        callOutFee: 0,
        totalAmount: 0,
        depositAmount: 0,
        depositPercent: 50,
        balanceDue: 0,
        oneWayKm: 0,
        roundTripKm: 0,
        duration: '',
      },
      
      // UI state
      ui: {
        loading: false,
        addressConfirmed: false,
        showSafetyQuestions: false,
      },
      
      // Configuration
      config: {
        appBaseUrl: '',
        googleReviewUrl: '',
      },
    };
    
    // Observers for state changes
    this._observers = [];
  }
  
  /**
   * Subscribe to state changes
   * @param {Function} callback - Called with (state, changedPath)
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    this._observers.push(callback);
    return () => {
      const index = this._observers.indexOf(callback);
      if (index > -1) this._observers.splice(index, 1);
    };
  }
  
  /**
   * Notify all observers of state change
   * @param {string} path - Dot-notation path that changed
   */
  _notify(path) {
    this._observers.forEach(callback => {
      try {
        callback(this._state, path);
      } catch (error) {
        console.error('Observer error:', error);
      }
    });
  }
  
  /**
   * Get current state (read-only)
   * @returns {object} - Deep copy of current state
   */
  get() {
    return JSON.parse(JSON.stringify(this._state));
  }
  
  /**
   * Get value at specific path
   * @param {string} path - Dot-notation path (e.g., 'client.name')
   * @returns {any} - Value at path
   */
  getPath(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  }
  
  /**
   * Set value at specific path
   * @param {string} path - Dot-notation path
   * @param {any} value - New value
   */
  setPath(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this._state);
    target[lastKey] = value;
    this._notify(path);
  }
  
  /**
   * Update multiple values at once
   * @param {object} updates - Object with path-value pairs
   */
  update(updates) {
    Object.entries(updates).forEach(([path, value]) => {
      this.setPath(path, value);
    });
  }
  
  /**
   * Navigate to specific step
   * @param {number} step - Step number (1-4)
   */
  goToStep(step) {
    if (step < 1 || step > 4) return;
    this.setPath('step', step);
  }
  
  /**
   * Add service to selection
   * @param {object} service - Service object
   */
  addService(service) {
    const services = this._state.selectedServices;
    if (!services.find(s => s.id === service.id)) {
      services.push(service);
      this._notify('selectedServices');
      this._recalculatePricing();
    }
  }
  
  /**
   * Remove service from selection
   * @param {string} serviceId - Service ID
   */
  removeService(serviceId) {
    const services = this._state.selectedServices;
    const index = services.findIndex(s => s.id === serviceId);
    if (index > -1) {
      services.splice(index, 1);
      this._notify('selectedServices');
      this._recalculatePricing();
    }
  }
  
  /**
   * Clear all selected services
   */
  clearServices() {
    this._state.selectedServices = [];
    this._notify('selectedServices');
    this._recalculatePricing();
  }
  
  /**
   * Set call-out fee and recalculate totals
   * @param {number} fee - Call-out fee
   * @param {object} data - Additional data (oneWayKm, roundTripKm, duration)
   */
  setCallOutFee(fee, data = {}) {
    this._state.pricing.callOutFee = fee;
    this._state.pricing.oneWayKm = data.oneWayKm || 0;
    this._state.pricing.roundTripKm = data.roundTripKm || 0;
    this._state.pricing.duration = data.duration || '';
    this._notify('pricing');
    this._recalculatePricing();
  }
  
  /**
   * Recalculate pricing totals
   * @private
   */
  _recalculatePricing() {
    const services = this._state.selectedServices;
    const pricing = this._state.pricing;
    
    // Calculate services total
    pricing.servicesTotal = services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
    
    // Calculate grand total
    pricing.totalAmount = pricing.servicesTotal + pricing.callOutFee;
    
    // Calculate deposit and balance
    pricing.depositAmount = Math.round(pricing.totalAmount * (pricing.depositPercent / 100) * 100) / 100;
    pricing.balanceDue = Math.round((pricing.totalAmount - pricing.depositAmount) * 100) / 100;
    
    this._notify('pricing');
  }
  
  /**
   * Cache month availability data
   * @param {string} monthKey - Month key (YYYY-MM)
   * @param {object} data - Availability data
   */
  cacheMonth(monthKey, data) {
    this._state.calendar.monthCache[monthKey] = {
      loaded: true,
      timestamp: Date.now(),
      data,
    };
    this._notify('calendar.monthCache');
  }
  
  /**
   * Get cached month data
   * @param {string} monthKey - Month key (YYYY-MM)
   * @returns {object|null} - Cached data or null
   */
  getCachedMonth(monthKey) {
    const cache = this._state.calendar.monthCache[monthKey];
    if (!cache) return null;
    
    // Expire cache after 5 minutes
    if (Date.now() - cache.timestamp > 5 * 60 * 1000) {
      delete this._state.calendar.monthCache[monthKey];
      return null;
    }
    
    return cache.data;
  }
  
  /**
   * Validate current state for step transition
   * @param {number} targetStep - Target step number
   * @returns {object} - {valid: boolean, errors: array}
   */
  validateForStep(targetStep) {
    const errors = [];
    
    if (targetStep === 2) {
      // Validate services selected
      if (this._state.selectedServices.length === 0) {
        errors.push('Please select at least one service');
      }
    }
    
    if (targetStep === 3) {
      // Validate date and time selected
      if (!this._state.calendar.selectedDate) {
        errors.push('Please select a date');
      }
      if (!this._state.calendar.selectedTime) {
        errors.push('Please select a time slot');
      }
    }
    
    if (targetStep === 4) {
      // Validate client details
      const c = this._state.client;
      if (!c.name || c.name.length < 2) {
        errors.push('Please enter your name');
      }
      if (!c.phone || !/^\+?[0-9]{7,15}$/.test(c.phone.replace(/[\s\-().]/g, ''))) {
        errors.push('Please enter a valid phone number');
      }
      if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
        errors.push('Please enter a valid email address');
      }
      if (!c.address || c.address.length < 5) {
        errors.push('Please enter your address');
      }
      if (!this._state.ui.addressConfirmed) {
        errors.push('Please select an address from the suggestions');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Reset state to initial values
   */
  reset() {
    this._state.step = 1;
    this._state.selectedServices = [];
    this._state.calendar.selectedDate = '';
    this._state.calendar.selectedTime = '';
    this._state.client = {
      name: '',
      phone: '',
      email: '',
      address: '',
      divaType: 'existing',
      safety: {},
    };
    this._state.pricing = {
      servicesTotal: 0,
      callOutFee: 0,
      totalAmount: 0,
      depositAmount: 0,
      depositPercent: 50,
      balanceDue: 0,
    };
    this._state.ui.addressConfirmed = false;
    this._notify('reset');
  }
}

// Export singleton instance
if (typeof window !== 'undefined') {
  window.BookingState = BookingState;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookingState;
}
