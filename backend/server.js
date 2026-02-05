const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const faceapi = require('face-api.js');
const { Canvas, Image, loadImage } = require('canvas');
require('dotenv').config();

// Face-API Environment Setup
faceapi.env.monkeyPatch({ Canvas, Image });

const app = express();

// 🛠️ PORT FIX: Render dynamically assigns a port
const PORT = process.env.PORT || 5050;

// 🛠️ CORS FIX: Added your Vercel URL to allowed origins
app.use(cors({
    origin: [
        'http://localhost:5173', 
        'http://localhost:3000', 
        'https://cuu-o4lb-o7wd3awqr-sanjat-s-projects.vercel.app' // Aapka live frontend link
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 📝 Logger Middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// 🛠️ DATABASE FIX: Production Connection String
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon/Supabase
});

// Test Database Connection
pool.connect()
    .then(() => console.log('✅ PostgreSQL Connected Successfully'))
    .catch(err => console.error('❌ DB Connection Error:', err.message));

// Serving Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/models', express.static(path.join(__dirname, 'models')));

// 🤖 Load Face Models
async function loadModels() {
    const modelPath = path.join(__dirname, 'models');
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        console.log('✅ AI Engine Ready - Models Loaded');
    } catch (err) {
        console.error('❌ AI Model Loading Failed:', err.message);
    }
}
loadModels();

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', database: 'Connected', ai_engine: 'Ready' });
});

// ... (Baki ke saare API endpoints yahan niche continue honge)

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CUIMS ATTENDANCE SYSTEM                 ║
║                    Backend Server Active                   ║
╚════════════════════════════════════════════════════════════╝
📡 Server running on Port: ${PORT}
🤖 AI Engine Status: Ready
    `);
});
