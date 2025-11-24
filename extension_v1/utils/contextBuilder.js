/**
 * Context Builder
 * Formats memory items into a string suitable for AI injection.
 */

export function buildContext(memories) {
    if (!memories || memories.length === 0) return '';

    const contextHeader = "\n\n--- [AI Memory Collector] Relevant Context ---\n";
    const contextFooter = "\n----------------------------------------------\n\n";

    const items = memories.map((mem, index) => {
        return `[Memory ${index + 1}] (${mem.site || 'Unknown'}): ${mem.text}`;
    }).join('\n\n');

    return `${contextHeader}${items}${contextFooter}`;
}
