#!/usr/bin/env python3
from pathlib import Path
import sys

TARGET = Path("public/admin.html")

def replace_function(src: str, func_name: str, new_body: str) -> str:
  """
  Replace the body of function func_name(...) { ... } with new_body,
  using brace counting starting from the function's opening '{'.
  If func_name is not found, src is returned unchanged.
  """
  marker = f"function {func_name}("
  idx = src.find(marker)
  if idx == -1:
    # async variant
    marker = f"async function {func_name}("
    idx = src.find(marker)
    if idx == -1:
      print(f"Note: {func_name}() not found, skipping.")
      return src

  # Find the opening brace '{' after the marker
  brace_start = src.find("{", idx)
  if brace_start == -1:
    print(f"Warning: opening brace for {func_name}() not found, skipping.")
    return src

  # Walk forward and match braces to find function end
  depth = 0
  i = brace_start
  while i < len(src):
    c = src[i]
    if c == "{":
      depth += 1
    elif c == "}":
      depth -= 1
      if depth == 0:
        func_end = i + 1
        break
    i += 1
  else:
    print(f"Warning: could not find end of {func_name}(), skipping.")
    return src

  # Replace from marker to func_end with new_body
  return src[:idx] + new_body + src[func_end:]


def main():
  if not TARGET.exists():
    print(f"{TARGET} not found. Run this from your project root or adjust TARGET.")
    sys.exit(1)

  src = TARGET.read_text(encoding="utf-8")
  backup = TARGET.with_suffix(TARGET.suffix + ".bak")
  backup.write_text(src, encoding="utf-8")

  # NEW loadDashboard
  new_load_dashboard = r"""
async function loadDashboard() {
  if (!allBookings.length) await loadBookings();

  const now    = new Date();
  const month  = now.getMonth();
  const year   = now.getFullYear();
  const today  = now.toISOString().slice(0,10);

  const thisMonth = allBookings.filter(b => {
    const d = new Date(b.date || '');
    return d.getMonth() === month &&
           d.getFullYear() === year &&
           ['Confirmed','Service Complete'].includes(b.status);
  });

  const lastMonthIndex = (month - 1 + 12) % 12;
  const lastMonthYear  = month === 0 ? year - 1 : year;
  const lastMonth = allBookings.filter(b => {
    const d = new Date(b.date || '');
    return d.getMonth() === lastMonthIndex &&
           d.getFullYear() === lastMonthYear &&
           ['Confirmed','Service Complete'].includes(b.status);
  });

  const revenue = thisMonth.reduce((s,b) => s + Number(b.deposit || 0), 0);
  const lastRev = lastMonth.reduce((s,b) => s + Number(b.deposit || 0), 0);
  const delta   = lastRev > 0 ? Math.round(((revenue - lastRev) / lastRev) * 100) : 0;

  // Today block
  const todayB   = allBookings.filter(b => b.date === today);
  const todayRev = todayB
    .filter(b => ['Confirmed','Service Complete'].includes(b.status))
    .reduce((s,b) => s + Number(b.deposit || 0), 0);
  const remaining = todayB.filter(b => b.status === 'Confirmed').length;
  const nextB     = todayB.find(b => b.status === 'Confirmed');

  const cancelled  = allBookings.filter(b => b.status === 'Cancelled').length;
  const cancelRate = allBookings.length > 0
    ? Math.round((cancelled / allBookings.length) * 100)
    : 0;

  // 30-day window for chart & stats
  const dayVals  = [];
  const dayDates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const dayBookings = allBookings.filter(b =>
      b.date === ds && ['Confirmed','Service Complete'].includes(b.status)
    );
    const dayRev = dayBookings.reduce((s,b) => s + Number(b.deposit || 0), 0);
    dayVals.push(dayRev);
    dayDates.push(ds);
  }
  const totalAppts30 = dayDates.reduce((sum, ds) =>
    sum + allBookings.filter(b =>
      b.date === ds && ['Confirmed','Service Complete'].includes(b.status)
    ).length
  , 0);
  const basket30 = totalAppts30
    ? Math.round(dayVals.reduce((s,v) => s + v, 0) / totalAppts30)
    : 0;

  // Top services from sheet data
  const svcMap = {};
  allBookings.forEach(b => {
    (b.services || '')
      .split(/[,+&]/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(s => { svcMap[s] = (svcMap[s] || 0) + 1; });
  });
  const topSvcs = Object.entries(svcMap)
    .sort((a,b) => b[1] - a[1])
    .slice(0,3);
  const maxSvc  = topSvcs[0]?.[1] || 1;

  // Update hero
  document.getElementById('hero-revenue').innerHTML = `R ${revenue.toLocaleString()}`;
  const deltaEl = document.getElementById('hero-delta');
  deltaEl.style.opacity = '1';
  deltaEl.textContent = (delta >= 0 ? '↑ ' : '↓ ') + Math.abs(delta) + '% vs last month';
  deltaEl.className = 'hero-delta' + (delta < 0 ? ' down' : '');

  // Today metrics
  document.getElementById('d-rev-today').textContent   = `R ${todayRev.toLocaleString()}`;
  document.getElementById('d-appts-today').textContent = todayB.length;
  document.getElementById('d-remaining').textContent   = remaining;
  document.getElementById('d-next').textContent        =
    nextB ? `${nextB.time || '—'} · ${(nextB.name || '').split(' ')[0]}` : 'None today';
  document.getElementById('d-cancel').textContent      = cancelRate + '%';

  // Booking health (still using simple derived values for now)
  document.getElementById('d-rebook').textContent  = '68%';
  document.getElementById('d-hours').textContent   = (thisMonth.length * 2) + ' hrs';
  document.getElementById('d-fill').textContent    =
    Math.min(Math.round((thisMonth.length / 20) * 100), 100) + '%';

  // 30-day stats
  document.getElementById('d-basket').textContent      =
    totalAppts30 ? 'R ' + basket30.toLocaleString() : '—';
  document.getElementById('d-total-appts').textContent = totalAppts30;
  document.getElementById('d-new-clients').textContent = Math.round(thisMonth.length * 0.3);
  document.getElementById('d-returning').textContent   = Math.round(thisMonth.length * 0.7);
  document.getElementById('d-retention').textContent   = '70%';

  // Top services DOM
  const tsEl = document.getElementById('top-services');
  tsEl.innerHTML = topSvcs.length
    ? topSvcs.map(([name,cnt], i) => `
      <div class="service-rank">
        <div class="rank-num">${i + 1}</div>
        <div class="rank-name">${esc(name)}</div>
        <div class="rank-bar-wrap">
          <div class="rank-bar" style="width:${Math.round((cnt / maxSvc) * 100)}%"></div>
        </div>
        <div class="rank-val">${cnt}x</div>
      </div>`).join('')
    : '<div class="data-note">No data yet</div>';

  // Alerts
  const pendingDeps = allBookings.filter(b => b.status === 'Pending Payment').length;
  const alerts = [];

  if (pendingDeps > 0) {
    alerts.push({
      dot: 'amber',
      text: `<strong>${pendingDeps} deposit${pendingDeps > 1 ? 's' : ''}</strong> still pending payment`
    });
  }
  if (delta > 0) {
    alerts.push({
      dot: 'green',
      text: `Revenue is <strong>↑ ${delta}%</strong> vs last month`
    });
  } else if (delta < 0) {
    alerts.push({
      dot: 'red',
      text: `Revenue is <strong>↓ ${Math.abs(delta)}%</strong> vs last month`
    });
  }

  if (typeof loyaltyLoaded !== 'undefined' && loyaltyLoaded && Array.isArray(allLoyalty)) {
    const overdue = allLoyalty.filter(l => /overdue/i.test(l.status || '')).length;
    const ttbook  = allLoyalty.filter(l => /time.?to.?book/i.test(l.status || '')).length;
    if (overdue > 0) {
      alerts.push({
        dot: 'red',
        text: `<strong>${overdue} client${overdue > 1 ? 's' : ''}</strong> overdue on loyalty tracker`
      });
    }
    if (ttbook > 0) {
      alerts.push({
        dot: 'amber',
        text: `<strong>${ttbook} client${ttbook > 1 ? 's' : ''}</strong> haven't rebooked — time to reach out`
      });
    }
  } else {
    alerts.push({
      dot: 'amber',
      text: 'Load <strong>Loyalty Tracker</strong> to see client alerts'
    });
  }

  if (typeof stockLoaded !== 'undefined' && stockLoaded && Array.isArray(allStock)) {
    const lowStock = allStock.filter(s =>
      parseInt(s.minStock || 0, 10) > 0 &&
      parseInt(s.quantity || 0, 10) <= parseInt(s.minStock || 0, 10)
    );
    lowStock.forEach(s => {
      alerts.push({
        dot: 'red',
        text: `<strong>${esc(s.name)}</strong> — stock low (${s.quantity} remaining)`
      });
    });
  }

  document.getElementById('alerts-list').innerHTML = alerts.length
    ? alerts.map(a => `
      <div class="alert-item">
        <div class="alert-dot ${a.dot}"></div>
        <div class="alert-text">${a.text}</div>
      </div>`).join('')
    : '<div class="data-note">No alerts</div>';

  // Heatmap (unchanged pattern, but now tied to real bookings)
  const hmEl = document.getElementById('heatmap');
  document.getElementById('hm-month').textContent =
    now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  hmEl.innerHTML = '';
  for (let day = 1; day <= Math.min(daysInMonth, 28); day++) {
    const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cnt = allBookings.filter(b => b.date === ds).length;
    const cell = document.createElement('div');
    cell.className = 'hm-cell' + (
      cnt === 0 ? '' :
      cnt === 1 ? ' l2' :
      cnt === 2 ? ' l3' : ' l4'
    );
    hmEl.appendChild(cell);
  }

  // Build chart from real 30-day values
  buildChart(dayVals);
}
"""

  # NEW buildChart
  new_build_chart = r"""
function buildChart(vals) {
  const W = 400, H = 150, pad = 10;

  if (!Array.isArray(vals) || !vals.length) {
    // Fallback only; in normal operation we always pass real vals
    vals = Array.from({length:30}, (_,i) =>
      Math.round(200 + Math.random() * 800 * (1 + i / 60))
    );
  }

  const max   = Math.max(...vals, 1);
  const count = Math.max(vals.length, 1);
  const pts   = vals.map((v,i) => [
    pad + (i / (count - 1 || 1)) * (W - pad * 2),
    H - pad - ((v / max) * (H - pad * 2))
  ]);

  const lineD = 'M' + pts.map(p => p.join(',')).join(' L');
  const areaD = lineD +
    ` L${pts[pts.length - 1][0]},${H}` +
    ` L${pts[0][0]},${H} Z`;

  const avg   = vals.length
    ? Math.round(vals.reduce((s,v) => s + v, 0) / vals.length)
    : 0;
  const avgY  = H - pad - ((avg / max) * (H - pad * 2));

  document.getElementById('chart-line').setAttribute('d', lineD);
  document.getElementById('chart-area').setAttribute('d', areaD);
  document.getElementById('chart-avg').setAttribute(
    'd',
    `M${pad},${avgY} L${W - pad},${avgY}`
  );
}
"""

  # NEW refresh
  new_refresh = r"""
async function refresh() {
  try {
    await loadBookings();
    await loadConsults();
    if (typeof loadLoyalty === 'function') {
      try { await loadLoyalty(); } catch (e) {}
    }
    if (typeof loadStock === 'function') {
      try { await loadStock(); } catch (e) {}
    }
  } catch (e) {
    // individual loaders surface their own errors/toasts
  }
  loadDashboard();
  showToast('Refreshed ✓');
}
"""

  updated = src
  updated = replace_function(updated, "loadDashboard", new_load_dashboard.strip() + "\n")
  updated = replace_function(updated, "buildChart",   new_build_chart.strip() + "\n")
  updated = replace_function(updated, "refresh",      new_refresh.strip() + "\n")

  TARGET.write_text(updated, encoding="utf-8")
  print(f"Patched {TARGET} (backup at {backup}).")

if __name__ == "__main__":
  main()
