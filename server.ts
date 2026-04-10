import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETBOTS_API_KEY = process.env.ASSETBOTS_API_KEY || "DCF2F6B8271E80F20152F2695B5F1DDD";
const ASSETBOTS_BASE_URL = "https://api.assetbots.com/v2";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Barcode Scan
  app.post("/api/scan", async (req, res) => {
    const { barcode, action } = req.body;

    if (!barcode || !action) {
      return res.status(400).json({ error: "Barcode and action are required" });
    }

    try {
      // Corrected Assetbots API endpoints and request body field
      const endpoint = action === "check-in" ? "check-in" : "check-out";
      const response = await axios.post(`${ASSETBOTS_BASE_URL}/assets/actions/${endpoint}`, {
        id: barcode, // Using 'id' instead of 'barcode'
        timestamp: new Date().toISOString()
      }, {
        headers: {
          "X-Api-Key": ASSETBOTS_API_KEY,
          "Content-Type": "application/json"
        }
      });

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Assetbots API Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to communicate with Assetbots", 
        details: error.response?.data || error.message 
      });
    }
  });

  // Scheduled Task: Daily Overdue Check
  // Runs every day at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("Running daily overdue items check...");
    try {
      // Corrected overdue check endpoint (using filter parameter)
      const response = await axios.get(`${ASSETBOTS_BASE_URL}/assets`, {
        params: { overdue: true },
        headers: {
          "X-Api-Key": ASSETBOTS_API_KEY
        }
      });

      const overdueItems = response.data;
      if (overdueItems && overdueItems.length > 0) {
        console.log(`Found ${overdueItems.length} overdue items. Sending alerts...`);
        // In a real app, you'd send an email here (e.g., via SendGrid or Postmark)
        // For this demo, we'll log it.
      }
    } catch (error) {
      console.error("Scheduled Task Error:", error);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
