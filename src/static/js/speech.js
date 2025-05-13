
/**
 * Text-to-Speech functionality for Open Interpreter Web Bridge
 */
class SpeechManager {
    constructor() {
        console.log('[SpeechManager] Initializing speech manager...');
        this.audioElement = null;
        this.audioQueue = [];

        // Initialize mute state from localStorage or default to unmuted (false)
        const savedMuteState = localStorage.getItem('textToSpeechEnabled');
        // If saved value is explicitly set to 'true', we're muted (true)
        // If saved value is explicitly 'false' OR null (first visit), we're unmuted (false)
        this.isMuted = savedMuteState === 'true';

        this.isPlaying = false;
        this.currentVoice = 'alloy'; // Default voice
        this.avatarManager = null;
        this.lastSpokenText = ''; // Store the last spoken text block for replay

        // Get UI elements
        this.visualization = document.getElementById('audio-visualization');
        this.visualizationWaves = document.querySelector('.audio-waves');
        this.placeholderText = document.querySelector('.audio-placeholder-text');
        this.muteButton = document.getElementById('mute-button');
        this.replayButton = document.getElementById('replay-button');
        this.voiceSelect = document.getElementById('voice-select');

        // --- Create Audio Element Early and Setup Listeners ---
        this.audioElement = new Audio();
        console.log('[SpeechManager] Audio element created');

        // Centralized 'ended' event listener is key for queue progression
        this.audioElement.addEventListener('ended', () => {
            // *** ADDED LOGGING ***
            console.log(`%c[SpeechManager] Audio Event: ended (AudioElement). Current isPlaying: ${this.isPlaying}`, "color: orange;");
            if (!this.isPlaying) {
                console.warn("[SpeechManager] AudioElement 'ended' fired but isPlaying was already false.");
                // Avoid queuing playNext again if already handled or stopped
                return;
            }
            this.isPlaying = false; // Mark as not playing *before* calling playNext
            this.updateVisualization(false);
            console.log(`%c[SpeechManager] Audio Event: ended (AudioElement). Set isPlaying=false. Scheduling playNext. Queue: ${this.audioQueue.length}`, "color: orange;");
            setTimeout(() => this.playNext(), 50); // Small delay before playing next
        });

        this.audioElement.addEventListener('play', () => {
            console.log('[SpeechManager] Audio Event: play (AudioElement)');
            // When playback actually starts, confirm playing state.
            if (this.isPlaying) {
                console.warn("[SpeechManager] AudioElement 'play' event fired, but isPlaying was already true.");
            }
            this.isPlaying = true;
            this.updateVisualization(true);
        });

        this.audioElement.addEventListener('pause', () => {
            console.log('[SpeechManager] Audio Event: pause (AudioElement)');
            // If paused (e.g., user interaction, buffering, mute toggle), update state
            // Avoid setting isPlaying=false if it's just temporary buffering - 'ended' is definitive stop
            if (this.isMuted || this.audioQueue.length === 0) {
                this.isPlaying = false; // Set false if pause is due to mute or end of queue
            }
            this.updateVisualization(false);
        });

        this.audioElement.addEventListener('error', (e) => {
            console.error('[SpeechManager] Audio Element Error:', e.target.error);
            // Attempt to recover by trying the next item after a short delay
            this.isPlaying = false; // Ensure state is reset
            this.updateVisualization(false);
            console.log('[SpeechManager] Audio error occurred, attempting to play next item.');
            setTimeout(() => this.playNext(), 250); // Add delay before trying next
        });

        // Debugging events
        this.audioElement.addEventListener('loadstart', () => console.log('[SpeechManager] Audio Event: loadstart'));
        this.audioElement.addEventListener('loadeddata', () => console.log('[SpeechManager] Audio Event: loadeddata'));
        this.audioElement.addEventListener('canplay', () => console.log('[SpeechManager] Audio Event: canplay'));
        this.audioElement.addEventListener('playing', () => console.log('[SpeechManager] Audio Event: playing (different from play)'));
        this.audioElement.addEventListener('waiting', () => console.log('[SpeechManager] Audio Event: waiting (buffering)'));
        // --- End Audio Element Setup ---


        this.setupEventListeners(); // Setup button/select listeners

        // Import and initialize avatar manager
        import('./avatar.js').then(module => {
            const AvatarManager = module.default;
            this.avatarManager = new AvatarManager();
            console.log('[SpeechManager] Avatar manager loaded');

            // *** Crucial: Ensure AvatarManager signals completion ***
            // This assumes AvatarManager has an 'eventTarget' property that is an EventTarget
            // and dispatches custom events: 'avatar-speech-started', 'avatar-speech-ended', 'avatar-speech-error'
            if (this.avatarManager && this.avatarManager.eventTarget && typeof this.avatarManager.eventTarget.addEventListener === 'function') {
                this.avatarManager.eventTarget.addEventListener('avatar-speech-started', () => {
                    // *** ADDED LOGGING ***
                    console.log(`%c[SpeechManager] Received avatar-speech-started event. Current isPlaying: ${this.isPlaying}`, "color: blue;");
                    if (this.isPlaying) {
                        console.warn("[SpeechManager] 'avatar-speech-started' event fired, but isPlaying was already true.");
                    }
                    this.isPlaying = true; // Mark as playing when avatar starts
                    this.updateVisualization(true);
                });

                this.avatarManager.eventTarget.addEventListener('avatar-speech-ended', () => {
                    // *** ADDED LOGGING ***
                    console.log(`%c[SpeechManager] Received avatar-speech-ended event. Current isPlaying: ${this.isPlaying}`, "color: blue;");
                    if (!this.isPlaying) {
                        console.warn("[SpeechManager] 'avatar-speech-ended' received but isPlaying was already false.");
                        // Avoid queuing playNext again if already handled or stopped
                        return;
                    }
                    this.isPlaying = false; // Mark as not playing when avatar finishes
                    this.updateVisualization(false);
                    console.log(`%c[SpeechManager] Received avatar-speech-ended event. Set isPlaying=false. Scheduling playNext. Queue: ${this.audioQueue.length}`, "color: blue;");
                    setTimeout(() => this.playNext(), 50); // Play next item after avatar finishes
                });

                this.avatarManager.eventTarget.addEventListener('avatar-speech-error', (e) => {
                    // *** ADDED LOGGING ***
                    console.error(`%c[SpeechManager] Received avatar-speech-error event. Current isPlaying: ${this.isPlaying}`, "color: red;", e.detail);
                    if (!this.isPlaying) {
                        console.warn("[SpeechManager] 'avatar-speech-error' received but isPlaying was already false.");
                    }
                    this.isPlaying = false;
                    this.updateVisualization(false);
                    console.error('[SpeechManager] Avatar error occurred, attempting to play next item.');
                    setTimeout(() => this.playNext(), 250); // Delay before trying next after error
                });
                console.log('[SpeechManager] Avatar event listeners attached.');

            } else {
                console.warn('[SpeechManager] AvatarManager loaded, but eventTarget for completion signaling not found or invalid.');
            }
        }).catch(error => {
            console.error('[SpeechManager] Failed to load avatar manager:', error);
            this.avatarManager = null; // Ensure avatarManager is null if loading fails
        });

        // Initialize the mute button state and voice select based on current values
        this.initMuteButtonState();
        if (this.voiceSelect) {
            this.currentVoice = this.voiceSelect.value || 'alloy';
            console.log(`[SpeechManager] Initial voice set to: ${this.currentVoice}`);
        }
    }    /**
     * Sets up event listeners for UI elements like buttons and selects.
     * Audio element listeners are set up in the constructor.
     */    setupEventListeners() {
        console.log('[SpeechManager] Setting up UI event listeners');        // Mute button
        if (this.muteButton) {
            console.log('[SpeechManager] Mute button found:', this.muteButton.outerHTML);

            // Don't replace the button, just clear existing listeners and add a new one
            // This approach preserves any other event handlers that might be attached

            // Add click event listener with a direct reference
            const muteButtonRef = this.muteButton; // Store reference to avoid 'this' context issues
            const self = this; // Store reference to class instance

            // Add a direct onclick handler that logs and calls toggleMute
            this.muteButton.onclick = function (e) {
                console.log('%c[SpeechManager] Mute button clicked via onclick!', 'background: yellow; color: black');
                self.toggleMute();
                return false; // Prevent default and stop propagation
            };

            console.log('[SpeechManager] Mute button onclick handler added directly.');
        } else {
            console.error('[SpeechManager] Mute button not found in the DOM');
        }

        // Voice selection
        if (this.voiceSelect) {
            this.voiceSelect.addEventListener('change', (e) => {
                this.currentVoice = e.target.value;
                console.log(`[SpeechManager] Voice changed to: ${this.currentVoice}`);
                // Optional: Decide if changing voice should interrupt current speech or clear queue
                // this.stopAndClear(); // Example: Stop current and clear queue on voice change
            });
            console.log('[SpeechManager] Voice select listener added.');
        } else {
            console.error('[SpeechManager] Voice select not found in the DOM');
        }        // Replay button
        if (this.replayButton) {
            console.log('[SpeechManager] Replay button found:', this.replayButton.outerHTML);

            // Don't replace the button, just add a direct onclick handler
            const self = this; // Store reference to class instance

            // Add a direct onclick handler that logs and calls replayLastSpeech
            this.replayButton.onclick = function (e) {
                console.log('%c[SpeechManager] Replay button clicked via onclick!', 'background: yellow; color: black');
                self.replayLastSpeech();
                return false; // Prevent default and stop propagation
            };

            console.log('[SpeechManager] Replay button onclick handler added directly.');
        } else {
            console.error('[SpeechManager] Replay button not found in the DOM');
        }
    }

