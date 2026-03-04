// public/js/client-details.js — Client details form (Step 3)
// Extracted from index.html with SECURE address autocomplete
'use strict';

import { bookingState, setStatePath } from './state.js';
import { fetchAddressSuggestions } from './api.js';
import { showToast, escHtml, updateNextBtn, debounce } from './ui.js';

let addrDebounceTimer = null;

/**
 * Initialize client details step
 */
export function initDetailsStep() {
  initPhoneInput();
  initPlacesAutocomplete();
  initDivaToggle();
  initSafetySection();
  
  // Attach form field listeners
  attachFormListeners();
  
  updateNextBtn();
}

/**
 * Initialize phone input with country code dropdown
 */
function initPhoneInput() {
  const select = document.getElementById('phone-country');
  const input = document.getElementById('client-phone');
  
  if (!select || !input) return;
  
  // Popular country codes for South Africa and region
  const countries = [
    { code: '+27', name: 'South Africa', flag: '🇿🇦' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+1', name: 'United States', flag: '🇺🇸' },
    { code: '+91', name: 'India', flag: '🇮🇳' },
  ];
  
  select.innerHTML = countries.map(c => 
    `<option value="${c.code}">${c.flag} ${c.code}</option>`
  ).join('');
  
  select.value = '+27'; // Default to South Africa
  
  // Update state on change
  input.addEventListener('input', () => {
    const normalized = normalizePhone();
    setStatePath('client.phone', normalized);
    validatePhone(input);
    updateNextBtn();
  });
  
  select.addEventListener('change', () => {
    const normalized = normalizePhone();
    setStatePath('client.phone', normalized);
    updateNextBtn();
  });
}

/**
 * Normalize phone number to E.164 format
 * @returns {String} - Normalized phone number
 */
export function normalizePhone() {
  const select = document.getElementById('phone-country');
  const input = document.getElementById('client-phone');
  
  if (!input) return '';
  
  const countryCode = select ? select.value : '+27';
  let raw = input.value.replace(/[\s\-().]/g, '');
  
  if (raw.startsWith('+')) {
    // Remove patterns like +27(0) -> +27
    raw = raw.replace(/^(\+\d{1,3})(0)/, '$1');
    return raw;
  }
  
  // Remove leading zero and add country code
  raw = raw.replace(/^0/, '');
  return countryCode + raw;
}

/**
 * Validate phone number input
 */
function validatePhone(input) {
  const phone = normalizePhone();
  const isValid = /^\+\d{10,15}$/.test(phone);
  
  input.classList.toggle('input-valid', isValid && phone.length >= 12);
  input.classList.toggle('input-error', !isValid && phone.length > 5);
}

/**
 * Initialize Places autocomplete (SECURE - uses server-side proxy)
 */
function initPlacesAutocomplete() {
  const input = document.getElementById('client-address');
  const dropdown = document.getElementById('addr-suggestions');
  
  if (!input || !dropdown || input.dataset.acAttached) return;
  input.dataset.acAttached = '1';
  
  // Input handler with debounce
  input.addEventListener('input', () => {
    setStatePath('ui.addressConfirmed', false);
    input.classList.remove('input-valid', 'input-error');
    updateNextBtn();
    
    clearTimeout(addrDebounceTimer);
    const query = input.value.trim();
    
    if (query.length < 3) {
      closeDropdown();
      return;
    }
    
    // Debounce: 220ms
    addrDebounceTimer = setTimeout(async () => {
      try {
        // Call SECURE server-side proxy instead of Google directly
        const suggestions = await fetchAddressSuggestions(query);
        
        if (!suggestions || suggestions.length === 0) {
          closeDropdown();
          return;
        }
        
        // Render suggestions
        dropdown.innerHTML = suggestions.map(s => `
          <div class="addr-suggestion-item" data-full="${escHtml(s.fullText)}">
            <div class="addr-suggestion-main">${escHtml(s.mainText)}</div>
            ${s.secondaryText ? `<div class="addr-suggestion-sec">${escHtml(s.secondaryText)}</div>` : ''}
          </div>
        `).join('');
        
        // Attach click listeners
        dropdown.querySelectorAll('.addr-suggestion-item').forEach(item => {
          item.addEventListener('mousedown', e => e.preventDefault());
          item.addEventListener('click', () => {
            input.value = item.dataset.full;
            setStatePath('client.address', item.dataset.full);
            setStatePath('ui.addressConfirmed', true);
            input.classList.add('input-valid');
            input.classList.remove('input-error');
            closeDropdown();
            updateNextBtn();
          });
        });
        
        dropdown.classList.add('open');
        
      } catch (error) {
        console.error('Address autocomplete error:', error);
        closeDropdown();
      }
    }, 220);
  });
  
  // Keyboard navigation
  input.addEventListener('keydown', e => {
    const items = [...dropdown.querySelectorAll('.addr-suggestion-item')];
    const active = dropdown.querySelector('.addr-suggestion-item.active');
    let idx = items.indexOf(active);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = (idx + 1) % items.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = (idx - 1 + items.length) % items.length;
    } else if (e.key === 'Enter' && active) {
      e.preventDefault();
      active.click();
      return;
    } else if (e.key === 'Escape') {
      closeDropdown();
      return;
    }
    
    items.forEach(i => i.classList.remove('active'));
    if (items[idx]) items[idx].classList.add('active');
  });
  
  // Close on outside click
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });
}

