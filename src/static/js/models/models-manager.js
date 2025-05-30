/**
 * Models and Settings Manager - Handles model selection and application settings
 */

class ModelsManager {
    constructor() {
        // DOM elements
        this.modelSelect = document.getElementById('model-select');
        this.modelList = document.getElementById('available-models-list');
        this.contextWindow = document.getElementById('context-window');
        this.maxTokens = document.getElementById('max-tokens');
        this.autoRun = document.getElementById('auto-run');
        this.applySettings = document.getElementById('apply-settings');

        this.initEventListeners();
    }

    /**
     * Initialize event listeners for model selection and settings
     */
    initEventListeners() {
        this.modelSelect.addEventListener('change', () => this.handleModelChange());
        this.applySettings.addEventListener('click', () => this.saveSettings());
    }

    /**
     * Handle model type selection change
     */
    handleModelChange() {
        // Toggle custom settings visibility
        const showCustomSettings = this.modelSelect.value === 'custom';
        document.querySelector('.custom-settings').style.display = showCustomSettings ? 'block' : 'none';

        // Fetch models if local or custom is selected
        if (this.shouldFetchModels()) {
            this.fetchAndDisplayModels();
        }
    }

    /**
     * Check if models should be fetched based on current settings
     * @returns {boolean} Whether models should be fetched
     */
    shouldFetchModels() {
        const modelType = this.modelSelect.value;
        return (modelType === 'local' || modelType === 'custom');
    }

    /**
     * Get the currently selected model
     * @returns {string} The selected model ID
     */
    getSelectedModel() {
        if (this.modelSelect.value !== 'custom') {
            return this.modelSelect.value;
        } else {
            const selectedModelElement = document.querySelector('.model-item.selected .model-id');
            return selectedModelElement ? selectedModelElement.textContent : '';
        }
    }

    /**
     * Fetch and display available models from the API
     */
    async fetchAndDisplayModels() {
        try {
            const response = await fetch(`api/models`);

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            const data = await response.json();
            const models = data.data || [];

            this.displayModels(models);
        } catch (error) {
            console.error("Error fetching local models:", error);
            this.displayModels([]);
        }
    }

    /**
     * Display the list of available models in the UI
     * @param {Array} models List of model objects
     */
    displayModels(models) {
        // Check if model list element exists
        if (!this.modelList) return;

        // Clear previous model list
        this.modelList.innerHTML = '';

        if (models.length === 0) {
            this.modelList.innerHTML = '<div class="no-models">No models found.</div>';
            return;
        }

        models.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.dataset.id = model.id;
            modelItem.innerHTML = `
                <div class="model-id">${model.id}</div>
            `;

            // Add click event to select model
            modelItem.addEventListener('click', () => {
                // Remove selected class from all models
                document.querySelectorAll('.model-item').forEach(item => {
                    item.classList.remove('selected');
                });

                // Add selected class to this model
                modelItem.classList.add('selected');
            });
            console.log(modelItem);
            this.modelList.appendChild(modelItem);
        });
    }

    /**
     * Save settings to the backend
     */
    saveSettings() {
        const settings = {
            model: this.getSelectedModel(),
            context_window: this.contextWindow.value,
            max_tokens: this.maxTokens.value,
            auto_run: this.autoRun.checked,
            custom: this.modelSelect.value === 'custom' ? true : false
        };


        fetch('/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Settings applied successfully');
                } else {
                    alert('Error applying settings');
                }
            });
    }

    /**
     * Load settings from the backend
     */
    async loadSettings() {
        try {
            const response = await fetch('/settings');
            const data = await response.json();

            this.modelSelect.value = data.model || 'gpt-4';
            this.contextWindow.value = data.context_window || 8000;
            this.maxTokens.value = data.max_tokens || 1000;
            this.autoRun.checked = data.auto_run !== undefined ? data.auto_run : true;


            // Fetch models from the API when settings are loaded
            if (this.shouldFetchModels()) {
                this.fetchAndDisplayModels();
            }


            // Show API base input if needed
            if (this.modelSelect.value === 'custom') {
                document.querySelector('.custom-settings').style.display = 'block';
            }
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    }
}

export default ModelsManager;
