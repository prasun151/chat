import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { ReactMic } from 'react-mic';
import './App.css';
import './index.css';

function App() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);

  // Refs
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const SYSTEM_PROMPT = `You are a specialized financial trading assistant using Gemini. You provide expert guidance on stocks, cryptocurrencies, funds, and digital assets. Analyze market trends, give numerical insights (P/E ratios, moving averages, RSI, MACD), and make data-backed recommendations. Maintain a confident, helpful, and slightly friendly tone.

When users ask specific financial questions, answer them directly. For non-financial topics, redirect politely with: "I'm here to help with financial guidance and trading insights. Is there something specific about markets or investments I can assist you with?"

Always provide step-by-step explanations whenever a user asks how to do something, so they can easily follow along.

Whenever a user asks about **asset tokenization**, first explain it briefly in context — for example:
"Asset tokenization is the process of converting rights to an asset into a digital token on a blockchain, enabling fractional ownership, seamless transfer, and greater liquidity."

Then follow with specific steps if they want to learn more about the tokenization process.`;

  // Clean up preview URL when recording starts
  useEffect(() => {
    if (isRecording && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [isRecording, previewUrl]);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => {
      clearInterval(timerRef.current);
    };
  }, [isRecording]);

  function formatTimestamp() {
    return new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }

  function formatRecordingTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  const playRecordingPreview = () => {
    if (recordingBlob && previewUrl) {
      const audio = new Audio(previewUrl);
      audio.play();
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const onData = (recordedData) => {
    // Visualize recording if needed
  };

  const onStop = (recordedBlob) => {
    console.log('Recording stopped:', recordedBlob);
    setRecordingBlob(recordedBlob.blob);
    
    // Create preview URL
    const url = URL.createObjectURL(recordedBlob.blob);
    setPreviewUrl(url);
  };

  const processAudio = async () => {
    if (!recordingBlob) {
      console.error('No recording blob available');
      return;
    }
    
    setIsProcessingAudio(true);
    
    try {
      console.log('Processing audio blob:', recordingBlob);
      
      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append('audio', recordingBlob, 'recording.webm');
      
      console.log('Sending request to STT API...');
      
      // Send the audio file to the server for STT processing
      const sttResponse = await axios.post('http://localhost:5000/api/speech-to-text', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('STT Response:', sttResponse.data);
      
      if (sttResponse.data && sttResponse.data.transcript) {
        const transcript = sttResponse.data.transcript;
        
        // Add the transcript as a user message
        const userMessage = { 
          type: 'user', 
          text: transcript, 
          timestamp: formatTimestamp() 
        };
        setMessages((prev) => [...prev, userMessage]);
        
        // Generate response using the transcript
        await generateResponseFromText(transcript);
      } else {
        console.error('No transcript returned from STT service');
        setMessages((prev) => [...prev, { 
          type: 'bot', 
          text: "I'm sorry, but I couldn't understand what you said. Could you please try again?", 
          timestamp: formatTimestamp() 
        }]);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      
      // More detailed error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      setMessages((prev) => [...prev, { 
        type: 'bot', 
        text: "I'm sorry, but there was an error processing your voice input. Please check if the backend server is running correctly and try again.", 
        timestamp: formatTimestamp() 
      }]);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const generateResponseFromText = async (inputText) => {
    setIsTyping(true);
    
    try {
      // Get the LLM response
      const llmResponse = await axios.post('http://localhost:5000/api/generate-response', {
        text: inputText
      });
      
      if (llmResponse.data && llmResponse.data.response) {
        const responseText = llmResponse.data.response;
        const messageId = Date.now().toString();
        
        // Add the bot response message
        const botMessage = { 
          type: 'bot', 
          text: responseText, 
          timestamp: formatTimestamp(),
          id: messageId,
          audioUrl: null
        };
        setMessages((prev) => [...prev, botMessage]);
        
        // Generate audio from the response text
        try {
          const ttsResponse = await axios.post('http://localhost:5000/api/text-to-speech', 
            { text: responseText },
            { responseType: 'blob' }
          );
          
          // Create an object URL for the audio blob
          const audioBlob = new Blob([ttsResponse.data], { type: 'audio/wav' });
          const url = URL.createObjectURL(audioBlob);
          
          // Update the message with the audio URL
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, audioUrl: url } 
              : msg
          ));
          
          setAudioUrl(url);
        } catch (error) {
          console.error('Error generating audio response:', error);
        }
      } else {
        setMessages((prev) => [...prev, { 
          type: 'bot', 
          text: "I apologize, but I encountered an error generating a response.", 
          timestamp: formatTimestamp() 
        }]);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages((prev) => [...prev, { 
        type: 'bot', 
        text: "I apologize, but I encountered an error. Please try your question again.", 
        timestamp: formatTimestamp() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateAnswer = useCallback(async () => {
    if (!question.trim()) return;

    const userMessage = { 
      type: 'user', 
      text: question, 
      timestamp: formatTimestamp() 
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    
    await generateResponseFromText(question);
  }, [question]);

  const toggleAudioPlayback = (audioUrl, messageId) => {
    if (audioRef.current) {
      // If we're already playing this message
      if (isPlaying && currentPlayingId === messageId) {
        audioRef.current.pause();
        setIsPlaying(false);
      } 
      // If we're playing a different message, stop that and play this one
      else {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
        setCurrentPlayingId(messageId);
      }
    }
  };

  // Handle audio ended event
  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    };
    
    if (audioElement) {
      audioElement.addEventListener('ended', handleEnded);
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('ended', handleEnded);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-app-black text-gray-100">
      <header className="p-5 bg-nav-blue shadow-md text-center text-3xl font-bold text-white tracking-wide transition-colors duration-200">
        Financial Trading Assistant
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scroll-smooth">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`group max-w-3xl px-5 py-4 rounded-2xl shadow-md whitespace-pre-wrap break-words leading-relaxed transform transition-all duration-200 ease-out hover:scale-[1.02] ${
              msg.type === 'user'
                ? 'bg-nav-blue text-white ml-auto'
                : 'bg-gray-800 text-gray-100 mr-auto border border-gray-700'
            }`}
          >
            <div className="flex flex-col gap-2">
              <ReactMarkdown>{msg.text}</ReactMarkdown>
              <div className="flex items-center justify-between">
                <span className="text-xs opacity-70">
                  {msg.timestamp}
                </span>
                {msg.type === 'bot' && msg.audioUrl && (
                  <button 
                    onClick={() => toggleAudioPlayback(msg.audioUrl, msg.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full ml-2"
                    title={isPlaying && currentPlayingId === msg.id ? "Pause" : "Play"}
                  >
                    {isPlaying && currentPlayingId === msg.id ? 
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg> :
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center space-x-2 max-w-[100px] bg-gray-800 rounded-2xl p-4 shadow-md">
            <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></span>
          </div>
        )}
        {isProcessingAudio && (
          <div className="flex items-center space-x-2 max-w-[200px] bg-blue-900 rounded-2xl p-4 shadow-md mr-auto">
            <span className="text-gray-100">Processing voice input...</span>
            <span className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></span>
          </div>
        )}
        <audio ref={audioRef} className="hidden" />
      </main>

      <footer className="bg-nav-blue p-4 border-t border-gray-700 flex flex-col gap-3">
        {isRecording && (
          <div className="flex items-center justify-between bg-red-800 p-3 rounded-xl text-white">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              <span>Recording... {formatRecordingTime(recordingTime)}</span>
            </div>
            <span className="text-xs text-red-300">Click the mic button again to stop</span>
          </div>
        )}
        
        {recordingBlob && !isRecording && !isProcessingAudio && (
          <div className="flex items-center justify-between bg-gray-800 p-3 rounded-xl">
            <span>Recording complete!</span>
            <div className="flex gap-2">
              <button 
                onClick={playRecordingPreview}
                className="px-3 py-1 bg-blue-700 text-white rounded-lg hover:bg-blue-800"
              >
                Preview
              </button>
              <button 
                onClick={processAudio}
                className="px-3 py-1 bg-green-700 text-white rounded-lg hover:bg-green-800"
              >
                Process
              </button>
              <button 
                onClick={() => {
                  setRecordingBlob(null);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }}
                className="px-3 py-1 bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about stocks, crypto, or any financial topics..."
            className="flex-1 resize-none rounded-xl border border-gray-600 p-3 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateAnswer();
              }
            }}
          />
          
          <div className="flex items-center gap-2">
            <ReactMic
              record={isRecording}
              className="hidden"
              onStop={onStop}
              onData={onData}
              mimeType="audio/webm"
              strokeColor="#3B82F6"
              backgroundColor="#1F2937"
            />
            
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingAudio}
              className={`p-2.5 rounded-xl shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } ${isProcessingAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={generateAnswer}
              disabled={isTyping || !question.trim()}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
