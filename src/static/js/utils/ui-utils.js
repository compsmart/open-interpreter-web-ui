/**
 * UI Utils - Various UI utility functions
 */

class UIUtils {
    /**
     * Initialize sidebar resizer functionality
     * @param {HTMLElement} sidebar The sidebar element
     */
    static initSidebarResize(sidebar) {
        const resizer = document.getElementById('sidebar-resizer');
        if (!resizer || !sidebar) return;
        
        let isDragging = false;
        let startX, startWidth;
        
        resizer.addEventListener('mousedown', function(e) {
            isDragging = true;
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
            
            document.documentElement.classList.add('resize-active');
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            const width = startWidth + (e.clientX - startX);
            sidebar.style.width = width + 'px';
        });
        
        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                document.documentElement.classList.remove('resize-active');
            }
        });
    }
    
    /**
     * Show a confirmation dialog
     * @param {string} message The confirmation message
     * @returns {Promise<boolean>} Promise that resolves to user's choice
     */
    static async showConfirmDialog(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            
            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';
            dialog.innerHTML = `
                <p>${message}</p>
                <div class="confirm-buttons">
                    <button class="confirm-btn">OK</button>
                    <button class="cancel-btn">Cancel</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // Add event listeners
            const confirmBtn = dialog.querySelector('.confirm-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');
            
            confirmBtn.addEventListener('click', function() {
                document.body.removeChild(overlay);
                resolve(true);
            });
            
            cancelBtn.addEventListener('click', function() {
                document.body.removeChild(overlay);
                resolve(false);
            });
        });
    }
    
    /**
     * Show a temporary notification
     * @param {string} message The notification message
     * @param {string} type The notification type ('success', 'error', 'info')
     * @param {number} duration Duration in milliseconds
     */
    static showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = message;
        
        // Add to notification container or create one
        let container = document.querySelector('.notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remove after duration
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode === container) {
                    container.removeChild(notification);
                }
                
                // Remove container if empty
                if (container.children.length === 0) {
                    document.body.removeChild(container);
                }
            }, 300); // Wait for transition to complete
        }, duration);
    }
    
    /**
     * Format a timestamp to a human-readable string
     * @param {number} timestamp The timestamp to format
     * @returns {string} A formatted date/time string
     */
    static formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const isToday = date.toDateString() === today.toDateString();
        const isYesterday = date.toDateString() === yesterday.toDateString();
        
        let dateStr = '';
        
        if (isToday) {
            dateStr = 'Today';
        } else if (isYesterday) {
            dateStr = 'Yesterday';
        } else {
            dateStr = date.toLocaleDateString();
        }
        
        // Add time
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} at ${timeStr}`;
    }
}

export default UIUtils;
