import React, { useState, useEffect } from 'react';
import { Container, Paper, Typography, Box, Grid, Card, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Chip, Avatar } from '@mui/material';
import { AccountCircle, CheckCircle, Warning } from '@mui/icons-material';
import axios from 'axios';

const BACKEND_URL = "http://localhost:5050";
const CU_RED = '#e31e24';

function StudentDashboard() {
  const [myAttendance, setMyAttendance] = useState([]);
  // Sanjat Kumar ki details (Demo for now)
  const studentInfo = { name: "Sanjat Kumar", uid: "24BCA10057", section: "24BCA-2-B" };

  useEffect(() => {
    const fetchMyData = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/student/my-attendance?uid=${studentInfo.uid}`);
        setMyAttendance(res.data);
      } catch (err) { console.error("Error fetching student data", err); }
    };
    fetchMyData();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      {/* Student Profile Header */}
      <Paper elevation={3} sx={{ p: 3, mb: 4, display: 'flex', alignItems: 'center', gap: 3, borderLeft: `10px solid ${CU_RED}` }}>
        <Avatar sx={{ width: 80, height: 80, bgcolor: CU_RED }}><AccountCircle sx={{ fontSize: 60 }} /></Avatar>
        <Box>
          <Typography variant="h4" fontWeight="bold">{studentInfo.name}</Typography>
          <Typography variant="subtitle1" color="textSecondary">UID: {studentInfo.uid} | {studentInfo.section}</Typography>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Overall Percentage Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6">Overall Attendance</Typography>
            <Typography variant="h3" color={CU_RED} fontWeight="900">85%</Typography>
            <LinearProgress variant="determinate" value={85} sx={{ mt: 2, height: 10, borderRadius: 5, bgcolor: '#eee', '& .MuiLinearProgress-bar': { bgcolor: CU_RED } }} />
          </Card>
        </Grid>

        {/* Subject Wise List */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Subject-wise Analysis</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subject</TableCell>
                  <TableCell align="center">Percentage</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {["Computer Networks", "Web Development", "Java"].map((sub) => (
                  <TableRow key={sub}>
                    <TableCell fontWeight="bold">{sub}</TableCell>
                    <TableCell align="center">88%</TableCell>
                    <TableCell align="center"><Chip icon={<CheckCircle />} label="Safe" color="success" size="small" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default StudentDashboard;