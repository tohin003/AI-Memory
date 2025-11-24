import { db } from '../storage/db.js';
import { vectorSearch } from '../storage/vectorSearch.js';

console.log("Sidebar JS loading...");

// UI Elements - Moved inside init to ensure DOM is ready
let tabs, contents, messageList, searchInput, searchBtn, searchResults, exportBtn, importBtn, importFile, memoryCount;

// Initialize
async function init() {
    try {
        // Auth Check
        const { authToken, email, username } = await chrome.storage.local.get(['authToken', 'email', 'username']);
        if (!authToken) {
            window.location.href = '../auth/login.html';
            return;
        }

        // Update Profile Tooltip (Native Title)
        const profileIcon = document.querySelector('.profile-icon');
        if (profileIcon) {
            const tooltipText = email || username || 'User Profile';
            profileIcon.setAttribute('title', tooltipText);
            // Also set parent div title just in case
            const profileDiv = document.getElementById('user-profile');
            if (profileDiv) profileDiv.setAttribute('title', tooltipText);
        }

        // Verify token validity with server (optional but good for security)
        try {
            const res = await fetch('http://localhost:3000/verify', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!res.ok) throw new Error('Invalid token');
        } catch (e) {
            console.warn("Auth verification failed:", e);
            // If server is down, we might want to allow offline access if previously logged in?
            // User requested: "they could only use the entension when i run my laptop as a server"
            // So we strictly enforce it.
            window.location.href = '../auth/login.html';
            return;
        }

        tabs = document.querySelectorAll('.tab-btn');
        contents = document.querySelectorAll('.tab-content');
        messageList = document.getElementById('message-list');
        searchInput = document.getElementById('search-input');
        searchBtn = document.getElementById('search-btn');
        searchResults = document.getElementById('search-results');
        exportBtn = document.getElementById('export-btn');
        importBtn = document.getElementById('import-btn');
        importFile = document.getElementById('import-file');
        memoryCount = document.getElementById('memory-count');

        console.log("Init running. Tabs found:", tabs.length);

        // Tab Switching - Setup immediately
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    console.log("Tab clicked:", tab.dataset.tab);

                    tabs.forEach(t => t.classList.remove('active'));
                    contents.forEach(c => c.classList.remove('active'));

                    tab.classList.add('active');
                    const content = document.getElementById(tab.dataset.tab);
                    if (content) content.classList.add('active');
                });
            });
        } else {
            console.warn("No tabs found!");
        }

        // Search - Setup immediately
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }

        // Export/Import - Setup immediately
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                const messages = await db.getAllMessages();

                // Deduplicate before export
                const uniqueMessages = [];
                const seen = new Set();

                messages.forEach(msg => {
                    // Create a unique signature for the message
                    // We use projectId, role, and text to define uniqueness
                    const signature = `${msg.projectId}|${msg.role}|${msg.text}`;
                    if (!seen.has(signature)) {
                        seen.add(signature);
                        uniqueMessages.push(msg);
                    }
                });

                const blob = new Blob([JSON.stringify(uniqueMessages, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ai-memory-backup-${Date.now()}.json`;
                a.click();
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', handleImport);
        }

        // Project Selector Logic
        const projectSelector = document.getElementById('project-selector');
        const deleteProjectBtn = document.getElementById('delete-project-btn');

        // Load projects
        const { projects = ['Default Project'], currentProject = 'Default Project' } = await chrome.storage.local.get(['projects', 'currentProject']);

        const renderProjects = () => {
            projectSelector.innerHTML = '';
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                if (p === currentProject) opt.selected = true;
                projectSelector.appendChild(opt);
            });
            const newOpt = document.createElement('option');
            newOpt.value = 'new';
            newOpt.textContent = '+ New Project';
            projectSelector.appendChild(newOpt);

            // Show/Hide delete button (Disable for Default Project)
            if (currentProject !== 'Default Project') {
                deleteProjectBtn.disabled = false;
                deleteProjectBtn.title = "Delete Project";
            } else {
                deleteProjectBtn.disabled = true;
                deleteProjectBtn.title = "Cannot delete Default Project";
            }
        };
        renderProjects();

        projectSelector.addEventListener('change', async (e) => {
            if (e.target.value === 'new') {
                const name = prompt("Enter new project name:");
                if (name && !projects.includes(name)) {
                    projects.push(name);
                    await chrome.storage.local.set({ projects, currentProject: name });
                    // Update local variable for render
                    renderProjects();
                    // Force reload to ensure UI sync
                    window.location.reload();
                } else {
                    projectSelector.value = currentProject; // Revert
                }
            } else {
                await chrome.storage.local.set({ currentProject: e.target.value });
                window.location.reload(); // Simple reload to sync state
            }
        });

        deleteProjectBtn.addEventListener('click', async () => {
            const projectToDelete = projectSelector.value;
            if (projectToDelete === 'Default Project') return;

            if (confirm(`Delete project "${projectToDelete}" and all its memories?`)) {
                // 1. Delete from DB
                await db.deleteMessagesByProject(projectToDelete);

                // 2. Remove from storage
                const newProjects = projects.filter(p => p !== projectToDelete);
                await chrome.storage.local.set({
                    projects: newProjects,
                    currentProject: 'Default Project'
                });

                alert('Project deleted.');
                window.location.reload();
            }
        });

        const copyProjectBtn = document.getElementById('copy-project-btn');
        const logoutBtn = document.getElementById('logout-btn');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to logout?')) {
                    await chrome.storage.local.remove(['authToken', 'username']);
                    window.location.href = '../auth/login.html';
                }
            });
        }

        copyProjectBtn.addEventListener('click', async () => {
            const currentProj = projectSelector.value;
            const messages = await db.getAllMessages();

            // Filter by project
            const projectMessages = messages
                .filter(m => (m.projectId || 'Default Project') === currentProj)
                .sort((a, b) => a.timestamp - b.timestamp); // Sort chronological for context

            if (projectMessages.length === 0) {
                alert('No messages to copy in this project.');
                return;
            }

            // Format context
            const contextText = projectMessages.map(m => {
                const role = m.role.toUpperCase();
                const time = new Date(m.timestamp).toLocaleString();
                return `[${role} - ${time}]\n${m.text}\n`;
            }).join('\n---\n\n');

            try {
                await navigator.clipboard.writeText(contextText);
                const originalText = copyProjectBtn.innerHTML;
                copyProjectBtn.textContent = '✅';
                setTimeout(() => copyProjectBtn.innerHTML = originalText, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Failed to copy to clipboard.');
            }
        });

        try {
            await db.open();
            updateStats();
            loadRecentMessages();
        } catch (err) {
            console.error("DB Initialization failed:", err);
            messageList.innerHTML = '<div class="empty-state">Database Error. UI functionality limited.</div>';
        }
    } catch (e) {
        console.error("Critical Init Error:", e);
    }
}

async function loadRecentMessages() {
    const { currentProject = 'Default Project', username } = await chrome.storage.local.get(['currentProject', 'username']);
    const messages = await db.getAllMessages();

    // Filter by project AND user
    const filtered = messages.filter(m => {
        const p = m.projectId || 'Default Project';
        // Only show messages that belong to this user
        // For legacy messages (undefined userId), we hide them to ensure isolation
        return p === currentProject && m.userId === username;
    });

    // Sort by timestamp desc
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    renderMessages(filtered.slice(0, 50), messageList);
}

function renderMessages(messages, container) {
    container.innerHTML = '';
    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state">No messages found.</div>';
        return;
    }

    messages.forEach(msg => {
        const card = document.createElement('div');
        card.className = `message-card ${msg.role}`;

        const date = new Date(msg.timestamp).toLocaleTimeString();
        card.innerHTML = `
      <div class="meta">
        <span>${msg.role.toUpperCase()} • ${msg.site || 'Unknown'}</span>
        <div style="display: flex; gap: 10px; align-items: center;">
            <span>${date}</span>
            <button class="delete-btn" data-id="${msg.id}" style="background: none; border: none; cursor: pointer;" title="Delete Memory">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d7ccc8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
      </div>
      <div class="text">${escapeHtml(msg.text)}</div>
    `;

        // Add delete listener
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Delete this memory?')) {
                await db.deleteMessage(msg.id);
                loadRecentMessages();
                updateStats();
            }
        });

        container.appendChild(card);
    });
}

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchResults.innerHTML = '<div class="empty-state">Searching...</div>';

    try {
        // In a real app, we'd search embeddings. 
        // For now, let's do a text search on the DB or use the vectorSearch mock if ready.
        // Let's try the vector search mock.
        const results = await vectorSearch.search(query);

        // The vector search mock returns embeddings, we need to map back to messages if they are separate.
        // In our mock DB, we might not have linked them perfectly yet. 
        // Let's fallback to text filter for immediate feedback if vector search returns empty/dummy.

        const allMessages = await db.getAllMessages();
        const textResults = allMessages.filter(m => m.text.toLowerCase().includes(query.toLowerCase()));

        renderMessages(textResults, searchResults);
    } catch (err) {
        console.error("Search failed", err);
        searchResults.innerHTML = '<div class="empty-state">Search failed.</div>';
    }
}

async function updateStats() {
    const messages = await db.getAllMessages();
    memoryCount.textContent = messages.length;
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (Array.isArray(data)) {
                for (const msg of data) {
                    await db.saveMessage(msg);
                }
                alert('Import successful!');
                loadRecentMessages();
                updateStats();
            }
        } catch (err) {
            alert('Invalid JSON file');
        }
    };
    reader.readAsText(file);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Listen for new messages from background to auto-update
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'MEMORY_SAVED') {
        // Remove any streaming card first
        const streamingCard = document.getElementById('streaming-card');
        if (streamingCard) streamingCard.remove();

        loadRecentMessages();
        updateStats();
    } else if (message.type === 'STREAMING_UPDATE') {
        handleStreamingUpdate(message.payload);
    }
});

function handleStreamingUpdate(msg) {
    // Only show streaming for the current project
    // We assume the user is looking at the relevant project. 
    // Ideally we check msg.projectId, but the scraper might not know the project ID yet (it's added in background).
    // For now, we show it.

    let streamingCard = document.getElementById('streaming-card');

    if (!streamingCard) {
        // Create new streaming card
        streamingCard = document.createElement('div');
        streamingCard.id = 'streaming-card';
        streamingCard.className = `message-card ${msg.role} streaming`; // Add 'streaming' class for styling
        streamingCard.style.border = "1px solid #e6a23c"; // Gold border to indicate active
        streamingCard.style.opacity = "0.8";

        const date = new Date().toLocaleTimeString();
        streamingCard.innerHTML = `
          <div class="meta">
            <span>${msg.role.toUpperCase()} • Live</span>
            <span>${date}</span>
          </div>
          <div class="text"></div>
        `;

        // Prepend to list
        if (messageList.firstChild) {
            messageList.insertBefore(streamingCard, messageList.firstChild);
        } else {
            messageList.appendChild(streamingCard);
        }
    }

    // Update text
    const textDiv = streamingCard.querySelector('.text');
    if (textDiv) {
        textDiv.textContent = msg.text; // Use textContent for raw speed, or innerHTML if we want markdown later
        // Auto-scroll to top if needed, but usually we are at top
    }
}

init();
