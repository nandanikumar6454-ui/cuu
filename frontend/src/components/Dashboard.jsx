import { useState, useEffect } from 'react';
import { 
  Button, Container, Typography, Paper, Table, TableBody, TableCell, 
  TableHead, TableRow, Select, MenuItem, Box, Grid, Card, 
  CardContent, Avatar, Divider, Chip, FormControl, InputLabel 
} from '@mui/material';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Logout, School, People, CheckCircle, PendingActions } from '@mui/icons-material';
import axios from 'axios';

function Dashboard({ setToken }) {
  const [attendance, setAttendance] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const today = new Date().toISOString().split('T')[0];
  
  const cuRed = '#e31e24';

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.clear();
    setToken('');
  };

  // Fetch available classes for the teacher
  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/classes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(res.data);
      if (res.data.length > 0) setSelectedClass(res.data[0].id);
    } catch (err) {
      console.error("Error fetching classes", err);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedClass) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/attendance/filtered?classId=${selectedClass}&date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendance(res.data.students || []);
    } catch (err) {
      console.error("Error fetching attendance", err);
    }
  };

  const handleRectify = async (studentUid, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:5000/api/attendance/rectify', {
        studentUid, classId: selectedClass, date: today, newStatus
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Status updated to ${newStatus}`);
      fetchAttendance();
    } catch (err) {
      alert("Error updating status");
    }
  };

  useEffect(() => { fetchClasses(); }, []);
  useEffect(() => { fetchAttendance(); }, [selectedClass]);

  // Stats calculation
  const presentCount = attendance.filter(row => row.status === 'PRESENT').length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* CUIMS Teacher Header */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: 'white', borderLeft: `8px solid ${cuRed}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: cuRed, width: 60, height: 60 }}><School /></Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: cuRed }}>CUIMS Teacher Panel</Typography>
            <Typography variant="body2" color="textSecondary">Manage Attendance for Section: 24BCA-2-B</Typography>
          </Box>
        </Box>
        <Button variant="contained" color="error" startIcon={<Logout />} onClick={handleLogout}>Logout</Button>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <People sx={{ fontSize: 50, color: '#1976d2' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{attendance.length}</Typography>
                <Typography color="textSecondary">Total Students Enrolled</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: 2, borderBottom: `4px solid ${presentCount > 0 ? 'green' : '#ccc'}` }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <CheckCircle sx={{ fontSize: 50, color: 'green' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{presentCount}</Typography>
                <Typography color="textSecondary">Marked Present Today</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <PendingActions color="primary" /> Attendance Sheet
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Class</InputLabel>
            <Select value={selectedClass} label="Select Class" onChange={(e) => setSelectedClass(e.target.value)}>
              {classes.map((cls) => (
                <MenuItem key={cls.id} value={cls.id}>{cls.name} - {cls.section}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        <Divider sx={{ mb: 2 }} />

        <Table stickyHeader>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f9f9f9' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>UID</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Current Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="center">Update Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attendance.map((row) => (
              <TableRow key={row.uid} hover>
                <TableCell sx={{ fontWeight: 'medium' }}>{row.name}</TableCell>
                <TableCell><Chip label={row.uid} size="small" variant="outlined" /></TableCell>
                <TableCell>
                  <Chip 
                    label={row.status || 'NOT MARKED'} 
                    size="small" 
                    sx={{ 
                      fontWeight: 'bold', 
                      bgcolor: row.status === 'PRESENT' ? '#e8f5e9' : '#ffebee', 
                      color: row.status === 'PRESENT' ? '#2e7d32' : '#d32f2f' 
                    }} 
                  />
                </TableCell>
                <TableCell align="center">
                  <Select 
                    size="small" 
                    value={row.status || ''} 
                    displayEmpty
                    onChange={(e) => handleRectify(row.uid, e.target.value)}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="" disabled>Select Status</MenuItem>
                    <MenuItem value="PRESENT">Present</MenuItem>
                    <MenuItem value="ABSENT">Absent</MenuItem>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}

export default Dashboard;