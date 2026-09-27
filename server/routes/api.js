const express = require('express');
const router = express.Router();
const { query, get, run, logActivity, resetDatabase } = require('../db');

// Helper to sanitize and parse subtasks/tags JSON safely
const parseTaskJSON = (task) => {
  if (!task) return null;
  return {
    ...task,
    subtasks: typeof task.subtasks === 'string' ? JSON.parse(task.subtasks || '[]') : (task.subtasks || []),
    tags: typeof task.tags === 'string' ? JSON.parse(task.tags || '[]') : (task.tags || [])
  };
};

// ==========================================
// 1. GET /api/tasks - Read all with filters
// ==========================================
router.get('/tasks', async (req, res) => {
  try {
    const { status, priority, category, search, tag, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority && priority !== 'all') {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (tag && tag.trim()) {
      sql += ' AND tags LIKE ?';
      params.push(`%${tag.trim()}%`);
    }

    // Safe sorting columns
    const allowedSortFields = ['created_at', 'updated_at', 'due_date', 'priority', 'title', 'status', 'estimated_hours'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Custom priority sorting order when sorted by priority
    if (validSortBy === 'priority') {
      sql += ` ORDER BY CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5 END ${validSortOrder}`;
    } else {
      sql += ` ORDER BY ${validSortBy} ${validSortOrder}`;
    }

    const rows = await query(sql, params);
    const tasks = rows.map(parseTaskJSON);

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error while fetching tasks.' });
  }
});

// ==========================================
// 2. GET /api/tasks/:id - Read single task
// ==========================================
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);

    if (!task) {
      return res.status(404).json({ success: false, error: `Task #${id} not found.` });
    }

    const activities = await query(
      'SELECT * FROM activity_logs WHERE task_id = ? ORDER BY timestamp DESC LIMIT 20',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...parseTaskJSON(task),
        activities
      }
    });
  } catch (err) {
    console.error(`Error fetching task #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to fetch task details.' });
  }
});

// ==========================================
// 3. POST /api/tasks - Create Task
// ==========================================
router.post('/tasks', async (req, res) => {
  try {
    const {
      title,
      description = '',
      status = 'todo',
      priority = 'medium',
      category = 'General',
      due_date = null,
      estimated_hours = 0,
      logged_hours = 0,
      subtasks = [],
      tags = []
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required.' });
    }

    const validStatuses = ['todo', 'in_progress', 'review', 'completed'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    const taskStatus = validStatuses.includes(status) ? status : 'todo';
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';

    const subtasksJSON = typeof subtasks === 'string' ? subtasks : JSON.stringify(subtasks);
    const tagsJSON = typeof tags === 'string' ? tags : JSON.stringify(tags);

    const result = await run(
      `INSERT INTO tasks (title, description, status, priority, category, due_date, estimated_hours, logged_hours, subtasks, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        title.trim(),
        description.trim(),
        taskStatus,
        taskPriority,
        category.trim() || 'General',
        due_date || null,
        Number(estimated_hours) || 0,
        Number(logged_hours) || 0,
        subtasksJSON,
        tagsJSON
      ]
    );

    const newTask = await get('SELECT * FROM tasks WHERE id = ?', [result.id]);
    await logActivity(result.id, title.trim(), 'CREATED', `Created task with ${taskPriority} priority in ${taskStatus}`);

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      data: parseTaskJSON(newTask)
    });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ success: false, error: 'Failed to create task.' });
  }
});

