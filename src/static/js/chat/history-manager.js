/**
 * History Manager - Handles chat history functionality
 */
import ApiUtils from '../utils/api.js';
import UIUtils from '../utils/ui-utils.js';

class HistoryManager {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.sidebarHistoryContainer = document.getElementById('history-container');
        
        // Initialize
        this.loadHistory();
    }
    
    /**
     * Load chat history from the server
     */
    async loadHistory() {
        if (!this.sidebarHistoryContainer) return;
        
        try {
            const historyData = await ApiUtils.fetchHistory();
            this.renderHistory(historyData);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }
    
    /**
     * Render history items in the sidebar
     * @param {Array} historyItems Array of history items
     */
    renderHistory(historyItems) {
        if (!this.sidebarHistoryContainer || !historyItems) return;
        
        // Clear existing history
        this.sidebarHistoryContainer.innerHTML = '';
        
        if (historyItems.length === 0) {
            this.sidebarHistoryContainer.innerHTML = '<div class="no-history">No history yet</div>';
            return;
        }
        
        // Sort history by timestamp (newest first)
        historyItems.sort((a, b) => b.timestamp - a.timestamp);
        
        // Group history items by date
        const groupedHistory = this.groupHistoryByDate(historyItems);
        
        // Render grouped history
        Object.keys(groupedHistory).forEach(dateGroup => {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'history-date-header';
            dateHeader.textContent = dateGroup;
            this.sidebarHistoryContainer.appendChild(dateHeader);
            
            groupedHistory[dateGroup].forEach(item => {
                const historyItem = this.createHistoryItemElement(item);
                this.sidebarHistoryContainer.appendChild(historyItem);
            });
        });
    }
    
    /**
     * Group history items by date
     * @param {Array} historyItems Array of history items
     * @returns {Object} Object with date groups as keys
     */
    groupHistoryByDate(historyItems) {
        const grouped = {};
        
        historyItems.forEach(item => {
            const date = new Date(item.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let dateGroup;
            
            if (date.toDateString() === today.toDateString()) {
                dateGroup = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateGroup = 'Yesterday';
            } else {
                dateGroup = date.toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
            
            if (!grouped[dateGroup]) {
                grouped[dateGroup] = [];
            }
            
            grouped[dateGroup].push(item);
        });
        
        return grouped;
    }
    
    /**
     * Create a history item element
     * @param {Object} item History item data
     * @returns {HTMLElement} The created history item element
     */
    createHistoryItemElement(item) {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // Get the first user message as the title
        const title = this.getHistoryItemTitle(item);
        
        // Format time
        const timeStr = UIUtils.formatTimestamp(item.timestamp);
        
        historyItem.innerHTML = `
            <div class="history-item-title">${title}</div>
            <div class="history-item-time">${timeStr}</div>
            <div class="history-item-actions">
                <button class="history-item-load" title="Load this conversation">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <button class="history-item-delete" title="Delete this conversation">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add click event to load the conversation
        historyItem.querySelector('.history-item-load').addEventListener('click', (e) => {
            e.stopPropagation();
            this.loadConversation(item);
        });
        
        // Add click event to delete the conversation
        historyItem.querySelector('.history-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteConversation(item);
        });
        
        return historyItem;
    }
    
    /**
     * Get a title for a history item based on the first user message
     * @param {Object} item History item data
     * @returns {string} Title for the history item
     */
    getHistoryItemTitle(item) {
        if (!item.messages || item.messages.length === 0) {
            return 'Empty conversation';
        }
        
        // Try to find the first user message
        const firstUserMsg = item.messages.find(msg => msg.role === 'user');
        
        if (firstUserMsg) {
            // Truncate the message if too long
            let title = firstUserMsg.content;
            if (title.length > 40) {
                title = title.substring(0, 40) + '...';
            }
            return title;
        }
        
        return 'Conversation ' + new Date(item.timestamp).toLocaleString();
    }
    
    /**
     * Load a conversation from history
     * @param {Object} item History item to load
     */
    async loadConversation(item) {
        if (confirm('Load this conversation? Current chat will be replaced.')) {
            try {
                await ApiUtils.resetToMessages(item.messages);
                
                // Update the UI
                this.chatManager.loadConversation(item.messages);
                
                // Close sidebar on mobile
                const sidebar = document.getElementById('sidebar');
                if (window.innerWidth < 768 && sidebar) {
                    sidebar.classList.add('collapsed');
                }
            } catch (error) {
                console.error('Error loading conversation:', error);
                alert('Error loading conversation');
            }
        }
    }
    
    /**
     * Delete a conversation from history
     * @param {Object} item History item to delete
     */
    async deleteConversation(item) {
        if (!confirm('Delete this conversation from history?')) return;
        
        try {
            await ApiUtils.deleteConversation(item.id);
            await this.loadHistory(); // Refresh the history list
            UIUtils.showNotification('Conversation deleted', 'success');
        } catch (error) {
            console.error('Error deleting conversation:', error);
            UIUtils.showNotification('Error deleting conversation', 'error');
        }
    }
}

export default HistoryManager;
