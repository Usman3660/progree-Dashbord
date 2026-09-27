/**
 * SynapseGrid - Main Dashboard Application Controller
 * Handles state management, UI rendering, drag-and-drop, modals, and user interactions.
 */

// Application State
const state = {
  tasks: [],
  stats: null,
  activities: [],
  currentView: 'kanban', // 'kanban' | 'table' | 'analytics' | 'activity'
  filters: {
    status: 'all',
    priority: 'all',
    category: 'all',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  },
  selectedTaskIds: new Set(),
  activeModal: null,
  activeTaskId: null,
  theme: localStorage.getItem('synapsegrid_theme') || 'dark',
  modalSubtasks: [],
  modalTags: []
};

// DOM Element Selectors
const elements = {
  searchInput: document.getElementById('global-search-input'),
  categoryFilter: document.getElementById('category-filter'),
  priorityFilter: document.getElementById('priority-filter'),
  sortBySelect: document.getElementById('sort-by-select'),
  viewTabs: document.querySelectorAll('.view-tab-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  createTaskBtn: document.getElementById('btn-create-task'),
  
  // Views Containers
  kanbanView: document.getElementById('view-kanban'),
  tableView: document.getElementById('view-table'),
  analyticsView: document.getElementById('view-analytics'),
  activityView: document.getElementById('view-activity'),

  // Metrics
  metricTotal: document.getElementById('stat-total'),
  metricInProgress: document.getElementById('stat-in-progress'),
  metricCompleted: document.getElementById('stat-completed'),
  metricUrgent: document.getElementById('stat-urgent'),
  metricHours: document.getElementById('stat-hours'),
  metricProgressFill: document.getElementById('stat-progress-fill'),

  // Modals
  taskModal: document.getElementById('task-form-modal'),
  taskModalTitle: document.getElementById('modal-title-text'),
  taskForm: document.getElementById('task-form'),
  detailModal: document.getElementById('task-detail-modal'),
  toastContainer: document.getElementById('toast-container'),

  // Modal Fields
  inputTaskId: document.getElementById('form-task-id'),
  inputTitle: document.getElementById('form-task-title'),
  inputDescription: document.getElementById('form-task-desc'),
  inputCategory: document.getElementById('form-task-category'),
  inputStatus: document.getElementById('form-task-status'),
  inputDueDate: document.getElementById('form-task-due-date'),
  inputEstimatedHours: document.getElementById('form-task-est-hours'),
  inputLoggedHours: document.getElementById('form-task-logged-hours'),
  subtaskInput: document.getElementById('new-subtask-input'),
  subtaskAddBtn: document.getElementById('btn-add-subtask'),
  subtasksListContainer: document.getElementById('subtasks-builder-container'),
  tagInput: document.getElementById('new-tag-input'),
  tagsContainer: document.getElementById('tags-builder-wrapper')
};

// ==========================================================================
// Initialization & Core Lifecycle
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  setupKeyboardShortcuts();
  await refreshDashboard();
});

const initTheme = () => {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();
};

