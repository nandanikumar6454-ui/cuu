-- Enhanced students table with face recognition support
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    section VARCHAR(10) NOT NULL,
    group_name VARCHAR(10),
    department VARCHAR(100),
    batch_year INTEGER,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'active',
    profile_image TEXT, -- Base64 encoded image or file path
    face_embedding JSONB, -- Face recognition embeddings
    class_id INTEGER REFERENCES classes(id),
    teacher_id INTEGER REFERENCES teachers(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section);
CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_name);
CREATE INDEX IF NOT EXISTS idx_students_uid ON students(uid);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- Create storage for face embeddings
CREATE TABLE IF NOT EXISTS face_embeddings (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    embedding FLOAT[] NOT NULL, -- 128-dimensional face embedding
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_students_updated_at 
    BEFORE UPDATE ON students 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();