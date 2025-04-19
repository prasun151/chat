# Financial Trading Assistant Chat

A voice-enabled chat application for financial advice using React for the frontend and Node.js for the backend. This application allows users to interact with a financial assistant via text or voice input, and receive both text and voice responses.

## Features

- Voice recording and speech-to-text conversion
- Text-to-speech for AI responses
- Responsive chat interface
- Financial domain-specific AI assistant
- Audio playback controls for each message

## Technology Stack

### Frontend
- React
- TailwindCSS
- ReactMarkdown
- React-Mic for voice recording
- Axios for API calls

### Backend
- Node.js & Express
- FFmpeg for audio processing
- Sarvam.ai APIs for speech-to-text and text-to-speech
- Google Gemini API for LLM responses

## Prerequisites

- Node.js (v16+ recommended)
- npm or pnpm
- FFmpeg (required for audio processing)

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/prasun151/chat.git
cd chat
```

### 2. Install dependencies
```bash
# Frontend dependencies
npm install
# or with pnpm
pnpm install

# Backend dependencies
cd backend
npm install
cd ..
```

### 3. Configure the environment
Create a `.env` file in the backend directory:
```
PORT=5000
SARVAM_API_KEY=your_sarvam_api_key
GOOGLE_API_KEY=your_gemini_api_key
```

### 4. Install FFmpeg
FFmpeg is required for audio processing:

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
Download from [FFmpeg's official website](https://ffmpeg.org/download.html) and add to PATH.

## Running the Application

### 1. Start the backend server
```bash
cd backend
node server.js
```

### 2. Start the frontend development server
```bash
# In a new terminal window
npm run dev
# or with pnpm
pnpm dev
```

### 3. Access the application
Open your browser and navigate to:
```
http://localhost:5173
```

## Usage

- Type a message in the input field and press Enter or click Send to submit
- Click the microphone icon to start recording your voice
- Click the microphone icon again to stop recording
- Use the Preview button to hear your recording
- Use the Process button to send the recording for analysis
- Play/pause audio responses using the button beside each bot message
- Ask questions about financial topics, trading strategies, market analysis, etc.

## License

MIT

## Acknowledgements

- [Sarvam.ai](https://sarvam.ai/) for speech-to-text and text-to-speech APIs
- [Google Gemini](https://ai.google.dev/) for the LLM API
