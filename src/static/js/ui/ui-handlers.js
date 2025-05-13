/**
 * UI Handlers - Manages UI components and interactions
 */

class UIHandlers {
    constructor() {
        // DOM elements
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebarButton = document.getElementById('toggle-sidebar');
        this.shortcutsHelpButton = document.getElementById('shortcuts-help-button');
        this.shortcutsOverlay = document.getElementById('shortcuts-overlay');
        this.closeShortcutsButton = document.getElementById('close-shortcuts');
        
        this.initEventListeners();
    }
    
    /**
     * Initialize event listeners for UI components
     */
    initEventListeners() {
        // Sidebar toggle
        this.toggleSidebarButton.addEventListener('click', () => this.toggleSidebar());
        
        // Shortcuts help
        if (this.shortcutsHelpButton) {
            this.shortcutsHelpButton.addEventListener('click', () => this.toggleShortcutsOverlay());
        }
        
        if (this.closeShortcutsButton) {
            this.closeShortcutsButton.addEventListener('click', () => this.toggleShortcutsOverlay());
        }
        
        if (this.shortcutsOverlay) {
            this.shortcutsOverlay.addEventListener('click', (e) => {
                if (e.target === this.shortcutsOverlay) {
                    this.toggleShortcutsOverlay();
                }
            });
        }
        
        // Add tooltips to message control buttons
        this.setupMessageHoverControls();
        
        // Handle window resize events for UI adjustments
        window.addEventListener('resize', () => this.handleWindowResize());
    }
    
    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        this.sidebar.classList.toggle('collapsed');
    }
    
    /**
     * Toggle shortcuts overlay visibility
     */
    toggleShortcutsOverlay() {
        if (!this.shortcutsOverlay) return;
        
        if (this.shortcutsOverlay.classList.contains('hidden')) {
            this.shortcutsOverlay.classList.remove('hidden');
        } else {
            this.shortcutsOverlay.classList.add('hidden');
        }
    }
    
    /**
     * Setup hover controls for messages
     */
    setupMessageHoverControls() {
        // Add tooltips to message control buttons if tippy.js is available
        if (window.tippy) {
            const deleteButtons = document.querySelectorAll('.delete-btn');
            deleteButtons.forEach(btn => {
                tippy(btn, {
                    content: 'Delete message (Alt+D)',
                    placement: 'top',
                    theme: 'light-border',
                    delay: [500, 0]
                });
            });
            
            const resendButtons = document.querySelectorAll('.resend-btn');
            resendButtons.forEach(btn => {
                tippy(btn, {
                    content: 'Resend message (Alt+R)',
                    placement: 'top',
                    theme: 'light-border',
                    delay: [500, 0]
                });
            });
        }
    }
    
    /**
     * Handle window resize events
     */
    handleWindowResize() {
        // Adjust UI based on window size
        if (window.innerWidth < 768) {
            // Mobile view adjustments
            if (!this.sidebar.classList.contains('collapsed')) {
                this.sidebar.classList.add('collapsed');
            }
        }
    }
    
    /**
     * Show a confirmation dialog
     * @param {string} title Dialog title
     * @param {string} message Dialog message
     * @param {Function} confirmAction Action to perform on confirmation
     * @param {string} confirmText Text for confirm button
     * @param {string} confirmClass Additional CSS class for confirm button
     */
    showConfirmDialog(title, message, confirmAction, confirmText = 'Confirm', confirmClass = '') {
        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog';
        
        // Create dialog content
        const dialogContent = document.createElement('div');
        dialogContent.className = 'confirm-dialog-content';
        
        // Add title and message
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        dialogContent.appendChild(titleElement);
        
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        dialogContent.appendChild(messageElement);
        
        // Add buttons
        const buttons = document.createElement('div');
        buttons.className = 'confirm-dialog-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'confirm-dialog-cancel';
        cancelButton.textContent = 'Cancel';
        cancelButton.onclick = () => document.body.removeChild(overlay);
        buttons.appendChild(cancelButton);
        
        const confirmButton = document.createElement('button');
        confirmButton.className = `confirm-dialog-confirm ${confirmClass}`;
        confirmButton.textContent = confirmText;
        confirmButton.onclick = () => {
            confirmAction();
            document.body.removeChild(overlay);
        };
        buttons.appendChild(confirmButton);
        
        dialogContent.appendChild(buttons);
        overlay.appendChild(dialogContent);
        document.body.appendChild(overlay);
        
        // Focus the cancel button by default (safer option)
        cancelButton.focus();
    }
    
    /**
     * Handles message selection with keyboard shortcuts
     * @param {Event} event Keyboard event
     * @param {string} action Action to perform ('delete' or 'resend')
     */
    activateMessageControls(event, action) {
        // Find the message element that's nearest to the cursor or viewport center
        const messages = Array.from(document.querySelectorAll('.message'));
        if (!messages.length) return;
        
        // Find message closest to cursor or viewport center
        let targetMessage;
        
        // If the cursor is over a message, use that one
        for (const msg of messages) {
            const rect = msg.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (isVisible && 
                event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom) {
                targetMessage = msg;
                break;
            }
        }
        
        // If no message found under cursor, use message closest to viewport center
        if (!targetMessage) {
            const viewportCenter = window.innerHeight / 2;
            let closestDistance = Infinity;
            
            for (const msg of messages) {
                const rect = msg.getBoundingClientRect();
                const center = rect.top + rect.height / 2;
                const distance = Math.abs(center - viewportCenter);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    targetMessage = msg;
                }
            }
        }
        
        // Apply the action to the found message
        if (targetMessage) {
            // Briefly highlight the message to show it's being operated on
            targetMessage.classList.add('message-flash');
            setTimeout(() => targetMessage.classList.remove('message-flash'), 300);
            
            // Perform the action
            if (action === 'delete') {
                const deleteEvent = new CustomEvent('message-delete', { detail: { messageDiv: targetMessage } });
                document.dispatchEvent(deleteEvent);
            } else if (action === 'resend' && targetMessage.dataset.role === 'user') {
                const resendEvent = new CustomEvent('message-resend', { detail: { messageDiv: targetMessage } });
                document.dispatchEvent(resendEvent);
            }
        }
    }
}

export default UIHandlers;
