// Define global variables
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffer, trimSettings, BPM, sequenceSteps;
const activeSources = [];

// Utility functions
const log = (message, isError = false) => console[isError ? 'error' : 'log'](message);

const checkAudioContextSupport = () => {
    if (!audioContext) {
        alert('Web Audio API is not supported in this browser');
    }
};

const validateAudioData = (data) => {
    if (!data.trimSettings || !data.projectSequences?.Sequence0?.ch0?.steps || data.projectSequences.Sequence0.ch0.steps.length !== 64 || !data.projectBPM) {
        throw new Error('Invalid or missing data in JSON');
    }
};

const loadAudioFile = async (url) => {
    if (!url) throw new Error('Invalid or missing projectURLs in JSON');
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
};

const readFileAsJSON = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(JSON.parse(e.target.result));
    reader.onerror = err => reject(err);
    reader.readAsText(file);
});

const calculateTrimTimes = () => {
    const totalDuration = audioBuffer.duration;
    const startTime = Math.max(0, Math.min((trimSettings.startSliderValue / 100) * totalDuration, totalDuration));
    const endTime = (trimSettings.endSliderValue / 100) * totalDuration;
    return { startTime, duration: Math.max(0, endTime - startTime) };
};

const calculateStepTime = () => 60 / BPM / 4; // One sixteenth of a beat

// Core functionality
const processAndLoadAudio = async (file) => {
    log(`Processing JSON file: ${file.name}`);
    try {
        const sequenceData = await readFileAsJSON(file);
        validateAudioData(sequenceData);
        [trimSettings, sequenceSteps, BPM, audioBuffer] = [
            sequenceData.trimSettings[0],
            sequenceData.projectSequences.Sequence0.ch0.steps,
            sequenceData.projectBPM,
            await loadAudioFile(sequenceData.projectURLs[0])
        ];
        document.getElementById('playButton').disabled = false;
        log("Ready to play. Click the play button!");
    } catch (err) {
        log('Error processing file:', true);
        document.getElementById('playButton').disabled = true;
    }
};

const createAndStartAudioSource = (playbackTime) => {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    const { startTime, duration } = calculateTrimTimes();
    source.start(audioContext.currentTime + playbackTime, startTime, duration);
    activeSources.push(source); // Keep track of the source for stopping later
    return source;
};

const schedulePlaybackForStep = (stepIndex) => {
    const playbackTime = stepIndex * calculateStepTime();
    createAndStartAudioSource(playbackTime);
};

const playAudio = () => {
    if (!audioBuffer || !trimSettings || !sequenceSteps) {
        return log("Playback attempt failed. Required components not ready", true);
    }
    stopAudio(); // Ensure any previous playback is stopped before starting new
    sequenceSteps.forEach((active, index) => active && schedulePlaybackForStep(index));
    log("Scheduled playback for active steps in the sequence");
};

const stopAudio = () => {
    activeSources.forEach(source => {
        if (source) {
            source.stop();
            source.disconnect(); // Disconnect the source to free up memory
        }
    });
    activeSources.length = 0; // Clear the array of active sources
    log("All audio playback stopped and sources disconnected");
};

const setupUIHandlers = () => {
    document.getElementById('playButton').addEventListener('click', playAudio);
    document.getElementById('stopButton').addEventListener('click', stopAudio);
    document.getElementById('fileInput').addEventListener('change', (event) => processAndLoadAudio(event.target.files[0]));
};

// Initial setup
checkAudioContextSupport();
setupUIHandlers();
