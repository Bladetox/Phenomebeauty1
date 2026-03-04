// api/places-autocomplete.js — Secure server-side Google Places Autocomplete proxy
// Prevents exposing Google Maps API key to client
'use strict';

const { getDoc, getSettings } = require('./lib/sheet');

/**
 * Rate limiter for Places API requests
 * Prevents abuse and controls costs
 */
const rateLimitMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.start > 5 * 60 * 1000) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

function rateLimit(req, res, maxReqs = 20, windowMs = 60000) {
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(key) || { count: 0, start: now };
  
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  
  entry.count++;
  rateLimitMap.set(key, entry);
  
  if (entry.count > maxReqs) {
    res.status(429).json({ 
      error: 'Too many address lookups. Please wait a moment.' 
    });
    return false;
  }
  
  return true;
}

/**
 * Serverless function handler for Google Places Autocomplete
 * GET /api/places-autocomplete?input=query
 */
module.exports = async (req, res) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Rate limiting
  if (!rateLimit(req, res, 20, 60000)) {
    return;
  }
  
  try {
    // Get query parameter
    const input = (req.query.input || '').trim();
    
    // Validate input
    if (!input) {
      return res.status(400).json({ error: 'Input parameter required' });
    }
    
    if (input.length < 3) {
      return res.json({ suggestions: [] });
    }
    
    if (input.length > 200) {
      return res.status(400).json({ error: 'Input too long' });
    }
    
    // Get API key from server-side settings
    const doc = await getDoc();
    const settings = await getSettings(doc);
    const apiKey = settings.google_maps_api_key || '';
    
    if (!apiKey) {
      console.error('Google Maps API key not configured in Settings sheet');
      return res.status(503).json({ 
        error: 'Address lookup temporarily unavailable' 
      });
    }
    
    // Call Google Places API (New) server-side
    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: input,
          includedRegionCodes: ['za'], // South Africa priority
          languageCode: 'en',
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Places API error:', response.status, errorText.slice(0, 200));
      
      // Don't expose internal errors to client
      return res.status(503).json({ 
        error: 'Address lookup service temporarily unavailable' 
      });
    }
    
    const data = await response.json();
    
    // Transform response to simpler format
    const suggestions = (data.suggestions || []).slice(0, 5).map(s => {
      const p = s.placePrediction;
      return {
        mainText: p?.structuredFormat?.mainText?.text || p?.text?.text || '',
        secondaryText: p?.structuredFormat?.secondaryText?.text || '',
        fullText: p?.text?.text || '',
      };
    });
    
    return res.json({ suggestions });
    
  } catch (error) {
    console.error('Places autocomplete error:', error.message);
    return res.status(500).json({ 
      error: 'An error occurred during address lookup' 
    });
  }
};
