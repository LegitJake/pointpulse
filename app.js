import { MEAL_DURATION_SECONDS, formatTime, getExpirationTimestamp, getProgress, getRemainingSeconds } from './timer-utils.js';
import { getQueueStatus, parseQueueWait } from './wait-data-utils.js';
import { RIDE_CATALOG } from './ride-catalog.js';
import { DINING_LOCATIONS } from './dining-data.js';
import { isSevereWeather, weatherDetails } from './weather-utils.js';

const ENDPOINT = '/api/waits';
const WAIT_REFRESH_INTERVAL = 5 * 60 * 1000;
const WEATHER_REFRESH_INTERVAL = 15 * 60 * 1000;
const CATEGORY_LABELS = { coasters: 'Roller coasters', flat: 'Flat rides', water: 'Water rides', family: 'Family rides', other: 'Other attractions', all: 'All attractions' };
const CATEGORY_RIDES = {
  coasters: ['Blue Streak', 'Cedar Creek Mine Ride', 'Corkscrew', 'GateKeeper', 'Gemini', 'Iron Dragon', 'Magnum XL-200', 'Maverick', 'Millennium Force', 'Pipe Scream', 'Raptor', 'Rougarou', 'Steel Vengeance', 'Top Thrill 2', 'Valravn', 'Wild Mouse', 'Wilderness Run', 'Woodstock Express'],
  flat: ['Dodgem', 'Matterhorn', 'MaxAir', 'Power Tower', 'Scrambler', 'Skyhawk', 'Troika', 'Wave Swinger', 'WindSeeker'],
  water: ['Snake River Falls', 'Thunder Canyon'],
  family: ['Cedar Downs Racing Derby', 'Cedar Point & Lake Erie Railroad', 'CP&LE Railroad', 'Giant Wheel', 'Grand Carousel', 'Kiddy Kingdom Carousel', 'Lake Erie Eagles']
};
const normaliseRideName = (name) => name.toLowerCase().replace(/[®™]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const categoryLookup = new Map(Object.entries(CATEGORY_RIDES).flatMap(([category, names]) => names.map((name) => [normaliseRideName(name), category])));
const catalogByName = new Map(RIDE_CATALOG.map((ride) => [normaliseRideName(ride.name), ride]));
const rideList = document.querySelector('#ride-list');
const updatedAt = document.querySelector('#updated-at');
const openCount = document.querySelector('#open-count');
const filterButton = document.querySelector('#filter-button');
const ridesHeading = document.querySelector('#rides-heading');
const shareButton = document.querySelector('#share-btn, #share-button');
const shareToast = document.querySelector('#share-toast');
const themeToggle = document.querySelector('#theme-toggle');
const refreshButton = document.querySelector('#refresh-btn, #refresh');
const menuToggle = document.querySelector('#menu-toggle');
const sideDrawer = document.querySelector('#side-drawer');
const drawerBackdrop = document.querySelector('#drawer-backdrop');
const drawerClose = document.querySelector('#drawer-close');
const drawerNavItems = document.querySelectorAll('.drawer-nav-item');
const THEME_KEY = 'pointpulse-theme';
let allRides = createUnavailableCatalog();
let parkMap = null;
let mapMarkers = [];
let shareToastTimer = null;
const tabButtons = [...document.querySelectorAll('.nav-tab')];
const tabPanels = [...document.querySelectorAll('.tab-panel')];
let activeCategory = 'coasters';
let sourceUpdatedAt = null;

function getCategory(name) { return categoryLookup.get(normaliseRideName(name)) || 'other'; }

function createUnavailableCatalog() {
  return RIDE_CATALOG.map((ride) => ({ ...ride, wait: null, isOpen: null, sourceStatus: 'Data unavailable', sourceUpdatedAt: null }));
}

function mergeLiveRides(liveRides) {
  const liveByName = new Map(liveRides.map((ride) => [normaliseRideName(ride.name), ride]));
  const catalogRides = RIDE_CATALOG.map((ride) => {
    const liveRide = liveByName.get(normaliseRideName(ride.name));
    return liveRide ? { ...ride, ...liveRide, category: ride.category, area: liveRide.area || ride.area } : { ...ride, wait: null, isOpen: null, sourceStatus: 'Data unavailable', sourceUpdatedAt: null };
  });
  const extraLiveRides = liveRides.filter((ride) => !catalogByName.has(normaliseRideName(ride.name)));
  return [...catalogRides, ...extraLiveRides];
}

function renderRideValue(ride, status) {
  if (status === 'Closed') return '<div class="wait closed">CLOSED</div>';
  if (status === 'Down') return '<div class="wait closed">DOWN</div>';
  if (status === 'Data unavailable') return '<div class="wait closed">DATA UNAVAILABLE</div>';
  if (status !== 'Open') return `<div class="wait closed">${status.toUpperCase()}</div>`;
  if (ride.wait === 0) return '<div class="wait short">WALK-ON</div>';
  if (ride.wait !== null && Number.isFinite(ride.wait)) return `<div class="wait ${ride.wait <= 15 ? 'short' : ''}">${ride.wait}<small>min</small></div>`;
  return '<div class="wait short">OPEN</div>';
}

function renderRides() {
  const rides = activeCategory === 'all' ? allRides : allRides.filter((ride) => ride.category === activeCategory);
  const sorted = [...rides].sort((a, b) => (getQueueStatus(a) !== 'Open') - (getQueueStatus(b) !== 'Open') || ((a.wait ?? Infinity) - (b.wait ?? Infinity)) || a.name.localeCompare(b.name));
  ridesHeading.textContent = CATEGORY_LABELS[activeCategory];
  if (!sorted.length) {
    rideList.innerHTML = '<div class="empty">No Queue-Times attractions are currently listed in this category.</div>';
    return;
  }
  rideList.innerHTML = sorted.map((ride) => {
    const status = getQueueStatus(ride);
    return `
    <article class="ride"><div class="ride-info"><div class="ride-name">${escapeHtml(ride.name)}</div><div class="ride-area">${escapeHtml(ride.area || 'Cedar Point')}</div></div>
    <div class="ride-value">${renderRideValue(ride, status)}</div></article>`;
  }).join('');
}

function renderFreshness(suffix = '') {
  if (!sourceUpdatedAt) return;
  const ageMinutes = Math.max(0, Math.floor((Date.now() - sourceUpdatedAt) / 60_000));
  updatedAt.textContent = `Last updated: ${ageMinutes === 0 ? 'just now' : `${ageMinutes} min ago`}${suffix}`;
}

function getLatestSourceUpdate(data, rides) {
  const timestamps = [data.last_updated, data.updated_at, data.lastUpdated, ...rides.map((ride) => ride.sourceUpdatedAt)]
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  return timestamps.length ? Math.max(...timestamps) : Date.now();
}

function showDataUnavailable() {
  sourceUpdatedAt = null;
  openCount.textContent = allRides.some((ride) => getQueueStatus(ride) === 'Open') ? `${allRides.filter((ride) => getQueueStatus(ride) === 'Open').length} rides open` : 'Live data unavailable';
  updatedAt.textContent = 'Live refresh unavailable · showing last known waits';
  renderRides();
  renderMapMarkers();
}

function escapeHtml(text) { const element = document.createElement('div'); element.textContent = text; return element.innerHTML; }

async function getWaits() {
  if (refreshButton) refreshButton.classList.add('spinning');
  updatedAt.textContent = 'Refreshing live waits…';
  try {
    const response = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!response.ok) throw new Error('Network response was not OK');
    const data = await response.json();
    const queueGroups = [...(data.lands || []), { name: 'Cedar Point', rides: data.rides || [] }];
    const rides = [...new Map(queueGroups.flatMap((land) => (land.rides || []).map((ride) => ({ id: ride.id, name: ride.name, area: land.name, wait: parseQueueWait(ride.wait_time), isOpen: ride.is_open === true ? true : ride.is_open === false ? false : null, sourceStatus: ride.status || ride.state || ride.operating_status, sourceUpdatedAt: ride.last_updated, category: getCategory(ride.name) }))).filter((ride) => ride.name).map((ride) => [ride.id || normaliseRideName(ride.name), ride])).values()];
    if (!rides.length) throw new Error('No active rides returned');
    allRides = mergeLiveRides(rides);
    sourceUpdatedAt = getLatestSourceUpdate(data, rides);
    openCount.textContent = `${rides.filter((ride) => getQueueStatus(ride) === 'Open').length} rides open`;
    renderFreshness();
    renderRides();
    renderMapMarkers();
  } catch {
    showDataUnavailable();
  } finally { if (refreshButton) refreshButton.classList.remove('spinning'); }
}