    /**
   * Method to test speech functionality directly
   */
    runSpeechTest() {
        console.log('[SpeechManager] Running speech test');
        this.managePanelsForSpeech(); // Ensure panels are visible
        const testSentence = "This is a test of the text to speech functionality. If you can hear this, the audio system should be working correctly.";
        this.speakText(testSentence);
    }

    /**
     * Updates the visual state (waves, placeholder text) based on playback activity.
     * Also manages the internal `isPlaying` state flag.
     * @param {boolean} isActive - Whether audio playback is currently active.
     */
    updateVisualization(isActive) {
        // Update isPlaying state
        this.isPlaying = isActive; // Keep state consistent with visualization

        if (!this.visualizationWaves || !this.placeholderText) {
            console.warn('[SpeechManager] Visualization elements not found for update.');
            return; // Avoid errors if elements are missing
        }

        if (isActive) {
            this.visualizationWaves.classList.add('active');
            this.placeholderText.style.display = 'none'; // Hide placeholder when playing
        } else {
            this.visualizationWaves.classList.remove('active');
            this.placeholderText.style.display = 'flex'; // Show placeholder when not playing

            // Update placeholder text based on current state
            if (this.isMuted) {
                this.placeholderText.textContent = 'Muted';
            } else if (this.audioQueue.length > 0) {
                this.placeholderText.textContent = 'Audio queued...';
            } else {
                this.placeholderText.textContent = 'Ready'; // Or 'No audio playing'
            }
        }
    }    /**
     * Toggles the mute state, updates UI, pauses/resumes playback, and saves preference.
     */
    toggleMute() {
        console.log('[SpeechManager] toggleMute called, current state:', this.isMuted);

        // Toggle mute state
        this.isMuted = !this.isMuted;
        console.log('[SpeechManager] New mute state:', this.isMuted);

        // Apply mute state directly to the audio element
        if (this.audioElement) {
            this.audioElement.muted = this.isMuted;
            console.log('[SpeechManager] Applied mute state to audio element');
        }

        // Update mute button icon and tooltip - do this before other operations
        this.updateMuteButtonVisuals();

        if (this.isMuted) {
            // If muting, pause current playback. Don't clear queue by default.
            if (this.isPlaying && this.audioElement) {
                this.audioElement.pause(); // Pause playback
                console.log('[SpeechManager] Playback paused due to mute.');
            }
            this.updateVisualization(false); // Update visual state (will show 'Muted')
        } else {
            // If unmuting, start playback ONLY if something is queued and not already playing
            if (!this.isPlaying && this.audioQueue.length > 0) {
                console.log('[SpeechManager] Unmuted, attempting to play next item.');
                // Use a small delay to ensure mute state is fully processed before playing
                setTimeout(() => this.playNext(), 50);
            } else if (this.isPlaying) {
                console.log('[SpeechManager] Unmuted, but playback is already in progress.');

                // Resume play if it was paused due to mute
                if (this.audioElement && this.audioElement.paused) {
                    this.audioElement.play();
                }
            } else {
                console.log('[SpeechManager] Unmuted, queue is empty.');
                this.updateVisualization(false); // Ensure visualization shows 'Ready'
            }
        }

        // Save user preference ('true' for muted, 'false' for unmuted)
        localStorage.setItem('textToSpeechEnabled', this.isMuted ? 'true' : 'false');

        console.log(`[SpeechManager] Text-to-speech ${this.isMuted ? 'disabled (muted)' : 'enabled (unmuted)'}`);
    }

