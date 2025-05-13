/**
 * Code Manager - Handles code execution and display
 */

class CodeManager {    constructor() {
        // DOM elements
        this.codePanel = document.getElementById('code-output-panel');
        this.clearCodePanel = document.getElementById('clear-code-panel');
        this.codeContent = document.getElementById('code-content');
        this.outputContent = document.getElementById('output-content');
        this.debugCodeChunksBtn = document.getElementById('debug-code-chunks');
        
        // State
        this.currentCodeExecution = {
            code: '',
            language: '',
            output: ''
        };
        
        // Make these available globally for debugging
        window.allCodeChunks = [];
        window.completeCodeBlockTracking = '';
        
        this.initEventListeners();
    }
    
    /**
     * Initialize event listeners for code panel
     */
    initEventListeners() {
        // The toggle button no longer exists in the new UI design
        // Instead, panel visibility is controlled by the PanelManager
        
        // Add event listeners only if elements exist
        if (this.clearCodePanel) {
            this.clearCodePanel.addEventListener('click', () => this.clearContent());
        }
        
        if (this.debugCodeChunksBtn) {
            this.debugCodeChunksBtn.addEventListener('click', () => this.showDebugInfo());
        }
    }
      /**
     * Toggle code panel visibility - now handled by PanelManager
     * This is maintained for backward compatibility
     */
    togglePanel() {
        // In the new UI, panels are controlled by PanelManager
        if (window.panelManager) {
            // Use the new panel manager to toggle the code panel
            window.panelManager.togglePanel('code-output-panel');
        }
    }
    
    /**
     * Clear code panel content
     */
    clearContent() {
        this.codeContent.textContent = '';
        this.outputContent.textContent = '';
        this.currentCodeExecution = {
            code: '',
            language: '',
            output: ''
        };
    }
    
    /**
     * Reset code execution tracking
     * Used when a completely new code execution is starting
     */
    resetCodeExecution() {
        // If there was previous code, add a marker to the tracking array
        if (this.currentCodeExecution.code) {
            window.allCodeChunks.push({
                type: 'reset_code_execution',
                previousCode: this.currentCodeExecution.code,
                previousLanguage: this.currentCodeExecution.language,
                timestamp: Date.now()
            });
        }
        
        // Reset the current code execution
        this.currentCodeExecution = {
            code: '',
            language: '',
            output: ''
        };
    }
    