/**
 * Close address dropdown
 */
function closeDropdown() {
  const dropdown = document.getElementById('addr-suggestions');
  if (dropdown) {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
  }
}

/**
 * Initialize Diva toggle (existing vs new client)
 */
function initDivaToggle() {
  const existingBtn = document.getElementById('btn-diva-existing');
  const newBtn = document.getElementById('btn-diva-new');
  const safetySection = document.getElementById('safety-section');
  
  if (!existingBtn || !newBtn) return;
  
  existingBtn.addEventListener('click', () => {
    setStatePath('client.divaType', 'existing');
    existingBtn.classList.add('active');
    newBtn.classList.remove('active');
    if (safetySection) safetySection.style.display = 'none';
    updateNextBtn();
  });
  
  newBtn.addEventListener('click', () => {
    setStatePath('client.divaType', 'new');
    newBtn.classList.add('active');
    existingBtn.classList.remove('active');
    if (safetySection) safetySection.style.display = 'block';
    updateNextBtn();
  });
}

/**
 * Initialize safety assessment section (8 questions)
 */
function initSafetySection() {
  const section = document.getElementById('safety-section');
  if (!section) return;
  
  // Attach listeners to all safety inputs
  const inputs = section.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('change', () => {
      const field = input.name || input.id;
      const value = input.type === 'checkbox' ? input.checked : input.value;
      setStatePath(`client.safety.${field}`, value);
    });
  });
}

/**
 * Attach form field listeners
 */
function attachFormListeners() {
  const nameInput = document.getElementById('client-name');
  const emailInput = document.getElementById('client-email');
  
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const value = nameInput.value.trim();
      setStatePath('client.name', value);
      nameInput.classList.toggle('input-valid', value.length >= 2);
      nameInput.classList.toggle('input-error', value.length > 0 && value.length < 2);
      updateNextBtn();
    });
  }
  
  if (emailInput) {
    emailInput.addEventListener('input', debounce(() => {
      const value = emailInput.value.trim();
      setStatePath('client.email', value);
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      emailInput.classList.toggle('input-valid', isValid);
      emailInput.classList.toggle('input-error', value.length > 0 && !isValid);
      updateNextBtn();
    }, 300));
  }
}

/**
 * Validate details step
 * @returns {Boolean} - Whether step is valid
 */
export function validateDetailsStep() {
  const errors = [];
  
  if (bookingState.client.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (bookingState.client.phone.length < 10) {
    errors.push('Please enter a valid phone number');
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingState.client.email)) {
    errors.push('Please enter a valid email address');
  }
  
  if (bookingState.client.address.length < 5) {
    errors.push('Please enter your address');
  }
  
  if (!bookingState.ui.addressConfirmed) {
    errors.push('Please select an address from the suggestions');
  }
  
  if (errors.length > 0) {
    showToast(errors[0], true);
    return false;
  }
  
  return true;
}

/**
 * Get client details summary for review
 * @returns {Object} - Client details
 */
export function getClientSummary() {
  return {
    name: bookingState.client.name,
    phone: bookingState.client.phone,
    email: bookingState.client.email,
    address: bookingState.client.address,
    divaType: bookingState.client.divaType,
    safety: bookingState.client.safety,
  };
}
