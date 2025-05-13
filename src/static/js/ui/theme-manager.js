/**
 * Theme Manager - Handles theme switching and preferences
 */
class ThemeManager {
    constructor() {
        this.themeToggleBtn = document.getElementById('theme-toggle');
        this.availableThemes = ['light', 'dark', 'system'];
        this.currentTheme = localStorage.getItem('theme') || 'system';
        
        this.initTheme();
        this.initEventListeners();
    }
    
    /**
     * Initialize theme based on stored preferences
     */
    initTheme() {
        // Set theme from stored preference
        this.applyTheme(this.currentTheme);
        
        // Update button state
        this.updateToggleButton();
        
        // Listen for system preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if (this.currentTheme === 'system') {
                    this.applySystemTheme();
                }
            });
        }
    }
    
    /**
     * Initialize event listeners
     */
    initEventListeners() {
        if (!this.themeToggleBtn) return;
        
        this.themeToggleBtn.addEventListener('click', () => {
            this.cycleTheme();
        });
    }
    
    /**
     * Cycle through available themes
     */
    cycleTheme() {
        const currentIndex = this.availableThemes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.availableThemes.length;
        const nextTheme = this.availableThemes[nextIndex];
        
        this.setTheme(nextTheme);
    }
    
    /**
     * Set and apply a specific theme
     * @param {string} theme Theme name ('light', 'dark', or 'system')
     */
    setTheme(theme) {
        if (!this.availableThemes.includes(theme)) return;
        
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        
        this.applyTheme(theme);
        this.updateToggleButton();
    }
    
    /**
     * Apply the selected theme to the document
     * @param {string} theme Theme name to apply
     */
    applyTheme(theme) {
        if (theme === 'system') {
            this.applySystemTheme();
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }
    
    /**
     * Apply theme based on system preference
     */
    applySystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }
    
    /**
     * Update the toggle button icon and title
     */
    updateToggleButton() {
        if (!this.themeToggleBtn) return;
        
        const icon = this.themeToggleBtn.querySelector('i');
        if (!icon) return;
        
        // Remove all previous classes
        icon.className = 'fas';
        
        // Set icon based on current theme
        switch (this.currentTheme) {
            case 'light':
                icon.classList.add('fa-sun');
                this.themeToggleBtn.title = 'Light theme';
                break;
            case 'dark':
                icon.classList.add('fa-moon');
                this.themeToggleBtn.title = 'Dark theme';
                break;
            case 'system':
                icon.classList.add('fa-desktop');
                this.themeToggleBtn.title = 'System theme';
                break;
        }
    }
}

export default ThemeManager;
