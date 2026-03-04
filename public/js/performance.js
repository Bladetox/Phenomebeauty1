// public/js/performance.js — Performance optimizations
// Prefetching, caching, lazy loading, code splitting
'use strict';

import { bookingState } from './state.js';
import { fetchMonthAvailability } from './api.js';

/**
 * Initialize performance optimizations
 */
export function initPerformance() {
  setupPrefetching();
  setupImageLazyLoading();
  setupCacheWarming();
  setupResourceHints();
  
  console.log('⚡ Performance optimizations enabled');
}

/**
 * Setup intelligent prefetching based on user behavior
 */
function setupPrefetching() {
  // Prefetch next month's availability when user views current month
  document.addEventListener('calendarRendered', () => {
    const year = bookingState.calendar.year;
    const month = bookingState.calendar.month;
    
    // Prefetch next month in the background
    requestIdleCallback(() => {
      prefetchNextMonth(year, month);
    });
  });
  
  // Prefetch step resources when user is likely to proceed
  document.getElementById('btn-next')?.addEventListener('mouseenter', () => {
    const step = bookingState.currentStep;
    if (step === 1) {
      // User hovering over Next on services, prefetch calendar resources
      prefetchCalendarMonth();
    }
  });
}

/**
 * Prefetch next month's availability
 */
async function prefetchNextMonth(year, month) {
  let nextYear = year;
  let nextMonth = month + 1;
  
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${nextYear}-${pad(nextMonth)}`;
  
  // Only prefetch if not already cached
  if (!bookingState.calendar.monthCache[monthKey]) {
    try {
      await fetchMonthAvailability(nextYear, nextMonth);
      console.log(`⚡ Prefetched: ${monthKey}`);
    } catch (error) {
      // Silently fail - prefetching is non-critical
    }
  }
}

/**
 * Prefetch current month for calendar
 */
async function prefetchCalendarMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month)}`;
  
  if (!bookingState.calendar.monthCache[monthKey]) {
    try {
      await fetchMonthAvailability(year, month);
      console.log(`⚡ Prefetched calendar: ${monthKey}`);
    } catch (error) {
      // Non-critical
    }
  }
}

/**
 * Setup image lazy loading
 */
function setupImageLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });
    
    // Observe all images with data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/**
 * Warm up cache with frequently accessed data
 */
function setupCacheWarming() {
  // Wait for page to be fully loaded and idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      warmCache();
    }, { timeout: 2000 });
  } else {
    setTimeout(warmCache, 2000);
  }
}

/**
 * Warm cache with likely needed data
 */
async function warmCache() {
  // Prefetch current and next month availability
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  try {
    await prefetchCalendarMonth();
    await prefetchNextMonth(year, month);
    console.log('⚡ Cache warmed');
  } catch (error) {
    // Non-critical
  }
}

/**
 * Setup resource hints for better loading performance
 */
function setupResourceHints() {
  // DNS prefetch for external resources
  const dnsPrefetch = [
    'https://sheets.googleapis.com',
  ];
  
  dnsPrefetch.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    document.head.appendChild(link);
  });
  
  // Preconnect to API endpoints
  const preconnect = [
    window.location.origin,
  ];
  
  preconnect.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    document.head.appendChild(link);
  });
}

/**
 * Debounce expensive operations
 * @param {Function} func - Function to debounce
 * @param {Number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export function debounceExpensive(func, wait = 300) {
  let timeout;
  let lastCall = 0;
  
  return function executedFunction(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    clearTimeout(timeout);
    
    // If it's been a while, execute immediately
    if (timeSinceLastCall > wait * 2) {
      lastCall = now;
      func.apply(this, args);
    } else {
      // Otherwise debounce
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, wait);
    }
  };
}

/**
 * Throttle function calls (execute at most once per interval)
 * @param {Function} func - Function to throttle
 * @param {Number} limit - Minimum time between calls (ms)
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit = 200) {
  let inThrottle;
  let lastResult;
  
  return function(...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
}

/**
 * Use requestIdleCallback for non-critical work
 * Falls back to setTimeout for unsupported browsers
 * @param {Function} callback - Function to execute when idle
 * @param {Object} options - Options {timeout}
 */
export function runWhenIdle(callback, options = {}) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, options);
  } else {
    setTimeout(callback, 1);
  }
}

/**
 * Measure and log performance metrics
 */
export function logPerformanceMetrics() {
  if ('performance' in window && 'getEntriesByType' in performance) {
    runWhenIdle(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      
      if (navigation) {
        const metrics = {
          'DNS Lookup': Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
          'TCP Connection': Math.round(navigation.connectEnd - navigation.connectStart),
          'TLS Negotiation': navigation.secureConnectionStart > 0 
            ? Math.round(navigation.connectEnd - navigation.secureConnectionStart) 
            : 0,
          'Time to First Byte': Math.round(navigation.responseStart - navigation.requestStart),
          'DOM Content Loaded': Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
          'Page Load': Math.round(navigation.loadEventEnd - navigation.loadEventStart),
          'Total Load Time': Math.round(navigation.loadEventEnd - navigation.fetchStart),
        };
        
        console.table(metrics);
      }
      
      // Log resource timing
      const resources = performance.getEntriesByType('resource');
      const slowResources = resources
        .filter(r => r.duration > 500)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);
      
      if (slowResources.length > 0) {
        console.warn('Slow resources (>500ms):');
        slowResources.forEach(r => {
          console.log(`  ${Math.round(r.duration)}ms - ${r.name}`);
        });
      }
    });
  }
}

/**
 * Clean up old cache entries to prevent memory bloat
 */
export function cleanupOldCache() {
  const cache = bookingState.calendar.monthCache;
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  Object.keys(cache).forEach(key => {
    if (cache[key].loadedAt && (now - cache[key].loadedAt) > maxAge) {
      delete cache[key];
      console.log(`🧹 Cleaned up old cache: ${key}`);
    }
  });
}

/**
 * Setup periodic cache cleanup
 */
export function setupCacheCleanup() {
  // Clean up cache every 10 minutes
  setInterval(cleanupOldCache, 10 * 60 * 1000);
}

/**
 * Prefetch critical resources for next step
 * @param {Number} nextStep - The next step number
 */
export function prefetchStepResources(nextStep) {
  runWhenIdle(() => {
    switch (nextStep) {
      case 2:
        // Prefetch calendar month
        prefetchCalendarMonth();
        break;
      case 4:
        // Prefetch any review-related resources
        // Could prefetch Google Maps Static API image for address
        break;
    }
  });
}
