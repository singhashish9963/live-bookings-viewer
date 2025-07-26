

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs'); 

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Path to the JSON file for data persistence
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const MAX_BOOKINGS = 50; 

// In-memory array to store booking data
let bookings = [];

// Function to load bookings from the JSON file
function loadBookings() {
    try {
        if (fs.existsSync(BOOKINGS_FILE)) {
            const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
            bookings = JSON.parse(data);
            console.log(`[${new Date().toLocaleTimeString()}] Loaded ${bookings.length} bookings from ${BOOKINGS_FILE}`);
        } else {
            console.log(`[${new Date().toLocaleTimeString()}] ${BOOKINGS_FILE} not found. Starting with empty bookings array.`);
            bookings = [];
        }
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Error loading bookings from file:`, error);
        bookings = []; 
    }
}

// Function to save bookings to the JSON file
function saveBookings() {
    try {
        const bookingsToSave = bookings.slice(0, MAX_BOOKINGS);
        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookingsToSave, null, 2), 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] Saved ${bookingsToSave.length} bookings to ${BOOKINGS_FILE}`);
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Error saving bookings to file:`, error);
    }
}

loadBookings();

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/bookings-data', (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] API request received for /api/bookings-data`);
    res.json(bookings); 
});

// Function to generate a random mock booking
function generateMockBooking() {
    const venueNames = ["Grand Hall", "Sunset Lounge", "Azure Room", "Emerald Suite", "Crystal Ballroom", "Sapphire Deck", "Ruby Quarters"];
    const randomVenue = venueNames[Math.floor(Math.random() * venueNames.length)];
    const randomPartySize = Math.floor(Math.random() * 10) + 2; // Party size between 2 and 11
    const now = new Date();
    const randomOffsetMinutes = Math.floor(Math.random() * 60) - 30; // Between -30 and +29 minutes from now
    const bookingTime = new Date(now.getTime() + randomOffsetMinutes * 60 * 1000);

    return {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        venueName: randomVenue,
        partySize: randomPartySize,
        time: bookingTime.toISOString(),
        isConfirmed: false
    };
}

// Mock function to simulate new bookings every 5 seconds
setInterval(() => {
    const newBooking = generateMockBooking();

    if (typeof newBooking.venueName !== 'string' || newBooking.venueName.trim() === '' ||
        typeof newBooking.partySize !== 'number' || newBooking.partySize < 1 ||
        isNaN(new Date(newBooking.time).getTime())) {
        console.warn(`[${new Date().toLocaleTimeString()}] Skipping malformed mock booking:`, newBooking);
        return;
    }

    bookings.unshift(newBooking);

    // Limit the number of bookings in memory AND save to file
    if (bookings.length > MAX_BOOKINGS) {
        bookings.pop();
    }
    saveBookings(); 

    io.emit('new-booking', newBooking);
    console.log(`[${new Date().toLocaleTimeString()}] New mock booking broadcasted:`, newBooking);

}, 5000); // Generate a new booking every 5 seconds

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`[${new Date().toLocaleTimeString()}] A user connected: ${socket.id}`);

    socket.emit('initial-bookings', [...bookings]);

    socket.on('confirm-booking', (bookingId) => {
        const bookingToConfirm = bookings.find(b => b.id === bookingId);

        if (bookingToConfirm) {
            bookingToConfirm.isConfirmed = true;
            saveBookings(); 
            io.emit('booking-updated', bookingToConfirm);
        } else {
            console.warn(`[${new Date().toLocaleTimeString()}] Booking with ID ${bookingId} not found for confirmation.`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[${new Date().toLocaleTimeString()}] User disconnected: ${socket.id}`);
    });

    // Optional: Error handling for individual sockets
    socket.on('error', (error) => {
        console.error(`[${new Date().toLocaleTimeString()}] Socket error for ${socket.id}:`, error);
    });
});

// Basic Express error handling middleware
app.use((err, req, res, next) => {
    console.error(`[${new Date().toLocaleTimeString()}] Express Error:`, err.stack);
    res.status(500).send('Something broke on the server!');
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`[${new Date().toLocaleTimeString()}] Server listening on port ${PORT}`);
    console.log(`Open your browser at http://localhost:${PORT}`);
});