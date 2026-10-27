// NEXA IndexedDB Storage using idb
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  template?: string;
}

export interface FileRecord {
  id: string; // `${projectId}:${path}`
  projectId: string;
  path: string;
  content: string;
  updatedAt: number;
}

export interface PlanStep {
  id: string;
  name: string; // 'Understand' | 'Plan' | 'Build' | 'Review' | 'Fix'
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
}

export interface MessageRecord {
  id: string;
  projectId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  time: number;
  steps?: PlanStep[];
}

export interface MemoryRecord {
  projectId: string;
  markdown: string;
}

interface NexaDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectRecord;
    indexes: { 'by-updated': number };
  };
  files: {
    key: string;
    value: FileRecord;
    indexes: { 'by-project': string; 'by-project-path': [string, string] };
  };
  messages: {
    key: string;
    value: MessageRecord;
    indexes: { 'by-project': string };
  };
  memory: {
    key: string;
    value: MemoryRecord;
  };
}

const DB_NAME = 'nexa_builder_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NexaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<NexaDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only accessible in browser environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<NexaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('by-updated', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('by-project', 'projectId');
          fileStore.createIndex('by-project-path', ['projectId', 'path']);
        }

        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-project', 'projectId');
        }

        if (!db.objectStoreNames.contains('memory')) {
          db.createObjectStore('memory', { keyPath: 'projectId' });
        }
      },
    });
  }
  return dbPromise;
}

// Project helpers
export async function getAllProjects(): Promise<ProjectRecord[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex('projects', 'by-updated');
  return projects.reverse(); // most recent first
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function deleteProjectRecord(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'files', 'messages', 'memory'], 'readwrite');
  
  await tx.objectStore('projects').delete(id);
  
  // delete files
  const fileKeys = await tx.objectStore('files').index('by-project').getAllKeys(id);
  for (const k of fileKeys) {
    await tx.objectStore('files').delete(k);
  }

  // delete messages
  const messageKeys = await tx.objectStore('messages').index('by-project').getAllKeys(id);
  for (const k of messageKeys) {
    await tx.objectStore('messages').delete(k);
  }

  // delete memory
  await tx.objectStore('memory').delete(id);

  await tx.done;
}

// Files helpers
export async function getProjectFiles(projectId: string): Promise<FileRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('files', 'by-project', projectId);
}

export async function getFile(projectId: string, path: string): Promise<FileRecord | undefined> {
  const db = await getDB();
  const id = `${projectId}:${path}`;
  return db.get('files', id);
}

export async function putFile(projectId: string, path: string, content: string): Promise<void> {
  const db = await getDB();
  const id = `${projectId}:${path}`;
  await db.put('files', {
    id,
    projectId,
    path,
    content,
    updatedAt: Date.now(),
  });
}

export async function removeFile(projectId: string, path: string): Promise<void> {
  const db = await getDB();
  const id = `${projectId}:${path}`;
  await db.delete('files', id);
}

// Messages helpers
export async function getProjectMessages(projectId: string): Promise<MessageRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('messages', 'by-project', projectId);
}

export async function putMessage(message: MessageRecord): Promise<void> {
  const db = await getDB();
  await db.put('messages', message);
}

// Memory helpers
export async function getProjectMemory(projectId: string): Promise<string> {
  const db = await getDB();
  const mem = await db.get('memory', projectId);
  return mem?.markdown || '';
}

export async function putProjectMemory(projectId: string, markdown: string): Promise<void> {
  const db = await getDB();
  await db.put('memory', { projectId, markdown });
}
