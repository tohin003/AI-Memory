import { detectSite } from '../utils/siteDetector.js';
import { db } from '../storage/db.js';

// Initialize DB
db.open().then(() => console.log("DB initialized in background")).catch(err => console.error("DB init failed:", err));

// Listen for tab updates to enable/disable side panel or update badge
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const site = detectSite(tab.url);
        if (site) {
            console.log(`AI Memory Collector: Detected ${site} on tab ${tabId}`);
            // We can enable specific features or update the sidebar context here
            await chrome.sidePanel.setOptions({
                tabId,
                path: 'sidebar/sidebar.html',
                enabled: true
            });
        } else {
            // Disable side panel for non-AI sites if we want strict mode
            // For now, we keep it enabled but maybe show a different state
            await chrome.sidePanel.setOptions({
                tabId,
                path: 'sidebar/sidebar.html',
                enabled: true
            });
        }
    }
});

// Listen for messages from content scripts or sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SAVE_MEMORY') {
        console.log('Received memory to save:', message.payload);

        // Fetch current project and username
        chrome.storage.local.get(['currentProject', 'username']).then(({ currentProject = 'Default Project', username }) => {
            const memory = {
                ...message.payload,
                projectId: currentProject,
                userId: username // Attach user identity
            };

            db.saveMessage(memory)
                .then(() => {
                    console.log("Message saved to DB for project:", currentProject);
                    // Notify sidebar to update if open
                    chrome.runtime.sendMessage({ type: 'MEMORY_SAVED' }).catch(() => {
                        // Ignore error if no listeners (sidebar closed)
                    });
                })
                .catch(err => console.error("Failed to save message:", err));
        });

        sendResponse({ status: 'received' });
    } else if (message.type === 'SEARCH_MEMORY') {
        console.log('Received search request:', message.query);
        // TODO: Perform vector search
        // Mock response for now
        import('../utils/contextBuilder.js').then(({ buildContext }) => {
            // In real app, we search DB. Here we return a dummy.
            const dummyMemories = [{ text: "Project is about AI Memory Collector extension.", site: "system" }];
            const context = buildContext(dummyMemories);
            sendResponse({ results: [], context: context });
        });
    }
    return true; // Keep channel open for async response
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener((command) => {
    if (command === 'inject_context') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_INJECTION' });
            }
        });
    }
});

// Handle Extension Icon Click (Opens Sidebar)
chrome.action.onClicked.addListener((tab) => {
    // Open the side panel in the current window
    chrome.sidePanel.open({ windowId: tab.windowId });
});

console.log("AI Memory Collector: Background worker initialized.");
