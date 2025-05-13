import { TalkingHead } from "talkinghead";

class AvatarManager {
    constructor() {
        console.log('[AvatarManager] Initializing avatar manager...');
        this.head = null;
        this.eventTarget = new EventTarget(); // Initialize EventTarget

        // Get UI elements
        this.avatarDisplay = document.getElementById('avatar-display');
        this.avatarLoading = document.getElementById('avatar-loading');

        if (!this.avatarDisplay || !this.avatarLoading) {
            console.error('[AvatarManager] Avatar display or loading elements not found. Avatar disabled.');
            return;
        }
        this.initAvatar();
    } async initAvatar() {
        if (this.head || !this.avatarDisplay || !this.avatarLoading) return;
        try {
            console.log('[AvatarManager] Initializing TalkingHead...');
            this.ensureAvatarPanelVisible();            // Ensure the avatar display has proper dimensions before initialization
            if (this.avatarDisplay) {
                this.avatarDisplay.style.width = '100%';
                this.avatarDisplay.style.height = '100%';
                this.avatarDisplay.style.minHeight = '300px';
            }

            this.head = new TalkingHead(this.avatarDisplay, {
                cameraView: "upper",
                customTTS: true,
                ttsEndpoint: "https://dummy-endpoint-not-used.com",
                ttsApikey: "dummy-key-not-used",
                avatarMood: "neutral",
            });
            this.avatarLoading.textContent = "Loading avatar...";
            this.avatarLoading.style.display = 'block';
            await this.head.showAvatar({
                url: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
                body: 'F',
                avatarMood: 'neutral',
                lipsyncLang: 'en'
            }, (ev) => {
                if (ev.lengthComputable) {
                    let val = Math.min(100, Math.round(ev.loaded / ev.total * 100));
                    this.avatarLoading.textContent = "Loading " + val + "%";
                }
            });
            console.log('[AvatarManager] Avatar loaded successfully');
            this.avatarLoading.style.display = 'none';

            // Set up window resize listener to handle avatar canvas resizing
            window.addEventListener('resize', () => this.handleResize());
        } catch (error) {
            console.error('[AvatarManager] Error loading avatar:', error);
            if (this.avatarLoading) {
                this.avatarLoading.textContent = "Error loading avatar: " + error.message;
                this.avatarLoading.style.display = 'block';
            }
            this.head = null;
        }
    }

    /**
     * Handle window resize events to ensure the avatar is properly sized
     */
    handleResize() {
        if (this.head) {
            console.log('[AvatarManager] Window resized, triggering avatar resize');
            // Force a resize event on the talking head
            this.head.onResize();
        }
    }

    /**
     * Fix avatar display in a popped-out window
     * @param {Window} poppedWindow - Reference to the popped window
     */
    resizeAvatarInPoppedWindow(poppedWindow) {
        if (!poppedWindow || !this.head) return;

        try {
            console.log('[AvatarManager] Fixing avatar display in popped window');

            // Try to find the avatar container in the popped window
            const avatarContainer = poppedWindow.document.getElementById('avatar-display');
            if (!avatarContainer) {
                console.warn('[AvatarManager] Could not find avatar container in popped window');
                return;
            }

            // Make sure the container has explicit dimensions
            avatarContainer.style.width = '100%';
            avatarContainer.style.height = '100%';
            avatarContainer.style.minHeight = '300px';

            // Find the canvas element within the container
            const canvas = avatarContainer.querySelector('canvas');
            if (canvas) {
                console.log('[AvatarManager] Found canvas in popped window, fixing dimensions');
                canvas.style.width = '100%';
                canvas.style.height = '100%';

                // Force resize of the TalkingHead
                setTimeout(() => {
                    if (this.head) {
                        this.head.onResize();
                        console.log('[AvatarManager] Forced avatar resize in popped window');
                    }
                }, 100);
            } else {
                console.warn('[AvatarManager] Could not find avatar canvas in popped window');
            }
        } catch (e) {
            console.error('[AvatarManager] Error fixing popped window avatar:', e);
        }
    } ensureAvatarPanelVisible() {
        if (!this.avatarDisplay) return;
        const avatarPanel = this.avatarDisplay.closest('.panel') || document.getElementById('avatar-panel');
        if (!avatarPanel) {
            console.warn("[AvatarManager] Could not find avatar panel element.");
            return;
        }
        if (window.panelPopout && typeof window.panelPopout.isPanelPopped === 'function' && window.panelPopout.isPanelPopped('avatar-panel')) {
            console.log('[AvatarManager] Avatar in popped-out window, focusing.');
            try {
                if (window.panelPopout.poppedWindows?.['avatar-panel']) {
                    const poppedWindow = window.panelPopout.poppedWindows['avatar-panel'];
                    poppedWindow.focus();

                    // Fix for avatar size in popped window
                    setTimeout(() => {
                        this.resizeAvatarInPoppedWindow(poppedWindow);
                    }, 500); // Give the window time to fully render
                }
            }
            catch (e) { console.warn("[AvatarManager] Could not focus popped-out window:", e); }
            return;
        }
        if (window.panelManager && typeof window.panelManager.showPanel === 'function') {
            console.log('[AvatarManager] Ensuring panel visibility via PanelManager.');
            window.panelManager.showPanel('avatar-panel');
        } else if (avatarPanel.classList.contains('collapsed')) {
            console.log('[AvatarManager] Panel collapsed (legacy check), attempting toggle.');
            const toggleBtn = avatarPanel.querySelector('.panel-toggle-btn');
            if (toggleBtn?.click) toggleBtn.click();
            else console.warn("[AvatarManager] Could not find toggle button.");
        } else {
            console.log('[AvatarManager] Panel appears visible or PanelManager not found.');
        }
    }

