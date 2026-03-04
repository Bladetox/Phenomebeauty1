// public/js/utils/performance.js — Performance optimization utilities
'use strict';

/**
 * Prefetch manager for calendar data
 */
class PrefetchManager {
  constructor() {
    this.queue = [];
    this.inProgress = new Set();
    this.maxConcurrent = 2;
  }
  
  /**
   * Add prefetch task to queue
   * @param {Function} fetchFn - Async function that fetches data
   * @param {string} key - Unique key for deduplication
   * @param {number} priority - Priority (lower = higher priority)
   */
  add(fetchFn, key, priority = 10) {
    // Don't add if already in progress or queued
    if (this.inProgress.has(key) || this.queue.find(t => t.key === key)) {
      return;
    }
    
    this.queue.push({ fetchFn, key, priority });
    this.queue.sort((a, b) => a.priority - b.priority);
    
    this._process();
  }
  
  /**
   * Process prefetch queue
   * @private
   */
  async _process() {
    while (this.queue.length > 0 && this.inProgress.size < this.maxConcurrent) {
      const task = this.queue.shift();
      if (!task) break;
      
      this.inProgress.add(task.key);
      
      try {
        await task.fetchFn();
      } catch (error) {
        console.warn('Prefetch error:', task.key, error);
      } finally {
        this.inProgress.delete(task.key);
        this._process(); // Process next
      }
    }
  }
  
  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
  }
}

/**
 * Lazy image loader with intersection observer
 */
class LazyImageLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: '50px',
      threshold: 0.01,
      ...options,
    };
    
    this.observer = null;
    this._init();
  }
  
  /**
   * Initialize intersection observer
   * @private
   */
  _init() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      this._loadAllImages();
      return;
    }
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, this.options);
  }
  
  /**
   * Observe image element
   * @param {HTMLImageElement} img - Image element
   */
  observe(img) {
    if (!this.observer) return;
    
    // Set placeholder
    if (!img.src || img.src === window.location.href) {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
    }
    
    this.observer.observe(img);
  }
  
  /**
   * Load image
   * @private
   */
  _loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;
    
    img.src = src;
    img.removeAttribute('data-src');
    img.classList.add('loaded');
  }
  
  /**
   * Fallback: load all images
   * @private
   */
  _loadAllImages() {
    document.querySelectorAll('img[data-src]').forEach(img => {
      this._loadImage(img);
    });
  }
}

/**
 * Debounce utility
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @param {boolean} immediate - Execute on leading edge
 * @returns {Function} - Debounced function
 */
function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const context = this;
    
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle utility
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  
  return function executedFunction(...args) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Simple in-memory cache with TTL
 */
class Cache {
  constructor(defaultTTL = 5 * 60 * 1000) {
    this.storage = new Map();
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * Set cache entry
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in ms
   */
  set(key, value, ttl = this.defaultTTL) {
    this.storage.set(key, {
      value,
      expiry: Date.now() + ttl,
    });
  }
  
  /**
   * Get cache entry
   * @param {string} key - Cache key
   * @returns {any} - Cached value or null
   */
  get(key) {
    const entry = this.storage.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      this.storage.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }
  
  /**
   * Delete cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.storage.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.storage.clear();
  }
  
  /**
   * Get cache size
   * @returns {number}
   */
  size() {
    return this.storage.size;
  }
}

/**
 * Request batching utility
 * Batches multiple requests into a single call
 */
class RequestBatcher {
  constructor(batchFn, options = {}) {
    this.batchFn = batchFn;
    this.options = {
      maxBatchSize: 10,
      maxWaitTime: 50,
      ...options,
    };
    
    this.queue = [];
    this.timer = null;
  }
  
  /**
   * Add request to batch
   * @param {any} request - Request data
   * @returns {Promise} - Resolves with response
   */
  add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      
      // Clear existing timer
      if (this.timer) {
        clearTimeout(this.timer);
      }
      
      // Process immediately if batch is full
      if (this.queue.length >= this.options.maxBatchSize) {
        this._process();
      } else {
        // Otherwise wait for more requests
        this.timer = setTimeout(() => {
          this._process();
        }, this.options.maxWaitTime);
      }
    });
  }
  
  /**
   * Process batched requests
   * @private
   */
  async _process() {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.options.maxBatchSize);
    const requests = batch.map(b => b.request);
    
    try {
      const responses = await this.batchFn(requests);
      
      // Resolve individual promises
      batch.forEach((item, index) => {
        item.resolve(responses[index]);
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }
}

/**
 * Performance monitor
 * Tracks page load metrics and custom measurements
 */
class PerformanceMonitor {
  /**
   * Get page load metrics
   * @returns {object} - Performance metrics
   */
  static getPageMetrics() {
    if (!window.performance || !window.performance.timing) {
      return null;
    }
    
    const timing = window.performance.timing;
    const nav = window.performance.navigation;
    
    return {
      // Time to interactive
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      
      // Full page load
      pageLoad: timing.loadEventEnd - timing.navigationStart,
      
      // DNS lookup
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      
      // TCP connection
      tcpConnection: timing.connectEnd - timing.connectStart,
      
      // Time to first byte
      ttfb: timing.responseStart - timing.navigationStart,
      
      // DOM processing
      domProcessing: timing.domComplete - timing.domLoading,
      
      // Navigation type
      navigationType: ['navigate', 'reload', 'back_forward', 'prerender'][nav.type] || 'unknown',
    };
  }
  
  /**
   * Measure execution time
   * @param {string} name - Measurement name
   * @param {Function} fn - Function to measure
   * @returns {Promise<{result: any, duration: number}>}
   */
  static async measure(name, fn) {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      
      return { result, duration };
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`⏱️ ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
}

// Initialize global instances
if (typeof window !== 'undefined') {
  window.prefetchManager = new PrefetchManager();
  window.lazyImageLoader = new LazyImageLoader();
  window.performanceCache = new Cache();
  
  window.debounce = debounce;
  window.throttle = throttle;
  window.Cache = Cache;
  window.RequestBatcher = RequestBatcher;
  window.PerformanceMonitor = PerformanceMonitor;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PrefetchManager,
    LazyImageLoader,
    debounce,
    throttle,
    Cache,
    RequestBatcher,
    PerformanceMonitor,
  };
}
