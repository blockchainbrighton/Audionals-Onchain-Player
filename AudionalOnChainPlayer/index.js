// Define global variables
let audioContext;
let audioBuffers = {}; // To store loaded audio buffers
let sequenceData; // To store JSON data
let playbackInterval; // For timing control
let currentStep = 0; // Current step in the sequence

// Initialize the Web Audio API
function initAudioContext() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    } catch (e) {
        alert('Web Audio API is not supported in this browser');
    }
}

// Process JSON file selected by the user
function processJSONFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        sequenceData = JSON.parse(e.target.result);
        loadAudioFiles();
    };
    reader.readAsText(file);
}

// Load audio files
async function loadAudioFiles() {
    const promises = sequenceData.projectURLs.map(async (url, index) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffers[index] = await audioContext.decodeAudioData(arrayBuffer);
    });

    try {
        await Promise.all(promises);
        console.log('All audio files loaded');
    } catch (e) {
        console.error('Error loading audio files: ', e);
    }
}

// Play the sequence
function playSequence() {
    console.log("playSequence called");
    if (!audioContext) {
        console.log("Initializing AudioContext");
        initAudioContext();
    }

    // Ensure we're starting from the first step
    currentStep = 0;

    playbackInterval = setInterval(playStep, calculateStepInterval());
}

// Stop the sequence
function stopSequence() {
    clearInterval(playbackInterval);
}

// Function to play audio at a specific step
function playStep() {
    const currentSequence = sequenceData.projectSequences['Sequence' + sequenceData.currentSequence];

    Object.keys(currentSequence).forEach(channelKey => {
        const channel = currentSequence[channelKey];
        if (channel.steps[currentStep] && !channel.mute) {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[channelKey];
            source.connect(audioContext.destination);
            source.start(0);
        }
    });

    currentStep = (currentStep + 1) % 64; // Assuming each channel has 64 steps
}

// Calculate the interval between steps based on BPM
function calculateStepInterval() {
    return (60 / sequenceData.projectBPM) * 1000; // Interval in milliseconds
}

// UI Button Handlers
document.getElementById('playButton').addEventListener('click', playSequence);
document.getElementById('stopButton').addEventListener('click', stopSequence);

// File Input Handler
document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    processJSONFile(file);
});

// Initialize the Web Audio API
document.getElementById('playButton').addEventListener('click', initAudioContext);