import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 19103;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/log/visit", (req, res) => {
    console.log(`[VISIT] A user visited the site at ${new Date().toISOString()}`);
    res.json({ success: true });
  });

  app.post("/api/log/generate", (req, res) => {
    const { subjects, examDate } = req.body;
    console.log(`[GENERATE] A user generated a study plan for subjects: "${subjects}" (Exam Date: ${examDate}) at ${new Date().toISOString()}`);
    res.json({ success: true });
  });

  // Vite middleware for development
  const distPath = path.join(process.cwd(), "dist");
  const fs = await import("fs");
  
  if (process.env.NODE_ENV !== "production" || !fs.existsSync(distPath)) {
    console.log("Starting Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
