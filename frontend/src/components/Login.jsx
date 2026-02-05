import { useState } from 'react';
import { 
  Container, Paper, TextField, Button, Typography, 
  Box, Alert, CircularProgress, InputAdornment, IconButton,
  Tab, Tabs, Divider, Zoom, Fade, Chip 
} from '@mui/material';
import { 
  Visibility, VisibilityOff, Email, Lock, Person, 
  School, AdminPanelSettings, HelpOutline 
} from '@mui/icons-material';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 🛠️ API URL FIX: Hardcoded localhost ko hatakar dynamic URL set kiya
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://cuu-1.onrender.com";

function Login({ setToken, setUser }) {
  const [loginType, setLoginType] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentUid, setStudentUid] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const cuRed = '#e31e24'; // Official Chandigarh University Red

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (loginType === 'student') {
        await handleStudentLogin();
      } else {
        await handleStaffAdminLogin();
      }
    } catch (err) {
      console.error("CUIMS Login Error:", err);
      handleLoginError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async () => {
    if (!studentUid) {
      setError("Please enter your Student UID.");
      return;
    }

    // 🛠️ URL UPDATE: Using BACKEND_URL variable
    const response = await axios.post(`${BACKEND_URL}/api/auth/student-login`, {
      uid: studentUid.toUpperCase(), 
      password: studentPassword
    });

    const { token, user } = response.data;
    saveAndRedirect({ ...user, role: 'student' }, token);
  };

  const handleStaffAdminLogin = async () => {
    // Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // 🛠️ URL UPDATE: Using BACKEND_URL variable
    const backendResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: email.toLowerCase(),
      password
    });

    // CUCHD Domain Role Logic
    let role = email.toLowerCase().includes('admin@cuchd.in') ? 'admin' : 'teacher';

    const userData = {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      role: role,
      id: backendResponse.data.user.id,
      name: backendResponse.data.user.name,
      token: backendResponse.data.token
    };

    saveAndRedirect(userData, backendResponse.data.token);
  };

  const saveAndRedirect = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(token);
    setUser(userData);
    
    // Redirection based on CUIMS roles
    if (userData.role === 'admin') navigate('/admin/dashboard');
    else if (userData.role === 'teacher') navigate('/teacher/dashboard');
    else navigate('/student/dashboard');
  };

  const handleLoginError = (err) => {
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
      setError("Access Denied: Invalid credentials for @cuchd.in account.");
    } else if (err.code === 'auth/network-request-failed') {
      setError("Network error. Please check your internet connection.");
    } else if (err.message === "Network Error") {
      setError("Cannot connect to CUIMS server. Please check if backend is live.");
    } else {
      setError(err.response?.data?.error || "CUIMS Server Error. Please try again later.");
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* CUIMS Header Section */}
      <Box sx={{ bgcolor: 'white', py: 2, textAlign: 'center', borderBottom: `4px solid ${cuRed}`, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <Fade in={true} timeout={800}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="https://www.cuchd.in/includes/images/cu-logo.png" alt="Chandigarh University" style={{ height: '60px' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: cuRed, mt: 1 }}>
              CUIMS PORTAL
            </Typography>
          </Box>
        </Fade>
      </Box>

      <Container maxWidth="sm" sx={{ mt: 6, mb: 4 }}>
        <Zoom in={true}>
          <Paper elevation={8} sx={{ borderRadius: 4, overflow: 'hidden' }}>
            <Tabs 
              value={loginType} 
              onChange={(e, val) => { setLoginType(val); setError(''); }}
              centered
              variant="fullWidth"
              sx={{ 
                bgcolor: '#fafafa',
                '& .MuiTabs-indicator': { height: 3, bgcolor: cuRed }
              }}
            >
              <Tab icon={<Person />} label="STUDENT" value="student" sx={{ fontWeight: 'bold' }} />
              <Tab icon={<School />} label="STAFF" value="teacher" sx={{ fontWeight: 'bold' }} />
              <Tab icon={<AdminPanelSettings />} label="ADMIN" value="admin" sx={{ fontWeight: 'bold' }} />
            </Tabs>

            <Box sx={{ p: 4 }}>
              {error && (
                <Fade in={!!error}>
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>
                </Fade>
              )}

              <form onSubmit={handleLogin}>
                {loginType === 'student' ? (
                  <TextField
                    fullWidth label="Student UID" margin="normal" required
                    variant="outlined"
                    value={studentUid} onChange={(e) => setStudentUid(e.target.value)}
                    placeholder="e.g. 24BCA10057"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Person sx={{ color: cuRed }} /></InputAdornment> }}
                  />
                ) : (
                  <TextField
                    fullWidth label="University Email ID" margin="normal" required
                    variant="outlined"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@cuchd.in"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ color: cuRed }} /></InputAdornment> }}
                  />
                )}

                <TextField
                  fullWidth label="Password" margin="normal" required
                  variant="outlined"
                  type={showPassword ? 'text' : 'password'}
                  value={loginType === 'student' ? studentPassword : password}
                  onChange={(e) => loginType === 'student' ? setStudentPassword(e.target.value) : setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Lock sx={{ color: cuRed }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Button
                  fullWidth type="submit" variant="contained" size="large"
                  disabled={loading}
                  sx={{ 
                    mt: 4, py: 1.5, fontSize: '1rem', fontWeight: 'bold',
                    bgcolor: cuRed, borderRadius: 2,
                    '&:hover': { bgcolor: '#b3171b' }
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'LOGIN TO CUIMS'}
                </Button>
              </form>

              <Box sx={{ mt: 4 }}>
                <Divider>
                  <Chip label="SUPPORT" size="small" variant="outlined" sx={{ color: 'gray' }} />
                </Divider>
              </Box>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <HelpOutline fontSize="small" /> 
                  Issues with login? Contact <strong>CU Helpdesk</strong>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Zoom>

        <Box sx={{ mt: 4, textAlign: 'center', opacity: 0.5 }}>
          <Typography variant="caption" sx={{ display: 'block' }}>
            CUIMS v2.0 - Secure University Infrastructure
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            © 2026 Chandigarh University
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default Login;