    /**
     * Processes text, breaks it into sentences, adds them to the queue,
     * and starts playback if necessary.
     * @param {string} text - The text content to speak.
     */
    async speakText(text) {
        console.log('[SpeechManager] speakText called with:', text?.substring(0, 50) + '...');
        if (!text || text.trim() === '') {
            console.log('[SpeechManager] Empty text, skipping speech');
            return;
        }

        // Store the full text block for replay functionality
        // Store it only if the queue is currently empty to represent the start of a new message block
        if (this.audioQueue.length === 0) {
            this.lastSpokenText = text;
            console.log('[SpeechManager] Storing text for potential replay.');
        }

        // Manage panel visibility for speech
        this.managePanelsForSpeech();

        try {
            // Break text into smaller chunks (sentences)
            const sentences = this.breakIntoSentences(text);
            console.log(`[SpeechManager] Text broken into ${sentences.length} sentences`);

            // Flag to check if queue was empty before adding these sentences
            const queueWasEmpty = this.audioQueue.length === 0;

            // Process each sentence
            for (const sentence of sentences) {
                const trimmedSentence = sentence.trim();
                if (trimmedSentence === '') continue;

                // Add to queue
                this.audioQueue.push({
                    text: trimmedSentence,
                    voice: this.currentVoice
                });
                console.log(`[SpeechManager] Added to queue: "${trimmedSentence.substring(0, 30)}..."`);
            }

            // Start playing if not already playing, queue was empty before adding, and not muted.
            // Let the 'ended' event handle subsequent plays automatically.
            if (queueWasEmpty && !this.isPlaying && !this.isMuted) {
                console.log('[SpeechManager] Queue was empty, starting playback.');
                this.playNext();
            } else if (this.isMuted) {
                console.log('[SpeechManager] Audio queued but currently muted.');
                this.updateVisualization(false); // Update placeholder text to show "Muted" or "Queued"
            } else if (this.isPlaying) {
                console.log('[SpeechManager] Already playing, new text queued for automatic playback.');
                this.updateVisualization(true); // Ensure visualization stays active
            } else {
                // Not playing, not muted, but queue wasn't empty (e.g. processing ended, next call pending)
                console.log('[SpeechManager] Text queued. Playback should resume/continue shortly.');
                // Potentially call playNext here if there's a risk of stalling, but rely on 'ended' first.
            }

        } catch (error) {
            console.error('[SpeechManager] Error in speakText queuing:', error);
        }
    }

