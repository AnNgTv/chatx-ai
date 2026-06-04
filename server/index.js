import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Initialize AI Clients
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.CLAUDE_API_KEY ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY }) : null;
const grok = process.env.GROK_API_KEY ? new OpenAI({ 
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1"
}) : null;

// AI Proxy Routes
app.post('/api/ai/chat', async (req, res) => {
  const { model, message } = req.body;

  try {
    let responseText = "";

    switch (model) {
      case 'gemini':
        if (!genAI) throw new Error("Gemini API key not configured");
        const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const geminiResult = await geminiModel.generateContent(message);
        responseText = geminiResult.response.text();
        break;

      case 'gpt-4o':
        if (!openai) throw new Error("OpenAI API key not configured");
        const gptRes = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: message }],
        });
        responseText = gptRes.choices[0].message.content;
        break;

      case 'claude':
        if (!anthropic) throw new Error("Claude API key not configured");
        const claudeRes = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: message }],
        });
        responseText = claudeRes.content[0].text;
        break;

      case 'grok':
        if (!grok) throw new Error("Grok API key not configured");
        const grokRes = await grok.chat.completions.create({
          model: "grok-beta", // Adjust based on current xAI models
          messages: [{ role: "user", content: message }],
        });
        responseText = grokRes.choices[0].message.content;
        break;

      case 'ollama':
        try {
          const ollamaRes = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3',
            prompt: message,
            stream: false
          });
          responseText = ollamaRes.data.response;
        } catch (err) {
          responseText = "[Ollama] Local Ollama server not reachable.";
        }
        break;

      default:
        responseText = "Unknown AI model.";
    }

    res.json({ response: responseText });
  } catch (error) {
    console.error('AI Proxy Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch AI response' });
  }
});

app.get('/health', (req, res) => {
  res.send('ChatX Server is running');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('send-message', (data) => {
    io.emit('receive-message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
