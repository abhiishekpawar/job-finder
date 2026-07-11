import type { AiProvider } from "@/lib/resumeChecker/types";

export async function callAiJson(options: {
  provider: AiProvider;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  if (options.provider === "groq") {
    return callGroq(options.apiKey, options.systemPrompt, options.userPrompt);
  }
  return callGemini(options.apiKey, options.systemPrompt, options.userPrompt);
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned empty content");
  return content;
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Groq failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty content");
  return content;
}
