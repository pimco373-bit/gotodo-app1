/**
 * GOTODO // EXECUTIVE CALENDAR & AGENDA
 * Powered by Firebase Firestore v13 Modular SDK & Real-time Cloud Sync
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAZ8bHLfeKxCNSJfZmJ74z7MDwlS4-kqco",
  authDomain: "gotodo-app1.firebaseapp.com",
  projectId: "gotodo-app1",
  storageBucket: "gotodo-app1.firebasestorage.app",
  messagingSenderId: "528305385861",
  appId: "1:528305385861:web:371afff979c958f0c514ec"
};

const STORAGE_KEY = 'gotodo_calendar_tasks_v1';
const SEED_FLAG_KEY = 'gotodo_firestore_seeded_v1';

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// State Management
const now = new Date();
const state = {
  todayYear: now.getFullYear(),
  todayMonth: now.getMonth(), // 0-11
  todayDate: now.getDate(),
  todayKey: formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()),

  // Calendar View
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),

  // Selected Date for Agenda
  selectedDateKey: formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()),

  // All Tasks (grouped by YYYY-MM-DD)
  tasks: {},

  // Firestore status
  db: null,
  isFirestoreConnected: false
};

// DOM Elements
const el = {
  liveClock: document.getElementById('liveClock'),
  liveDate: document.getElementById('liveDate'),
  btnHeaderToday: document.getElementById('btnHeaderToday'),

  // Cloud Status
  cloudStatusBadge: document.getElementById('cloudStatusBadge'),
  cloudStatusDot: document.getElementById('cloudStatusDot'),
  cloudStatusText: document.getElementById('cloudStatusText'),

  // Rules Guidance Modal
  rulesModalBackdrop: document.getElementById('rulesModalBackdrop'),
  btnCloseRulesModal: document.getElementById('btnCloseRulesModal'),
  btnConfirmRulesModal: document.getElementById('btnConfirmRulesModal'),

  // Calendar
  calendarYearDisplay: document.getElementById('calendarYearDisplay'),
  calendarMonthDisplay: document.getElementById('calendarMonthDisplay'),
  calendarGrid: document.getElementById('calendarGrid'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),

  // Agenda
  selectedTodayBadge: document.getElementById('selectedTodayBadge'),
  selectedDateDisplay: document.getElementById('selectedDateDisplay'),
  taskMetricCount: document.getElementById('taskMetricCount'),
  taskProgressBar: document.getElementById('taskProgressBar'),

  // Task Form
  taskForm: document.getElementById('taskForm'),
  taskTextInput: document.getElementById('taskTextInput'),
  tasksList: document.getElementById('tasksList'),
  tasksEmptyState: document.getElementById('tasksEmptyState'),
  btnClearCompleted: document.getElementById('btnClearCompleted')
};

/**
 * Helper: Format Date Key as YYYY-MM-DD
 */
function formatDateKey(year, monthIndex, day) {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Helper: Parse Date Key YYYY-MM-DD to Date object
 */
function parseDateKey(key) {
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * LocalStorage Fallback & Cache Operations
 */
function loadLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state.tasks = JSON.parse(raw);
    } else {
      state.tasks = getInitialSeedData(state.todayKey);
      saveLocalCache();
    }
  } catch (e) {
    console.error('Failed to load local cache', e);
    state.tasks = {};
  }
}

function saveLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (e) {
    console.error('Failed to save local cache', e);
  }
}

/**
 * Initial sample office tasks
 */
function getInitialSeedData(todayKey) {
  return {
    [todayKey]: [
      {
        id: 'seed-1',
        text: '긴급 경영진 주간 현황 및 실적 보고서 최종 송부',
        priority: 'urgent',
        completed: false,
        createdAt: Date.now() - 3600000
      },
      {
        id: 'seed-2',
        text: '프로젝트 스프린트 리뷰 회의 참여 (오후 2시)',
        priority: 'normal',
        completed: false,
        createdAt: Date.now() - 7200000
      },
      {
        id: 'seed-3',
        text: '파트너사 미팅 회의록 정리 및 슬랙 공유',
        priority: 'normal',
        completed: true,
        createdAt: Date.now() - 10800000
      },
      {
        id: 'seed-4',
        text: '출장 경비 전표 결재 상신',
        priority: 'low',
        completed: true,
        createdAt: Date.now() - 14400000
      }
    ]
  };
}

