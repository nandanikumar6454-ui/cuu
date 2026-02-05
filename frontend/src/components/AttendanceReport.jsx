import React, { useState, useEffect } from 'react';
import { Container, Paper, Typography, Box, TextField, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, Stack, CircularProgress } from '@mui/material';
import { Download, EventBusy, Assessment } from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';

// 🛠️ API URL FIX: Vite environment variable use karein ya default Render URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://cuu-1.onrender.com";

function AttendanceReport() {
  const [report, setReport] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [section, setSection] = useState('24BCA-2-B');
  const [loading, setLoading] = useState(false);

  // Sunday Blocking Logic
  const handleDateChange = (e) => {
    const selectedDate = new Date(e.target.value);
    if (selectedDate.getDay() === 0) {
      alert("Sundays are holidays! Attendance cannot be viewed or marked.");
      return;
    }
    setDate(e.target.value);
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      // 🛠️ URL UPDATE: localhost ko hatakar dynamic URL set kiya
      const res = await axios.get(`${BACKEND_URL}/api/admin/attendance-report`, {
        params: { section, date }
      });
      setReport(res.data);
    } catch (err) { 
      console.error("Report Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [date, section]);

  // Excel Export Function
  const exportToExcel = () => {
    if (report.length === 0) return alert("No data to export!");
    
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `CU_Attendance_${section}_${date}.xlsx`);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 3, borderLeft: '10px solid #e31e24' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment color="error" sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight="900">Academic Attendance Audit</Typography>
          </Box>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<Download />} 
            onClick={exportToExcel}
            sx={{ fontWeight: 'bold', borderRadius: 2 }}
            disabled={report.length === 0}
          >
            Export to Excel
          </Button>
        </Stack>

        <Box sx={{ mb: 4, display: 'flex', gap: 3, p: 2, bgcolor: '#fcfcfc', borderRadius: 2, border: '1px solid #eee' }}>
          <TextField 
            type="date" 
            label="Report Date" 
            value={date} 
            onChange={handleDateChange} 
            InputLabelProps={{ shrink: true }}
            helperText="Sundays are auto-blocked"
            size="small"
          />
          <TextField 
            label="Section" 
            value={section} 
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            size="small"
            placeholder="e.g. 24BCA-2-B"
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress color="error" />
          </Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: '900' }}>Student Name</TableCell>
                <TableCell sx={{ fontWeight: '900' }}>UID</TableCell>
                <TableCell sx={{ fontWeight: '900' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: '900' }}>Marked Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.map((row) => (
                <TableRow key={row.uid} hover>
                  <TableCell sx={{ fontWeight: '500' }}>{row.name}</TableCell>
                  <TableCell><Chip label={row.uid} size="small" variant="outlined" sx={{ fontWeight: 'bold' }} /></TableCell>
                  <TableCell>
                    <Chip 
                      label={row.status} 
                      color={row.status === 'PRESENT' ? 'success' : 'error'} 
                      size="small" 
                      sx={{ fontWeight: 'bold', minWidth: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {row.time ? new Date(row.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {report.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                    <Typography color="textSecondary">No attendance records found for this section on {date}.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}

export default AttendanceReport;
