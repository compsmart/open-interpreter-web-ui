/**
 * Debug Helpers - Utility functions for debugging
 */

class DebugHelpers {
    /**
     * Show code chunks debug information in the console
     */
    static showCodeChunksDebug() {
        console.log("======= CODE CHUNK DEBUG INFO =======");
        
        if (!window.allCodeChunks || !Array.isArray(window.allCodeChunks)) {
            console.log("No code chunks tracked yet");
            return;
        }
        
        console.log("Total code chunks tracked:", window.allCodeChunks.length);
        
        // Group chunks by blocks (separated by is_new_block=true or block_end_marker)
        let blocks = [];
        let currentBlock = [];
        
        for (const chunk of window.allCodeChunks) {
            if (chunk.type === 'block_end_marker' || chunk.type === 'reset_code_execution') {
                if (currentBlock.length > 0) {
                    blocks.push({
                        chunks: currentBlock, 
                        totalLength: currentBlock.reduce((total, c) => total + (c.content?.length || 0), 0)
                    });
                    currentBlock = [];
                }
            } else if (chunk.isNewBlock) {
                if (currentBlock.length > 0) {
                    blocks.push({
                        chunks: currentBlock,
                        totalLength: currentBlock.reduce((total, c) => total + (c.content?.length || 0), 0)
                    });
                    currentBlock = [chunk];
                } else {
                    currentBlock = [chunk];
                }
            } else {
                currentBlock.push(chunk);
            }
        }
        
        // Add the last block if there is one
        if (currentBlock.length > 0) {
            blocks.push({
                chunks: currentBlock,
                totalLength: currentBlock.reduce((total, c) => total + (c.content?.length || 0), 0)
            });
        }
        
        console.log("Code blocks identified:", blocks.length);
        
        // Check for message-embedded code blocks
        const extractedCodeBlocks = this.extractCodeBlocksFromMessages();
        if (extractedCodeBlocks.length > 0) {
            console.log("Found embedded code blocks in messages:", extractedCodeBlocks.length);
            console.log("Embedded code blocks:", extractedCodeBlocks);
        }
        
        // Log all blocks including normal and extracted
        blocks.forEach((block, index) => {
            console.log(`Block ${index+1} - ${block.chunks.length} chunks, ${block.totalLength} total characters`);
            console.log("First few chunks:", block.chunks.slice(0, 3));
            if (block.chunks.length > 3) {
                console.log(`... and ${block.chunks.length - 3} more chunks`);
            }
        });
        
        console.log("======= END DEBUG INFO =======");
    }
    
    /**
     * Extract code blocks from messages in the chat
     * @returns {Array} Array of extracted code blocks
     */
    static extractCodeBlocksFromMessages() {
        const extractedBlocks = [];
        const chatContainer = document.getElementById('chat-container');
        
        if (!chatContainer) return extractedBlocks;
        
        // Find all code blocks in messages
        const codeBlocks = chatContainer.querySelectorAll('.markdown-content pre code');
        
        codeBlocks.forEach((block, index) => {
            const language = Array.from(block.classList)
                .find(cls => cls.startsWith('language-'))
                ?.replace('language-', '') || 'unknown';
                
            extractedBlocks.push({
                index,
                language,
                content: block.textContent,
                length: block.textContent.length
            });
        });
        
        return extractedBlocks;
    }
    
    /**
     * Register debug commands in window scope
     */
    static registerGlobalCommands() {
        // Add global debug commands
        window.debugCodeChunks = this.showCodeChunksDebug;
        window.extractCodeBlocks = this.extractCodeBlocksFromMessages;
        
        console.log("Debug helpers registered. Available commands:");
        console.log("- debugCodeChunks() - Show code chunk debug info");
        console.log("- extractCodeBlocks() - Extract code blocks from messages");
    }
}

// Auto-register global commands on load
document.addEventListener('DOMContentLoaded', () => {
    DebugHelpers.registerGlobalCommands();
});

export default DebugHelpers;
