/**
 * Code Chunk Tracker - Utility for tracking code chunks and blocks
 */

class CodeChunkTracker {
    constructor() {
        // Make these available globally for debugging
        window.allCodeChunks = [];
        window.completeCodeBlockTracking = '';
    }
    
    /**
     * Track a new code chunk
     * @param {Object} chunk The code chunk to track
     * @param {string} chunk.content Content of the chunk
     * @param {string} chunk.language Programming language of the chunk
     * @param {boolean} chunk.isNewBlock Whether this chunk starts a new block
     */
    trackCodeChunk(chunk) {
        if (!chunk) return;
        
        // Add timestamp to chunk
        chunk.timestamp = Date.now();
        
        // Track in array
        window.allCodeChunks.push(chunk);
        
        // Update complete block tracking if needed
        if (chunk.content && typeof chunk.content === 'string') {
            window.completeCodeBlockTracking += chunk.content;
        }
    }
    
    /**
     * Mark the end of a code block
     * @param {string} reason Reason for ending the block
     */
    markBlockEnd(reason = 'unknown') {
        window.allCodeChunks.push({
            type: 'block_end_marker',
            reason,
            timestamp: Date.now()
        });
    }
    
    /**
     * Reset all code tracking
     */
    resetAllTracking() {
        window.allCodeChunks = [];
        window.completeCodeBlockTracking = '';
        console.log("Code chunk tracking reset");
    }
    
    /**
     * Get all tracked code chunks
     * @returns {Array} Array of tracked code chunks
     */
    getAllChunks() {
        return window.allCodeChunks || [];
    }
    
    /**
     * Get complete code block tracking
     * @returns {string} Complete code block content
     */
    getCompleteTracking() {
        return window.completeCodeBlockTracking || '';
    }
    
    /**
     * Group code chunks into logical blocks
     * @returns {Array} Array of code blocks, each containing an array of chunks
     */
    getCodeBlocks() {
        const blocks = [];
        let currentBlock = [];
        
        (window.allCodeChunks || []).forEach(chunk => {
            if (chunk.type === 'block_end_marker' || chunk.type === 'reset_code_execution') {
                if (currentBlock.length > 0) {
                    blocks.push({
                        chunks: currentBlock,
                        language: currentBlock[0].language || 'unknown',
                        timestamp: currentBlock[0].timestamp
                    });
                    currentBlock = [];
                }
            } else if (chunk.isNewBlock && currentBlock.length > 0) {
                blocks.push({
                    chunks: currentBlock,
                    language: currentBlock[0].language || 'unknown',
                    timestamp: currentBlock[0].timestamp
                });
                currentBlock = [chunk];
            } else {
                currentBlock.push(chunk);
            }
        });
        
        // Add the last block if there is one
        if (currentBlock.length > 0) {
            blocks.push({
                chunks: currentBlock,
                language: currentBlock[0].language || 'unknown',
                timestamp: currentBlock[0].timestamp
            });
        }
        
        return blocks;
    }
}

export default CodeChunkTracker;
