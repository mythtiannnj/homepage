const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get all config data
app.get('/api/config', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load config' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseErr) {
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});

// API endpoint to get events only
app.get('/api/events', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load events' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData.events || []);
    } catch (parseErr) {
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});

// API endpoint for system info
app.get('/api/system', (req, res) => {
  const configPath = path.join(__dirname, 'config.json');
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load system info' });
    }
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData.systemInfo || {});
    } catch (parseErr) {
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});

// Serve timeline.html at /timeline
app.get('/timeline', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

// Serve error pages
app.get('/404', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.get('/500', (req, res) => {
  res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});

// All other routes serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// 500 error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});