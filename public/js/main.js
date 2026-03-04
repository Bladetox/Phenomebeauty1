// public/js/main.js — Main application entry point
// Initializes all modules and sets up the booking flow
'use strict';

import { bookingState, updateState, subscribe } from './state.js';
import { fetchAppConfig } from './api.js';
import { updateStepUI, setLoading, showToast } from './ui.js';
import { loadServices } from './services.js';
import { setupNavigation } from './navigation.js';

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
    
    // Setup navigation listeners
    setupNavigation();
    
    // Initialize Step 1 (services)
    await loadServices();
    
    // Update UI to show Step 1
    updateStepUI(1);
    
    // Setup global error handlers
    setupErrorHandlers();
    
    // Subscribe to state changes for debugging (remove in production)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      subscribe((state) => {
        console.log('State updated:', state);
      });
    }
    
    console.log('✅ Booking system ready');
    
  } catch (error) {
    console.error('Failed to initialize booking system:', error);
    showToast('Failed to load booking system. Please refresh the page.', true);
  } finally {
    setLoading(false);
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

console.log('📦 PhenomeBeauty Booking System modules loaded');
