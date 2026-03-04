// tests/api.test.js — API endpoint tests
'use strict';

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const request = require('supertest');
const app = require('../api/index');

describe('API Security Tests', () => {
  describe('Places Autocomplete Proxy', () => {
    it('should reject requests without input parameter', async () => {
      const res = await request(app)
        .get('/api/places-autocomplete')
        .expect(400);
      
      expect(res.body.error).to.include('Input parameter required');
    });
    
    it('should reject input shorter than 3 characters', async () => {
      const res = await request(app)
        .get('/api/places-autocomplete?input=ab')
        .expect(200);
      
      expect(res.body.suggestions).to.be.an('array').that.is.empty;
    });
    
    it('should reject input longer than 200 characters', async () => {
      const longInput = 'a'.repeat(201);
      const res = await request(app)
        .get(`/api/places-autocomplete?input=${longInput}`)
        .expect(400);
      
      expect(res.body.error).to.include('Input too long');
    });
    
    it('should rate limit excessive requests', async () => {
      // Make 21 requests (rate limit is 20/min)
      const requests = Array(21).fill().map(() => 
        request(app).get('/api/places-autocomplete?input=cape+town')
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited).to.be.true;
    });
  });
  
  describe('Authentication', () => {
    it('should reject admin requests without token', async () => {
      const res = await request(app)
        .get('/api/admin/bookings')
        .expect(401);
      
      expect(res.body.code).to.equal('MISSING_TOKEN');
    });
    
    it('should reject invalid token format', async () => {
      const res = await request(app)
        .get('/api/admin/bookings')
        .set('X-Admin-Token', 'invalid-token')
        .expect(401);
      
      expect(res.body.code).to.equal('INVALID_TOKEN');
    });
    
    it('should rate limit failed login attempts', async () => {
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/api/admin/login')
          .send({ password: 'wrong-password' })
      );
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited).to.be.true;
    });
  });
  
  describe('Booking Validation', () => {
    it('should reject booking without required fields', async () => {
      const res = await request(app)
        .post('/api/book')
        .send({})
        .expect(400);
      
      expect(res.body.error).to.exist;
    });
    
    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/book')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          phone: '+27821234567',
          address: '123 Main St, Cape Town',
          services: [{ id: '1', name: 'Service', price: 100 }],
          date: '2026-12-01',
          time: '10:00-11:00',
          servicesTotal: 100,
          callOutFee: 0,
          totalAmount: 100,
          depositAmount: 50,
          balanceDue: 50,
        })
        .expect(400);
      
      expect(res.body.error).to.include('email');
    });
    
    it('should validate phone number format', async () => {
      const res = await request(app)
        .post('/api/book')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '123', // Invalid
          address: '123 Main St, Cape Town',
          services: [{ id: '1', name: 'Service', price: 100 }],
          date: '2026-12-01',
          time: '10:00-11:00',
          servicesTotal: 100,
          callOutFee: 0,
          totalAmount: 100,
          depositAmount: 50,
          balanceDue: 50,
        })
        .expect(400);
      
      expect(res.body.error).to.include('phone');
    });
    
    it('should validate date format', async () => {
      const res = await request(app)
        .post('/api/book')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+27821234567',
          address: '123 Main St, Cape Town',
          services: [{ id: '1', name: 'Service', price: 100 }],
          date: '2026/12/01', // Invalid format
          time: '10:00-11:00',
          servicesTotal: 100,
          callOutFee: 0,
          totalAmount: 100,
          depositAmount: 50,
          balanceDue: 50,
        })
        .expect(400);
      
      expect(res.body.error).to.include('date');
    });
    
    it('should reject bookings with empty services array', async () => {
      const res = await request(app)
        .post('/api/book')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+27821234567',
          address: '123 Main St, Cape Town',
          services: [], // Empty
          date: '2026-12-01',
          time: '10:00-11:00',
          servicesTotal: 100,
          callOutFee: 0,
          totalAmount: 100,
          depositAmount: 50,
          balanceDue: 50,
        })
        .expect(400);
      
      expect(res.body.error).to.include('services');
    });
    
    it('should reject bookings with more than 20 services', async () => {
      const services = Array(21).fill().map((_, i) => ({
        id: String(i),
        name: `Service ${i}`,
        price: 100,
      }));
      
      const res = await request(app)
        .post('/api/book')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+27821234567',
          address: '123 Main St, Cape Town',
          services,
          date: '2026-12-01',
          time: '10:00-11:00',
          servicesTotal: 2100,
          callOutFee: 0,
          totalAmount: 2100,
          depositAmount: 1050,
          balanceDue: 1050,
        })
        .expect(400);
      
      expect(res.body.error).to.include('services');
    });
    
    it('should sanitize HTML in input fields', async () => {
      const res = await request(app)
        .post('/api/book')
        .send({
          name: 'John<script>alert("xss")</script>Doe',
          email: 'john@example.com',
          phone: '+27821234567',
          address: '123 Main St',
          services: [{ id: '1', name: 'Service', price: 100 }],
          date: '2026-12-01',
          time: '10:00-11:00',
          servicesTotal: 100,
          callOutFee: 0,
          totalAmount: 100,
          depositAmount: 50,
          balanceDue: 50,
        });
      
      // Should not contain script tags
      expect(res.status).to.not.equal(500);
    });
  });
  
  describe('Webhook Security', () => {
    it('should reject webhook without signature', async () => {
      const res = await request(app)
        .post('/api/webhook/yoco')
        .send({ type: 'payment.succeeded' })
        .expect(401);
      
      expect(res.body.error).to.include('signature');
    });
    
    it('should reject webhook with invalid signature', async () => {
      const res = await request(app)
        .post('/api/webhook/yoco')
        .set('webhook-signature', 'invalid')
        .send({ type: 'payment.succeeded' })
        .expect(401);
      
      expect(res.body.error).to.include('signature');
    });
  });
});

describe('API Functionality Tests', () => {
  describe('Services Endpoint', () => {
    it('should return services array', async () => {
      const res = await request(app)
        .get('/api?action=getServices')
        .expect(200);
      
      expect(res.body).to.be.an('array');
    });
  });
  
  describe('Month Availability', () => {
    it('should return availability for valid month', async () => {
      const res = await request(app)
        .get('/api?action=getMonthAvailability&month=2026-12')
        .expect(200);
      
      expect(res.body).to.be.an('object');
    });
    
    it('should handle invalid month format gracefully', async () => {
      const res = await request(app)
        .get('/api?action=getMonthAvailability&month=invalid')
        .expect(200);
      
      expect(res.body).to.be.an('object');
    });
  });
  
  describe('Config Endpoint', () => {
    it('should not expose sensitive configuration', async () => {
      const res = await request(app)
        .get('/api?action=getConfig')
        .expect(200);
      
      // Should not expose API keys or secrets
      expect(res.body).to.not.have.property('yoco_secret_key');
      expect(res.body).to.not.have.property('admin_password');
      expect(res.body).to.not.have.property('smtp_pass');
    });
  });
});

describe('Performance Tests', () => {
  it('should respond to health check quickly', async () => {
    const start = Date.now();
    await request(app).get('/api?action=getConfig').expect(200);
    const duration = Date.now() - start;
    
    expect(duration).to.be.below(1000); // Should respond within 1 second
  });
  
  it('should handle concurrent requests', async () => {
    const requests = Array(10).fill().map(() =>
      request(app).get('/api?action=getServices')
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(res => {
      expect(res.status).to.equal(200);
    });
  });
});
