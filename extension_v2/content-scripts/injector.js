/**
 * Context Injector
 * Listens for the injection command and inserts text into the active input.
 */

console.log("AI Memory Collector: Injector loaded");

// Listen for messages from background (triggered by command)
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'TRIGGER_INJECTION') {
        console.log("Triggering context injection...");
        await handleInjection();
    }
});

async function handleInjection() {
    const activeElement = document.activeElement;

    if (!activeElement || (!isInput(activeElement) && !activeElement.isContentEditable)) {
        console.warn("No active input element found.");
        alert("Please click inside the chat input box first.");
        return;
    }

    // 1. Get current text to use as query (optional, or just use last few words)
    // For now, we might just fetch the most recent relevant memories or ask user via a small popup?
    // The prompt says "Retrieve relevant memory chunks". 
    // We'll assume we fetch general relevant context or the user has selected something in the sidebar.
    // Let's ask the background to search based on the current input value?

    const query = getInputValue(activeElement) || "recent project context";

    // 2. Fetch context from background
    const response = await chrome.runtime.sendMessage({ type: 'SEARCH_MEMORY', query: query });
    const context = response.context; // Assumes background returns formatted string

    if (!context) {
        console.log("No context found to inject.");
        return;
    }

    // 3. Inject
    insertText(activeElement, context);
}

function isInput(el) {
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

function getInputValue(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return el.value;
    } else {
        return el.innerText;
    }
}

function insertText(el, text) {
    console.log("Attempting to insert text into:", el);

    // Focus the element first
    el.focus();

    // Method 1: execCommand (Best for ContentEditable like Gemini/ChatGPT)
    const success = document.execCommand('insertText', false, text);
    if (success) {
        console.log("Injection successful via execCommand");
        return;
    }

    // Method 2: Range/Selection API (Modern fallback)
    if (el.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            // Move cursor to end
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event
            el.dispatchEvent(new Event('input', { bubbles: true }));
            console.log("Injection successful via Range API");
            return;
        }
    }

    // Method 3: Direct Value Manipulation (Inputs/Textareas)
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const val = el.value;
        el.value = val.substring(0, start) + text + val.substring(end);
        el.selectionStart = el.selectionEnd = start + text.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        console.log("Injection successful via Value manipulation");
    } else {
        console.error("Failed to inject text. Unknown element type.");
        alert("Could not inject text automatically. Please paste manually.");
    }
}
