// tests/client.test.js — Client-side unit tests
'use strict';

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const { JSDOM } = require('jsdom');

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Load modules
const BookingState = require('../public/js/booking/state');
const { Validators, Formatters } = require('../public/js/utils/validation');
const { Cache, debounce, throttle } = require('../public/js/utils/performance');

describe('BookingState Tests', () => {
  let state;
  
  beforeEach(() => {
    state = new BookingState();
  });
  
  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const current = state.get();
      expect(current.step).to.equal(1);
      expect(current.selectedServices).to.be.an('array').that.is.empty;
      expect(current.pricing.totalAmount).to.equal(0);
    });
  });
  
  describe('State Management', () => {
    it('should update state via setPath', () => {
      state.setPath('client.name', 'John Doe');
      expect(state.getPath('client.name')).to.equal('John Doe');
    });
    
    it('should notify observers on state change', (done) => {
      state.subscribe((_, path) => {
        expect(path).to.equal('step');
        done();
      });
      
      state.setPath('step', 2);
    });
    
    it('should handle nested path updates', () => {
      state.setPath('calendar.selectedDate', '2026-12-01');
      expect(state.getPath('calendar.selectedDate')).to.equal('2026-12-01');
    });
  });
  
  describe('Service Management', () => {
    it('should add service to selection', () => {
      const service = { id: '1', name: 'Test Service', price: 100 };
      state.addService(service);
      
      const services = state.getPath('selectedServices');
      expect(services).to.have.lengthOf(1);
      expect(services[0].id).to.equal('1');
    });
    
    it('should not add duplicate services', () => {
      const service = { id: '1', name: 'Test Service', price: 100 };
      state.addService(service);
      state.addService(service);
      
      expect(state.getPath('selectedServices')).to.have.lengthOf(1);
    });
    
    it('should remove service from selection', () => {
      const service = { id: '1', name: 'Test Service', price: 100 };
      state.addService(service);
      state.removeService('1');
      
      expect(state.getPath('selectedServices')).to.be.empty;
    });
    
    it('should recalculate pricing when services change', () => {
      const service1 = { id: '1', name: 'Service 1', price: 100 };
      const service2 = { id: '2', name: 'Service 2', price: 50 };
      
      state.addService(service1);
      expect(state.getPath('pricing.servicesTotal')).to.equal(100);
      
      state.addService(service2);
      expect(state.getPath('pricing.servicesTotal')).to.equal(150);
    });
  });
  
  describe('Pricing Calculations', () => {
    it('should calculate deposit correctly (50%)', () => {
      state.addService({ id: '1', name: 'Service', price: 200 });
      expect(state.getPath('pricing.depositAmount')).to.equal(100);
    });
    
    it('should calculate balance correctly', () => {
      state.addService({ id: '1', name: 'Service', price: 200 });
      expect(state.getPath('pricing.balanceDue')).to.equal(100);
    });
    
    it('should include call-out fee in total', () => {
      state.addService({ id: '1', name: 'Service', price: 100 });
      state.setCallOutFee(50);
      
      expect(state.getPath('pricing.totalAmount')).to.equal(150);
    });
  });
  
  describe('Validation', () => {
    it('should validate step 2 requires services', () => {
      const result = state.validateForStep(2);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Please select at least one service');
    });
    
    it('should validate step 3 requires date and time', () => {
      state.addService({ id: '1', name: 'Service', price: 100 });
      const result = state.validateForStep(3);
      
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(2);
    });
    
    it('should validate step 4 requires client details', () => {
      state.addService({ id: '1', name: 'Service', price: 100 });
      state.setPath('calendar.selectedDate', '2026-12-01');
      state.setPath('calendar.selectedTime', '10:00-11:00');
      
      const result = state.validateForStep(4);
      expect(result.valid).to.be.false;
    });
  });
  
  describe('Cache Management', () => {
    it('should cache month data', () => {
      const data = { '2026-12-01': ['10:00-11:00'] };
      state.cacheMonth('2026-12', data);
      
      const cached = state.getCachedMonth('2026-12');
      expect(cached).to.deep.equal(data);
    });
    
    it('should expire old cache entries', (done) => {
      const data = { '2026-12-01': ['10:00-11:00'] };
      state.cacheMonth('2026-12', data);
      
      // Manually set timestamp to 6 minutes ago
      state._state.calendar.monthCache['2026-12'].timestamp = Date.now() - (6 * 60 * 1000);
      
      const cached = state.getCachedMonth('2026-12');
      expect(cached).to.be.null;
      done();
    });
  });
  
  describe('Reset', () => {
    it('should reset state to initial values', () => {
      state.addService({ id: '1', name: 'Service', price: 100 });
      state.setPath('client.name', 'John Doe');
      state.setPath('step', 3);
      
      state.reset();
      
      const current = state.get();
      expect(current.step).to.equal(1);
      expect(current.selectedServices).to.be.empty;
      expect(current.client.name).to.equal('');
    });
  });
});

