const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function sendRpc(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

async function handleGenerateContent(params, id) {
  try {
    const messages = params.messages || [];
    const openAiMessages = messages.map(m => {
      // Map ACP message format to OpenAI format
      let role = m.role === 'user' ? 'user' : 'assistant';
      let content = m.content || '';
      if (Array.isArray(m.content)) {
        content = m.content.map(c => c.text).join('\n');
      }
      return { role, content };
    });

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: openAiMessages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API Error');
    }

    const replyText = data.choices[0]?.message?.content || '';

    sendRpc({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: replyText }]
      }
    });
  } catch (error) {
    sendRpc({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error.message }
    });
  }
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    if (req.method === 'client.session.initialize') {
      sendRpc({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          clientInfo: { name: "openai-proxy", version: "1.0.0" },
          capabilities: { generateContent: {} }
        }
      });
    } else if (req.method === 'client.generateContent') {
      await handleGenerateContent(req.params, req.id);
    } else {
      // Dummy response for other required methods
      sendRpc({ jsonrpc: "2.0", id: req.id, result: {} });
    }
  } catch (e) {
    // Ignore parse errors
  }
});
