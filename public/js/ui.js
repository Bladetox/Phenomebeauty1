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
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, isError ? 5000 : 3000);
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
 * Update step progress UI (progress bars and dots)
 * @param {Number} step - Current step (1-4)
 */
export function updateStepUI(step) {
  // Update progress bars
  const bars = document.querySelectorAll('.step-pill-inner');
  bars.forEach((bar, idx) => {
    const barStep = idx + 1;
    bar.classList.remove('pb-active');
    
    if (barStep < step) {
      // Completed step
      bar.style.width = '100%';
    } else if (barStep === step) {
      // Current step
      bar.style.width = '60%';
      bar.classList.add('pb-active');
    } else {
      // Future step
      bar.style.width = '0';
    }
  });
  
  // Update step dots
  const dots = document.querySelectorAll('.step-dot');
  dots.forEach((dot, idx) => {
    const dotStep = idx + 1;
    dot.classList.remove('sd-done', 'sd-active');
    
    if (dotStep < step) {
      dot.classList.add('sd-done');
    } else if (dotStep === step) {
      dot.classList.add('sd-active');
    }
  });
  
  // Update step panel visibility
  document.querySelectorAll('.step-panel').forEach((panel, idx) => {
    panel.style.display = (idx + 1 === step) ? 'block' : 'none';
  });
  
  // Update navigation buttons
  updateNavigationButtons(step);
}

/**
 * Update navigation button states
 * @param {Number} step - Current step
 */
function updateNavigationButtons(step) {
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  
  if (backBtn) {
    backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
  }
  
  if (nextBtn) {
    if (step === 4) {
      nextBtn.textContent = 'Confirm Booking';
      nextBtn.classList.add('pulse');
    } else {
      nextBtn.textContent = 'Next Step';
      nextBtn.classList.remove('pulse');
    }
  }
}

/**
 * Update next button enabled/disabled state
 * Call this after state changes to reflect validation
 */
export function updateNextBtn() {
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  
  const step = getCurrentStep();
  let canProceed = false;
  
  switch (step) {
    case 1:
      canProceed = bookingState.selectedServices.length > 0;
      break;
    case 2:
      canProceed = bookingState.calendar.selectedDate && bookingState.calendar.selectedTime;
      break;
    case 3:
      canProceed = (
        bookingState.client.name.length >= 2 &&
        bookingState.client.phone.length >= 10 &&
        bookingState.client.email.includes('@') &&
        bookingState.client.address.length >= 5 &&
        bookingState.ui.addressConfirmed
      );
      break;
    case 4:
      canProceed = true;
      break;
  }
  
  btn.disabled = !canProceed;
  btn.classList.toggle('disabled', !canProceed);
}

/**
 * Show loading state
 * @param {Boolean} isLoading - Whether to show loading
 * @param {String} message - Optional loading message
 */
export function setLoading(isLoading, message = 'Loading...') {
  const loader = document.getElementById('global-loader');
  const loaderText = document.getElementById('loader-text');
  
  if (!loader) {
    // Create loader if it doesn't exist
    const div = document.createElement('div');
    div.id = 'global-loader';
    div.className = 'global-loader';
    div.innerHTML = `
      <div class="loader-content">
        <div class="loader"></div>
        <p id="loader-text">${escHtml(message)}</p>
      </div>
    `;
    document.body.appendChild(div);
  } else {
    if (loaderText) loaderText.textContent = message;
  }
  
  const loaderEl = document.getElementById('global-loader');
  if (loaderEl) {
    loaderEl.style.display = isLoading ? 'flex' : 'none';
  }
  
  bookingState.ui.isLoading = isLoading;
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
 * @param {String} timeStr - Time string (HH:MM-HH:MM)
 * @returns {String} - Formatted time
 */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr;  // Already in good format
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
