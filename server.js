// server.js
// This file sets up the Node.js server using the Express framework.

const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');

const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'db.json');

// --- Database Connection (MariaDB) ---
const dbConnection = mysql.createConnection({
    host: '192.168.178.166',
    user: 'remote',
    password: '040505', // IMPORTANT: Fill in your database password here
    database: 'my_app_db' // IMPORTANT: Fill in your database name here
});

dbConnection.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Successfully connected to the database as id ' + dbConnection.threadId);
});


// --- Local JSON "Database" for Lobbies ---
const readDb = () => {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath);
            if (data.length === 0) return {};
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error("Error reading database file:", error);
        return {};
    }
};

const writeDb = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing to database file:", error);
    }
};

// --- Wordlist & Category Functions ---
const getWordPairs = (categoryIds) => {
    return new Promise((resolve, reject) => {
        if (!categoryIds || categoryIds.length === 0) {
            // If no categories are selected, return an empty list.
            return resolve([]);
        }
        
        const sql = `
            SELECT
                n.word AS normie,
                GROUP_CONCAT(i.word ORDER BY i.id SEPARATOR ',') AS imposters
            FROM
                normie_words n
            JOIN
                imposter_words i ON n.id = i.normie_id
            WHERE
                n.category_id IN (?)
            GROUP BY
                n.id, n.word;
        `;

        dbConnection.query(sql, [categoryIds], (error, results) => {
            if (error) {
                console.error("Error fetching word pairs from DB:", error);
                return reject(error);
            }
            // The DB returns a string for imposters, we need to convert it to an array.
            const formattedResults = results.map(row => ({
                ...row,
                imposters: row.imposters.split(',')
            }));
            resolve(formattedResults);
        });
    });
};

const getCategories = () => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT id, name FROM categories ORDER BY name;";
        dbConnection.query(sql, (error, results) => {
            if (error) {
                 console.error("Error fetching categories from DB:", error);
                return reject(error);
            }
            resolve(results);
        });
    });
};

let lobbies = readDb();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

// --- API ROUTES ---

// Set a user's name via a cookie
app.post('/api/user', (req, res) => {
    const { username } = req.body;
    if (!username || username.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Username must be at least 3 characters long.' });
    }
    // Set cookie to expire in 7 days
    res.cookie('username', username, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });
    res.json({ success: true, message: 'Username set successfully.' });
});

// Create a new game lobby
app.post('/api/lobby/create', (req, res) => {
    const { gameType } = req.body;
    const lobbyId = uuidv4().substring(0, 6);
    const hostUsername = req.cookies.username;

    if (!hostUsername) {
        return res.status(401).json({ success: false, message: 'Cannot create lobby without a username.' });
    }
    if (!gameType) {
        return res.status(400).json({ success: false, message: 'A game type must be specified.' });
    }

    lobbies[lobbyId] = {
        game: gameType,
        players: [{ name: hostUsername }],
        host: hostUsername,
        gameState: 'setup',
    };

    if (gameType === 'imposter') {
        // Initialize default settings for an Imposter game
        lobbies[lobbyId].settings = {
            imposterCountMode: 'fixed',
            imposterCount: 1,
            maxImposterPercentage: 50,
            timer: 60,
            useSameImposterWord: true,
            selectedCategories: []
        };
        lobbies[lobbyId].votes = {};
        lobbies[lobbyId].currentRound = 1;
    }

    writeDb(lobbies);
    res.json({ success: true, lobbyId });
});

// Join an existing game lobby
app.post('/api/lobby/join', (req, res) => {
    const { lobbyId } = req.body;
    const username = req.cookies.username;

    if (!lobbyId) {
        return res.status(400).json({ success: false, message: 'Lobby ID is required.' });
    }
    
    // FIX: Make the lobby lookup more robust by trimming whitespace.
    const trimmedLobbyId = lobbyId.trim();
    const lobby = lobbies[trimmedLobbyId];

    if (!lobby) {
        // Add detailed logging for when a lobby isn't found, which helps debug.
        console.error(`Join failed: Lobby not found. Requested ID: "${trimmedLobbyId}". Available lobbies:`, Object.keys(lobbies));
        return res.status(404).json({ success: false, message: 'Lobby not found.' });
    }
    if (!username) {
        return res.status(401).json({ success: false, message: 'You must set a username first.' });
    }
    
    if (lobby.gameState !== 'setup') {
        return res.status(403).json({ success: false, message: 'Cannot join a game that has already started.' });
    }

    // Add the player to the lobby if they aren't already in it.
    if (!lobby.players.find(p => p.name === username)) {
        lobby.players.push({ name: username });
        writeDb(lobbies);
    }

    res.json({ success: true, lobbyId: trimmedLobbyId });
});

