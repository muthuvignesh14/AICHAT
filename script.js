const chatGptUrl = 'https://chatgpt-42.p.rapidapi.com/gpt4';
const textToImageUrl = 'https://chatgpt-42.p.rapidapi.com/texttoimage';
const whisperUrl = 'https://chatgpt-42.p.rapidapi.com/whisperv3';
const ttsUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const apiKey = 'ecb3871e2fmshe8dd4401eb56904p19aeacjsn07fc60795acc';  // Replace this with your actual API key
const googleApiKey = 'YOUR_GOOGLE_API_KEY'; // Replace this with your Google API key for TTS

const sendButton = document.getElementById('send-button');
const imageButton = document.getElementById('image-button');
const audioButton = document.getElementById('audio-button');
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const canvas = document.getElementById('audio-visualizer');
const canvasCtx = canvas.getContext('2d');

let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let source;
let dataArray;
let bufferLength;

sendButton.addEventListener('click', async () => {
    const userText = userInput.value;
    if (!userText.trim()) return;

    handleChat(userText);
});

imageButton.addEventListener('click', async () => {
    const userText = userInput.value;
    if (!userText.trim()) return;

    handleImageGeneration(userText);
});

audioButton.addEventListener('mousedown', async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 2048;
                bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);

                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    audioChunks = [];
                    handleAudioUpload(audioBlob);
                    audioContext.close();
                    hideVisualizer();
                };
                mediaRecorder.start();
                visualize();
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
            });
    } else {
        console.error('getUserMedia not supported on your browser!');
    }
});

audioButton.addEventListener('mouseup', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
});

async function handleAudioUpload(audioBlob) {
    displayUserMessage('Audio recorded. Transcribing...');
    displayTypingIndicator();

    const data = new FormData();
    data.append('file', audioBlob, 'recorded_audio.wav');

    const options = {
        method: 'POST',
        headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'chatgpt-42.p.rapidapi.com'
        },
        body: data
    };

    try {
        const response = await fetch(whisperUrl, options);
        const result = await response.json();
        console.log(result);

        if (result.text) {
            handleChat(result.text);
        } else {
            console.error('Error: No text in the response');
            removeTypingIndicator();
        }
    } catch (error) {
        console.error(error);
        removeTypingIndicator();
    }
}

async function handleChat(userText) {
    displayUserMessage(userText);
    userInput.value = '';
    displayTypingIndicator();

    const options = {
        method: 'POST',
        headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'chatgpt-42.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [
                {
                    role: 'user',
                    content: userText
                }
            ],
            web_access: false
        })
    };

    try {
        const response = await fetch(chatGptUrl, options);
        const result = await response.json();
        console.log(result);

        if (result.status) {
            const botMessage = result.result;
            const botAudio = await convertTextToSpeech(botMessage);
            removeTypingIndicator(); // Ensure typing indicator is removed immediately
            displayBotMessage(botMessage);
            playAudio(botAudio);
        } else {
            console.error('Error: Server response status is false');
            removeTypingIndicator();
        }
    } catch (error) {
        console.error(error);
        removeTypingIndicator();
    }
}

async function handleImageGeneration(userText) {
    displayUserMessage(userText);
    userInput.value = '';
    displayTypingIndicator();

    const options = {
        method: 'POST',
        headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'chatgpt-42.p.rapidapi.com',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: userText })
    };

    try {
        const response = await fetch(textToImageUrl, options);
        const result = await response.json();
        console.log(result);

        if (result.generated_image) {
            const imageUrl = result.generated_image;
            removeTypingIndicator(); // Ensure typing indicator is removed immediately
            displayImageMessage(imageUrl);
        } else {
            console.error('Error: No generated image in the response');
            removeTypingIndicator();
        }
    } catch (error) {
        console.error(error);
        removeTypingIndicator();
    }
}

async function convertTextToSpeech(text) {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            input: { text: text },
            voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
            audioConfig: { audioEncoding: 'MP3' }
        })
    };

    try {
        const response = await fetch(`${ttsUrl}?key=${googleApiKey}`, options);
        const result = await response.json();
        console.log(result);

        if (result.audioContent) {
            const audioContent = result.audioContent;
            return audioContent;
        } else {
            console.error('Error: No audio content in the response');
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}

function playAudio(audioContent) {
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.play();
}

function displayUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';
    messageDiv.textContent = message;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function displayBotMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot';
    messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function displayImageMessage(imageUrl) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot';
    const imageElement = document.createElement('img');
    imageElement.src = imageUrl;
    imageElement.alt = 'Generated Image';
    imageElement.style.maxWidth = '100%';
    messageDiv.appendChild(imageElement);
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function displayTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-message bot typing';
    typingIndicator.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    chatWindow.appendChild(typingIndicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.querySelector('.typing');
    if (typingIndicator) {
        chatWindow.removeChild(typingIndicator);
    }
}

function visualize() {
    if (!analyser) return;

    canvas.style.display = 'block';
    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    function draw() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            requestAnimationFrame(draw);
        } else {
            canvas.style.display = 'none';
            return;
        }

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#252525';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#007bff';

        canvasCtx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    draw();
}

function hideVisualizer() {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
}
