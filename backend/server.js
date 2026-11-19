
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config({
  path: ".env.production",
});

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("JWT_SECRET loaded:", !!process.env.JWT_SECRET);

const Connection = require("./Config/db");
const apiRoutes = require("./Routes");

const app = express();

// Allowed frontend URLs
const allowedOrigins = [
  "https://invoice-generator-five-ashen.vercel.app",
  "http://localhost:5173",
];

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Invoice Generator API is running",
  });
});

// Temporary deployment test
app.get("/test-auth", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend routing is working",
  });
});

// API routes
app.use("/", apiRoutes);

// Server configuration
const PORT = process.env.PORT || 5000;

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
