import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE_KEY = 'gemini_api_key';

export async function getApiKey(): Promise<string | null> {
  return await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
}

export async function saveApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export async function testApiKey(key: string): Promise<boolean> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Respond with OK.' }]
        }]
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper to strip markdown code blocks if the model includes them in JSON output
function cleanJson(text: string): string {
  let cleaned = text.trim();
  // Strip opening markdown tags e.g. ```json or ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
    // Strip closing markdown tags e.g. ```
    cleaned = cleaned.replace(/```$/i, '');
  }
  return cleaned.trim();
}

async function queryGemini(prompt: string, key?: string): Promise<string> {
  const apiKey = key || (await getApiKey());
  if (!apiKey) {
    throw new Error('API key is not set. Go to settings and add your API key.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Failed to generate content from Gemini API.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini API.');
  }

  return text;
}

export async function decomposeTask(title: string, description: string): Promise<string[]> {
  const prompt = `
    Analyze this task and break it down into a list of 3 to 8 actionable, sequential subtasks.
    Task Title: "${title}"
    Task Description: "${description || 'No description provided.'}"
    
    Format the output strictly as a JSON array of strings, for example:
    ["Subtask 1", "Subtask 2", "Subtask 3"]
  `;

  try {
    const responseText = await queryGemini(prompt);
    const cleanedText = cleanJson(responseText);
    const parsed = JSON.parse(cleanedText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error('Error decomposing task:', error);
    throw error;
  }
}

export async function summarizeNote(content: string): Promise<string> {
  const prompt = `
    Summarize this note in 1 or 2 clear, concise sentences. 
    Note content: "${content}"
    
    Format the output strictly as a JSON object with a single "summary" field, for example:
    { "summary": "Your generated summary text goes here." }
  `;

  try {
    const responseText = await queryGemini(prompt);
    const cleanedText = cleanJson(responseText);
    const parsed = JSON.parse(cleanedText);
    return parsed?.summary || '';
  } catch (error) {
    console.error('Error summarizing note:', error);
    throw error;
  }
}

export async function tagNote(content: string): Promise<string> {
  const prompt = `
    Analyze this note content and generate 2 to 4 relevant tags (categories/topics) starting with '#' (e.g. #work, #study, #shopping).
    Note content: "${content}"
    
    Format the output strictly as a JSON object with a single "tags" field containing a comma-separated string, for example:
    { "tags": "#work, #shopping" }
  `;

  try {
    const responseText = await queryGemini(prompt);
    const cleanedText = cleanJson(responseText);
    const parsed = JSON.parse(cleanedText);
    return parsed?.tags || '';
  } catch (error) {
    console.error('Error tagging note:', error);
    throw error;
  }
}
