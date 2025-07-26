

document.addEventListener('DOMContentLoaded', () => {
    // Connect to the Socket.IO server
    const socket = io();

    const bookingsList = document.getElementById('bookings-list');
    let emptyStateMessage = document.getElementById('empty-state-message'); 

    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'status-indicator';
    document.body.insertBefore(statusIndicator, document.body.firstChild);

    // Function to update status indicator
    function updateStatus(status, className) {
        statusIndicator.textContent = `Status: ${status}`;
        statusIndicator.className = className;
    }

    // Helper function to create a booking item DOM element
    function createBookingItemElement(booking, isInitial = false) {
        
        if (!booking || typeof booking.venueName !== 'string' || !booking.partySize || !booking.time || !booking.id || typeof booking.isConfirmed === 'undefined') {
            console.error('Received malformed booking data, skipping:', booking);
            return null;
        }

        const bookingItem = document.createElement('div');
        bookingItem.classList.add('booking-item');
        bookingItem.dataset.bookingId = booking.id; 

       
        if (booking.isConfirmed) {
            bookingItem.classList.add('confirmed');
        }

        let formattedTime = 'Invalid Time';
        try {
            const date = new Date(booking.time);
            if (date instanceof Date && !isNaN(date)) {
                formattedTime = date.toLocaleTimeString();
            } else {
                console.warn('Invalid date string received for booking:', booking.time);
            }
        } catch (e) {
            console.error('Error formatting booking time:', e, booking.time);
        }

        bookingItem.innerHTML = `
            <p><strong>Venue:</strong> <span>${booking.venueName}</span></p>
            <p><strong>Party Size:</strong> <span>${booking.partySize}</span></p>
            <p><strong>Time:</strong> <span>${formattedTime}</span></p>
        `;

        const timestamp = document.createElement('small');
        timestamp.textContent = `Received: ${new Date().toLocaleTimeString()} ${isInitial ? '(initial)' : ''}`;
        bookingItem.appendChild(timestamp);

        // Added Confirm Button (if not already confirmed) or Confirmed Status
        if (!booking.isConfirmed) {
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirm Booking';
            confirmButton.classList.add('confirm-button');
            confirmButton.dataset.bookingId = booking.id; 

            confirmButton.addEventListener('click', () => {
                socket.emit('confirm-booking', booking.id); 
                confirmButton.disabled = true; 
                confirmButton.textContent = 'Confirming...';
            });
            bookingItem.appendChild(confirmButton);
        } else {
            const confirmedStatus = document.createElement('span');
            confirmedStatus.textContent = '✅ Confirmed';
            confirmedStatus.classList.add('confirmed-status');
            bookingItem.appendChild(confirmedStatus);
        }

        return bookingItem;
    }

    // Function to handle adding a booking to the list, managing empty state and limits
    function addBookingToList(booking, isInitial = false) {
        const bookingItem = createBookingItemElement(booking, isInitial);
        if (bookingItem) {
            
            if (emptyStateMessage && emptyStateMessage.parentElement) {
                emptyStateMessage.remove();
                emptyStateMessage = null; 
            }

            bookingsList.prepend(bookingItem);

            
            while (bookingsList.children.length > 50) {
                bookingsList.lastChild.remove();
            }
        }
    }

    // Listen for the 'new-booking' event from the server
    socket.on('new-booking', (booking) => {
        console.log('New booking received:', booking);
        addBookingToList(booking, false); 
    });

    // Handle initial bookings when a client connects
    socket.on('initial-bookings', (initialBookings) => {
        console.log('Received initial bookings:', initialBookings);

        
        bookingsList.innerHTML = '';

        
        if (initialBookings.length === 0) {
            
            if (!emptyStateMessage) { 
                emptyStateMessage = document.createElement('p');
                emptyStateMessage.id = 'empty-state-message';
                emptyStateMessage.textContent = "Waiting for the first booking...";
                bookingsList.appendChild(emptyStateMessage);
            } else if (!emptyStateMessage.parentElement) { 
                bookingsList.appendChild(emptyStateMessage);
            }
        } else {
            
            if (emptyStateMessage && emptyStateMessage.parentElement) {
                emptyStateMessage.remove();
                emptyStateMessage = null; 
            }
           
            [...initialBookings].reverse().forEach(booking => {
                addBookingToList(booking, true); 
            });
            
            while (bookingsList.children.length > 50) {
                bookingsList.lastChild.remove();
            }
        }
    });

   
    socket.on('booking-updated', (updatedBooking) => {
        console.log('Booking updated received:', updatedBooking);

        
        const existingBookingItem = document.querySelector(`.booking-item[data-booking-id="${updatedBooking.id}"]`);

        if (existingBookingItem) {
            
            existingBookingItem.remove();

            
            const newBookingItem = createBookingItemElement(updatedBooking);

            if (newBookingItem) {
                
                bookingsList.prepend(newBookingItem);

                
                newBookingItem.classList.add('confirmed-animation');
                
                setTimeout(() => {
                    newBookingItem.classList.remove('confirmed-animation');
                }, 1000); 
            }
        } else {
            console.warn(`Booking item with ID ${updatedBooking.id} not found on page to update. Potentially out of view or already removed.`);
            
        }
    });


    // Socket.IO connection status handlers
    socket.on('connect', () => {
        console.log('Connected to Socket.IO server!');
        updateStatus('Connected', 'connected');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server!');
        updateStatus('Disconnected', 'disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        updateStatus(`Connection Error: ${error.message}`, 'error');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnecting... Attempt ${attemptNumber}`);
        updateStatus(`Reconnecting... (Attempt ${attemptNumber})`, 'reconnecting');
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        updateStatus('Reconnected', 'connected');
    });

    socket.on('reconnect_error', (error) => {
        console.error('Socket.IO reconnection error:', error);
        updateStatus(`Reconnection Error: ${error.message}`, 'error');
    });

    socket.on('reconnect_failed', () => {
        console.error('Socket.IO reconnection failed permanently.');
        updateStatus('Reconnection Failed', 'error');
    });
});