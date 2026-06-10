import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE_KEY = 'gemini_api_key';
const DEFAULT_API_KEY = 'AIzaSyBwivwsKK_ljVTEF4e6AO9u8cr58DGtDOQ';

export async function getApiKey(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(API_KEY_STORAGE_KEY);
  return saved || DEFAULT_API_KEY;
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
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
    cleaned = cleaned.replace(/```$/i, '');
  }
  return cleaned.trim();
}

async function queryGemini(prompt: string, key?: string): Promise<string> {
  const apiKey = key || (await getApiKey());
  if (!apiKey) {
    throw new Error('API-ключ не задан. Перейдите в настройки и добавьте свой API-ключ.');
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
    throw new Error(errorData?.error?.message || 'Не удалось выполнить запрос к Gemini API.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Получен пустой ответ от Gemini API.');
  }

  return text;
}

export async function decomposeTask(title: string, description: string): Promise<string[]> {
  const prompt = `
    Проанализируй эту задачу и разбей ее на список из 3-8 последовательных конкретных шагов (подзадач) на РУССКОМ ЯЗЫКЕ.
    Название задачи: "${title}"
    Описание задачи: "${description || 'Описание отсутствует.'}"
    
    Выведи ответ СТРОГО в виде JSON-массива строк, например:
    ["Купить ингредиенты", "Подготовить овощи", "Сварить бульон"]
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
    Сделай краткое содержание этой заметки на РУССКОМ ЯЗЫКЕ в 1 или 2 емких предложениях. 
    Текст заметки: "${content}"
    
    Выведи ответ СТРОГО в виде JSON-объекта с единственным полем "summary", например:
    { "summary": "Здесь должен быть краткий пересказ заметки." }
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
    Проанализируй эту заметку и сгенерируй 2-4 подходящих хэштега (темы/категории) на РУССКОМ ЯЗЫКЕ, начинающихся со знака '#' (например, #работа, #кулинария, #покупки).
    Текст заметки: "${content}"
    
    Выведи ответ СТРОГО в виде JSON-объекта с единственным полем "tags", содержащим строку с тегами через запятую, например:
    { "tags": "#работа, #покупки" }
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
