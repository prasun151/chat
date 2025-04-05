import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';
import './index.css';

function App() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);

  async function generateAnswer() {
    if (!question.trim()) return;

    const userMessage = { type: 'user', text: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');

    const loadingMessage = { type: 'bot', text: 'Typing...' };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const response = await axios({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDBsghymDQyElHIve3rcc1KH09nCjOSYfU",
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          contents: [
            {
              parts: [{ text: question }],
            },
          ],
        },
      });

      const rawAnswer = response.data.candidates[0].content.parts[0].text;
      const answer = rawAnswer
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{1,}/g, '\n')
        .trim();

      setMessages((prev) => [...prev.slice(0, -1), { type: 'bot', text: answer }]);
    } catch (error) {
      setMessages((prev) => [...prev.slice(0, -1), { type: 'bot', text: 'Something went wrong. Try again.' }]);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-cyan-50 to-white">
      <header className="p-5 bg-white shadow-md text-center text-3xl font-bold text-cyan-600 tracking-wide">
        ChatBot AI
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-3xl px-5 py-4 rounded-2xl shadow-md whitespace-pre-wrap break-words leading-relaxed ${msg.type === 'user'
              ? 'bg-cyan-600 text-white text-right self-end ml-auto'
              : 'bg-white text-gray-800 self-start mr-auto border border-gray-200'
              }`}
          >
            <ReactMarkdown>{msg.text}</ReactMarkdown>
          </div>
        ))}
      </main>

      <footer className="bg-white p-4 border-t flex items-center gap-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 resize-none rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm"
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
          className="bg-cyan-600 text-white px-5 py-2.5 rounded-xl hover:bg-cyan-700 transition shadow-md"
        >
          Send
        </button>
      </footer>
    </div>
  );
}

export default App;
