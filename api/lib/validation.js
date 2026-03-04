// api/lib/validation.js — Comprehensive input validation and sanitization
'use strict';

/**
 * Sanitize string input: remove HTML tags, trim, limit length
 * @param {any} value - Input value
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
function sanitizeString(value, maxLength = 200) {
  if (value === null || value === undefined) return '';
  
  return String(value)
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/[<>"'`]/g, '')           // Remove dangerous characters
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate and normalize email address
 * @param {string} email - Email to validate
 * @returns {object} - {valid: boolean, email: string, error?: string}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, email: '', error: 'Email is required' };
  }
  
  const cleaned = sanitizeString(email, 120).toLowerCase();
  
  // RFC 5322 simplified regex
  const emailRegex = /^[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  
  if (!emailRegex.test(cleaned)) {
    return { valid: false, email: cleaned, error: 'Invalid email format' };
  }
  
  if (cleaned.length < 5 || cleaned.length > 120) {
    return { valid: false, email: cleaned, error: 'Email length must be 5-120 characters' };
  }
  
  return { valid: true, email: cleaned };
}

/**
 * Validate and normalize international phone number
 * @param {string} phone - Phone number to validate
 * @param {string} defaultCountryCode - Default country code (e.g., '+27')
 * @returns {object} - {valid: boolean, phone: string, error?: string}
 */
function validatePhone(phone, defaultCountryCode = '+27') {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, phone: '', error: 'Phone number is required' };
  }
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[\s\-().]/g, '');
  
  // Handle numbers starting with +
  if (cleaned.startsWith('+')) {
    // Remove patterns like +27(0) -> +27
    cleaned = cleaned.replace(/^(\+\d{1,3})(0)/, '$1');
  } else {
    // Remove leading zero and add country code
    cleaned = defaultCountryCode + cleaned.replace(/^0+/, '');
  }
  
  // Validate E.164 format: + followed by 7-15 digits
  const phoneRegex = /^\+\d{7,15}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return {
      valid: false,
      phone: cleaned,
      error: 'Phone number must be 7-15 digits in international format'
    };
  }
  
  return { valid: true, phone: cleaned };
}

/**
 * Validate date string (YYYY-MM-DD format)
 * @param {string} dateStr - Date string to validate
 * @param {boolean} allowPast - Whether to allow past dates
 * @returns {object} - {valid: boolean, date: string, error?: string}
 */
function validateDate(dateStr, allowPast = false) {
  if (!dateStr || typeof dateStr !== 'string') {
    return { valid: false, date: '', error: 'Date is required' };
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return { valid: false, date: dateStr, error: 'Date must be in YYYY-MM-DD format' };
  }
  
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Validate ranges
  if (year < 2024 || year > 2100) {
    return { valid: false, date: dateStr, error: 'Year must be between 2024 and 2100' };
  }
  
  if (month < 1 || month > 12) {
    return { valid: false, date: dateStr, error: 'Month must be between 1 and 12' };
  }
  
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, date: dateStr, error: `Day must be between 1 and ${daysInMonth}` };
  }
  
  // Check if date is valid
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    return { valid: false, date: dateStr, error: 'Invalid date' };
  }
  
  // Check if past
  if (!allowPast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return { valid: false, date: dateStr, error: 'Date cannot be in the past' };
    }
  }
  
  return { valid: true, date: dateStr };
}

/**
 * Validate time range string (HH:MM-HH:MM format)
 * @param {string} timeStr - Time string to validate
 * @returns {object} - {valid: boolean, time: string, error?: string}
 */
