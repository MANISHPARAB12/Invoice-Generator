
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config({
  path: ".env.production",
});

const Connection = require("./Config/db");
const apiRoutes = require("./Routes");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use("/api", apiRoutes);

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Invoice Generator API is running",
  });
});

// Server Configuration
const PORT = process.env.PORT || 5000;

// Start server after MongoDB connection
const startServer = async () => {
  try {
    await Connection();

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
