// public/js/main.js — Main application entry point
'use strict';

(async () => {
  try {
    // Import all required modules
    const { bookingState, updateState, subscribe } = await import('./state.js');
    const { fetchAppConfig } = await import('./api.js');
    const { updateStepUI, setLoading, showToast } = await import('./ui.js');
    const { loadServices, toggleService, removeServiceFromCart } = await import('./services.js');
    const { nextStep: navNextStep, prevStep: navPrevStep } = await import('./navigation.js');
    const { initAccessibility } = await import('./accessibility.js');
    const { initPerformance, logPerformanceMetrics, setupCacheCleanup } = await import('./performance.js');
    
    // Optional modules (won't break if they fail)
    let initCalendar, initClientDetails, toggleDiva, safetyToggle;
    try {
      const calendar = await import('./calendar.js');
      initCalendar = calendar.initCalendar;
    } catch (e) { console.warn('Calendar module not available'); }
    
    try {
      const clientDetails = await import('./client-details.js');
      initClientDetails = clientDetails.initClientDetails;
      toggleDiva = clientDetails.toggleDiva;
      safetyToggle = clientDetails.safetyToggle;
    } catch (e) { console.warn('Client details module not available'); }

    /**
     * Initialize booking application
     */
    async function init() {
      try {
        setLoading(true, 'Loading...');
        
        // Load app configuration
        const config = await fetchAppConfig();
        updateState({ config });
        
        // Initialize features
        initAccessibility();
        initPerformance();
        setupCacheCleanup();
        
        // Load services (critical)
        await loadServices();
        
        // Initialize optional modules
        if (initCalendar) initCalendar();
        if (initClientDetails) initClientDetails();
        
        // Show Step 1
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
        showToast('Please refresh the page', true);
      } finally {
        setLoading(false);
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

    /**
     * Handle page visibility
     */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && bookingState.currentStep === 2) {
        console.log('Page visible, calendar will refresh');
      }
    });

    /**
     * Keyboard shortcuts (dev mode)
     */
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

    // Expose functions for inline handlers (temporary)
    window.nextStep = navNextStep;
    window.prevStep = navPrevStep;
    if (toggleDiva) window.toggleDiva = toggleDiva;
    if (safetyToggle) window.safetyToggle = safetyToggle;

    // Initialize when ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    
  } catch (error) {
    // Silent fallback - just show loading spinner
    console.error('Module loading failed:', error);
    
    // Keep the page showing loading state
    const btn = document.getElementById('btn-next');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Loading...';
    }
    
    // Try to reload after 2 seconds
    setTimeout(() => {
      console.log('Auto-reloading page...');
      location.reload();
    }, 2000);
  }
})();
