const express = require('express');
const http = require('http');
const mysql = require('mysql2/promise');
const path = require('path');
const { Server } = require('socket.io'); 

const app = express();
const port = 3000;
const server = http.createServer(app);
const io = new Server(server); // Create a Socket.io server

// API keys 
const validApiKeys = ['hEwHKab6KNtDdSZhytyoVwWtIgfVbBLKzsYomIypM5Wv1CvhUInlTvQQQewct7HxgXXmpoYLRKF9B3Wo4J9ihIvi1vG0vB4j14HIjLmWn8q8qvucwzhKShd3eEYtj7WW'];

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// MySQL database configuration
const dbConfig = {
    host: 'localhost',
    user: '',
    password: '',
    database: '',
    port: '3306',
};

// Function to insert trail coordinates into the database
async function insertTrailCoordinates(coordinates) {
    const connection = await mysql.createConnection(dbConfig);

    try {
        const [rows] = await connection.query(
            'INSERT INTO trail_coordinates (coordinates) VALUES (ST_GeomFromText(?))',
            [`POINT(${coordinates[1]} ${coordinates[0]})`]
        );

        return rows.insertId;
    } finally {
        await connection.end();
    }
}

// Function to insert drawn shapes into the database
async function insertDrawnShape(shapeName, type, coordinates) {
    console.log('Received coordinates for insertion:', coordinates);

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Log the SQL query being executed
        const sqlQuery = `INSERT INTO drawn_shapes (shape_name, type, coordinates) VALUES (?, ?, ST_GeomFromText(?))`;
        console.log('Executing SQL Query:', sqlQuery);

        // Execute the SQL query
        const [result] = await connection.execute(sqlQuery, [shapeName, type, `LINESTRING(${coordinates.join(', ')})`]);

        // Close the database connection
        await connection.end();

        console.log('Drawn shape inserted successfully:', result);
    } catch (error) {
        console.error('Error inserting drawn shape:', error);
    }
}

// Middleware for API key verification
function verifyApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API key' });
    }

    next();
}

// Apply API key verification middleware to relevant routes
app.use(['/gps', '/drawnShapes'], verifyApiKey);

// Route to fetch drawn shapes from the database
app.get('/drawnShapes', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.query(
            'SELECT id, type, ST_AsText(coordinates) AS coordinates FROM drawn_shapes'
        );

        console.log('Drawn Shapes Response:', rows);

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching drawn shapes from the database:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Socket.io connected');

    socket.on('message', async (message) => {
        console.log('Received Socket.io message:', message);

        try {
            const data = JSON.parse(message);
            const { type, coordinates } = data;

            // Insert the drawn shape into the database
            const insertId = await insertDrawnShape(type, coordinates);
            console.log('Inserted into database. ID:', insertId);

            // Broadcast the received data to all connected clients
            io.emit('message', JSON.stringify({ success: true, data }));
        } catch (error) {
            console.error('Error processing Socket.io message:', error);
        }
    });
});

// Express route to handle incoming GPS coordinates
app.post('/gps', express.json(), async (req, res) => {
    const { latitude, longitude, time } = req.body;

    try {
        // Convert latitude and longitude to a point geometry format
        const coordinates = [parseFloat(longitude), parseFloat(latitude)];

        // Insert the trail coordinates into the database
        const insertId = await insertTrailCoordinates(coordinates, time);

        res.status(200).json({ success: true, insertId });
    } catch (error) {
        console.error('Error inserting coordinates into the database:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

app.post('/drawnShapes', async (req, res) => {
    try {
        // Check if the required properties are present in req.body
        if (!req.body || !req.body.shapeName || !req.body.type || !req.body.coordinates) {
            console.error('Invalid drawn shape data received:', req.body);
            return res.status(400).json({ success: false, error: 'Invalid data received' });
        }

        const { shapeName, type, coordinates } = req.body;

        // Log the received data
        console.log('Received drawn shape data:', { shapeName, type, coordinates });

        // Insert the drawn shape into the database
        await insertDrawnShape(shapeName, type, coordinates);

        // Respond to the client
        res.json({ success: true });
    } catch (error) {
        console.error('Error handling drawn shape data:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Catch-all route for single-page application
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, '..', 'public') });
});

// Start the Express server
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});