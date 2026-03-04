// public/js/services.js — Service selection and cart rendering
// Extracted from original index.html Step 1 functionality
'use strict';

import { bookingState, updateState } from './state.js';
import { fetchServices } from './api.js';
import { showToast, updateNextBtn, setLoading } from './ui.js';

/**
 * Load services from API and render
 */
export async function loadServices() {
  setLoading(true, 'Loading services...');
  
  try {
    const services = await fetchServices();
    updateState({ services });
    renderCategoryChips();
    renderServices();
    updateCart();
  } catch (error) {
    console.error('Failed to load services:', error);
    showToast(error.message || 'Failed to load services', true);
  } finally {
    setLoading(false);
  }
}

/**
 * Render category filter chips
 */
function renderCategoryChips() {
  const chipContainer = document.getElementById('category-chips');
  if (!chipContainer) return;
  
  const services = bookingState.services || [];
  const categories = [...new Set(services.map(s => s.category).filter(Boolean))];
  const activeCategory = bookingState.ui?.activeCategory || 'All';
  
  const chips = ['All', ...categories].map(cat => `
    <div class="chip ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </div>
  `).join('');
  
  chipContainer.innerHTML = chips;
  
  // Attach click handlers
  chipContainer.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const category = chip.dataset.category;
      if (!bookingState.ui) bookingState.ui = {};
      bookingState.ui.activeCategory = category;
      renderCategoryChips();
      renderServices();
    });
  });
}

/**
 * Render service cards
 */
function renderServices() {
  const container = document.getElementById('services-list');
  if (!container) return;
  
  const services = bookingState.services || [];
  const activeCategory = bookingState.ui?.activeCategory || 'All';
  
  // Filter by active category
  const filtered = activeCategory === 'All'
    ? services
    : services.filter(s => s.category === activeCategory);
  
  // Group by category
  const grouped = {};
  filtered.forEach(service => {
    const cat = service.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(service);
  });
  
  // Render
  let html = '';
  Object.keys(grouped).forEach(cat => {
    html += `<div class="category-title">${cat}</div>`;
    grouped[cat].forEach(service => {
      html += renderServiceCard(service);
    });
  });
  
  container.innerHTML = html || '<p style="color:rgba(255,255,255,0.38);padding:20px;text-align:center;">No services available</p>';
  
  // Attach click handlers
  container.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      const serviceId = card.dataset.sid;
      toggleService(serviceId);
    });
  });
}

/**
 * Render a single service card (matches original HTML structure)
 * @param {Object} s - Service object
 */
function renderServiceCard(s) {
  const selected = bookingState.selectedServices?.some(sel => sel.id === s.id);
  const price = parseFloat(s.price || 0);
  const duration = parseInt(s.duration || 0);
  
  return `
    <div class="service-card ${selected ? 'selected' : ''}" data-sid="${s.id}">
      <div class="service-main">
        <div class="service-header">
          <div class="service-name">${s.name}</div>
          <div class="service-price">R${price}</div>
        </div>
        <div class="service-meta">${duration} min${s.description ? ' • ' + s.description : ''}</div>
      </div>
      <div class="check-circle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    </div>
  `;
}

/**
 * Toggle service selection
 * @param {String} serviceId
 */
export function toggleService(serviceId) {
  if (!bookingState.selectedServices) {
    bookingState.selectedServices = [];
  }
  
  const service = bookingState.services.find(s => s.id === serviceId);
  if (!service) return;
  
  const idx = bookingState.selectedServices.findIndex(s => s.id === serviceId);
  
  if (idx > -1) {
    // Remove
    bookingState.selectedServices.splice(idx, 1);
  } else {
    // Add
    if (bookingState.selectedServices.length >= 10) {
      showToast('Maximum 10 services per booking', true);
      return;
    }
    bookingState.selectedServices.push(service);
  }
  
  // Re-render
  renderServices();
  updateCart();
  updateNextBtn();
}

/**
 * Remove service from cart
 * @param {String} serviceId
 */
export function removeServiceFromCart(serviceId) {
  if (!bookingState.selectedServices) return;
  
  bookingState.selectedServices = bookingState.selectedServices.filter(s => s.id !== serviceId);
  renderServices();
  updateCart();
  updateNextBtn();
}

/**
 * Update cart display
 */
export function updateCart() {
  const cartBar = document.getElementById('cart-bar');
  const cartItems = document.getElementById('cart-items-list');
  const cartTotal = document.getElementById('cart-total-price');
  const cartDuration = document.getElementById('cart-duration');
  
  if (!cartBar || !cartItems || !cartTotal) return;
  
  const selected = bookingState.selectedServices || [];
  
  if (selected.length === 0) {
    cartBar.classList.remove('visible');
    return;
  }
  
  // Show cart
  cartBar.classList.add('visible');
  
  // Calculate totals
  let totalPrice = 0;
  let totalDuration = 0;
  
  const itemsHtml = selected.map(s => {
    const price = parseFloat(s.price || 0);
    const duration = parseInt(s.duration || 0);
    totalPrice += price;
    totalDuration += duration;
    
    return `
      <div class="cart-item">
        <span class="cart-item-name">${s.name}</span>
        <span class="cart-item-price">R${price}</span>
        <span class="cart-remove" data-sid="${s.id}">×</span>
      </div>
    `;
  }).join('');
  
  cartItems.innerHTML = itemsHtml;
  cartTotal.textContent = `R${totalPrice}`;
  
  if (cartDuration) {
    cartDuration.textContent = `Total duration: ${totalDuration} min`;
  }
  
  // Update global state
  if (!bookingState.pricing) bookingState.pricing = {};
  bookingState.pricing.servicesTotal = totalPrice;
  bookingState.pricing.totalDuration = totalDuration;
  
  // Attach remove handlers
  cartItems.querySelectorAll('.cart-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const serviceId = btn.dataset.sid;
      removeServiceFromCart(serviceId);
    });
  });
}

/**
 * Get total price of selected services
 */
export function getServicesTotal() {
  return (bookingState.selectedServices || []).reduce((sum, s) => {
    return sum + parseFloat(s.price || 0);
  }, 0);
}

/**
 * Get total duration of selected services
 */
export function getTotalDuration() {
  return (bookingState.selectedServices || []).reduce((sum, s) => {
    return sum + parseInt(s.duration || 0);
  }, 0);
}
