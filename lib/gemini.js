
import groq from "./groq.js";

async function fetchWithRetry(url, options = {}, { maxRetries = 5, initialDelay = 1000 } = {}) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.ok) return res;

      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter) {
        const seconds = parseFloat(retryAfter);
        if (!Number.isNaN(seconds) && attempt < maxRetries - 1) {
          const waitMs = Math.max(0, seconds) * 1000;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }

     
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < maxRetries - 1) {
        const jitter = Math.floor(Math.random() * 500);
        const waitMs = initialDelay * Math.pow(2, attempt) + jitter;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

     
      return res;
    } catch (err) {
     
      if (attempt < maxRetries - 1) {
        const jitter = Math.floor(Math.random() * 500);
        const waitMs = initialDelay * Math.pow(2, attempt) + jitter;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

export async function analyzeText(text) {
  try {
    const message = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `Analyze the following feedback/comments and provide insights on sentiment, key issues, and recommendations:\n\n${text}`,
        },
      ],
    });

    if (!message || !message.choices || !message.choices[0] || !message.choices[0].message) {
      throw new Error("Groq API returned unexpected response format. Please check your API key and endpoint.");
    }

    const analysisText = message.choices[0].message.content || "No analysis available";

    return {
      analysis: analysisText,
      timestamp: new Date().toISOString(),
      type: "text",
    };
  } catch (error) {
    if (typeof error === "string" && error.startsWith("<")) {
      throw new Error("Groq API returned HTML instead of JSON. Check your API key and endpoint.");
    }
    console.error("Error analyzing text:", error);
    throw error;
  }
}

export async function analyzeFile(fileContent, fileName) {
  try {
    const message = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `Analyze the following file content (${fileName}) and provide insights on sentiment, key issues, and recommendations:\n\n${fileContent}`,
        },
      ],
    });

    if (!message || !message.choices || !message.choices[0] || !message.choices[0].message) {
      throw new Error("Groq API returned unexpected response format. Please check your API key and endpoint.");
    }

    const analysisText = message.choices[0].message.content || "No analysis available";

    return {
      analysis: analysisText,
      timestamp: new Date().toISOString(),
      type: "file",
      fileName: fileName,
    };
  } catch (error) {
    if (typeof error === "string" && error.startsWith("<")) {
      throw new Error("Groq API returned HTML instead of JSON. Check your API key and endpoint.");
    }
    console.error("Error analyzing file:", error);
    throw error;
  }
}

