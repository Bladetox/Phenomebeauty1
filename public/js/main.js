// public/js/main.js — Main application entry point with welcome splash
'use strict';

(async () => {
  try {
    // Import modules
    const { bookingState, updateState, subscribe } = await import('./state.js');
    const { fetchAppConfig } = await import('./api.js');
    const { updateStepUI, showToast } = await import('./ui.js');
    const { loadServices, toggleService, removeServiceFromCart } = await import('./services.js');
    const { nextStep: navNextStep, prevStep: navPrevStep } = await import('./navigation.js');
    const { initAccessibility } = await import('./accessibility.js');
    const { initPerformance, logPerformanceMetrics, setupCacheCleanup } = await import('./performance.js');
    
    // Optional modules
    let initCalendar, initClientDetails, toggleDiva, safetyToggle;
    try {
      const calendar = await import('./calendar.js');
      initCalendar = calendar.initCalendar;
    } catch (e) { console.warn('Calendar module optional'); }
    
    try {
      const clientDetails = await import('./client-details.js');
      initClientDetails = clientDetails.initClientDetails;
      toggleDiva = clientDetails.toggleDiva;
      safetyToggle = clientDetails.safetyToggle;
    } catch (e) { console.warn('Client details module optional'); }

    /**
     * Initialize booking application
     */
    async function init() {
      try {
        // Load config and services in parallel (silently in background)
        const [config] = await Promise.all([
          fetchAppConfig(),
          loadServices(), // This loads while splash is showing
        ]);
        
        updateState({ config });
        
        // Initialize features
        initAccessibility();
        initPerformance();
        setupCacheCleanup();
        
        // Initialize optional modules
        if (initCalendar) initCalendar();
        if (initClientDetails) initClientDetails();
        
        // Hide splash and show Step 1
        hideSplash();
        updateStepUI(1);
        
        // Setup event listeners
        setupEventListeners();
        
        // Dev mode logging
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          subscribe((state) => console.log('State:', state));
          logPerformanceMetrics();
        }
        
      } catch (error) {
        console.error('Init error:', error);
        hideSplash();
        showToast('Please refresh the page', true);
      }
    }

    /**
     * Hide splash screen with fade animation
     */
    function hideSplash() {
      const splash = document.getElementById('welcome-splash');
      if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
          splash.style.display = 'none';
        }, 300);
      }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
      const btnNext = document.getElementById('btn-next');
      const btnBack = document.getElementById('btn-back');
      
      if (btnNext) btnNext.addEventListener('click', navNextStep);
      if (btnBack) btnBack.addEventListener('click', navPrevStep);
    }

    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && bookingState.currentStep === 2) {
        console.log('Page visible');
      }
    });

    // Keyboard shortcuts (dev)
    document.addEventListener('keydown', (e) => {
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
    });

    // Export for debugging
    window.__PHENOM_STATE__ = bookingState;

    // Expose functions for inline handlers
    window.nextStep = navNextStep;
    window.prevStep = navPrevStep;
    if (toggleDiva) window.toggleDiva = toggleDiva;
    if (safetyToggle) window.safetyToggle = safetyToggle;

    // Initialize
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    
  } catch (error) {
    console.error('Module loading failed:', error);
    // Silent fallback - just reload
    setTimeout(() => location.reload(), 2000);
  }
})();
