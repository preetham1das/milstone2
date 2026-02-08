// Gemini API configuration and functions
const GEMINI_API_KEY = "AIzaSyCoKFBRuCa4B5Nkk9yYbKwsa3h3YR_-4tg"; // Using the same key from firebaseprofile
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function analyzeText(text) {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze the following feedback/comments and provide insights on sentiment, key issues, and recommendations:\n\n${text}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText =
      data.candidates[0]?.content?.parts[0]?.text || "No analysis available";

    return {
      analysis: analysisText,
      timestamp: new Date().toISOString(),
      type: "text",
    };
  } catch (error) {
    console.error("Error analyzing text:", error);
    throw error;
  }
}

export async function analyzeFile(fileContent, fileName) {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze the following file content (${fileName}) and provide insights on sentiment, key issues, and recommendations:\n\n${fileContent}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText =
      data.candidates[0]?.content?.parts[0]?.text || "No analysis available";

    return {
      analysis: analysisText,
      timestamp: new Date().toISOString(),
      type: "file",
      fileName: fileName,
    };
  } catch (error) {
    console.error("Error analyzing file:", error);
    throw error;
  }
}

export async function extractCSVData(fileContent) {
  // Simple CSV parsing - converts CSV to array of objects
  const lines = fileContent.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    data.push(row);
  }

  return data;
}
