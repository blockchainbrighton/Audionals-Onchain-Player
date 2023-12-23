// index_v2.1.1.js

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let trimSettings, BPM, sequenceData;
const activeSources = new Set();
let isLooping = true;
let isStoppedManually = false;

// Renamed to avoid conflicts with any pre-existing 'log' identifiers.
const customLog = (message, isError = false) => {
    const logFunction = isError ? console.error : console.log;
    logFunction(message);
};

const checkAudioContextSupport = () => {
    if (!audioContext) {
        alert('Web Audio API is not supported in this browser');
    }
};

const loadAudioFile = async (url) => {
    if (!url) {
        customLog('Encountered invalid or missing URL in JSON', true);
        return null;
    }
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
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
        return log("No valid sequence data available. Cannot play audio.", true);
    }
    const { projectURLs, projectSequences, projectBPM, trimSettings } = sequenceData;
    BPM = projectBPM; // Set global BPM

    stopAudio(); // Ensure any previous playback is stopped before starting new

    // Load all audio buffers
    const audioBuffers = await Promise.all(projectURLs.map(url => loadAudioFile(url)));

    // Check if there is at least one valid audio buffer to play
    if (!audioBuffers.some(buffer => buffer)) {
        return log("No valid audio data available for any channel. Cannot play audio.", true);
    }

    // Before scheduling new playback, ensure all previous sources are stopped.
    stopAudio();

    // Schedule playback for each channel and step, if data is available
    Object.entries(projectSequences).forEach(([sequenceName, channels]) => {
        Object.entries(channels).forEach(([channelName, channelData], channelIndex) => {
            const steps = channelData.steps;
            const audioBuffer = audioBuffers[channelIndex];
            const trimSetting = trimSettings[channelIndex];

            if (audioBuffer && steps) { // Check if both audio buffer and steps are available
                steps.forEach((active, stepIndex) => {
                    if (active) {
                        schedulePlaybackForStep(audioBuffer, trimSetting, stepIndex);
                    }
                });
            }
        });
    });

   // Reset the manual stop flag at the start of each new playback session
   isStoppedManually = false;
   customLog("Scheduled playback for active steps in available sequences and channels");
   // Directly check and handle looping here
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
    log("All audio playback stopped and sources disconnected");
};


const setupUIHandlers = () => {
    // Play button event listener
    document.getElementById('playButton').addEventListener('click', () => {
        isLooping = true; // Re-enable looping when play is pressed
        log('Play button pressed, attempting to start playback.');
        playAudio();
    });

    // Stop button event listener
    document.getElementById('stopButton').addEventListener('click', () => {
        isStoppedManually = true; // Indicate that stop was triggered manually
        log('Stop button pressed, calling stopAudio.');
        stopAudio();
    });

    // File input change event listener
    document.getElementById('fileInput').addEventListener('change', async (event) => {
        try {
            sequenceData = await processAndLoadAudio(event.target.files[0], loadAudioFile);
            if (sequenceData && sequenceData.projectURLs.some(url => url)) { // Check if there's at least one valid URL
                document.getElementById('playButton').disabled = false;
                log("File loaded successfully. Ready to play. Click the play button!");
            } else {
                log("No valid audio URLs found in the sequence data.", true);
                document.getElementById('playButton').disabled = true;
            }
        } catch (err) {
            document.getElementById('playButton').disabled = true;
            log(`Error processing sequence data: ${err}`, true);
        }
    });
};


// Initial setup
checkAudioContextSupport();
setupUIHandlers();
