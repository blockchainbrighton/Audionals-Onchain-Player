// Define global variables
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioBuffers = []; // Array to hold multiple audio buffers
let trimSettingsList = []; // Array to hold multiple trim settings
let sequenceStepsList = []; // Array to hold multiple sets of sequence steps
let BPM;
const activeSources = [];

// Utility functions
const log = (message, isError = false) => console[isError ? 'error' : 'log'](message);

const checkAudioContextSupport = () => {
    if (!audioContext) {
        alert('Web Audio API is not supported in this browser');
    }
};

const validateAudioData = (data) => {
    if (!data.trimSettings || !data.projectSequences || !data.projectBPM) {
        throw new Error('Invalid or missing data in JSON');
    }
};

const loadAudioFiles = async (urls) => {
    const promises = urls.map(async (url, index) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return audioContext.decodeAudioData(arrayBuffer);
        } catch (err) {
            throw new Error(`Error loading audio file at index ${index} (${url}): ${err.message}`);
        }
    });
    return Promise.all(promises);
};


const readFileAsJSON = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(JSON.parse(e.target.result));
    reader.onerror = err => reject(err);
    reader.readAsText(file);
});

const calculateTrimTimes = (audioBuffer, trimSetting) => {
    const totalDuration = audioBuffer.duration;
    const startTime = Math.max(0, Math.min((trimSetting.startSliderValue / 100) * totalDuration, totalDuration));
    const endTime = (trimSetting.endSliderValue / 100) * totalDuration;
    return { startTime, duration: Math.max(0, endTime - startTime) };
};

const calculateStepTime = () => 60 / BPM / 4; // One sixteenth of a beat

// Core functionality
const processAndLoadAudio = async (file) => {
    log(`Processing JSON file: ${file.name}`);
    try {
        if (!file) {
            throw new Error('No file provided');
        }

        const sequenceData = await readFileAsJSON(file);

        // Validate the necessary data is present
        validateAudioData(sequenceData);
        if (!sequenceData.projectURLs || sequenceData.projectURLs.length === 0) {
            throw new Error('No audio URLs found in the JSON data');
        }

        // Assign data from JSON to variables
        BPM = sequenceData.projectBPM;
        trimSettingsList = sequenceData.trimSettings;
        sequenceStepsList = Object.values(sequenceData.projectSequences).map(seq => seq.ch0.steps);

        // Load audio files
        audioBuffers = await loadAudioFiles(sequenceData.projectURLs);

        document.getElementById('playButton').disabled = false;
        log("Ready to play. Click the play button!");
    } catch (err) {
        log(`Error processing file: ${err.message}`, true);
        document.getElementById('playButton').disabled = true;
    }
};


const createAndStartAudioSource = (audioBuffer, trimSetting, playbackTime) => {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    const { startTime, duration } = calculateTrimTimes(audioBuffer, trimSetting);
    source.start(audioContext.currentTime + playbackTime, startTime, duration);
    activeSources.push(source); // Keep track of the source for stopping later
    return source;
};

const schedulePlaybackForStep = (audioBuffer, trimSetting, stepIndex) => {
    const playbackTime = stepIndex * calculateStepTime();
    createAndStartAudioSource(audioBuffer, trimSetting, playbackTime);
};

const playAudio = () => {
    if (!audioBuffers.length || !trimSettingsList.length || !sequenceStepsList.length) {
        return log("Playback attempt failed. Required components not ready", true);
    }
    stopAudio(); // Ensure any previous playback is stopped before starting new
    sequenceStepsList.forEach((sequenceSteps, idx) => {
        sequenceSteps.forEach((active, stepIndex) => {
            if (active) {
                schedulePlaybackForStep(audioBuffers[idx], trimSettingsList[idx], stepIndex);
            }
        });
    });
    log("Scheduled playback for active steps in the sequences");
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