async function refreshAllLiveData() {
  if (refreshButton) refreshButton.classList.add('spinning');
  updatedAt.textContent = 'Refreshing live data…';
  try {
    await Promise.all([
      getWaits(),
      getWeather()
    ]);
  } finally {
    if (refreshButton) refreshButton.classList.remove('spinning');
  }
}

filterButton.addEventListener('change', () => { activeCategory = filterButton.value; renderRides(); });
if (refreshButton) {
  refreshButton.addEventListener('click', refreshAllLiveData);
}
window.setInterval(getWaits, WAIT_REFRESH_INTERVAL);
window.setInterval(renderFreshness, 30_000);

const DINING_FILTER_OPTIONS = [
  { value: 'all', label: 'All Dining' },
  { value: 'Cedar Point', label: 'Cedar Point' },
  { value: 'Cedar Point Shores', label: 'Cedar Point Shores' }
];

let activeDiningFilter = 'all';

function renderDiningLocations() {
  const diningList = document.querySelector('#dining-list');
  const filteredDining = activeDiningFilter === 'all'
    ? DINING_LOCATIONS
    : DINING_LOCATIONS.filter((location) => location.park === activeDiningFilter);

  diningList.innerHTML = filteredDining.map((location) => `
    <article class="dining-card"><div class="dining-title"><span>${escapeHtml(location.name)}</span><span class="plan-badge">ALL DAY DINING</span></div>
    <p class="dining-meta">${escapeHtml(location.food)}<br />${escapeHtml(location.area)}</p></article>`).join('');
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const resolvedTheme = theme === 'light' ? 'light' : 'dark';
  const isDark = resolvedTheme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  if (themeToggle) {
    themeToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : getSystemTheme();
  applyTheme(initialTheme);
}

function toggleTheme() {
  const activeTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, activeTheme);
  applyTheme(activeTheme);
}

