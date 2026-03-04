// public/js/payment.js — Review and payment (Step 4)
// Extracted from index.html review step functionality
'use strict';

import { bookingState, setStatePath, updateState } from './state.js';
import { fetchCallOutFee, submitBooking } from './api.js';
import { showToast, formatCurrency, formatDate, setLoading } from './ui.js';
import { getSelectedServicesSummary, getTotalDuration } from './services.js';
import { getSelectedDateTime } from './calendar.js';
import { getClientSummary } from './client-details.js';

let callOutFeeTimer = null;

/**
 * Initialize review step
 */
export async function initReviewStep() {
  // Calculate call-out fee
  await calculateCallOutFee();
  
  // Render review summary
  renderReviewSummary();
}

/**
 * Calculate call-out fee based on address
 */
export async function calculateCallOutFee() {
  const address = bookingState.client.address;
  
  if (!address || address.length < 5) {
    setStatePath('pricing.callOutFee', 0);
    setStatePath('pricing.oneWayKm', 0);
    setStatePath('pricing.roundTripKm', 0);
    return;
  }
  
  // Debounce to avoid excessive API calls
  clearTimeout(callOutFeeTimer);
  
  callOutFeeTimer = setTimeout(async () => {
    try {
      const result = await fetchCallOutFee(address);
      
      setStatePath('pricing.callOutFee', result.fee || 0);
      setStatePath('pricing.oneWayKm', result.oneWayKm || 0);
      setStatePath('pricing.roundTripKm', result.roundTripKm || 0);
      
      // Recalculate totals
      updatePricing();
      
      // Re-render to show updated pricing
      renderReviewSummary();
      
    } catch (error) {
      console.error('Call-out fee calculation error:', error);
      // Don't show error toast (non-critical)
    }
  }, 500);
}

/**
 * Update pricing calculations
 */
function updatePricing() {
  const servicesTotal = bookingState.servicesTotal || 0;
  const callOutFee = bookingState.pricing.callOutFee || 0;
  const totalAmount = servicesTotal + callOutFee;
  
  setStatePath('pricing.totalAmount', totalAmount);
  
  // Calculate deposit and balance
  const depositPercent = bookingState.config.depositPercent || 50;
  const depositAmount = Math.round((totalAmount * depositPercent / 100) * 100) / 100;
  const balanceDue = Math.round((totalAmount - depositAmount) * 100) / 100;
  
  setStatePath('pricing.depositAmount', depositAmount);
  setStatePath('pricing.balanceDue', balanceDue);
}

/**
 * Render review summary
 */
export function renderReviewSummary() {
  const container = document.getElementById('review-summary');
  if (!container) return;
  
  const services = bookingState.selectedServices;
  const { date, time, dateFormatted } = getSelectedDateTime();
  const client = getClientSummary();
  const pricing = bookingState.pricing;
  
  container.innerHTML = `
    <div class="review-section">
      <h3 class="review-section-title">Selected Services</h3>
      <div class="review-services-list">
        ${services.map(s => `
          <div class="review-service-item">
            <span class="review-service-name">${s.name}</span>
            <span class="review-service-price">${formatCurrency(s.price)}</span>
          </div>
        `).join('')}
      </div>
      <div class="review-subtotal">
        <span>Services Subtotal</span>
        <span>${formatCurrency(bookingState.servicesTotal)}</span>
      </div>
    </div>
    
    <div class="review-section">
      <h3 class="review-section-title">Appointment Details</h3>
      <div class="review-detail">
        <span class="review-label">Date:</span>
        <span class="review-value">${dateFormatted}</span>
      </div>
      <div class="review-detail">
        <span class="review-label">Time:</span>
        <span class="review-value">${time}</span>
      </div>
      <div class="review-detail">
        <span class="review-label">Duration:</span>
        <span class="review-value">${getTotalDuration()} minutes</span>
      </div>
    </div>
    
    <div class="review-section">
      <h3 class="review-section-title">Your Details</h3>
      <div class="review-detail">
        <span class="review-label">Name:</span>
        <span class="review-value">${client.name}</span>
      </div>
      <div class="review-detail">
        <span class="review-label">Phone:</span>
        <span class="review-value">${client.phone}</span>
      </div>
      <div class="review-detail">
        <span class="review-label">Email:</span>
        <span class="review-value">${client.email}</span>
      </div>
      <div class="review-detail">
        <span class="review-label">Address:</span>
        <span class="review-value">${client.address}</span>
      </div>
    </div>
    
    <div class="review-section review-pricing">
      <h3 class="review-section-title">Pricing Breakdown</h3>
      
      <div class="review-price-row">
        <span>Services Total</span>
        <span>${formatCurrency(bookingState.servicesTotal)}</span>
      </div>
      
      ${pricing.callOutFee > 0 ? `
        <div class="review-price-row">
          <span>Call-Out Fee <span class="text-muted">(${pricing.roundTripKm} km)</span></span>
          <span>${formatCurrency(pricing.callOutFee)}</span>
        </div>
      ` : ''}
      
      <div class="review-price-row review-price-total">
        <span>Total Amount</span>
        <span>${formatCurrency(pricing.totalAmount)}</span>
      </div>
      
      <div class="review-price-row review-price-deposit">
        <span>Deposit Due Now <span class="text-muted">(${bookingState.config.depositPercent}%)</span></span>
        <span>${formatCurrency(pricing.depositAmount)}</span>
      </div>
      
      <div class="review-price-row review-price-balance">
        <span>Balance Due on Service Day</span>
        <span>${formatCurrency(pricing.balanceDue)}</span>
      </div>
    </div>
    
    <div class="review-note">
      <p>
        <strong>Note:</strong> A ${bookingState.config.depositPercent}% deposit of ${formatCurrency(pricing.depositAmount)} 
        is required to confirm your booking. The remaining balance of ${formatCurrency(pricing.balanceDue)} 
        will be due on the day of your appointment.
      </p>
    </div>
  `;
}

