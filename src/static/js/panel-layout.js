/**
 * Panel Layout Manager - Handles the new right-side collapsible panel system
 * Includes integration with the panel pop-out functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Main layout elements
    const sidebar = document.getElementById('sidebar');
    const contentArea = document.querySelector('.content-area');
    const chatPanel = document.querySelector('.chat-panel');
    const panelsContainer = document.querySelector('.panels-container');
    const togglePanelsButton = document.getElementById('toggle-panels-container');
      // Panel elements - add any new panels here
    const avatarPanel = document.getElementById('avatar-panel');
    const codePanel = document.getElementById('code-panel');
    const outputPanel = document.getElementById('output-panel');
    const knowledgePanel = document.getElementById('knowledge-panel');
    const historyPanel = document.getElementById('history-panel');
    
    // Initialize panels system
    function initPanels() {
        // Set up toggle handlers for each panel
        setupPanelToggle(avatarPanel);
        setupPanelToggle(codePanel);
        setupPanelToggle(outputPanel);
        setupPanelToggle(knowledgePanel);
        setupPanelToggle(historyPanel);
        
        // Set up main panels container toggle
        if (togglePanelsButton) {
            togglePanelsButton.addEventListener('click', function() {
                togglePanelsContainer();
            });
        }
        
        // Apply any saved panel states from local storage
        loadPanelStates();
        
        // Initial resize
        setTimeout(resizePanels, 500);
    }
      // Toggle the entire panels container
    function togglePanelsContainer() {
        if (!panelsContainer) return;
        
        panelsContainer.classList.toggle('collapsed');
        
        // Update toggle button icon
        const icon = togglePanelsButton.querySelector('i');
        if (panelsContainer.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        } else {
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
            
            // If expanding panels container, check if avatar needs to be initialized
            if (window.avatarManager && avatarPanel && !avatarPanel.classList.contains('collapsed')) {
                setTimeout(() => window.avatarManager.ensureAvatarPanelVisible(), 300);
            }
        }
        
        // Save state to local storage
        localStorage.setItem('panelsContainerCollapsed', panelsContainer.classList.contains('collapsed'));
    }
      // Setup toggle handler for an individual panel
    function setupPanelToggle(panelElement) {
        if (!panelElement) return;
        
        const panelId = panelElement.id;
        const panelHeader = panelElement.querySelector('.panel-header');
        const toggleButton = panelElement.querySelector('.panel-toggle-btn');
        const popOutButton = panelElement.querySelector('.panel-pop-out-btn');
        
        // Header click toggles panel
        if (panelHeader) {
            panelHeader.addEventListener('click', function(e) {
                // Don't toggle if clicking another control button
                if (e.target.closest('.panel-controls') && e.target !== toggleButton) {
                    return;
                }
                togglePanel(panelElement);
            });
        }
        
        // Dedicated toggle button
        if (toggleButton) {
            toggleButton.addEventListener('click', function() {
                togglePanel(panelElement);
            });
        }
        
        // Pop-out button to open in new window
        if (popOutButton) {
            popOutButton.addEventListener('click', function() {
                // If we have the panelPopout module, use it
                if (window.panelPopout) {
                    window.panelPopout.popoutPanel(panelId);
                } else {
                    console.error('[PanelLayout] Panel popout module not found');
                }
            });
        }
    }
      // Toggle a specific panel
    function togglePanel(panelElement) {
        if (!panelElement) return;
        
        const panelId = panelElement.id;
        
        // Check if this panel is currently popped out
        if (window.panelPopout && window.panelPopout.isPanelPopped(panelId)) {
            // Focus the popped out window instead of toggling the panel
            window.panelPopout.poppedWindows[panelId].focus();
            return;
        }
        
        panelElement.classList.toggle('collapsed');
        
        // Update toggle button icon
        const toggleButton = panelElement.querySelector('.panel-toggle-btn');
        if (toggleButton) {
            const icon = toggleButton.querySelector('i');
            if (panelElement.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }
        
        // Save panel state to local storage
        localStorage.setItem(panelId + 'Collapsed', panelElement.classList.contains('collapsed'));
          // Special handlers for specific panels
        if (panelId === 'avatar-panel') {
            // Make sure avatar is properly initialized if panel is expanded
            if (!panelElement.classList.contains('collapsed') && window.avatarManager) {
                window.avatarManager.ensureAvatarPanelVisible();
            }
        } else if (panelId === 'code-panel') {
            // Refresh code highlighting when panel is expanded
            if (!panelElement.classList.contains('collapsed')) {
                const codeBlocks = panelElement.querySelectorAll('pre code');
                codeBlocks.forEach(block => {
                    if (window.hljs) window.hljs.highlightBlock(block);
                });
            }
        }
        
        // Resize panels after a short delay to allow transitions
        setTimeout(resizePanels, 350);
    }    // Load saved panel states from local storage
    function loadPanelStates() {
        // Main panels container
        const containerCollapsed = localStorage.getItem('panelsContainerCollapsed') === 'true';
        if (containerCollapsed && panelsContainer) {
            panelsContainer.classList.add('collapsed');
            const icon = togglePanelsButton.querySelector('i');
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        }
        
        // Individual panels
        loadPanelState(avatarPanel);
        loadPanelState(codePanel);
        loadPanelState(outputPanel);
        loadPanelState(knowledgePanel);
        loadPanelState(historyPanel);
        
        // Default state for future panels: start collapsed
        if (knowledgePanel && !localStorage.getItem('knowledge-panelCollapsed')) {
            knowledgePanel.classList.add('collapsed');
            const toggleButton = knowledgePanel.querySelector('.panel-toggle-btn');
            if (toggleButton) {
                const icon = toggleButton.querySelector('i');
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
            localStorage.setItem('knowledge-panelCollapsed', 'true');
        }
        
        if (historyPanel && !localStorage.getItem('history-panelCollapsed')) {
            historyPanel.classList.add('collapsed');
            const toggleButton = historyPanel.querySelector('.panel-toggle-btn');
            if (toggleButton) {
                const icon = toggleButton.querySelector('i');
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
            localStorage.setItem('history-panelCollapsed', 'true');
        }
    }
    
    // Load state for a specific panel
    function loadPanelState(panelElement) {
        if (!panelElement) return;
        
        const panelId = panelElement.id;
        const isCollapsed = localStorage.getItem(panelId + 'Collapsed') === 'true';
        
        if (isCollapsed) {
            panelElement.classList.add('collapsed');
            
            // Update icon
            const toggleButton = panelElement.querySelector('.panel-toggle-btn');
            if (toggleButton) {
                const icon = toggleButton.querySelector('i');
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        }
    }
    
    // Auto resize panels based on available space
    function resizePanels() {
        if (!panelsContainer) return;
        
        // Calculate visible panels and total available height
        const container = panelsContainer.getBoundingClientRect();
        const containerHeight = container.height;
        
        // Get all non-collapsed panels
        const visiblePanels = Array.from(panelsContainer.querySelectorAll('.panel:not(.collapsed)'));
        
        // If there's only the avatar panel visible, give it more space
        if (visiblePanels.length === 1 && visiblePanels[0].id === 'avatar-panel') {
            visiblePanels[0].style.height = '300px';
            return;
        }
        
        // Calculate space for code and output panels (if both visible)
        const codeVisible = !codePanel.classList.contains('collapsed');
        const outputVisible = !outputPanel.classList.contains('collapsed');
        
        // If both code and output panels are visible, give them equal space
        if (codeVisible && outputVisible) {
            // Get height of avatar panel
            const avatarHeight = avatarPanel.classList.contains('collapsed') ? 
                42 : parseInt(window.getComputedStyle(avatarPanel).height);
                
            // Calculate remaining space after avatar panel
            const remainingSpace = containerHeight - avatarHeight;
            
            // Calculate height of future panels that are expanded
            const futurePanelsHeight = (knowledgePanel && !knowledgePanel.classList.contains('collapsed') ? 
                parseInt(window.getComputedStyle(knowledgePanel).height) : 0) + 
                (historyPanel && !historyPanel.classList.contains('collapsed') ? 
                parseInt(window.getComputedStyle(historyPanel).height) : 0);
                
            // Calculate height for code and output panels
            const panelHeight = (remainingSpace - futurePanelsHeight) / 2;
            
            // Set equal heights
            if (panelHeight > 100) { // Ensure minimum height
                codePanel.style.height = `${panelHeight}px`;
                outputPanel.style.height = `${panelHeight}px`;
            }
        }
    }
    
    // Listen for resize events and panel toggles to adjust panel sizes
    window.addEventListener('resize', resizePanels);
    
    // Observer for panel visibility changes
    const panelObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const panel = mutation.target;
                if (panel.classList.contains('panel')) {                    // Check if the collapsed class was added or removed
                    if (panel.classList.contains('collapsed') || 
                        !panel.previousClassList || 
                        panel.previousClassList.includes('collapsed') !== panel.classList.contains('collapsed')) {
                          // Store current class list for future comparison
                        // Using an array instead of DOMTokenList which shouldn't be directly instantiated
                        panel.previousClassList = Array.from(panel.classList);
                        
                        // Resize panels after a short delay to allow transitions
                        setTimeout(resizePanels, 350);
                    }
                }
            }
        });
    });
    
    // Observe all panels for class changes
    document.querySelectorAll('.panel').forEach(panel => {
        panelObserver.observe(panel, { attributes: true });
    });
    
    // Initialize the panels system
    initPanels();
});
