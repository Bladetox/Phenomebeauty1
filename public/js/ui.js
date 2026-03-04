// public/js/ui.js — UI utilities and helper functions
// Extracts UI functions from index.html
'use strict';

import { bookingState, getCurrentStep } from './state.js';

/**
 * Show toast notification
 * @param {String} message - Toast message
 * @param {Boolean} isError - Whether this is an error toast
 */
export function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, isError ? 4000 : 2500);
}

/**
 * HTML escape helper
 * @param {String} str - String to escape
 * @returns {String} - Escaped string
 */
export function escHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Update step progress UI (progress bars, dots, and views)
 * @param {Number} step - Current step (1-4)
 */
export function updateStepUI(step) {
  // Update title
  const titles = ['Choose Services', 'Pick Date & Time', 'Your Details', 'Review Booking'];
  const titleEl = document.getElementById('view-title');
  if (titleEl) {
    titleEl.textContent = titles[step - 1] || '';
  }
  
  // Update progress bars
  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById(`step-bar-${i}`);
    if (!bar) continue;
    
    bar.classList.remove('pb-active');
    
    if (i < step) {
      bar.style.width = '100%';
    } else if (i === step) {
      bar.style.width = '60%';
      bar.classList.add('pb-active');
    } else {
      bar.style.width = '0';
    }
  }
  
  // Update step dots
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`sdot-${i}`);
    if (!dot) continue;
    
    dot.classList.remove('sd-done', 'sd-active');
    
    if (i < step) {
      dot.classList.add('sd-done');
    } else if (i === step) {
      dot.classList.add('sd-active');
    }
  }
  
  // Update view visibility
  const views = {
    1: 'step-services',
    2: 'step-datetime',
    3: 'step-details',
    4: 'step-summary'
  };
  
  Object.keys(views).forEach(s => {
    const viewId = views[s];
    const view = document.getElementById(viewId);
    if (view) {
      view.classList.toggle('active', parseInt(s) === step);
    }
  });
  
  // Hide success view
  const successView = document.getElementById('success-view');
  if (successView) {
    successView.classList.remove('active');
  }
  
  // Update navigation buttons
  updateNavigationButtons(step);
  
  // Update next button state
  updateNextBtn();
}

/**
 * Update navigation button states
 * @param {Number} step - Current step
 */
function updateNavigationButtons(step) {
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  const actionsBar = document.getElementById('actions-bar');
  
  if (backBtn) {
    backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
  }
  
  if (nextBtn) {
    if (step === 4) {
      nextBtn.textContent = 'Confirm & Pay';
    } else {
      nextBtn.textContent = 'Next';
    }
  }
  
  // Show/hide actions bar
  if (actionsBar) {
    actionsBar.style.display = step <= 4 ? 'flex' : 'none';
  }
}

/**
 * Update next button enabled/disabled state
 */
export function updateNextBtn() {
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  
  const step = getCurrentStep();
  let canProceed = false;
  
  switch (step) {
    case 1:
      canProceed = (bookingState.selectedServices || []).length > 0;
      break;
      
    case 2:
      canProceed = !!(bookingState.calendar?.selectedDate && bookingState.calendar?.selectedTime);
      break;
      
    case 3:
      const c = bookingState.client || {};
      const ui = bookingState.ui || {};
      canProceed = (
        c.name?.length >= 2 &&
        c.phone?.length >= 7 &&
        c.email?.includes('@') &&
        c.address?.length >= 5
      );
      break;
      
    case 4:
      canProceed = true;
      break;
  }
  
  btn.disabled = !canProceed;
}

/**
 * Show loading state
 * @param {Boolean} isLoading - Whether to show loading
 * @param {String} message - Optional loading message
 */
export function setLoading(isLoading, message = 'Loading...') {
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="loader"></span> ${escHtml(message)}`;
  } else {
    updateNextBtn();
    const step = getCurrentStep();
    btn.textContent = step === 4 ? 'Confirm & Pay' : 'Next';
  }
}

/**
 * Format currency (South African Rand)
 * @param {Number} amount - Amount in ZAR
 * @returns {String} - Formatted currency string
 */
export function formatCurrency(amount) {
  return `R${Number(amount).toFixed(2)}`;
}

/**
 * Format date for display
 * @param {String} dateStr - Date string (YYYY-MM-DD)
 * @returns {String} - Formatted date (e.g., "Mon, 15 Jan 2026")
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-ZA', options);
}

/**
 * Format time range for display
 * @param {String} timeStr - Time string (HH:MM)
 * @returns {String} - Formatted time
 */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr;
}

/**
 * Scroll to top smoothly
 */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Scroll to element smoothly
 * @param {String} selector - CSS selector
 */
export function scrollToElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {Number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Add shake animation to element (for validation errors)
 * @param {HTMLElement} element - Element to shake
 */
export function shakeElement(element) {
  if (!element) return;
  
  element.classList.add('shake');
  setTimeout(() => element.classList.remove('shake'), 500);
}
