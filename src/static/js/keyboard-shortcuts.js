/**
 * Keyboard shortcuts for the Open Interpreter Web Bridge
 * This module handles keyboard shortcuts for common operations
 */

let KeyboardShortcuts = {
    // Map of active keyboard shortcuts
    activeShortcuts: new Map(),

    // Initialize shortcuts
    init() {
        console.log('Initializing keyboard shortcuts');
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    },
    
    // Register a new shortcut with optional requirement for modifier keys
    register(key, callback, options = {}) {
        const shortcut = {
            key: key.toLowerCase(),
            ctrl: options.ctrl || false,
            alt: options.alt || false,
            shift: options.shift || false,
            description: options.description || '',
            callback: callback
        };
        
        const shortcutId = this.generateId(shortcut);
        this.activeShortcuts.set(shortcutId, shortcut);
        console.log(`Registered keyboard shortcut: ${shortcutId} - ${shortcut.description}`);
        return shortcutId;
    },
    
    // Unregister a shortcut by ID
    unregister(shortcutId) {
        if (this.activeShortcuts.has(shortcutId)) {
            const shortcut = this.activeShortcuts.get(shortcutId);
            this.activeShortcuts.delete(shortcutId);
            console.log(`Unregistered keyboard shortcut: ${shortcutId} - ${shortcut.description}`);
            return true;
        }
        return false;
    },
    
    // Handle keydown events
    handleKeyDown(event) {
        // Skip if in an input, textarea, or contenteditable
        if (this.isEditableElement(event.target)) {
            return;
        }
        
        const pressedKey = event.key.toLowerCase();
        
        // Check all registered shortcuts
        this.activeShortcuts.forEach((shortcut) => {
            if (shortcut.key === pressedKey &&
                shortcut.ctrl === event.ctrlKey &&
                shortcut.alt === event.altKey &&
                shortcut.shift === event.shiftKey) {
                
                // Prevent default behavior if this shortcut matches
                event.preventDefault();
                
                // Call the callback
                shortcut.callback(event);
            }
        });
    },
    
    // Generate a unique ID for a shortcut
    generateId(shortcut) {
        let id = '';
        if (shortcut.ctrl) id += 'ctrl+';
        if (shortcut.alt) id += 'alt+';
        if (shortcut.shift) id += 'shift+';
        id += shortcut.key;
        return id;
    },
    
    // Check if element is editable (input, textarea, etc)
    isEditableElement(element) {
        return element.tagName === 'INPUT' || 
               element.tagName === 'TEXTAREA' || 
               element.isContentEditable;
    },
    
    // Get all registered shortcuts for display
    getRegisteredShortcuts() {
        const shortcuts = [];
        this.activeShortcuts.forEach((shortcut, id) => {
            shortcuts.push({
                id: id,
                description: shortcut.description
            });
        });
        return shortcuts;
    }
};
