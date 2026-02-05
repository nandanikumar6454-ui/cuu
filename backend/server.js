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
const PORT = 5050;

// Middleware
app.use(cors({
    origin: ['https://cuu-o4lb-bpif4f8nk-sanjat-s-projects.vercel.app', 'http://localhost:5173', 'http://localhost:5000', 'https://your-project-name.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 📝 CUSTOM TERMINAL LOGGER: Prints every action for live monitoring
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const timestamp = new Date().toLocaleTimeString('en-IN', { hour12: true });
        console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Static Folder for Images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                uid VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255),
                section VARCHAR(50),
                face_embedding TEXT,
                profile_pic TEXT, 
                face_ready BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'PRESENT',
                subject VARCHAR(100),
                lecture_slot VARCHAR(50),
                date DATE DEFAULT CURRENT_DATE,
                captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_attendance_per_slot UNIQUE(student_id, date, lecture_slot)
            );
        `);
        
        // NEW: Table for unknown face logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS unknown_face_logs (
                id SERIAL PRIMARY KEY,
                section VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                image_path TEXT,
                processed BOOLEAN DEFAULT FALSE,
                face_descriptor TEXT
            );
        `);
        
        console.log('✅ CUIMS Database Schema Verified');
    } catch (err) {
        console.error('❌ Schema Error:', err.message);
    }
};

pool.connect((err) => {
    if (err) {
        console.error('❌ DB Connection Error:', err.stack);
        process.exit(1);
    } else { 
        console.log('✅ PostgreSQL Connected'); 
        initDB(); 
    }
});

const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// AI Model Loading
const loadModels = async () => {
    const modelPath = path.join(__dirname, 'models');
    try {
        console.log('🔄 Loading AI models from:', modelPath);
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        console.log('✅ AI Engine Ready - Face Detection Models Loaded');
    } catch (err) {
        console.error('❌ Model Loading Failed:', err.message);
        console.error('Please ensure models are in the "models" directory:');
        console.error('Required files:');
        console.error('  - ssd_mobilenetv1_model-weights_manifest.json');
        console.error('  - face_landmark_68_model-weights_manifest.json');
        console.error('  - face_recognition_model-weights_manifest.json');
        console.error('Download from: https://github.com/justadudewhohacks/face-api.js#models');
    }
};
loadModels();

const authenticateToken = (req, res, next) => {
    // For now, using dummy authentication
    // In production, use JWT tokens
    req.user = { id: 1, role: 'admin' }; 
    next();
};

// ==================== ROUTES ====================

// 1. Enrollment (Manual)
app.post('/api/admin/enroll-with-face', authenticateToken, upload.single('image'), async (req, res) => {
    let tempPath = req.file ? req.file.path : null;
    try {
        const { uid, name, email, section } = req.body;
        
        if (!uid || !name || !section) {
            return res.status(400).json({ 
                success: false, 
                message: "UID, name, and section are required." 
            });
        }
        
        const fileName = `${uid.toUpperCase()}_${Date.now()}.jpg`;
        const permanentPath = path.join(__dirname, 'uploads', 'students', fileName);
        
        // Create students directory if it doesn't exist
        const studentsDir = path.join(__dirname, 'uploads', 'students');
        if (!fsSync.existsSync(studentsDir)) {
            await fs.mkdir(studentsDir, { recursive: true });
        }
        
        await fs.rename(tempPath, permanentPath);
        const img = await loadImage(permanentPath);
        const detection = await faceapi.detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();
        
        if (!detection) {
            await fs.unlink(permanentPath);
            return res.status(400).json({ 
                success: false, 
                message: "Face not detected in the image." 
            });
        }

        const faceEmbedding = JSON.stringify(Array.from(detection.descriptor));
        const profilePicPath = `/uploads/students/${fileName}`;
        
        await pool.query(`
            INSERT INTO students (uid, name, email, section, face_embedding, profile_pic, face_ready) 
            VALUES ($1, $2, $3, $4, $5, $6, TRUE) 
            ON CONFLICT (uid) DO UPDATE SET 
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            section = EXCLUDED.section,
            face_embedding = EXCLUDED.face_embedding,
            face_ready = TRUE,
            profile_pic = EXCLUDED.profile_pic`,
            [uid.toUpperCase(), name, email, section, faceEmbedding, profilePicPath]
        );
        
        console.log(`✅ Enrolled student: ${name} (${uid})`);
        
        res.json({ 
            success: true, 
            message: `Student ${name} (${uid}) enrolled successfully.` 
        });
    } catch (err) {
        console.error('❌ Enrollment error:', err);
        
        // Clean up temp file if exists
        if (tempPath && fsSync.existsSync(tempPath)) {
            await fs.unlink(tempPath).catch(() => {});
        }
        
        res.status(500).json({ 
            success: false, 
            error: err.message,
            message: "Student enrollment failed."
        });
    }
});

