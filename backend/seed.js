require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function seed() {
  try {
    // Insert teacher
    const hashedPassword = await bcrypt.hash('password123', 10);
    await pool.query('INSERT INTO teachers (name, email, password_hash) VALUES ($1, $2, $3)', ['Teacher One', 'teacher@example.com', hashedPassword]);

    // Insert class
    const classRes = await pool.query('INSERT INTO classes (name, section, subject, teacher_id) VALUES ($1, $2, $3, $4) RETURNING id', ['CS101', 'A', 'Computer Science', 1]);

    // Insert students
    const students = [
      { uid: 'UID001', name: 'Student 1' },
      { uid: 'UID002', name: 'Student 2' },
      { uid: 'UID003', name: 'Student 3' }
    ];

    for (const student of students) {
      await pool.query('INSERT INTO students (uid, name, class_id) VALUES ($1, $2, $3)', [student.uid, student.name, classRes.rows[0].id]);
    }

    console.log('Dummy data inserted');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

seed();