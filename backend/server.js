const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const FormData = require('form-data');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Setup storage for audio files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `recording-${Date.now()}.webm`);
  }
});

const upload = multer({ storage });

// API key
const API_KEY = process.env.SARVAM_API_KEY;
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;

// Function to convert WebM to WAV using ffmpeg
const convertWebmToWav = (inputFile) => {
  const outputFile = inputFile.replace('.webm', '.wav');
  try {
    console.log(`Converting ${inputFile} to ${outputFile}`);
    execSync(`ffmpeg -i ${inputFile} -ar 16000 -ac 1 ${outputFile}`, { stdio: 'inherit' });
    
    if (!fs.existsSync(outputFile)) {
      console.error(`Conversion failed: Output file ${outputFile} does not exist!`);
      return null;
    }
    
    console.log(`Conversion successful: ${outputFile}`);
    return outputFile;
  } catch (error) {
    console.error('Error converting audio:', error.message);
    return null;
  }
};

// Function to split audio into chunks
const splitAudio = (inputFile, chunkLengthSeconds = 30) => {
  const outputDir = path.dirname(inputFile);
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const chunks = [];

  try {
    // Get audio duration
    console.log(`Getting duration for ${inputFile}`);
    const durationStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${inputFile}`).toString().trim();
    const duration = parseFloat(durationStr);
    
    console.log(`Total audio duration: ${duration} seconds`);
    
    // Split into chunks
    for (let i = 0; i < duration; i += chunkLengthSeconds) {
      const chunkName = path.join(outputDir, `${baseName}-chunk-${i}.wav`);
      const endTime = Math.min(i + chunkLengthSeconds, duration);
      
      console.log(`Creating chunk ${i}: ${chunkName} (${i} to ${endTime} seconds)`);
      execSync(`ffmpeg -v quiet -i ${inputFile} -ss ${i} -to ${endTime} -ar 16000 -ac 1 ${chunkName}`, { stdio: 'inherit' });
      
      if (!fs.existsSync(chunkName)) {
        console.error(`Chunk creation failed: ${chunkName} does not exist!`);
        continue;
      }
      
      chunks.push(chunkName);
    }
    
    return chunks;
  } catch (error) {
    console.error('Error splitting audio:', error.message);
    return [];
  }
};

// Function to send audio chunk to STT API
const audioToText = async (filePath) => {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    console.error(`Error: ${filePath} not found or empty!`);
    return '';
  }
  
  const url = 'https://api.sarvam.ai/speech-to-text';
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('model', 'saarika:v2');
  formData.append('language_code', 'en-IN'); // English only
  formData.append('with_timestamps', 'false');
  formData.append('with_diarization', 'false');
  formData.append('num_speakers', '1');
  
  try {
    console.log(`Sending STT request for ${filePath}`);
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'API-Subscription-Key': API_KEY
      }
    });
    
    if (response.status === 200) {
      console.log(`STT successful for ${filePath}: ${response.data.transcript?.substring(0, 50)}...`);
      return response.data.transcript || '';
    } else {
      console.error(`Error: ${response.status}, ${JSON.stringify(response.data)}`);
      return '';
    }
  } catch (error) {
    console.error('Error in STT API call:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return '';
  }
};

// Function to process long audio
const processLongAudio = async (inputFile) => {
  const chunks = splitAudio(inputFile);
  let finalTranscript = '';
  
  for (const chunk of chunks) {
    console.log(`Processing ${chunk}...`);
    const transcript = await audioToText(chunk);
    finalTranscript += transcript + ' ';
    
    // Clean up chunk file
    try {
      fs.unlinkSync(chunk);
    } catch (error) {
      console.error(`Error deleting chunk ${chunk}:`, error);
    }
  }
  
  return finalTranscript.trim();
};

// Function to split text for TTS
const splitText = (text, maxLength = 500) => {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = '';
  
  for (const word of words) {
    if ((currentChunk.length + word.length + 1) <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

// Function to convert text to speech
const textToSpeech = async (text) => {
  const url = 'https://api.sarvam.ai/text-to-speech';
  const textChunks = splitText(text);
  const audioFiles = [];
  
  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    const payload = {
      inputs: [chunk],
      target_language_code: 'en-IN',
      speaker: 'meera',
      pitch: 0,
      pace: 1.2,
      loudness: 1.5,
      speech_sample_rate: 8000,
      enable_preprocessing: false,
      model: 'bulbul:v1',
      eng_interpolation_wt: 123,
      override_triplets: {}
    };
    
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'api-subscription-key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200 && response.data.audios && response.data.audios.length > 0) {
        const audioData = Buffer.from(response.data.audios[0], 'base64');
        const audioFileName = path.join(__dirname, 'uploads', `tts_chunk_${i+1}.wav`);
        
        fs.writeFileSync(audioFileName, audioData);
        
        if (fs.statSync(audioFileName).size > 0) {
          audioFiles.push(audioFileName);
          console.log(`✅ TTS Chunk ${i+1} processed successfully!`);
        } else {
          console.log(`⚠️ Warning: ${audioFileName} is empty. Skipping...`);
          fs.unlinkSync(audioFileName);
        }
      } else {
        console.log(`❌ Error: API response missing 'audios' key or empty for chunk ${i+1}`);
      }
    } catch (error) {
      console.error(`❌ Error processing TTS Chunk ${i+1}:`, error.message);
    }
  }
  
  return audioFiles;
};

// Function to merge audio files
const mergeAudio = (audioFiles) => {
  if (!audioFiles.length) {
    console.log('No valid audio files to merge.');
    return null;
  }
  
  const outputFile = path.join(__dirname, 'uploads', `final_output_${Date.now()}.wav`);
  const fileList = path.join(__dirname, 'uploads', 'file_list.txt');
  
  try {
    // Create file list for ffmpeg
    const fileContent = audioFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(fileList, fileContent);
    
    // Merge using ffmpeg
    execSync(`ffmpeg -f concat -safe 0 -i ${fileList} -c copy ${outputFile}`, { stdio: 'inherit' });
    
    // Clean up
    fs.unlinkSync(fileList);
    audioFiles.forEach(file => fs.unlinkSync(file));
    
    return outputFile;
  } catch (error) {
    console.error('Error merging audio files:', error);
    return null;
  }
};

// Generate Gemini LLM response
const generateGeminiResponse = async (text) => {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  
  // Construct the prompt with system instructions and user query
  const FINANCIAL_ADVISOR_PROMPT = `You are a specialized financial trading assistant using Gemini. You provide expert guidance on stocks, cryptocurrencies, funds, and digital assets. Analyze market trends, give numerical insights (P/E ratios, moving averages, RSI, MACD), and make data-backed recommendations. Maintain a confident, helpful, and slightly friendly tone.

When users ask specific financial questions, answer them directly. For non-financial topics, redirect politely with: "I'm here to help with financial guidance and trading insights. Is there something specific about markets or investments I can assist you with?"

Always provide step-by-step explanations whenever a user asks how to do something, so they can easily follow along.

Whenever a user asks about asset tokenization, first explain it briefly in context — for example:
"Asset tokenization is the process of converting rights to an asset into a digital token on a blockchain, enabling fractional ownership, seamless transfer, and greater liquidity."

Then follow with specific steps if they want to learn more about the tokenization process.`;

  try {
    const response = await axios({
      url: `${url}?key=${GEMINI_API_KEY}`,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        contents: [{
          parts: [{ 
            text: `${FINANCIAL_ADVISOR_PROMPT}\n\nUser: ${text}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        }
      },
    });

    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      return response.data.candidates[0].content.parts[0].text
        .trim();
    } else {
      console.error('Unexpected API response structure:', JSON.stringify(response.data));
      return 'I apologize, but I encountered an error processing your request.';
    }
  } catch (error) {
    console.error('Error generating response:', error);
    return 'I apologize, but I encountered an error processing your request.';
  }
};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ENDPOINTS