// 2. ENHANCED: Attendance Group Sync (AI) with better error handling
app.post('/api/attendance/group-recognition', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ 
            success: false, 
            message: "No image file uploaded." 
        });
    }
    
    try {
        const { section, subject, slot, date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        console.log(`🎯 Processing group recognition for:`, {
            section,
            subject,
            slot,
            date: targetDate,
            imageSize: `${(req.file.size / 1024).toFixed(2)} KB`
        });
        
        // Load the captured image
        const capturedImg = await loadImage(req.file.path);
        const detections = await faceapi.detectAllFaces(capturedImg)
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        console.log(`👥 Detected ${detections.length} face(s) in the image`);
        
        // Get all students from the section
        const students = await pool.query(
            `SELECT id, uid, name, face_embedding, face_ready 
             FROM students 
             WHERE section = $1 AND face_ready = TRUE 
             AND face_embedding IS NOT NULL 
             AND face_embedding != ''`,
            [section]
        );
        
        console.log(`📚 Found ${students.rows.length} registered student(s) in section ${section}`);
        
        let recognizedCount = 0;
        let unknownFaces = [];
        const recognizedStudents = [];
        
        // Process each detected face
        for (const [index, detection] of detections.entries()) {
            let bestMatch = null;
            let bestDistance = Infinity;
            let matchedStudent = null;
            
            // Try to match with registered students
            for (let student of students.rows) {
                try {
                    if (!student.face_embedding || student.face_embedding.trim() === '') {
                        continue;
                    }
                    
                    const storedDescriptor = new Float32Array(JSON.parse(student.face_embedding));
                    const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);
                    
                    if (distance < 0.45 && distance < bestDistance) {
                        bestDistance = distance;
                        bestMatch = student;
                        matchedStudent = {
                            id: student.id,
                            uid: student.uid,
                            name: student.name,
                            distance: distance
                        };
                    }
                } catch (parseError) {
                    console.warn(`⚠️ Error parsing descriptor for ${student.uid}:`, parseError.message);
                    continue;
                }
            }
            
            if (bestMatch && matchedStudent) {
                // Mark attendance for recognized student
                recognizedCount++;
                console.log(`✅ Recognized: ${bestMatch.name} (${bestMatch.uid}) - Distance: ${bestDistance.toFixed(4)}`);
                
                recognizedStudents.push(matchedStudent);
                
                try {
                    await pool.query(
                        `INSERT INTO attendance_logs (student_id, status, date, subject, lecture_slot) 
                         VALUES ($1, 'PRESENT', $2, $3, $4) 
                         ON CONFLICT (student_id, date, lecture_slot) 
                         DO UPDATE SET status = 'PRESENT', captured_at = CURRENT_TIMESTAMP`,
                        [bestMatch.id, targetDate, subject, slot]
                    );
                } catch (dbError) {
                    console.error(`❌ Database error for ${bestMatch.uid}:`, dbError.message);
                }
            } else {
                // This is an unknown face
                console.log(`⚠️ Unknown face detected #${index + 1} (Score: ${detection.detection.score.toFixed(3)})`);
                
                // Save face descriptor for unknown face
                const faceDescriptor = JSON.stringify(Array.from(detection.descriptor));
                
                unknownFaces.push({
                    faceIndex: index + 1,
                    confidence: detection.detection.score,
                    timestamp: new Date().toISOString(),
                    descriptor: faceDescriptor
                });
                
                // Save unknown face log to database with descriptor
                try {
                    await pool.query(
                        `INSERT INTO unknown_face_logs (section, timestamp, face_descriptor) 
                         VALUES ($1, CURRENT_TIMESTAMP, $2)`,
                        [section, faceDescriptor]
                    );
                } catch (logError) {
                    console.error('❌ Error logging unknown face:', logError.message);
                }
            }
        }
        
        // Save the uploaded image for reference (optional)
        try {
            const unknownDir = path.join(__dirname, 'uploads', 'unknown_faces');
            if (!fsSync.existsSync(unknownDir)) {
                await fs.mkdir(unknownDir, { recursive: true });
            }
            
            const savePath = path.join(unknownDir, `unknown_${Date.now()}.jpg`);
            await fs.copyFile(req.file.path, savePath);
        } catch (saveError) {
            console.warn('⚠️ Could not save unknown face image:', saveError.message);
        }
        
        // Clean up temporary file
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkError) {
            console.warn('⚠️ Could not delete temp file:', unlinkError.message);
        }
        
        // Return results
        const result = {
            success: true,
            recognized: recognizedCount,
            totalFaces: detections.length,
            unknownCount: unknownFaces.length,
            students: recognizedStudents,
            message: `✅ Successfully processed ${detections.length} face(s). ` +
                    `Recognized ${recognizedCount} student(s). ` +
                    `${unknownFaces.length} unknown face(s) detected.`
        };
        
        if (unknownFaces.length > 0) {
            result.unknowns = unknownFaces;
        }
        
        console.log(`📊 Group Recognition Result:`, {
            totalFaces: detections.length,
            recognized: recognizedCount,
            unknown: unknownFaces.length
        });
        
        res.json(result);
        
    } catch (err) {
        console.error('❌ Group recognition error:', err);
        
        // Clean up temp file if exists
        if (req.file && req.file.path && fsSync.existsSync(req.file.path)) {
            await fs.unlink(req.file.path).catch(() => {});
        }
        
        res.status(500).json({ 
            success: false, 
            error: err.message,
            message: 'Failed to process group recognition. Please try again.'
        });
    }
});

