import { db } from './db.js';
import { generateEmbedding, cosineSimilarity } from '../utils/embeddings.js';

export class VectorSearch {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        await db.open();
        this.isInitialized = true;
    }

    /**
     * Searches for similar memories.
     * @param {string} query - The search query.
     * @param {number} topK - Number of results to return.
     * @returns {Promise<Array>} - Ranked results.
     */
    async search(query, topK = 5) {
        if (!this.isInitialized) await this.init();

        const queryVector = await generateEmbedding(query);
        const allEmbeddings = await db.getAllEmbeddings();

        // Perform linear scan (brute force)
        // For < 10k items, this is fast enough in JS
        const results = allEmbeddings.map(item => {
            const score = cosineSimilarity(queryVector, item.vector);
            return { ...item, score };
        });

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Get top K
        const topResults = results.slice(0, topK);

        // Fetch actual message content
        // In a real DB, we'd do a JOIN. Here we fetch manually or store text with embedding.
        // Assuming embedding object has a 'messageId' reference.
        // For prototype, let's assume embedding object *is* the record or has the text.

        return topResults;
    }
}

export const vectorSearch = new VectorSearch();
