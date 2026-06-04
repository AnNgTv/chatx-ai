import { openDB } from 'idb';
import type { DBSchema } from 'idb';

interface ChatXDB extends DBSchema {
  messages: {
    key: string;
    value: {
      id: string;
      text: string;
      sender: string;
      timestamp: string;
      status: 'sent' | 'pending' | 'failed';
    };
    indexes: { 'by-timestamp': string };
  };
}

const DB_NAME = 'chatx-ai-db';
const DB_VERSION = 1;

export const dbPromise = openDB<ChatXDB>(DB_NAME, DB_VERSION, {
  upgrade(db) {
    const messageStore = db.createObjectStore('messages', {
      keyPath: 'id',
    });
    messageStore.createIndex('by-timestamp', 'timestamp');
  },
});

export const saveMessage = async (message: any) => {
  const db = await dbPromise;
  return db.put('messages', message);
};

export const getMessages = async () => {
  const db = await dbPromise;
  return db.getAllFromIndex('messages', 'by-timestamp');
};