function showTab(tabName) {
  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabName;
  });

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle('active', isActive);
  });

  drawerNavItems.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });
}

function closeDrawer() {
  if (!sideDrawer || !drawerBackdrop) return;
  sideDrawer.classList.remove('open');
  sideDrawer.setAttribute('aria-hidden', 'true');
  drawerBackdrop.hidden = true;
  document.body.classList.remove('drawer-open');
}

function openDrawer() {
  if (!sideDrawer || !drawerBackdrop) return;
  sideDrawer.classList.add('open');
  sideDrawer.setAttribute('aria-hidden', 'false');
  drawerBackdrop.hidden = false;
  document.body.classList.add('drawer-open');
}

function showShareToast(message = 'Link copied to clipboard!') {
  if (!shareToast) return;
  shareToast.textContent = message;
  shareToast.hidden = false;
  if (shareToastTimer) window.clearTimeout(shareToastTimer);
  shareToastTimer = window.setTimeout(() => {
    shareToast.hidden = true;
  }, 2200);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.top = '-9999px';
  document.body.appendChild(helper);
  helper.select();
  document.execCommand('copy');
  document.body.removeChild(helper);
}

async function handleShare() {
  const shareUrl = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'PointPulse Cedar Point',
        url: shareUrl
      });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }

  try {
    await copyTextToClipboard(shareUrl);
    showShareToast('Link copied to clipboard!');
  } catch {
    showShareToast('Link copied to clipboard!');
  }
}

const diningFilter = document.querySelector('#dining-filter');
diningFilter.addEventListener('change', () => {
  activeDiningFilter = diningFilter.value;
  renderDiningLocations();
});

if (shareButton) {
  shareButton.addEventListener('click', handleShare);
}

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

if (menuToggle) {
  menuToggle.addEventListener('click', openDrawer);
}

if (drawerClose) {
  drawerClose.addEventListener('click', closeDrawer);
}

if (drawerBackdrop) {
  drawerBackdrop.addEventListener('click', closeDrawer);
}

drawerNavItems.forEach((button) => {
  button.addEventListener('click', () => {
    showTab(button.dataset.tab);
    closeDrawer();
  });
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => showTab(button.dataset.tab));
});

initializeTheme();
showTab('waits');

renderDiningLocations();
renderRides();