const toggleTheme = () => {
  const themes = ['dark', 'cyberpunk', 'midnight', 'light'];
  const currentIndex = themes.indexOf(state.theme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  state.theme = nextTheme;
  localStorage.setItem('synapsegrid_theme', nextTheme);
  document.documentElement.setAttribute('data-theme', nextTheme);
  updateThemeIcon();
  showToast(`Theme switched to ${nextTheme.toUpperCase()}`, 'info', 2000);
};

const updateThemeIcon = () => {
  if (!elements.themeToggleBtn) return;
  const icon = elements.themeToggleBtn.querySelector('i');
  if (icon) {
    if (state.theme === 'light') icon.className = 'fas fa-sun';
    else if (state.theme === 'cyberpunk') icon.className = 'fas fa-bolt';
    else if (state.theme === 'midnight') icon.className = 'fas fa-water';
    else icon.className = 'fas fa-moon';
  }
};

// ==========================================================================
// Data Fetching & Dashboard Refresh
// ==========================================================================
const refreshDashboard = async () => {
  try {
    await Promise.all([
      fetchTasks(),
      fetchStats(),
      fetchActivities()
    ]);
  } catch (err) {
    showToast('Failed to sync with backend server.', 'error');
  }
};

const fetchTasks = async () => {
  try {
    const res = await window.api.getTasks(state.filters);
    state.tasks = res.data || [];
    renderCurrentView();
  } catch (err) {
    showToast('Could not load tasks from database.', 'error');
  }
};

const fetchStats = async () => {
  try {
    const res = await window.api.getStats();
    state.stats = res.stats || {};
    renderMetrics();
    if (state.currentView === 'analytics') {
      renderAnalytics();
    }
  } catch (err) {
    console.error('Error fetching statistics:', err);
  }
};

const fetchActivities = async () => {
  try {
    const res = await window.api.getActivities();
    state.activities = res.data || [];
    if (state.currentView === 'activity') {
      renderActivityFeed();
    }
  } catch (err) {
    console.error('Error fetching activity log:', err);
  }
};

// ==========================================================================
// Rendering: Metrics Bar
// ==========================================================================
const renderMetrics = () => {
  if (!state.stats) return;
  const { total = 0, statusCounts = {}, priorityCounts = {}, completionRate = 0, totalEstimatedHours = 0, totalLoggedHours = 0 } = state.stats;

  if (elements.metricTotal) elements.metricTotal.textContent = total;
  if (elements.metricInProgress) elements.metricInProgress.textContent = statusCounts.in_progress || 0;
  if (elements.metricCompleted) elements.metricCompleted.textContent = statusCounts.completed || 0;
  if (elements.metricUrgent) elements.metricUrgent.textContent = priorityCounts.urgent || 0;
  
  if (elements.metricHours) {
    elements.metricHours.textContent = `${totalLoggedHours}h / ${totalEstimatedHours}h`;
  }
  if (elements.metricProgressFill) {
    elements.metricProgressFill.style.width = `${completionRate}%`;
  }
};

// ==========================================================================
// View Switcher & Rendering Router
// ==========================================================================
const setView = (viewName) => {
  state.currentView = viewName;

  elements.viewTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  elements.kanbanView.style.display = viewName === 'kanban' ? 'grid' : 'none';
  elements.tableView.style.display = viewName === 'table' ? 'block' : 'none';
  elements.analyticsView.style.display = viewName === 'analytics' ? 'grid' : 'none';
  elements.activityView.style.display = viewName === 'activity' ? 'block' : 'none';

  renderCurrentView();
};

const renderCurrentView = () => {
  switch (state.currentView) {
    case 'kanban':
      renderKanbanBoard();
      break;
    case 'table':
      renderTableView();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    case 'activity':
      renderActivityFeed();
      break;
  }
};

// ==========================================================================
// View 1: Kanban Board Rendering & Drag & Drop
// ==========================================================================
const renderKanbanBoard = () => {
  const columns = ['todo', 'in_progress', 'review', 'completed'];

  columns.forEach(status => {
    const colList = document.querySelector(`.task-list-container[data-status="${status}"]`);
    const countBadge = document.querySelector(`.column-count[data-status="${status}"]`);
    if (!colList) return;

    const columnTasks = state.tasks.filter(t => t.status === status);
    if (countBadge) countBadge.textContent = columnTasks.length;

    if (columnTasks.length === 0) {
      colList.innerHTML = `
        <div class="empty-state" style="padding: 2rem 0.5rem;">
          <div class="empty-state-icon" style="font-size: 1.5rem;"><i class="fas fa-inbox"></i></div>
          <p class="empty-state-text" style="font-size: 0.75rem;">No tasks in this stage</p>
        </div>
      `;
      return;
    }

    colList.innerHTML = columnTasks.map(task => createKanbanCardHTML(task)).join('');
  });

  setupKanbanDragDrop();
};

const createKanbanCardHTML = (task) => {
  const subtasks = task.subtasks || [];
  const completedSubs = subtasks.filter(s => s.completed).length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubs / subtasks.length) * 100) : 0;
  const tags = task.tags || [];

  // Due Date check
  let dueHtml = '';
  if (task.due_date) {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = task.due_date < today && task.status !== 'completed';
    const dueClass = isOverdue ? 'due-badge overdue' : 'due-badge';
    dueHtml = `
      <span class="${dueClass}">
        <i class="far fa-calendar-alt"></i> ${task.due_date}
      </span>
    `;
  }

  return `
    <div class="task-card" draggable="true" data-id="${task.id}" onclick="handleCardClick(event, ${task.id})">
      <div class="card-top-row">
        <span class="category-badge">${escapeHtml(task.category || 'General')}</span>
        <span class="priority-pill ${task.priority}">
          <i class="fas fa-circle" style="font-size: 0.45rem;"></i> ${task.priority}
        </span>
      </div>

      <div class="card-title">${escapeHtml(task.title)}</div>
      
      ${task.description ? `<p class="card-description">${escapeHtml(task.description)}</p>` : ''}

      ${subtasks.length > 0 ? `
        <div class="card-subtasks-status">
          <span><i class="fas fa-tasks"></i> ${completedSubs}/${subtasks.length} subtasks</span>
          <div class="subtasks-bar-container">
            <div class="subtasks-bar-fill" style="width: ${subtasksPercent}%;"></div>
          </div>
        </div>
      ` : ''}

      ${tags.length > 0 ? `
        <div class="card-tags">
          ${tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="card-footer">
        ${dueHtml || `<span><i class="far fa-clock"></i> ${task.estimated_hours || 0}h est</span>`}
        
        <div class="card-actions-menu" onclick="event.stopPropagation();">
          <button class="card-action-btn" title="Edit Task" onclick="openEditTaskModal(${task.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="card-action-btn" title="Delete Task" onclick="confirmDeleteTask(${task.id})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    </div>
  `;
};

// Drag and Drop Event Wiring
let draggedTaskId = null;

const setupKanbanDragDrop = () => {
  const cards = document.querySelectorAll('.task-card');
  const columns = document.querySelectorAll('.kanban-column');

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedTaskId);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedTaskId = null;
    });
  });

  columns.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');

      const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
      const newStatus = col.dataset.status;

      if (taskId && newStatus) {
        await handleTaskStatusDrop(Number(taskId), newStatus);
      }
    });
  });
};

const handleTaskStatusDrop = async (taskId, newStatus) => {
  const targetTask = state.tasks.find(t => t.id === taskId);
  if (!targetTask || targetTask.status === newStatus) return;

  const oldStatus = targetTask.status;
  // Optimistic UI update
  targetTask.status = newStatus;
  renderKanbanBoard();

  try {
    await window.api.updateStatus(taskId, newStatus);
    showToast(`Task moved to ${newStatus.replace('_', ' ').toUpperCase()}`, 'success', 2000);
    fetchStats();
    fetchActivities();
  } catch (err) {
    // Rollback on error
    targetTask.status = oldStatus;
    renderKanbanBoard();
    showToast('Failed to update task status on server.', 'error');
  }
};

// ==========================================
// View 2: Table / List View Rendering
// ==========================================
const renderTableView = () => {
  const tbody = document.getElementById('tasks-table-body');
  const bulkBar = document.getElementById('batch-actions-toolbar');
  const selectAllCb = document.getElementById('select-all-tasks-cb');

  if (!tbody) return;

  if (state.tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 3rem;">
          <div class="empty-state">
            <i class="fas fa-search empty-state-icon"></i>
            <p class="empty-state-title">No matching tasks found</p>
            <p class="empty-state-text">Try adjusting your search or filters, or create a new task.</p>
          </div>
        </td>
      </tr>
    `;
    if (bulkBar) bulkBar.style.display = 'none';
    return;
  }

  if (bulkBar) {
    bulkBar.style.display = state.selectedTaskIds.size > 0 ? 'flex' : 'none';
    const selCountEl = document.getElementById('selected-count-badge');
    if (selCountEl) selCountEl.textContent = `${state.selectedTaskIds.size} selected`;
  }

  if (selectAllCb) {
    selectAllCb.checked = state.tasks.length > 0 && state.selectedTaskIds.size === state.tasks.length;
  }

  tbody.innerHTML = state.tasks.map(task => {
    const isSelected = state.selectedTaskIds.has(task.id);
    const subtasks = task.subtasks || [];
    const completedSubs = subtasks.filter(s => s.completed).length;

    return `
      <tr>
        <td style="width: 40px;">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTaskSelection(${task.id}, this.checked)" />
        </td>
        <td>
          <div class="table-task-title" onclick="openTaskDetailModal(${task.id})">
            <span>${escapeHtml(task.title)}</span>
            ${task.description ? `<span class="table-task-desc">${escapeHtml(task.description)}</span>` : ''}
          </div>
        </td>
        <td>
          <select class="custom-select" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onchange="handleInlineStatusChange(${task.id}, this.value)">
            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="review" ${task.status === 'review' ? 'selected' : ''}>In Review</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
        <td>
          <span class="priority-pill ${task.priority}">${task.priority}</span>
        </td>
        <td>
          <span class="category-badge">${escapeHtml(task.category || 'General')}</span>
        </td>
        <td>
          <span style="font-size: 0.8rem; font-family: var(--font-mono);">${task.due_date || '-'}</span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="openEditTaskModal(${task.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteTask(${task.id})"><i class="fas fa-trash-alt"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

const toggleTaskSelection = (taskId, isChecked) => {
  if (isChecked) state.selectedTaskIds.add(taskId);
  else state.selectedTaskIds.delete(taskId);
  renderTableView();
};

const toggleSelectAllTasks = (isChecked) => {
  if (isChecked) {
    state.tasks.forEach(t => state.selectedTaskIds.add(t.id));
  } else {
    state.selectedTaskIds.clear();
  }
  renderTableView();
};

const handleInlineStatusChange = async (taskId, newStatus) => {
  try {
    await window.api.updateStatus(taskId, newStatus);
    showToast(`Status updated to ${newStatus.toUpperCase()}`, 'success', 2000);
    await refreshDashboard();
  } catch (err) {
    showToast('Failed to update status.', 'error');
  }
};

const handleBulkDelete = async () => {
  if (state.selectedTaskIds.size === 0) return;
  if (!confirm(`Are you sure you want to delete ${state.selectedTaskIds.size} selected tasks?`)) return;

  try {
    await window.api.bulkDelete(Array.from(state.selectedTaskIds));
    showToast(`Deleted ${state.selectedTaskIds.size} tasks.`, 'success');
    state.selectedTaskIds.clear();
    await refreshDashboard();
  } catch (err) {
    showToast('Bulk delete failed.', 'error');
  }
};

// ==========================================
// View 3: Analytics & Visual Charts
// ==========================================
const renderAnalytics = () => {
  if (!state.stats) return;
  const { total = 0, statusCounts = {}, priorityCounts = {}, categoryDistribution = {}, completionRate = 0, totalEstimatedHours = 0, totalLoggedHours = 0 } = state.stats;

  // Donut Chart for Status
  const donutWrapper = document.getElementById('status-donut-chart');
  if (donutWrapper) {
    const todo = statusCounts.todo || 0;
    const inProg = statusCounts.in_progress || 0;
    const rev = statusCounts.review || 0;
    const comp = statusCounts.completed || 0;

    donutWrapper.innerHTML = `
      <div class="donut-chart-wrapper">
        <svg width="160" height="160" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
          <!-- Background circle -->
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg-input)" stroke-width="3.8" />
          <!-- Completed Segment -->
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" stroke-width="3.8" stroke-dasharray="${total > 0 ? (comp / total) * 100 : 0}, 100" />
        </svg>
        <div class="donut-legend">
          <div class="legend-item"><span class="legend-dot" style="background: #94a3b8;"></span> To Do: <strong>${todo}</strong></div>
          <div class="legend-item"><span class="legend-dot" style="background: #fbbf24;"></span> In Progress: <strong>${inProg}</strong></div>
          <div class="legend-item"><span class="legend-dot" style="background: #c084fc;"></span> In Review: <strong>${rev}</strong></div>
          <div class="legend-item"><span class="legend-dot" style="background: #34d399;"></span> Completed: <strong>${comp}</strong></div>
          <div style="font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem; color: var(--accent-cyan);">
            Overall Completion: ${completionRate}%
          </div>
        </div>
      </div>
    `;
  }

  // Priority Bars
  const priorityBars = document.getElementById('priority-bars-container');
  if (priorityBars) {
    const priorities = [
      { name: 'Urgent', count: priorityCounts.urgent || 0, color: '#f43f5e' },
      { name: 'High', count: priorityCounts.high || 0, color: '#f97316' },
      { name: 'Medium', count: priorityCounts.medium || 0, color: '#38bdf8' },
      { name: 'Low', count: priorityCounts.low || 0, color: '#2dd4bf' }
    ];

    priorityBars.innerHTML = `
      <div class="bar-chart-list">
        ${priorities.map(p => {
          const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
          return `
            <div class="bar-row">
              <div class="bar-labels">
                <span>${p.name} Priority</span>
                <span><strong>${p.count}</strong> (${pct}%)</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${pct}%; background: ${p.color};"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Category Distribution Bars
  const catBars = document.getElementById('category-bars-container');
  if (catBars) {
    const categories = Object.entries(categoryDistribution);
    if (categories.length === 0) {
      catBars.innerHTML = `<p class="empty-state-text">No category data available.</p>`;
    } else {
      catBars.innerHTML = `
        <div class="bar-chart-list">
          ${categories.map(([cat, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return `
              <div class="bar-row">
                <div class="bar-labels">
                  <span>${escapeHtml(cat)}</span>
                  <span><strong>${count}</strong> tasks</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" style="width: ${pct}%; background: var(--accent-primary);"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }
};

// ==========================================
// View 4: Real-time Activity Stream
// ==========================================
const renderActivityFeed = () => {
  const container = document.getElementById('activity-stream-list');
  if (!container) return;

  if (state.activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-history empty-state-icon"></i>
        <p class="empty-state-title">No recent activity recorded</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.activities.map(act => {
    let iconClass = 'fas fa-info-circle';
    if (act.action === 'CREATED') iconClass = 'fas fa-plus-circle';
    else if (act.action === 'STATUS_CHANGE') iconClass = 'fas fa-exchange-alt';
    else if (act.action === 'DELETED') iconClass = 'fas fa-trash-alt';
    else if (act.action === 'UPDATED') iconClass = 'fas fa-pen';
    else if (act.action === 'SUBTASK_TOGGLE') iconClass = 'fas fa-check-square';

    return `
      <div class="activity-item">
        <div class="activity-icon-wrapper">
          <i class="${iconClass}"></i>
        </div>
        <div class="activity-content">
          <div class="activity-header-meta">
            <span class="activity-task-title">${escapeHtml(act.task_title || 'System')}</span>
            <span class="activity-time">${formatRelativeTime(act.timestamp)}</span>
          </div>
          <p class="activity-detail-text">${escapeHtml(act.details || act.action)}</p>
        </div>
      </div>
    `;
  }).join('');
};

// ==========================================
// Modal Operations: Create & Edit Task
// ==========================================
const openCreateTaskModal = (defaultStatus = 'todo') => {
  state.activeTaskId = null;
  state.modalSubtasks = [];
  state.modalTags = [];

  elements.taskModalTitle.textContent = 'Create New Task';
  elements.inputTaskId.value = '';
  elements.inputTitle.value = '';
  elements.inputDescription.value = '';
  elements.inputCategory.value = 'Development';
  elements.inputStatus.value = defaultStatus;
  elements.inputDueDate.value = '';
  elements.inputEstimatedHours.value = '2.0';
  elements.inputLoggedHours.value = '0';

  // Set default medium priority radio
  const mediumRadio = document.querySelector('input[name="priority"][value="medium"]');
  if (mediumRadio) mediumRadio.checked = true;

  renderModalSubtasks();
  renderModalTags();
  openModal(elements.taskModal);
};

const openEditTaskModal = (taskId) => {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.activeTaskId = taskId;
  state.modalSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));
  state.modalTags = JSON.parse(JSON.stringify(task.tags || []));

  elements.taskModalTitle.textContent = `Edit Task #${task.id}`;
  elements.inputTaskId.value = task.id;
  elements.inputTitle.value = task.title || '';
  elements.inputDescription.value = task.description || '';
  elements.inputCategory.value = task.category || 'Development';
  elements.inputStatus.value = task.status || 'todo';
  elements.inputDueDate.value = task.due_date || '';
  elements.inputEstimatedHours.value = task.estimated_hours || 0;
  elements.inputLoggedHours.value = task.logged_hours || 0;

  const priorityRadio = document.querySelector(`input[name="priority"][value="${task.priority}"]`);
  if (priorityRadio) priorityRadio.checked = true;

  renderModalSubtasks();
  renderModalTags();
  openModal(elements.taskModal);
};

const handleTaskFormSubmit = async (e) => {
  e.preventDefault();

  const title = elements.inputTitle.value.trim();
  if (!title) {
    showToast('Task title is required.', 'error');
    return;
  }

  const priorityEl = document.querySelector('input[name="priority"]:checked');
  const priority = priorityEl ? priorityEl.value : 'medium';

  const taskPayload = {
    title,
    description: elements.inputDescription.value.trim(),
    category: elements.inputCategory.value,
    status: elements.inputStatus.value,
    priority,
    due_date: elements.inputDueDate.value || null,
    estimated_hours: parseFloat(elements.inputEstimatedHours.value) || 0,
    logged_hours: parseFloat(elements.inputLoggedHours.value) || 0,
    subtasks: state.modalSubtasks,
    tags: state.modalTags
  };

  try {
    if (state.activeTaskId) {
      // Update Task
      await window.api.updateTask(state.activeTaskId, taskPayload);
      showToast('Task updated successfully!', 'success');
    } else {
      // Create Task
      await window.api.createTask(taskPayload);
      showToast('New task created!', 'success');
    }

    closeModal(elements.taskModal);
    await refreshDashboard();
  } catch (err) {
    showToast(err.message || 'Failed to save task.', 'error');
  }
};

// Modal Subtask Checklist Handlers
const addSubtaskToModal = () => {
  const text = elements.subtaskInput.value.trim();
  if (!text) return;

  state.modalSubtasks.push({
    id: Date.now().toString(),
    text,
    completed: false
  });

  elements.subtaskInput.value = '';
  renderModalSubtasks();
};

const removeSubtaskFromModal = (subId) => {
  state.modalSubtasks = state.modalSubtasks.filter(s => s.id !== subId && String(s.id) !== String(subId));
  renderModalSubtasks();
};

const renderModalSubtasks = () => {
  if (!elements.subtasksListContainer) return;
  elements.subtasksListContainer.innerHTML = state.modalSubtasks.map(s => `
    <div class="subtask-build-item">
      <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="toggleModalSubtaskCheck('${s.id}', this.checked)" />
      <span style="${s.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(s.text)}</span>
      <button type="button" class="subtask-remove-btn" onclick="removeSubtaskFromModal('${s.id}')">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
};

const toggleModalSubtaskCheck = (subId, isChecked) => {
  const sub = state.modalSubtasks.find(s => s.id === subId || String(s.id) === String(subId));
  if (sub) sub.completed = isChecked;
  renderModalSubtasks();
};

// Modal Tag Chips Handlers
const addTagToModal = (tagText) => {
  const clean = tagText.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (clean && !state.modalTags.includes(clean)) {
    state.modalTags.push(clean);
    renderModalTags();
  }
  elements.tagInput.value = '';
};

const removeTagFromModal = (tag) => {
  state.modalTags = state.modalTags.filter(t => t !== tag);
  renderModalTags();
};

const renderModalTags = () => {
  if (!elements.tagsContainer) return;
  const existingBadges = elements.tagsContainer.querySelectorAll('.tag-badge-editable');
  existingBadges.forEach(b => b.remove());

  state.modalTags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = 'tag-badge-editable';
    badge.innerHTML = `#${escapeHtml(tag)} <button type="button" onclick="removeTagFromModal('${tag}')"><i class="fas fa-times"></i></button>`;
    elements.tagsContainer.insertBefore(badge, elements.tagInput);
  });
};

// ==========================================
// Task Detail Modal / Drawer
// ==========================================
const handleCardClick = (e, taskId) => {
  if (e.target.closest('.card-actions-menu') || e.target.closest('button')) return;
  openTaskDetailModal(taskId);
};

const openTaskDetailModal = async (taskId) => {
  try {
    const res = await window.api.getTask(taskId);
    const task = res.data;
    if (!task) return;

    state.activeTaskId = taskId;
    const body = document.getElementById('detail-modal-body');

    const subtasks = task.subtasks || [];
    const activities = task.activities || [];

    body.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span class="category-badge">${escapeHtml(task.category || 'General')}</span>
        <span class="priority-pill ${task.priority}">${task.priority}</span>
      </div>

      <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">${escapeHtml(task.title)}</h2>
      
      <p style="color: var(--text-secondary); line-height: 1.5; font-size: 0.9rem; margin-bottom: 1rem;">
        ${escapeHtml(task.description || 'No description provided.')}
      </p>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; background: var(--bg-surface-elevated); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.8rem;">
        <div><strong>Status:</strong> <span style="text-transform: capitalize;">${task.status.replace('_', ' ')}</span></div>
        <div><strong>Due Date:</strong> ${task.due_date || 'None'}</div>
        <div><strong>Logged / Est:</strong> ${task.logged_hours || 0}h / ${task.estimated_hours || 0}h</div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Subtasks Checklist (${subtasks.filter(s => s.completed).length}/${subtasks.length})</h4>
        ${subtasks.length === 0 ? '<p style="font-size: 0.8rem; color: var(--text-muted);">No subtasks added.</p>' : `
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            ${subtasks.map(s => `
              <label style="display: flex; align-items: center; gap: 0.6rem; background: var(--bg-input); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; cursor: pointer;">
                <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="handleSubtaskToggleDirect(${task.id}, '${s.id}')" />
                <span style="${s.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHtml(s.text)}</span>
              </label>
            `).join('')}
          </div>
        `}
      </div>

      <div>
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Task Activity History</h4>
        <div style="max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.75rem; color: var(--text-secondary);">
          ${activities.map(a => `
            <div style="padding: 0.35rem 0.5rem; background: var(--bg-input); border-radius: var(--radius-sm); display: flex; justify-content: space-between;">
              <span>${escapeHtml(a.details || a.action)}</span>
              <span style="color: var(--text-muted);">${formatRelativeTime(a.timestamp)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    openModal(elements.detailModal);
  } catch (err) {
    showToast('Failed to load task details.', 'error');
  }
};

const handleSubtaskToggleDirect = async (taskId, subtaskId) => {
  try {
    await window.api.toggleSubtask(taskId, subtaskId);
    await refreshDashboard();
    // Reopen/refresh detail modal content
    await openTaskDetailModal(taskId);
  } catch (err) {
    showToast('Failed to update subtask.', 'error');
  }
};

// ==========================================
// Delete Confirmation
// ==========================================
const confirmDeleteTask = async (taskId) => {
  const task = state.tasks.find(t => t.id === taskId);
  const title = task ? `"${task.title}"` : 'this task';

  if (!confirm(`Are you sure you want to permanently delete ${title}?`)) {
    return;
  }

  try {
    await window.api.deleteTask(taskId);
    showToast('Task deleted successfully.', 'info');
    if (state.activeTaskId === taskId) {
      closeModal(elements.detailModal);
    }
    await refreshDashboard();
  } catch (err) {
    showToast('Failed to delete task.', 'error');
  }
};

// ==========================================
// Modal Helpers (Open/Close)
// ==========================================
const openModal = (modalElement) => {
  if (!modalElement) return;
  modalElement.classList.add('active');
  state.activeModal = modalElement;
  document.body.style.overflow = 'hidden';
};

const closeModal = (modalElement) => {
  if (!modalElement) return;
  modalElement.classList.remove('active');
  state.activeModal = null;
  document.body.style.overflow = '';
};

// ==========================================
// Event Listeners & Search / Filter Bindings
// ==========================================
const setupEventListeners = () => {
  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // View Switcher Tabs
  elements.viewTabs.forEach(tab => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  });

  // Create Task Buttons
  if (elements.createTaskBtn) {
    elements.createTaskBtn.addEventListener('click', () => openCreateTaskModal());
  }

  // Column Add Buttons
  document.querySelectorAll('.column-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCreateTaskModal(btn.dataset.status || 'todo');
    });
  });

  // Form Submit
  if (elements.taskForm) {
    elements.taskForm.addEventListener('submit', handleTaskFormSubmit);
  }

  // Subtask & Tag additions in Modal
  if (elements.subtaskAddBtn) {
    elements.subtaskAddBtn.addEventListener('click', addSubtaskToModal);
  }
  if (elements.subtaskInput) {
    elements.subtaskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSubtaskToModal();
      }
    });
  }

  if (elements.tagInput) {
    elements.tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTagToModal(elements.tagInput.value);
      }
    });
  }

  // Search input debounced
  let searchTimeout;
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.filters.search = e.target.value;
        fetchTasks();
      }, 250);
    });
  }

  // Filter Dropdowns
  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      fetchTasks();
    });
  }

  if (elements.priorityFilter) {
    elements.priorityFilter.addEventListener('change', (e) => {
      state.filters.priority = e.target.value;
      fetchTasks();
    });
  }

  if (elements.sortBySelect) {
    elements.sortBySelect.addEventListener('change', (e) => {
      const [field, order] = e.target.value.split('-');
      state.filters.sortBy = field;
      state.filters.sortOrder = order || 'DESC';
      fetchTasks();
    });
  }

  // Filter Pills
  document.querySelectorAll('.filter-pill[data-filter-status]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill[data-filter-status]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.status = pill.dataset.filterStatus;
      fetchTasks();
    });
  });

  // Modal Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      closeModal(modal);
    });
  });

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });
};

// Keyboard Shortcuts (Ctrl+K for search, N for new task, Esc for modal close)
const setupKeyboardShortcuts = () => {
  document.addEventListener('keydown', (e) => {
    // Escape key closes modals
    if (e.key === 'Escape') {
      if (state.activeModal) {
        closeModal(state.activeModal);
      }
    }

    // Ctrl+K or Cmd+K focuses search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (elements.searchInput) {
        elements.searchInput.focus();
        elements.searchInput.select();
      }
    }

    // N key (when not typing in an input/textarea) opens new task
    if (e.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openCreateTaskModal();
    }
  });
};

// ==========================================
// UI Toast Notification System
// ==========================================
const showToast = (message, type = 'info', duration = 3500) => {
  if (!elements.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fas fa-info-circle';
  if (type === 'success') icon = 'fas fa-check-circle';
  if (type === 'error') icon = 'fas fa-exclamation-triangle';

  toast.innerHTML = `
    <i class="${icon}"></i>
    <span style="flex: 1;">${escapeHtml(message)}</span>
    <button style="background: transparent; border: none; color: var(--text-muted); cursor: pointer;" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ==========================================
// Formatting & Security Helpers
// ==========================================
const escapeHtml = (unsafe) => {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T') + 'Z');
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};
