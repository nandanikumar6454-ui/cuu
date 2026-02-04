-- Sample Data for PostgreSQL
-- Run after creating tables

-- Insert teacher
INSERT INTO teachers (name, email, password_hash) VALUES ('Teacher One', 'teacher@example.com', '$2a$10$d/8kO/xby60rTUnPs47MBucPNp3m1In7LdCXBvaMH8HD/9Kw.KNFi');

-- Insert class
INSERT INTO classes (name, section, subject, teacher_id) VALUES ('CS101', 'A', 'Computer Science', 1);

-- Insert students
INSERT INTO students (uid, name, class_id) VALUES ('UID001', 'Sanjat Kumar', 1);
INSERT INTO students (uid, name, class_id) VALUES ('UID002', 'Sonu', 1);
INSERT INTO students (uid, name, class_id) VALUES ('UID003', 'Rohit', 1);

-- Note: Face embeddings would be inserted separately in production