/**
 * Generates embeddings for text.
 * Currently returns a random vector for testing purposes.
 * @param {string} text - The text to embed.
 * @returns {Promise<number[]>} - The embedding vector.
 */
export async function generateEmbedding(text) {
    // TODO: Replace with real model (e.g., Transformers.js or Chrome built-in AI)
    console.warn("Generating DUMMY embedding for:", text.substring(0, 20) + "...");

    const dimension = 384; // Standard small model dimension
    const vector = new Array(dimension).fill(0).map(() => Math.random() - 0.5);
    return vector;
}

/**
 * Calculates cosine similarity between two vectors.
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} - Similarity score (-1 to 1).
 */
export function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
