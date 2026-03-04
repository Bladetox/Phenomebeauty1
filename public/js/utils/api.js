// public/js/utils/api.js — API client with retry logic and error handling
'use strict';

/**
 * API Client with automatic retries and exponential backoff
 */
class APIClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }
  
  /**
   * Make HTTP request with retry logic
   * @param {string} url - Request URL
   * @param {object} options - Fetch options
   * @returns {Promise<object>} - Response data
   */
  async request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(fullUrl, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        
        clearTimeout(timeoutId);
        
        // Handle HTTP errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw new APIError(
              errorData.error || `HTTP ${response.status}`,
              response.status,
              errorData,
              false // not retryable
            );
          }
          
          // Retry server errors (5xx)
          throw new APIError(
            errorData.error || `HTTP ${response.status}`,
            response.status,
            errorData,
            true // retryable
          );
        }
        
        return await response.json();
        
      } catch (error) {
        // Don't retry if it's the last attempt or not retryable
        if (attempt === this.retries - 1 || (error instanceof APIError && !error.retryable)) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        await this._sleep(delay);
        
        console.warn(`Retry ${attempt + 1}/${this.retries - 1} after ${delay}ms`);
      }
    }
  }
  
  /**
   * GET request
   * @param {string} url - Request URL
   * @param {object} params - Query parameters
   * @param {object} options - Additional options
   * @returns {Promise<object>}
   */
  async get(url, params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;
    return this.request(fullUrl, { ...options, method: 'GET' });
  }
  
  /**
   * POST request
   * @param {string} url - Request URL
   * @param {object} data - Request body
   * @param {object} options - Additional options
   * @returns {Promise<object>}
   */
  async post(url, data = {}, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * PUT request
   * @param {string} url - Request URL
   * @param {object} data - Request body
   * @param {object} options - Additional options
   * @returns {Promise<object>}
   */
  async put(url, data = {}, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * DELETE request
   * @param {string} url - Request URL
   * @param {object} options - Additional options
   * @returns {Promise<object>}
   */
  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }
  
  /**
   * Sleep helper for retry delays
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, status, data = {}, retryable = false) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    this.retryable = retryable;
  }
}

/**
 * Booking API - Specific methods for PhenomeBeauty
 */
class BookingAPI extends APIClient {
  constructor() {
    super({ baseUrl: '/api', timeout: 30000, retries: 3 });
  }
  
  /**
   * Get available services
   * @returns {Promise<Array>}
   */
  async getServices() {
    return this.get('', { action: 'getServices' });
  }
  
  /**
   * Get month availability
   * @param {string} monthKey - Month key (YYYY-MM)
   * @returns {Promise<object>}
   */
  async getMonthAvailability(monthKey) {
    return this.get('', { action: 'getMonthAvailability', month: monthKey });
  }
  
  /**
   * Calculate call-out fee
   * @param {string} address - Destination address
   * @returns {Promise<object>}
   */
  async getCallOutFee(address) {
    return this.get('', { action: 'getCallOutFee', address });
  }
  
  /**
   * Get app configuration
   * @returns {Promise<object>}
   */
  async getConfig() {
    return this.get('', { action: 'getConfig' });
  }
  
  /**
   * Create booking
   * @param {object} bookingData - Booking details
   * @returns {Promise<object>}
   */
  async createBooking(bookingData) {
    return this.post('/book', bookingData);
  }
  
  /**
   * Check payment status
   * @param {string} bookingId - Booking reference
   * @returns {Promise<object>}
   */
  async checkPayment(bookingId) {
    return this.get('/check-payment', { ref: bookingId });
  }
  
  /**
   * Get address suggestions (secure proxy)
   * @param {string} input - Address search query
   * @returns {Promise<object>}
   */
  async getAddressSuggestions(input) {
    if (!input || input.length < 3) {
      return { suggestions: [] };
    }
    return this.get('/places-autocomplete', { input });
  }
}

/**
 * Admin API - Admin panel operations
 */
class AdminAPI extends APIClient {
  constructor() {
    super({ baseUrl: '/api/admin', timeout: 30000, retries: 2 });
    this.token = null;
  }
  
  /**
   * Set authentication token
   * @param {string} token - Admin token
   */
  setToken(token) {
    this.token = token;
  }
  
  /**
   * Override request to add auth header
   * @private
   */
  async request(url, options = {}) {
    if (this.token) {
      options.headers = {
        ...options.headers,
        'X-Admin-Token': this.token,
      };
    }
    return super.request(url, options);
  }
  
  /**
   * Admin login
   * @param {string} password - Admin password
   * @returns {Promise<object>}
   */
  async login(password) {
    const response = await this.post('/login', { password });
    if (response.token) {
      this.setToken(response.token);
      // Store in localStorage
      localStorage.setItem('admin_token', response.token);
    }
    return response;
  }
  
  /**
   * Logout (clear token)
   */
  logout() {
    this.token = null;
    localStorage.removeItem('admin_token');
  }
  
  /**
   * Get all bookings
   * @returns {Promise<Array>}
   */
  async getBookings() {
    return this.get('/bookings');
  }
  
  /**
   * Get all consultations
   * @returns {Promise<Array>}
   */
  async getConsultations() {
    return this.get('/consultations');
  }
  
  /**
   * Update booking status
   * @param {string} bookingId - Booking ID
   * @param {string} status - New status
   * @returns {Promise<object>}
   */
  async updateStatus(bookingId, status) {
    return this.post('/update-status', { bookingId, status });
  }
  
  /**
   * Reschedule booking
   * @param {string} bookingId - Booking ID
   * @param {string} newDate - New date
   * @param {string} newTime - New time
   * @returns {Promise<object>}
   */
  async reschedule(bookingId, newDate, newTime) {
    return this.post('/reschedule', { bookingId, newDate, newTime });
  }
  
  /**
   * Request balance payment
   * @param {string} bookingId - Booking ID
   * @returns {Promise<object>}
   */
  async requestBalance(bookingId) {
    return this.post('/request-balance', { bookingId });
  }
  
  /**
   * Process refund
   * @param {string} bookingId - Booking ID
   * @param {string} reason - Refund reason
   * @returns {Promise<object>}
   */
  async refund(bookingId, reason) {
    return this.post('/refund', { bookingId, reason });
  }
  
  /**
   * Get loyalty tracker data
   * @returns {Promise<Array>}
   */
  async getLoyalty() {
    return this.get('/loyalty');
  }
  
  /**
   * Get stock data
   * @returns {Promise<Array>}
   */
  async getStock() {
    return this.get('/stock');
  }
  
  /**
   * Get Google reviews
   * @returns {Promise<object>}
   */
  async getReviews() {
    return this.get('/reviews');
  }
}

// Export classes
if (typeof window !== 'undefined') {
  window.APIClient = APIClient;
  window.APIError = APIError;
  window.BookingAPI = BookingAPI;
  window.AdminAPI = AdminAPI;
  
  // Create global instances
  window.api = new BookingAPI();
  window.adminApi = new AdminAPI();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIClient, APIError, BookingAPI, AdminAPI };
}