// Leave the current lobby
app.post('/api/lobby/leave', (req, res) => {
    const { lobbyId } = req.body;
    const username = req.cookies.username;

    if (!lobbies[lobbyId] || !username) {
        return res.json({ success: true });
    }

    const lobby = lobbies[lobbyId];
    // If the host leaves, the entire lobby is deleted.
    if (lobby.host === username) {
        delete lobbies[lobbyId];
    } else {
        // Otherwise, just remove the player from the list.
        lobby.players = lobby.players.filter(p => p.name !== username);
        if (lobby.players.length === 0) {
            // If the last player leaves, delete the lobby.
            delete lobbies[lobbyId];
        }
    }
    
    writeDb(lobbies);
    res.json({ success: true, message: 'You have left the lobby.' });
});

// Get the current state of a specific lobby (for polling)
app.get('/api/lobby/:lobbyId', (req, res) => {
    const { lobbyId } = req.params;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby) {
        return res.status(404).json({ success: false, message: 'Lobby not found.' });
    }

    // Automatically advance the game state if the timer runs out.
    if (lobby.game === 'imposter' && lobby.gameState === 'discussion' && Date.now() >= lobby.timerEndsAt) {
        lobby.gameState = 'voting';
        writeDb(lobbies);
    }

    const isHost = lobby.host === username;
    
    // Create a personalized version of the lobby state to send to the client.
    // This ensures players don't see things they shouldn't (like other players' words).
    let personalLobbyState = { ...lobby };
    if (lobby.game === 'imposter' && (lobby.gameState === 'discussion' || lobby.gameState === 'ended')) {
        const me = lobby.players.find(p => p.name === username);
        personalLobbyState.me = me;
        // Don't reveal roles until the game is over.
        if (lobby.gameState !== 'ended') {
            personalLobbyState.players = lobby.players.map(p => ({ name: p.name }));
        }
    }

    res.json({ success: true, lobby: personalLobbyState, isHost });
});

// --- GAME SPECIFIC ROUTES ---

// Spin the Bottle game action
app.post('/api/game/spin-the-bottle', (req, res) => {
    const { lobbyId } = req.body;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby || lobby.host !== username || lobby.players.length < 2) {
        return res.status(400).json({ success: false, message: 'Conditions not met to spin.' });
    }

    const randomIndex = Math.floor(Math.random() * lobby.players.length);
    lobby.lastResult = `The bottle points to... ${lobby.players[randomIndex].name}!`;
    
    writeDb(lobbies);
    res.json({ success: true, result: lobby.lastResult });
});

// Get all available word categories for the Imposter game
app.get('/api/game/imposter/categories', async (req, res) => {
    try {
        const categories = await getCategories();
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch categories from the database.' });
    }
});

// Update the settings for an Imposter game lobby
app.post('/api/game/imposter/settings', (req, res) => {
    const { lobbyId, settings } = req.body;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby || lobby.host !== username) {
        return res.status(403).json({ success: false, message: 'Only the host can change settings.' });
    }

    lobby.settings = settings;
    writeDb(lobbies);
    res.json({ success: true });
});

