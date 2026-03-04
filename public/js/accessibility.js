// public/js/accessibility.js — Accessibility enhancements
// ARIA labels, keyboard navigation, screen reader support
'use strict';

import { getCurrentStep } from './state.js';
import { nextStep, prevStep } from './navigation.js';

/**
 * Initialize accessibility features
 */
export function initAccessibility() {
  setupKeyboardNavigation();
  setupARIALabels();
  setupFocusManagement();
  setupSkipLinks();
  setupLiveRegions();
  
  console.log('♿ Accessibility features enabled');
}

/**
 * Setup keyboard navigation shortcuts
 */
function setupKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    // Don't interfere with form inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Arrow key navigation between steps (Ctrl+Arrow)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextBtn = document.getElementById('btn-next');
        if (nextBtn && !nextBtn.disabled) {
          nextStep();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const backBtn = document.getElementById('btn-back');
        if (backBtn && backBtn.style.display !== 'none') {
          prevStep();
        }
      }
    }
    
    // Tab trap for modals (if any)
    if (e.key === 'Tab') {
      const modal = document.querySelector('.modal.open');
      if (modal) {
        trapFocusInModal(e, modal);
      }
    }
  });
}

/**
 * Trap focus within a modal dialog
 */
function trapFocusInModal(e, modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault();
    lastElement.focus();
  } else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault();
    firstElement.focus();
  }
}

/**
 * Setup ARIA labels and roles
 */
function setupARIALabels() {
  // Main navigation buttons
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  
  if (backBtn) {
    backBtn.setAttribute('aria-label', 'Go to previous step');
  }
  
  if (nextBtn) {
    nextBtn.setAttribute('aria-label', 'Continue to next step');
    // Update dynamically when it changes to "Confirm Booking"
    const observer = new MutationObserver(() => {
      if (nextBtn.textContent.includes('Confirm')) {
        nextBtn.setAttribute('aria-label', 'Confirm and submit booking');
      }
    });
    observer.observe(nextBtn, { childList: true, characterData: true, subtree: true });
  }
  
  // Step indicators
  document.querySelectorAll('.step-dot').forEach((dot, idx) => {
    const stepNum = idx + 1;
    const stepNames = ['Select Services', 'Choose Date & Time', 'Enter Details', 'Review & Pay'];
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `Step ${stepNum}: ${stepNames[idx]}`);
    dot.setAttribute('tabindex', '0');
  });
  
  // Service cards
  document.addEventListener('DOMContentLoaded', () => {
    updateServiceCardARIA();
  });
  
  // Calendar days
  updateCalendarARIA();
}

/**
 * Update ARIA labels for service cards
 */
export function updateServiceCardARIA() {
  document.querySelectorAll('.service-card').forEach(card => {
    const serviceName = card.querySelector('.service-title')?.textContent || 'Service';
    const price = card.querySelector('.service-price')?.textContent || '';
    const isSelected = card.classList.contains('selected');
    
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', isSelected.toString());
    card.setAttribute('aria-label', 
      `${serviceName}, ${price}. ${isSelected ? 'Selected' : 'Not selected'}. Press Enter to ${isSelected ? 'deselect' : 'select'}.`
    );
  });
}

/**
 * Update ARIA labels for calendar
 */
export function updateCalendarARIA() {
  setTimeout(() => {
    document.querySelectorAll('.cal-day').forEach(day => {
      const dateStr = day.dataset.date;
      if (!dateStr) return;
      
      const isAvailable = day.classList.contains('cal-day-available');
      const isSelected = day.classList.contains('cal-day-selected');
      const isToday = day.classList.contains('cal-day-today');
      const isPast = day.classList.contains('cal-day-past');
      
      if (isAvailable || isSelected) {
        day.setAttribute('role', 'button');
        day.setAttribute('aria-pressed', isSelected.toString());
        
        const [year, month, dayNum] = dateStr.split('-');
        const date = new Date(year, month - 1, dayNum);
        const dateFormatted = date.toLocaleDateString('en-ZA', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
        
        let label = dateFormatted;
        if (isToday) label += ', Today';
        if (isSelected) label += ', Selected';
        label += '. Press Enter to select.';
        
        day.setAttribute('aria-label', label);
      } else if (isPast) {
        day.setAttribute('aria-label', 'Past date, unavailable');
        day.setAttribute('aria-disabled', 'true');
      } else {
        day.setAttribute('aria-label', 'No available time slots');
        day.setAttribute('aria-disabled', 'true');
      }
    });
  }, 100);
}

/**
 * Setup focus management for step transitions
 */
function setupFocusManagement() {
  // When step changes, focus the main heading
  const observer = new MutationObserver(() => {
    const currentStep = getCurrentStep();
    const stepPanel = document.querySelector(`#step-${currentStep}`);
    
    if (stepPanel) {
      const heading = stepPanel.querySelector('h2, h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
        // Remove tabindex after focus to restore natural tab order
        heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
      }
    }
  });
  
  // Observe step panel visibility changes
  document.querySelectorAll('.step-panel').forEach(panel => {
    observer.observe(panel, { attributes: true, attributeFilter: ['style'] });
  });
}

/**
 * Setup skip links for screen readers
 */
function setupSkipLinks() {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.textContent = 'Skip to main content';
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--obs-accent);
    color: white;
    padding: 8px 16px;
    text-decoration: none;
    z-index: 10000;
    transition: top 0.2s;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add ID to main content if not present
  const mainContent = document.querySelector('.step-panels');
  if (mainContent && !mainContent.id) {
    mainContent.id = 'main-content';
  }
}

/**
 * Setup ARIA live regions for dynamic updates
 */
function setupLiveRegions() {
  // Create live region for toast notifications
  const liveRegion = document.createElement('div');
  liveRegion.id = 'aria-live-region';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  liveRegion.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
  
  document.body.appendChild(liveRegion);
  
  // Observe toast container for new toasts
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.id === 'toast' && node.textContent) {
          liveRegion.textContent = node.textContent;
        }
      });
    });
  });
  
  observer.observe(document.body, { childList: true });
}

/**
 * Announce message to screen readers
 * @param {String} message - Message to announce
 * @param {String} priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(message, priority = 'polite') {
  const liveRegion = document.getElementById('aria-live-region');
  if (liveRegion) {
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;
    
    // Clear after 1 second to allow re-announcing same message
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }
}

/**
 * Add screen reader only text
 * @param {String} text - Text for screen readers
 * @returns {HTMLElement} - Screen reader only span
 */
export function createSROnlyText(text) {
  const span = document.createElement('span');
  span.className = 'sr-only';
  span.textContent = text;
  span.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;
  return span;
}

/**
 * Ensure all images have alt text
 */
export function ensureImageAltText() {
  document.querySelectorAll('img:not([alt])').forEach(img => {
    console.warn('Image without alt text:', img.src);
    img.setAttribute('alt', 'Decorative image');
  });
}
