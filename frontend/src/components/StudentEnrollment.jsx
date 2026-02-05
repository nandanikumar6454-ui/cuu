import React, { useState, useCallback, useRef } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Card, Button, TextField,
  Stepper, Step, StepLabel, FormControl, InputLabel, Select, MenuItem,
  Chip, Avatar, CircularProgress, Alert, Snackbar, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider
} from '@mui/material';
import {
  CloudUpload, PhotoCamera, PersonAdd, Delete, CameraAlt, School
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://cuu-1.onrender.com";
function StudentEnrollment() {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);

  // CUIMS Specific Theme Color
  const cuRed = '#e31e24';

  // Updated form for BCA Department
  const [formData, setFormData] = useState({
    uid: '',
    name: '',
    email: '',
    section: '24BCA-2-B', // Default as per user class
    group: 'G1',
    department: 'BCA',
    batch: '2024'
  });

  const webcamRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Image Upload Logic
  const onImageDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setUploadedImage(reader.result);
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onImageDrop,
    accept: {'image/*': ['.jpeg', '.jpg', '.png']},
    multiple: false
  });

  // Backend Enrollment Call
  const handleEnrollStudent = async () => {
    if (!formData.uid || !formData.name || !uploadedImage) {
      setSnackbar({ open: true, message: 'Fill all details and add a photo!', severity: 'error' });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // FormData for Image + JSON
      const finalData = new FormData();
      Object.keys(formData).forEach(key => finalData.append(key, formData[key]));
      
      const blob = await fetch(uploadedImage).then(r => r.blob());
      finalData.append('profileImage', new File([blob], `${formData.uid}.jpg`, { type: 'image/jpeg' }));

      const res = await axios.post('http://localhost:5000/api/students/enroll', finalData, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setSnackbar({ open: true, message: 'Student Registered in CUIMS!', severity: 'success' });
        setActiveStep(0);
        setUploadedImage(null);
        setFormData({ uid: '', name: '', email: '', section: '24BCA-2-B', group: 'G1', department: 'BCA', batch: '2024' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Registration Failed!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Student Details', 'Face Capture', 'Finalize'];

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4, borderRadius: 3, borderTop: `6px solid ${cuRed}` }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <School sx={{ fontSize: 40, color: cuRed }} />
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: cuRed }}>CUIMS Enrollment Portal</Typography>
          <Typography variant="body2" color="textSecondary">Add students to Section: 24BCA-2-B</Typography>
        </Box>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label} sx={{ '& .MuiStepIcon-root.Mui-active': { color: cuRed }, '& .MuiStepIcon-root.Mui-completed': { color: 'green' } }}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Divider sx={{ mb: 4 }} />

        {activeStep === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="UID (e.g. 24BCA10057)" name="uid" value={formData.uid} onChange={handleInputChange} required />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Full Name" name="name" value={formData.name} onChange={handleInputChange} required />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Email" name="email" value={formData.email} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Section" name="section" value={formData.section} disabled />
            </Grid>
          </Grid>
        )}

        {activeStep === 1 && (
          <Box sx={{ textAlign: 'center' }}>
            {uploadedImage ? (
              <Box>
                <Avatar src={uploadedImage} sx={{ width: 180, height: 180, mx: 'auto', mb: 2, border: `3px solid ${cuRed}` }} />
                <Button variant="outlined" color="error" startIcon={<Delete />} onClick={() => setUploadedImage(null)}>Remove</Button>
              </Box>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card {...getRootProps()} sx={{ p: 4, border: '2px dashed #ccc', cursor: 'pointer' }}>
                    <input {...getInputProps()} />
                    <CloudUpload sx={{ fontSize: 50, color: cuRed }} />
                    <Typography>Drag & Drop Photo</Typography>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 4, border: '2px solid #ccc', cursor: 'pointer' }} onClick={() => setCaptureDialogOpen(true)}>
                    <PhotoCamera sx={{ fontSize: 50, color: cuRed }} />
                    <Typography>Use Live Camera</Typography>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>Review Details</Typography>
            <Typography><b>Name:</b> {formData.name}</Typography>
            <Typography><b>UID:</b> {formData.uid}</Typography>
            <Typography><b>Class:</b> {formData.section}</Typography>
            <Alert severity="info" sx={{ mt: 2 }}>Ensure the face is clearly visible for AI recognition.</Alert>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button disabled={activeStep === 0} onClick={() => setActiveStep(prev => prev - 1)}>Back</Button>
          <Button 
            variant="contained" 
            sx={{ bgcolor: cuRed }} 
            onClick={activeStep === 2 ? handleEnrollStudent : () => setActiveStep(prev => prev + 1)}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : (activeStep === 2 ? 'Register Student' : 'Next')}
          </Button>
        </Box>
      </Paper>

      {/* Webcam Dialog */}
      <Dialog open={captureDialogOpen} onClose={() => setCaptureDialogOpen(false)}>
        <DialogTitle>Capture Face</DialogTitle>
        <DialogContent>
          {webcamEnabled ? (
            <Webcam ref={webcamRef} screenshotFormat="image/jpeg" width="100%" />
          ) : <Typography>Enable camera to take a photo.</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWebcamEnabled(!webcamEnabled)}>{webcamEnabled ? 'Off' : 'On'}</Button>
          <Button variant="contained" onClick={() => { setUploadedImage(webcamRef.current.getScreenshot()); setCaptureDialogOpen(false); }}>Capture</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}

export default StudentEnrollment;
