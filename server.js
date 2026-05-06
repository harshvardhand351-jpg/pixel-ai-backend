import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import cloudinary from "./cloudinary.js";
import streamifier from "streamifier";

const app = express();
app.use(cors());
app.use(express.json());

// ================= HELPERS =================
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callGemini = async (userMessage, retries = 2) => {
  const API_KEY = process.env.GEMINI_API_KEY;
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: userMessage }],
                },
              ],
            }),
          }
        );

        const data = await response.json();

        // Rate limit hit — wait and retry
        if (data.error?.status === "RESOURCE_EXHAUSTED") {
          const delay = attempt * 20000; // 20s, then 40s
          console.warn(
            `⚠️ Rate limit hit on ${model}. Retrying in ${delay / 1000}s...`
          );
          await sleep(delay);
          continue;
        }

        // Other API error — try next model
        if (!response.ok) {
          console.warn(
            `⚠️ ${model} failed: ${data.error?.message}. Trying next model...`
          );
          break;
        }

        // Success
        const reply =
          data.candidates?.[0]?.content?.parts
            ?.map((part) => part.text)
            .join(" ") || "No response from AI";

        console.log(`✅ Response from ${model}`);
        return reply;
      } catch (err) {
        console.error(`❌ Error with ${model} (attempt ${attempt}):`, err);
        if (attempt === retries) break;
        await sleep(5000);
      }
    }
  }

  throw new Error("All models and retries exhausted");
};

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

// ================= CHAT ROUTE =================
app.post("/chat", async (req, res) => {
  console.log("🔥 CHAT ROUTE HIT");
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ reply: "Message is required" });
  }

  try {
    const reply = await callGemini(userMessage);
    res.json({ reply });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      reply: "AI is currently unavailable. Please try again later.",
    });
  }
});

// ================= CLOUDINARY UPLOAD =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "noteshub", resource_type: "auto" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload();
    res.json({ success: true, fileUrl: result.secure_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= PORT =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});