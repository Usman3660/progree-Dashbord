const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper for promise-based queries
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const logActivity = async (taskId, taskTitle, action, details) => {
  try {
    await run(
      `INSERT INTO activity_logs (task_id, task_title, action, details, timestamp)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [taskId, taskTitle || 'Unknown Task', action, details]
    );
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

const sampleTasks = [
  {
    title: 'Architect Microservice API & Schema',
    description: 'Design RESTful API endpoints, SQLite schema with indexing, and secure async route handlers.',
    status: 'completed',
    priority: 'urgent',
    category: 'Development',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    estimated_hours: 6.5,
    logged_hours: 6.5,
    subtasks: JSON.stringify([
      { id: '1', text: 'Define SQLite tables & migrations', completed: true },
      { id: '2', text: 'Implement CRUD controllers with async/await', completed: true },
      { id: '3', text: 'Add input validation & error handling', completed: true }
    ]),
    tags: JSON.stringify(['backend', 'sqlite', 'express'])
  },
  {
    title: 'Design Glassmorphic Interactive Dashboard UI',
    description: 'Implement modern dark mode aesthetics, Kanban drag-and-drop board, data tables, and interactive metrics.',
    status: 'in_progress',
    priority: 'high',
    category: 'Design',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    estimated_hours: 8.0,
    logged_hours: 4.5,
    subtasks: JSON.stringify([
      { id: '1', text: 'Create typography and color token system', completed: true },
      { id: '2', text: 'Build Kanban columns with drag-drop event listeners', completed: true },
      { id: '3', text: 'Design task modal with dynamic subtasks & tag chips', completed: false },
      { id: '4', text: 'Add responsive mobile navigation', completed: false }
    ]),
    tags: JSON.stringify(['frontend', 'css', 'kanban', 'ux'])
  },
  {
    title: 'Integrate Real-time Analytics & Charts',
    description: 'Render visual SVG & Canvas metric charts for task completion velocity, priority distribution, and category time tracking.',
    status: 'in_progress',
    priority: 'medium',
    category: 'Development',
    due_date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    estimated_hours: 5.0,
    logged_hours: 2.0,
    subtasks: JSON.stringify([
      { id: '1', text: 'Aggregate backend metrics via /api/stats', completed: true },
      { id: '2', text: 'Render donut & sparkline charts', completed: false },
      { id: '3', text: 'Add filterable date ranges', completed: false }
    ]),
    tags: JSON.stringify(['analytics', 'charts', 'data'])
  },
  {
    title: 'Setup Automated Testing & Performance Audits',
    description: 'Run automated end-to-end CRUD flows, audit accessibility standards, and verify responsive layouts across screen viewports.',
    status: 'review',
    priority: 'high',
    category: 'Operations',
    due_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
    estimated_hours: 4.0,
    logged_hours: 3.5,
    subtasks: JSON.stringify([
      { id: '1', text: 'Test Create, Read, Update, Delete async requests', completed: true },
      { id: '2', text: 'Verify keyboard shortcuts (Ctrl+K, N, Esc)', completed: true },
      { id: '3', text: 'Check Lighthouse performance & accessibility score', completed: false }
    ]),
    tags: JSON.stringify(['testing', 'qa', 'a11y'])
  },
  {
    title: 'User Onboarding & Interactive Tour Guide',
    description: 'Create a seamless welcoming experience with preloaded sample workflows and quick tips for new users.',
    status: 'todo',
    priority: 'low',
    category: 'Marketing',
    due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    estimated_hours: 3.0,
    logged_hours: 0,
    subtasks: JSON.stringify([
      { id: '1', text: 'Draft tour tooltips and highlight animations', completed: false },
      { id: '2', text: 'Add one-click Sample Data Reset button', completed: true }
    ]),
    tags: JSON.stringify(['onboarding', 'growth'])
  },
  {
    title: 'Security Hardening & Input Sanitization',
    description: 'Review API endpoints against SQL injection, sanitize payload inputs, and implement safe parameter bindings.',
    status: 'todo',
    priority: 'urgent',
    category: 'Research',
    due_date: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
    estimated_hours: 4.5,
    logged_hours: 0,
    subtasks: JSON.stringify([
      { id: '1', text: 'Audit parameterized SQL statements', completed: false },
      { id: '2', text: 'Implement sanitization middleware', completed: false }
    ]),
    tags: JSON.stringify(['security', 'backend'])
  }
];

const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Create tasks table
        await run(`
          CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'completed')) DEFAULT 'todo',
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
            category TEXT DEFAULT 'Development',
            due_date TEXT,
            estimated_hours REAL DEFAULT 0,
            logged_hours REAL DEFAULT 0,
            subtasks TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create activity_logs table
        await run(`
          CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            task_title TEXT,
            action TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create indexes for fast filtering
        await run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category)`);

        // Seed if empty
        const countRow = await get('SELECT COUNT(*) as count FROM tasks');
        if (countRow.count === 0) {
          console.log('Seeding initial sample tasks...');
          for (const task of sampleTasks) {
            const res = await run(
              `INSERT INTO tasks (title, description, status, priority, category, due_date, estimated_hours, logged_hours, subtasks, tags, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
              [
                task.title,
                task.description,
                task.status,
                task.priority,
                task.category,
                task.due_date,
                task.estimated_hours,
                task.logged_hours,
                task.subtasks,
                task.tags
              ]
            );
            await logActivity(res.id, task.title, 'CREATED', `Initial task created in status ${task.status}`);
          }
          console.log('Seeding complete.');
        }

        resolve();
      } catch (err) {
        console.error('Error during database initialization:', err);
        reject(err);
      }
    });
  });
};

const resetDatabase = async () => {
  await run('DELETE FROM tasks');
  await run('DELETE FROM activity_logs');
  for (const task of sampleTasks) {
    const res = await run(
      `INSERT INTO tasks (title, description, status, priority, category, due_date, estimated_hours, logged_hours, subtasks, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        task.title,
        task.description,
        task.status,
        task.priority,
        task.category,
        task.due_date,
        task.estimated_hours,
        task.logged_hours,
        task.subtasks,
        task.tags
      ]
    );
    await logActivity(res.id, task.title, 'CREATED', `Demo reset: Seeded task in status ${task.status}`);
  }
};

module.exports = {
  db,
  query,
  get,
  run,
  logActivity,
  initDatabase,
  resetDatabase
};
