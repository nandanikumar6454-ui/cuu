from flask import Flask, request, jsonify
from deepface import DeepFace
import cv2
import numpy as np
from PIL import Image
import io
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Database Connection Helper
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "cuims_attendance"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password")
    )

@app.route('/api/ai/process', methods=['POST'])
def process_image():
    try:
        # 1. Request se image lein
        file = request.files['image']
        image = Image.open(io.BytesIO(file.read()))
        image_np = np.array(image)

        # 2. Database se students aur unke embeddings fetch karein
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT s.uid, fe.embedding FROM students s JOIN face_embeddings fe ON s.id = fe.student_id")
        stored_data = cur.fetchall()
        cur.close()
        conn.close()

        # 3. Photo mein faces detect karein
        faces = DeepFace.extract_faces(image_np, detector_backend='opencv', enforce_detection=False)

        matched = []
        unknown_count = 0

        for face_obj in faces:
            # Current face ka embedding nikalein
            current_embedding = DeepFace.represent(face_obj['face'], model_name='Facenet', enforce_detection=False)[0]['embedding']
            current_embedding = np.array(current_embedding)

            best_match = None
            min_distance = 0.6  # Threshold: Isse kam distance matlab "Match Found"

            # 4. Stored embeddings ke saath compare karein
            for uid, stored_emb_bytes in stored_data:
                # ByteA data ko numpy array mein badlein
                stored_emb = np.frombuffer(stored_emb_bytes, dtype=np.float32)
                
                # Euclidean distance calculate karein
                distance = np.linalg.norm(current_embedding - stored_emb)
                
                if distance < min_distance:
                    min_distance = distance
                    best_match = uid

            if best_match:
                matched.append(best_match)
            else:
                unknown_count += 1

        # 5. Result return karein
        return jsonify({
            'matched': list(set(matched)), # Unique UIDs
            'unknown': unknown_count
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5003, debug=True)