/**
 * Update Cloud Sync Status Badge in UI
 */
function updateCloudStatus(status, text) {
  if (!el.cloudStatusBadge || !el.cloudStatusText) return;

  el.cloudStatusBadge.className = 'cloud-status-badge';

  if (status === 'connecting') {
    el.cloudStatusBadge.classList.add('is-connecting');
  } else if (status === 'connected') {
    el.cloudStatusBadge.classList.add('is-connected');
  } else if (status === 'error') {
    el.cloudStatusBadge.classList.add('is-error');
  } else {
    el.cloudStatusBadge.classList.add('is-offline');
  }

  el.cloudStatusText.textContent = text;
}

/**
 * Toggle Rules Guidance Modal
 */
function showRulesModal(show) {
  if (!el.rulesModalBackdrop) return;
  el.rulesModalBackdrop.style.display = show ? 'flex' : 'none';
}

/**
 * Seed initial tasks into Firestore (only once for new database)
 */
async function seedInitialFirestoreTasks() {
  if (!state.db) return;
  try {
    const tasksCol = collection(state.db, 'tasks');
    const initial = getInitialSeedData(state.todayKey);
    const initialList = initial[state.todayKey] || [];
    for (const item of initialList) {
      await addDoc(tasksCol, {
        text: item.text,
        priority: item.priority,
        completed: item.completed,
        date: state.todayKey,
        createdAt: item.createdAt
      });
    }
  } catch (err) {
    console.warn('Could not auto-seed Firestore:', err);
  }
}

/**
 * Initialize Firebase Firestore & Real-time Listener
 */
function initFirestore() {
  updateCloudStatus('connecting', 'FIRESTORE CONNECTING...');

  try {
    const app = initializeApp(firebaseConfig);
    state.db = getFirestore(app);
    const tasksCol = collection(state.db, 'tasks');

    // Subscribe to real-time changes
    onSnapshot(
      tasksCol,
      (snapshot) => {
        state.isFirestoreConnected = true;
        updateCloudStatus('connected', 'FIRESTORE SYNC: ACTIVE');

        // Check if DB is brand new and empty
        const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY);
        if (snapshot.empty && !alreadySeeded) {
          localStorage.setItem(SEED_FLAG_KEY, 'true');
          seedInitialFirestoreTasks();
          return;
        }

        const newTasks = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const task = {
            id: docSnap.id,
            text: data.text || '',
            priority: data.priority || 'normal',
            completed: !!data.completed,
            date: data.date,
            createdAt: data.createdAt || 0
          };

          const dateKey = task.date;
          if (dateKey) {
            if (!newTasks[dateKey]) {
              newTasks[dateKey] = [];
            }
            newTasks[dateKey].push(task);
          }
        });

        // Sort tasks for each date: urgent first, then by createdAt desc
        for (const dateKey in newTasks) {
          newTasks[dateKey].sort((a, b) => {
            if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
            if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
          });
        }

        state.tasks = newTasks;
        saveLocalCache();
        renderCalendar();
        renderAgenda();
      },
      (error) => {
        console.warn('Firestore Snapshot listener error:', error);
        state.isFirestoreConnected = false;

        if (error.code === 'permission-denied') {
          updateCloudStatus('error', 'RULES NEEDED (CLICK)');
          showRulesModal(true);
        } else {
          updateCloudStatus('offline', 'OFFLINE / LOCAL STORAGE');
        }

        // Fallback to local storage cache so user workflow is uninterrupted
        loadLocalCache();
        renderCalendar();
        renderAgenda();
      }
    );
  } catch (err) {
    console.error('Firebase Initialization error:', err);
    state.isFirestoreConnected = false;
    updateCloudStatus('offline', 'LOCAL MODE');
    loadLocalCache();
    renderCalendar();
    renderAgenda();
  }
}

/**
 * Live Clock & Header Date
 */
