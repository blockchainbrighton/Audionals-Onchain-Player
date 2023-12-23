// index_v2.1.1.js


// Set up a single audio context for all channels (one context can handle multiple sources)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Ensure browser supports the Web Audio API
const checkAudioContextSupport = () => {
    if (!audioContext) {
        alert('Web Audio API is not supported in this browser');
    }
};

// Load and decode audio file from URL
const loadAudioFile = async (url) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
};

// Calculate trim times for an audio sample
const calculateTrimTimes = (trimSetting, totalDuration) => {
    const startTime = Math.max(0, Math.min((trimSetting.startSliderValue / 100) * totalDuration, totalDuration));
    const endTime = (trimSetting.endSliderValue / 100) * totalDuration;
    return { startTime, duration: Math.max(0, endTime - startTime) };
};

// Calculate time for each step based on BPM
const calculateStepTime = (BPM) => 60 / BPM / 4; // One sixteenth of a beat

// Create and start an audio source for a given channel
const createAndStartAudioSource = (buffer, trimSetting, playbackTime) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    const { startTime, duration } = calculateTrimTimes(trimSetting, buffer.duration);
    source.start(audioContext.currentTime + playbackTime, startTime, duration);
    return source;
};

// Play audio for a specific step in a sequence
const schedulePlaybackForStep = (buffer, trimSetting, stepIndex, BPM) => {
    const playbackTime = stepIndex * calculateStepTime(BPM);
    createAndStartAudioSource(buffer, trimSetting, playbackTime);
};

// Main function to play audio for all channels and steps
const playAudio = async (sequenceData) => {
    const { projectBPM, projectURLs, trimSettings, projectSequences } = sequenceData;
    const audioBuffers = await Promise.all(projectURLs.map(url => loadAudioFile(url)));

    Object.entries(projectSequences).forEach(([sequenceName, channels]) => {
        Object.entries(channels).forEach(([channelName, channelData], channelIndex) => {
            const steps = channelData.steps;
            const buffer = audioBuffers[channelIndex];
            const trimSetting = trimSettings[channelIndex];
            steps.forEach((active, stepIndex) => {
                if (active) {
                    schedulePlaybackForStep(buffer, trimSetting, stepIndex, projectBPM);
                }
            });
        });
    });

    log("Scheduled playback for active steps in all sequences and channels.");
};

// Set up UI handlers and initial setup
const setupUIHandlers = () => {
    document.getElementById('playButton').addEventListener('click', () => playAudio(sequenceData));
    document.getElementById('fileInput').addEventListener('change', async (event) => {
        try {
            const sequenceData = await processAndLoadAudio(event.target.files[0], loadAudioFile);
            document.getElementById('playButton').disabled = false;
            log("Ready to play. Click the play button!");
        } catch (err) {
            document.getElementById('playButton').disabled = true;
        }
    });
};

// Initial setup
checkAudioContextSupport();
setupUIHandlers();
