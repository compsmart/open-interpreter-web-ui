/**
 * Chat Manager - Handles chat messages and interactions
 */
import MessageProcessor from './message-processor.js';

class ChatManager {
    constructor(codeManager) {
        // DOM elements
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.chatContainer = document.getElementById('chat-container');
        this.newChatButton = document.getElementById('new-chat');
        this.navbarNewChatButton = document.getElementById('navbar-new-chat');
        
        // Dependencies
        this.codeManager = codeManager;
        this.messageProcessor = new MessageProcessor(this.codeManager);
        
        // State
        this.currentEventSource = null;
        
        this.initEventListeners();
    }
    
    /**
     * Initialize event listeners for chat interactions
     */
    initEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.newChatButton.addEventListener('click', () => this.resetChat());
        this.navbarNewChatButton.addEventListener('click', () => this.resetChat());
        
        // Add Enter key handler to input box
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            } else if (e.key === 'Enter' && e.shiftKey && !e.altKey && !e.ctrlKey) {
                // Shift+Enter sends the message too (keyboard shortcut)
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    /**
     * Reset the chat conversation
     */
    resetChat() {
        fetch('/reset', {
            method: 'POST'
        })
        .then(() => {
            this.chatContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Welcome to Open Interpreter Web GUI</h2>
                    <p>Start a conversation by typing a message below.</p>
                </div>
            `;
            
            // Reset code chunk tracking
            this.codeManager.resetAllTracking();
        });
    }
    
    /**
     * Send a message to the chat
     */
    sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;
        
        // Reset code chunk tracking for new conversation
        this.codeManager.resetAllTracking();
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Clear input
        this.userInput.value = '';
        
        // Add loading indicator
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading';
        loadingElement.innerHTML = '<div></div><div></div><div></div>';
        this.chatContainer.appendChild(loadingElement);
        
        // Scroll to bottom
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        
        // Close previous event source if exists
        if (this.currentEventSource) {
            this.currentEventSource.close();
            this.currentEventSource = null;
        }
        
        // Create AI message container
        const aiMessageDiv = this.createAIMessageContainer();
        
        // Remove loading indicator and add AI message div
        if (loadingElement.parentNode === this.chatContainer) {
            this.chatContainer.removeChild(loadingElement);
        }
        this.chatContainer.appendChild(aiMessageDiv);
        
        console.log("Sending chat request with prompt:", message);
        
        // Make API request
        fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ prompt: message })
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to send message to server');
            }
            
            // Process streaming response
            const reader = response.body.getReader();
            const textDecoder = new TextDecoder();
            let buffer = '';
            
            // Start processing the stream
            return this.messageProcessor.processStream(reader, textDecoder, buffer, aiMessageDiv);
        }).catch(error => {
            console.error('Error processing chat:', error);
            const contentDiv = aiMessageDiv.querySelector('.markdown-content');
            if (contentDiv) {
                contentDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
            }
        });
    }
    
    /**
     * Create a container for AI message with thinking section
     * @returns {HTMLElement} The AI message container div
     */
    createAIMessageContainer() {
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message';
        
        // Create a thinking section (initially hidden)
        const thinkingSection = document.createElement('div');
        thinkingSection.className = 'thinking-section hidden';
        
        const thinkingHeader = document.createElement('div');
        thinkingHeader.className = 'thinking-header';
        
        const thinkingToggle = document.createElement('button');
        thinkingToggle.className = 'thinking-toggle';
        thinkingToggle.innerHTML = '<i class="fas fa-chevron-right"></i> Thinking...';
        
        const thinkingTimer = document.createElement('span');
        thinkingTimer.textContent = '0s';
        
        const thinkingContentDiv = document.createElement('div');
        thinkingContentDiv.className = 'thinking-content hidden';

        thinkingHeader.appendChild(thinkingToggle);
        thinkingHeader.appendChild(thinkingTimer);
        thinkingSection.appendChild(thinkingHeader);
        thinkingSection.appendChild(thinkingContentDiv);

        // Toggle thinking content visibility when header is clicked
        thinkingToggle.addEventListener('click', function() {
            thinkingContentDiv.classList.toggle('hidden');
            const icon = thinkingToggle.querySelector('i');
            if (thinkingContentDiv.classList.contains('hidden')) {
                icon.className = 'fas fa-chevron-right';
            } else {
                icon.className = 'fas fa-chevron-down';
            }
        });
        
        // Add thinking section first
        aiMessageDiv.appendChild(thinkingSection);
        
        // Create a content container for AI response
        const contentDiv = document.createElement('div');
        contentDiv.className = 'markdown-content';
        aiMessageDiv.appendChild(contentDiv);
        
        return aiMessageDiv;
    }
    
    /**
     * Add a message to the chat
     * @param {string} role Message role ('user' or 'assistant')
     * @param {string} content Message content
     */
    addMessageToChat(role, content) {
        // Remove welcome message if present
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage && welcomeMessage.parentNode === this.chatContainer) {
            this.chatContainer.removeChild(welcomeMessage);
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.dataset.role = role;
        messageDiv.dataset.content = content;
        
        // Create message controls
        const messageControls = document.createElement('div');
        messageControls.className = 'message-controls';
        
        // Add delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'message-control-btn delete-btn';
        deleteButton.title = 'Delete this message and all subsequent messages';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i><span class="shortcut-badge">Alt+D</span>';
        deleteButton.addEventListener('click', () => this.deleteMessage(messageDiv));
        
        // Add resend button (only for user messages)
        if (role === 'user') {
            const resendButton = document.createElement('button');
            resendButton.className = 'message-control-btn resend-btn';
            resendButton.title = 'Resend this message';
            resendButton.innerHTML = '<i class="fas fa-redo-alt"></i><span class="shortcut-badge">Alt+R</span>';
            resendButton.addEventListener('click', () => this.resendMessage(messageDiv));
            messageControls.appendChild(resendButton);
        }
        
        messageControls.appendChild(deleteButton);
        messageDiv.appendChild(messageControls);
        
        // Add message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'user') {
            // Escape HTML for user content
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = content;
        }
        
        messageDiv.appendChild(contentDiv);
        this.chatContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
    
    /**
     * Delete a message and all messages that come after it
     * @param {HTMLElement} messageDiv Message element to delete
     */
    deleteMessage(messageDiv) {
        this.showConfirmDialog(
            'Delete Message', 
            'Are you sure you want to delete this message and all subsequent messages?',
            () => {
                // Find all messages after this one
                let nextMessage = messageDiv.nextElementSibling;
                while (nextMessage) {
                    const toRemove = nextMessage;
                    nextMessage = nextMessage.nextElementSibling;
                    this.chatContainer.removeChild(toRemove);
                }
                
                // Remove the message itself
                this.chatContainer.removeChild(messageDiv);
                
                // Reset the chat state on the server
                fetch('/reset_to_message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messages: Array.from(this.chatContainer.querySelectorAll('.message'))
                            .map(msg => ({
                                role: msg.dataset.role,
                                content: msg.dataset.content
                            }))
                    })
                });
                
                // Reset code tracking
                this.codeManager.resetAllTracking();
            },
            'Delete',
            'delete'
        );
    }
    
    /**
     * Resend a user message and remove all subsequent messages
     * @param {HTMLElement} messageDiv Message element to resend
     */
    resendMessage(messageDiv) {
        this.showConfirmDialog(
            'Resend Message', 
            'Are you sure you want to resend this message? All subsequent messages will be removed.',
            () => {
                // Get the message content
                const content = messageDiv.dataset.content;
                
                // Delete this message and all subsequent ones
                this.deleteMessage(messageDiv);
                
                // Set the input and send
                this.userInput.value = content;
                this.sendMessage();
            },
            'Resend',
            'resend'
        );
    }
    
    /**
     * Show a confirmation dialog before performing an action
     * @param {string} title Dialog title
     * @param {string} message Dialog message
     * @param {Function} confirmAction Action to perform on confirmation
     * @param {string} confirmText Confirmation button text
     * @param {string} confirmClass CSS class for the confirmation button
     */
    showConfirmDialog(title, message, confirmAction, confirmText = 'Confirm', confirmClass = '') {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        document.body.appendChild(backdrop);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        // Create header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        modalHeader.textContent = title;
        
        // Create body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.textContent = message;
        
        // Create footer with buttons
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'btn btn-secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(backdrop);
            document.body.removeChild(modal);
        });
        
        const confirmButton = document.createElement('button');
        confirmButton.className = `btn btn-primary ${confirmClass}`;
        confirmButton.textContent = confirmText;
        confirmButton.addEventListener('click', () => {
            confirmAction();
            document.body.removeChild(backdrop);
            document.body.removeChild(modal);
        });
        
        // Assemble modal
        modalFooter.appendChild(cancelButton);
        modalFooter.appendChild(confirmButton);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(modalFooter);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Focus the cancel button by default for safety
        cancelButton.focus();
    }
    
    /**
     * Load chat history from the server
     */
    loadHistory() {
        fetch('/history')
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    // Clear welcome message
                    this.chatContainer.innerHTML = '';
                    
                    // Add all messages to chat
                    data.forEach(msg => {
                        if (msg.role && msg.content) {
                            this.addMessageToChat(msg.role, msg.content);
                        }
                    });
                }
            })
            .catch(error => {
                console.error("Error loading chat history:", error);
            });
    }
    
    /**
     * Load a conversation from history into the chat
     * @param {Array} messages Array of message objects
     */
    loadConversation(messages) {
        if (!messages || !Array.isArray(messages)) {
            console.error('Invalid messages format for loading conversation');
            return;
        }
        
        // Clear existing chat content
        this.chatContainer.innerHTML = '';
        
        // Add each message to the UI
        messages.forEach(message => {
            if (message.role === 'user' || message.role === 'assistant') {
                this.addMessageToChat(message.role, message.content);
            }
        });
        
        // Reset code chunk tracking
        this.codeManager.resetAllTracking();
        
        // Scroll to bottom
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
    
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} unsafe Potentially unsafe text
     * @returns {string} Safe HTML text
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

export default ChatManager;
