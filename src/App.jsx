import { useState, useCallback } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';
import './index.css';

function App() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const SYSTEM_PROMPT = `You are a specialized financial trading assistant using Gemini. You provide expert guidance on stocks, cryptocurrencies, funds, and digital assets. Analyze market trends, give numerical insights (P/E ratios, moving averages, RSI, MACD), and make data-backed recommendations. Maintain a confident, helpful, and slightly friendly tone.

When users ask specific financial questions, answer them directly. For non-financial topics, redirect politely with: "I'm here to help with financial guidance and trading insights. Is there something specific about markets or investments I can assist you with?"

Always provide step-by-step explanations whenever a user asks how to do something, so they can easily follow along.

Whenever a user asks about **asset tokenization**, first explain it briefly in context — for example:
"Asset tokenization is the process of converting rights to an asset into a digital token on a blockchain, enabling fractional ownership, seamless transfer, and greater liquidity."

Then follow with specific steps if they want to learn more about the tokenization process.`;

  function formatTimestamp() {
    return new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }

  const generateAnswer = useCallback(async () => {
    if (!question.trim()) return;

    const userMessage = { 
      type: 'user', 
      text: question, 
      timestamp: formatTimestamp() 
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setIsTyping(true);

    try {
      const response = await axios({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDBsghymDQyElHIve3rcc1KH09nCjOSYfU",
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          contents: [{
            parts: [{ 
              text: messages.length === 0 ? 
                `${SYSTEM_PROMPT}\n\nUser: ${question}` : 
                `${SYSTEM_PROMPT}\n\n${messages.map(msg => `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n')}\n\nUser: ${question}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
          }
        },
      });

      const rawAnswer = response.data.candidates[0].content.parts[0].text;
      const answer = rawAnswer
        .replace(/^Assistant:\s*/, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{1,}/g, '\n')
        .trim();

      setIsTyping(false);
      setMessages((prev) => [...prev, { 
        type: 'bot', 
        text: answer, 
        timestamp: formatTimestamp() 
      }]);
    } catch (error) {
      console.error('Error:', error);
      setIsTyping(false);
      setMessages((prev) => [...prev, { 
        type: 'bot', 
        text: 'I apologize, but I encountered an error. Please try your question again.',
        timestamp: formatTimestamp()
      }]);
    }
  }, [question, messages]);

  return (
    <div className="flex flex-col h-screen bg-app-black text-gray-100">
      <header className="p-5 bg-nav-blue shadow-md text-center text-3xl font-bold text-white tracking-wide transition-colors duration-200">
        Financial Assistant
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
              <span className={`text-xs opacity-70 ${
                msg.type === 'user' ? 'text-right' : 'text-left'
              }`}>
                {msg.timestamp}
              </span>
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
      </main>

      <footer className="bg-nav-blue p-4 border-t border-gray-700 flex items-center gap-3">
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
        <button
          onClick={generateAnswer}
          disabled={isTyping}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
        >
          Send
        </button>
      </footer>
    </div>
  );
}

export default App;
