// public/js/api.js — API calls with retry logic and error handling
// Extracts and improves fetch calls from index.html
'use strict';

/**
 * Fetch with automatic retry and exponential backoff
 * @param {String} url - API endpoint
 * @param {Object} options - Fetch options
 * @param {Number} maxRetries - Maximum retry attempts (default 3)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry on 5xx errors or network failures
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`API request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Fetch services from server
 * GET /api?action=getServices
 * @returns {Promise<Array>} - Array of service objects
 */
export async function fetchServices() {
  try {
    const response = await fetchWithRetry('/api?action=getServices');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to load services:', error);
    throw new Error('Unable to load services. Please refresh the page.');
  }
}

/**
 * Fetch month availability data
 * GET /api?action=getMonthAvailability&month=YYYY-MM
 * @param {Number} year - Year
 * @param {Number} month - Month (1-12)
 * @returns {Promise<Object>} - Object with dates as keys, time slots as values
 */
export async function fetchMonthAvailability(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month)}`;
  
  try {
    const response = await fetchWithRetry(`/api?action=getMonthAvailability&month=${monthKey}`);
    const data = await response.json();
    return data || {};
  } catch (error) {
    console.error('Failed to load availability:', error);
    throw new Error('Unable to load available dates. Please try again.');
  }
}

/**
 * Calculate call-out fee based on address
 * GET /api?action=getCallOutFee&address=...
 * @param {String} address - Full address
 * @returns {Promise<Object>} - {fee, oneWayKm, roundTripKm, duration}
 */
export async function fetchCallOutFee(address) {
  if (!address || address.trim().length < 5) {
    return { fee: 0, oneWayKm: 0, roundTripKm: 0, duration: '' };
  }
  
  try {
    const response = await fetchWithRetry(
      `/api?action=getCallOutFee&address=${encodeURIComponent(address)}`,
      {},
      2  // Only 2 retries for call-out fee (non-critical)
    );
    const data = await response.json();
    
    if (data.error) {
      console.warn('Call-out fee calculation error:', data.error);
      return { fee: 0, oneWayKm: 0, roundTripKm: 0, duration: '' };
    }
    
    return data;
  } catch (error) {
    console.error('Failed to calculate call-out fee:', error);
    // Non-critical error, return default
    return { fee: 0, oneWayKm: 0, roundTripKm: 0, duration: '' };
  }
}

/**
 * Fetch app configuration
 * GET /api?action=getConfig
 * @returns {Promise<Object>} - {depositPercent, appBaseUrl, googleReviewUrl}
 */
export async function fetchAppConfig() {
  try {
    const response = await fetchWithRetry('/api?action=getConfig');
    const data = await response.json();
    return {
      depositPercent: parseFloat(data.deposit_percent || '50'),
      appBaseUrl: data.app_base_url || '',
      googleReviewUrl: data.google_review_url || '',
    };
  } catch (error) {
    console.error('Failed to load app config:', error);
    // Return defaults
    return {
      depositPercent: 50,
      appBaseUrl: window.location.origin,
      googleReviewUrl: '',
    };
  }
}

/**
 * Submit booking to server
 * POST /api/book
 * @param {Object} bookingData - Complete booking data
 * @returns {Promise<Object>} - {success, bookingId, paymentUrl, ...}
 */
export async function submitBooking(bookingData) {
  try {
    const response = await fetchWithRetry('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Booking submission failed');
    }
    
    return data;
  } catch (error) {
    console.error('Booking submission error:', error);
    throw new Error(error.message || 'Failed to submit booking. Please try again.');
  }
}

/**
 * Fetch address suggestions from secure server-side proxy
 * GET /api/places-autocomplete?input=...
 * @param {String} input - Search query
 * @returns {Promise<Array>} - Array of suggestion objects
 */
export async function fetchAddressSuggestions(input) {
  if (!input || input.trim().length < 3) {
    return [];
  }
  
  try {
    const response = await fetch(
      `/api/places-autocomplete?input=${encodeURIComponent(input)}`,
      { signal: AbortSignal.timeout(5000) }  // 5s timeout
    );
    
    if (!response.ok) {
      console.warn('Address autocomplete failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    // Don't throw on autocomplete failures (non-critical)
    console.warn('Address autocomplete error:', error.message);
    return [];
  }
}

/**
 * Check payment status
 * GET /api/check-payment?ref=...
 * @param {String} bookingId - Booking reference
 * @returns {Promise<Object>} - Payment status data
 */
export async function checkPaymentStatus(bookingId) {
  try {
    const response = await fetchWithRetry(`/api/check-payment?ref=${encodeURIComponent(bookingId)}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Payment check failed');
    }
    
    return data;
  } catch (error) {
    console.error('Payment status check error:', error);
    throw error;
  }
}

export { fetchWithRetry };
