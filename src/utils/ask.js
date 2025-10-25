const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTE_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function askModel(model_id, text) {
  const prompt = `ধর তুমি একজন বাংলাদেশী ছাত্র। নিচের শব্দগুচ্ছ শুনলে তুমি কী বুঝবে উদাহরণ সহ কি বুঝছ সর্বোচ্চ ৫ বাক্যের মধ্যে উত্তর দাও।

শব্দগুচ্ছ : ${text}

অবস্যই ৫ বাক্যের কমে উত্তর দিবে। আজে বাজে কথা বলবে না।`;

  try {
    // console.log('Prompt sent to model:', prompt);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Probad Web App'
      },
      body: JSON.stringify({
        model: model_id,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error('No response from model');
    }
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    throw error;
  }
}
