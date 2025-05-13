/**
 * Model Manager - Handles model selection, fetching, and configuration
 */

// Default API base URL for local models
const DEFAULT_API_BASE = 'http://192.168.1.118:1234/v1';

// List of built-in models that shouldn't be removed from dropdown
const BUILT_IN_MODELS = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4o', 'claude-3-7-sonnet-20250219', 'custom'];

/**
 * ModelManager class for handling model operations
 */
class ModelManager {
    constructor() {
        this.modelSelect = document.getElementById('model-select');
        this.apiBase = document.getElementById('api-base');
        this.apiBaseTimeout = null;
        
        this.initEventListeners();
    }

    /**
     * Initialize event listeners for model selection and API base changes
     */
    initEventListeners() {
        // Model select change handler
        this.modelSelect.addEventListener('change', () => this.handleModelChange());
        
        // API base change handlers
        this.apiBase.addEventListener('change', () => this.handleApiBaseChange());
        
        // Debounced input for live feedback
        this.apiBase.addEventListener('input', () => {
            clearTimeout(this.apiBaseTimeout);
            this.apiBaseTimeout = setTimeout(() => this.handleApiBaseChange(), 1000);
        });
    }

    /**
     * Handle model selection change
     */
    handleModelChange() {
        // Toggle custom settings visibility
        const showCustomSettings = this.modelSelect.value === 'custom';
        document.querySelector('.custom-settings').style.display = showCustomSettings ? 'block' : 'none';
        
        // Fetch models if needed
        if ((this.modelSelect.value === 'local' || this.modelSelect.value === 'custom') && this.shouldFetchModels()) {
            this.fetchLocalModels(this.getApiBaseUrl());
        }
    }

    /**
     * Handle API base URL changes
     */
    handleApiBaseChange() {
        if (this.shouldFetchModels()) {
            this.fetchLocalModels(this.getApiBaseUrl());
        }
    }

    /**
     * Check if models should be fetched based on current state
     * @returns {boolean} True if models should be fetched
     */
    shouldFetchModels() {
        const modelType = this.modelSelect.value;
        return (modelType === 'local' || modelType === 'custom') && this.getApiBaseUrl();
    }

    /**
     * Get the current API base URL
     * @returns {string} Current API base URL
     */
    getApiBaseUrl() {
        return this.apiBase.value?.trim() || DEFAULT_API_BASE;
    }

    /**
     * Load settings from the server
     */
    loadSettings() {
        fetch('/settings')
            .then(response => response.json())
            .then(data => {
                this.modelSelect.value = data.model || 'gpt-4';
                
                if (data.api_base) {
                    this.apiBase.value = data.api_base;
                    
                    // Fetch models from the API when settings are loaded
                    if (this.modelSelect.value === 'local' || this.modelSelect.value === 'custom' || 
                        this.modelSelect.value.includes('/')) {
                        this.fetchLocalModels(data.api_base);
                    }
                }
                
                // Show API base input if needed
                if (this.modelSelect.value === 'custom') {
                    document.querySelector('.custom-settings').style.display = 'block';
                }
            });
    }

    /**
     * Fetch available models from a local API
     * @param {string} apiBase The API base URL
     */
    fetchLocalModels(apiBase) {
        const modelsList = document.getElementById('available-models-list');
        
        // Display loading state
        this.updateModelsList(modelsList, 'loading');
        
        // Store current selected model
        const currentModel = this.modelSelect.value;
        
        // Make the API request
        fetch(`/api/models?api_base=${encodeURIComponent(apiBase || '')}`)
            .then(response => response.json())
            .then(data => {
                // Handle errors
                if (data.error) {
                    console.error('Error fetching models:', data.error);
                    this.updateModelsList(modelsList, 'error', data.error);
                    return;
                }
                
                // Get the models from the response
                const models = data.data || [];
                if (models.length === 0) {
                    console.warn('No models found at API endpoint');
                    this.updateModelsList(modelsList, 'empty');
                    return;
                }
                
                console.log('Available models:', models);
                
                // Clean up dropdown - remove all non-built-in models
                Array.from(this.modelSelect.options).forEach(option => {
                    if (!BUILT_IN_MODELS.includes(option.value)) {
                        this.modelSelect.removeChild(option);
                    }
                });
                
                // Update the visual models list if it exists
                if (modelsList) {
                    // Reset the list
                    modelsList.innerHTML = '';
                    
                    // Add header with refresh button
                    this.addModelsListHeader(modelsList, models.length, () => this.fetchLocalModels(apiBase));
                    
                    // Add each model as a clickable item
                    models.forEach(model => this.addModelToList(modelsList, model, currentModel));
                }
                
                // Restore selected model if possible
                if (Array.from(this.modelSelect.options).some(opt => opt.value === currentModel)) {
                    this.modelSelect.value = currentModel;
                }
            })
            .catch(error => {
                console.error('Error fetching models:', error);
                this.updateModelsList(modelsList, 'error', error.message);
            });
    }

    /**
     * Update the models list UI based on state
     * @param {HTMLElement} modelsList The models list element
     * @param {string} state Current state (loading, error, empty)
     * @param {string} errorMessage Error message if state is 'error'
     */
    updateModelsList(modelsList, state, errorMessage = '') {
        if (!modelsList) return;
        
        switch (state) {
            case 'loading':
                modelsList.innerHTML = '<div class="loading-models">Loading available models...</div>';
                break;
            case 'error':
                modelsList.innerHTML = `<div class="loading-models">Error: ${errorMessage}</div>`;
                break;
            case 'empty':
                modelsList.innerHTML = '<div class="loading-models">No models found at this API endpoint</div>';
                break;
        }
    }

    /**
     * Add a header with refresh button to the models list
     * @param {HTMLElement} modelsList The models list element
     * @param {number} modelCount Number of models found
     * @param {Function} refreshCallback Callback for refresh button
     */
    addModelsListHeader(modelsList, modelCount, refreshCallback) {
        const refreshDiv = document.createElement('div');
        refreshDiv.style.display = 'flex';
        refreshDiv.style.justifyContent = 'space-between';
        refreshDiv.style.alignItems = 'center';
        refreshDiv.style.marginBottom = '8px';
        
        const foundModels = document.createElement('span');
        foundModels.textContent = `Found ${modelCount} models`;
        foundModels.style.color = '#aaa';
        foundModels.style.fontSize = '12px';
        
        const refreshButton = document.createElement('button');
        refreshButton.className = 'refresh-models';
        refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshButton.onclick = refreshCallback;
        
        refreshDiv.appendChild(foundModels);
        refreshDiv.appendChild(refreshButton);
        modelsList.appendChild(refreshDiv);
    }

    /**
     * Add a model to the models list
     * @param {HTMLElement} modelsList The models list element
     * @param {Object} model Model data
     * @param {string} currentModel Currently selected model
     */
    addModelToList(modelsList, model, currentModel) {
        const modelItem = document.createElement('div');
        modelItem.className = 'model-item';
        if (model.id === currentModel) {
            modelItem.classList.add('selected');
        }
        
        const modelIdSpan = document.createElement('span');
        modelIdSpan.className = 'model-id';
        modelIdSpan.textContent = model.id;
        
        modelItem.appendChild(modelIdSpan);
        modelItem.addEventListener('click', () => {
            // Mark as selected in the UI
            document.querySelectorAll('.model-item').forEach(item => {
                item.classList.remove('selected');
            });
            modelItem.classList.add('selected');
        });
        
        modelsList.appendChild(modelItem);
    }
}

export default ModelManager;