function startLiveClock() {
  function update() {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    el.liveClock.textContent = `${hours}:${minutes}:${seconds}`;

    const monthName = MONTH_NAMES[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    el.liveDate.textContent = `${monthName} ${day}, ${year}`;
  }
  update();
  setInterval(update, 1000);
}

/**
 * Render Monthly Calendar Grid
 */
function renderCalendar() {
  const year = state.viewYear;
  const month = state.viewMonth;

  // Header Display
  el.calendarYearDisplay.textContent = year;
  el.calendarMonthDisplay.textContent = MONTH_NAMES[month];

  // Grid calculations
  const firstDayObj = new Date(year, month, 1);
  let firstDayIndex = firstDayObj.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6; // Sunday becomes 6

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  el.calendarGrid.innerHTML = '';

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevDateKey = formatDateKey(
      month === 0 ? year - 1 : year,
      month === 0 ? 11 : month - 1,
      dayNum
    );
    const cell = createCalendarCell(dayNum, prevDateKey, true);
    el.calendarGrid.appendChild(cell);
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = formatDateKey(year, month, d);
    const cell = createCalendarCell(d, dateKey, false);
    el.calendarGrid.appendChild(cell);
  }

  // Next month padding days to fill grid (multiple of 7)
  const totalRendered = firstDayIndex + daysInMonth;
  const remaining = (7 - (totalRendered % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextDateKey = formatDateKey(
      month === 11 ? year + 1 : year,
      month === 11 ? 0 : month + 1,
      d
    );
    const cell = createCalendarCell(d, nextDateKey, true);
    el.calendarGrid.appendChild(cell);
  }
}

/**
 * Create an individual calendar cell element
 */
function createCalendarCell(dayNum, dateKey, isOtherMonth) {
  const cell = document.createElement('div');
  cell.className = 'cal-cell';
  cell.dataset.date = dateKey;

  if (isOtherMonth) {
    cell.classList.add('is-other-month');
  }

  // ALWAYS highlight Today's date with fluorescent green
  if (dateKey === state.todayKey) {
    cell.classList.add('is-today');
    cell.title = 'TODAY (오늘)';
  }

  // Selected date highlight
  if (dateKey === state.selectedDateKey) {
    cell.classList.add('is-selected');
  }

  // Date Number
  const numSpan = document.createElement('span');
  numSpan.className = 'cal-cell-num';
  numSpan.textContent = dayNum;
  cell.appendChild(numSpan);

  // Task indicators (Dots)
  const dayTasks = state.tasks[dateKey] || [];
  if (dayTasks.length > 0) {
    const dotsRow = document.createElement('div');
    dotsRow.className = 'cell-dots-row';

    const hasUrgent = dayTasks.some(t => t.priority === 'urgent' && !t.completed);
    const hasNormalOrLow = dayTasks.some(t => t.priority !== 'urgent' && !t.completed);
    const allCompleted = dayTasks.every(t => t.completed);

    if (hasUrgent) {
      // Hot pink dot for urgent tasks!
      const urgentDot = document.createElement('span');
      urgentDot.className = 'cal-dot dot-urgent';
      urgentDot.title = '긴급 업무 포함';
      dotsRow.appendChild(urgentDot);
    }

    if (hasNormalOrLow || (allCompleted && !hasUrgent)) {
      // Fluorescent green dot for general tasks
      const normalDot = document.createElement('span');
      normalDot.className = 'cal-dot dot-normal';
      dotsRow.appendChild(normalDot);
    }

    cell.appendChild(dotsRow);
  }

  // Cell Click Interaction
  cell.addEventListener('click', () => {
    selectDate(dateKey);
  });

  return cell;
}

/**
 * Select a date
 */
function selectDate(dateKey) {
  state.selectedDateKey = dateKey;
  const dateObj = parseDateKey(dateKey);

  // If selected date is in another month, update calendar view to match
  if (dateObj.getFullYear() !== state.viewYear || dateObj.getMonth() !== state.viewMonth) {
    state.viewYear = dateObj.getFullYear();
    state.viewMonth = dateObj.getMonth();
  }

  renderCalendar();
  renderAgenda();
}

/**
 * Jump to Today
 */
function jumpToToday() {
  state.viewYear = state.todayYear;
  state.viewMonth = state.todayMonth;
  state.selectedDateKey = state.todayKey;
  renderCalendar();
  renderAgenda();
  el.taskTextInput.focus();
}

/**
 * Render Right Panel: Daily Agenda
 */
function renderAgenda() {
  const dateKey = state.selectedDateKey;
  const dateObj = parseDateKey(dateKey);

  // Format selected date title: e.g. "2026. 10. 26 MON"
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES[dateObj.getDay()];

  el.selectedDateDisplay.textContent = `${year}. ${month}. ${day} ${dayName}`;

  // Show/hide Today badge
  if (dateKey === state.todayKey) {
    el.selectedTodayBadge.classList.add('is-visible');
  } else {
    el.selectedTodayBadge.classList.remove('is-visible');
  }

  // Tasks for the selected date
  const tasks = state.tasks[dateKey] || [];
  renderTaskList(tasks);
  updateMetrics(tasks);
}

/**
 * Update Completed/Total Metrics & Progress Bar
 */
function updateMetrics(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;

  el.taskMetricCount.textContent = `${completed} / ${total}`;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  el.taskProgressBar.style.width = `${percentage}%`;
}

/**
 * Render Task Items
 */
function renderTaskList(tasks) {
  el.tasksList.innerHTML = '';

  if (tasks.length === 0) {
    el.tasksEmptyState.style.display = 'flex';
    return;
  }

  el.tasksEmptyState.style.display = 'none';

  tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item priority-${task.priority}`;
    if (task.completed) {
      item.classList.add('is-completed');
    }

    // Left Section: Checkbox + Text
    const left = document.createElement('div');
    left.className = 'task-left';

    // Custom Checkbox
    const checkWrap = document.createElement('label');
    checkWrap.className = 'task-checkbox-wrap';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Complete task: ${task.text}`);

    const checkCustom = document.createElement('span');
    checkCustom.className = 'custom-checkbox';
    checkCustom.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;

    checkWrap.appendChild(checkbox);
    checkWrap.appendChild(checkCustom);

    // Checkbox Change Event (Toggle Task)
    checkbox.addEventListener('change', () => {
      toggleTask(task.id);
    });

    // Task Text Box
    const details = document.createElement('div');
    details.className = 'task-details';

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;

    details.appendChild(textSpan);

    left.appendChild(checkWrap);
    left.appendChild(details);

    // Right Section: Priority Badge + Delete Button
    const right = document.createElement('div');
    right.className = 'task-right';

    // Priority Badge
    const badge = document.createElement('span');
    badge.className = `task-priority-badge badge-${task.priority}`;
    if (task.priority === 'urgent') {
      badge.textContent = '긴급';
    } else if (task.priority === 'normal') {
      badge.textContent = '보통';
    } else {
      badge.textContent = '낮음';
    }
    right.appendChild(badge);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete-task';
    deleteBtn.title = '업무 삭제';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => {
      deleteTask(task.id);
    });
    right.appendChild(deleteBtn);

    item.appendChild(left);
    item.appendChild(right);

    el.tasksList.appendChild(item);
  });
}

