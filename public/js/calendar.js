// public/js/calendar.js — Calendar rendering and date/time selection (Step 2)
// Extracted from index.html calendar functionality
'use strict';

import { bookingState, updateState, setStatePath } from './state.js';
import { fetchMonthAvailability } from './api.js';
import { showToast, escHtml, updateNextBtn, setLoading } from './ui.js';

/**
 * Initialize and render calendar
 */
export async function initCalendar() {
  const now = new Date();
  
  // Initialize calendar state if not set
  if (!bookingState.calendar.year) {
    setStatePath('calendar.year', now.getFullYear());
    setStatePath('calendar.month', now.getMonth() + 1);
  }
  
  await calRender();
}

/**
 * Main calendar render function
 */
export async function calRender() {
  const year = bookingState.calendar.year;
  const month = bookingState.calendar.month;
  
  // Update calendar header
  updateCalendarHeader(year, month);
  
  // Load month data (with caching)
  await calLoadMonth(year, month);
  
  // Draw calendar grid
  calDrawDays();
  
  // Render time slots if date is selected
  if (bookingState.calendar.selectedDate) {
    renderTimeSlots();
  }
}

/**
 * Update calendar month/year header display
 */
function updateCalendarHeader(year, month) {
  const monthEl = document.getElementById('cal-month-year');
  if (!monthEl) return;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  monthEl.textContent = `${monthNames[month - 1]} ${year}`;
}

/**
 * Load month availability data (with caching)
 */
async function calLoadMonth(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month)}`;
  
  // Check cache first
  if (bookingState.calendar.monthCache[monthKey]?.loaded) {
    return;
  }
  
  // Show loading state
  calDrawDays('loading');
  
  try {
    const availability = await fetchMonthAvailability(year, month);
    
    // Store in cache
    bookingState.calendar.monthCache[monthKey] = {
      loaded: true,
      availability,
      loadedAt: Date.now(),
    };
    
  } catch (error) {
    showToast(error.message || 'Failed to load calendar', true);
    
    // Store empty availability to prevent repeated failures
    bookingState.calendar.monthCache[monthKey] = {
      loaded: true,
      availability: {},
      loadedAt: Date.now(),
    };
  }
}

/**
 * Draw calendar day grid
 * @param {String} state - 'loading' or undefined
 */
function calDrawDays(state = null) {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  
  if (state === 'loading') {
    grid.innerHTML = '<div class="cal-loading">Loading...</div>';
    return;
  }
  
  const year = bookingState.calendar.year;
  const month = bookingState.calendar.month;
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month)}`;
  
  const availability = bookingState.calendar.monthCache[monthKey]?.availability || {};
  
  // Calculate calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  
  let html = '';
  
  // Week day headers
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  html += '<div class="cal-week-header">';
  dayNames.forEach(day => {
    html += `<div class="cal-day-name">${day}</div>`;
  });
  html += '</div>';
  
  // Days grid
  html += '<div class="cal-days-grid">';
  
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day cal-day-empty"></div>';
  }
  
  // Month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const hasSlots = availability[dateStr] && availability[dateStr].length > 0;
    const isPast = dateStr < todayStr;
    const isSelected = dateStr === bookingState.calendar.selectedDate;
    const isToday = dateStr === todayStr;
    
    let classes = 'cal-day';
    if (isPast) classes += ' cal-day-past';
    else if (hasSlots) classes += ' cal-day-available';
    else classes += ' cal-day-unavailable';
    if (isSelected) classes += ' cal-day-selected';
    if (isToday) classes += ' cal-day-today';
    
    const disabled = isPast || !hasSlots;
    const clickable = !disabled;
    
    html += `
      <div 
        class="${classes}" 
        data-date="${dateStr}"
        ${clickable ? `role="button" tabindex="0"` : ''}
      >
        <span class="cal-day-number">${day}</span>
        ${hasSlots ? `<span class="cal-day-dot"></span>` : ''}
      </div>
    `;
  }
  
  html += '</div>';
  grid.innerHTML = html;
  
  // Attach click listeners
  grid.querySelectorAll('.cal-day-available, .cal-day-selected').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      const dateStr = dayEl.dataset.date;
      selectDate(dateStr);
    });
    
    // Keyboard support
    dayEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const dateStr = dayEl.dataset.date;
        selectDate(dateStr);
      }
    });
  });
}