    /**
     * Initiates avatar speech using provided text and audio. Uses the 'markers'
     * feature of TalkingHead to dispatch completion events.
     * @param {string} text - The text corresponding to the audio.
     * @param {string} audioBase64 - The base64 encoded MP3 audio data.
     * @returns {Promise<boolean>} - Resolves true if initiation succeeded, false otherwise.
     */
    async speakWithAvatar(text, audioBase64, emotion = 'neutral') {
        if (!this.head) {
            console.warn('[AvatarManager] speakWithAvatar: Head not initialized.');
            this.eventTarget.dispatchEvent(new CustomEvent('avatar-speech-error', { detail: new Error("Avatar head not initialized") }));
            return false;
        }
        if (!text || !audioBase64) {
            console.warn('[AvatarManager] speakWithAvatar: Missing text or audio data.');
            this.eventTarget.dispatchEvent(new CustomEvent('avatar-speech-error', { detail: new Error("Missing text or audio data") }));
            return false;
        }

        console.log('[AvatarManager] Preparing to speak:', text.substring(0, 50) + '...');
        let audioUrl = null; // Variable for cleanup

        try {
            // set the emotion
            this.head.setMood(emotion);
            console.log(`[AvatarManager] Avatar mood set to: ${emotion}`);
            // --- Convert Base64 to Blob URL ---
            const binaryString = atob(audioBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
            const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
            audioUrl = URL.createObjectURL(audioBlob);

            // --- Decode Audio ---
            const audioCtx = this.head.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (!audioCtx) throw new Error("AudioContext unavailable.");
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            if (!this.head.audioCtx) this.head.audioCtx = audioCtx; // Assign back if new

            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error(`Fetch blob URL failed: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const durationMs = audioBuffer.duration * 1000;
            console.log(`[AvatarManager] Audio decoded. Duration: ${durationMs.toFixed(0)}ms`);


            // --- Calculate Word Timings (Optional but good for lip-sync) ---
            const words = text.trim().split(/\s+/);
            const wtimes = [];
            const wdurations = [];
            if (words.length > 0 && durationMs > 0) {
                const avgWordDuration = durationMs / words.length;
                let currentTimeMs = 0;
                words.forEach(word => {
                    const estimatedWordDuration = Math.max(50, avgWordDuration);
                    wtimes.push(currentTimeMs);
                    wdurations.push(estimatedWordDuration);
                    currentTimeMs += estimatedWordDuration;
                });
                if (wdurations.length > 0 && currentTimeMs > durationMs) {
                    const overshoot = currentTimeMs - durationMs;
                    wdurations[wdurations.length - 1] = Math.max(10, wdurations[wdurations.length - 1] - overshoot);
                } else if (wdurations.length > 0 && currentTimeMs < durationMs) {
                    wdurations[wdurations.length - 1] += (durationMs - currentTimeMs);
                }
            }

            // --- *** Define End Marker Callback *** ---
            const onEndMarkerCallback = () => {
                // This function will be called by TalkingHead via the marker mechanism
                console.log(`%c[AvatarManager] --->>> onEndMarkerCallback INVOKED <<<--- (marker system)`, "color: purple; font-weight: bold;");
                if (audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                    audioUrl = null; // Clear reference
                    console.log('[AvatarManager] audioUrl revoked.');
                } else {
                    console.warn('[AvatarManager] onEndMarkerCallback: audioUrl was already null.');
                }
                // Dispatch the standard event expected by SpeechManager
                this.eventTarget.dispatchEvent(new CustomEvent('avatar-speech-ended'));
            };


            // --- Dispatch START event ---
            console.log('[AvatarManager] Dispatching avatar-speech-started event.');
            this.eventTarget.dispatchEvent(new CustomEvent('avatar-speech-started'));


            // --- Prepare the 'r' object for speakAudio ---
            const speakData = {
                audio: audioBuffer,
                // Include word timings if calculated
                ...(words.length > 0 && { words: words, wtimes: wtimes, wdurations: wdurations }),
                // *** Add the marker data ***
                markers: [onEndMarkerCallback], // Array containing the callback function
                mtimes: [durationMs] // Array containing the time (in ms) to trigger the marker
            };

            // --- Initiate Playback ---
            console.log('[AvatarManager] Calling this.head.speakAudio with marker data...');
            try {
                this.head.speakAudio(speakData); // Pass the prepared object
                console.log('[AvatarManager] this.head.speakAudio call completed without immediate error.');
            } catch (speakAudioError) {
                // Catch potential synchronous errors from speakAudio itself
                console.error(`%c[AvatarManager] >>> IMMEDIATE ERROR calling this.head.speakAudio <<<`, "color: red; font-weight: bold;", speakAudioError);
                throw speakAudioError; // Re-throw to be caught by the outer catch block
            }

            // Return true indicating successful initiation
            return true;

        } catch (error) { // Catches errors in prep or re-thrown from speakAudio call
            console.error('[AvatarManager] Error during speakWithAvatar process:', error);
            // Cleanup URL if it exists
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
            // Dispatch ERROR event
            this.eventTarget.dispatchEvent(new CustomEvent('avatar-speech-error', { detail: error }));
            // Return false indicating initiation failed
            return false;
        }
    }
}

// Export as module
export default AvatarManager;