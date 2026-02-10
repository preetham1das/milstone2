import { analyzeText, analyzeFile } from "@/lib/gemini";

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, text, fileContent, fileName } = body;

    if (type === "text") {
      if (!text) {
        return Response.json({ error: "Text is required" }, { status: 400 });
      }
      try {
        const result = await analyzeText(text);
        return Response.json(result);
      } catch (err) {
        console.error("analyzeText error:", err);
        return Response.json(
          { error: err.message || "Text analysis failed" },
          { status: 500 }
        );
      }
    } else if (type === "file") {
      if (!fileContent || !fileName) {
        return Response.json(
          { error: "File content and name are required" },
          { status: 400 }
        );
      }
      try {
        const result = await analyzeFile(fileContent, fileName);
        return Response.json(result);
      } catch (err) {
        console.error("analyzeFile error:", err);
        return Response.json(
          { error: err.message || "File analysis failed" },
          { status: 500 }
        );
      }
    } else {
      return Response.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("API route error:", error);
    return Response.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  }
}