// Start the Imposter game
app.post('/api/game/imposter/start', async (req, res) => {
    const { lobbyId, settings } = req.body;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby || lobby.host !== username) {
        return res.status(403).json({ success: false, message: 'Only the host can start the game.' });
    }

    // --- Assign Imposter Count ---
    let imposterCount = 0;
    if (settings.imposterCountMode === 'random') {
        const maxImposters = Math.floor(lobby.players.length * (settings.maxImposterPercentage / 100));
        imposterCount = Math.max(1, Math.floor(Math.random() * (maxImposters + 1)));
    } else {
        imposterCount = settings.imposterCount;
    }

    if (lobby.players.length <= imposterCount) {
        return res.status(400).json({ success: false, message: 'You must have at least one Normie. Please reduce the number of imposters.' });
    }
    
    // --- Get Words from DB ---
    let wordPairs = [];
    try {
        wordPairs = await getWordPairs(settings.selectedCategories);
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Could not fetch words from database.' });
    }

    if (wordPairs.length === 0) {
        return res.status(400).json({ success: false, message: 'No words found for the selected categories. Please select at least one category with words.' });
    }
    
    // --- Update Lobby State ---
    lobby.settings = { ...settings, imposterCount }; // Save the final imposter count
    lobby.votes = {};
    lobby.currentRound = 1;

    // --- Assign Roles and Words ---
    let playersToAssign = [...lobby.players];
    const imposters = [];
    for (let i = 0; i < imposterCount; i++) {
        const randomIndex = Math.floor(Math.random() * playersToAssign.length);
        const imposterName = playersToAssign[randomIndex].name;
        const playerInLobby = lobby.players.find(p => p.name === imposterName);
        playerInLobby.role = 'Imposter';
        imposters.push(playerInLobby);
        playersToAssign.splice(randomIndex, 1);
    }
    playersToAssign.forEach(player => {
        const playerInLobby = lobby.players.find(p => p.name === player.name);
        playerInLobby.role = 'Normie';
    });

    const wordPair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    
    lobby.players.forEach(player => {
        if (player.role === 'Normie') {
            player.word = wordPair.normie;
        }
    });
    
    if (settings.useSameImposterWord || wordPair.imposters.length === 1) {
        const imposterWord = wordPair.imposters[Math.floor(Math.random() * wordPair.imposters.length)];
        imposters.forEach(imposter => imposter.word = imposterWord);
    } else {
        imposters.forEach(imposter => {
            imposter.word = wordPair.imposters[Math.floor(Math.random() * wordPair.imposters.length)];
        });
    }

    // --- Set Starting Player & Timer ---
    lobby.startingPlayer = lobby.players[Math.floor(Math.random() * lobby.players.length)].name;
    lobby.gameState = 'discussion';
    lobby.timerEndsAt = Date.now() + (settings.timer * 1000);
    
    writeDb(lobbies);
    res.json({ success: true });
});

// Process a vote in the Imposter game
app.post('/api/game/imposter/vote', (req, res) => {
    const { lobbyId, voteFor } = req.body;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby || !username || lobby.gameState !== 'voting') {
        return res.status(400).json({ success: false, message: 'Cannot vote at this time.' });
    }

    if (!lobby.votes[username]) {
        lobby.votes[username] = [];
    }

    // Only allow one vote per player per round.
    if (lobby.votes[username].length < lobby.currentRound) {
        lobby.votes[username].push(voteFor);
    } else {
        return res.status(400).json({ success: false, message: 'You have already voted in this round.' });
    }

    // Check if everyone has voted in the current round.
    let votesThisRound = 0;
    for (const user in lobby.votes) {
        if (lobby.votes[user].length >= lobby.currentRound) {
            votesThisRound++;
        }
    }

    if (votesThisRound >= lobby.players.length) {
        // If it's the final round, end the game.
        if (lobby.currentRound >= lobby.settings.imposterCount) {
            lobby.gameState = 'ended';
            
            // Tally all votes from all rounds.
            const voteCounts = {};
            lobby.players.forEach(p => voteCounts[p.name] = 0);
            for (const voter in lobby.votes) {
                lobby.votes[voter].forEach(votedFor => {
                    if (voteCounts[votedFor] !== undefined) {
                        voteCounts[votedFor]++;
                    }
                });
            }
            lobby.voteResults = voteCounts;
        } else {
            // Otherwise, advance to the next voting round.
            lobby.currentRound++;
        }
    }

    writeDb(lobbies);
    res.json({ success: true });
});

// Restart the Imposter game with the same players
app.post('/api/game/imposter/restart', (req, res) => {
    const { lobbyId } = req.body;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby || lobby.host !== username) {
        return res.status(403).json({ success: false, message: 'Only the host can restart the game.' });
    }

    // Reset game-specific state but keep players, host, and game type.
    lobby.gameState = 'setup';
    lobby.votes = {};
    lobby.currentRound = 1;
    lobby.players.forEach(p => {
        delete p.role;
        delete p.word;
    });
    delete lobby.voteResults;
    delete lobby.timerEndsAt;
    delete lobby.startingPlayer;

    writeDb(lobbies);
    res.json({ success: true });
});


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
