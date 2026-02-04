import React, { useState, useEffect } from 'react';
import { Container, Paper, Typography, Box, TextField, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, Stack } from '@mui/material';
import { Download, EventBusy } from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';

const BACKEND_URL = "http://localhost:5050";

function AttendanceReport() {
  const [report, setReport] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [section, setSection] = useState('24BCA-2-B');

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
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/attendance-report?section=${section}&date=${date}`);
      setReport(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchReport(); }, [date, section]);

  // Excel Export Function
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `CU_Attendance_${date}.xlsx`);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3, borderRadius: 3, borderLeft: '10px solid #e31e24' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">Academic Attendance Audit</Typography>
          <Button variant="contained" color="success" startIcon={<Download />} onClick={exportToExcel}>
            Export to Sheets
          </Button>
        </Stack>

        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <TextField 
            type="date" 
            label="Select Date" 
            value={date} 
            onChange={handleDateChange} 
            InputLabelProps={{ shrink: true }}
            helperText="Sundays are auto-blocked"
          />
        </Box>

        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><strong>Student Name</strong></TableCell>
              <TableCell><strong>UID</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Marked Time</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report.map((row) => (
              <TableRow key={row.uid}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.uid}</TableCell>
                <TableCell>
                  <Chip label={row.status} color={row.status === 'PRESENT' ? 'success' : 'error'} size="small" />
                </TableCell>
                <TableCell>{row.time ? new Date(row.time).toLocaleTimeString() : '--'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}

export default AttendanceReport;