function validateTimeRange(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { valid: false, time: '', error: 'Time is required' };
  }
  
  const timeRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  if (!timeRegex.test(timeStr)) {
    return { valid: false, time: timeStr, error: 'Time must be in HH:MM-HH:MM format' };
  }
  
  const [start, end] = timeStr.split('-');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  // Validate hours and minutes
  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
    return { valid: false, time: timeStr, error: 'Hours must be between 0 and 23' };
  }
  
  if (startMin < 0 || startMin > 59 || endMin < 0 || endMin > 59) {
    return { valid: false, time: timeStr, error: 'Minutes must be between 0 and 59' };
  }
  
  // Validate end time is after start time
  const startMins = startHour * 60 + startMin;
  const endMins = endHour * 60 + endMin;
  
  if (endMins <= startMins) {
    return { valid: false, time: timeStr, error: 'End time must be after start time' };
  }
  
  return { valid: true, time: timeStr };
}

/**
 * Validate booking data from client
 * @param {object} data - Booking data object
 * @returns {object} - {valid: boolean, errors: array, sanitized: object}
 */
function validateBookingData(data) {
  const errors = [];
  const sanitized = {};
  
  // Name validation
  sanitized.name = sanitizeString(data.name, 80);
  if (sanitized.name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
  
  // Email validation
  const emailResult = validateEmail(data.email);
  if (!emailResult.valid) {
    errors.push({ field: 'email', message: emailResult.error });
  }
  sanitized.email = emailResult.email;
  
  // Phone validation
  const phoneResult = validatePhone(data.phone);
  if (!phoneResult.valid) {
    errors.push({ field: 'phone', message: phoneResult.error });
  }
  sanitized.phone = phoneResult.phone;
  
  // Address validation
  sanitized.address = sanitizeString(data.address, 200);
  if (sanitized.address.length < 5) {
    errors.push({ field: 'address', message: 'Address must be at least 5 characters' });
  }
  
  // Date validation
  const dateResult = validateDate(data.date, false);
  if (!dateResult.valid) {
    errors.push({ field: 'date', message: dateResult.error });
  }
  sanitized.date = dateResult.date;
  
  // Time validation
  const timeResult = validateTimeRange(data.time);
  if (!timeResult.valid) {
    errors.push({ field: 'time', message: timeResult.error });
  }
  sanitized.time = timeResult.time;
  
  // Services validation
  if (!Array.isArray(data.services)) {
    errors.push({ field: 'services', message: 'Services must be an array' });
    sanitized.services = [];
  } else if (data.services.length === 0) {
    errors.push({ field: 'services', message: 'At least one service must be selected' });
    sanitized.services = [];
  } else if (data.services.length > 20) {
    errors.push({ field: 'services', message: 'Maximum 20 services allowed' });
    sanitized.services = data.services.slice(0, 20);
  } else {
    sanitized.services = data.services.map(s => ({
      id: sanitizeString(String(s.id || ''), 20),
      name: sanitizeString(String(s.name || ''), 60),
      price: Math.max(0, parseFloat(s.price) || 0),
      duration: Math.max(0, parseInt(s.duration) || 0),
    }));
  }
  
  // Numeric validations
  sanitized.servicesTotal = Math.max(0, parseFloat(data.servicesTotal) || 0);
  sanitized.callOutFee = Math.max(0, parseFloat(data.callOutFee) || 0);
  sanitized.totalAmount = Math.max(0, parseFloat(data.totalAmount) || 0);
  sanitized.depositAmount = Math.max(0, parseFloat(data.depositAmount) || 0);
  sanitized.balanceDue = Math.max(0, parseFloat(data.balanceDue) || 0);
  
  // Optional fields
  sanitized.source = sanitizeString(data.source, 50);
  sanitized.divaType = ['new', 'existing'].includes(data.divaType) ? data.divaType : 'existing';
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Express middleware: Validate booking request body
 */
function validateBookingRequest(req, res, next) {
  const result = validateBookingData(req.body);
  
  if (!result.valid) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.errors,
    });
  }
  
  // Replace body with sanitized data
  req.body = result.sanitized;
  next();
}

module.exports = {
  sanitizeString,
  validateEmail,
  validatePhone,
  validateDate,
  validateTimeRange,
  validateBookingData,
  validateBookingRequest,
};
