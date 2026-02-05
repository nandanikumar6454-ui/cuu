import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Card, CardContent, Button,
  TextField, Table, TableBody, TableCell, TableHead, TableRow, Chip,
  IconButton, CircularProgress, Alert, FormControl, InputLabel, Select, 
  MenuItem, Avatar, Stack, Divider, InputAdornment, Drawer, List, 
  ListItem, ListItemIcon, ListItemText, CssBaseline, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, ListItemAvatar
} from '@mui/material';
import {
  Logout, School, Assignment, Group, Warning, VideoCameraFront, 
  Search, PhotoCamera, GroupWork, PeopleAlt, VerifiedUser, SwapHoriz, Security,
  PersonOff, Upload, Close, CheckCircle, Refresh, Face, EmojiPeople
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const BACKEND_URL = "http://localhost:5050";
const CU_RED = '#e31e24';
const DRAWER_WIDTH = 260;

const SUBJECTS = ["Data Science", "Java Programming", "Aptitude-II", "Soft Skills-II"];
const SLOTS = ["09:55 - 10:40", "10:40 - 11:25", "11:25 - 12:10", "12:10 - 12:55", "12:55 - 01:40", "01:40 - 02:25", "02:25 - 03:10", "03:10 - 03:55"];

// 🚀 PERFORMANCE: Throttle function
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// 🚀 PERFORMANCE: Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

function TeacherDashboard({ onLogout }) { // Add onLogout prop
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mark'); 
  const [data, setData] = useState([]);
  const [markedUids, setMarkedUids] = useState(new Set());
  const [attendanceUpdates, setAttendanceUpdates] = useState(0);

  const [selectedYear, setSelectedYear] = useState('2');
  const [selectedGroup, setSelectedGroup] = useState('B');
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [selectedSlot, setSelectedSlot] = useState(SLOTS[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [labeledDescriptors, setLabeledDescriptors] = useState([]);
  const [alertInfo, setAlertInfo] = useState({ show: false, msg: '', type: 'info' });
  
  // 🚀 PERFORMANCE: Optimized face tracking states
  const [trackedFaces, setTrackedFaces] = useState([]);
  const [unknownFaces, setUnknownFaces] = useState([]);
  const [showUnknownDialog, setShowUnknownDialog] = useState(false);
  const [recognizedFaces, setRecognizedFaces] = useState([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [aiInitialized, setAiInitialized] = useState(false);
  const [detectionActive, setDetectionActive] = useState(true);
  const [detectionQuality, setDetectionQuality] = useState('medium'); // 'low', 'medium', 'high'
  
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const fileInputRef = useRef(null);
  const lastDetectionTime = useRef(0);
  const detectionInterval = useRef(100); // ms between detections
  const faceCache = useRef(new Map());

  const currentSectionTag = `24BCA-${selectedYear}-${selectedGroup}`;

  // 🚀 PERFORMANCE: Track face history with timeouts
  const faceHistoryRef = useRef({
    recognized: new Map(),
    unknown: new Map(),
  });

  // 🚀 PERFORMANCE: Clean up face history periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean old recognized faces
      faceHistoryRef.current.recognized.forEach((timestamp, uid) => {
        if (now - timestamp > 30000) { // 30 seconds
          faceHistoryRef.current.recognized.delete(uid);
        }
      });
      
      // Clean old unknown faces
      faceHistoryRef.current.unknown.forEach((timestamp, faceId) => {
        if (now - timestamp > 30000) { // 30 seconds
          faceHistoryRef.current.unknown.delete(faceId);
        }
      });
    }, 10000); // Clean every 10 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Logout Logic - Fixed
  const handleLogout = () => {
    console.log("Logout triggered");
    
    // Stop face detection
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    
    // Clear local storage
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherData');
    sessionStorage.clear();
    
    // Call parent logout handler if provided
    if (onLogout && typeof onLogout === 'function') {
      onLogout();
    } else {
      // Default logout behavior
      navigate('/login');
    }
  };

  const dateLimits = useMemo(() => {
    const today = new Date();
    const min = new Date();
    min.setDate(today.getDate() - 3);
    return { min: min.toISOString().split('T')[0], max: today.toISOString().split('T')[0] };
  }, []);

  // 🚀 PERFORMANCE: Optimized AI Setup
  const initAI = async () => {
    try {
      console.log('🔄 Loading AI models...');
      const MODEL_URL = '/models';
      
      // Load only essential models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      
      // Load landmarks only if needed
      setTimeout(() => {
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL).catch(() => {
          console.warn('Face landmarks model failed to load, continuing without...');
        });
      }, 1000);
      
      console.log('✅ AI models loaded successfully');
      
      // Load student descriptors with debounce
      await loadDescriptors();
      
      setModelsLoaded(true);
      setAiInitialized(true);
      setDetectionActive(true);
      
    } catch (err) {
      console.error("❌ AI Engine Init Failed:", err);
      setAlertInfo({
        show: true,
        msg: 'AI initialization failed. Face recognition will not work.',
        type: 'error'
      });
      setModelsLoaded(false);
      setAiInitialized(false);
    }
  };

  // 🚀 PERFORMANCE: Separate descriptor loading
  const loadDescriptors = useCallback(async () => {
    try {
      console.log('🔄 Fetching student descriptors...');
      const res = await axios.get(`${BACKEND_URL}/api/admin/all-descriptors`, {
        timeout: 10000, // Add timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`📊 Received ${res.data.length} descriptor(s) from server`);
      
      const validDescriptors = res.data
        .filter(item => item && item.descriptor && Array.isArray(item.descriptor) && item.descriptor.length > 0)
        .map(item => {
          try {
            return {
              label: `${item.name || 'Unknown'} (${item.uid})`,
              uid: item.uid,
              name: item.name,
              descriptor: new Float32Array(item.descriptor),
              lastSeen: 0
            };
          } catch (error) {
            console.warn(`⚠️ Failed to parse descriptor for ${item.uid}:`, error);
            return null;
          }
        })
        .filter(item => item !== null);
      
      console.log(`✅ Loaded ${validDescriptors.length} valid student descriptor(s)`);
      
      if (validDescriptors.length === 0) {
        setAlertInfo({
          show: true,
          msg: 'No students with face data found. Please enroll students first.',
          type: 'warning'
        });
      }
      
      setLabeledDescriptors(validDescriptors);
      
    } catch (err) {
      console.error('Failed to load descriptors:', err);
      setAlertInfo({
        show: true,
        msg: 'Failed to load student data. Please check backend connection.',
        type: 'error'
      });
    }
  }, []);

  // 🚀 PERFORMANCE: Refresh descriptors periodically
  useEffect(() => {
    if (modelsLoaded) {
      const descriptorRefresh = setInterval(() => {
        loadDescriptors();
      }, 300000); // Refresh every 5 minutes
      
      return () => clearInterval(descriptorRefresh);
    }
  }, [modelsLoaded, loadDescriptors]);

  useEffect(() => {
    initAI();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // 🚀 PERFORMANCE: Optimized face ID calculation
  const calculateFaceId = useCallback((box) => {
    return `${Math.round(box.x/20)}_${Math.round(box.y/20)}`;
  }, []);

  // 🚀 PERFORMANCE: Optimized face matching
  const matchFace = useCallback((descriptor, descriptors) => {
    let bestMatch = { label: 'Unknown', distance: 0.45, uid: null, name: null };
    
    // Use smaller batch for better performance
    for (let i = 0; i < descriptors.length; i += 5) {
      const batch = descriptors.slice(i, i + 5);
      
      batch.forEach(sd => {
        try {
          const distance = faceapi.euclideanDistance(descriptor, sd.descriptor);
          if (distance < 0.45 && distance < bestMatch.distance) {
            bestMatch = {
              label: sd.label,
              uid: sd.uid,
              name: sd.name,
              distance
            };
          }
        } catch (error) {
          // Silent fail
        }
      });
      
      // Allow event loop to breathe
      if (i % 20 === 0) {
        return new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return bestMatch;
  }, []);

  // 🚀 PERFORMANCE: Optimized face detection with quality settings
  const detectFaces = useCallback(async () => {
    if (!webcamRef.current?.video || webcamRef.current.video.readyState !== 4 || 
        !canvasRef.current || !modelsLoaded || !detectionActive) {
      requestRef.current = requestAnimationFrame(detectFaces);
      return;
    }

    const now = Date.now();
    if (now - lastDetectionTime.current < detectionInterval.current) {
      requestRef.current = requestAnimationFrame(detectFaces);
      return;
    }
    lastDetectionTime.current = now;

    try {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const currentTime = Date.now();
      
      // Adjust canvas size only if needed
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      // Adjust detection options based on quality setting
      const options = {
        inputSize: detectionQuality === 'high' ? 416 : (detectionQuality === 'medium' ? 320 : 224),
        scoreThreshold: detectionQuality === 'high' ? 0.5 : (detectionQuality === 'medium' ? 0.6 : 0.7)
      };

      const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.TinyFaceDetectorOptions(options)
      ).withFaceLandmarks().withFaceDescriptors();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const newTrackedFaces = [];
      const newRecognizedFaces = [];
      const currentUnknownFaces = [];

      // Process detections in batches
      for (let i = 0; i < resizedDetections.length; i++) {
        const detection = resizedDetections[i];
        const { x, y, width, height } = detection.detection.box;
        const centerX = x + width/2;
        const centerY = y + height/2;
        
        const faceId = calculateFaceId(detection.detection.box);
        
        // Check cache first
        const cachedFace = faceCache.current.get(faceId);
        if (cachedFace && (currentTime - cachedFace.lastSeen) < 1000) {
          cachedFace.x = x;
          cachedFace.y = y;
          cachedFace.width = width;
          cachedFace.height = height;
          cachedFace.lastSeen = currentTime;
          cachedFace.frameCount = (cachedFace.frameCount || 0) + 1;
          
          newTrackedFaces.push(cachedFace);
          drawFace(ctx, cachedFace);
          continue;
        }
        
        // Match face
        const bestMatch = matchFace(detection.descriptor, labeledDescriptors);
        const isKnown = bestMatch.label !== 'Unknown';
        
        const newFace = {
          id: faceId,
          x, y, width, height,
          centerX, centerY,
          isKnown,
          uid: bestMatch.uid,
          name: bestMatch.name,
          distance: bestMatch.distance,
          firstSeen: currentTime,
          lastSeen: currentTime,
          frameCount: 1,
          status: isKnown ? 'recognized' : 'unknown'
        };
        
        // Cache the face
        faceCache.current.set(faceId, newFace);
        newTrackedFaces.push(newFace);
        drawFace(ctx, newFace);
        
        if (isKnown) {
          newRecognizedFaces.push(newFace);
          
          const lastSeen = faceHistoryRef.current.recognized.get(bestMatch.uid);
          if (!lastSeen || (currentTime - lastSeen) > 30000) {
            faceHistoryRef.current.recognized.set(bestMatch.uid, currentTime);
            
            // Debounce attendance marking
            setTimeout(() => {
              if (detectionActive) {
                markSingleAttendance(bestMatch.uid, bestMatch.name);
              }
            }, 1000);
          }
        } else {
          currentUnknownFaces.push(newFace);
          
          const lastSeen = faceHistoryRef.current.unknown.get(faceId);
          if (!lastSeen || (currentTime - lastSeen) > 30000) {
            faceHistoryRef.current.unknown.set(faceId, currentTime);
          }
        }
        
        // Yield to event loop every few faces
        if (i % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      // Clean up old cache entries
      faceCache.current.forEach((face, id) => {
        if (currentTime - face.lastSeen > 2000) {
          faceCache.current.delete(id);
        }
      });

      const activeFaces = newTrackedFaces.filter(face => 
        (currentTime - face.lastSeen) < 2000
      );
      
      setTrackedFaces(activeFaces);
      
      const recognizedUids = [...new Set(newRecognizedFaces.map(f => f.uid).filter(Boolean))];
      setRecognizedFaces(recognizedUids);
      
      // Update unknown faces
      setUnknownFaces(prev => {
        const updated = [...prev];
        currentUnknownFaces.forEach(face => {
          if (!updated.some(f => f.id === face.id)) {
            updated.push({
              ...face,
              timestamp: new Date().toLocaleTimeString(),
              alertShown: false
            });
          }
        });
        // Keep only last 5 unknown faces
        return updated.slice(-5);
      });

    } catch (error) {
      console.error('Face detection error:', error);
    }
    
    requestRef.current = requestAnimationFrame(detectFaces);
  }, [modelsLoaded, detectionActive, labeledDescriptors, calculateFaceId, matchFace, detectionQuality]);

  // 🚀 PERFORMANCE: Optimized face drawing
  const drawFace = useCallback((ctx, face) => {
    const { x, y, width, height, isKnown, name } = face;
    
    if (isKnown) {
      // Simplified drawing for known faces
      ctx.beginPath();
      ctx.arc(x + width/2, y + height/2, Math.max(width, height)/2 + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      if (detectionQuality !== 'low') {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.8)';
        const text = name || 'Known';
        ctx.fillText(text, x, y - 10);
      }
    } else {
      // Simplified drawing for unknown faces
      ctx.beginPath();
      ctx.arc(x + width/2, y + height/2, Math.max(width, height)/2 + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [detectionQuality]);

  // 🚀 PERFORMANCE: Debounced attendance marking
  const markSingleAttendance = useCallback(
    debounce(async (uid, name) => {
      if (!uid || !detectionActive) return;
      
      try {
        console.log(`🔄 Auto-marking attendance for ${name} (${uid})`);
        
        const res = await axios.post(`${BACKEND_URL}/api/attendance/manual-update`, {
          uid,
          date: selectedDate,
          subject: selectedSubject,
          slot: selectedSlot,
          status: 'PRESENT'
        }, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (res.data.success) {
          console.log(`✅ Auto-marked attendance for ${name} (${uid})`);
          
          // Update local state
          setMarkedUids(prev => new Set([...prev, uid]));
          setAttendanceUpdates(prev => prev + 1);
          
          setAlertInfo({
            show: true,
            msg: `✓ ${name} marked as PRESENT`,
            type: 'success'
          });
        }
      } catch (error) {
        console.error(`❌ Failed to auto-mark attendance for ${uid}:`, error);
        setAlertInfo({
          show: true,
          msg: `Failed to mark attendance for ${name}`,
          type: 'error'
        });
      }
    }, 500),
    [selectedDate, selectedSubject, selectedSlot, detectionActive]
  );

  // 🚀 PERFORMANCE: Optimized detection loop
  useEffect(() => {
    if (modelsLoaded && activeTab === 'mark' && detectionActive) {
      requestRef.current = requestAnimationFrame(detectFaces);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    }
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [modelsLoaded, activeTab, detectionActive, detectFaces]);

  // Show alert for new unknown faces
  useEffect(() => {
    const newUnknowns = unknownFaces.filter(f => !f.alertShown);
    if (newUnknowns.length > 0 && !showUnknownDialog) {
      setUnknownFaces(prev => prev.map(f => 
        newUnknowns.some(nu => nu.id === f.id) ? { ...f, alertShown: true } : f
      ));
      
      setAlertInfo({
        show: true,
        msg: `${newUnknowns.length} new unknown face(s) detected!`,
        type: 'warning'
      });
    }
  }, [unknownFaces, showUnknownDialog]);

  // 🚀 PERFORMANCE: Optimized data fetching with caching
  const fetchData = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const endpoint = activeTab === 'mark' ? 'students' : 'attendance-report';
      const res = await axios.get(`${BACKEND_URL}/api/admin/${endpoint}`, {
        params: {
          section: currentSectionTag,
          subject: selectedSubject,
          slot: selectedSlot,
          date: selectedDate,
          _t: Date.now()
        },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const validData = res.data.filter(item => item && item.name !== null && item.name !== undefined);
      setData(validData);
      
      // Extract present UIDs
      const presentUids = new Set(
        validData
          .filter(s => s.status === 'PRESENT')
          .map(s => s.uid)
      );
      
      console.log(`📊 Fetched ${validData.length} students, ${presentUids.size} marked present`);
      setMarkedUids(presentUids);
      
    } catch (err) {
      console.error("Fetch Error:", err);
      setAlertInfo({
        show: true,
        msg: 'Failed to fetch data. Please check backend connection.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentSectionTag, selectedSubject, selectedSlot, selectedDate, activeTab, attendanceUpdates]);

  // 🚀 PERFORMANCE: Debounced fetch on filter changes
  useEffect(() => {
    const debouncedFetch = debounce(fetchData, 300);
    debouncedFetch();
    
    return () => debouncedFetch.cancel && debouncedFetch.cancel();
  }, [fetchData]);

  // 🚀 PERFORMANCE: Optimized manual attendance rectification
  const handleRectify = useCallback(
    async (uid, currentStatus) => {
      const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
      try {
        const res = await axios.post(`${BACKEND_URL}/api/attendance/manual-update`, {
          uid,
          date: selectedDate,
          subject: selectedSubject,
          slot: selectedSlot,
          status: newStatus
        }, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (res.data.success) {
          // Update local state
          if (newStatus === 'PRESENT') {
            setMarkedUids(prev => new Set([...prev, uid]));
          } else {
            setMarkedUids(prev => {
              const newSet = new Set(prev);
              newSet.delete(uid);
              return newSet;
            });
          }
          
          setAttendanceUpdates(prev => prev + 1);
          
          setAlertInfo({
            show: true,
            msg: `${uid} marked as ${newStatus}`,
            type: 'success'
          });
          
          // Refresh data
          setTimeout(fetchData, 500);
        }
      } catch (err) {
        console.error(err);
        setAlertInfo({
          show: true,
          msg: 'Failed to update attendance.',
          type: 'error'
        });
      }
    },
    [selectedDate, selectedSubject, selectedSlot, fetchData]
  );

  // 🚀 PERFORMANCE: Optimized group scan
  const handleGroupScan = useCallback(
    debounce(async (imageSrc = null) => {
      if (!imageSrc && (!webcamRef.current || capturing)) return;
      
      setCapturing(true);
      setIsProcessingPhoto(true);
      
      try {
        let blob;
        let imageSource;
        
        if (imageSrc) {
          imageSource = imageSrc;
          blob = await (await fetch(imageSrc)).blob();
        } else {
          imageSource = webcamRef.current.getScreenshot();
          blob = await (await fetch(imageSource)).blob();
        }
        
        const formData = new FormData();
        formData.append('image', blob, 'class_scan.jpg');
        formData.append('section', currentSectionTag);
        formData.append('subject', selectedSubject);
        formData.append('slot', selectedSlot);
        formData.append('date', selectedDate);
        
        const res = await axios.post(`${BACKEND_URL}/api/attendance/group-recognition`, formData, {
          timeout: 15000,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (res.data.success) {
          const recognized = res.data.recognized || res.data.count || 0;
          
          setAttendanceUpdates(prev => prev + 1);
          await fetchData();
          
          setAlertInfo({
            show: true,
            msg: `✅ Marked ${recognized} students as present.`,
            type: 'success'
          });
        }
        
      } catch (err) {
        console.error('Group scan error:', err);
        setAlertInfo({
          show: true,
          msg: err.response?.data?.message || 'Failed to process image. Check backend connection.',
          type: 'error'
        });
      } finally {
        setCapturing(false);
        setIsProcessingPhoto(false);
      }
    }, 1000),
    [currentSectionTag, selectedSubject, selectedSlot, selectedDate, capturing, fetchData]
  );

  // Handle photo upload
  const handlePhotoUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setAlertInfo({
        show: true,
        msg: 'Please upload an image file',
        type: 'warning'
      });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setAlertInfo({
        show: true,
        msg: 'Image size should be less than 5MB',
        type: 'warning'
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      handleGroupScan(e.target.result);
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
  }, [handleGroupScan]);

  // 🚀 PERFORMANCE: Clear unknown faces
  const clearUnknownFaces = useCallback(() => {
    setUnknownFaces([]);
    setShowUnknownDialog(false);
    faceHistoryRef.current.unknown.clear();
  }, []);

  // 🚀 PERFORMANCE: Toggle face detection
  const toggleDetection = useCallback(() => {
    setDetectionActive(!detectionActive);
    if (!detectionActive) {
      setTrackedFaces([]);
      setRecognizedFaces([]);
      faceCache.current.clear();
      faceHistoryRef.current.recognized.clear();
      faceHistoryRef.current.unknown.clear();
    }
  }, [detectionActive]);

  // 🚀 PERFORMANCE: Adjust detection quality
  const adjustDetectionQuality = useCallback((quality) => {
    setDetectionQuality(quality);
    switch(quality) {
      case 'low':
        detectionInterval.current = 200; // 5 FPS
        break;
      case 'medium':
        detectionInterval.current = 100; // 10 FPS
        break;
      case 'high':
        detectionInterval.current = 50; // 20 FPS
        break;
    }
  }, []);

  // 🚀 PERFORMANCE: Reload AI
  const reloadAI = useCallback(async () => {
    setModelsLoaded(false);
    setAiInitialized(false);
    setDetectionActive(false);
    setTrackedFaces([]);
    setRecognizedFaces([]);
    setUnknownFaces([]);
    faceCache.current.clear();
    faceHistoryRef.current.recognized.clear();
    faceHistoryRef.current.unknown.clear();
    
    await initAI();
  }, []);

  // 🚀 PERFORMANCE: Memoized statistics
  const stats = useMemo(() => {
    const total = data.length;
    const present = data.filter(s => s.status === 'PRESENT' || markedUids.has(s.uid)).length;
    return { total, present, absent: total - present };
  }, [data, markedUids]);

  // 🚀 PERFORMANCE: Optimized filtered data
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    const term = searchTerm.toLowerCase();
    return data.filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.uid?.toUpperCase().includes(searchTerm.toUpperCase())
    ).slice(0, 50); // Limit to 50 results for performance
  }, [data, searchTerm]);

  // 🚀 PERFORMANCE: Memoized tracking stats
  const trackingStats = useMemo(() => {
    const activeRecognized = trackedFaces.filter(f => f.isKnown).length;
    const activeUnknown = trackedFaces.filter(f => !f.isKnown).length;
    
    return {
      activeRecognized,
      activeUnknown,
      totalTracked: trackedFaces.length
    };
  }, [trackedFaces]);

  // 🚀 PERFORMANCE: Debounced search
  const handleSearchChange = useCallback(
    debounce((value) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f4f7f6', minHeight: '100vh' }}>
      <CssBaseline />
      
      <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: '#1a1c1e', color: 'white' } }}>
       <Box sx={{ p: 4, textAlign: 'center' }}>
  <Box sx={{ width: 80, height: 80, mx: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
    {/* src  */}
    <img src="/cu-logo.png" style={{ width: '100%', height: 'auto' }} alt="CU Logo" />
  </Box>
  <Typography variant="h6" fontWeight="900">CUIMS Teacher</Typography>
  <Typography variant="body2" color="textSecondary">BCA Faculty Console</Typography>
</Box>
        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 2 }} />
        <List sx={{ px: 2, flexGrow: 1 }}>
          <ListItem 
            button 
            onClick={() => setActiveTab('mark')} 
            selected={activeTab === 'mark'} 
            sx={{ 
              borderRadius: 2, 
              mb: 1, 
              '&.Mui-selected': { bgcolor: CU_RED },
              '&:hover': { bgcolor: 'rgba(227, 30, 36, 0.8)' }
            }}
          >
            <ListItemIcon><VideoCameraFront sx={{ color: 'white' }} /></ListItemIcon>
            <ListItemText 
              primary={<Typography variant="body1">AI Class Scan</Typography>}
              secondary={activeTab === 'mark' ? "Live" : ""} 
            />
          </ListItem>
          <ListItem 
            button 
            onClick={() => setActiveTab('reports')} 
            selected={activeTab === 'reports'} 
            sx={{ 
              borderRadius: 2, 
              mb: 1, 
              '&.Mui-selected': { bgcolor: CU_RED },
              '&:hover': { bgcolor: 'rgba(227, 30, 36, 0.8)' }
            }}
          >
            <ListItemIcon><Assignment sx={{ color: 'white' }} /></ListItemIcon>
            <ListItemText primary={<Typography variant="body1">Audit & Rectify</Typography>} />
          </ListItem>
        </List>
      <Box sx={{ p: 3 }}>
  <Button 
    fullWidth 
    startIcon={<Logout />} 
    variant="contained" 
    onClick={handleLogout}
    sx={{ 
      borderRadius: 2, 
      bgcolor: CU_RED,
      '&:hover': { bgcolor: '#c2181e' }
    }}
  >
    Sign Out
  </Button>
</Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
        {alertInfo.show && (
          <Alert 
            severity={alertInfo.type} 
            variant="filled" 
            sx={{ mb: 3, borderRadius: 2 }}
            onClose={() => setAlertInfo({ ...alertInfo, show: false })}
          >
            {alertInfo.msg}
          </Alert>
        )}

        {/* System Status Bar */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              label={detectionActive ? "LIVE" : "PAUSED"} 
              color={detectionActive ? "success" : "warning"} 
              size="small" 
              icon={detectionActive ? <CheckCircle /> : <Close />}
              onClick={toggleDetection}
              sx={{ cursor: 'pointer' }}
            />
            <Chip 
              label={`${labeledDescriptors.length} Students`}
              color="primary"
              size="small"
              icon={<Face />}
            />
            {trackingStats.activeUnknown > 0 && (
              <Chip 
                label={`${trackingStats.activeUnknown} Unknown`}
                color="warning"
                size="small"
                icon={<PersonOff />}
                onClick={() => setShowUnknownDialog(true)}
                sx={{ cursor: 'pointer' }}
              />
            )}
            <Tooltip title="Detection Quality">
              <Select
                value={detectionQuality}
                onChange={(e) => adjustDetectionQuality(e.target.value)}
                size="small"
                sx={{ ml: 1, height: 32 }}
              >
                <MenuItem value="low">Low (Fast)</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High (Accurate)</MenuItem>
              </Select>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<Refresh />}
              onClick={reloadAI}
              size="small"
              variant="outlined"
            >
              Reload AI
            </Button>
            <Button
              startIcon={detectionActive ? <Close /> : <VideoCameraFront />}
              onClick={toggleDetection}
              size="small"
              variant="contained"
              color={detectionActive ? "warning" : "success"}
            >
              {detectionActive ? "Pause" : "Start"}
            </Button>
          </Box>
        </Box>

        {/* Unknown Faces Alert */}
        {unknownFaces.length > 0 && (
          <Alert 
            severity="warning" 
            sx={{ mb: 3, borderRadius: 2, cursor: 'pointer' }}
            onClick={() => setShowUnknownDialog(true)}
            icon={<PersonOff />}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography component="span" fontWeight="medium">
                  {unknownFaces.length} unique unknown face(s) detected
                </Typography>
              </Box>
              <Button size="small" color="inherit">View Details</Button>
            </Box>
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 4, borderLeft: `6px solid #1a1a1a`, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#eee', color: '#1a1a1a' }}><PeopleAlt /></Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="900">{stats.total}</Typography>
                  <Typography variant="body2" color="textSecondary">Total Students</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 4, borderLeft: `6px solid #4caf50`, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#e8f5e9', color: '#4caf50' }}><VerifiedUser /></Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="900">{stats.present}</Typography>
                  <Typography variant="body2" color="textSecondary">Present Today</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 4, borderLeft: `6px solid ${CU_RED}`, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#fff5f5', color: CU_RED }}><Warning /></Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="900">{stats.absent}</Typography>
                  <Typography variant="body2" color="textSecondary">Absent Today</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 4, borderLeft: `6px solid #ff9800`, height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#fff3e0', color: '#ff9800' }}><Security /></Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="900">{trackingStats.totalTracked}</Typography>
                  <Typography variant="body2" color="textSecondary">Live Tracking</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper elevation={0} sx={{ p: 2, mb: 4, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'white', border: '1px solid #eee', flexWrap: 'wrap' }}>
          <TextField 
            type="date" 
            label="Log Date" 
            size="small" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            inputProps={{ min: dateLimits.min, max: dateLimits.max }} 
            InputLabelProps={{ shrink: true }} 
            sx={{ width: 170 }} 
          />
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select value={selectedYear} label="Year" onChange={(e) => setSelectedYear(e.target.value)}>
              <MenuItem value="1">1st Year</MenuItem>
              <MenuItem value="2">2nd Year</MenuItem>
              <MenuItem value="3">3rd Year</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Group</InputLabel>
            <Select value={selectedGroup} label="Group" onChange={(e) => setSelectedGroup(e.target.value)}>
              <MenuItem value="A">Group A</MenuItem>
              <MenuItem value="B">Group B</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Subject</InputLabel>
            <Select value={selectedSubject} label="Subject" onChange={(e) => setSelectedSubject(e.target.value)}>
              {SUBJECTS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Slot</InputLabel>
            <Select value={selectedSlot} label="Slot" onChange={(e) => setSelectedSlot(e.target.value)}>
              {SLOTS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
          <Chip 
            label={currentSectionTag} 
            color="error" 
            icon={<GroupWork />} 
            sx={{ ml: 'auto', fontWeight: 'bold', bgcolor: CU_RED }} 
          />
        </Paper>

        {activeTab === 'mark' ? (
          <Grid container spacing={4}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2, bgcolor: '#000', borderRadius: 4, position: 'relative', border: `5px solid ${CU_RED}`, overflow: 'hidden' }}>
                <Box sx={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
                  <Webcam 
                    ref={webcamRef} 
                    audio={false} 
                    screenshotFormat="image/jpeg" 
                    width="100%"
                    videoConstraints={{
                      facingMode: 'user',
                      width: { ideal: 640 }, // Reduced resolution
                      height: { ideal: 480 },
                      frameRate: { ideal: 15, max: 30 } // Limit frame rate
                    }}
                    style={{ borderRadius: '8px' }}
                  />
                  <canvas 
                    ref={canvasRef} 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '100%', 
                      zIndex: 10, 
                      pointerEvents: 'none',
                      borderRadius: '8px'
                    }} 
                  />
                  
                  {!detectionActive && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '100%', 
                      height: '100%', 
                      bgcolor: 'rgba(0,0,0,0.7)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      borderRadius: '8px'
                    }}>
                      <Box sx={{ textAlign: 'center', color: 'white' }}>
                        <VideoCameraFront sx={{ fontSize: 60, mb: 2 }} />
                        <Typography variant="h6">Detection Paused</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Click "Start" to begin face tracking
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    size="large" 
                    onClick={() => handleGroupScan()} 
                    disabled={capturing || !modelsLoaded || !detectionActive}
                    sx={{ 
                      bgcolor: CU_RED, 
                      py: 1.5, 
                      fontWeight: '900',
                      '&:hover': { bgcolor: '#c2181e' },
                      flex: 1
                    }}
                    startIcon={<PhotoCamera />}
                  >
                    {capturing ? <CircularProgress size={24} color="inherit" /> : `SCAN CURRENT FRAME`}
                  </Button>
                  
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                  
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    size="large" 
                    onClick={() => fileInputRef.current.click()}
                    disabled={isProcessingPhoto || !modelsLoaded}
                    sx={{ 
                      py: 1.5, 
                      fontWeight: '900', 
                      borderColor: CU_RED, 
                      color: CU_RED,
                      '&:hover': { borderColor: '#c2181e', color: '#c2181e' },
                      flex: 1
                    }}
                    startIcon={<Upload />}
                  >
                    {isProcessingPhoto ? <CircularProgress size={24} /> : `UPLOAD PHOTO`}
                  </Button>
                </Box>
              </Paper>
            </Grid>
            
            {/* Class List Panel */}
            <Grid item xs={12} md={5}>
              <Card sx={{ borderRadius: 4, height: '580px', p: 2, display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    <PeopleAlt color="primary" sx={{ mr: 1 }} /> 
                    Class List 
                    <Typography component="span" variant="body2" sx={{ ml: 1, color: 'textSecondary' }}>
                      ({stats.present}/{stats.total} Present)
                    </Typography>
                  </Typography>
                  <Chip 
                    label="Live Tracking" 
                    color="success" 
                    size="small" 
                    variant="outlined"
                    icon={<CheckCircle sx={{ fontSize: 14 }} />}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                <TextField
                  size="small"
                  placeholder="Search students..."
                  defaultValue={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  sx={{ mb: 2 }}
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                  }}
                />
                
                <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 1 }}>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                      <CircularProgress />
                    </Box>
                  ) : filteredData.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', flexDirection: 'column' }}>
                      <PeopleAlt sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                      <Typography color="textSecondary">No students found</Typography>
                    </Box>
                  ) : (
                    <List sx={{ pt: 0 }}>
                      {filteredData.map(s => {
                        const isPresent = markedUids.has(s.uid) || s.status === 'PRESENT';
                        const isBeingTracked = trackedFaces.some(f => f.uid === s.uid);
                        
                        return (
                          <ListItem 
                            key={s.uid} 
                            divider 
                            sx={{ 
                              bgcolor: isPresent ? 
                                (isBeingTracked ? '#f0fff0' : '#f8f9fa') : 'inherit',
                              borderLeft: isBeingTracked ? '4px solid #4caf50' : 
                                        (isPresent ? '4px solid #e0e0e0' : 'none'),
                              transition: 'all 0.2s',
                              '&:hover': { bgcolor: isPresent ? '#e8f5e9' : '#f5f5f5' }
                            }}
                          >
                            <ListItemAvatar>
                              <Avatar 
                                src={s.profile_pic ? `${BACKEND_URL}${s.profile_pic}` : undefined}
                                sx={{ 
                                  border: isBeingTracked ? '2px solid #4caf50' : 'none',
                                  boxShadow: isBeingTracked ? '0 0 8px rgba(76, 175, 80, 0.5)' : 'none'
                                }}
                              >
                                {!s.profile_pic && s.name?.charAt(0)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText 
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body1" fontWeight={isPresent ? 600 : 400}>
                                    {s.name}
                                  </Typography>
                                  {isBeingTracked && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Box sx={{ 
                                        width: 8, 
                                        height: 8, 
                                        borderRadius: '50%', 
                                        bgcolor: '#4caf50',
                                        animation: 'pulse 1.5s infinite'
                                      }} />
                                      <Typography variant="caption" color="success.main">
                                        Live
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              } 
                              secondary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Chip label={s.uid} size="small" variant="outlined" sx={{ height: 20 }} />
                                </Box>
                              } 
                            />
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                              <Chip 
                                label={isPresent ? "PRESENT" : "ABSENT"} 
                                color={isPresent ? "success" : "default"} 
                                size="small" 
                                sx={{ minWidth: 80, fontWeight: isPresent ? 600 : 400 }}
                              />
                              {isBeingTracked && (
                                <Typography variant="caption" color="success.main" sx={{ fontStyle: 'italic' }}>
                                  ✓ Detected
                                </Typography>
                              )}
                            </Box>
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Box>
                
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                  <Grid container spacing={1}>
                    <Grid item xs={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Total</Typography>
                      <Typography variant="body1" fontWeight="bold">{stats.total}</Typography>
                    </Grid>
                    <Grid item xs={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Present</Typography>
                      <Typography variant="body1" fontWeight="bold" color="success.main">{stats.present}</Typography>
                    </Grid>
                    <Grid item xs={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Live</Typography>
                      <Typography variant="body1" fontWeight="bold" color="warning.main">{recognizedFaces.length}</Typography>
                    </Grid>
                    <Grid item xs={3} sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">Tracked</Typography>
                      <Typography variant="body1" fontWeight="bold" color="info.main">{trackedFaces.length}</Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Box>
                <Typography variant="h5" fontWeight="900">Audit & Manual Fix</Typography>
                <Typography variant="body2" color="textSecondary">
                  Date: {selectedDate} | Section: {currentSectionTag} | Subject: {selectedSubject}
                </Typography>
              </Box>
              <TextField 
                size="small" 
                placeholder="Search by name or UID..." 
                defaultValue={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)} 
                sx={{ width: 300 }}
                InputProps={{ 
                  startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                }} 
              />
            </Box>
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ overflow: 'auto', maxHeight: '500px' }}>
                <Table stickyHeader sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>UID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '25%' }} align="center">Attendance Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Time Recorded</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Assignment sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                          <Typography color="textSecondary">No students found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((s) => {
                        const isPresent = s.status === 'PRESENT' || markedUids.has(s.uid);
                        
                        return (
                          <TableRow key={s.uid} hover>
                            <TableCell>
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar src={s.profile_pic ? `${BACKEND_URL}${s.profile_pic}` : undefined}>
                                  {!s.profile_pic && s.name?.charAt(0)}
                                </Avatar>
                                <Box>
                                  <Typography fontWeight="medium">{s.name}</Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    {s.email || 'No email'}
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={s.uid} 
                                size="small" 
                                variant="outlined" 
                                sx={{ fontWeight: 'medium' }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Click to toggle status">
                                <Chip 
                                  label={isPresent ? 'PRESENT' : 'ABSENT'} 
                                  onClick={() => handleRectify(s.uid, isPresent ? 'PRESENT' : 'ABSENT')} 
                                  color={isPresent ? 'success' : 'error'} 
                                  icon={<SwapHoriz />}
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    cursor: 'pointer', 
                                    minWidth: 110,
                                    '&:hover': { opacity: 0.9 }
                                  }} 
                                />
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {s.time ? (
                                <Box>
                                  <Typography variant="body2">
                                    {new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Typography>
                                  <Typography variant="body2" color="textSecondary">
                                    {new Date(s.time).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="textSecondary">--:--</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* Unknown Faces Dialog */}
      <Dialog 
        open={showUnknownDialog} 
        onClose={() => setShowUnknownDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#fff8e1', borderBottom: '1px solid #ffd54f' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PersonOff sx={{ color: '#ff9800' }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">Unique Unknown Faces Detected</Typography>
              <Typography variant="body2" color="textSecondary">
                {unknownFaces.length} unique face(s) - Duplicates filtered
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Each face is tracked uniquely. Same person won't be counted multiple times.
          </Alert>
          
          {unknownFaces.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <PersonOff sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
              <Typography color="textSecondary">No unknown faces currently detected</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {unknownFaces.map((face, index) => (
                <Grid item xs={6} sm={4} md={3} key={face.id}>
                  <Card sx={{ p: 2, textAlign: 'center', height: '100%' }}>
                    <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 1, bgcolor: '#ffebee', color: '#f44336' }}>
                      <PersonOff />
                    </Avatar>
                    <Typography variant="body2" fontWeight="medium">
                      Unknown Face #{index + 1}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" display="block">
                      Detected: {face.timestamp}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #eee' }}>
          <Button onClick={clearUnknownFaces} color="secondary">
            Clear All
          </Button>
          <Button 
            onClick={() => setShowUnknownDialog(false)} 
            variant="contained" 
            sx={{ bgcolor: CU_RED, '&:hover': { bgcolor: '#c2181e' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      <style jsx="true">{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
}

export default TeacherDashboard;
