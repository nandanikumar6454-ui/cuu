import { useState, useRef, useEffect } from 'react';
import { Container, Paper, Typography, Box, Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import { CameraFront, CheckCircle, ErrorOutline } from '@mui/icons-material';
import axios from 'axios';
import Webcam from 'react-webcam'; // npm install react-webcam

const API_BASE_URL = "http://localhost:5050/api/attendance";

function Attendance() {
  const webcamRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Har 4 second mein auto-scan karne ke liye (Optional)
  const captureAndVerify = async () => {
    if (processing) return;
    setProcessing(true);
    setResult(null);

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setProcessing(false);
      return;
    }

    try {
      // Base64 image ko Blob mein convert karna
      const fetchResponse = await fetch(imageSrc);
      const blob = await fetchResponse.blob();
      const formData = new FormData();
      formData.append('image', blob, 'attendance.jpg');
      formData.append('classId', 'BCA_LEC_01'); // Static Class ID

      const res = await axios.post(`${API_BASE_URL}/face-recognition`, formData);

      if (res.data.success) {
        setResult({ name: res.data.name, uid: res.data.uid });
        setSnackbar({ open: true, message: `Attendance Marked: ${res.data.name}`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: res.data.message || 'Face Not Recognized', severity: 'warning' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Server Error. Start Backend!', severity: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 5 }}>
      <Paper elevation={10} sx={{ p: 4, textAlign: 'center', borderRadius: 5, borderTop: '8px solid #e31e24' }}>
        <Typography variant="h5" fontWeight="900" color="#e31e24" gutterBottom>
          CUIMS AI ATTENDANCE
        </Typography>
        
        <Box sx={{ position: 'relative', my: 3, borderRadius: 3, overflow: 'hidden', border: '4px solid #eee' }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width="100%"
            videoConstraints={{ facingMode: "user" }}
          />
          {processing && (
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress color="inherit" />
            </Box>
          )}
        </Box>

        {result && (
          <Alert icon={<CheckCircle fontSize="inherit" />} severity="success" sx={{ mb: 2 }}>
            Verified: <strong>{result.name}</strong> ({result.uid})
          </Alert>
        )}

        <Button 
          variant="contained" 
          fullWidth 
          size="large"
          startIcon={<CameraFront />}
          onClick={captureAndVerify}
          disabled={processing}
          sx={{ bgcolor: '#e31e24', py: 1.5, fontWeight: 'bold' }}
        >
          {processing ? 'ANALYZING FACE...' : 'MARK MY ATTENDANCE'}
        </Button>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({...snackbar, open: false})}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}

export default Attendance;