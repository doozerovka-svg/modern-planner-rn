import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

// Open database and return the instance
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('modern_planner.db');
  
  // Enable foreign keys
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  
  return dbInstance;
}

// Initialize tables and seed default categories
export async function initDb(): Promise<void> {
  const db = await getDb();

  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      icon TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoryId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT,
      priority INTEGER DEFAULT 1,
      isCompleted INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId INTEGER NOT NULL,
      title TEXT NOT NULL,
      isCompleted INTEGER DEFAULT 0,
      FOREIGN KEY (taskId) REFERENCES tasks (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      tags TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  // Seed default categories if empty
  const categoriesCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (categoriesCount && categoriesCount.count === 0) {
    await db.runAsync('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', 'Personal', '#6366f1', 'user');
    await db.runAsync('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', 'Work', '#f59e0b', 'briefcase');
    await db.runAsync('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', 'Study', '#06b6d4', 'book-open');
  }
}

// TYPES
export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

export interface Task {
  id: number;
  categoryId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: number; // 1 = Low, 2 = Medium, 3 = High
  isCompleted: boolean;
  createdAt: string;
  categoryName?: string;
  categoryColor?: string;
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
}

export interface TaskWithSubtasks extends Task {
  subtasks: Subtask[];
}

export interface Note {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  tags: string | null;
  createdAt: string;
}

// CRUD - CATEGORIES
export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id ASC');
}

export async function addCategory(name: string, color: string, icon: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)',
    name,
    color,
    icon
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

// CRUD - TASKS & SUBTASKS
export async function getTasks(categoryId?: number): Promise<TaskWithSubtasks[]> {
  const db = await getDb();
  let query = `
    SELECT t.*, c.name as categoryName, c.color as categoryColor 
    FROM tasks t 
    JOIN categories c ON t.categoryId = c.id
  `;
  const params: any[] = [];

  if (categoryId !== undefined) {
    query += ' WHERE t.categoryId = ?';
    params.push(categoryId);
  }
  query += ' ORDER BY t.priority DESC, t.id DESC';

  const tasks = await db.getAllAsync<any>(query, ...params);
  const tasksWithSubtasks: TaskWithSubtasks[] = [];

  for (const t of tasks) {
    const subtasks = await db.getAllAsync<any>(
      'SELECT * FROM subtasks WHERE taskId = ? ORDER BY id ASC',
      t.id
    );

    tasksWithSubtasks.push({
      ...t,
      isCompleted: t.isCompleted === 1,
      subtasks: subtasks.map(s => ({
        ...s,
        isCompleted: s.isCompleted === 1
      }))
    });
  }

  return tasksWithSubtasks;
}

export async function addTask(
  categoryId: number,
  title: string,
  description: string | null,
  dueDate: string | null,
  priority: number,
  subtasks: string[] = []
): Promise<number> {
  const db = await getDb();
  const createdAt = new Date().toISOString();

  // Use a manual transaction equivalent or run inside a block
  // expo-sqlite supports transactions via withTransactionAsync
  let taskId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO tasks (categoryId, title, description, dueDate, priority, isCompleted, createdAt) 
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      categoryId,
      title,
      description,
      dueDate,
      priority,
      createdAt
    );
    taskId = result.lastInsertRowId;

    for (const subtaskTitle of subtasks) {
      await db.runAsync(
        'INSERT INTO subtasks (taskId, title, isCompleted) VALUES (?, ?, 0)',
        taskId,
        subtaskTitle
      );
    }
  });

  return taskId;
}

export async function updateTask(
  id: number,
  title: string,
  description: string | null,
  dueDate: string | null,
  priority: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE tasks SET title = ?, description = ?, dueDate = ?, priority = ? WHERE id = ?',
    title,
    description,
    dueDate,
    priority,
    id
  );
}

export async function toggleTaskCompletion(id: number, isCompleted: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE tasks SET isCompleted = ? WHERE id = ?', isCompleted ? 1 : 0, id);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

// CRUD - SUBTASKS
export async function addSubtask(taskId: number, title: string): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO subtasks (taskId, title, isCompleted) VALUES (?, ?, 0)',
    taskId,
    title
  );
  return result.lastInsertRowId;
}

export async function toggleSubtaskCompletion(id: number, isCompleted: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE subtasks SET isCompleted = ? WHERE id = ?', isCompleted ? 1 : 0, id);
}

export async function deleteSubtask(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM subtasks WHERE id = ?', id);
}

// CRUD - NOTES
export async function getNotes(): Promise<Note[]> {
  const db = await getDb();
  return await db.getAllAsync<Note>('SELECT * FROM notes ORDER BY id DESC');
}

export async function addNote(title: string, content: string, summary: string | null = null, tags: string | null = null): Promise<number> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO notes (title, content, summary, tags, createdAt) VALUES (?, ?, ?, ?, ?)',
    title,
    content,
    summary,
    tags,
    createdAt
  );
  return result.lastInsertRowId;
}

export async function updateNote(id: number, title: string, content: string, summary: string | null = null, tags: string | null = null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE notes SET title = ?, content = ?, summary = ?, tags = ? WHERE id = ?',
    title,
    content,
    summary,
    tags,
    id
  );
}

export async function deleteNote(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
