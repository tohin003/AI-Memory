/**
 * Database Abstraction Layer
 * Currently uses IndexedDB for persistence.
 * Can be swapped for SQLite WASM in the future.
 */

const DB_NAME = 'AIMemoryCollector';
const DB_VERSION = 1;
const STORE_MESSAGES = 'messages';
const STORE_EMBEDDINGS = 'embeddings';

export class Database {
    constructor() {
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => reject('Database error: ' + event.target.errorCode);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
                    db.createObjectStore(STORE_MESSAGES, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(STORE_EMBEDDINGS)) {
                    db.createObjectStore(STORE_EMBEDDINGS, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };
        });
    }

    async saveMessage(message) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_MESSAGES], 'readwrite');
            const store = transaction.objectStore(STORE_MESSAGES);

            // 1. Check for duplicates (Fuzzy Match)
            const getAllReq = store.getAll();

            getAllReq.onsuccess = () => {
                const existingMessages = getAllReq.result;

                // Normalize: Trim and collapse multiple spaces to single space
                const normalize = (str) => (str || "").trim().replace(/\s+/g, ' ');
                const newText = normalize(message.text);

                // Find a matching message (Same Project, Same Role)
                // REMOVED site check to be safer
                const match = existingMessages.find(m =>
                    m.role === message.role &&
                    m.projectId === message.projectId &&
                    (
                        normalize(m.text) === newText ||
                        normalize(m.text).startsWith(newText) || // Old is longer (keep old)
                        newText.startsWith(normalize(m.text))    // New is longer (update old)
                    )
                );

                if (match) {
                    const oldText = normalize(match.text);

                    // Case A: Exact Match -> Ignore
                    if (oldText === newText) {
                        console.log(`%c [DB] Exact duplicate found (ID: ${match.id}). Skipping.`, "color: gray");
                        resolve(match.id);
                        return;
                    }

                    // Case B: New text is longer (better version) -> Update
                    if (newText.length > oldText.length) {
                        console.log(`%c [DB] Updating partial message (ID: ${match.id}) with full version.`, "color: blue");
                        match.text = message.text; // Update content
                        match.fullText = message.fullText;
                        // match.timestamp = message.timestamp; // Keep original timestamp to preserve order

                        const updateReq = store.put(match);
                        updateReq.onsuccess = (e) => resolve(e.target.result);
                        updateReq.onerror = (e) => reject(e.target.error);
                        return;
                    }

                    // Case C: Old text is longer -> Ignore new (it's likely a partial scrape)
                    console.log(`%c [DB] Existing message (ID: ${match.id}) is longer. Skipping partial update.`, "color: orange");
                    resolve(match.id);
                    return;
                }

                // 2. Add if unique
                console.log("%c [DB] New unique message. Saving.", "color: green");
                const request = store.add(message);
                request.onsuccess = (event) => resolve(event.target.result);
                request.onerror = (event) => reject(event.target.error);
            };

            getAllReq.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllMessages() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_MESSAGES], 'readonly');
            const store = transaction.objectStore(STORE_MESSAGES);
            const request = store.getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async saveEmbedding(embeddingData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_EMBEDDINGS], 'readwrite');
            const store = transaction.objectStore(STORE_EMBEDDINGS);
            const request = store.add(embeddingData);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async getAllEmbeddings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_EMBEDDINGS], 'readonly');
            const store = transaction.objectStore(STORE_EMBEDDINGS);
            const request = store.getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteMessage(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_MESSAGES], 'readwrite');
            const store = transaction.objectStore(STORE_MESSAGES);
            const request = store.delete(id);

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async deleteMessagesByProject(projectId) {
        const messages = await this.getAllMessages();
        const toDelete = messages.filter(m => m.projectId === projectId);

        const transaction = this.db.transaction([STORE_MESSAGES], 'readwrite');
        const store = transaction.objectStore(STORE_MESSAGES);

        return Promise.all(toDelete.map(msg => {
            return new Promise((resolve, reject) => {
                const req = store.delete(msg.id);
                req.onsuccess = () => resolve();
                req.onerror = () => reject();
            });
        }));
    }
}

export const db = new Database();
