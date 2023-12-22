// loadJsonFromLocal.js

const log = (message, isError = false) => console[isError ? 'error' : 'log'](message);

const validateAudioData = (data) => {
    if (!data.trimSettings || !data.projectSequences || !data.projectBPM) {
        throw new Error('Invalid or missing data in JSON');
    }
};

const readFileAsJSON = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(JSON.parse(e.target.result));
    reader.onerror = err => reject(err);
    reader.readAsText(file);
});

const countNamedSequences = (projectSequences) => {
    return Object.keys(projectSequences).filter(key => key.startsWith('Sequence')).length;
};

const getTotalChannelsWithUrls = (projectURLs) => {
    return projectURLs.filter(url => url.trim() !== "").length;
};

const logActiveStepArrays = (projectSequences) => {
    Object.entries(projectSequences).forEach(([sequenceName, channels]) => {
        Object.entries(channels).forEach(([channelName, channelData]) => {
            const steps = channelData.steps;
            if (steps && steps.includes(true)) {
                // Collect indices of true values
                const trueIndices = steps.map((step, index) => step ? index : null).filter(index => index !== null);
                // Log the sequence, channel, and true indices
                log(`${sequenceName}, ${channelName}, steps: ${trueIndices.join(', ')}`);
            }
        });
    });
};



const logSummaryDetails = (data) => {
    const { projectName, projectBPM, projectSequences, projectURLs } = data;
    const totalChannelsWithUrls = getTotalChannelsWithUrls(projectURLs);
    const totalNamedSequences = countNamedSequences(projectSequences);

    log(`This project is called - "${projectName}"`);
    log(`The project's BPM is - ${projectBPM}`);
    log(`Total number of channels with URLs - ${totalChannelsWithUrls}`);
    log(`Total number of named sequences - ${totalNamedSequences}`);
    logActiveStepArrays(projectSequences);
};

const processAndLoadAudio = async (file, loadAudioFile) => {
    log(`Processing JSON file: ${file.name}`);
    try {
        const sequenceData = await readFileAsJSON(file);
        validateAudioData(sequenceData);
        logSummaryDetails(sequenceData);
        return sequenceData;
    } catch (err) {
        log('Error processing file:', true);
        throw err;
    }
};
