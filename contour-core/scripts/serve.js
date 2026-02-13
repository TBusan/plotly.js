#!/usr/bin/env node

'use strict';

/**
 * Demo server for contour-core
 * Simple HTTP server for testing and demos
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'text/plain';
}

function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File not found, try index.html
                if (path.extname(filePath) === '.html') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 - File Not Found</h1>');
                } else {
                    // Try to serve demo.html as default
                    const demoPath = path.join(__dirname, 'demo.html');
                    serveFile(demoPath, res);
                }
                return;
            }
            console.error('Error reading file:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 - Internal Server Error');
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;

    // Default to demo.html for root
    if (filePath === './') {
        filePath = './demo.html';
    }

    // Remove query string
    if (filePath.indexOf('?') !== -1) {
        filePath = filePath.split('?')[0];
    }

    console.log('[' + new Date().toLocaleTimeString() + ']', req.method, req.url);

    serveFile(filePath, res);
});

server.listen(PORT, () => {
    console.log('========================================');
    console.log('  Contour-Core v0.3.0 - Demo Server');
    console.log('========================================\n');
    console.log('Server running at:');
    console.log('  http://localhost:' + PORT);
    console.log('\nDemo pages:');
    console.log('  http://localhost:' + PORT + '/demo.html');
    console.log('  http://localhost:' + PORT + '/demo_simple.html');
    console.log('  http://localhost:' + PORT + '/complete-demo.html (完整功能演示!)');
    console.log('  http://localhost:' + PORT + '/demo_interactive.html (交互演示)');
    console.log('\nPress Ctrl+C to stop the server');
    console.log('========================================\n');

    // Try to open browser automatically
    const { exec } = require('child_process');
    const url = 'http://localhost:' + PORT + '/complete-demo.html';

    // Try different commands based on OS
    const commands = process.platform === 'win32' ? ['start', url] : ['open', url];

    exec(commands[0], commands[1], (error) => {
        if (error) {
            console.log('Note: Could not auto-open browser');
            console.log('Please open manually: ' + url);
        } else {
            console.log('✅ Browser opened automatically!');
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Error: Port ' + PORT + ' is already in use!');
        console.error('   Try: npm run demo (use a different port)');
    } else {
        console.error('❌ Server error:', err);
    }
});
