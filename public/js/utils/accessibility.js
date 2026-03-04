// public/js/utils/accessibility.js — Accessibility enhancements
'use strict';

/**
 * Keyboard navigation manager
 * Handles keyboard interactions for custom components
 */
class KeyboardNav {
  /**
   * Make element keyboard accessible
   * @param {HTMLElement} element - Element to enhance
   * @param {Function} onClick - Click handler
   * @param {object} options - Configuration options
   */
  static makeAccessible(element, onClick, options = {}) {
    const {
      role = 'button',
      tabindex = 0,
      label = null,
    } = options;
    
    // Set ARIA attributes
    element.setAttribute('role', role);
    element.setAttribute('tabindex', tabindex);
    
    if (label) {
      element.setAttribute('aria-label', label);
    }
    
    // Add keyboard handler
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    });
    
    return element;
  }
  
  /**
   * Create focusable list with arrow key navigation
   * @param {HTMLElement} container - Container element
   * @param {string} itemSelector - CSS selector for items
   * @param {object} options - Configuration options
   */
  static enableListNavigation(container, itemSelector, options = {}) {
    const {
      loop = true,
      onSelect = null,
      orientation = 'vertical', // 'vertical' or 'horizontal'
    } = options;
    
    const items = Array.from(container.querySelectorAll(itemSelector));
    let currentIndex = -1;
    
    // Make items focusable
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      item.setAttribute('role', 'option');
      
      // Click handler
      item.addEventListener('click', () => {
        KeyboardNav._selectItem(items, index);
        if (onSelect) onSelect(item, index);
      });
      
      // Focus handler
      item.addEventListener('focus', () => {
        currentIndex = index;
      });
    });
    
    // Container role
    container.setAttribute('role', 'listbox');
    
    // Keyboard navigation
    container.addEventListener('keydown', (e) => {
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      
      let newIndex = currentIndex;
      
      if (e.key === prevKey) {
        e.preventDefault();
        newIndex = currentIndex - 1;
        if (newIndex < 0) newIndex = loop ? items.length - 1 : 0;
      } else if (e.key === nextKey) {
        e.preventDefault();
        newIndex = currentIndex + 1;
        if (newIndex >= items.length) newIndex = loop ? 0 : items.length - 1;
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (currentIndex >= 0 && items[currentIndex]) {
          items[currentIndex].click();
        }
        return;
      } else if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = items.length - 1;
      } else {
        return;
      }
      
      // Focus new item
      if (newIndex !== currentIndex && items[newIndex]) {
        items[newIndex].focus();
      }
    });
    
    return {
      refresh: () => {
        const updatedItems = Array.from(container.querySelectorAll(itemSelector));
        updatedItems.forEach((item, index) => {
          item.setAttribute('tabindex', index === 0 ? '0' : '-1');
        });
      },
    };
  }
  
  /**
   * Select item and update tabindex
   * @private
   */
  static _selectItem(items, selectedIndex) {
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === selectedIndex ? '0' : '-1');
      item.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');
    });
  }
  
  /**
   * Trap focus within modal
   * @param {HTMLElement} modal - Modal element
   * @returns {Function} - Cleanup function
   */
  static trapFocus(modal) {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    
    const focusableElements = Array.from(modal.querySelectorAll(focusableSelectors));
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    modal.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }
    
    // Return cleanup function
    return () => {
      modal.removeEventListener('keydown', handleKeyDown);
    };
  }
}

/**
 * ARIA live region announcer
 * For screen reader announcements
 */
class LiveAnnouncer {
  constructor() {
    this.region = null;
    this._init();
  }
  
  /**
   * Initialize live region
   * @private
   */
  _init() {
    // Create live region if it doesn't exist
    this.region = document.getElementById('aria-live-region');
    
    if (!this.region) {
      this.region = document.createElement('div');
      this.region.id = 'aria-live-region';
      this.region.setAttribute('aria-live', 'polite');
      this.region.setAttribute('aria-atomic', 'true');
      this.region.setAttribute('role', 'status');
      this.region.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(this.region);
    }
  }
  
  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - 'polite' or 'assertive'
   */
  announce(message, priority = 'polite') {
    this.region.setAttribute('aria-live', priority);
    
    // Clear previous message
    this.region.textContent = '';
    
    // Announce new message after a brief delay
    setTimeout(() => {
      this.region.textContent = message;
    }, 100);
  }
  
  /**
   * Clear announcements
   */
  clear() {
    this.region.textContent = '';
  }
}

/**
 * Focus management utilities
 */
class FocusManager {
  /**
   * Save current focus
   * @returns {HTMLElement} - Previously focused element
   */
  static saveFocus() {
    return document.activeElement;
  }
  
  /**
   * Restore focus to element
   * @param {HTMLElement} element - Element to focus
   */
  static restoreFocus(element) {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  }
  
  /**
   * Move focus to first error in form
   * @param {HTMLElement} form - Form element
   */
  static focusFirstError(form) {
    const errorInput = form.querySelector('.input-error, [aria-invalid="true"]');
    if (errorInput) {
      errorInput.focus();
    }
  }
}

/**
 * Accessible modal manager
 */
class AccessibleModal {
  constructor(modalElement) {
    this.modal = modalElement;
    this.previousFocus = null;
    this.focusTrap = null;
  }
  
  /**
   * Open modal with accessibility
   */
  open() {
    // Save previous focus
    this.previousFocus = FocusManager.saveFocus();
    
    // Show modal
    this.modal.style.display = 'flex';
    this.modal.setAttribute('aria-hidden', 'false');
    
    // Trap focus
    this.focusTrap = KeyboardNav.trapFocus(this.modal);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Announce to screen readers
    const title = this.modal.querySelector('[role="heading"], h1, h2, h3');
    if (title) {
      window.announcer?.announce(`Dialog opened: ${title.textContent}`);
    }
  }
  
  /**
   * Close modal
   */
  close() {
    // Hide modal
    this.modal.style.display = 'none';
    this.modal.setAttribute('aria-hidden', 'true');
    
    // Remove focus trap
    if (this.focusTrap) {
      this.focusTrap();
      this.focusTrap = null;
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Restore focus
    if (this.previousFocus) {
      FocusManager.restoreFocus(this.previousFocus);
      this.previousFocus = null;
    }
    
    // Announce to screen readers
    window.announcer?.announce('Dialog closed');
  }
}

/**
 * Initialize accessibility features
 */
function initAccessibility() {
  // Create global announcer
  window.announcer = new LiveAnnouncer();
  
  // Add skip link
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
  `;
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add main content ID if missing
  const main = document.querySelector('main, .app-frame, .content');
  if (main && !main.id) {
    main.id = 'main-content';
  }
  
  console.log('✓ Accessibility features initialized');
}

// Auto-initialize on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibility);
  } else {
    initAccessibility();
  }
  
  // Export to window
  window.KeyboardNav = KeyboardNav;
  window.LiveAnnouncer = LiveAnnouncer;
  window.FocusManager = FocusManager;
  window.AccessibleModal = AccessibleModal;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KeyboardNav,
    LiveAnnouncer,
    FocusManager,
    AccessibleModal,
    initAccessibility,
  };
}
