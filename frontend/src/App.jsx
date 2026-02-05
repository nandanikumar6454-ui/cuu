import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { auth } from './firebaseConfig'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import Login from './components/Login'
import TeacherDashboard from './components/TeacherDasboard'
import StudentDashboard from './components/StudentDashboard'
import AdminDashboard from './components/AdminDashboard'
import StudentEnrollment from './components/StudentEnrollment' 
import Reports from './components/AttendanceReport'

import './App.css'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'))
  const [loading, setLoading] = useState(true)

  // 🛠️ CENTRAL LOGOUT ENGINE: Clears storage & global state
  const handleSignOut = async () => {
    try {
      await signOut(auth); // Firebase sign out
      localStorage.clear(); // Wipe storage
      sessionStorage.clear();
      setToken(''); // Reset state to trigger automatic Navigate to "/"
      setUser({});
      window.location.href = "/"; // Hard redirect to ensure clean state
    } catch (err) {
      console.error("Sign Out Error:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const idToken = await currentUser.getIdToken()
        
        let role = 'teacher';
        const email = currentUser.email.toLowerCase();
        
        // 🛠️ CUIMS Domain-Specific Role Logic
        if (email.includes('admin@cuchd.in')) role = 'admin';
        else if (email.includes('24bca10057@cuchd.in')) role = 'student';

        const userData = { 
          uid: currentUser.uid, 
          email: email, 
          role: role,
          name: email.split('@')[0].toUpperCase()
        };

        setToken(idToken)
        setUser(userData)
        localStorage.setItem('token', idToken)
        localStorage.setItem('user', JSON.stringify(userData))
      } else {
        setToken('')
        setUser({})
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      setLoading(false)
    });

    return () => unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <img src="https://www.cuchd.in/includes/images/cu-logo.png" alt="CU Logo" style={{ height: '80px', marginBottom: '20px' }} />
      <div className="loading" style={{ fontWeight: 'bold', color: '#e31e24' }}>CUIMS - Securing Access...</div>
    </div>
  )

  // Protected Route Logic Wrapper
  const RoleRoute = ({ children, allowedRoles }) => {
    if (!token) return <Navigate to="/" replace />
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />
    return children
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Centralized Redirect Logic */}
          <Route path="/" element={
            !token ? <Login setToken={setToken} setUser={setUser} /> : 
            user.role === 'admin' ? <Navigate to="/admin/dashboard" replace /> :
            user.role === 'student' ? <Navigate to="/student/dashboard" replace /> : 
            <Navigate to="/teacher/dashboard" replace />
          } />

          {/* Admin Routes with handleSignOut */}
          <Route path="/admin/dashboard" element={
            <RoleRoute allowedRoles={['admin']}>
              <AdminDashboard onLogout={handleSignOut} />
            </RoleRoute>
          } />

          {/* Teacher Routes with handleSignOut */}
          <Route path="/teacher/dashboard" element={
            <RoleRoute allowedRoles={['teacher']}>
              <TeacherDashboard onLogout={handleSignOut} />
            </RoleRoute>
          } />

          {/* Student Routes with handleSignOut */}
          <Route path="/student/dashboard" element={
            <RoleRoute allowedRoles={['student']}>
              <StudentDashboard onLogout={handleSignOut} />
            </RoleRoute>
          } />

          {/* Enrollment Portal */}
          <Route path="/enrollment" element={
            <RoleRoute allowedRoles={['teacher', 'admin']}>
              <StudentEnrollment onLogout={handleSignOut} />
            </RoleRoute>
          } />

          {/* Reports Route */}
          <Route path="/reports" element={
            <RoleRoute allowedRoles={['teacher', 'admin']}>
              <Reports token={token} onLogout={handleSignOut} />
            </RoleRoute>
          } />

          {/* Error Handling */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
