import { db, auth } from './firebase-config.js';
import { getFirestore, collection, query, where, onSnapshot, doc, setDoc, deleteDoc, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

const getFormattedDate = (dayOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


function Notification({ message, type, onDismiss }) {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 5000);
        return () => clearTimeout(timer);
    }, []);
    
    const bgColor = 
        type === 'success' ? 'bg-green-500' : 
        type === 'warning' ? 'bg-orange-500' : 
        'bg-blue-500';

    return (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white shadow-lg ${bgColor} z-50`}>
            {message}
        </div>
    );
}

function App() {
    const [user, setUser] = React.useState(null);
    const [authReady, setAuthReady] = React.useState(false);
    const [notification, setNotification] = React.useState({ message: '', type: '', visible: false });
    const [currentPage, setCurrentPage] = React.useState('courts');
    const [selectedCourt, setSelectedCourt] = React.useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type, visible: true });
    };

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setCurrentPage('courts');
                setSelectedCourt(null);
            }
            setAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    if (!authReady) {
        return <div className="flex justify-center items-center h-screen"><p className="text-xl text-gray-400">Loading App...</p></div>;
    }
    
    const handleSelectCourt = (courtId) => {
        setSelectedCourt(courtId);
        setCurrentPage('booking');
    };
    
    const navigateTo = (page) => {
        setCurrentPage(page);
        if (page !== 'booking') {
            setSelectedCourt(null);
        }
    }

    return (
        <>
            {notification.visible && (
                <Notification 
                    message={notification.message}
                    type={notification.type}
                    onDismiss={() => setNotification({ ...notification, visible: false })}
                />
            )}
            <div className="container mx-auto p-4 max-w-2xl">
                <Header user={user} navigateTo={navigateTo} />
                {!user ? (
                    <AuthPage showNotification={showNotification} />
                ) : currentPage === 'profile' ? (
                    <ProfilePage showNotification={showNotification} navigateTo={navigateTo} />
                ) : !selectedCourt ? (
                    <CourtSelector onSelectCourt={handleSelectCourt} />
                ) : (
                    <BookingPage 
                        showNotification={showNotification} 
                        selectedCourt={selectedCourt}
                        onBackToCourts={() => navigateTo('courts')}
                    />
                )}
            </div>
        </>
    );
}

function Header({ user, navigateTo }) {
    return (
        <header className="flex justify-between items-center p-4 bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg shadow-lg mb-6 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-cyan-400">Court Booking</h1>
            {user && (
                <div className="flex items-center gap-4">
                    <button onClick={() => navigateTo('profile')} className="px-3 py-1 bg-cyan-500 text-white rounded-md hover:bg-cyan-600 text-sm font-semibold">My Bookings</button>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Welcome, {user.email.split('@')[0]}</p>
                        <button onClick={() => auth.signOut()} className="text-sm text-red-400 hover:underline">Sign Out</button>
                    </div>
                </div>
            )}
        </header>
    );
}

function AuthPage({ showNotification }) {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');

    const handleSignUp = async () => {
        try { await createUserWithEmailAndPassword(auth, email, password); } catch (err) { setError(err.message); }
    };
    const handleSignIn = async () => {
        try { await signInWithEmailAndPassword(auth, email, password); } catch (err) { setError(err.message); }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        if (!email) {
            showNotification("Please enter your email address.", 'warning');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            showNotification("Email sent! Please check your inbox (and spam folder).", 'success');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="bg-gray-800 bg-opacity-50 border border-gray-700 p-8 rounded-lg shadow-lg backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-4 text-white">Please Sign In or Sign Up</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-2 border bg-gray-700 border-gray-600 rounded mb-2 text-white" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-2 border bg-gray-700 border-gray-600 rounded mb-2 text-white" />
            <div className="text-right mb-4">
                <a href="#" onClick={handlePasswordReset} className="text-sm text-cyan-400 hover:underline">
                    Forgot Password?
                </a>
            </div>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-4">
                <button onClick={handleSignIn} className="w-full bg-cyan-500 text-white p-2 rounded hover:bg-cyan-600 font-semibold">Sign In</button>
                <button onClick={handleSignUp} className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 font-semibold">Sign Up</button>
            </div>
        </div>
    );
}

function CourtSelector({ onSelectCourt }) {
    return (
        <div className="bg-gray-800 bg-opacity-50 border border-gray-700 p-8 rounded-lg shadow-lg text-center backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-6 text-white">Select a Court</h2>
            <div className="flex flex-col md:flex-row justify-center gap-6">
                <button onClick={() => onSelectCourt(1)} className="px-8 py-4 text-xl font-semibold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-transform transform hover:scale-105">
                    Court 1
                </button>
                <button onClick={() => onSelectCourt(2)} className="px-8 py-4 text-xl font-semibold rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-transform transform hover:scale-105">
                    Court 2
                </button>
            </div>
        </div>
    );
}

function ProfilePage({ showNotification, navigateTo }) {
    const [allBookings, setAllBookings] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const user = auth.currentUser;
    const [currentTime, setCurrentTime] = React.useState(() => new Date());

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); 

        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        const today = getFormattedDate();
        const tomorrow = getFormattedDate(1);

        const q = query(collection(db, "bookings"), where("playerIds", "array-contains", user.uid), where("date", "in", [today, tomorrow]));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const userBookings = [];
            querySnapshot.forEach((doc) => {
                userBookings.push(doc.data());
            });
            setAllBookings(userBookings);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    const todayDateString = getFormattedDate();
    const tomorrowDateString = getFormattedDate(1);

    const upcomingTodayBookings = allBookings.filter(booking => {
        if (booking.date !== todayDateString) return false;
        const endTimeString = booking.slotId.split('-')[1];
        const [endHour, endMinute] = endTimeString.split(':');
        const slotEndTime = new Date();
        slotEndTime.setHours(endHour, endMinute, 0, 0);
        return currentTime < slotEndTime;
    });

    const tomorrowBookings = allBookings.filter(booking => booking.date === tomorrowDateString);

    const handleCancelBooking = async (booking) => {
        if (!user) return;

        const bookingRef = doc(db, 'bookings', `${booking.date}_${booking.courtId}_${booking.slotId}`);
        try {
            await runTransaction(db, async (transaction) => {
                const bookingDoc = await transaction.get(bookingRef);
                if (!bookingDoc.exists()) throw new Error("This booking does not exist.");

                const data = bookingDoc.data();
                const players = data.players || [];
                const playerIds = data.playerIds || [];
                const userIndexToRemove = playerIds.lastIndexOf(user.uid);

                if (userIndexToRemove === -1) throw new Error("You are not in this booking.");

                players.splice(userIndexToRemove, 1);
                playerIds.splice(userIndexToRemove, 1);

                if (players.length === 0) {
                    transaction.delete(bookingRef);
                } else {
                    transaction.update(bookingRef, { players: players, playerIds: playerIds });
                }
            });
            showNotification(`You have left the ${booking.slotId} slot.`, 'info');
        } catch (error) {
            console.error("Error cancelling booking: ", error);
            showNotification(error.message || "Could not cancel the booking.", 'warning');
        }
    };

    const BookingList = ({ bookings, isCancellable }) => (
        <div className="space-y-4">
            {bookings.sort((a, b) => a.slotId.localeCompare(b.slotId)).map(booking => {
                const userSpotCount = booking.playerIds.filter(id => id === user.uid).length;
                const spotsText = userSpotCount > 1 ? 'spots' : 'spot';
                return (
                    <div key={booking.slotId + booking.courtId} className="flex items-center justify-between p-4 bg-gray-900 bg-opacity-50 border border-gray-700 rounded-lg">
                        <div>
                            <p className="font-semibold text-white">Court {booking.courtId} at {booking.slotId}</p>
                            <p className="text-sm text-green-400 font-semibold">You have {userSpotCount} {spotsText} booked.</p>
                        </div>
                        {isCancellable && (
                            <button onClick={() => handleCancelBooking(booking)} className="text-xs text-red-400 hover:underline">Cancel 1 Spot</button>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="bg-gray-800 bg-opacity-50 border border-gray-700 p-6 rounded-lg shadow-lg backdrop-blur-sm space-y-6">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Today's Bookings ({getFormattedDate()})</h2>
                    <button onClick={() => navigateTo('courts')} className="px-3 py-1 bg-cyan-500 text-white rounded-md hover:bg-cyan-600 text-sm font-semibold">Book Slots</button>
                </div>
                {isLoading ? <p className="text-gray-400">Loading...</p> : upcomingTodayBookings.length > 0 ? <BookingList bookings={upcomingTodayBookings} isCancellable={false} /> : <p className="text-gray-400">No upcoming bookings for today.</p>}
            </div>
            <div className="border-t border-gray-700"></div>
            <div>
                <h2 className="text-2xl font-bold text-white mb-4">Tomorrow's Bookings ({getFormattedDate(1)})</h2>
                {isLoading ? <p className="text-gray-400">Loading...</p> : tomorrowBookings.length > 0 ? <BookingList bookings={tomorrowBookings} isCancellable={true} /> : <p className="text-gray-400">No bookings for tomorrow.</p>}
            </div>
        </div>
    );
}

function PlayerCountModal({ slotId, onBook, onCancel, availableSlots }) {
    const playerOptions = Array.from({ length: availableSlots }, (_, i) => i + 1);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-xl text-center">
                <h3 className="text-lg font-semibold mb-4 text-white">Book Slot: {slotId}</h3>
                <p className="mb-4 text-gray-300">How many players are you booking for?</p>
                <div className="flex justify-center gap-4 mb-4">
                    {playerOptions.map(count => (
                        <button key={count} onClick={() => onBook(count)} className="w-12 h-12 flex items-center justify-center text-lg font-bold rounded-full bg-cyan-500 text-white hover:bg-cyan-600">
                            {count}
                        </button>
                    ))}
                </div>
                <button onClick={onCancel} className="text-sm text-gray-400 hover:underline">Cancel</button>
            </div>
        </div>
    );
}

function BookingPage({ showNotification, selectedCourt, onBackToCourts }) {
    const generateTimeSlots = () => {
        const slots = [];
        let currentTimeInMinutes = 5 * 60;
        const lastSlotStartInMinutes = 22 * 60 + 15; 

        while (currentTimeInMinutes <= lastSlotStartInMinutes) {
            const currentHour = Math.floor(currentTimeInMinutes / 60);
            const currentMinute = currentTimeInMinutes % 60;
            if (currentHour >= 12 && currentHour < 14) {
                currentTimeInMinutes = 14 * 60;
                continue;
            }
            const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
            const nextTimeInMinutes = currentTimeInMinutes + 45;
            const endHour = Math.floor(nextTimeInMinutes / 60);
            const endMinute = nextTimeInMinutes % 60;
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
            slots.push(`${startTime}-${endTime}`);
            currentTimeInMinutes = nextTimeInMinutes;
        }
        return slots;
    };
    
    const timeSlots = generateTimeSlots();
    const [bookings, setBookings] = React.useState({});
    const [isLoading, setIsLoading] = React.useState(true);
    const [slotToBook, setSlotToBook] = React.useState(null); 
    const prevBookingsRef = React.useRef();
    const [bookingDate, setBookingDate] = React.useState(() => getFormattedDate(1));

    React.useEffect(() => {
        const interval = setInterval(() => {
            const newTomorrow = getFormattedDate(1);
            if (newTomorrow !== bookingDate) {
                setBookingDate(newTomorrow);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [bookingDate]);

    React.useEffect(() => {
        setIsLoading(true);
        const q = query(collection(db, "bookings"), where("date", "==", bookingDate), where("courtId", "==", selectedCourt));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const currentBookings = {};
            querySnapshot.forEach((doc) => {
                currentBookings[doc.data().slotId] = doc.data();
            });

            if (prevBookingsRef.current) {
                const prevKeys = Object.keys(prevBookingsRef.current);
                const currentKeys = Object.keys(currentBookings);

                const cancelledSlot = prevKeys.find(key => !currentKeys.includes(key));
                if (cancelledSlot) {
                    showNotification(`Slot ${cancelledSlot} on Court ${selectedCourt} is now available!`);
                } else {
                    currentKeys.forEach(key => {
                        const prevBooking = prevBookingsRef.current[key];
                        const currentBooking = currentBookings[key];
                        if (prevBooking && prevBooking.players && currentBooking && currentBooking.players && currentBooking.players.length < prevBooking.players.length) {
                             showNotification(`A spot in the ${key} slot on Court ${selectedCourt} is now available!`);
                        }
                    });
                }
            }
            
            setBookings(currentBookings);
            setIsLoading(false);
            prevBookingsRef.current = currentBookings;
        });

        return () => unsubscribe();
    }, [bookingDate, selectedCourt]);

    const handleBookSlot = async (slotId, numPlayers) => {
        const user = auth.currentUser;
        if (!user) return;
        setSlotToBook(null);

        if (new Date().getHours() < 5) {
            showNotification("Booking for tomorrow opens at 5:00 AM.", 'warning');
            return;
        }

        const userBookingsQuery = query(collection(db, "bookings"), where("date", "==", bookingDate), where("playerIds", "array-contains", user.uid));
        const userQuerySnapshot = await getDocs(userBookingsQuery);
        const uniqueSlots = new Set();
        userQuerySnapshot.forEach(doc => {
            uniqueSlots.add(doc.data().slotId);
        });

        if (uniqueSlots.size >= 2 && !uniqueSlots.has(slotId)) {
            showNotification("Daily limit of 2 time slots reached. Cancel an existing slot to book another.", 'warning');
            return;
        }

        const bookingRef = doc(db, 'bookings', `${bookingDate}_${selectedCourt}_${slotId}`);

        try {
            await runTransaction(db, async (transaction) => {
                const bookingDoc = await transaction.get(bookingRef);
                
                if (!bookingDoc.exists()) {
                    if (numPlayers > 4) throw new Error("Cannot book more than 4 players.");
                    const players = [];
                    for (let i = 0; i < numPlayers; i++) {
                        players.push({ userId: user.uid, name: user.email });
                    }
                    const playerIds = players.map(p => p.userId);
                    transaction.set(bookingRef, {
                        date: bookingDate,
                        courtId: selectedCourt,
                        slotId: slotId,
                        players: players,
                        playerIds: playerIds
                    });
                } else {
                    const data = bookingDoc.data();
                    const currentPlayers = data.players || [];
                    if (currentPlayers.length + numPlayers > 4) {
                        throw new Error(`Only ${4 - currentPlayers.length} spots are available.`);
                    }
                    if (data.playerIds && data.playerIds.includes(user.uid)) {
                        throw new Error("You are already in this slot.");
                    }
                    const newPlayers = [];
                    for (let i = 0; i < numPlayers; i++) {
                        newPlayers.push({ userId: user.uid, name: user.email });
                    }
                    const updatedPlayers = [...currentPlayers, ...newPlayers];
                    const updatedPlayerIds = updatedPlayers.map(p => p.userId);
                    transaction.update(bookingRef, { players: updatedPlayers, playerIds: updatedPlayerIds });
                }
            });
            showNotification(`You successfully joined the ${slotId} slot!`, 'success');
        } catch (error) {
            console.error("Error booking slot: ", error);
            showNotification(error.message || "Could not book the slot.", 'warning');
        }
    };
    
    const handleCancelBooking = async (slotId) => {
        const user = auth.currentUser;
        if (!user) return;

        const bookingRef = doc(db, 'bookings', `${bookingDate}_${selectedCourt}_${slotId}`);
        try {
            await runTransaction(db, async (transaction) => {
                const bookingDoc = await transaction.get(bookingRef);
                if (!bookingDoc.exists()) {
                    throw new Error("This booking does not exist.");
                }

                const data = bookingDoc.data();
                const players = data.players || [];
                const playerIds = data.playerIds || [];
                
                const userIndexToRemove = playerIds.lastIndexOf(user.uid);

                if (userIndexToRemove === -1) {
                    throw new Error("You are not in this booking to cancel a spot.");
                }

                players.splice(userIndexToRemove, 1);
                playerIds.splice(userIndexToRemove, 1);

                if (players.length === 0) {
                    transaction.delete(bookingRef);
                } else {
                    transaction.update(bookingRef, { players: players, playerIds: playerIds });
                }
            });
            showNotification(`You have left the ${slotId} slot.`, 'info');
        } catch (error) {
            console.error("Error cancelling booking: ", error);
            showNotification(error.message || "Could not cancel the booking.", 'warning');
        }
    };

    return (
        <>
            {slotToBook && (
                <PlayerCountModal 
                    slotId={slotToBook.slotId}
                    availableSlots={slotToBook.availableSlots}
                    onBook={(numPlayers) => handleBookSlot(slotToBook.slotId, numPlayers)}
                    onCancel={() => setSlotToBook(null)}
                />
            )}

            <div className="bg-gray-800 bg-opacity-50 border border-gray-700 p-6 rounded-lg shadow-lg backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={onBackToCourts} className="px-3 py-1 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm font-semibold">‹ Back to Courts</button>
                    <h3 className="text-lg font-semibold text-center text-white">Court {selectedCourt} - Slots for {bookingDate}</h3>
                    <div/>
                </div>

                {isLoading ? <p className="text-center text-gray-400">Loading slots...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {timeSlots.map(slot => {
                            const booking = bookings[slot];
                            const playerCount = booking && booking.players ? booking.players.length : 0;
                            const availableSlots = 4 - playerCount;
                            const isFull = availableSlots <= 0;
                            const isMyBooking = booking && booking.playerIds && booking.playerIds.includes(auth.currentUser.uid);

                            return (
                                <div key={slot} className={`p-4 rounded-lg border flex flex-col transition-all duration-300 ${isFull ? 'bg-gray-700 border-gray-600' : 'bg-gray-900 bg-opacity-50 border-gray-700'}`}>
                                    <div className="w-full flex justify-between items-center">
                                        <div className="font-semibold text-white">{slot}</div>
                                        {isMyBooking ? (
                                             <div className="text-right">
                                                <p className="font-bold text-green-400">Your Booking</p>
                                                <button onClick={() => handleCancelBooking(slot)} className="text-xs text-red-400 hover:underline">Cancel</button>
                                            </div>
                                        ) : isFull ? (
                                            <p className="text-sm font-semibold text-red-400">Full</p>
                                        ) : playerCount > 0 ? (
                                            <button onClick={() => setSlotToBook({ slotId: slot, availableSlots: availableSlots })} className="bg-cyan-500 text-white px-4 py-1 rounded hover:bg-cyan-600 font-semibold">Join</button>
                                        ) : (
                                            <button onClick={() => setSlotToBook({ slotId: slot, availableSlots: 4 })} className="bg-cyan-500 text-white px-4 py-1 rounded hover:bg-cyan-600 font-semibold">Book</button>
                                        )}
                                    </div>
                                    <div className="w-full text-xs text-gray-400 mt-2">
                                        {playerCount > 0 ? (
                                            `Booked by: ${booking.players.map(p => p.name.split('@')[0]).join(', ')}`
                                        ) : (
                                            "4 slots available"
                                        )}
                                        {!isFull && playerCount > 0 && ` (${availableSlots} slot${availableSlots > 1 ? 's' : ''} left)`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));