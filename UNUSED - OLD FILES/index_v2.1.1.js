// index_v2.1.1.js

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
if (!audioContext) {
    alert('Web Audio API is not supported in this browser');
}

let trimSettings, BPM, sequenceData;
const activeSources = new Set();
let isLooping = true;
let isStoppedManually = false;

const customLog = (message, isError = false) => {
    const logFunction = isError ? console.error : console.log;
    logFunction(message);
};

const loadAudioFile = async (url) => {
    if (!url) {
        customLog('Encountered invalid or missing URL in JSON', true);
        return null;
    }
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        // Compatibility check for older browsers
        return new Promise((resolve, reject) => {
            audioContext.decodeAudioData(arrayBuffer, resolve, reject);
        });
    } catch (error) {
        customLog(`Error loading audio file: ${error}`, true);
        return null;
    }
};

const calculateTrimTimes = (trimSetting, totalDuration) => {
    const startTime = Math.max(0, Math.min((trimSetting.startSliderValue / 100) * totalDuration, totalDuration));
    const endTime = (trimSetting.endSliderValue / 100) * totalDuration;
    return { startTime, duration: Math.max(0, endTime - startTime) };
};

const calculateStepTime = () => 60 / BPM / 4;

const createAndStartAudioSource = (audioBuffer, trimSetting, playbackTime) => {
    if (!audioBuffer) return;

    const source = audioContext.createBufferSource();
    const { startTime, duration } = calculateTrimTimes(trimSetting, audioBuffer.duration);
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(audioContext.currentTime + playbackTime, startTime, duration);

    source.onended = () => handleSourceEnd(source);
    activeSources.add(source);
};

const handleSourceEnd = (source) => {
    activeSources.delete(source);
    customLog(`Handling source end. Active sources remaining: ${activeSources.size}`);
    if (activeSources.size === 0 && isLooping && !isStoppedManually) {
        customLog('All sources ended, looping is true. Starting playback again.');
        playAudio();
    } else {
        customLog('Playback finished or stopped manually.');
    }
};

const schedulePlaybackForStep = (audioBuffer, trimSetting, stepIndex) => {
    const playbackTime = stepIndex * calculateStepTime();
    createAndStartAudioSource(audioBuffer, trimSetting, playbackTime);
};

const playAudio = async () => {
    if (!sequenceData || !sequenceData.projectURLs || !sequenceData.projectSequences) {
        return customLog("No valid sequence data available. Cannot play audio.", true);
    }
    const { projectURLs, projectSequences, projectBPM, trimSettings } = sequenceData;
    BPM = projectBPM; // Set global BPM

    stopAudio(); // Ensure any previous playback is stopped before starting new

    const audioBuffers = await Promise.all(projectURLs.map(loadAudioFile));

    if (!audioBuffers.some(buffer => buffer)) {
        return customLog("No valid audio data available for any channel. Cannot play audio.", true);
    }

    stopAudio();

    Object.entries(projectSequences).forEach(([sequenceName, channels]) => {
        Object.entries(channels).forEach(([channelName, channelData], channelIndex) => {
            const steps = channelData.steps;
            const audioBuffer = audioBuffers[channelIndex];
            const trimSetting = trimSettings[channelIndex];

            if (audioBuffer && steps) {
                steps.forEach((active, stepIndex) => {
                    if (active) {
                        schedulePlaybackForStep(audioBuffer, trimSetting, stepIndex);
                    }
                });
            }
        });
    });

    isStoppedManually = false;
    customLog("Scheduled playback for active steps in available sequences and channels");
    if (activeSources.size === 0 && isLooping) {
        customLog('No active sources at start of playAudio, looping is true. Starting playback again.');
        playAudio();
    } else {
        customLog('Active sources remain at the start of playAudio or stop was manual.');
    }
};

const stopAudio = () => {
    activeSources.forEach(source => {
        source.stop();
        source.disconnect();
    });
    activeSources.clear();
    customLog("All audio playback stopped and sources disconnected");
};

const setupUIHandlers = () => {
    // Ensure elements exist before adding event listeners
    const playButton = document.getElementById('playButton');
    const stopButton = document.getElementById('stopButton');
    const fileInput = document.getElementById('fileInput');

    if (playButton) {
        playButton.addEventListener('click', () => {
            isLooping = true;
            customLog('Play button pressed, attempting to start playback.');
            playAudio();
        });
    }

    if (stopButton) {
        stopButton.addEventListener('click', () => {
            isStoppedManually = true;
            customLog('Stop button pressed, calling stopAudio.');
            stopAudio();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (event) => {
            try {
                // Assuming processAndLoadAudio is defined elsewhere
                sequenceData = await processAndLoadAudio(event.target.files[0], loadAudioFile);
                if (sequenceData && sequenceData.projectURLs.some(url => url)) {
                    playButton.disabled = false;
                    customLog("File loaded successfully. Ready to play. Click the play button!");
                } else {
                    customLog("No valid audio URLs found in the sequence data.", true);
                    playButton.disabled = true;
                }
            } catch (err) {
                playButton.disabled = true;
                customLog(`Error processing sequence data: ${err}`, true);
            }
        });
    }
};

setupUIHandlers();
