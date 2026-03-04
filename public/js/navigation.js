// public/js/navigation.js — Step navigation and validation
// Extracted from index.html navigation logic
'use strict';

import { bookingState, setCurrentStep, getCurrentStep, isStepValid } from './state.js';
import { updateStepUI, showToast, scrollToTop } from './ui.js';
import { initCalendar } from './calendar.js';
import { initDetailsStep, validateDetailsStep } from './client-details.js';
import { initReviewStep, submitBookingForm } from './payment.js';

/**
 * Navigate to next step
 */
export async function nextStep() {
  const current = getCurrentStep();
  
  // Validate current step before proceeding
  if (!validateCurrentStep(current)) {
    return;
  }
  
  // Move to next step
  const next = Math.min(4, current + 1);
  
  // Special handling for step 4 (submit booking)
  if (current === 4) {
    await submitBookingForm();
    return;
  }
  
  setCurrentStep(next);
  updateStepUI(next);
  scrollToTop();
  
  // Initialize step-specific functionality
  await initStep(next);
}

/**
 * Navigate to previous step
 */
export function prevStep() {
  const current = getCurrentStep();
  const prev = Math.max(1, current - 1);
  
  setCurrentStep(prev);
  updateStepUI(prev);
  scrollToTop();
  
  // Re-initialize previous step if needed
  initStep(prev);
}

/**
 * Go directly to a specific step
 * @param {Number} step - Target step (1-4)
 */
export function goToStep(step) {
  const target = Math.max(1, Math.min(4, step));
  const current = getCurrentStep();
  
  // Validate all steps between current and target
  if (target > current) {
    for (let i = current; i < target; i++) {
      if (!isStepValid(i)) {
        showToast(`Please complete Step ${i} first`, true);
        return;
      }
    }
  }
  
  setCurrentStep(target);
  updateStepUI(target);
  scrollToTop();
  
  initStep(target);
}

/**
 * Initialize step-specific functionality
 * @param {Number} step - Step number
 */
async function initStep(step) {
  switch (step) {
    case 1:
      // Services already loaded on page load
      break;
      
    case 2:
      // Initialize calendar
      await initCalendar();
      break;
      
    case 3:
      // Initialize details step
      initDetailsStep();
      break;
      
    case 4:
      // Initialize review/payment step
      await initReviewStep();
      break;
  }
}

/**
 * Validate current step
 * @param {Number} step - Step to validate
 * @returns {Boolean} - Whether step is valid
 */
export function validateCurrentStep(step) {
  switch (step) {
    case 1:
      // Services must be selected
      if (bookingState.selectedServices.length === 0) {
        showToast('Please select at least one service', true);
        return false;
      }
      return true;
      
    case 2:
      // Date and time must be selected
      if (!bookingState.calendar.selectedDate) {
        showToast('Please select a date', true);
        return false;
      }
      if (!bookingState.calendar.selectedTime) {
        showToast('Please select a time slot', true);
        return false;
      }
      return true;
      
    case 3:
      // Validate client details
      return validateDetailsStep();
      
    case 4:
      // Review step - always valid
      return true;
      
    default:
      return false;
  }
}

/**
 * Setup navigation button listeners
 */
export function setupNavigation() {
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  
  if (backBtn) {
    backBtn.addEventListener('click', prevStep);
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', nextStep);
  }
  
  // Setup step dot navigation
  document.querySelectorAll('.step-dot').forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      goToStep(idx + 1);
    });
  });
}
