/**
 * API Utilities - Handles API communication
 */

class ApiUtils {
    /**
     * Fetch available models from local API
     * @param {string} apiBase Base URL of the API
     * @returns {Promise} Promise that resolves to model information
     */
    static async fetchLocalModels(apiBase) {
        try {
            const response = await fetch(`${apiBase}/models`);
            
            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }
            
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error("Error fetching local models:", error);
            return [];
        }
    }
    
    /**
     * Fetch chat history from the server
     * @returns {Promise} Promise that resolves to chat history
     */
    static async fetchHistory() {
        try {
            const response = await fetch('/history');
            const data = await response.json();
            return data || [];
        } catch (error) {
            console.error("Error loading chat history:", error);
            return [];
        }
    }
    
    /**
     * Reset the chat conversation
     * @returns {Promise} Promise that resolves when reset is complete
     */
    static async resetChat() {
        try {
            await fetch('/reset', {
                method: 'POST'
            });
            return true;
        } catch (error) {
            console.error("Error resetting chat:", error);
            return false;
        }
    }
    
    /**
     * Reset the chat conversation to a specific message index
     * @param {number} messageIndex Index to reset to
     * @returns {Promise} Promise that resolves to response data
     */
    static async resetToIndex(messageIndex) {
        try {
            const response = await fetch('/reset_from_index', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message_index: messageIndex })
            });
            
            return await response.json();
        } catch (error) {
            console.error("Error resetting to index:", error);
            throw error;
        }
    }
      /**
     * Reset chat to specified messages
     * @param {Array} messages Array of message objects
     * @returns {Promise} Promise that resolves when reset is complete
     */
    static async resetToMessages(messages) {
        try {
            await fetch('/reset_to_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages })
            });
            return true;
        } catch (error) {
            console.error("Error resetting chat to messages:", error);
            return false;
        }
    }
    
    /**
     * Delete a conversation from history
     * @param {string} conversationId ID of the conversation to delete
     * @returns {Promise} Promise that resolves when deletion is complete
     */
    static async deleteConversation(conversationId) {
        try {
            await fetch(`/history/${conversationId}`, {
                method: 'DELETE'
            });
            return true;
        } catch (error) {
            console.error("Error deleting conversation:", error);
            return false;
        }
    }
    
    /**
     * Apply settings to the server
     * @param {Object} settings Settings object
     * @returns {Promise} Promise that resolves when settings are applied
     */
    static async applySettings(settings) {
        try {
            const response = await fetch('/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to apply settings: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error("Error applying settings:", error);
            throw error;
        }
    }
}

export default ApiUtils;
