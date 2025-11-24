/**
 * ChatGPT Scraper
 * Monitors the DOM for new messages and sends them to the background script.
 */

console.log("%c AI Memory Collector: ChatGPT Scraper LOADED", "color: green; font-size: 16px; font-weight: bold;");

let lastScrapedCount = 0;

function getMessages() {
    const messages = [];

    // Broadest possible selectors for debugging
    // 1. Standard data-message-author-role
    const standardElements = document.querySelectorAll('[data-message-author-role]');
    console.log(`%c Scraper: Found ${standardElements.length} standard elements`, "color: blue");

    if (standardElements.length > 0) {
        standardElements.forEach(el => {
            const role = el.getAttribute('data-message-author-role');
            let text = el.innerText;

            // For assistant, try to get the specific markdown content to avoid "Thinking..." or other UI noise
            if (role === 'assistant') {
                const markdownEl = el.querySelector('.markdown');
                if (markdownEl) {
                    text = markdownEl.innerText;
                }
            }

            if (text && text.trim().length > 0) {
                messages.push({
                    role: role,
                    text: text.substring(0, 50) + "...", // Log short text
                    fullText: text,
                    timestamp: Date.now(),
                    site: 'chatgpt'
                });
            }
        });
    } else {
        // 2. Fallback: Look for any text blocks in the main chat area
        // This is messy but helps verify if we can see ANYTHING
        const textBlocks = document.querySelectorAll('.markdown, .whitespace-pre-wrap');
        console.log(`%c Scraper: Found ${textBlocks.length} fallback text blocks`, "color: orange");

        textBlocks.forEach(el => {
            messages.push({
                role: 'unknown',
                text: el.innerText.substring(0, 50) + "...",
                fullText: el.innerText,
                timestamp: Date.now(),
                site: 'chatgpt'
            });
        });
    }

    return messages;
}

let silenceTimer = null;
let lastStreamedText = "";

function checkForNewMessages() {
    const messages = getMessages();
    // console.log(`%c Scraper: Total messages parsed: ${messages.length}`, "color: purple");

    // Check for streaming indicators
    const stopButton = document.querySelector('button[aria-label="Stop generating"]');
    const isStreaming = !!stopButton;

    // Handle Streaming for the LAST message only
    if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];

        // If it's an assistant message and we are streaming OR it's new content
        if (lastMsg.role === 'assistant') {

            // If text has changed since last stream update
            if (lastMsg.fullText !== lastStreamedText) {
                // console.log("Streaming update...", lastMsg.fullText.length);

                // Send partial update to sidebar
                try {
                    chrome.runtime.sendMessage({
                        type: 'STREAMING_UPDATE',
                        payload: { ...lastMsg, text: lastMsg.fullText }
                    }).catch(() => { }); // Ignore if sidebar closed or context invalid
                } catch (e) {
                    // Context invalidated
                    observer.disconnect();
                    return;
                }

                lastStreamedText = lastMsg.fullText;

                // Reset silence timer
                if (silenceTimer) clearTimeout(silenceTimer);

                // If streaming UI is gone but text is still changing, we are still "streaming" effectively.
                // Set a timer: If no text change for 2 seconds, assume done.
                silenceTimer = setTimeout(() => {
                    console.log("Silence detected. Force saving...");
                    saveFinalMessage(lastMsg);
                }, 2000);
            }
        }
    }

    if (messages.length > lastScrapedCount) {
        // Iterate through ONLY the new messages
        for (let i = lastScrapedCount; i < messages.length; i++) {
            const msg = messages[i];

            // 1. Critical: Skip empty messages
            if (!msg.text || !msg.text.trim()) {
                continue;
            }

            // 2. Wait for streaming to finish for the LAST message
            // If it's the last message AND it's an assistant AND we are streaming... wait.
            if (i === messages.length - 1 && msg.role === 'assistant' && isStreaming) {
                // console.log(`%c Scraper: Waiting for message ${i} to finish streaming...`, "color: blue");
                continue;
            }

            // 3. Save the message (Final Commit)
            saveFinalMessage(msg);

            // 4. Update the count to "commit" this message
            lastScrapedCount = i + 1;
        }
    }
}

function saveFinalMessage(msg) {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
        console.log("Extension context invalidated. Stopping scraper.");
        observer.disconnect();
        return;
    }

    console.log(`%c Scraper: Saving FINAL message to DB`, "color: green; font-weight: bold");

    try {
        chrome.runtime.sendMessage({
            type: 'SAVE_MEMORY',
            payload: { ...msg, text: msg.fullText }
        })
            .then(() => {
                console.log("✅ Saved");
                if (silenceTimer) clearTimeout(silenceTimer); // Clear timer if saved
            })
            .catch(err => {
                if (err.message.includes('Extension context invalidated')) {
                    console.log("Extension reloaded. Stopping scraper.");
                    observer.disconnect();
                } else {
                    console.error("❌ Save failed", err);
                }
            });
    } catch (e) {
        console.log("Runtime error (likely context invalidated):", e);
        observer.disconnect();
    }
}

// Observer
const observer = new MutationObserver((mutations) => {
    // Log that mutation happened
    // console.log("DOM Mutation detected"); 
    checkForNewMessages();
});

const startObserver = () => {
    // Try multiple potential containers
    const targetNode = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;

    if (targetNode) {
        observer.observe(targetNode, { childList: true, subtree: true });
        console.log("%c AI Memory Collector: Observer STARTED on", "color: green", targetNode);
        checkForNewMessages(); // Check immediately on load
    } else {
        console.log("Waiting for main container...");
        setTimeout(startObserver, 1000);
    }
};

startObserver();