// ==========================================
// 4. PUT /api/tasks/:id - Update Task
// ==========================================
router.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM tasks WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({ success: false, error: `Task #${id} not found.` });
    }

    const {
      title = existing.title,
      description = existing.description,
      status = existing.status,
      priority = existing.priority,
      category = existing.category,
      due_date = existing.due_date,
      estimated_hours = existing.estimated_hours,
      logged_hours = existing.logged_hours,
      subtasks = existing.subtasks,
      tags = existing.tags
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title cannot be empty.' });
    }

    const subtasksJSON = typeof subtasks === 'string' ? subtasks : JSON.stringify(subtasks);
    const tagsJSON = typeof tags === 'string' ? tags : JSON.stringify(tags);

    await run(
      `UPDATE tasks SET
        title = ?,
        description = ?,
        status = ?,
        priority = ?,
        category = ?,
        due_date = ?,
        estimated_hours = ?,
        logged_hours = ?,
        subtasks = ?,
        tags = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      [
        title.trim(),
        description ? description.trim() : '',
        status,
        priority,
        category,
        due_date || null,
        Number(estimated_hours) || 0,
        Number(logged_hours) || 0,
        subtasksJSON,
        tagsJSON,
        id
      ]
    );

    const updatedTask = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    await logActivity(id, title.trim(), 'UPDATED', `Task details updated.`);

    res.json({
      success: true,
      message: 'Task updated successfully.',
      data: parseTaskJSON(updatedTask)
    });
  } catch (err) {
    console.error(`Error updating task #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to update task.' });
  }
});

// ==========================================
// 5. PATCH /api/tasks/:id/status - Quick status update (Kanban drag/drop)
// ==========================================
router.patch('/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['todo', 'in_progress', 'review', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status: ${status}` });
    }

    const existing = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Task #${id} not found.` });
    }

    await run(
      `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, id]
    );

    const updatedTask = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    await logActivity(id, existing.title, 'STATUS_CHANGE', `Moved from ${existing.status} to ${status}`);

    res.json({
      success: true,
      message: `Status updated to ${status}.`,
      data: parseTaskJSON(updatedTask)
    });
  } catch (err) {
    console.error(`Error updating status for task #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to update status.' });
  }
});

// ==========================================
// 6. PATCH /api/tasks/:id/subtask-toggle - Toggle subtask completion
// ==========================================
router.patch('/tasks/:id/subtask-toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { subtaskId } = req.body;

    const existing = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Task #${id} not found.` });
    }

    let subtasks = [];
    try {
      subtasks = JSON.parse(existing.subtasks || '[]');
    } catch {
      subtasks = [];
    }

    let toggledSubtask = null;
    subtasks = subtasks.map(item => {
      if (item.id === subtaskId || String(item.id) === String(subtaskId)) {
        toggledSubtask = { ...item, completed: !item.completed };
        return toggledSubtask;
      }
      return item;
    });

    await run(
      `UPDATE tasks SET subtasks = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(subtasks), id]
    );

    const updatedTask = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (toggledSubtask) {
      await logActivity(
        id,
        existing.title,
        'SUBTASK_TOGGLE',
        `Subtask "${toggledSubtask.text}" marked as ${toggledSubtask.completed ? 'completed' : 'incomplete'}`
      );
    }

    res.json({
      success: true,
      data: parseTaskJSON(updatedTask)
    });
  } catch (err) {
    console.error(`Error toggling subtask for #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to toggle subtask.' });
  }
});