// Speech-to-Text endpoint
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    console.log('Received audio file for processing');
    
    if (!req.file) {
      console.error('No audio file provided in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    console.log(`Audio file saved to ${req.file.path}`);
    
    // Check file exists and has size
    if (!fs.existsSync(req.file.path)) {
      console.error(`File does not exist: ${req.file.path}`);
      return res.status(500).json({ error: 'File upload failed' });
    }
    
    const fileSize = fs.statSync(req.file.path).size;
    console.log(`File size: ${fileSize} bytes`);
    
    if (fileSize === 0) {
      console.error('Uploaded file is empty');
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }
    
    // Convert WebM to WAV
    const wavFile = convertWebmToWav(req.file.path);
    if (!wavFile) {
      console.error('Error converting audio to WAV format');
      return res.status(500).json({ error: 'Error converting audio format' });
    }
    
    // Process long audio in chunks
    console.log('Starting audio transcription process');
    const transcript = await processLongAudio(wavFile);
    
    console.log(`Transcription result: ${transcript.substring(0, 100)}...`);
    
    // Clean up files
    try {
      fs.unlinkSync(req.file.path);
      fs.unlinkSync(wavFile);
    } catch (error) {
      console.error('Error cleaning up files:', error);
    }
    
    res.json({ transcript });
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    res.status(500).json({ error: 'Server error processing audio', details: error.message });
  }
});

// Text-to-Speech endpoint
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    // Generate speech in chunks
    const audioFiles = await textToSpeech(text);
    
    // Merge audio files
    const mergedFile = mergeAudio(audioFiles);
    
    if (!mergedFile) {
      return res.status(500).json({ error: 'Error merging audio files' });
    }
    
    // Send audio file
    res.sendFile(mergedFile, {}, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        return res.status(500).json({ error: 'Error sending audio file' });
      }
      
      // Clean up merged file after sending
      try {
        fs.unlinkSync(mergedFile);
      } catch (error) {
        console.error('Error deleting merged file:', error);
      }
    });
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    res.status(500).json({ error: 'Server error generating speech' });
  }
});

// Generate LLM response endpoint
app.post('/api/generate-response', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text input provided' });
    }
    
    // Generate response
    const response = await generateGeminiResponse(text);
    
    res.json({ response });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ error: 'Server error generating response' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 