// public/js/services.js — Service selection and rendering logic
// Extracted from index.html Step 1 functionality
'use strict';

import { bookingState, updateState, setStatePath } from './state.js';
import { fetchServices } from './api.js';
import { showToast, escHtml, updateNextBtn, setLoading } from './ui.js';

/**
 * Load services from API and populate state
 */
export async function loadServices() {
  setLoading(true, 'Loading services...');
  
  try {
    const services = await fetchServices();
    updateState({ services });
    renderServices();
  } catch (error) {
    showToast(error.message || 'Failed to load services', true);
    // Render empty state
    renderServices();
  } finally {
    setLoading(false);
  }
}

/**
 * Render services to the page
 */
export function renderServices() {
  const container = document.getElementById('services-list');
  if (!container) return;
  
  const services = bookingState.services;
  
  if (!services || services.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No services available at the moment.</p>
        <button type="button" class="btn-link" onclick="location.reload()">Reload Page</button>
      </div>
    `;
    return;
  }
  
  // Group services by category
  const categories = [...new Set(services.map(s => s.category || 'Other').filter(Boolean))];
  
  // Render category chips
  renderCategoryChips(categories);
  
  // Get active category filter
  const activeCategory = bookingState.ui.activeCategory || 'All';
  
  // Filter services
  const filtered = activeCategory === 'All'
    ? services
    : services.filter(s => (s.category || 'Other') === activeCategory);
  
  // Render service cards
  container.innerHTML = filtered.map(service => renderServiceCard(service)).join('');
  
  // Attach event listeners
  attachServiceListeners();
  
  updateNextBtn();
}

/**
 * Render category filter chips
 * @param {Array} categories - List of category names
 */
function renderCategoryChips(categories) {
  const chipContainer = document.getElementById('category-chips');
  if (!chipContainer) return;
  
  const activeCategory = bookingState.ui.activeCategory || 'All';
  const allCategories = ['All', ...categories];
  
  chipContainer.innerHTML = allCategories.map(cat => `
    <button 
      type="button" 
      class="chip ${cat === activeCategory ? 'chip-active' : ''}"
      data-category="${escHtml(cat)}"
    >
      ${escHtml(cat)}
    </button>
  `).join('');
  
  // Attach listeners
  chipContainer.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const category = chip.dataset.category;
      setStatePath('ui.activeCategory', category);
      renderServices();
    });
  });
}

/**
 * Render a single service card
 * @param {Object} service - Service object
 * @returns {String} - HTML string
 */
function renderServiceCard(service) {
  const isSelected = bookingState.selectedServices.some(s => s.id === service.id);
  const price = parseFloat(service.price || 0);
  const duration = parseInt(service.duration || 0);
  
  return `
    <div 
      class="service-card ${isSelected ? 'selected' : ''}" 
      data-service-id="${escHtml(service.id)}"
    >
      <div class="service-card-header">
        <h3 class="service-title">${escHtml(service.name)}</h3>
        <div class="service-price">R${price.toFixed(2)}</div>
      </div>
      
      ${service.description ? `
        <p class="service-description">${escHtml(service.description)}</p>
      ` : ''}
      
      <div class="service-footer">
        <span class="service-duration">
          <i class="icon-clock"></i> ${duration} min
        </span>
        <button 
          type="button" 
          class="btn-select ${isSelected ? 'btn-selected' : ''}"
          data-service-id="${escHtml(service.id)}"
        >
          ${isSelected ? '✓ Selected' : 'Select'}
        </button>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to service cards
 */
function attachServiceListeners() {
  document.querySelectorAll('.btn-select').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const serviceId = button.dataset.serviceId;
      toggleService(serviceId);
    });
  });
  
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      const serviceId = card.dataset.serviceId;
      toggleService(serviceId);
    });
  });
}

/**
 * Toggle service selection
 * @param {String} serviceId - Service ID
 */
export function toggleService(serviceId) {
  const service = bookingState.services.find(s => s.id === serviceId);
  if (!service) return;
  
  const isSelected = bookingState.selectedServices.some(s => s.id === serviceId);
  
  if (isSelected) {
    // Remove from selection
    const updated = bookingState.selectedServices.filter(s => s.id !== serviceId);
    updateState({ selectedServices: updated });
  } else {
    // Add to selection (max 10 services)
    if (bookingState.selectedServices.length >= 10) {
      showToast('Maximum 10 services can be selected', true);
      return;
    }
    
    const updated = [...bookingState.selectedServices, service];
    updateState({ selectedServices: updated });
  }
  
  // Recalculate total
  updateServicesTotal();
  
  // Re-render to update UI
  renderServices();
}

/**
 * Calculate and update services total
 */
export function updateServicesTotal() {
  const total = bookingState.selectedServices.reduce((sum, service) => {
    return sum + parseFloat(service.price || 0);
  }, 0);
  
  updateState({ servicesTotal: total });
  
  // Update total amount (services + call-out fee)
  const callOutFee = bookingState.pricing.callOutFee || 0;
  const totalAmount = total + callOutFee;
  
  setStatePath('pricing.totalAmount', totalAmount);
  
  // Recalculate deposit and balance
  const depositPercent = bookingState.config.depositPercent || 50;
  const depositAmount = Math.round((totalAmount * depositPercent / 100) * 100) / 100;
  const balanceDue = Math.round((totalAmount - depositAmount) * 100) / 100;
  
  setStatePath('pricing.depositAmount', depositAmount);
  setStatePath('pricing.balanceDue', balanceDue);
}

/**
 * Get selected services summary text
 * @returns {String} - Comma-separated service names
 */
export function getSelectedServicesSummary() {
  return bookingState.selectedServices
    .map(s => s.name)
    .join(', ') || 'No services selected';
}

/**
 * Get total duration of selected services
 * @returns {Number} - Total duration in minutes
 */
export function getTotalDuration() {
  return bookingState.selectedServices.reduce((sum, service) => {
    return sum + parseInt(service.duration || 0);
  }, 0);
}
