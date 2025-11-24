/**
 * Mock Chrome API for local testing
 * Simulates background worker storage logic.
 */
console.log("Mock Chrome API loading...");

if (typeof chrome === 'undefined') {
    window.chrome = {};
}

// Helper to save to IDB directly (simulating background worker)
function mockSaveToDB(message) {
    console.log("MockDB: Attempting to save message:", message);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AIMemoryCollector', 1);

        request.onupgradeneeded = (event) => {
            console.log("MockDB: Upgrade needed. Creating stores...");
            const db = event.target.result;
            if (!db.objectStoreNames.contains('messages')) {
                db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('embeddings')) {
                db.createObjectStore('embeddings', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            console.log("MockDB: DB Opened successfully. Stores:", db.objectStoreNames);

            try {
                const tx = db.transaction(['messages'], 'readwrite');
                const store = tx.objectStore('messages');
                const addRequest = store.add(message);

                addRequest.onsuccess = () => {
                    console.log("MockDB: Message saved successfully:", message);
                    resolve();
                };

                addRequest.onerror = (e) => {
                    console.error("MockDB Add Error:", e);
                    reject(e);
                };

                tx.oncomplete = () => {
                    console.log("MockDB: Transaction complete.");
                };

                tx.onerror = (e) => {
                    console.error("MockDB Transaction Error:", e);
                };
            } catch (e) {
                console.error("MockDB Transaction Creation Failed:", e);
                reject(e);
            }
        };
        request.onerror = (e) => {
            console.error("MockDB Open Error:", e);
            reject(e);
        };
    });
}

if (!chrome.runtime) chrome.runtime = {};
if (!chrome.runtime.onMessage) {
    chrome.runtime.onMessage = {
        addListener: (cb) => { console.log("Mock: Added onMessage listener"); }
    };
}
if (!chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage = async (msg) => {
        console.log("Mock sendMessage:", msg);
        if (msg.type === 'SAVE_MEMORY') {
            try {
                await mockSaveToDB(msg.payload);
                return { status: 'success' };
            } catch (e) {
                console.error("Mock Save Failed", e);
                return { status: 'error' };
            }
        }
        return Promise.resolve({ status: 'mock_success' });
    };
}

if (!chrome.storage) chrome.storage = {};
if (!chrome.storage.local) {
    chrome.storage.local = {
        get: (keys, cb) => cb({}),
        set: (items, cb) => cb && cb()
    };
}

if (!chrome.tabs) chrome.tabs = {};
if (!chrome.tabs.query) chrome.tabs.query = (q, cb) => cb([{ id: 1, url: 'http://localhost' }]);
if (!chrome.tabs.sendMessage) chrome.tabs.sendMessage = (id, msg) => console.log("Mock tabs.sendMessage:", id, msg);

if (!chrome.sidePanel) chrome.sidePanel = {};
if (!chrome.sidePanel.setOptions) chrome.sidePanel.setOptions = () => Promise.resolve();

if (!chrome.commands) chrome.commands = {};
if (!chrome.commands.onCommand) chrome.commands.onCommand = { addListener: () => { } };

console.log("Mock Chrome API loaded. Ready to save memories.");