    /**
     * Update the code panel with new content
     * @param {string} code Code content 
     * @param {string} language Programming language
     * @param {string} output Code execution output
     */
    updatePanel(code, language, output) {
        // Update code section if provided
        if (code) {
            // Check if this is a new code execution or if we need to replace everything
            if (output === '') { 
                // Empty output string indicates a reset
                // Reset for a new code execution
                this.currentCodeExecution.code = code;
                this.currentCodeExecution.language = language || 'plaintext';
                this.currentCodeExecution.output = '';
            } else if (language && this.currentCodeExecution.language !== language) {
                // Different language - replace the code
                this.currentCodeExecution.code = code;
                this.currentCodeExecution.language = language;            } else if (code !== this.currentCodeExecution.code && !this.currentCodeExecution.code.includes(code)) {
                // If this is new code that's not already in the panel, append it
                const existingCode = this.currentCodeExecution.code || '';
                
                // Only add a newline if it's clearly a new line of code
                // (starts with a newline, ends with semicolon or bracket, etc.)
                const needsNewline = code.startsWith('\n') || 
                                    existingCode.endsWith(';') || 
                                    existingCode.endsWith('{') || 
                                    existingCode.endsWith('}') ||
                                    existingCode.endsWith('\n');
                                    
                this.currentCodeExecution.code = existingCode + 
                    (needsNewline ? '\n' : '') + 
                    code.replace(/^\n+/, ''); // Remove leading newlines from the new code
            }
            
            // Set the language if provided
            if (language) {
                this.currentCodeExecution.language = language || 'plaintext';
            }
              // Format the code for proper display
            const formattedCode = this.formatCodeForDisplay(this.currentCodeExecution.code);
            
            // Update the display
            this.codeContent.textContent = formattedCode;
            this.codeContent.className = 'code-block';
            if (this.currentCodeExecution.language) {
                this.codeContent.classList.add(`language-${this.currentCodeExecution.language}`);
            }
            
            // Apply syntax highlighting
            if (window.hljs) {
                window.hljs.highlightBlock(this.codeContent);
            }
        }        // Update output section if provided
        if (output !== undefined) {
            this.currentCodeExecution.output = output;
            
            // Format the output properly for display
            if (output.trim() === '') {
                this.outputContent.textContent = '';
            } else {
                // Check for specific output types
                if (output.startsWith('// Console:')) {
                    // For console outputs, use the dedicated method
                    return this.updateConsoleOutput(output);
                } else if (output.includes('Error:') || output.includes('🔴')) {
                    // For error outputs
                    this.outputContent.textContent = output;
                    this.outputContent.className = 'output-block error-output';
                } else {
                    // Standard output
                    this.outputContent.textContent = output;
                    this.outputContent.className = 'output-block';
                }
            }
        }
        
        // Make sure the code panel is visible
        if (this.codePanel.classList.contains('collapsed')) {
            this.togglePanel();
        }
    }
      /**
     * Update the console output specifically
     * @param {string} consoleOutput Console output content
     */
    updateConsoleOutput(consoleOutput) {
        if (!consoleOutput) return;
        
        // Format console output properly
        let formattedOutput = consoleOutput;
        if (!formattedOutput.startsWith('// Console:')) {
            formattedOutput = '// Console: ' + formattedOutput;
        }
        
        // Update the current execution
        this.currentCodeExecution.output = formattedOutput;
        
        // Update the output content display
        this.outputContent.textContent = formattedOutput;
        this.outputContent.className = 'output-block console-output';
        
        // Make sure the code panel is visible
        if (this.codePanel.classList.contains('collapsed')) {
            this.togglePanel();
        }
    }
    
    /**
     * Extract code blocks from markdown-formatted text in message chunks
     * @returns {Array} Array of extracted code blocks
     */
    extractCodeBlocksFromMessages() {
        // We'll rebuild the complete message content from all message chunks
        // Get message content from the chat container's AI messages
        let fullMessageContent = '';
        const aiMessages = document.querySelectorAll('.ai-message .message-content');
        
        // Concatenate content from all AI message elements
        aiMessages.forEach(message => {
            fullMessageContent += message.innerHTML + '\n';
        });
        
        // Extract code blocks using regex
        const codeBlockRegex = /```(\w*)\s*\n([\s\S]*?)\n```/g;
        const extractedBlocks = [];
        let match;
        
        while ((match = codeBlockRegex.exec(fullMessageContent)) !== null) {
            const [fullMatch, language, code] = match;
            
            if (code.trim()) {
                extractedBlocks.push({
                    content: code.trim(),
                    language: language || 'plaintext',
                    extractedFromMessage: true,
                    matchPosition: match.index,
                    timestamp: Date.now()
                });
            }
        }
        
        return extractedBlocks;
    }
    
