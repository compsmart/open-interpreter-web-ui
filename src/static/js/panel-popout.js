/**
 * Panel Pop-out - Handles opening panels in separate windows
 */

class PanelPopout {
    constructor() {
        // Keep track of all popped out windows
        this.poppedWindows = {};

        // Initialize when the DOM is ready
        document.addEventListener('DOMContentLoaded', () => this.init());
    }
    init() {
        console.log('[PanelPopout] Initializing panel pop-out functionality');

        // Setup pop-out buttons for each panel
        this.setupPopoutButtons();

        // Setup content observers for syncing popped windows
        this.setupContentObservers();

        // Listen for window unload to close all popped windows when main window closes
        window.addEventListener('beforeunload', () => this.closeAllPoppedWindows());

        // Listen for messages from popped windows
        window.addEventListener('message', (event) => this.handleWindowMessage(event));
    }

    setupPopoutButtons() {
        // Find all pop-out buttons
        const popoutButtons = document.querySelectorAll('.panel-pop-out-btn');

        popoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Find the parent panel
                const panel = e.target.closest('.panel');
                if (panel) {
                    const panelId = panel.id;
                    this.popoutPanel(panelId);
                }
            });
        });
    }

    /**
     * Open a panel in a new window
     */
    popoutPanel(panelId) {
        console.log(`[PanelPopout] Popping out panel: ${panelId}`);

        // If this panel is already popped out, focus that window
        if (this.poppedWindows[panelId] && !this.poppedWindows[panelId].closed) {
            this.poppedWindows[panelId].focus();
            return;
        }

        // Get panel info for the specific panel
        const panelInfo = this.getPanelInfo(panelId);
        if (!panelInfo) {
            console.error(`[PanelPopout] Unknown panel: ${panelId}`);
            return;
        }

        // Open a new window
        const width = panelInfo.defaultWidth || 500;
        const height = panelInfo.defaultHeight || 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const popWindow = window.open('', panelId,
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);

        if (!popWindow) {
            alert('Pop-out window was blocked by your browser. Please allow pop-ups for this site.');
            return;
        }

        // Store reference to the window
        this.poppedWindows[panelId] = popWindow;

        // Set up the popped out window content
        this.setupPoppedWindow(popWindow, panelInfo);

        // Listen for window closing to update our tracking
        popWindow.addEventListener('beforeunload', () => {
            delete this.poppedWindows[panelId];

            // Re-enable the panel in the main window
            this.showPanelInMainWindow(panelId);
        });

        // Hide or collapse the panel in the main window
        this.hidePanelInMainWindow(panelId);
    }

    /**
     * Setup the content of the popped out window
     */
    setupPoppedWindow(popWindow, panelInfo) {
        // Get required HTML and CSS from main window
        const mainStyles = this.getRequiredStyles();

        // Get the panel content from the main window
        const panel = document.getElementById(panelInfo.id);
        const panelContent = panel ? panel.querySelector('.panel-content').innerHTML : '';

        // Create the HTML structure for the popped out window
        const popoutHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${panelInfo.title}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                ${mainStyles}
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                        background-color: var(--bg-color);
                        color: var(--text-color);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    }
                    
                    .popout-panel {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        width: 100%;
                        overflow: hidden;
                    }
                    
                    .popout-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 15px;
                        background-color: var(--bg-darker);
                        border-bottom: 1px solid var(--border-color);
                    }
                    
                    .popout-header h2 {
                        margin: 0;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                    }
                    
                    .popout-header h2 i {
                        margin-right: 8px;
                        color: var(--accent-color);
                    }
                    
                    .popout-content {
                        flex: 1;
                        overflow: auto;
                        padding: 0;
                    }
                      /* Fix for avatar container in pop-out window */
                    .avatar-container, #avatar-display {
                        width: 100% !important;
                        height: 100% !important;
                        min-height: 300px !important;
                    }
                    
                    /* Ensure canvas has proper dimensions in the popped window */
                    #avatar-display canvas {
                        width: 100% !important;
                        height: 100% !important;
                    }
                      /* Avatar controls in pop-out window */
                    .avatar-controls {
                        padding: 10px;
                        background-color: var(--bg-darker);
                        border-top: 1px solid var(--border-color);
                    }
                    
                    /* Avatar controls sections in pop-out window */
                    .avatar-controls-top,
                    .avatar-controls-bottom {
                        padding: 5px 0;
                    }
                    
                    /* Code and output in pop-out window */
                    .code-section, .output-section {
                        height: 100%;
                    }
                </style>
            </head>
            <body>
                <div class="popout-panel">
                    <div class="popout-header">
                        <h2><i class="${panelInfo.icon}"></i> ${panelInfo.title}</h2>
                        <div class="popout-controls">
                            <button class="icon-btn" id="close-popout" title="Close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="popout-content" id="popout-content">
                        ${panelContent}
                    </div>
                </div>
                
                <script>
                    // Close button functionality
                    document.getElementById('close-popout').addEventListener('click', function() {
                        window.close();
                    });
                    
                    // Tell main window that this window is ready
                    window.opener.postMessage({
                        type: 'POPOUT_READY',
                        panelId: '${panelInfo.id}'
                    }, '*');
                    
                    // Handle messages from main window (content updates)
                    window.addEventListener('message', function(event) {
                        if (event.source === window.opener) {
                            const data = event.data;
                              if (data.type === 'UPDATE_CONTENT' && data.panelId === '${panelInfo.id}') {
                                // Update the content
                                document.getElementById('popout-content').innerHTML = data.content;
                                
                                // Special handling for panels
                                if ('${panelInfo.id}' === 'avatar-panel') {
                                    // Tell the main window to handle avatar display in this window
                                    window.opener.postMessage({
                                        type: 'AVATAR_POPPED',
                                        panelId: '${panelInfo.id}'
                                    }, '*');
                                    
                                    // Make sure the avatar container has proper dimensions
                                    const avatarDisplay = document.getElementById('avatar-display');
                                    if (avatarDisplay) {
                                        avatarDisplay.style.width = '100%';
                                        avatarDisplay.style.height = '100%';
                                        avatarDisplay.style.minHeight = '300px';
                                        console.log('[PopoutWindow] Adjusted avatar container dimensions');
                                    }
                                }
                            }
                        }
                    });
                </script>
                
                <!-- Add any panel-specific scripts here -->
                ${panelInfo.additionalScripts || ''}
            </body>
            </html>
        `;

        // Write the HTML to the new window
        popWindow.document.open();
        popWindow.document.write(popoutHtml);
        popWindow.document.close();
    }

    /**
     * Get panel-specific information based on the panel ID
     */
    getPanelInfo(panelId) {
        const panelInfoMap = {
            'avatar-panel': {
                id: 'avatar-panel',
                title: 'AI Avatar',
                icon: 'fas fa-robot',
                defaultWidth: 400,
                defaultHeight: 450,
                additionalScripts: `
                    <script type="importmap">
                    { "imports": {
                        "three": "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js",
                        "three/examples/": "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/",
                        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/",
                        "dompurify": "https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.mjs",
                        "marked": "https://cdn.jsdelivr.net/npm/marked@11.2.0/lib/marked.esm.js",
                        "talkinghead": "https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.1/modules/talkinghead.mjs"
                    } }
                    </script>
                `
            },
            'code-output-panel': {
                id: 'code-output-panel',
                title: 'Code & Output',
                icon: 'fas fa-code',
                defaultWidth: 600,
                defaultHeight: 500,
                additionalScripts: `
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
                `
            },
            'knowledge-panel': {
                id: 'knowledge-panel',
                title: 'Knowledge Base',
                icon: 'fas fa-book',
                defaultWidth: 500,
                defaultHeight: 600
            },
            'history-panel': {
                id: 'history-panel',
                title: 'Chat History',
                icon: 'fas fa-history',
                defaultWidth: 500,
                defaultHeight: 600
            }
        };

        return panelInfoMap[panelId];
    }

    /**
     * Get required CSS styles from the main window
     */
    getRequiredStyles() {
        // Get all style tags and links from the head
        const styleElements = document.querySelectorAll('link[rel="stylesheet"], style');
        let stylesHtml = '';

        // Extract styles we need for the popped out window
        styleElements.forEach(el => {
            if (el.tagName === 'LINK' &&
                (el.href.includes('panel-layout.css') ||
                    el.href.includes('styles.css') ||
                    el.href.includes('code-panel.css') ||
                    el.href.includes('speech-panel.css') ||
                    el.href.includes('future-panels.css') ||
                    el.href.includes('highlight.js') ||
                    el.href.includes('prism') ||
                    el.href.includes('font-awesome'))) {

                stylesHtml += `<link rel="stylesheet" href="${el.href}">`;
            }
        });

        // Add custom root variables
        stylesHtml += `
        <style>
            :root {
                --bg-color: #fff;
                --bg-darker: #f5f5f5;
                --text-color: #333;
                --text-muted: #666;
                --accent-color: #0066cc;
                --border-color: #ddd;
                --animation-speed: 0.2s;
                --code-bg: #1e1e1e;
                --code-text: #f8f8f8;
                --output-bg: #2d2d2d;
                --output-text: #f0f0f0;
            }
            
            @media (prefers-color-scheme: dark) {
                :root {
                    --bg-color: #1e1e1e;
                    --bg-darker: #252525;
                    --text-color: #eaeaea;
                    --text-muted: #aaa;
                    --border-color: #444;
                    --accent-color: #4a9eff;
                    --code-bg: #2d2d2d;
                    --code-text: #f0f0f0;
                    --output-bg: #2d2d2d;
                    --output-text: #f0f0f0;
                }
            }
        </style>`;

        return stylesHtml;
    }
    /**
   * Hide or collapse the panel in the main window
   */
    hidePanelInMainWindow(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            // Add a class to indicate this panel is popped out
            panel.classList.add('popped-out');

            // Update the toggle button icon
            const toggleBtn = panel.querySelector('.panel-toggle-btn');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-times';
                }
            }

            // Update the pop-out button to indicate this is popped out
            const popoutBtn = panel.querySelector('.panel-pop-out-btn');
            if (popoutBtn) {
                popoutBtn.title = 'Focus Popped Window';
                popoutBtn.querySelector('i').className = 'fas fa-external-link-square-alt';
            }

            // Notify panel manager if available
            if (window.panelManager) {
                window.panelManager.onPanelPoppedOut(panelId);
            }
        }
    }
    /**
   * Restore the panel in the main window when the pop-out is closed
   */
    showPanelInMainWindow(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            // Remove the popped-out class
            panel.classList.remove('popped-out');

            // Update the pop-out button
            const popoutBtn = panel.querySelector('.panel-pop-out-btn');
            if (popoutBtn) {
                popoutBtn.title = 'Open in New Window';
                popoutBtn.querySelector('i').className = 'fas fa-external-link-alt';
            }

            // Notify panel manager if available
            if (window.panelManager) {
                window.panelManager.onPanelPoppedIn(panelId);
            }
        }
    }

    /**
     * Send updated content to a popped out window
     */
    updatePoppedWindow(panelId, content) {
        const poppedWindow = this.poppedWindows[panelId];
        if (poppedWindow && !poppedWindow.closed) {
            poppedWindow.postMessage({
                type: 'UPDATE_CONTENT',
                panelId: panelId,
                content: content
            }, '*');
        }
    }
    /**
   * Check if a panel is currently popped out
   */
    isPanelPopped(panelId) {
        return !!this.poppedWindows[panelId] && !this.poppedWindows[panelId].closed;
    }

    /**
     * Set up content observers to sync popped out windows with the main window
     */
    setupContentObservers() {
        console.log('[PanelPopout] Setting up content observers');

        // Observe the avatar panel for changes
        this.observePanelContent('avatar-panel');

        // Observe the code panel for changes
        this.observePanelContent('code-panel');

        // Observe the output panel for changes
        this.observePanelContent('output-panel');
    }

    /**
     * Observe a specific panel's content for changes and sync to popped window
     */
    observePanelContent(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const content = panel.querySelector('.panel-content');
        if (!content) return;

        // Create and configure the observer
        const observer = new MutationObserver((mutations) => {
            // If this panel is popped out, update the popped window
            if (this.isPanelPopped(panelId)) {
                this.updatePoppedWindow(panelId, content.innerHTML);
            }
        });

        // Start observing
        observer.observe(content, { childList: true, subtree: true, characterData: true });
    }      /**
     * Handle messages from popped out windows
     */
    handleWindowMessage(event) {
        // Check if the message is from one of our popped windows
        const isPoppedWindow = Object.values(this.poppedWindows).includes(event.source);
        if (!isPoppedWindow) return;

        const data = event.data;

        if (data.type === 'POPOUT_READY') {
            console.log(`[PanelPopout] Window for ${data.panelId} is ready`);

            // Get the current content and sync it with the new window
            const panel = document.getElementById(data.panelId);
            if (panel) {
                const content = panel.querySelector('.panel-content');
                if (content) {
                    this.updatePoppedWindow(data.panelId, content.innerHTML);
                }
            }
        } else if (data.type === 'POPOUT_CLOSED') {
            console.log(`[PanelPopout] Window for ${data.panelId} was closed`);
            delete this.poppedWindows[data.panelId];
            this.showPanelInMainWindow(data.panelId);
        } else if (data.type === 'POPOUT_RESIZE') {
            // Handle resize event if needed
        } else if (data.type === 'AVATAR_POPPED') {
            console.log(`[PanelPopout] Avatar panel popped, handling avatar resize`);

            // Handle the avatar display in the popped window
            if (data.panelId === 'avatar-panel' && window.avatarManager) {
                const poppedWindow = this.poppedWindows[data.panelId];
                if (poppedWindow) {
                    setTimeout(() => {
                        window.avatarManager.resizeAvatarInPoppedWindow(poppedWindow);
                    }, 300); // Give some time for the DOM to be updated
                }
            }
        }
    }

    /**
     * Close all popped out windows
     */
    closeAllPoppedWindows() {
        Object.values(this.poppedWindows).forEach(window => {
            if (window && !window.closed) {
                window.close();
            }
        });
        this.poppedWindows = {};
    }
}

// Create and export a singleton instance
const panelPopout = new PanelPopout();

// Make it globally available
window.panelPopout = panelPopout;

// Export as module
export default panelPopout;
