// public/js/state.js — Centralized booking state management
// Replaces scattered global variables from index.html
'use strict';

// Central booking state object
export const bookingState = {
  // Step tracking
  currentStep: 1,
  
  // Services
  services: [],
  selectedServices: [],
  servicesTotal: 0,
  
  // Calendar
  calendar: {
    year: null,
    month: null,
    selectedDate: '',
    selectedTime: '',
    monthCache: {},  // Moved from global monthCache
  },
  
  // Client details
  client: {
    name: '',
    phone: '',
    email: '',
    address: '',
    divaType: 'existing',  // 'existing' or 'new'
    safety: {
      skinConditions: '',
      medications: '',
      allergies: '',
      healthConditions: '',
      environmental: '',
      physical: '',
      pregnant: false,
      hairLengthOk: false,
      additionalInfo: '',
    },
  },
  
  // Pricing
  pricing: {
    callOutFee: 0,
    oneWayKm: 0,
    roundTripKm: 0,
    totalAmount: 0,
    depositAmount: 0,
    balanceDue: 0,
  },
  
  // UI state
  ui: {
    addressConfirmed: false,
    isLoading: false,
  },
  
  // App config (from /api?action=getConfig)
  config: {
    depositPercent: 50,
    googleMapsApiKey: '',  // Not used client-side anymore
    appBaseUrl: '',
    googleReviewUrl: '',
  },
};

// State change listeners
const listeners = [];

/**
 * Subscribe to state changes
 * @param {Function} callback - Called when state changes
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(callback) {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

/**
 * Notify all listeners of state change
 */
function notify() {
  listeners.forEach(callback => {
    try {
      callback(bookingState);
    } catch (error) {
      console.error('State listener error:', error);
    }
  });
}

/**
 * Update state with partial object (shallow merge)
 * @param {Object} updates - Partial state updates
 */
export function updateState(updates) {
  Object.assign(bookingState, updates);
  notify();
}

/**
 * Deep update nested state paths
 * @param {String} path - Dot notation path (e.g., 'client.name')
 * @param {*} value - New value
 */
export function setStatePath(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  
  let target = bookingState;
  for (const key of keys) {
    if (!(key in target)) target[key] = {};
    target = target[key];
  }
  
  target[lastKey] = value;
  notify();
}

/**
 * Get value from nested state path
 * @param {String} path - Dot notation path
 * @returns {*} - Value at path
 */
export function getStatePath(path) {
  const keys = path.split('.');
  let value = bookingState;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Reset state to initial values
 */
export function resetState() {
  bookingState.currentStep = 1;
  bookingState.services = [];
  bookingState.selectedServices = [];
  bookingState.servicesTotal = 0;
  
  bookingState.calendar.selectedDate = '';
  bookingState.calendar.selectedTime = '';
  // Keep monthCache for performance
  
  bookingState.client = {
    name: '',
    phone: '',
    email: '',
    address: '',
    divaType: 'existing',
    safety: {
      skinConditions: '',
      medications: '',
      allergies: '',
      healthConditions: '',
      environmental: '',
      physical: '',
      pregnant: false,
      hairLengthOk: false,
      additionalInfo: '',
    },
  };
  
  bookingState.pricing = {
    callOutFee: 0,
    oneWayKm: 0,
    roundTripKm: 0,
    totalAmount: 0,
    depositAmount: 0,
    balanceDue: 0,
  };
  
  bookingState.ui.addressConfirmed = false;
  bookingState.ui.isLoading = false;
  
  notify();
}

/**
 * Helper: Get current step
 * @returns {Number}
 */
export function getCurrentStep() {
  return bookingState.currentStep;
}

/**
 * Helper: Set current step
 * @param {Number} step
 */
export function setCurrentStep(step) {
  bookingState.currentStep = Math.max(1, Math.min(4, step));
  notify();
}

/**
 * Helper: Check if step is valid (has required data)
 * @param {Number} step
 * @returns {Boolean}
 */
export function isStepValid(step) {
  switch (step) {
    case 1:
      return bookingState.selectedServices.length > 0;
    case 2:
      return bookingState.calendar.selectedDate && bookingState.calendar.selectedTime;
    case 3:
      return (
        bookingState.client.name.length >= 2 &&
        bookingState.client.phone.length >= 10 &&
        bookingState.client.email.includes('@') &&
        bookingState.client.address.length >= 5 &&
        bookingState.ui.addressConfirmed
      );
    case 4:
      return true;
    default:
      return false;
  }
}

// Export state for debugging (remove in production)
if (typeof window !== 'undefined') {
  window.__BOOKING_STATE__ = bookingState;
}
