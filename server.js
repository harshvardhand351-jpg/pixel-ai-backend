import express from "express";
import cors from "cors";
import multer from "multer";
import cloudinary from "./cloudinary.js";
import streamifier from "streamifier";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is working ✅");
});

app.post("/chat", async (req, res) => {
  console.log("🔥 CHAT ROUTE HIT");

  const userMessage = req.body.message;
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: userMessage,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log(JSON.stringify(data, null, 2));

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(" ") || "No response from AI";

    res.json({ reply });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      reply: "Error connecting to AI",
    });
  }
});

// ================= CLOUDINARY UPLOAD =================

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {

    const streamUpload = () => {
      return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "noteshub",
            resource_type: "auto",
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload();

    res.json({
      success: true,
      fileUrl: result.secure_url,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ================= PORT =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});