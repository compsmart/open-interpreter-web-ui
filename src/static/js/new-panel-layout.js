/**
 * New Panel Layout Manager - Handles the side-by-side panel system
 * with avatar panel fixed on the right and only one additional panel allowed
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the panel manager
    const panelManager = new PanelManager();
    
    // Make it available globally
    window.panelManager = panelManager;
});

class PanelManager {
    constructor() {
        // Panel elements
        this.panels = {
            'avatar-panel': document.getElementById('avatar-panel'),
            'code-output-panel': document.getElementById('code-output-panel'),
            'knowledge-panel': document.getElementById('knowledge-panel'),
            'history-panel': document.getElementById('history-panel')
        };
        
        // Panel configuration with metadata
        this.panelConfig = {
            'avatar-panel': { 
                icon: 'fa-robot',
                title: 'AI Avatar', 
                buttonClass: 'avatar-btn',
                visible: true,
                fixed: true, // Avatar panel is fixed on the right
                primary: true, // Always visible when any panel is open
                shrinkChat: true, // This panel should cause chat area to shrink
                externalPanel: true // Panel is positioned outside the chat container
            },
            'code-output-panel': { 
                icon: 'fa-code',
                title: 'Code & Output', 
                buttonClass: 'code-output-btn',
                visible: false,
                shrinkChat: false // This panel can overlap the chat area
            },
            'knowledge-panel': { 
                icon: 'fa-book',
                title: 'Knowledge Base', 
                buttonClass: 'knowledge-btn',
                visible: false,
                shrinkChat: false // This panel can overlap the chat area
            },
            'history-panel': { 
                icon: 'fa-history',
                title: 'Chat History', 
                buttonClass: 'history-btn',
                visible: false,
                shrinkChat: false // This panel can overlap the chat area
            }
        };
          // Container for panels
        this.panelsContainer = document.getElementById('panels-container');
        
        // Chat panel reference
        this.chatPanel = document.querySelector('.chat-panel');
        
        // Track the active secondary panel
        this.activeSecondaryPanel = null;
        
        // Initialize the UI
        this.initUI();
        this.initEventListeners();
        
        // Apply any saved state
        this.loadPanelStates();
        
        // Initialize code output panel resizable functionality
        this.initResizableCodeOutput();
    }
    
    /**
     * Initialize UI elements
     */
    initUI() {
        // Create panel toggle buttons in navbar
        this.createNavbarButtons();
        
        // Initialize panel states (hidden/visible)
        this.updatePanelStates();
    }
    
    /**
     * Create panel toggle buttons in the navigation bar
     */
    createNavbarButtons() {
        // Create container for panel buttons in navbar
        const navbarRightSection = document.querySelector('.right-section');
        
        if (!navbarRightSection) return;
        
        // Create the button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'navbar-panel-buttons';
        
        // Add buttons for each panel
        for (const [panelId, config] of Object.entries(this.panelConfig)) {
            const button = document.createElement('button');
            button.className = `panel-button ${config.buttonClass}`;
            button.dataset.panel = panelId;
            button.innerHTML = `<i class="fas ${config.icon}"></i> ${config.title}`;
            button.addEventListener('click', () => this.togglePanel(panelId));
            
            buttonContainer.appendChild(button);
        }
        
        // Add to navbar before the new chat button
        const newChatButton = document.getElementById('navbar-new-chat');
        if (newChatButton) {
            navbarRightSection.insertBefore(buttonContainer, newChatButton);
        } else {
            navbarRightSection.appendChild(buttonContainer);
        }
    }
    
    /**
     * Initialize event listeners for panel interactions
     */    initEventListeners() {
        // Set up panel header click handlers
        for (const [panelId, panelElement] of Object.entries(this.panels)) {
            if (!panelElement) continue;
            
            // Get panel header
            const panelHeader = panelElement.querySelector('.panel-header');
            
            if (panelHeader) {
                // Click on panel header brings panel to front
                panelHeader.addEventListener('click', (e) => {
                    // Only if not clicking a control button
                    if (!e.target.closest('.panel-controls')) {
                        this.bringPanelToFront(panelId);
                    }
                });
                  // Set up close button in header
                const toggleButton = panelHeader.querySelector('.panel-toggle-btn');
                if (toggleButton) {
                    toggleButton.addEventListener('click', () => {
                        this.hidePanel(panelId);
                        // Update states immediately after hiding
                        this.updatePanelStates();
                        this.updateButtonStates();
                        this.savePanelStates();
                    });
                }
            }
        }
          // Add window resize handler to recalculate panel positions
        window.addEventListener('resize', () => {
            // Update panel positions when window is resized
            this.updatePanelStates();
        });
    }/**
     * Toggle a panel's visibility
     */    togglePanel(panelId) {
        const panel = this.panels[panelId];
        const config = this.panelConfig[panelId];
        if (!panel || !config) return;
        
        // Avatar panel can be toggled independently
        if (panelId === 'avatar-panel') {
            if (this.isPanelVisible(panelId)) {
                this.hidePanel(panelId);
                // When avatar is hidden, adjust secondary panel positions
                if (this.activeSecondaryPanel) {
                    const secondaryPanel = this.panels[this.activeSecondaryPanel];
                    if (secondaryPanel && !this.isPanelPoppedOut(this.activeSecondaryPanel)) {
                        // Move to right edge with transition
                        secondaryPanel.style.transition = 'right var(--panel-transition-speed) ease';
                        secondaryPanel.style.right = '0';
                        // Reset transition after it completes
                        setTimeout(() => {
                            secondaryPanel.style.transition = '';
                        }, 300);
                    }
                }
            } else {
                this.showPanel(panelId);
                // When avatar is shown, adjust secondary panel positions
                if (this.activeSecondaryPanel) {
                    const secondaryPanel = this.panels[this.activeSecondaryPanel];
                    if (secondaryPanel && !this.isPanelPoppedOut(this.activeSecondaryPanel)) {
                        // Move to make space for avatar panel with transition
                        secondaryPanel.style.transition = 'right var(--panel-transition-speed) ease';
                        const avatarPanelWidth = panel.offsetWidth || 400;
                        secondaryPanel.style.right = `${avatarPanelWidth}px`;
                        // Reset transition after it completes
                        setTimeout(() => {
                            secondaryPanel.style.transition = '';
                        }, 300);
                    }
                }
            }
            // Update panel states after toggling the avatar panel
            this.updatePanelStates();
            this.updateButtonStates();
            this.savePanelStates();
            return;
        }
        
        // For other panels, toggle visibility
        if (this.isPanelVisible(panelId)) {
            this.hidePanel(panelId);
        } else {
            this.showPanel(panelId);
        }
        
        // Update button highlight states
        this.updateButtonStates();
        
        // Save state to local storage
        this.savePanelStates();
    }/**
     * Show a panel
     */    showPanel(panelId) {
        const panel = this.panels[panelId];
        const config = this.panelConfig[panelId];
        if (!panel || !config) return;
          // If panel is popped out, focus that window instead
        if (window.panelPopout && window.panelPopout.isPanelPopped(panelId)) {
            // Mark that it's popped out in our tracking
            this.panelConfig[panelId].visible = true;
            this.panelConfig[panelId].poppedOut = true;
            
            // Focus the popped out window
            window.panelPopout.poppedWindows[panelId].focus();
            
            // Update button states to show it's active
            this.updateButtonStates();
            return;
        }
        
        // Handle avatar panel independently since it causes the chat to shrink
        if (panelId === 'avatar-panel') {
            panel.classList.remove('hidden');
            panel.classList.add('visible');
            panel.classList.remove('collapsed');
            panel.style.right = '0';
            panel.style.left = 'auto';
            
            this.panelConfig[panelId].visible = true;
            
            // Reposition any active secondary panels when avatar becomes visible
            if (this.activeSecondaryPanel) {
                const secondaryPanel = this.panels[this.activeSecondaryPanel];
                if (secondaryPanel) {
                    const avatarPanelWidth = panel.offsetWidth || 400;
                    secondaryPanel.style.right = `${avatarPanelWidth}px`;
                }
            }
            
            // Update panel states to adjust chat width
            this.updatePanelStates();
            return;
        }
        
        // For secondary panels, hide any existing secondary panel
        if (this.activeSecondaryPanel && this.activeSecondaryPanel !== panelId) {
            const oldPanel = this.panels[this.activeSecondaryPanel];
            if (oldPanel) {
                oldPanel.classList.remove('visible');
                oldPanel.classList.add('hidden');
                this.panelConfig[this.activeSecondaryPanel].visible = false;
            }
        }
        
        // Set this as the new active secondary panel
        this.activeSecondaryPanel = panelId;
        
        // Make the panel visible
        panel.classList.remove('hidden');
        panel.classList.add('visible');
        panel.classList.remove('collapsed');
        this.panelConfig[panelId].visible = true;
        
        // Special handling for code-output-panel
        if (panelId === 'code-output-panel') {
            this.refreshCodeHighlighting();
        }
          
        // Update panel states and ensure proper positioning
        this.updatePanelStates();
          
        // Force recalculation of panel positions to ensure proper alignment
        if (this.activeSecondaryPanel && this.panels[this.activeSecondaryPanel]) {
            setTimeout(() => {
                // Only adjust based on avatar panel if it's visible
                if (this.isPanelVisible('avatar-panel') && !this.isPanelPoppedOut('avatar-panel')) {
                    const avatarPanelWidth = this.panels['avatar-panel'].offsetWidth || 400;
                    this.panels[this.activeSecondaryPanel].style.right = `${avatarPanelWidth}px`;
                } else {
                    // If avatar panel is hidden or popped out, position secondary panel at right edge
                    this.panels[this.activeSecondaryPanel].style.right = '0';
                }
            }, 10); // Small delay to ensure DOM has updated
        }
    }    /**
     * Hide a panel
     */    hidePanel(panelId) {
        const panel = this.panels[panelId];
        const config = this.panelConfig[panelId];
        if (!panel || !config) return;
        
        // For avatar panel, allow it to be hidden independently
        if (panelId === 'avatar-panel') {
            // Hide with transition
            panel.style.transition = `transform var(--panel-transition-speed) ease`;
            panel.classList.remove('visible');
            panel.classList.add('hidden');
            this.panelConfig[panelId].visible = false;
            
            // Update chat panel width with transition
            if (this.chatPanel) {
                this.chatPanel.style.transition = 'width var(--panel-transition-speed) ease, max-width var(--panel-transition-speed) ease';
                this.chatPanel.style.width = '100%';
                this.chatPanel.style.maxWidth = '100%';
            }
            
            // Reposition any active secondary panels to the right edge when avatar is hidden
            if (this.activeSecondaryPanel) {
                const secondaryPanel = this.panels[this.activeSecondaryPanel];
                if (secondaryPanel && !this.panelConfig[this.activeSecondaryPanel].poppedOut) {
                    secondaryPanel.style.transition = 'right var(--panel-transition-speed) ease';
                    secondaryPanel.style.right = '0'; // Move to right edge
                }
            }
        } 
        // For other panels
        else {
            // Hide the panel
            panel.style.transition = `transform var(--panel-transition-speed) ease`;
            panel.classList.remove('visible');
            panel.classList.add('hidden');
            this.panelConfig[panelId].visible = false;
            
            // If hiding a secondary panel, clear active secondary panel
            if (panelId === this.activeSecondaryPanel) {                
                this.activeSecondaryPanel = null;
            }
        }
        
        // Update panel visibility and chat panel width
        this.updatePanelStates();
        
        // Save state
        this.savePanelStates();
    }
    
    /**
     * Hide all panels except avatar
     */
    hideAllExceptAvatar() {
        for (const panelId in this.panels) {
            if (panelId !== 'avatar-panel') {
                const panel = this.panels[panelId];
                if (panel) {
                    panel.classList.remove('visible');
                    panel.classList.add('hidden');
                }
            }
        }
        
        this.activeSecondaryPanel = null;
        this.updateButtonStates();
        this.savePanelStates();
    }
    
    /**
     * Hide all panels including avatar
     */
    hideAllPanels() {
        for (const panelId in this.panels) {
            const panel = this.panels[panelId];
            if (panel) {
                panel.classList.remove('visible');
                panel.classList.add('hidden');
            }
        }
        
        this.activeSecondaryPanel = null;
        this.updateButtonStates();
        this.savePanelStates();
    }
    
    /**
     * Bring a panel to the front (rightmost position)
     */    bringPanelToFront(panelId) {
        // In our new layout, we just need to show the panel
        // Since there can only be one secondary panel visible
        if (!this.isPanelVisible(panelId)) {
            this.showPanel(panelId);
            return;
        }
        
        // If it's already visible, we don't need to do anything
        // because the panels' positions are fixed in the new layout
        
        // Update any UI indicators
        this.updateButtonStates();
    }    /**
     * Update panel visibility and position based on active panels
     */    updatePanelStates() {
        const avatarVisible = this.isPanelVisible('avatar-panel');
        const avatarPanel = this.panels['avatar-panel'];
        const avatarPoppedOut = this.panelConfig['avatar-panel']?.poppedOut;
        
        // First handle avatar panel, since its visibility affects chat width
        if (avatarPanel) {
            if (avatarVisible && !avatarPoppedOut) {
                // Only show in main window if not popped out
                avatarPanel.classList.remove('hidden');
                avatarPanel.classList.add('visible');
                avatarPanel.style.zIndex = getComputedStyle(document.documentElement).getPropertyValue('--avatar-panel-z-index').trim(); // Higher z-index to always be on right
                avatarPanel.style.right = '0';
                avatarPanel.style.left = 'auto'; // Reset any left positioning
                avatarPanel.style.display = '';
            } else {
                avatarPanel.classList.remove('visible');
                avatarPanel.classList.add('hidden');
                avatarPanel.style.display = 'none';
            }
        }
          // Adjust chat panel width based on avatar panel visibility
        // IMPORTANT: Only avatar panel affects the chat panel width (not other panels)
        if (this.chatPanel) {
            // Reset chat panel width first
            this.chatPanel.style.width = '';
            this.chatPanel.style.maxWidth = '';
            
            // If avatar panel is visible and not popped out, make chat panel shrink
            if (avatarVisible && !avatarPoppedOut) {
                const panelWidth = getComputedStyle(document.documentElement).getPropertyValue('--panel-width').trim();
                this.chatPanel.style.width = `calc(100% - ${panelWidth})`;
                this.chatPanel.style.maxWidth = `calc(100% - ${panelWidth})`;
                // Set margin-right to 0 to ensure it doesn't overlap
                this.chatPanel.style.marginRight = '0';
                
                // Apply transition for smooth resizing
                if (!this.chatPanel.style.transition) {
                    this.chatPanel.style.transition = 'width var(--panel-transition-speed) ease, max-width var(--panel-transition-speed) ease';
                }
                
                // Mark the content area to show we have panels open
                document.querySelector('.content-area').classList.add('with-panel');
            } else {
                // If avatar panel is hidden or popped out, let chat panel take full width
                this.chatPanel.style.width = '100%';
                this.chatPanel.style.maxWidth = '100%';
                this.chatPanel.style.marginRight = '0';
                
                // Remove the with-panel class if no panels are visible
                if (!this.isPanelVisible('avatar-panel') && 
                    !this.activeSecondaryPanel && 
                    document.querySelector('.content-area')) {
                    document.querySelector('.content-area').classList.remove('with-panel');
                }
            }
        }
            
        // Handle secondary panel positioning
        if (this.activeSecondaryPanel) {
            const secondaryPanel = this.panels[this.activeSecondaryPanel];
            const secondaryPoppedOut = this.panelConfig[this.activeSecondaryPanel]?.poppedOut;
            
            if (secondaryPanel) {
                if (!secondaryPoppedOut) {
                    // Only show in main window if not popped out
                    secondaryPanel.classList.remove('hidden');
                    secondaryPanel.classList.add('visible');
                    secondaryPanel.style.zIndex = getComputedStyle(document.documentElement).getPropertyValue('--secondary-panel-z-index').trim(); // Lower z-index than avatar panel
                    secondaryPanel.style.left = 'auto'; // Reset any left positioning
                    secondaryPanel.style.display = '';
                      
                    // Position depends on avatar panel visibility
                    if (avatarVisible && !avatarPoppedOut) {
                        // Move secondary panel to the left of avatar panel
                        const avatarPanelWidth = (avatarPanel.style.display !== 'none') ? 
                            (avatarPanel.offsetWidth || 400) : 400;
                        secondaryPanel.style.right = `${avatarPanelWidth}px`; 
                    } else {
                        // If avatar panel is hidden or popped out, move secondary panel to right edge
                        secondaryPanel.style.right = '0';
                    }
                } else {
                    // Panel is popped out, hide it in the main window
                    secondaryPanel.classList.remove('visible');
                    secondaryPanel.classList.add('hidden');
                    secondaryPanel.style.display = 'none';
                }
            }
        }
        
        // Hide all other panels
        for (const panelId in this.panels) {
            if (panelId !== 'avatar-panel' && panelId !== this.activeSecondaryPanel) {
                const panel = this.panels[panelId];
                if (panel) {
                    panel.classList.remove('visible');
                    panel.classList.add('hidden');
                    panel.style.display = 'none';
                }
            }
        }
        
        // Update button states to reflect current panel visibility
        this.updateButtonStates();
    }
      /**
     * Update the state of the navbar toggle buttons
     */    updateButtonStates() {
        const buttons = document.querySelectorAll('.panel-button');
        
        buttons.forEach(button => {
            const panelId = button.dataset.panel;
            if (this.isPanelVisible(panelId)) {
                button.classList.add('active');
                
                // Add special class for popped out panels
                if (this.isPanelPoppedOut(panelId)) {
                    button.classList.add('popped-out');
                } else {
                    button.classList.remove('popped-out');
                }
            } else {
                button.classList.remove('active');
                button.classList.remove('popped-out');
            }
        });
    }/**
     * Check if a panel is currently visible
     * Note: This returns true even if the panel is popped out in a separate window
     * because logically the panel is still "visible" to the user, just in a different window
     */
    isPanelVisible(panelId) {
        return this.panelConfig[panelId] && this.panelConfig[panelId].visible;
    }
      /**
     * Check if a panel is currently popped out in a separate window
     */
    isPanelPoppedOut(panelId) {
        return this.panelConfig[panelId] && this.panelConfig[panelId].poppedOut;
    }
    
    /**
     * Check if a panel is popped out to a window
     * This method is required for compatibility with the PanelPopout class
     */
    isPanelPopped(panelId) {
        return this.isPanelPoppedOut(panelId);
    }
      /**
     * Save panel states to local storage
     */    savePanelStates() {
        // Create a map of panel IDs to their popped out states
        const poppedOutPanels = {};
        for (const panelId in this.panelConfig) {
            if (this.panelConfig[panelId].poppedOut) {
                poppedOutPanels[panelId] = true;
            }
        }
        
        const state = {
            avatar: this.panelConfig['avatar-panel'].visible,
            activeSecondaryPanel: this.activeSecondaryPanel,
            poppedOutPanels: poppedOutPanels
        };
        
        localStorage.setItem('panelStates', JSON.stringify(state));
    }
    
    /**
     * Load panel states from local storage
     */
    loadPanelStates() {
        try {
            const savedState = localStorage.getItem('panelStates');
            if (savedState) {
                const state = JSON.parse(savedState);
                  // Restore avatar visibility
                this.panelConfig['avatar-panel'].visible = state.avatar;
                
                // Restore active secondary panel
                if (state.activeSecondaryPanel && this.panels[state.activeSecondaryPanel]) {
                    this.activeSecondaryPanel = state.activeSecondaryPanel;
                    this.panelConfig[state.activeSecondaryPanel].visible = true;
                }
                
                // Restore popped out states (but only flag them - actual popped windows can't be restored)
                if (state.poppedOutPanels) {
                    for (const panelId in state.poppedOutPanels) {
                        if (this.panels[panelId] && this.panelConfig[panelId]) {
                            // Note: We mark it as popped out but actual popped windows can't be restored
                            // This ensures the UI shows the correct state even if the windows are gone
                            this.panelConfig[panelId].poppedOut = state.poppedOutPanels[panelId];
                            
                            // Add popped-out class to the panel
                            if (this.panels[panelId]) {
                                this.panels[panelId].classList.add('popped-out');
                            }
                        }
                    }
                }
                
                // Update UI
                this.updatePanelStates();
                this.updateButtonStates();            } else {
                // Default state: show avatar panel only on first run
                this.panelConfig['avatar-panel'].visible = true;
                this.updatePanelStates();
            }
        } catch (error) {
            console.error('[PanelManager] Error loading panel states:', error);
            // Default to just avatar panel on first run or error
            this.panelConfig['avatar-panel'].visible = true;
            this.updatePanelStates();
        }
    }    /**
     * Handle a panel being popped out
     */
    onPanelPoppedOut(panelId) {
        // Mark the panel as visible in our tracking but hide it in the UI
        const panel = this.panels[panelId];
        if (panel) {
            // Keep track that the panel is logically "visible" but hide it visually
            this.panelConfig[panelId].visible = true;
            this.panelConfig[panelId].poppedOut = true;
            
            // Hide the panel visually in the main window
            panel.classList.remove('visible');
            panel.classList.add('hidden');
            panel.classList.add('popped-out');
            panel.style.display = 'none';
            
            // Update button states to show the panel is still active
            this.updateButtonStates();
            
            // If avatar panel is popped out, restore chat panel to full width
            if (panelId === 'avatar-panel') {
                if (this.chatPanel) {
                    // Restore chat panel to full width with animation
                    this.chatPanel.style.transition = 'width var(--panel-transition-speed) ease, max-width var(--panel-transition-speed) ease';
                    this.chatPanel.style.width = '100%';
                    this.chatPanel.style.maxWidth = '100%';
                }
                
                // Move any secondary panel to right edge
                if (this.activeSecondaryPanel && this.panels[this.activeSecondaryPanel]) {
                    const secondaryPanel = this.panels[this.activeSecondaryPanel];
                    secondaryPanel.style.transition = 'right var(--panel-transition-speed) ease';
                    secondaryPanel.style.right = '0';
                }
            }
            
            // If the popped out panel was a secondary panel, update any other panels
            if (panelId !== 'avatar-panel' && panelId === this.activeSecondaryPanel) {
                // Keep track of it being active but adjust UI
                this.updatePanelStates();
            }
        }
    }
      /**
     * Handle a panel being closed after being popped out
     */
    onPanelPoppedIn(panelId) {
        // Restore the panel in the UI if it was previously visible
        const panel = this.panels[panelId];
        if (panel && this.panelConfig[panelId].visible) {
            // Remove the popped out state
            this.panelConfig[panelId].poppedOut = false;
            panel.classList.remove('popped-out');
            
            // Show the panel if it should be visible
            if (panelId === 'avatar-panel' || panelId === this.activeSecondaryPanel) {
                panel.classList.remove('hidden');
                panel.classList.add('visible');
                panel.style.display = '';
            }
            
            // If avatar panel is popped back in, shrink chat panel
            if (panelId === 'avatar-panel' && this.isPanelVisible(panelId)) {
                // Shrink chat panel to make space for avatar panel
                if (this.chatPanel) {
                    const panelWidth = getComputedStyle(document.documentElement).getPropertyValue('--panel-width').trim();
                    this.chatPanel.style.width = `calc(100% - ${panelWidth})`;
                    this.chatPanel.style.maxWidth = `calc(100% - ${panelWidth})`;
                }
                
                // Move any secondary panel to make space for avatar panel
                if (this.activeSecondaryPanel && this.panels[this.activeSecondaryPanel]) {
                    const avatarPanelWidth = panel.offsetWidth || 400;
                    this.panels[this.activeSecondaryPanel].style.right = `${avatarPanelWidth}px`;
                }
            }
            
            // Update the UI
            this.updatePanelStates();
            this.updateButtonStates();
        }
    }

    /**
     * Initialize the resizable functionality for code and output sections
     */
    initResizableCodeOutput() {
        const codeOutputPanel = this.panels['code-output-panel'];
        if (!codeOutputPanel) return;
        
        const codeSection = codeOutputPanel.querySelector('.code-section');
        const outputSection = codeOutputPanel.querySelector('.output-section');
        
        if (!codeSection || !outputSection) return;
        
        // Create resize handle if it doesn't exist
        let resizeHandle = codeOutputPanel.querySelector('.resize-handle');
        if (!resizeHandle) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            
            // Insert between code and output sections
            codeSection.after(resizeHandle);
        }
        
        // Set up resize functionality
        let startY, startHeightCode, startHeightOutput;
        
        const startResize = (e) => {
            startY = e.clientY;
            startHeightCode = codeSection.offsetHeight;
            startHeightOutput = outputSection.offsetHeight;
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault(); // Prevent text selection
        };
        
        const resize = (e) => {
            const deltaY = e.clientY - startY;
            const containerHeight = codeSection.parentElement.offsetHeight - resizeHandle.offsetHeight;
            
            // Calculate new heights (minimum 20%)
            const newHeightCode = Math.min(Math.max(startHeightCode + deltaY, containerHeight * 0.2), containerHeight * 0.8);
            const newHeightOutput = containerHeight - newHeightCode;
            
            // Apply new heights as percentages
            codeSection.style.height = (newHeightCode / containerHeight * 100) + '%';
            outputSection.style.height = (newHeightOutput / containerHeight * 100) + '%';
        };
        
        const stopResize = () => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
        };
        
        resizeHandle.addEventListener('mousedown', startResize);
    }
    
    /**
     * Refresh syntax highlighting in code panel
     */
    refreshCodeHighlighting() {
        const codePanel = this.panels['code-output-panel'];
        if (!codePanel) return;
        
        setTimeout(() => {
            const codeBlocks = codePanel.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                if (window.hljs) window.hljs.highlightBlock(block);
            });
        }, 100);
    }
}
