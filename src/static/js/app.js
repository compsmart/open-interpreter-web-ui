/**
 * Open Interpreter Web Bridge - Main Application
 * 
 * This is the main entry point that connects all the modular components
 * together to create a cohesive application.
 */

// Import modules
import CodeManager from './code/code-manager.js';
import ChatManager from './chat/chat-manager.js';
import UIHandlers from './ui/ui-handlers.js';
import ApiUtils from './utils/api.js';
import ModelsManager from './models/models-manager.js';
import UIUtils from './utils/ui-utils.js';
import CodeChunkTracker from './utils/code-chunk-tracker.js';
import DebugHelpers from './utils/debug-helpers.js';
import HistoryManager from './chat/history-manager.js';
import ThemeManager from './ui/theme-manager.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize keyboard shortcuts (from external file)
    KeyboardShortcuts.init();    // Initialize modules
    const codeManager = new CodeManager();
    const chatManager = new ChatManager(codeManager);
    const uiHandlers = new UIHandlers();
    const modelsManager = new ModelsManager();
    const historyManager = new HistoryManager(chatManager);
    const themeManager = new ThemeManager();
    
    // Initialize code chunk tracker
    const codeChunkTracker = new CodeChunkTracker();
    
    // Load settings and fetch models
    modelsManager.loadSettings();
    
    // Initialize sidebar resize functionality
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        UIUtils.initSidebarResize(sidebar);
    }
      
    // Add global event handlers
    document.addEventListener('keydown', function(e) {
        // Global keyboard shortcuts
        if (e.key === 'Escape') {
            // Close any open dialogs or panels
            const openDialogs = document.querySelectorAll('.confirm-overlay, .modal-overlay');
            if (openDialogs.length > 0) {
                openDialogs.forEach(dialog => {
                    if (dialog.parentNode) {
                        dialog.parentNode.removeChild(dialog);
                    }
                });
                e.preventDefault();
                return;
            }
        }
    });
});
