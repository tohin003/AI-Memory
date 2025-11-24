/**
 * Gemini Scraper
 */

console.log("AI Memory Collector: Gemini scraper active");

let lastScrapedCount = 0;

function getMessages() {
    const messages = [];

    // Gemini Selectors (Best Guess for current UI)
    // User: .user-query-text, .query-text
    // Model: .model-response-text, .response-text

    const userElements = document.querySelectorAll('.user-query-text, .query-text, [data-test-id="user-query"]');
    const modelElements = document.querySelectorAll('.model-response-text, .response-text, [data-test-id="model-response"]');

    // Combine and sort by position
    const allElements = [
        ...Array.from(userElements).map(el => ({ el, role: 'user' })),
        ...Array.from(modelElements).map(el => ({ el, role: 'assistant' }))
    ];

    allElements.sort((a, b) => {
        // Sort by document position
        return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

    allElements.forEach(({ el, role }) => {
        if (el.innerText) {
            messages.push({
                role: role,
                text: el.innerText,
                timestamp: Date.now(),
                site: 'gemini'
            });
        }
    });

    return messages;
}

function checkForNewMessages() {
    const messages = getMessages();
    if (messages.length > lastScrapedCount) {
        const newMessages = messages.slice(lastScrapedCount);
        console.log(`Gemini Scraper: Found ${newMessages.length} new messages`);

        newMessages.forEach(msg => {
            chrome.runtime.sendMessage({ type: 'SAVE_MEMORY', payload: msg });
        });

        lastScrapedCount = messages.length;
    }
}

// Observer
const observer = new MutationObserver(() => checkForNewMessages());
const startObserver = () => {
    const target = document.querySelector('main') || document.body;
    if (target) {
        observer.observe(target, { childList: true, subtree: true });
        console.log("Gemini Scraper: Observer started");
    } else {
        setTimeout(startObserver, 1000);
    }
};
startObserver();