/**
 * Select a date
 * @param {String} dateStr - Date string (YYYY-MM-DD)
 */
export function selectDate(dateStr) {
  const year = bookingState.calendar.year;
  const month = bookingState.calendar.month;
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month)}`;
  
  const availability = bookingState.calendar.monthCache[monthKey]?.availability || {};
  
  // Check if date has slots
  if (!availability[dateStr] || availability[dateStr].length === 0) {
    showToast('No available time slots for this date', true);
    return;
  }
  
  // Update state
  setStatePath('calendar.selectedDate', dateStr);
  setStatePath('calendar.selectedTime', ''); // Clear time selection
  
  // Re-render calendar to show selection
  calDrawDays();
  
  // Render time slots
  renderTimeSlots();
  
  updateNextBtn();
}

/**
 * Render available time slots for selected date
 */
function renderTimeSlots() {
  const container = document.getElementById('time-slots');
  if (!container) return;
  
  const dateStr = bookingState.calendar.selectedDate;
  if (!dateStr) {
    container.innerHTML = '';
    return;
  }
  
  const year = bookingState.calendar.year;
  const month = bookingState.calendar.month;
  const pad = n => String(n).padStart(2, '0');
  const monthKey = `${year}-${pad(month)}`;
  
  const availability = bookingState.calendar.monthCache[monthKey]?.availability || {};
  const slots = availability[dateStr] || [];
  
  if (slots.length === 0) {
    container.innerHTML = '<p class="no-slots">No available time slots</p>';
    return;
  }
  
  // Render time slot buttons
  container.innerHTML = `
    <div class="time-slots-header">
      <h4>Available Times</h4>
    </div>
    <div class="time-slots-grid">
      ${slots.map(slot => {
        const isSelected = slot === bookingState.calendar.selectedTime;
        return `
          <button 
            type="button"
            class="time-slot ${isSelected ? 'time-slot-selected' : ''}"
            data-time="${escHtml(slot)}"
          >
            ${escHtml(slot)}
          </button>
        `;
      }).join('')}
    </div>
  `;
  
  // Attach listeners
  container.querySelectorAll('.time-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      const time = btn.dataset.time;
      selectTime(time);
    });
  });
  
  // Scroll to time slots
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Select a time slot
 * @param {String} timeStr - Time string (HH:MM-HH:MM)
 */
export function selectTime(timeStr) {
  setStatePath('calendar.selectedTime', timeStr);
  
  // Re-render time slots to show selection
  renderTimeSlots();
  
  updateNextBtn();
  
  showToast('Time slot selected!');
}

/**
 * Navigate to next month
 */
export async function calNext() {
  let year = bookingState.calendar.year;
  let month = bookingState.calendar.month;
  
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }
  
  setStatePath('calendar.year', year);
  setStatePath('calendar.month', month);
  
  await calRender();
}

/**
 * Navigate to previous month
 */
export async function calPrev() {
  let year = bookingState.calendar.year;
  let month = bookingState.calendar.month;
  
  // Don't go before current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (year === currentYear && month === currentMonth) {
    showToast('Cannot view past months', true);
    return;
  }
  
  month--;
  if (month < 1) {
    month = 12;
    year--;
  }
  
  setStatePath('calendar.year', year);
  setStatePath('calendar.month', month);
  
  await calRender();
}

/**
 * Get formatted selected date and time
 * @returns {Object} - {date, time, dateFormatted}
 */
export function getSelectedDateTime() {
  const date = bookingState.calendar.selectedDate;
  const time = bookingState.calendar.selectedTime;
  
  let dateFormatted = '';
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    dateFormatted = dateObj.toLocaleDateString('en-ZA', options);
  }
  
  return { date, time, dateFormatted };
}
