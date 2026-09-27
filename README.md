# 🚀 SynapseGrid — Interactive Dynamic Task & Workflow Platform

An interactive full-stack Task Management & Productivity Analytics platform featuring modern Glassmorphic design, asynchronous CRUD workflows, Kanban drag-and-drop board, real-time metric gauges, audit trail streams, and active local SQLite database persistence.

---

## 🌟 Key Features

### 1. 🔄 Full-Stack Asynchronous CRUD Operations
- **Create**: Add new tasks with title, description, category, priority (Low, Medium, High, Urgent), due date, estimated/logged hours, subtask checklists, and tag chips.
- **Read**: Dynamic query filtering (by status, priority, category, keyword search, tag), custom sorting, and single-task detail inspection.
- **Update**: Full task editing, quick status transitions (Drag & Drop), time logging, and inline subtask completion toggling.
- **Delete**: Individual task removal with safety confirmation and bulk multi-task deletion.

### 2. 📋 Interactive Multiple Viewports
- **Kanban Board**: 4 drag-and-drop workflow stages (*To Do*, *In Progress*, *In Review*, *Completed*) with column counts and instant "+ Add Task" shortcuts.
- **Data Table / List**: Sortable columns, inline status dropdowns, search highlights, and batch selection.
- **Analytics & Visual Insights**: SVG donut chart for stage completion velocity, comparative priority distribution matrix, and category workload graphs.
- **Activity Audit Trail**: Chronological event stream logging all task creations, status moves, edits, and deletions with relative timestamps.

### 3. 🎨 Aesthetic & User Experience
- **Glassmorphic Obsidian Theme**: Deep dark backdrop with glowing accents, frosted glass surfaces, and micro-interactions.
- **4 Theme Presets**: Obsidian Dark (default), Cyberpunk Neon, Midnight Ocean, and Crisp Light mode (persisted to LocalStorage).
- **Global Search Spotlight**: Real-time debounced query filtering accessible via `Ctrl + K` or `Cmd + K`.
- **Keyboard Shortcuts**: `Ctrl+K` (Spotlight Search), `N` (New Task), `Escape` (Dismiss Modals).
- **Toast Notifications**: Feedback messages for all network mutations.
- **Data Portability**: Export tasks dataset to JSON or CSV formats with a single click.
- **One-Click Demo Reset**: Instantly repopulates SQLite with rich sample tasks.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | Vanilla JS (ES6+), HTML5, CSS3 Glassmorphism | Async/await fetch client, reactive state controller, HTML5 drag-and-drop, SVG visual charts |
| **Backend Microservice** | Node.js, Express 5, CORS, Morgan | RESTful microservice API with parameterized queries, input validation, and activity logging |
| **Database** | SQLite 3 (`database.sqlite`) | Local database instance with schema migrations, indexes, and seeded records |

---

## 📡 Backend REST API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | Read tasks with query filters (`status`, `priority`, `category`, `search`, `sortBy`, `sortOrder`) |
| `GET` | `/api/tasks/:id` | Read single task with subtasks and activity history |
| `POST` | `/api/tasks` | Create new task |
| `PUT` | `/api/tasks/:id` | Update task details |
| `PATCH` | `/api/tasks/:id/status` | Quick status change (e.g. Kanban Drag & Drop) |
| `PATCH` | `/api/tasks/:id/subtask-toggle` | Toggle individual checklist item completion |
| `DELETE` | `/api/tasks/:id` | Permanently delete a task |
| `POST` | `/api/tasks/bulk-delete` | Bulk delete multiple tasks |
| `GET` | `/api/stats` | Aggregate dashboard analytics & progress metrics |
| `GET` | `/api/activities` | Real-time audit activity feed |
| `POST` | `/api/reset-data` | Restore initial demo sample tasks |
| `GET` | `/api/export?format=json\|csv` | Export entire dataset as JSON or CSV |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or newer)
- npm

### Installation & Launch

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the SynapseGrid server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