// ==========================================
// 7. DELETE /api/tasks/:id - Delete Task
// ==========================================
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM tasks WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({ success: false, error: `Task #${id} not found.` });
    }

    await run('DELETE FROM tasks WHERE id = ?', [id]);
    await logActivity(id, existing.title, 'DELETED', `Task "${existing.title}" permanently removed.`);

    res.json({
      success: true,
      message: `Task #${id} ("${existing.title}") deleted successfully.`
    });
  } catch (err) {
    console.error(`Error deleting task #${req.params.id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to delete task.' });
  }
});

// ==========================================
// 8. POST /api/tasks/bulk-delete - Bulk delete tasks
// ==========================================
router.post('/tasks/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Array of task IDs is required.' });
    }

    const placeholders = ids.map(() => '?').join(',');
    await run(`DELETE FROM tasks WHERE id IN (${placeholders})`, ids);
    await logActivity(null, 'Multiple Tasks', 'BULK_DELETE', `Bulk deleted ${ids.length} tasks (IDs: ${ids.join(', ')})`);

    res.json({
      success: true,
      message: `Successfully deleted ${ids.length} tasks.`
    });
  } catch (err) {
    console.error('Error in bulk delete:', err);
    res.status(500).json({ success: false, error: 'Failed to delete selected tasks.' });
  }
});

// ==========================================
// 9. GET /api/stats - Dashboard Analytics & Metrics
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const allTasks = await query('SELECT * FROM tasks');
    const total = allTasks.length;

    const statusCounts = {
      todo: allTasks.filter(t => t.status === 'todo').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      review: allTasks.filter(t => t.status === 'review').length,
      completed: allTasks.filter(t => t.status === 'completed').length
    };

    const priorityCounts = {
      urgent: allTasks.filter(t => t.priority === 'urgent').length,
      high: allTasks.filter(t => t.priority === 'high').length,
      medium: allTasks.filter(t => t.priority === 'medium').length,
      low: allTasks.filter(t => t.priority === 'low').length
    };

    const categoryMap = {};
    let totalEstimated = 0;
    let totalLogged = 0;
    let totalSubtasks = 0;
    let completedSubtasks = 0;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let overdueCount = 0;

    allTasks.forEach(t => {
      // Category count
      const cat = t.category || 'Unassigned';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;

      // Hours
      totalEstimated += Number(t.estimated_hours || 0);
      totalLogged += Number(t.logged_hours || 0);

      // Overdue check
      if (t.due_date && t.due_date < todayStr && t.status !== 'completed') {
        overdueCount++;
      }

      // Subtasks count
      try {
        const subs = typeof t.subtasks === 'string' ? JSON.parse(t.subtasks || '[]') : (t.subtasks || []);
        totalSubtasks += subs.length;
        completedSubtasks += subs.filter(s => s.completed).length;
      } catch (e) {}
    });

    const completionRate = total > 0 ? Math.round((statusCounts.completed / total) * 100) : 0;
    const subtaskRate = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    // Upcoming deadlines in next 7 days
    const upcoming = allTasks
      .filter(t => t.due_date && t.due_date >= todayStr && t.status !== 'completed')
      .sort((a, b) => (a.due_date > b.due_date ? 1 : -1))
      .slice(0, 5)
      .map(parseTaskJSON);

    res.json({
      success: true,
      stats: {
        total,
        statusCounts,
        priorityCounts,
        categoryDistribution: categoryMap,
        totalEstimatedHours: Number(totalEstimated.toFixed(1)),
        totalLoggedHours: Number(totalLogged.toFixed(1)),
        completionRate,
        subtaskRate,
        totalSubtasks,
        completedSubtasks,
        overdueCount,
        upcoming
      }
    });
  } catch (err) {
    console.error('Error calculating stats:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve analytics.' });
  }
});

// ==========================================
// 10. GET /api/activities - Activity Stream
// ==========================================
router.get('/activities', async (req, res) => {
  try {
    const activities = await query(
      'SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 30'
    );
    res.json({ success: true, data: activities });
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch activity stream.' });
  }
});

// ==========================================
// 11. POST /api/reset-data - Reset to sample dataset
// ==========================================
router.post('/reset-data', async (req, res) => {
  try {
    await resetDatabase();
    res.json({ success: true, message: 'Database reset to initial demo state successfully.' });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({ success: false, error: 'Failed to reset database.' });
  }
});

// ==========================================
// 12. GET /api/export - Export dataset as JSON or CSV
// ==========================================
router.get('/export', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const tasks = await query('SELECT * FROM tasks ORDER BY id ASC');

    if (format === 'csv') {
      const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Category', 'DueDate', 'EstimatedHours', 'LoggedHours', 'CreatedAt'];
      const csvRows = [headers.join(',')];

      tasks.forEach(t => {
        const row = [
          t.id,
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.status,
          t.priority,
          `"${t.category}"`,
          t.due_date || '',
          t.estimated_hours || 0,
          t.logged_hours || 0,
          t.created_at
        ];
        csvRows.push(row.join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="synapsegrid_export.csv"');
      return res.send(csvRows.join('\n'));
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="synapsegrid_export.json"');
    res.json(tasks.map(parseTaskJSON));
  } catch (err) {
    console.error('Error exporting tasks:', err);
    res.status(500).json({ success: false, error: 'Failed to export data.' });
  }
});

module.exports = router;