function formatSanduskyHour(time) {
  const hour = Number(time.slice(11, 13));
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12} ${suffix}`;
}

function renderWeatherUnavailable() {
  document.querySelector('#weather-condition').textContent = 'Weather temporarily unavailable';
  document.querySelector('#weather-updated').textContent = 'Weather update unavailable — retrying automatically.';
  document.querySelector('#hero-weather-condition').textContent = 'Weather unavailable';
}

function renderWeather(data) {
  const current = data?.current;
  const hourly = data?.hourly || {};
  const daily = data?.daily || {};
  if (!current || !Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m) || !Array.isArray(daily.temperature_2m_max) || !Array.isArray(daily.temperature_2m_min)) {
    throw new Error('Weather response is incomplete');
  }

  const currentTime = String(current.time || '').trim();
  const currentHourPrefix = currentTime.includes(':') ? currentTime.slice(0, 13) : currentTime;
  const hourlyIndex = Math.max(0, hourly.time.findIndex((time) => String(time).startsWith(currentHourPrefix)));
  const safeIndex = Math.max(0, hourlyIndex);
  const [condition, icon] = weatherDetails(current.weather_code, Boolean(current.is_day));
  const rainChance = hourly.precipitation_probability?.[safeIndex] ?? '--';
  const high = daily.temperature_2m_max[0];
  const low = daily.temperature_2m_min[0];
  const temperature = Math.round(Number(current.temperature_2m));
  document.querySelector('#weather-temperature').textContent = `${temperature}°`;
  document.querySelector('#weather-condition').textContent = condition;
  document.querySelector('#weather-condition-icon').textContent = icon;
  document.querySelector('#weather-rain').textContent = `${rainChance}%`;
  document.querySelector('#weather-wind').textContent = `${Math.round(Number(current.wind_speed_10m || 0))} mph`;
  document.querySelector('#weather-hi-low').textContent = `${Math.round(Number(high))}° / ${Math.round(Number(low))}°`;
  document.querySelector('#hero-weather-icon').textContent = icon;
  document.querySelector('#hero-weather-temp').textContent = `${temperature}°`;
  document.querySelector('#hero-weather-condition').textContent = condition;
  const hourlyItems = hourly.time.slice(safeIndex, safeIndex + 4).map((time, offset) => {
    const index = safeIndex + offset;
    const [hourlyCondition, hourlyIcon] = weatherDetails(hourly.weather_code?.[index], true);
    const hourlyTemperature = Math.round(Number(hourly.temperature_2m[index] ?? 0));
    const hourlyChance = hourly.precipitation_probability?.[index] ?? '--';
    return `<div class="hourly-item"><span>${formatSanduskyHour(time)}</span><b>${hourlyIcon} ${hourlyTemperature}°</b><span>${hourlyChance}% rain</span></div>`;
  });
  document.querySelector('#hourly-forecast').innerHTML = hourlyItems.join('');
  const severe = isSevereWeather(current.weather_code) || (Array.isArray(hourly.weather_code) && hourly.weather_code.slice(safeIndex, safeIndex + 4).some(isSevereWeather));
  const alert = document.querySelector('#weather-alert');
  alert.hidden = !severe;
  if (severe) alert.textContent = '⚠ Thunderstorm conditions are active or possible soon.';
  document.querySelector('#weather-updated').textContent = `Last updated: ${formatSanduskyHour(current.time)} · refreshes every 15 min`;
}

async function getWeather() {
  try {
    const response = await fetch('/api/weather', { cache: 'no-store' });
    if (!response.ok) throw new Error('Weather response was not OK');
    const data = await response.json();
    if (!data?.current || !data?.hourly || !data?.daily) throw new Error('Weather response is incomplete');
    renderWeather(data);
  } catch {
    renderWeatherUnavailable();
  }
}

window.setInterval(getWeather, WEATHER_REFRESH_INTERVAL);

const TIMER_KEY = 'pointpulse-meal-end';
const TIMER_COMPLETE_KEY = 'pointpulse-meal-complete';
const TIMER_PAUSED_KEY = 'pointpulse-meal-paused-seconds';
let endTime = Number(localStorage.getItem(TIMER_KEY)) || null;
let pausedSeconds = Number(localStorage.getItem(TIMER_PAUSED_KEY)) || null;
let isComplete = localStorage.getItem(TIMER_COMPLETE_KEY) === 'true';
let timerId = null;
const display = document.querySelector('#timer-display');
const timerButton = document.querySelector('#timer-button');
const pauseButton = document.querySelector('#pause-button');
const timerCopy = document.querySelector('#timer-copy');
const timerEnd = document.querySelector('#timer-end');
const timerProgress = document.querySelector('#timer-progress');

function formatExpiration(endTimestamp) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(endTimestamp));
}

function stopTimerTicks() {
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null;
}

function renderIdleTimer() {
  pauseButton.hidden = true;
  if (pausedSeconds) {
    display.textContent = formatTime(pausedSeconds);
    timerProgress.style.width = `${getProgress(pausedSeconds, MEAL_DURATION_SECONDS)}%`;
    timerButton.textContent = 'Resume 90 min timer';
    timerButton.classList.remove('running');
    timerEnd.textContent = `Paused — ${formatTime(pausedSeconds)} remaining`;
    timerCopy.textContent = 'Resume to set your new meal-window expiration time.';
  } else {
    display.textContent = isComplete ? '00:00' : '90:00';
    timerProgress.style.width = isComplete ? '100%' : '0%';
    timerButton.textContent = 'Start 90 min timer';
    timerButton.classList.remove('running');
    timerEnd.textContent = isComplete ? 'Meal window open now.' : 'Starts when you tap the timer.';
    timerCopy.textContent = isComplete ? 'You’re ready for your next meal!' : 'Tap start after you pick up your meal.';
  }
}

function completeTimer() {
  endTime = null;
  pausedSeconds = null;
  isComplete = true;
  localStorage.removeItem(TIMER_KEY);
  localStorage.removeItem(TIMER_PAUSED_KEY);
  localStorage.setItem(TIMER_COMPLETE_KEY, 'true');
  renderIdleTimer();
  stopTimerTicks();
}

function renderTimer() {
  if (!endTime) {
    renderIdleTimer();
    stopTimerTicks();
    return;
  }
  const remaining = getRemainingSeconds(endTime);
  if (remaining === 0) return completeTimer();

  display.textContent = formatTime(remaining);
  timerProgress.style.width = `${getProgress(remaining, MEAL_DURATION_SECONDS)}%`;
  timerButton.textContent = 'Meal timer running';
  timerButton.classList.add('running');
  pauseButton.hidden = false;
  timerEnd.textContent = `Ends at ${formatExpiration(endTime)}`;
  timerCopy.textContent = 'Your next meal window opens when this hits zero.';
}

function startTimerTicks() {
  stopTimerTicks();
  timerId = window.setInterval(renderTimer, 1000);
}

function startTimer() {
  if (!endTime) {
    const seconds = pausedSeconds || MEAL_DURATION_SECONDS;
    endTime = getExpirationTimestamp(Date.now(), seconds);
    pausedSeconds = null;
    isComplete = false;
    localStorage.setItem(TIMER_KEY, String(endTime));
    localStorage.removeItem(TIMER_PAUSED_KEY);
    localStorage.removeItem(TIMER_COMPLETE_KEY);
  }
  renderTimer();
  startTimerTicks();
}

function pauseTimer() {
  if (!endTime) return;
  pausedSeconds = getRemainingSeconds(endTime);
  if (!pausedSeconds) return completeTimer();
  endTime = null;
  localStorage.removeItem(TIMER_KEY);
  localStorage.setItem(TIMER_PAUSED_KEY, String(pausedSeconds));
  stopTimerTicks();
  renderIdleTimer();
}

function resetTimer() {
  endTime = null;
  pausedSeconds = null;
  isComplete = false;
  localStorage.removeItem(TIMER_KEY);
  localStorage.removeItem(TIMER_PAUSED_KEY);
  localStorage.removeItem(TIMER_COMPLETE_KEY);
  stopTimerTicks();
  renderTimer();
}

timerButton.addEventListener('click', startTimer);
pauseButton.addEventListener('click', pauseTimer);
document.querySelector('#reset-button').addEventListener('click', resetTimer);
document.addEventListener('visibilitychange', () => { renderTimer(); if (!document.hidden) { getWaits(); getWeather(); } });
window.addEventListener('pageshow', renderTimer);
renderTimer();
if (endTime) startTimerTicks();
getWaits();
getWeather();