    /**
     * Plays the next audio item from the queue. Handles API calls,
     * avatar integration (if available), and standard audio playback.
     */
    async playNext() {
        // *** ADDED/MODIFIED LOGGING ***
        console.log(`[SpeechManager] playNext called. Queue: ${this.audioQueue.length}, isPlaying: ${this.isPlaying}, isMuted: ${this.isMuted}`);

        // --- Pre-flight Checks ---
        if (this.isMuted) {
            console.log('[SpeechManager] playNext: Skipping playback: Muted.');
            this.isPlaying = false; // Ensure state is correct if called while muted
            this.updateVisualization(false);
            return;
        }
        if (this.audioQueue.length === 0) {
            console.log('[SpeechManager] playNext: Skipping playback: Queue is empty.');
            // It's possible isPlaying is true if called right before ended event processes
            // So, ensure it's false now that queue is empty.
            this.isPlaying = false;
            this.updateVisualization(false);
            return;
        }
        // Prevent starting a new item if one is actively playing
        // This check is crucial to prevent race conditions if playNext gets called unexpectedly
        if (this.isPlaying) {
            console.warn(`%c[SpeechManager] playNext: Skipping playback: isPlaying is TRUE. This might indicate the previous 'ended' event was missed or state is wrong.`, "color: red; background: yellow;");
            return; // Do not proceed if already playing
        }
        // --- End Checks ---

        // *** Mark as attempting to play *before* async operations ***
        // NOTE: Setting this true here relies on the 'ended'/'error' events ALWAYS firing
        // to reset it. If those events fail, the system gets stuck.
        this.isPlaying = true;
        const nextItem = this.audioQueue.shift();
        console.log(`[SpeechManager] playNext: Processing next item: "${nextItem.text.substring(0, 30)}..." (Voice: ${nextItem.voice})`);        //prepare the out for avatar speech
        const humanSpeech = await this.prepareAvatarSpeech(nextItem.text);

        console.log(`[SpeechManager] Summary: ${humanSpeech.text}, Emotion: ${humanSpeech.emotion}`);

        // Update placeholder text while loading/processing
        this.updateVisualization(true); // Show waves immediately
        if (this.placeholderText) this.placeholderText.textContent = 'Loading audio...';


        try {
            console.log('[SpeechManager] Requesting TTS from API...');
            const response = await fetch('/api/text-to-speech-orpheus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: humanSpeech.text, voice: nextItem.voice })
            });

            // Check for network/server errors (e.g., 4xx, 5xx)
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('[SpeechManager] API response received:', data.success ? 'Success' : 'Failed');

            if (data.success && data.audio) {
                const audioSrc = `data:audio/mp3;base64,${data.audio}`;
                let handledByAvatar = false;

                // --- Avatar Attempt (if available and configured) ---
                if (this.avatarManager && this.avatarManager.eventTarget && typeof this.avatarManager.speakWithAvatar === 'function') {
                    try {
                        console.log('[SpeechManager] Attempting speech with Avatar...');
                        // Assume speakWithAvatar starts the process and returns quickly (e.g., true if attempted).
                        // We rely on 'avatar-speech-started' and 'avatar-speech-ended'/'error' events now.
                        const attemptStarted = await this.avatarManager.speakWithAvatar(humanSpeech.text, data.audio, humanSpeech.emotion);

                        if (attemptStarted) {
                            console.log('[SpeechManager] Avatar speech initiated. Waiting for avatar events.');
                            handledByAvatar = true;
                            // Do nothing else here; avatar events will drive the next step.
                            // isPlaying is true, visualization is active.
                        } else {
                            console.log('[SpeechManager] AvatarManager indicated it could not handle the speech request. Falling back.');
                        }
                    } catch (avatarError) {
                        console.error('[SpeechManager] Error initiating avatar speech, falling back to standard audio:', avatarError);
                        // Ensure state is reset if avatar fails early, before standard playback attempt
                        this.isPlaying = false; // Reset tentative playing state
                    }
                }

                // --- Audio Element Playback (Fallback or Primary) ---
                if (!handledByAvatar) {
                    // If avatar didn't handle it, reset tentative isPlaying flag before trying audioElement
                    this.isPlaying = false; // Reset before trying audio element
                    console.log('[SpeechManager] Using standard AudioElement for playback.');
                    this.audioElement.src = audioSrc; // Set the source
                    const playPromise = this.audioElement.play(); // Attempt to play

                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            console.log('[SpeechManager] AudioElement playback initiated successfully.');
                            // The 'play' event listener will set isPlaying = true and update visualization.
                        }).catch(error => {
                            console.error('[SpeechManager] Error playing audio via AudioElement:', error);
                            // Playback failed for this item. Reset state and try next item.
                            this.isPlaying = false; // Ensure state is not playing
                            this.updateVisualization(false);
                            console.log('[SpeechManager] Attempting to skip to next item after playback error.');
                            setTimeout(() => this.playNext(), 100); // Try next after delay
                        });
                    } else {
                        console.warn('[SpeechManager] Play promise undefined. Relying on event listeners (play/ended/error).');
                        // If playback starts, 'play' event handles state. If fails, 'error'. If succeeds, 'ended'.
                    }
                }
                // --- End Playback Logic ---

            } else {
                // API call was successful (2xx) but returned success: false or no audio data
                console.error('[SpeechManager] TTS API call failed logically or returned no audio:', data.error || 'Unknown API error');
                // API failed for this item. Reset state and try the next one.
                this.isPlaying = false;
                this.updateVisualization(false);
                setTimeout(() => this.playNext(), 100); // Try next item after short delay
            }
        } catch (error) {
            // Catch errors from fetch, response.json(), or other synchronous issues
            console.error('[SpeechManager] Error during playNext fetch/processing:', error);
            // Critical error. Reset state and try the next item after a delay.
            this.isPlaying = false;
            this.updateVisualization(false);
            setTimeout(() => this.playNext(), 250); // Longer delay for potentially bigger issues
        }
    }

    /**
     * Helper function to break text into sentences.
     * This is a basic implementation and might not cover all edge cases.
     * @param {string} text - The input text.
     * @returns {string[]} An array of sentences.
     */
    breakIntoSentences(text) {
        if (!text) return [];
        return [text.trim()];
        // Match sequences ending in '.', '!', '?', possibly followed by quotes or spaces.
        // This regex attempts to handle basic sentence endings.
        // It splits the text based on the delimiters, keeping the delimiters with the sentence.
        // It might imperfectly handle abbreviations (e.g., Mr., Mrs.).
        const sentences = text.match(/[^.!?]+[.!?]?(\s+|$)/g);

        // Trim results and filter out empty strings
        return sentences
            ? sentences.map(s => s.trim()).filter(s => s.length > 0)
            : [text.trim()]; // Fallback: return the whole text if no delimiters found
    }

    /**
     * Manages panel visibility for speech features.
     * Ensures necessary UI panels are visible when speech is triggered.
     */
    managePanelsForSpeech() {
        console.log('[SpeechManager] Managing panels for speech...');

        // Attempt to use AvatarManager's method if available
        if (this.avatarManager && typeof this.avatarManager.ensureAvatarPanelVisible === 'function') {
            //this.avatarManager.ensureAvatarPanelVisible();
        } else {
            // Fallback: Direct DOM manipulation (example, adjust selectors as needed)
            console.log('[SpeechManager] AvatarManager method unavailable, using direct DOM check.');
            try {
                const avatarPanel = document.getElementById('avatar-panel');
                const panelsContainer = document.getElementById('panels-container'); // Assuming a main container

                if (avatarPanel && avatarPanel.classList.contains('collapsed')) {
                    console.log('[SpeechManager] Avatar panel found collapsed, attempting to expand.');
                    const toggleBtn = avatarPanel.querySelector('.panel-toggle-btn'); // Adjust selector
                    if (toggleBtn) toggleBtn.click();
                }

                if (panelsContainer && panelsContainer.classList.contains('collapsed')) {
                    console.log('[SpeechManager] Main panels container found collapsed, attempting to expand.');
                    const mainToggleBtn = document.getElementById('toggle-panels-container'); // Adjust selector
                    if (mainToggleBtn) mainToggleBtn.click();
                }
            } catch (e) {
                console.warn("[SpeechManager] Error managing panels visibility via DOM:", e);
            }
        }

        // Dispatch custom event that other components can listen for (optional)
        // const event = new CustomEvent('speech-started', { detail: { timestamp: Date.now() } });
        // document.dispatchEvent(event);
    }    /**
     * Replays the last spoken block of text.
     */
    replayLastSpeech() {
        console.log('[SpeechManager] Replaying last speech:', this.lastSpokenText?.substring(0, 30) + '...');

        if (!this.lastSpokenText || this.lastSpokenText.trim() === '') {
            console.log('[SpeechManager] No previous speech to replay');
            if (this.placeholderText) {
                this.placeholderText.style.display = 'flex';
                this.placeholderText.textContent = 'Nothing to replay';
                setTimeout(() => {
                    // Restore placeholder based on current state, not just a fixed string
                    this.updateVisualization(this.isPlaying);
                }, 2000);
            }
            return;
        }

        // Stop any currently playing audio and clear the queue before replaying
        this.stopAndClear();

        // Manage panel visibility
        this.managePanelsForSpeech();

        // Temporarily unmute if muted, queue the speech, then restore mute state
        const wasMuted = this.isMuted;

        try {
            if (wasMuted) {
                console.log('[SpeechManager] Temporarily unmuting for replay.');
                this.isMuted = false; // Temporarily change state
                // Don't call toggleMute() as it saves state and has side effects
            }

            // Use speakText to queue and potentially start the replay
            this.speakText(this.lastSpokenText);

            // After speakText has finished queuing
            if (wasMuted) {
                console.log('[SpeechManager] Restoring muted state after queuing replay.');
                setTimeout(() => {
                    this.isMuted = true; // Restore the original muted state
                    // Since speakText might have started playback, we need to pause it now if we restore mute
                    if (this.isPlaying && this.audioElement) {
                        this.audioElement.pause();
                    }
                    this.updateVisualization(false); // Update visuals to show muted state again
                    this.updateMuteButtonVisuals(); // Make sure button visuals are updated
                }, 100);
            }
        } catch (error) {
            console.error('[SpeechManager] Error during replay:', error);
            // Restore muted state in case of error
            if (wasMuted) {
                this.isMuted = true;
                this.updateMuteButtonVisuals();
            }
        }
    }

    /** Stops current playback and clears the audio queue */
    stopAndClear() {
        console.log('[SpeechManager] Stopping playback and clearing queue.');
        this.audioQueue = []; // Clear the queue
        if (this.isPlaying) {
            this.audioElement.pause(); // Stop current playback
            this.audioElement.src = ""; // Release the current audio source
        }
        this.isPlaying = false;
        this.updateVisualization(false); // Update UI
    }
    /**
     * Updates the mute button icon and tooltip based on the current mute state.
     */
    updateMuteButtonVisuals() {
        console.log('[SpeechManager] Updating mute button visuals, muted:', this.isMuted);

        // Make sure we have the most current reference to the button
        this.muteButton = document.getElementById('mute-button');

        if (!this.muteButton) {
            console.error('[SpeechManager] Cannot update mute button visuals - button not found');
            return;
        }

        const icon = this.muteButton.querySelector('i');
        const tooltip = this.muteButton.querySelector('.tooltiptext');

        console.log('[SpeechManager] Found icon and tooltip:', !!icon, !!tooltip);

        if (this.isMuted) {
            if (icon) {
                icon.classList.remove('fa-volume-up');
                icon.classList.add('fa-volume-mute');
                console.log('[SpeechManager] Updated icon to muted state');
            }
            if (tooltip) {
                tooltip.textContent = 'Enable Text-to-Speech';
                console.log('[SpeechManager] Updated tooltip to enable message');
            }
        } else {
            if (icon) {
                icon.classList.remove('fa-volume-mute');
                icon.classList.add('fa-volume-up');
                console.log('[SpeechManager] Updated icon to unmuted state');
            }
            if (tooltip) {
                tooltip.textContent = 'Disable Text-to-Speech';
                console.log('[SpeechManager] Updated tooltip to disable message');
            }
        }
    }/**
     * Initializes the mute button visuals based on the initial mute state.
     */
    initMuteButtonState() {
        console.log(`[SpeechManager] Initializing mute button state. Audio element: ${!!this.audioElement}, Mute button: ${!!this.muteButton}, isMuted: ${this.isMuted}`);

        if (!this.audioElement) {
            console.error('[SpeechManager] Audio element not available during initialization');
            return;
        }

        if (!this.muteButton) {
            console.error('[SpeechManager] Mute button not found during initialization');
            return;
        }

        // Apply mute state to audio element
        this.audioElement.muted = this.isMuted;

        // Update button appearance
        this.updateMuteButtonVisuals();

        console.log(`[SpeechManager] Initial text-to-speech state: ${this.isMuted ? 'disabled (muted)' : 'enabled (unmuted)'}`);
    }    /**
     * Prepares the text for avatar speech, including emotion and summary.
     * @param {string} text - The text to prepare.
     * @returns {object} An object containing the prepared text, emotion, and summary.
     */
    async prepareAvatarSpeech(text) {
        try {
            console.log('[SpeechManager] Using OpenAIService to extract emotion and summary');

            const prompt = `
Analyze the following text and provide:
1. Change the provided text to the way a human would say it.
2. You can use the following emotion tags where appropriate <laugh>, <sigh>, <chuckle>, <cough>, <sniffle>, <groan>, <yawn>, <gasp>
3. Choose primary emotion that best represents the tone (One of: happy, sad, angry, fear, disgust, love, neutral)
4. No markdown or code blocks.

Return your response in JSON format with properties "emotion" and "summary" only:
{"emotion": "emotion_here", "summary": "<sigh> speech <laugh>"}

Text to analyze:
"${text}"
`;

            const data = {
                "prompt": prompt,
                "model": "gpt-4o-mini",
                "temperature": 0.7,
                "max_tokens": 100
            }


            const response = await fetch('/openai/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            console.log('[SpeechManager] OpenAI response:', result);
            if (result.error) {
                console.error('[SpeechManager] OpenAI API error:', result.error);
                return {
                    text: text,
                    emotion: "neutral",
                };
            }
            // Parse the completion field which contains a JSON string
            const { emotion, summary } = JSON.parse(result.response);
            console.log('[SpeechManager] Emotion and summary extracted:', emotion, summary);
            return {
                text: summary,
                emotion: emotion || "neutral", // Default to neutral if no emotion found
            };

        } catch (error) {
            console.error('[SpeechManager] Error extracting emotion and summary:', error);
            // Fallback to defaults if there's an error
            return {
                text: text,
                emotion: "neutral",
            };
        }
    }
}

// --- Initialization ---
// Create and export speech manager instance
const speechManager = new SpeechManager();

// Make it globally available for other scripts (optional, depending on project structure)
window.speechManager = speechManager;

// Export as module (standard for modern JS)
export default speechManager;