/**
 * Add New Task (Firestore with Local Fallback)
 */
async function addTask(text, priority) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const dateKey = state.selectedDateKey;
  const taskData = {
    text: trimmed,
    priority: priority || 'normal',
    completed: false,
    date: dateKey,
    createdAt: Date.now()
  };

  if (state.isFirestoreConnected && state.db) {
    try {
      await addDoc(collection(state.db, 'tasks'), taskData);
      // onSnapshot automatically updates state and re-renders!
      return;
    } catch (e) {
      console.error('Failed to add task to Firestore:', e);
    }
  }

  // Local fallback
  if (!state.tasks[dateKey]) {
    state.tasks[dateKey] = [];
  }
  const localTask = {
    ...taskData,
    id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
  };

  if (localTask.priority === 'urgent') {
    state.tasks[dateKey].unshift(localTask);
  } else {
    state.tasks[dateKey].push(localTask);
  }

  saveLocalCache();
  renderAgenda();
  renderCalendar();
}

/**
 * Toggle Task Completion (Firestore with Local Fallback)
 */
async function toggleTask(taskId) {
  const dateKey = state.selectedDateKey;
  const list = state.tasks[dateKey];
  if (!list) return;

  const task = list.find(t => t.id === taskId);
  if (!task) return;

  const newCompleted = !task.completed;

  if (state.isFirestoreConnected && state.db && !taskId.startsWith('local_') && !taskId.startsWith('seed-')) {
    try {
      const taskRef = doc(state.db, 'tasks', taskId);
      await updateDoc(taskRef, { completed: newCompleted });
      // onSnapshot will update UI
      return;
    } catch (e) {
      console.error('Failed to update task in Firestore:', e);
    }
  }

  // Local fallback
  task.completed = newCompleted;
  saveLocalCache();
  renderAgenda();
  renderCalendar();
}

