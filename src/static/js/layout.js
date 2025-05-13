/**
 * Layout manager for handling responsive layout changes
 */
document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.getElementById('sidebarX');
    const contentArea = document.querySelector('.content-area');
    const chatPanel = document.querySelector('.chat-panel');
    const codeOutputPanel = document.getElementById('code-output-panel');
    const toggleSidebarButton = document.getElementById('toggle-sidebar');

    // Function to update layout based on sidebar state
    function updateLayout() {
        if (sidebar && contentArea) {
            if (sidebar.classList.contains('collapsed')) {
                contentArea.style.width = '100%';
            } else {
                //contentArea.style.width = 'calc(100% - 300px)';
            }
        }
    }

    // Initial layout setup
    updateLayout();

    // Listen for sidebar toggle events
    if (toggleSidebarButton && sidebar) {
        console.log('[Layout] Found toggle sidebar button:', toggleSidebarButton);

        // Clear any existing event listeners and add a direct onclick handler
        toggleSidebarButton.onclick = function (e) {
            console.log('[Layout] Toggle sidebar button clicked!');
            sidebar.classList.toggle('collapsed');

            // Let the CSS transitions complete before recalculating
            setTimeout(updateLayout, 300);
            return false; // Prevent any default behavior
        };

        console.log('[Layout] Added onclick handler to toggle sidebar button');
    } else {
        console.error('[Layout] Toggle sidebar button or sidebar not found:',
            toggleSidebarButton ? 'Button found' : 'Button missing',
            sidebar ? 'Sidebar found' : 'Sidebar missing');
    }

    // Handle window resize events
    window.addEventListener('resize', function () {
        updateLayout();
    });
});