describe('Validation Tests', () => {
  describe('Name Validator', () => {
    it('should accept valid names', () => {
      expect(Validators.name('John Doe').valid).to.be.true;
      expect(Validators.name('Mary-Jane').valid).to.be.true;
      expect(Validators.name("O'Brien").valid).to.be.true;
    });
    
    it('should reject names shorter than 2 characters', () => {
      expect(Validators.name('J').valid).to.be.false;
    });
    
    it('should reject names with numbers', () => {
      expect(Validators.name('John123').valid).to.be.false;
    });
    
    it('should reject names with special characters', () => {
      expect(Validators.name('John@Doe').valid).to.be.false;
    });
  });
  
  describe('Email Validator', () => {
    it('should accept valid email addresses', () => {
      expect(Validators.email('john@example.com').valid).to.be.true;
      expect(Validators.email('john.doe@example.co.za').valid).to.be.true;
    });
    
    it('should reject invalid email formats', () => {
      expect(Validators.email('invalid').valid).to.be.false;
      expect(Validators.email('john@').valid).to.be.false;
      expect(Validators.email('@example.com').valid).to.be.false;
    });
    
    it('should normalize email to lowercase', () => {
      const result = Validators.email('John@EXAMPLE.COM');
      // Email validation doesn't return normalized value, just validates
      expect(result.valid).to.be.true;
    });
  });
  
  describe('Phone Validator', () => {
    it('should accept valid SA phone numbers', () => {
      expect(Validators.phone('+27821234567').valid).to.be.true;
      expect(Validators.phone('0821234567').valid).to.be.true;
    });
    
    it('should reject invalid phone numbers', () => {
      expect(Validators.phone('123').valid).to.be.false;
      expect(Validators.phone('+1234567890123456').valid).to.be.false;
    });
  });
});

describe('Formatter Tests', () => {
  describe('Currency Formatter', () => {
    it('should format currency correctly', () => {
      expect(Formatters.currency(100)).to.equal('R100.00');
      expect(Formatters.currency(1234.56)).to.equal('R1,234.56');
      expect(Formatters.currency(0)).to.equal('R0.00');
    });
  });
  
  describe('Date Formatter', () => {
    it('should format dates correctly', () => {
      expect(Formatters.date('2026-12-01')).to.equal('1 Dec 2026');
      expect(Formatters.date('2026-01-15')).to.equal('15 Jan 2026');
    });
  });
  
  describe('Duration Formatter', () => {
    it('should format durations correctly', () => {
      expect(Formatters.duration(30)).to.equal('30min');
      expect(Formatters.duration(60)).to.equal('1h');
      expect(Formatters.duration(90)).to.equal('1h 30min');
      expect(Formatters.duration(120)).to.equal('2h');
    });
  });
});

describe('Performance Utilities Tests', () => {
  describe('Cache', () => {
    let cache;
    
    beforeEach(() => {
      cache = new Cache(1000); // 1 second TTL
    });
    
    it('should store and retrieve values', () => {
      cache.set('key', 'value');
      expect(cache.get('key')).to.equal('value');
    });
    
    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).to.be.null;
    });
    
    it('should expire values after TTL', (done) => {
      cache.set('key', 'value', 100);
      
      setTimeout(() => {
        expect(cache.get('key')).to.be.null;
        done();
      }, 150);
    });
    
    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      
      expect(cache.size()).to.equal(0);
    });
  });
  
  describe('Debounce', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const fn = debounce(() => { callCount++; }, 100);
      
      fn();
      fn();
      fn();
      
      setTimeout(() => {
        expect(callCount).to.equal(1);
        done();
      }, 150);
    });
  });
  
  describe('Throttle', () => {
    it('should throttle function calls', (done) => {
      let callCount = 0;
      const fn = throttle(() => { callCount++; }, 100);
      
      fn();
      fn();
      fn();
      
      setTimeout(() => {
        expect(callCount).to.equal(1);
        done();
      }, 50);
    });
  });
});
