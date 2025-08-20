import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "#routes/index.js";
const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:8080",
        "http://localhost:5173", // Vite default port
        "http://localhost:3000"  // Alternative frontend port
    ],
    credentials: true
}));

// Test endpoint to verify server is running
app.get("/", (req, res) => {
    res.json({ message: "Voice Assistant Backend Server is running!" });
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || "development"
    });
});

// API routes
app.use("/api/v1", router);

// 404 handler for unmatched routes
app.use("*", (req, res) => {
    res.status(404).json({
        error: "Route not found",
        path: req.originalUrl,
        availableRoutes: [
            "GET /",
            "GET /health",
            "POST /api/v1/auth/register",
            "POST /api/v1/auth/login",
            "GET /api/v1/auth/me",
            "POST /api/v1/auth/logout",
            "GET /api/v1/agents/test",
            "GET /api/v1/agents",
            "POST /api/v1/agents",
            "GET /api/v1/agents/:agentId",
            "PUT /api/v1/agents/:agentId",
            "DELETE /api/v1/agents/:agentId",
            "GET /api/v1/analytics/agents",
            "GET /api/v1/analytics/calls",
            "POST /api/v1/calls/start",
            "POST /api/v1/calls/end",
            "GET /api/v1/calls/history"
        ]
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: "Internal server error",
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api/v1`);
    console.log(`🔍 Health check at http://localhost:${PORT}/health`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:8080"}`);
});





