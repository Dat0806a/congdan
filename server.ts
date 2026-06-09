import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini SDK lazily - safe pattern if key is missing during startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY || "AIzaSyD3jh6weo_SahKC5304uKn3HqB6f1X7uBQ";
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API endpoint for Chat fallback (statically served asset)
app.use("/video", express.static(path.join(process.cwd(), "public/video")));

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getGeminiClient();
    
    // Map our frontend message history structure to Gemini's expected contents structure
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      });
    }
    
    // Append the current message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const systemInstruction = 
      "Bạn là một Trợ lý Công dân thông thái (Trợ lý hành chính công, tư vấn dịch vụ công trực tuyến, " +
      "hướng dẫn làm giấy tờ, thủ tục hành chính như đăng ký khai sinh, căn cước công dân, hộ chiếu, bảo hiểm, đất đai, thuế...). " +
      "Hãy trả lời một cách cực kỳ lịch sự, chu đáo, ấm áp, kiên nhẫn và chính xác. Trình bày nội dung đẹp đẽ, rõ ràng, " +
      "sử dụng các gạch đầu dòng, các bước hành động cụ thể để người dân dễ hiểu. Gọi người dùng là 'quý công dân' hoặc 'anh/chị', " +
      "xưng là 'Tôi' hoặc 'Trợ lý'. Luôn động viên nhiệt tình và thiện chí giúp đỡ.";

    // Call the Gemini model with fallback models in case of high demand (503) or rate limits
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
    let responseText = "";
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Attempting content generation using model: ${model}`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        if (response && response.text) {
          responseText = response.text;
          break; // Successfully got response, stop loop
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed with error:`, err?.message || err);
        // Continue to the next fallback model
      }
    }

    if (!responseText && lastError) {
      throw lastError; // If both models fail, propagate the last error
    }

    const reply = responseText || "Xin lỗi quý công dân, tôi chưa thể tìm thấy giải pháp cho vấn đề này vào lúc này. Xin hay thử lại sau.";
    res.json({ reply });
  } catch (error: any) {
    console.error("Error generating content:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi xử lý câu hỏi của quý công dân. Vui lòng liên hệ lại sau ít phút." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
