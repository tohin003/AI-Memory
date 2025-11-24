/**
 * Detects the AI platform based on the URL.
 * @param {string} url - The URL to check.
 * @returns {string|null} - The site name ('chatgpt', 'gemini', 'claude', 'perplexity', 'copilot') or null.
 */
export function detectSite(url) {
    if (!url) return null;

    if (url.includes('chatgpt.com')) {
        return 'chatgpt';
    }
    if (url.includes('gemini.google.com')) {
        return 'gemini';
    }
    if (url.includes('claude.ai')) {
        return 'claude';
    }
    if (url.includes('perplexity.ai')) {
        return 'perplexity';
    }
    if (url.includes('copilot.microsoft.com')) {
        return 'copilot';
    }

    return null;
}
