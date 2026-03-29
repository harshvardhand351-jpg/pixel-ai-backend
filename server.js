import express from "express";
import cors from "cors";

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
        }),
      }
    );

    const data = await response.json();
    console.log("FULL GEMINI RESPONSE:", data);

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Error connecting to AI" });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});