    /**
     * Show code chunks debug information
     */
    showDebugInfo() {
        console.log("======= CODE CHUNK DEBUG INFO =======");
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
            const content = block.chunks.map(c => c.content || '').join('');
            console.log(`Block ${index + 1}: ${block.chunks.length} chunks, total length: ${block.totalLength}`);
            console.log("Block content:", content);
            console.log("First chunk:", block.chunks[0]);
            if (block.chunks.length > 1) {
                console.log("Last chunk:", block.chunks[block.chunks.length - 1]);
            }
            
            // Check if any chunks in this block were from message content
            const hasEmbeddedChunks = block.chunks.some(c => c.isInMessageChunk || c.extractedFromMessage);
            if (hasEmbeddedChunks) {
                console.log("This block contains code embedded in message chunks!");
            }
        });
        
        // Create a nicely formatted debug message
        const debugMsg = `
        <h3>Code Chunk Analysis</h3>
        <p>Total chunks: ${window.allCodeChunks.length}</p>
        <p>Blocks identified: ${blocks.length}</p>
        <pre>${JSON.stringify(blocks.map(b => ({
            chunkCount: b.chunks.length,
            totalLength: b.totalLength,
            content: b.chunks.map(c => c.content || '').join('').substring(0, 100) + '...'
        })), null, 2)}</pre>`;
        
        // Show in an alert or modal
        alert("Code chunk debug info has been logged to the console.");
        
        console.log("===================================");
    }
    
    /**
     * Add code chunk to tracking
     * @param {Object} chunk Code chunk data
     */
    trackCodeChunk(chunk) {
        if (!chunk.content) return;
        
        window.allCodeChunks.push({
            content: chunk.content,
            language: chunk.language || 'plaintext',
            isNewBlock: chunk.is_new_block || chunk.isNewBlock || false,
            isEnd: chunk.is_end || chunk.isEnd || false,
            timestamp: Date.now()
        });
    }
      /**
     * Reset all code chunk tracking
     * Used when starting a new conversation
     */
    resetAllTracking() {
        // Reset the current code execution
        this.currentCodeExecution = {
            code: '',
            language: '',
            output: ''
        };
        
        // Reset global tracking arrays
        window.allCodeChunks = [];
        window.completeCodeBlockTracking = '';
        
        // Reset UI elements
        this.codeContent.textContent = '';
        this.outputContent.textContent = '';
        this.outputContent.className = 'output-block';
        
        console.log("Code chunk tracking completely reset");
    }

    /**
     * Format code for display in the code panel
     * Handles newlines, indentation, and other formatting concerns
     * @param {string} code The code to format
     * @returns {string} The formatted code
     */
    formatCodeForDisplay(code) {
        if (!code) return '';
        
        // Clean up any extra whitespace at the beginning and end
        let formattedCode = code.trim();
        
        // Check if we have multiple code chunks that need better formatting
        if (formattedCode.includes('\n\n\n')) {
            // Replace excessive newlines with just double newlines
            formattedCode = formattedCode.replace(/\n{3,}/g, '\n\n');
        }
        
        // Handle special cases for different languages
        if (this.currentCodeExecution.language) {
            const language = this.currentCodeExecution.language.toLowerCase();
            
            // Language-specific formatting
            if (['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp'].includes(language)) {
                // Improve block readability for common programming languages
                formattedCode = this.improveCodeBlockFormatting(formattedCode, language);
            }
        }
        
        // Ensure the code doesn't end with multiple newlines
        formattedCode = formattedCode.replace(/\n+$/g, '\n');
        
        return formattedCode;
    }
    
    /**
     * Improve code block formatting for specific languages
     * @param {string} code The code to format
     * @param {string} language The programming language
     * @returns {string} The formatted code
     */
    improveCodeBlockFormatting(code, language) {
        // Split the code into lines
        const lines = code.split('\n');
        
        // Track indentation level
        let indentLevel = 0;
        let formattedLines = [];
        let lastNonEmptyLine = '';
        
        // Process each line
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Skip if we're adding duplicate empty lines
            if (trimmedLine === '' && formattedLines.length > 0 && formattedLines[formattedLines.length - 1].trim() === '') {
                return;
            }
            
            // Skip if this line exactly repeats the previous non-empty line
            if (trimmedLine && trimmedLine === lastNonEmptyLine) {
                return;
            }
            
            // Update our tracking of the last non-empty line
            if (trimmedLine) {
                lastNonEmptyLine = trimmedLine;
            }
            
            // Add the line to our formatted output
            formattedLines.push(line);
        });
        
        return formattedLines.join('\n');
    }
}

export default CodeManager;
