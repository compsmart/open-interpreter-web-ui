/**
 * Message Processor - Handles processing of streaming message chunks
 */

class MessageProcessor {
    constructor(codeManager) {
        // Dependencies
        this.codeManager = codeManager;
        
        // State
        this.isInCodeBlock = false;
        this.isThinking = false;
        this.thinkingStartTime = 0;
        this.thinkingInterval = null;
        this.thinkingHandler = null;
    }
    
    /**
     * Speak the AI response text using the speech manager
     * @param {string} markdownText The markdown text to speak
     */
    speakResponseText(markdownText) {
        // Don't speak if speechManager is not available
        if (!window.speechManager) {
            console.error('[MessageProcessor] speechManager not available');
            return;
        }
        
        // Extract text content from markdown, removing code blocks and handling other markdown elements
        const textToSpeak = this.extractPlainTextFromMarkdown(markdownText);
        
        // If there's text to speak, send it to the speech manager
        if (textToSpeak.trim()) {
            console.log('[MessageProcessor] Speaking response:', textToSpeak.substring(0, 50) + '...');
            window.speechManager.speakText(textToSpeak);
        }
    }
    
    /**
     * Extract plain text from markdown, removing code blocks and formatting
     * @param {string} markdown The markdown text
     * @returns {string} Plain text suitable for speech
     */
    extractPlainTextFromMarkdown(markdown) {
        if (!markdown) return '';
        
        // Remove code blocks (anything between triple backticks)
        let text = markdown.replace(/```[\s\S]*?```/g, ' ');
        
        // Remove inline code (anything between single backticks)
        text = text.replace(/`[^`]*`/g, ' ');
        
        // Replace headers with plain text
        text = text.replace(/#+\s*(.*?)(?:\n|$)/g, '$1. ');
        
        // Replace bullet points with simple text
        text = text.replace(/^\s*[-*+]\s+/gm, '• ');
        
        // Replace numbered lists
        text = text.replace(/^\s*\d+\.\s+/gm, '• ');
        
        // Remove markdown link syntax, keep the link text
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        
        // Remove image syntax
        text = text.replace(/!\[([^\]]+)\]\([^)]+\)/g, '');
        
        // Replace HTML elements with their content or remove them
        text = text.replace(/<[^>]*>/g, ' ');
        
        // Replace multiple spaces and newlines with single space
        text = text.replace(/\s+/g, ' ');
        
        return text.trim();
    }
    
    /**
     * Process a stream of message chunks from the server
     * @param {ReadableStreamDefaultReader} reader Stream reader
     * @param {TextDecoder} textDecoder Text decoder for the stream
     * @param {string} buffer Initial buffer content
     * @param {HTMLElement} aiMessageDiv Container for AI message
     * @returns {Promise} Promise that resolves when stream is fully processed
     */
    processStream(reader, textDecoder, buffer, aiMessageDiv) {
        // Get UI components
        const thinkingSection = aiMessageDiv.querySelector('.thinking-section');
        const thinkingContentDiv = thinkingSection.querySelector('.thinking-content');
        const thinkingTimer = thinkingSection.querySelector('.thinking-header span');
        const thinkingToggle = thinkingSection.querySelector('.thinking-toggle');
        const contentDiv = aiMessageDiv.querySelector('.markdown-content');
        
        // Message state
        let messageContent = '';
        let thinkingContent = '';
        
        // Create a ThinkingHandler
        this.thinkingHandler = {
            section: thinkingSection,
            contentDiv: thinkingContentDiv,
            timer: thinkingTimer,
            toggle: thinkingToggle,
            startTime: 0,
            interval: null,
            content: '',
            
            start() {
                this.startTime = Date.now();
                this.section.classList.remove('hidden');
                
                // Start a timer to update the thinking duration
                this.interval = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                    this.timer.textContent = elapsed + 's';
                }, 1000);
            },
            
            end() {
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
                
                // Display the final thinking time
                const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
                this.timer.textContent = elapsed + 's';
            },
            
            addContent(content) {
                this.content += content;
                this.contentDiv.innerHTML = marked.parse(this.content);
                this.contentDiv.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightBlock(block);
                });
            },
            
            ensureVisible() {
                if (this.content.trim() !== '' && !this.section.classList.contains('hidden')) {
                    if (this.contentDiv.classList.contains('hidden')) {
                        this.contentDiv.classList.remove('hidden');
                        const icon = this.toggle.querySelector('i');
                        icon.className = 'fas fa-chevron-down';
                    }
                }
            },
            
            cleanup() {
                // Hide thinking section if no thinking content was added
                if (this.content.trim() === '') {
                    this.section.classList.add('hidden');
                }
                
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
            }
        };
        
        // Function to process chunks from the stream
        const processChunk = ({ done, value }) => {
            if (done) {
                console.log('Stream complete');
                
                // Close any open code blocks
                if (this.isInCodeBlock) {
                    messageContent += '\n```';
                    contentDiv.innerHTML = marked.parse(messageContent);
                    contentDiv.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                }
                
