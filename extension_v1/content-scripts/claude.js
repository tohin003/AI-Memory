/**
 * Claude Scraper
 */

console.log("AI Memory Collector: Claude scraper active");

let lastScrapedCount = 0;

function getMessages() {
    const messages = [];

    // Claude usually wraps messages in:
    // .font-user-message
    // .font-claude-message

    const userMsgs = document.querySelectorAll('.font-user-message');
    const claudeMsgs = document.querySelectorAll('.font-claude-message');

    // We need to interleave them or just collect them all.
    // Better to traverse the chat container children.

    const chatContainer = document.querySelector('.flex.flex-col.gap-2.pb-4'); // Example container class

    if (chatContainer) {
        Array.from(chatContainer.children).forEach(child => {
            if (child.querySelector('.font-user-message')) {
                messages.push({
                    role: 'user',
                    text: child.innerText,
                    timestamp: Date.now(),
                    site: 'claude'
                });
            } else if (child.querySelector('.font-claude-message')) {
                messages.push({
                    role: 'assistant',
                    text: child.innerText,
                    timestamp: Date.now(),
                    site: 'claude'
                });
            }
        });
    }

    return messages;
}

function checkForNewMessages() {
    const messages = getMessages();
    if (messages.length > lastScrapedCount) {
        const newMessages = messages.slice(lastScrapedCount);
        newMessages.forEach(msg => {
            chrome.runtime.sendMessage({ type: 'SAVE_MEMORY', payload: msg });
        });
        lastScrapedCount = messages.length;
    }
}

const observer = new MutationObserver(checkForNewMessages);
const startObserver = () => {
    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
};
startObserver();
