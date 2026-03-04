// public/js/main.js — Main application entry point
// Initializes all modules and sets up the booking flow
'use strict';

import { bookingState, updateState, subscribe } from './state.js';
import { fetchAppConfig } from './api.js';
import { updateStepUI, setLoading, showToast } from './ui.js';
import { loadServices, toggleService, removeServiceFromCart } from './services.js';
import { initCalendar, selectDate, selectTime } from './calendar.js';
import { initClientDetails, validateDetails, toggleDiva, safetyToggle } from './client-details.js';
import { renderSummary, submitBooking } from './payment.js';
import { nextStep as navNextStep, prevStep as navPrevStep } from './navigation.js';
import { initAccessibility } from './accessibility.js';
import { initPerformance, logPerformanceMetrics, setupCacheCleanup } from './performance.js';

/**
 * Initialize booking application
 */
async function init() {
  console.log('🚀 PhenomeBeauty Booking System initializing...');
  
  try {
    // Show initial loading state
    setLoading(true, 'Loading booking system...');
    
    // Load app configuration
    const config = await fetchAppConfig();
    updateState({ config });
    
    // Initialize accessibility features
    initAccessibility();
    
    // Initialize performance optimizations
    initPerformance();
    
    // Setup cache cleanup
    setupCacheCleanup();
    
    // Initialize Step 1 (services)
    await loadServices();
    
    // Initialize calendar (will be shown on step 2)
    initCalendar();
    
    // Initialize client details form (will be shown on step 3)
    initClientDetails();
    
    // Update UI to show Step 1
    updateStepUI(1);
    
    // Setup global error handlers
    setupErrorHandlers();
    
    // Setup event listeners for buttons
    setupEventListeners();
    
    // Subscribe to state changes for debugging (remove in production)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      subscribe((state) => {
        console.log('State updated:', state);
      });
      
      // Log performance metrics in development
      logPerformanceMetrics();
    }
    
    console.log('✅ Booking system ready');
    console.log('📊 Features enabled:');
    console.log('  ✅ State management');
    console.log('  ✅ API retry logic');
    console.log('  ✅ Secure address autocomplete');
    console.log('  ♿ Accessibility (ARIA, keyboard nav)');
    console.log('  ⚡ Performance (prefetch, cache)');
    
  } catch (error) {
    console.error('Failed to initialize booking system:', error);
    showToast('Failed to load booking system. Please refresh the page.', true);
  } finally {
    setLoading(false);
  }
}

/**
 * Setup event listeners for navigation buttons and form elements
 */
function setupEventListeners() {
  // Navigation buttons
  const btnNext = document.getElementById('btn-next');
  const btnBack = document.getElementById('btn-back');
  
  if (btnNext) {
    btnNext.addEventListener('click', navNextStep);
  }
  
  if (btnBack) {
    btnBack.addEventListener('click', navPrevStep);
  }
  
  // Diva toggle buttons
  const btnExisting = document.getElementById('diva-existing');
  const btnNew = document.getElementById('diva-new');
  
  if (btnExisting) {
    btnExisting.addEventListener('click', () => toggleDiva('existing'));
  }
  
  if (btnNew) {
    btnNew.addEventListener('click', () => toggleDiva('new'));
  }
  
  // Safety question buttons (delegated)
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('syn-btn')) {
      const key = target.closest('.safety-yn')?.dataset.q;
      const value = target.dataset.v;
      if (key && value) {
        safetyToggle(key, value, target);
      }
    }
  });
  
  // Input validation listeners
  const emailInput = document.getElementById('client-email');
  const phoneInput = document.getElementById('client-phone');
  const nameInput = document.getElementById('client-name');
  const addressInput = document.getElementById('client-address');
  
  if (emailInput) {
    emailInput.addEventListener('input', (e) => validateEmail(e.target));
  }
  
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => formatPhone(e.target));
  }
  
  if (nameInput) {
    nameInput.addEventListener('input', updateNextButton);
  }
  
  if (addressInput) {
    addressInput.addEventListener('input', updateNextButton);
  }
}

/**
 * Validation helpers (exposed for inline handlers if still needed)
 */
function validateEmail(input) {
  const v = input.value.trim();
  const ok = v.length > 4 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  input.classList.toggle('input-valid', ok);
  input.classList.toggle('input-error', v.includes('@') && v.split('@')[1]?.includes('.') && !ok);
  updateNextButton();
}

function formatPhone(input) {
  // Allow digits, spaces, hyphens, parens, plus
  let val = input.value.replace(/[^\d\s\-().+]/g, '');
  input.value = val;
  
  // Validate format
  const digitsOnly = val.replace(/\D/g, '');
  const ok = digitsOnly.length >= 7 && digitsOnly.length <= 15;
  input.classList.toggle('input-valid', ok);
  input.classList.toggle('input-error', val.length > 4 && !ok);
  updateNextButton();
}

function updateNextButton() {
  // This will be handled by navigation module
  if (window.updateNextBtn) {
    window.updateNextBtn();
  }
}

/**
 * Setup global error handlers
 */
function setupErrorHandlers() {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred. Please try again.', true);
  });
  
  // Catch global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });
}

/**
 * Handle page visibility changes (refresh data when page becomes visible)
 */
function setupVisibilityHandler() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && bookingState.currentStep === 2) {
      // Refresh calendar when user returns to page
      console.log('Page became visible, refreshing calendar...');
      // Calendar will auto-refresh on next render
    }
  });
}

/**
 * Setup keyboard shortcuts (for debugging/power users)
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Shift + D = Show debug state
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      console.table({
        Step: bookingState.currentStep,
        Services: bookingState.selectedServices.length,
        Date: bookingState.calendar.selectedDate || 'Not selected',
        Time: bookingState.calendar.selectedTime || 'Not selected',
        Name: bookingState.client.name || 'Not entered',
        'Total Amount': `R${bookingState.pricing.totalAmount}`,
      });
      console.log('Full state:', bookingState);
    }
    
    // Ctrl/Cmd + Shift + P = Show performance metrics
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      logPerformanceMetrics();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Setup additional handlers
setupVisibilityHandler();
setupKeyboardShortcuts();

// Export for debugging (remove in production)
window.__PHENOM_STATE__ = bookingState;

// TEMPORARY: Expose functions for inline event handlers in HTML
// TODO: Remove these once HTML is fully migrated to event listeners
window.nextStep = navNextStep;
window.prevStep = navPrevStep;
window.toggleDiva = toggleDiva;
window.safetyToggle = safetyToggle;
window.validateEmail = validateEmail;
window.formatPhone = formatPhone;
window.updateNextBtn = updateNextButton;

console.log('📦 PhenomeBeauty Booking System modules loaded');
