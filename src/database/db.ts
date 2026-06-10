import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Only import expo-sqlite on native platforms to prevent issues, though modern Expo allows it on web (where it throws at runtime)
let SQLite: any = null;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

let dbInstance: any = null;

// Open database and return the instance (Native only)
export async function getDb(): Promise<any> {
  if (Platform.OS === 'web') return null;
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('modern_planner.db');
  
  // Enable foreign keys
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  
  return dbInstance;
}

// Initialize tables and seed default categories
export async function initDb(): Promise<void> {
  if (Platform.OS === 'web') {
    // Seed web storage
    const cats = await AsyncStorage.getItem('web_categories');
    if (!cats) {
      const defaultCats: Category[] = [
        { id: 1, name: 'Personal', color: '#6366f1', icon: 'user' },
        { id: 2, name: 'Work', color: '#f59e0b', icon: 'briefcase' },
        { id: 3, name: 'Study', color: '#06b6d4', icon: 'book-open' }
      ];
      await AsyncStorage.setItem('web_categories', JSON.stringify(defaultCats));
      await AsyncStorage.setItem('web_tasks', JSON.stringify([]));
      await AsyncStorage.setItem('web_subtasks', JSON.stringify([]));
      await AsyncStorage.setItem('web_notes', JSON.stringify([]));
    }
    return;
  }

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

// Helper for Web Storage
async function getWebItem<T>(key: string): Promise<T[]> {
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

async function saveWebItem<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// CRUD - CATEGORIES
export async function getCategories(): Promise<Category[]> {
  if (Platform.OS === 'web') {
    return await getWebItem<Category>('web_categories');
  }
  const db = await getDb();
  return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY id ASC');
}

export async function addCategory(name: string, color: string, icon: string): Promise<number> {
  if (Platform.OS === 'web') {
    const list = await getWebItem<Category>('web_categories');
    if (list.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Category already exists');
    }
    const newId = list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1;
    list.push({ id: newId, name, color, icon });
    await saveWebItem('web_categories', list);
    return newId;
  }
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
  if (Platform.OS === 'web') {
    const cats = await getWebItem<Category>('web_categories');
    await saveWebItem('web_categories', cats.filter(c => c.id !== id));
    
    // Cascade delete tasks
    const tasks = await getWebItem<Task>('web_tasks');
    const tasksToKeep = tasks.filter(t => t.categoryId !== id);
    const deletedTaskIds = tasks.filter(t => t.categoryId === id).map(t => t.id);
    await saveWebItem('web_tasks', tasksToKeep);

    // Cascade delete subtasks
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    await saveWebItem('web_subtasks', subtasks.filter(s => !deletedTaskIds.includes(s.taskId)));
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

// CRUD - TASKS & SUBTASKS
export async function getTasks(categoryId?: number): Promise<TaskWithSubtasks[]> {
  if (Platform.OS === 'web') {
    const tasks = await getWebItem<Task>('web_tasks');
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    const categories = await getWebItem<Category>('web_categories');

    let filtered = tasks;
    if (categoryId !== undefined) {
      filtered = tasks.filter(t => t.categoryId === categoryId);
    }

    // Sort by priority desc, id desc
    filtered.sort((a, b) => b.priority - a.priority || b.id - a.id);

    return filtered.map(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const taskSubtasks = subtasks.filter(s => s.taskId === t.id);
      return {
        ...t,
        categoryName: cat?.name,
        categoryColor: cat?.color,
        subtasks: taskSubtasks
      };
    });
  }

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
  subtaskTitles: string[] = []
): Promise<number> {
  if (Platform.OS === 'web') {
    const tasks = await getWebItem<Task>('web_tasks');
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    const newTaskId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    const createdAt = new Date().toISOString();

    tasks.push({
      id: newTaskId,
      categoryId,
      title,
      description,
      dueDate,
      priority,
      isCompleted: false,
      createdAt
    });

    let lastSubId = subtasks.length > 0 ? Math.max(...subtasks.map(s => s.id)) : 0;
    for (const subTitle of subtaskTitles) {
      lastSubId++;
      subtasks.push({
        id: lastSubId,
        taskId: newTaskId,
        title: subTitle,
        isCompleted: false
      });
    }

    await saveWebItem('web_tasks', tasks);
    await saveWebItem('web_subtasks', subtasks);
    return newTaskId;
  }

  const db = await getDb();
  const createdAt = new Date().toISOString();

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

    for (const subtaskTitle of subtaskTitles) {
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
  if (Platform.OS === 'web') {
    const tasks = await getWebItem<Task>('web_tasks');
    const updated = tasks.map(t => t.id === id ? { ...t, title, description, dueDate, priority } : t);
    await saveWebItem('web_tasks', updated);
    return;
  }
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
  if (Platform.OS === 'web') {
    const tasks = await getWebItem<Task>('web_tasks');
    const updated = tasks.map(t => t.id === id ? { ...t, isCompleted } : t);
    await saveWebItem('web_tasks', updated);
    return;
  }
  const db = await getDb();
  await db.runAsync('UPDATE tasks SET isCompleted = ? WHERE id = ?', isCompleted ? 1 : 0, id);
}

export async function deleteTask(id: number): Promise<void> {
  if (Platform.OS === 'web') {
    const tasks = await getWebItem<Task>('web_tasks');
    await saveWebItem('web_tasks', tasks.filter(t => t.id !== id));
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    await saveWebItem('web_subtasks', subtasks.filter(s => s.taskId !== id));
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

// CRUD - SUBTASKS
export async function addSubtask(taskId: number, title: string): Promise<number> {
  if (Platform.OS === 'web') {
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    const newId = subtasks.length > 0 ? Math.max(...subtasks.map(s => s.id)) + 1 : 1;
    subtasks.push({ id: newId, taskId, title, isCompleted: false });
    await saveWebItem('web_subtasks', subtasks);
    return newId;
  }
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO subtasks (taskId, title, isCompleted) VALUES (?, ?, 0)',
    taskId,
    title
  );
  return result.lastInsertRowId;
}

export async function toggleSubtaskCompletion(id: number, isCompleted: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    const updated = subtasks.map(s => s.id === id ? { ...s, isCompleted } : s);
    await saveWebItem('web_subtasks', updated);
    return;
  }
  const db = await getDb();
  await db.runAsync('UPDATE subtasks SET isCompleted = ? WHERE id = ?', isCompleted ? 1 : 0, id);
}

export async function deleteSubtask(id: number): Promise<void> {
  if (Platform.OS === 'web') {
    const subtasks = await getWebItem<Subtask>('web_subtasks');
    await saveWebItem('web_subtasks', subtasks.filter(s => s.id !== id));
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM subtasks WHERE id = ?', id);
}

// CRUD - NOTES
export async function getNotes(): Promise<Note[]> {
  if (Platform.OS === 'web') {
    const list = await getWebItem<Note>('web_notes');
    list.sort((a, b) => b.id - a.id);
    return list;
  }
  const db = await getDb();
  return await db.getAllAsync<Note>('SELECT * FROM notes ORDER BY id DESC');
}

export async function addNote(title: string, content: string, summary: string | null = null, tags: string | null = null): Promise<number> {
  if (Platform.OS === 'web') {
    const list = await getWebItem<Note>('web_notes');
    const newId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    const createdAt = new Date().toISOString();
    list.push({ id: newId, title, content, summary, tags, createdAt });
    await saveWebItem('web_notes', list);
    return newId;
  }
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
  if (Platform.OS === 'web') {
    const list = await getWebItem<Note>('web_notes');
    const updated = list.map(n => n.id === id ? { ...n, title, content, summary, tags } : n);
    await saveWebItem('web_notes', updated);
    return;
  }
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
  if (Platform.OS === 'web') {
    const list = await getWebItem<Note>('web_notes');
    await saveWebItem('web_notes', list.filter(n => n.id !== id));
    return;
  }
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', id);
}