// 3. MANUAL ATTENDANCE UPDATE (for real-time and manual fixes)
app.post('/api/attendance/manual-update', async (req, res) => {
    const { uid, date, subject, slot, status } = req.body;
    
    if (!uid || !date || !subject || !slot || !status) {
        return res.status(400).json({ 
            success: false, 
            message: "All fields are required: uid, date, subject, slot, status" 
        });
    }
    
    try {
        const studentRes = await pool.query(
            'SELECT id, name FROM students WHERE uid = $1',
            [uid.toUpperCase()]
        );
        
        if (studentRes.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: "Student not found",
                message: `Student with UID ${uid} does not exist in the database.`
            });
        }
        
        const studentId = studentRes.rows[0].id;
        const studentName = studentRes.rows[0].name;

        if (status === 'PRESENT') {
            await pool.query(`
                INSERT INTO attendance_logs (student_id, status, date, subject, lecture_slot) 
                VALUES ($1, 'PRESENT', $2, $3, $4) 
                ON CONFLICT (student_id, date, lecture_slot) 
                DO UPDATE SET status = 'PRESENT', captured_at = CURRENT_TIMESTAMP`,
                [studentId, date, subject, slot]
            );
            
            console.log(`✅ Manual Present: ${studentName} (${uid}) - ${date} ${slot} ${subject}`);
            
            res.json({ 
                success: true, 
                message: `${studentName} marked as PRESENT`,
                student: { uid, name: studentName },
                timestamp: new Date().toISOString()
            });
            
        } else {
            await pool.query(`
                DELETE FROM attendance_logs 
                WHERE student_id = $1 AND date = $2 AND subject = $3 AND lecture_slot = $4`,
                [studentId, date, subject, slot]
            );
            
            console.log(`❌ Manual Absent: ${studentName} (${uid}) - ${date} ${slot} ${subject}`);
            
            res.json({ 
                success: true, 
                message: `${studentName} marked as ABSENT`,
                student: { uid, name: studentName },
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (err) {
        console.error('❌ Manual update error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message,
            message: 'Failed to update attendance. Please try again.'
        });
    }
});

// 4. GET STUDENTS BY SECTION
app.get('/api/admin/students', authenticateToken, async (req, res) => {
    try {
        const { section } = req.query;
        
        if (!section) {
            return res.status(400).json({ error: 'Section parameter is required' });
        }
        
        const result = await pool.query(
            `SELECT uid, name, email, profile_pic, face_ready, section 
             FROM students 
             WHERE section = $1 
             ORDER BY name`,
            [section]
        );
        
        // Aggressive no-cache headers
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        res.json(result.rows);
        
    } catch (err) {
        console.error('❌ Students fetch error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. ATTENDANCE REPORT
app.get('/api/admin/attendance-report', authenticateToken, async (req, res) => {
    try {
        const { section, subject, slot, date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        console.log(`📊 Generating Report: ${section} | ${subject} | ${slot} | ${targetDate}`);

        const query = `
            SELECT 
                s.uid, 
                s.name, 
                s.email,
                s.profile_pic,
                s.face_ready,
                COALESCE(al.status, 'ABSENT') as status,
                al.captured_at as time
            FROM students s
            LEFT JOIN attendance_logs al ON s.id = al.student_id 
                AND al.date = $2 
                AND al.subject = $3 
                AND al.lecture_slot = $4
            WHERE s.section = $1
            ORDER BY s.name ASC`;

        const result = await pool.query(query, [section, targetDate, subject, slot]);
        
        // Cache-control
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.json(result.rows);
        
    } catch (err) {
        console.error("❌ Report Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 6. GET ALL DESCRIPTORS (for frontend face matching)
app.get('/api/admin/all-descriptors', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, uid, face_embedding, section 
             FROM students 
             WHERE face_ready = TRUE 
             AND face_embedding IS NOT NULL 
             AND face_embedding != ''
             ORDER BY section, name`
        );
        
        console.log(`📊 Found ${result.rowCount} students with face embeddings`);
        
        // Filter out rows with invalid face_embedding
        const validDescriptors = result.rows
            .filter(s => {
                if (!s.face_embedding || s.face_embedding.trim() === '') {
                    console.warn(`⚠️ Empty face_embedding for ${s.uid}`);
                    return false;
                }
                return true;
            })
            .map(s => {
                try {
                    // Parse the JSON string to array
                    const descriptorArray = JSON.parse(s.face_embedding);
                    
                    // Validate it's an array with numbers
                    if (!Array.isArray(descriptorArray) || descriptorArray.length === 0) {
                        console.warn(`⚠️ Invalid descriptor array for ${s.uid}`);
                        return null;
                    }
                    
                    return {
                        id: s.id,
                        name: s.name,
                        uid: s.uid,
                        section: s.section,
                        descriptor: descriptorArray
                    };
                } catch (parseError) {
                    console.warn(`⚠️ JSON parse error for ${s.uid}:`, parseError.message);
                    return null;
                }
            })
            .filter(item => item !== null);
        
        console.log(`✅ Returning ${validDescriptors.length} valid descriptors`);
        
        res.json(validDescriptors);
        
    } catch (err) {
        console.error('❌ Error loading descriptors:', err);
        res.status(500).json({ 
            error: err.message,
            message: 'Failed to load face descriptors'
        });
    }
});

// 7. GET UNKNOWN FACE REPORTS
app.get('/api/admin/unknown-faces', authenticateToken, async (req, res) => {
    try {
        const { section, startDate, endDate, limit = 50 } = req.query;
        
        let query = 'SELECT * FROM unknown_face_logs';
        let params = [];
        let paramCount = 0;
        
        if (section) {
            query += ' WHERE section = $1';
            params.push(section);
            paramCount = 1;
        }
        
        query += ' ORDER BY timestamp DESC LIMIT $' + (paramCount + 1);
        params.push(parseInt(limit));
        
        const result = await pool.query(query, params);
        
        res.json(result.rows);
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. DELETE STUDENT (With physical file cleanup)
app.delete('/api/admin/student/:uid', async (req, res) => {
    const { uid } = req.params;
    
    if (!uid) {
        return res.status(400).json({ message: "UID is required" });
    }
    
    try {
        const studentInfo = await pool.query(
            'SELECT profile_pic FROM students WHERE uid = $1', 
            [uid.toUpperCase()]
        );
        
        if (studentInfo.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `Student ${uid} not found.` 
            });
        }

        const profilePic = studentInfo.rows[0].profile_pic;
        
        // Delete from database
        await pool.query('DELETE FROM students WHERE uid = $1', [uid.toUpperCase()]);
        console.log(`🗑️ Deleted student: ${uid}`);

        // Delete physical file if exists
        if (profilePic) {
            const filePath = path.join(__dirname, profilePic);
            if (fsSync.existsSync(filePath)) {
                await fs.unlink(filePath);
                console.log(`🗑️ Deleted profile picture: ${profilePic}`);
            }
        }
        
        res.json({ 
            success: true, 
            message: `Student ${uid} deleted successfully.` 
        });
    } catch (err) {
        console.error('❌ Delete error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message,
            message: `Failed to delete student ${uid}.`
        });
    }
});

// 9. HEALTH CHECK & SYSTEM STATUS
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        
        // Check models directory
        const modelPath = path.join(__dirname, 'models');
        const modelsExist = fsSync.existsSync(modelPath);
        
        // Count students
        const studentsRes = await pool.query('SELECT COUNT(*) FROM students');
        const studentsWithFaceRes = await pool.query(
            'SELECT COUNT(*) FROM students WHERE face_ready = TRUE'
        );
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            ai_models: modelsExist ? 'loaded' : 'missing',
            students: {
                total: parseInt(studentsRes.rows[0].count),
                with_face: parseInt(studentsWithFaceRes.rows[0].count)
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: err.message
        });
    }
});

// 10. FIX EMPTY EMBEDDINGS (Utility endpoint)
app.get('/api/admin/fix-empty-embeddings', async (req, res) => {
    try {
        // Check for students with face_ready but empty embedding
        const result = await pool.query(`
            SELECT uid, name 
            FROM students 
            WHERE face_ready = TRUE 
            AND (face_embedding IS NULL OR face_embedding = '')
        `);
        
        console.log(`🔧 Found ${result.rowCount} students with empty embeddings`);
        
        if (result.rowCount > 0) {
            // Set face_ready to FALSE for these students
            await pool.query(`
                UPDATE students 
                SET face_ready = FALSE 
                WHERE face_ready = TRUE 
                AND (face_embedding IS NULL OR face_embedding = '')
            `);
            
            console.log('✅ Fixed empty embeddings issue');
        }
        
        res.json({
            success: true,
            fixed: result.rowCount,
            message: `Fixed ${result.rowCount} students with empty embeddings`,
            students: result.rows
        });
        
    } catch (err) {
        console.error('❌ Fix embeddings error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// 11. TEST DESCRIPTORS ENDPOINT
app.get('/api/admin/test-descriptors', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT uid, name, face_ready, 
                    face_embedding IS NULL as is_null, 
                    face_embedding = '' as is_empty,
                    LENGTH(face_embedding) as length
             FROM students
             ORDER BY uid`
        );
        
        console.log('📊 Database Check Results:');
        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.uid} - ${row.name} - ` +
                       `Face Ready: ${row.face_ready} - ` +
                       `Is Null: ${row.is_null} - ` +
                       `Is Empty: ${row.is_empty} - ` +
                       `Length: ${row.length}`);
        });
        
        res.json({
            totalStudents: result.rowCount,
            studentsWithFaceData: result.rows.filter(r => r.face_ready && r.length > 0).length,
            students: result.rows.map(r => ({
                uid: r.uid,
                name: r.name,
                face_ready: r.face_ready,
                has_embedding: r.length > 0
            }))
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. REAL-TIME FACE MATCH ENDPOINT (for live camera)
app.post('/api/attendance/real-time-match', authenticateToken, async (req, res) => {
    try {
        const { descriptor, section } = req.body;
        
        if (!descriptor || !section) {
            return res.status(400).json({ 
                success: false, 
                message: 'Descriptor and section are required' 
            });
        }
        
        const faceDescriptor = new Float32Array(descriptor);
        
        // Get students from the specific section
        const students = await pool.query(
            `SELECT id, uid, name, face_embedding 
             FROM students 
             WHERE section = $1 AND face_ready = TRUE 
             AND face_embedding IS NOT NULL 
             AND face_embedding != ''`,
            [section]
        );
        
        let bestMatch = null;
        let bestDistance = Infinity;
        
        for (let student of students.rows) {
            try {
                const storedDescriptor = new Float32Array(JSON.parse(student.face_embedding));
                const distance = faceapi.euclideanDistance(faceDescriptor, storedDescriptor);
                
                if (distance < 0.45 && distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = student;
                }
            } catch (parseError) {
                console.warn(`Skipping student ${student.uid}:`, parseError.message);
                continue;
            }
        }
        
        if (bestMatch) {
            res.json({
                success: true,
                match: true,
                student: {
                    uid: bestMatch.uid,
                    name: bestMatch.name,
                    distance: bestDistance
                },
                message: `Matched with ${bestMatch.name}`
            });
        } else {
            res.json({
                success: true,
                match: false,
                message: 'No match found'
            });
        }
        
    } catch (err) {
        console.error('❌ Real-time match error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// 13. DASHBOARD STATS
app.get('/api/admin/dashboard-stats', authenticateToken, async (req, res) => {
    try {
        const { section, date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // Total students in section
        const totalRes = await pool.query(
            'SELECT COUNT(*) FROM students WHERE section = $1',
            [section]
        );
        
        // Present students today
        const presentRes = await pool.query(`
            SELECT COUNT(DISTINCT s.id) 
            FROM students s
            JOIN attendance_logs al ON s.id = al.student_id 
            WHERE s.section = $1 AND al.date = $2`,
            [section, targetDate]
        );
        
        // Unknown faces today
        const unknownRes = await pool.query(
            `SELECT COUNT(*) 
             FROM unknown_face_logs 
             WHERE section = $1 AND DATE(timestamp) = $2`,
            [section, targetDate]
        );
        
        res.json({
            total: parseInt(totalRes.rows[0].count),
            present: parseInt(presentRes.rows[0].count || 0),
            unknown: parseInt(unknownRes.rows[0].count || 0),
            date: targetDate
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 14. GET LIVE UNKNOWN FACES COUNT
app.get('/api/admin/live-unknown-count', async (req, res) => {
    try {
        const { section } = req.query;
        
        if (!section) {
            return res.status(400).json({ error: 'Section parameter is required' });
        }
        
        // Count unknown faces in last 5 minutes
        const result = await pool.query(
            `SELECT COUNT(*) as unknown_count
             FROM unknown_face_logs 
             WHERE section = $1 AND timestamp > NOW() - INTERVAL '5 minutes'`,
            [section]
        );
        
        res.json({
            success: true,
            unknown_count: parseInt(result.rows[0].unknown_count || 0),
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// 16. REAL-TIME FACE MATCHING WITH DEDUPLICATION - IMPROVED VERSION
app.post('/api/attendance/real-time-face-match', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: "No image file uploaded." 
    });
  }
  
  try {
    const { section, subject = 'Default', slot = 'Default' } = req.body;
    
    if (!section) {
      return res.status(400).json({ 
        success: false, 
        message: "Section is required." 
      });
    }
    
    console.log(`🎯 Processing real-time face match for section: ${section}`);
    
    // Load image
    const img = await loadImage(req.file.path);
    
    // Detect all faces
    const detections = await faceapi.detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    console.log(`👥 Detected ${detections.length} face(s) in image`);
    
    // Get students from the section
    const students = await pool.query(
      `SELECT id, uid, name, face_embedding, face_ready 
       FROM students 
       WHERE section = $1 AND face_ready = TRUE 
       AND face_embedding IS NOT NULL 
       AND face_embedding != ''`,
      [section]
    );
    
    console.log(`📚 Found ${students.rows.length} registered student(s) in section ${section}`);
    
    let recognizedFaces = [];
    let unknownFaces = [];
    const today = new Date().toISOString().split('T')[0];
    
    // Process each detected face
    for (const [index, detection] of detections.entries()) {
      let bestMatch = null;
      let bestDistance = Infinity;
      let matchedStudent = null;
      
      // Try to match with registered students
      for (let student of students.rows) {
        try {
          if (!student.face_embedding || student.face_embedding.trim() === '') {
            continue;
          }
          
          const storedDescriptor = new Float32Array(JSON.parse(student.face_embedding));
          const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor);
          
          if (distance < 0.45 && distance < bestDistance) {
            bestDistance = distance;
            bestMatch = student;
            matchedStudent = {
              id: student.id,
              uid: student.uid,
              name: student.name,
              distance: distance
            };
          }
        } catch (parseError) {
          console.warn(`Error parsing descriptor for ${student.uid}:`, parseError.message);
          continue;
        }
      }
      
      if (bestMatch && matchedStudent) {
        console.log(`✅ Recognized: ${bestMatch.name} (${bestMatch.uid}) - Distance: ${bestDistance.toFixed(4)}`);
        
        recognizedFaces.push({
          faceIndex: index + 1,
          student: matchedStudent,
          confidence: detection.detection.score,
          distance: bestDistance,
          box: detection.detection.box,
          timestamp: new Date().toISOString()
        });
        
        // Mark attendance
        try {
          await pool.query(
            `INSERT INTO attendance_logs (student_id, status, date, subject, lecture_slot) 
             VALUES ($1, 'PRESENT', $2, $3, $4) 
             ON CONFLICT (student_id, date, lecture_slot) 
             DO UPDATE SET status = 'PRESENT', captured_at = CURRENT_TIMESTAMP`,
            [bestMatch.id, today, subject, slot]
          );
          
          console.log(`✅ Marked attendance for ${bestMatch.name} (${bestMatch.uid})`);
        } catch (dbError) {
          console.error(`Database error for ${bestMatch.uid}:`, dbError.message);
        }
        
      } else {
        // UNKNOWN FACE DETECTED
        console.log(`⚠️ Unknown face detected #${index + 1} (Score: ${detection.detection.score.toFixed(3)})`);
        
        unknownFaces.push({
          faceIndex: index + 1,
          confidence: detection.detection.score,
          box: detection.detection.box,
          timestamp: new Date().toISOString()
        });
        
        // Save unknown face log
        try {
          await pool.query(
            `INSERT INTO unknown_face_logs (section, timestamp) 
             VALUES ($1, CURRENT_TIMESTAMP)`,
            [section]
          );
          
          console.log(`📝 Logged unknown face #${index + 1} to database`);
        } catch (logError) {
          console.error('Error logging unknown face:', logError.message);
        }
      }
    }
    
    // Clean up temp file
    await fs.unlink(req.file.path);
    
    // Return results with DEDUPLICATION
    const uniqueRecognized = [];
    const seenUids = new Set();
    
    for (const face of recognizedFaces) {
      if (!seenUids.has(face.student.uid)) {
        seenUids.add(face.student.uid);
        uniqueRecognized.push(face);
      }
    }
    
    // For unknown faces, use face position to deduplicate
    const uniqueUnknown = [];
    const seenPositions = new Set();
    
    for (const face of unknownFaces) {
      if (face.box) {
        const positionKey = `${Math.round(face.box.x/50)}_${Math.round(face.box.y/50)}`;
        if (!seenPositions.has(positionKey)) {
          seenPositions.add(positionKey);
          uniqueUnknown.push(face);
        }
      } else {
        uniqueUnknown.push(face);
      }
    }
    
    const result = {
      success: true,
      totalFaces: detections.length,
      recognizedFaces: uniqueRecognized.length,
      unknownFaces: uniqueUnknown.length,
      recognized: uniqueRecognized,
      unknowns: uniqueUnknown,
      message: `✅ Processed ${detections.length} face(s). ` +
              `Recognized ${uniqueRecognized.length} student(s). ` +
              `${uniqueUnknown.length} unique unknown face(s) detected.`
    };
    
    console.log(`📊 Final Result: ${uniqueRecognized.length} known, ${uniqueUnknown.length} unknown`);
    
    res.json(result);
    
  } catch (err) {
    console.error('❌ Real-time face match error:', err);
    
    // Clean up temp file if exists
    if (req.file && req.file.path && fsSync.existsSync(req.file.path)) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({ 
      success: false, 
      error: err.message,
      message: 'Failed to process face match.'
    });
  }
});
// 17. GET TODAY'S UNKNOWN FACES
app.get('/api/admin/today-unknown-faces', async (req, res) => {
  try {
    const { section } = req.query;
    
    const today = new Date().toISOString().split('T')[0];
    
    let query = `
      SELECT 
        id,
        section,
        timestamp,
        image_path,
        processed,
        EXTRACT(HOUR FROM timestamp) as hour,
        EXTRACT(MINUTE FROM timestamp) as minute
      FROM unknown_face_logs
      WHERE DATE(timestamp) = $1
    `;
    
    let params = [today];
    
    if (section) {
      query += ` AND section = $2`;
      params.push(section);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT 20`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rowCount,
      unknownFaces: result.rows
    });
    
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Start Server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CUIMS ATTENDANCE SYSTEM                 ║
║                    Backend Server Active                   ║
╚════════════════════════════════════════════════════════════╝
    
📡 Server running on: http://localhost:${PORT}
🗄️  Database: PostgreSQL (Connected)
🤖 AI Engine: ${fsSync.existsSync(path.join(__dirname, 'models')) ? 'Ready' : 'Models Missing'}
📁 Uploads: ${path.join(__dirname, 'uploads')}

🚀 Available Endpoints:
   • POST   /api/admin/enroll-with-face     - Enroll student with face
   • POST   /api/attendance/group-recognition - Group attendance scan
   • POST   /api/attendance/manual-update   - Manual attendance update
   • GET    /api/admin/students             - Get students by section
   • GET    /api/admin/attendance-report    - Get attendance report
   • GET    /api/admin/all-descriptors      - Get all face descriptors
   • DELETE /api/admin/student/:uid         - Delete student
   • GET    /api/health                     - System health check

🔧 Utility Endpoints:
   • GET    /api/admin/fix-empty-embeddings - Fix database issues
   • GET    /api/admin/test-descriptors     - Test descriptors
   • GET    /api/admin/dashboard-stats      - Dashboard statistics
   • GET    /api/admin/unknown-faces        - Unknown faces report
   • GET    /api/admin/live-unknown-count   - Live unknown faces count

⚠️  Make sure face-api.js models are in the 'models' directory.
    `);
});
