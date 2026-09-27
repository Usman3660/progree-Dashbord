/**
 * SynapseGrid - Asynchronous API Client Service
 * Encapsulates all backend REST microservice endpoints using async/await fetch calls.
 */

const API_BASE = '/api';

class ApiService {
  /**
   * Generic fetch wrapper with robust error handling
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Request failed for [${options.method || 'GET'}] ${endpoint}:`, error);
      throw error;
    }
  }

  // ==========================================
  // Task CRUD Operations
  // ==========================================

  /**
   * Fetch tasks with query filters & sorting
   */
  async getTasks(filters = {}) {
    const queryParams = new URLSearchParams();
    
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.priority && filters.priority !== 'all') queryParams.append('priority', filters.priority);
    if (filters.category && filters.category !== 'all') queryParams.append('category', filters.category);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.tag) queryParams.append('tag', filters.tag);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);

    const queryString = queryParams.toString();
    const endpoint = `/tasks${queryString ? `?${queryString}` : ''}`;
    return await this.request(endpoint, { method: 'GET' });
  }

  /**
   * Fetch single task with its activity history
   */
  async getTask(id) {
    return await this.request(`/tasks/${id}`, { method: 'GET' });
  }

  /**
   * Create a new task
   */
  async createTask(taskData) {
    return await this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  }

  /**
   * Update an existing task
   */
  async updateTask(id, taskData) {
    return await this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  }

  /**
   * Quick status change (e.g. Kanban Drag & Drop)
   */
  async updateStatus(id, status) {
    return await this.request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  /**
   * Toggle a subtask completion state
   */
  async toggleSubtask(id, subtaskId) {
    return await this.request(`/tasks/${id}/subtask-toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ subtaskId })
    });
  }

  /**
   * Delete a task by ID
   */
  async deleteTask(id) {
    return await this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  /**
   * Bulk delete multiple tasks
   */
  async bulkDelete(ids) {
    return await this.request('/tasks/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    });
  }

  // ==========================================
  // Dashboard Analytics & Logs
  // ==========================================

  /**
   * Fetch aggregate dashboard metrics
   */
  async getStats() {
    return await this.request('/stats', { method: 'GET' });
  }

  /**
   * Fetch real-time activity stream
   */
  async getActivities() {
    return await this.request('/activities', { method: 'GET' });
  }

  /**
   * Reset database to rich initial sample data
   */
  async resetData() {
    return await this.request('/reset-data', { method: 'POST' });
  }

  /**
   * Generate export URL
   */
  getExportUrl(format = 'json') {
    return `${API_BASE}/export?format=${format}`;
  }
}

// Export singleton instance
window.api = new ApiService();