                // Clean up thinking mode if still active
                if (this.isThinking) {
                    this.isThinking = false;
                    this.thinkingHandler.end();
                }
                
                // Make sure thinking section is visible if it has content
                this.thinkingHandler.ensureVisible();
                
                // Output code chunk debug info at the end of streaming
                console.log("======= CODE CHUNK ANALYSIS =======");
                console.log("Total code chunks received:", window.allCodeChunks.length);
                
                // Extract potential code blocks from message content
                const extractedCodeBlocks = this.codeManager.extractCodeBlocksFromMessages();
                if (extractedCodeBlocks.length > 0) {
                    console.log("Extracted code blocks from message chunks:", extractedCodeBlocks.length);
                    
                    // Add these extracted blocks to our tracking
                    window.allCodeChunks = [...window.allCodeChunks, ...extractedCodeBlocks];
                    console.log("Total code chunks after extraction:", window.allCodeChunks.length);
                }
                
                return;
            }
            
            // Decode the chunk and add it to our buffer
            buffer += textDecoder.decode(value, { stream: true });
            
            // Process any complete SSE events (format: "data: {...}\n\n")
            const events = buffer.split('\n\n');
            buffer = events.pop() || ''; // Keep the last incomplete event in the buffer
            
            for (const event of events) {
                if (!event.trim()) continue; // Skip empty events
                
                // Extract data from SSE format
                const dataMatch = event.match(/data: (.*)/);
                if (!dataMatch) continue;
                
                const eventData = dataMatch[1];
                  // Handle the special [DONE] event
                if (eventData === '[DONE]') {
                    console.log('Stream completed with DONE signal');
                    
                    // Close any open code blocks
                    if (this.isInCodeBlock) {
                        messageContent += '\n```';
                        contentDiv.innerHTML = marked.parse(messageContent);
                        contentDiv.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightBlock(block);
                        });
                    }
                    
                    // Clean up thinking mode if still active
                    if (this.isThinking) {
                        this.isThinking = false;
                        this.thinkingHandler.end();
                    }
                    
                    // Make sure thinking section is visible if it has content
                    this.thinkingHandler.ensureVisible();
                    
                    // Speak the message text using the avatar (extract plain text from messageContent)
                    this.speakResponseText(messageContent);

                    return;
                }
                
                // Special message for debugging code chunks - shows full chunk analysis
                if (eventData === '[DEBUG_CODE_CHUNKS]') {
                    console.log("======= CODE CHUNK ANALYSIS =======");
                    console.log("Total code chunks received:", window.allCodeChunks.length);
                    
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
                    
                    // Count message-embedded blocks vs regular code blocks
                    const embeddedBlocks = window.allCodeChunks.filter(c => c.isInMessageChunk || c.extractedFromMessage);
                    if (embeddedBlocks.length > 0) {
                        console.log("Code blocks embedded in message chunks:", embeddedBlocks.length);
                    }
                    
                    // Log information about each block
                    blocks.forEach((block, index) => {
                        const content = block.chunks.map(c => c.content).join('');
                        console.log(`Block ${index + 1}: ${block.chunks.length} chunks, total length: ${block.totalLength}`);
                        
                        // Identify the source of this block (message or code chunk)
                        const isEmbedded = block.chunks.some(c => c.isInMessageChunk || c.extractedFromMessage);
                        console.log(`Block source: ${isEmbedded ? 'Embedded in message' : 'Direct code chunk'}`);
                        
                        // Show the code content
                        console.log("Block content:", content);
                    });
                    console.log("===================================");
                    
                    // Reset for next conversation
                    window.allCodeChunks = [];
                    window.completeCodeBlockTracking = '';
                    
                    return;
                }
                
                // Parse the data
                try {
                    const chunk = JSON.parse(eventData);
                    
                    // Handle thinking mode
                    if (chunk.type === 'thinking_start') {
                        this.isThinking = true;
                        this.thinkingHandler.start();
                        continue;
                    } else if (chunk.type === 'thinking_end') {
                        this.isThinking = false;
                        this.thinkingHandler.end();
                        continue;
                    }
                    
                    // Process different types of chunks
                    if (typeof chunk === 'object') {
                        if (chunk.type === 'message') {
                            const content = chunk.content || '';
                            
                            // Detect if this message chunk might contain code block markers
                            // This helps track code blocks embedded in message chunks
                            if (content.includes('```python') || content.includes('```bash') || 
                                content.includes('```javascript') || content.includes('```js') ||
                                content.includes('```')) {
                                
                                console.log("Detected potential code block in message chunk:", content);
                                
                                // Track this as a potential code chunk for our debugging
                                window.allCodeChunks.push({
                                    content: content,
                                    language: content.includes('```python') ? 'python' :
                                             content.includes('```javascript') || content.includes('```js') ? 'javascript' :
                                             content.includes('```bash') ? 'bash' : 'plaintext',
                                    isInMessageChunk: true,
                                    timestamp: Date.now()
                                });
                                
                                // Add to our complete tracking
                                window.completeCodeBlockTracking += content;
                            }
                            
                            // Check if this is a new message or follows code execution
                            const isNewMessage = chunk.is_new_block || 
                                             chunk.isNewBlock || 
                                             chunk.new_message || 
                                             chunk.new_message_after_code;
                            
                            if (isNewMessage && !this.isThinking) {
                                // Close any open code blocks from previous messages
                                if (this.isInCodeBlock) {
                                    messageContent += '\n```';
                                    this.isInCodeBlock = false;
                                }
                                
                                // Add extra spacing after code execution for better readability
                                if (chunk.new_message_after_code) {
                                    console.log("Adding new message after code execution");
                                    
                                    // Render the current message content first
                                    if (messageContent.trim()) {
                                        contentDiv.innerHTML = marked.parse(messageContent);
                                        contentDiv.querySelectorAll('pre code').forEach((block) => {
                                            hljs.highlightBlock(block);
                                        });
                                        
                                        // Create a new content div with clear separation for the next message
                                        const newContentDiv = document.createElement('div');
                                        newContentDiv.className = 'markdown-content new-after-code';
                                        newContentDiv.style.marginTop = '15px'; // Add extra spacing
                                        newContentDiv.style.borderTop = '1px solid rgba(0,0,0,0.1)';
                                        newContentDiv.style.paddingTop = '10px';
                                        
                                        aiMessageDiv.appendChild(newContentDiv);
                                        contentDiv = newContentDiv; // Update reference to the new content div
                                        messageContent = ''; // Reset message content for new div
                                        
                                        console.log("Created new message block after code execution");
                                    }
                                }
                                // For regular new messages
                                else if (messageContent.trim()) {
                                    contentDiv.innerHTML = marked.parse(messageContent);
                                    contentDiv.querySelectorAll('pre code').forEach((block) => {
                                        hljs.highlightBlock(block);
                                    });
                                    
                                    // Create a new content div for the next message
                                    const newContentDiv = document.createElement('div');
                                    newContentDiv.className = 'markdown-content';
                                    aiMessageDiv.appendChild(newContentDiv);
                                    contentDiv = newContentDiv; // Update reference to the new content div
                                    messageContent = ''; // Reset message content for new div
                                    
                                    console.log("Created new message block");
                                }
                            }
                           
                            if (this.isThinking) {
                                // Add to thinking content
                                thinkingContent += content;
                                this.thinkingHandler.addContent(content);
                            } else {
                                // Add to normal message content
                                messageContent += content;
                            }                            
                        } else if (chunk.type === 'code') {
                            // Only add to message content if we're not skipping chat display
                            if (!chunk.skip_chat) {
                                // Start code block in the message content if not already in one
                                if (!this.isInCodeBlock) {
                                    if (this.isThinking) {
                                        thinkingContent += '```' + (chunk.language || '') + '\n';
                                        this.thinkingHandler.addContent('```' + (chunk.language || '') + '\n');
                                    } else {
                                        messageContent += '```' + (chunk.language || '') + '\n';
                                    }
                                    this.isInCodeBlock = true;
                                }
                                
                                // Add content to the appropriate message area
                                if (this.isThinking) {
                                    thinkingContent += chunk.content || '';
                                    this.thinkingHandler.addContent(chunk.content || '');
                                } else {
                                    messageContent += chunk.content || '';
                                }
                                
                                // If this is the end of the code block, close it in the message
                                if (chunk.is_end || chunk.isEnd) {
                                    this.isInCodeBlock = false;
                                    if (this.isThinking) {
                                        thinkingContent += '\n```';
                                        this.thinkingHandler.addContent('\n```');
                                    } else {
                                        messageContent += '\n```';
                                    }
                                    console.log("Code block completed in chat");
                                }
                            }
                              
                            // Always update the code panel with the code content regardless of skip_chat
                            if (chunk.content && !this.isThinking) { 
                                // Track this code chunk for debugging
                                this.codeManager.trackCodeChunk({
                                    content: chunk.content,
                                    language: chunk.language || 'plaintext',
                                    isNewBlock: chunk.is_new_block || chunk.isNewBlock || false,
                                    isEnd: chunk.is_end || chunk.isEnd || false
                                });

                                console.log("Updating code panel with code chunk:", chunk);

                                // Check if this is a new code block for the panel
                                if (chunk.is_new_block || chunk.isNewBlock) {
                                    // This is a new code block for the panel. Reset everything.
                                    this.codeManager.resetCodeExecution();
                                    
                                    // Update the code panel
                                    this.codeManager.updatePanel(chunk.content, chunk.language || 'plaintext', '');
                                } else {
                                    // This is a continuation of the current code block
                                    this.codeManager.updatePanel(chunk.content, chunk.language);
                                }

                                // If this chunk indicates the end of the code block stream for the panel
                                if (chunk.is_end || chunk.isEnd) {
                                    console.log("Code block stream ended for panel");
                                }
                            }
                        } else if (chunk.type === 'output') {
                            // Check if this is a new output
                            const isNewOutput = chunk.is_new_block || chunk.isNewBlock;
                            
                            // Only add output to chat if we're not skipping it
                            if (!chunk.skip_chat) {
                                // Ensure we're in a code block for output in the message
                                if (!this.isInCodeBlock) {
                                    if (this.isThinking) {
                                        thinkingContent += '```\n';
                                        this.thinkingHandler.addContent('```\n');
                                    } else {
                                        messageContent += '```\n';
                                    }
                                    this.isInCodeBlock = true;
                                }
                                
                                if (this.isThinking) {
                                    thinkingContent += '// Output:\n' + (chunk.content || '');
                                    this.thinkingHandler.addContent('// Output:\n' + (chunk.content || ''));
                                } else {
                                    // For chat message, separate the output with a comment
                                    messageContent += '// Output:\n' + (chunk.content || '');
                                }
                                
                                // If this is the end of the output, we can close the code block in the message
                                if (chunk.is_end || chunk.isEnd) {
                                    this.isInCodeBlock = false;
                                    if (this.isThinking) {
                                        thinkingContent += '\n```';
                                        this.thinkingHandler.addContent('\n```');
                                    } else {
                                        messageContent += '\n```';
                                    }
                                    console.log("Output completed in chat");
                                }
                            }                            // Always update the output panel regardless of skip_chat
                            if (!this.isThinking) {
                                // Update code panel output with proper formatting
                                if (chunk.content && typeof chunk.content === 'string') {
                                    // Format the output properly for the code panel
                                    let formattedOutput = chunk.content.trim();
                                    
                                    // Check for empty output
                                    if (formattedOutput === '') {
                                        console.log("Received empty output chunk");
                                    } 
                                    // Handle console output
                                    else if (formattedOutput.startsWith('// Console:') || chunk.is_console) {
                                        console.log("Processing console output:", formattedOutput);
                                        this.codeManager.updateConsoleOutput(formattedOutput);
                                    } 
                                    // Handle error output
                                    else if (chunk.is_error || formattedOutput.toLowerCase().includes('error')) {
                                        console.log("Processing error output:", formattedOutput);
                                        this.codeManager.updatePanel(null, null, '🔴 ' + formattedOutput);
                                    }
                                    // Handle normal output
                                    else {
                                        console.log("Processing standard output:", formattedOutput.substring(0, 50));
                                        this.codeManager.updatePanel(null, null, formattedOutput);
                                    }
                                }
                            }
                        } else if (chunk.type === 'console') {
                            // Handle console messages (like active line indicators)
                            if (chunk.format === 'active_line') {
                                // Don't add to the message content, just track active line if needed
                                console.log(`Active line: ${chunk.content}`);
                                
                                // We could add a visual indicator of the active line in the code panel
                                if (chunk.content !== null) {
                                    // This indicates which line is currently being executed
                                    console.log(`Executing line ${chunk.content} of the code`);
                                } else {
                                    // null active_line means execution is complete
                                    console.log("Code execution completed");
                                }
                            } else {                                // For other console messages, add them to the output panel, not the chat
                                console.log(`Console message: ${chunk.content}`);
                                  // Add to the output panel using the dedicated console output method
                                if (!this.isThinking && chunk.content) {
                                    // Make sure it has the console prefix
                                    let content = chunk.content.trim();
                                    if (!content.startsWith('// Console:')) {
                                        content = '// Console: ' + content;
                                    }
                                    this.codeManager.updateConsoleOutput(content);
                                }
                            }
                        } else if (chunk.type === 'error') {
                            if (this.isThinking) {
                                thinkingContent += '\n**Error:** ' + (chunk.content || '');
                                this.thinkingHandler.addContent('\n**Error:** ' + (chunk.content || ''));
                            } else {
                                messageContent += '\n**Error:** ' + (chunk.content || '');
                                
                                // Update code panel with error
                                this.codeManager.updatePanel(
                                    null,
                                    null,
                                    '🔴 Error: ' + chunk.content
                                );
                            }
                        } else if (chunk.executing) {
                            // For chunks with executing flag (code execution)
                            if (!this.isInCodeBlock) {
                                const language = chunk.language || '';
                                if (this.isThinking) {
                                    thinkingContent += `\n\`\`\`${language}\n`;
                                    this.thinkingHandler.addContent(`\n\`\`\`${language}\n`);
                                } else {
                                    messageContent += `\n\`\`\`${language}\n`;
                                }
                                this.isInCodeBlock = true;
                            }
                            
                            if (this.isThinking) {
                                thinkingContent += chunk.code || '';
                                this.thinkingHandler.addContent(chunk.code || '');
                            } else {
                                messageContent += chunk.code || '';
                                
                                // Update code panel with code being executed
                                if (chunk.code) {
                                    // Determine if this is a new code execution
                                    const isNewCodeExecution = chunk.isNewExecution || 
                                                           !this.isInCodeBlock;
                                    
                                    // Update the code panel, clearing output only for new code executions
                                    this.codeManager.updatePanel(chunk.code, chunk.language || 'plaintext', 
                                                            isNewCodeExecution ? '' : undefined);
                                }
                            }
                        } else if (chunk.output !== undefined) {
                            // For chunks with output from code execution
                            if (this.isThinking) {
                                thinkingContent += '\n// Output:\n' + chunk.output;
                                this.thinkingHandler.addContent('\n// Output:\n' + chunk.output);
                            } else {
                                messageContent += '\n// Output:\n' + chunk.output;
                                
                                // Update code panel output
                                this.codeManager.updatePanel(
                                    null,
                                    null,
                                    chunk.output
                                );
                            }
                        } else if (chunk.content) {
                            // Default fallback if there's content but unknown type
                            if (this.isThinking) {
                                thinkingContent += chunk.content;
                                this.thinkingHandler.addContent(chunk.content);
                            } else {
                                messageContent += chunk.content;
                            }
                        }
                    } else if (typeof chunk === 'string') {
                        if (this.isThinking) {
                            thinkingContent += chunk;
                            this.thinkingHandler.addContent(chunk);
                        } else {
                            messageContent += chunk;
                        }
                    }
                } catch (error) {
                    console.error('Error parsing event data:', error);
                    // Treat as plain text if not valid JSON
                    if (this.isThinking) {
                        thinkingContent += eventData;
                        this.thinkingHandler.addContent(eventData);
                    } else {
                        messageContent += eventData;
                    }
                }
                
                // Render message with markdown and code highlighting if not in thinking mode
                if (!this.isThinking) {
                    contentDiv.innerHTML = marked.parse(messageContent);
                    
                    // Apply syntax highlighting to code blocks
                    contentDiv.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                }
                
                // Scroll to bottom of chat container
                aiMessageDiv.parentElement.scrollTop = aiMessageDiv.parentElement.scrollHeight;
            }
            
            // Continue reading
            return reader.read().then(processChunk);
        };
        
        // Start reading the stream
        return reader.read().then(processChunk)
            .catch(error => {
                console.error('Error processing stream:', error);
                contentDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
                
                // Clean up thinking mode if still active
                if (this.thinkingHandler) {
                    this.thinkingHandler.cleanup();
                }
            });
    }
}

export default MessageProcessor;