/**
 * Submit booking to server
 */
export async function submitBookingForm() {
  setLoading(true, 'Creating your booking...');
  
  try {
    // Prepare booking data
    const bookingData = {
      // Client details
      name: bookingState.client.name,
      email: bookingState.client.email,
      phone: bookingState.client.phone,
      address: bookingState.client.address,
      
      // Services
      services: bookingState.selectedServices.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration: s.duration,
      })),
      
      // Schedule
      date: bookingState.calendar.selectedDate,
      time: bookingState.calendar.selectedTime,
      
      // Pricing
      servicesTotal: bookingState.servicesTotal,
      callOutFee: bookingState.pricing.callOutFee,
      totalAmount: bookingState.pricing.totalAmount,
      depositAmount: bookingState.pricing.depositAmount,
      balanceDue: bookingState.pricing.balanceDue,
      oneWayKm: bookingState.pricing.oneWayKm,
      roundTripKm: bookingState.pricing.roundTripKm,
      
      // Client type and safety
      divaType: bookingState.client.divaType,
      safety: bookingState.client.divaType === 'new' ? bookingState.client.safety : null,
      
      // Source tracking
      source: 'web-booking',
    };
    
    const result = await submitBooking(bookingData);
    
    if (result.success) {
      // Store booking ID
      setStatePath('bookingId', result.bookingId);
      
      if (result.paymentUrl) {
        // Redirect to payment
        showToast('Redirecting to payment...');
        setTimeout(() => {
          window.location.href = result.paymentUrl;
        }, 1000);
      } else {
        // No payment needed or error
        if (result.paymentError) {
          showToast(result.paymentError, true);
        } else {
          showToast('Booking created! We will contact you shortly.');
        }
        
        // Redirect to thank you page
        setTimeout(() => {
          const baseUrl = bookingState.config.appBaseUrl || window.location.origin;
          window.location.href = `${baseUrl}/thankyou.html?ref=${result.bookingId}`;
        }, 2000);
      }
    } else {
      throw new Error(result.error || 'Booking failed');
    }
    
  } catch (error) {
    setLoading(false);
    showToast(error.message || 'Failed to submit booking. Please try again.', true);
  }
}

/**
 * Get booking summary for confirmation email
 * @returns {Object}
 */
export function getBookingSummary() {
  return {
    bookingId: bookingState.bookingId,
    services: getSelectedServicesSummary(),
    date: bookingState.calendar.selectedDate,
    time: bookingState.calendar.selectedTime,
    client: getClientSummary(),
    pricing: bookingState.pricing,
  };
}