/**
 * Delete Task (Firestore with Local Fallback)
 */
async function deleteTask(taskId) {
  const dateKey = state.selectedDateKey;
  const list = state.tasks[dateKey];
  if (!list) return;

  if (state.isFirestoreConnected && state.db && !taskId.startsWith('local_') && !taskId.startsWith('seed-')) {
    try {
      const taskRef = doc(state.db, 'tasks', taskId);
      await deleteDoc(taskRef);
      // onSnapshot will update UI
      return;
    } catch (e) {
      console.error('Failed to delete task in Firestore:', e);
    }
  }

  // Local fallback
  state.tasks[dateKey] = list.filter(t => t.id !== taskId);
  saveLocalCache();
  renderAgenda();
  renderCalendar();
}

/**
 * Clear Completed Tasks for selected date
 */
async function clearCompleted() {
  const dateKey = state.selectedDateKey;
  const list = state.tasks[dateKey];
  if (!list || list.length === 0) return;

  const completedList = list.filter(t => t.completed);
  if (completedList.length === 0) return;

  if (state.isFirestoreConnected && state.db) {
    try {
      const promises = completedList
        .filter(t => !t.id.startsWith('local_') && !t.id.startsWith('seed-'))
        .map(t => deleteDoc(doc(state.db, 'tasks', t.id)));
      await Promise.all(promises);
      // onSnapshot will update UI
    } catch (e) {
      console.error('Failed to clear completed tasks in Firestore:', e);
    }
  }

  // Filter out locally as well
  state.tasks[dateKey] = list.filter(t => !t.completed);
  saveLocalCache();
  renderAgenda();
  renderCalendar();
}

/**
 * Setup Event Listeners
 */
function setupEvents() {
  // Month navigation
  el.prevMonthBtn.addEventListener('click', () => {
    state.viewMonth--;
    if (state.viewMonth < 0) {
      state.viewMonth = 11;
      state.viewYear--;
    }
    renderCalendar();
  });

  el.nextMonthBtn.addEventListener('click', () => {
    state.viewMonth++;
    if (state.viewMonth > 11) {
      state.viewMonth = 0;
      state.viewYear++;
    }
    renderCalendar();
  });

  // Today jump button
  el.btnHeaderToday.addEventListener('click', jumpToToday);

  // Cloud status badge click -> show rules guide modal
  if (el.cloudStatusBadge) {
    el.cloudStatusBadge.addEventListener('click', () => {
      showRulesModal(true);
    });
  }

  // Modal close buttons
  if (el.btnCloseRulesModal) {
    el.btnCloseRulesModal.addEventListener('click', () => {
      showRulesModal(false);
    });
  }
  if (el.btnConfirmRulesModal) {
    el.btnConfirmRulesModal.addEventListener('click', () => {
      showRulesModal(false);
    });
  }

  // Task Form Submit
  el.taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = el.taskTextInput.value;
    const selectedPriorityRadio = el.taskForm.querySelector('input[name="priority"]:checked');
    const priority = selectedPriorityRadio ? selectedPriorityRadio.value : 'normal';

    await addTask(text, priority);

    // Reset text input and retain focus for 30-sec fast entry
    el.taskTextInput.value = '';
    el.taskTextInput.focus();
  });

  // Clear completed button
  el.btnClearCompleted.addEventListener('click', clearCompleted);

  // Keyboard shortcut: Escape clears input / closes modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (el.rulesModalBackdrop && el.rulesModalBackdrop.style.display === 'flex') {
        showRulesModal(false);
      } else if (document.activeElement === el.taskTextInput) {
        el.taskTextInput.blur();
      }
    }
  });
}

/**
 * Initialization
 */
function init() {
  loadLocalCache();
  startLiveClock();
  renderCalendar();
  renderAgenda();
  setupEvents();
  initFirestore();
}

// Launch when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
