import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Container, Typography, Paper, Grid, TextField, Button, 
  Box, Table, TableBody, TableCell, TableHead, TableRow, 
  IconButton, Snackbar, Alert, Avatar, Chip, 
  CircularProgress, Stack, MenuItem, Select, FormControl, InputLabel,
  InputAdornment, Divider, Card, CardContent, Tooltip 
} from '@mui/material';
import { 
  PersonAdd, Refresh, Search, School, 
  FileDownload, UploadFile, DeleteForever, DeleteSweep,
  Warning, ErrorOutline, PhotoCamera, VerifiedUser, Layers, Sync, Logout
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// 🛠️ API URL FIX: Vite environment variable use karein ya default Render URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://cuu-1.onrender.com";
const API_BASE_URL = `${BACKEND_URL}/api/admin`;
const CU_RED = '#e31e24';

function AdminDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('24'); 
  const [selectedSection, setSelectedSection] = useState('2'); 
  const [selectedGroup, setSelectedGroup] = useState('B');
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [studentForm, setStudentForm] = useState({ name: '', uid: '', email: '', image: null });
  const [preview, setPreview] = useState(null);

  const currentFullSectionTag = `${selectedBatch}BCA-${selectedSection}-${selectedGroup}`;

  // 🛠️ FETCH LOGIC: Hardcoded localhost ko hatakar dynamic URL set kiya
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setStudents([]); 
    try {
      const res = await axios.get(`${API_BASE_URL}/students`, {
        params: { 
            section: currentFullSectionTag, 
            v: Date.now() 
        },
        headers: { 'Cache-Control': 'no-cache' }
      });
      setStudents(res.data);
    } catch (err) {
      console.error("Fetch Error:", err);
      setSnackbar({ open: true, message: 'Registry Sync Failed. Check Backend Connection.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentFullSectionTag]);

  useEffect(() => { 
    fetchStudents();
    document.title = `Admin | ${currentFullSectionTag}`;
  }, [fetchStudents]);

  const handleHardSync = () => {
    fetchStudents();
    setSnackbar({ open: true, message: 'Database Re-synced Successfully', severity: 'info' });
  };

  const downloadTemplate = () => {
    const headers = "UID,Name,Email,Section\n";
    const sampleData = "24BCA10057,Sanjat Kumar,sanjat@cuchd.in,24BCA-2-B\n";
    const blob = new Blob([headers + sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Bulk_Enrollment_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (uid) => {
    if (!window.confirm(`Permanently wipe student ${uid} and all logs?`)) return;
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/admin/student/${uid}`);
      setSnackbar({ open: true, message: res.data.message || 'Record Cleared', severity: 'success' });
      fetchStudents(); 
    } catch (err) {
      setSnackbar({ open: true, message: 'Deletion failed', severity: 'error' });
    }
  };

  const handleManualRegister = async (e) => {
    e.preventDefault();
    if (!studentForm.image) return setSnackbar({ open: true, message: 'Reference photo is mandatory', severity: 'warning' });
    
    setLoading(true);
    const data = new FormData();
    data.append('name', studentForm.name);
    data.append('uid', studentForm.uid);
    data.append('email', studentForm.email);
    data.append('image', studentForm.image);
    data.append('section', currentFullSectionTag); 

    try {
      const response = await axios.post(`${API_BASE_URL}/enroll-with-face`, data);
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      setStudentForm({ name: '', uid: '', email: '', image: null });
      setPreview(null);
      fetchStudents(); 
    } catch (err) {
      setSnackbar({ open: true, message: "Registration failed", severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = students.length;
    const synced = students.filter(s => s.face_ready).length;
    return { total, synced, pending: total - synced };
  }, [students]);

  const filteredList = useMemo(() => {
    return students.filter(s => 
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.uid?.toUpperCase().includes(searchTerm.toUpperCase())
    );
  }, [students, searchTerm]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderLeft: `10px solid ${CU_RED}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar 
            src="/cu-logoo.png" 
            variant="square" 
            sx={{ width: 60, height: 60, bgcolor: 'transparent' }} 
          />
          <Box>
            <Typography variant="h4" fontWeight="900" color={CU_RED}>CUIMS ADMIN</Typography>
            <Typography variant="body2" color="textSecondary" fontWeight="bold">CUIMS AI Enrollment System | BCA</Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" startIcon={<FileDownload />} onClick={downloadTemplate}>Template</Button>
            <Button variant="contained" component="label" startIcon={bulkLoading ? <CircularProgress size={20} color="inherit" /> : <UploadFile />} sx={{ bgcolor: '#1976d2' }}>
                Bulk Sync <input type="file" hidden multiple />
            </Button>
            <Button 
                variant="contained" 
                color="error" 
                startIcon={<Logout />} 
                onClick={onLogout}
                sx={{ bgcolor: CU_RED, fontWeight: 'bold' }}
            >
                Sign Out
            </Button>
        </Stack>
      </Paper>

      {/* Stats and Controls */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
         <Grid item xs={12} md={8}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 4, bgcolor: '#f8f9fa', height: '100%' }}>
                <Typography variant="h6" fontWeight="800" sx={{ mb: 2 }}>Registry Controls ({currentFullSectionTag})</Typography>
                <Stack direction="row" spacing={2}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Admission Batch</InputLabel>
                        <Select value={selectedBatch} label="Admission Batch" onChange={(e) => setSelectedBatch(e.target.value)}>
                            <MenuItem value="22">2022 Batch</MenuItem><MenuItem value="23">2023 Batch</MenuItem><MenuItem value="24">2024 Batch</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel>Section</InputLabel>
                        <Select value={selectedSection} label="Section" onChange={(e) => setSelectedSection(e.target.value)}>
                            <MenuItem value="1">Section 1</MenuItem><MenuItem value="2">Section 2</MenuItem><MenuItem value="3">Section 3</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel>Group</InputLabel>
                        <Select value={selectedGroup} label="Group" onChange={(e) => setSelectedGroup(e.target.value)}>
                            <MenuItem value="A">Group A</MenuItem><MenuItem value="B">Group B</MenuItem>
                        </Select>
                    </FormControl>
                    <Tooltip title="Hard Database Sync">
                        <IconButton onClick={handleHardSync} sx={{ bgcolor: CU_RED, color: '#fff', '&:hover': { bgcolor: '#000' } }}><Sync /></IconButton>
                    </Tooltip>
                </Stack>
            </Paper>
         </Grid>
         <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', borderRadius: 4, borderBottom: `4px solid ${CU_RED}` }}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', py: 3 }}>
                    <Box><Typography variant="h4" fontWeight="900">{stats.total}</Typography><Typography variant="caption" color="textSecondary">Registry</Typography></Box>
                    <Divider orientation="vertical" flexItem />
                    <Box><Typography variant="h4" fontWeight="900" color="success.main">{stats.synced}</Typography><Typography variant="caption" color="textSecondary">Synced AI</Typography></Box>
                    <Divider orientation="vertical" flexItem />
                    <Box><Typography variant="h4" fontWeight="900" color="warning.main">{stats.pending}</Typography><Typography variant="caption" color="textSecondary">Pending</Typography></Box>
                </CardContent>
            </Card>
         </Grid>
      </Grid>

      <Grid container spacing={4}>
        {/* Enrollment Form */}
        <Grid item xs={12} md={4}>
          <Paper elevation={6} sx={{ p: 3, borderRadius: 5, border: `2px solid ${CU_RED}`, minHeight: '580px' }}>
            <Typography variant="h6" fontWeight="800" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonAdd color="error" /> Enroll Student
            </Typography>
            <form onSubmit={handleManualRegister}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar src={preview} sx={{ width: 130, height: 130, mx: 'auto', border: `3px solid ${CU_RED}`, bgcolor: '#f5f5f5', boxShadow: 3 }}>
                    <PhotoCamera sx={{ fontSize: 50, color: '#ccc' }} />
                  </Avatar>
                  <IconButton component="label" sx={{ position: 'absolute', bottom: 5, right: 5, bgcolor: 'white', boxShadow: 3 }}>
                    <PhotoCamera fontSize="small" />
                    <input accept="image/*" type="file" hidden onChange={(e) => {
                      const f = e.target.files[0];
                      if(f) { setStudentForm({...studentForm, image: f}); setPreview(URL.createObjectURL(f)); }
                    }} />
                  </IconButton>
                </Box>
              </Box>
              <Stack spacing={3}>
                <TextField fullWidth label="UID *" variant="outlined" size="small" required value={studentForm.uid} onChange={(e) => setStudentForm({...studentForm, uid: e.target.value.toUpperCase()})} />
                <TextField fullWidth label="Full Name *" variant="outlined" size="small" required value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} />
                <TextField fullWidth label="Official Email *" variant="outlined" size="small" required type="email" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} />
                <Box sx={{ p: 1.5, bgcolor: '#fdf2f2', borderRadius: 2, textAlign: 'center', border: '1px dashed #e31e24' }}>
                  <Typography variant="caption" color="error" fontWeight="900">MAPPING: {currentFullSectionTag}</Typography>
                </Box>
                <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 1, bgcolor: CU_RED, py: 1.5, fontWeight: '900', borderRadius: 2 }}>
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'REGISTER STUDENT'}
                </Button>
              </Stack>
            </form>
          </Paper>
        </Grid>

        {/* Registry Table */}
        <Grid item xs={12} md={8}>
          <Paper elevation={4} sx={{ p: 3, borderRadius: 5, bgcolor: '#fff', height: '620px', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="900">Student Registry</Typography>
              <TextField 
                size="small" 
                placeholder="Real-time Search..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: 300 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment>, sx: { borderRadius: 4 } }}
              />
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress color="error" /></Box>
              ) : (
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: '800', bgcolor: '#fff' }}>Student Identity</TableCell>
                      <TableCell sx={{ fontWeight: '800', bgcolor: '#fff' }}>AI Sync</TableCell>
                      <TableCell align="center" sx={{ fontWeight: '800', bgcolor: '#fff' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredList.map((s) => (
                      <TableRow key={s.uid} hover>
                        <TableCell>
                          <Stack direction="row" spacing={2} alignItems="center">
                            {/* 🛠️ IMAGE PATH FIX: Hardcoded localhost ko hataya */}
                            <Avatar src={`${BACKEND_URL}${s.profile_pic}`} sx={{ width: 45, height: 45, border: '1px solid #eee' }} />
                            <Box>
                              <Typography variant="subtitle2" fontWeight="700">{s.name}</Typography>
                              <Typography variant="caption" color="error" fontWeight="bold">{s.uid}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            icon={s.face_ready ? <VerifiedUser /> : <Warning />} 
                            label={s.face_ready ? "Synced" : "No Data"} 
                            color={s.face_ready ? "success" : "warning"} 
                            size="small" variant="filled" sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton color="error" size="small" onClick={() => handleDelete(s.uid)}><DeleteForever /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!loading && filteredList.length === 0 && (
                 <Box sx={{ textAlign: 'center', py: 15 }}>
                    <ErrorOutline sx={{ fontSize: 60, color: '#eee', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">No records found</Typography>
                 </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({...snackbar, open: false})} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 3 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}

export default AdminDashboard;
