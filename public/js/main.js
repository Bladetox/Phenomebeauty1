// public/js/main.js — Main application entry point
// Initializes all modules and sets up the booking flow
'use strict';

console.log('📦 main.js loading...');

try {
  // Import all required modules
  const { bookingState, updateState, subscribe } = await import('./state.js');
  const { fetchAppConfig } = await import('./api.js');
  const { updateStepUI, setLoading, showToast } = await import('./ui.js');
  const { loadServices, toggleService, removeServiceFromCart } = await import('./services.js');
  const { initCalendar, selectDate, selectTime } = await import('./calendar.js');
  const { initClientDetails, validateDetails, toggleDiva, safetyToggle } = await import('./client-details.js');
  const { renderSummary, submitBooking } = await import('./payment.js');
  const { nextStep: navNextStep, prevStep: navPrevStep } = await import('./navigation.js');
  const { initAccessibility } = await import('./accessibility.js');
  const { initPerformance, logPerformanceMetrics, setupCacheCleanup } = await import('./performance.js');
  
  console.log('✅ All modules loaded successfully');

  /**
   * Initialize booking application
   */
  async function init() {
    console.log('🚀 PhenomeBeauty Booking System initializing...');
    
    try {
      // Show initial loading state
      setLoading(true, 'Loading...');
      
      // Load app configuration
      console.log('Fetching config...');
      const config = await fetchAppConfig();
      updateState({ config });
      console.log('Config loaded:', config);
      
      // Initialize accessibility features
      initAccessibility();
      
      // Initialize performance optimizations
      initPerformance();
      
      // Setup cache cleanup
      setupCacheCleanup();
      
      // Initialize Step 1 (services) - THIS IS THE CRITICAL PART
      console.log('Loading services...');
      await loadServices();
      console.log('Services loaded, count:', bookingState.services?.length || 0);
      
      // Initialize calendar (will be shown on step 2)
      if (typeof initCalendar === 'function') {
        initCalendar();
      }
      
      // Initialize client details form (will be shown on step 3)
      if (typeof initClientDetails === 'function') {
        initClientDetails();
      }
      
      // Update UI to show Step 1
      updateStepUI(1);
      
      // Setup event listeners for buttons
      setupEventListeners();
      
      // Subscribe to state changes for debugging
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        subscribe((state) => {
          console.log('State updated:', state);
        });
        logPerformanceMetrics();
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
  }

  /**
   * Handle page visibility changes
   */
  function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && bookingState.currentStep === 2) {
        console.log('Page became visible, calendar will refresh on next render');
      }
    });
  }

  /**
   * Setup keyboard shortcuts (for debugging)
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + D = Show debug state
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        console.table({
          Step: bookingState.currentStep,
          Services: bookingState.selectedServices?.length || 0,
          Date: bookingState.calendar?.selectedDate || 'Not selected',
          Time: bookingState.calendar?.selectedTime || 'Not selected',
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

  // Export for debugging
  window.__PHENOM_STATE__ = bookingState;

  // TEMPORARY: Expose functions for inline event handlers in HTML
  window.nextStep = navNextStep;
  window.prevStep = navPrevStep;
  window.toggleDiva = toggleDiva;
  window.safetyToggle = safetyToggle;

  console.log('📦 PhenomeBeauty Booking System ready');
  
} catch (moduleError) {
  console.error('❌ CRITICAL: Failed to load modules:', moduleError);
  console.error('Module error stack:', moduleError.stack);
  
  // Show user-friendly error
  document.body.innerHTML = `
    <div style="padding: 40px; text-align: center; font-family: system-ui;">
      <h1 style="color: #e53935;">⚠️ Loading Error</h1>
      <p style="color: #666; margin: 20px 0;">The booking system failed to load.</p>
      <button onclick="location.reload()" style="padding: 12px 24px; background: #e53935; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
        Refresh Page
      </button>
      <p style="color: #999; margin-top: 30px; font-size: 14px;">Error: ${moduleError.message}</p>
    </div>
  `;
}
