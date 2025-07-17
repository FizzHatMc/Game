// server.js
// This file sets up the Node.js server using the Express framework.

const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'db.json');
const wordlistPath = path.join(__dirname, 'wordlist.json');

// --- "Database" & Wordlist Functions ---
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

const getWordPairs = async () => {
    // In the future, you can replace this with a fetch call to your online DB.
    try {
        const data = fs.readFileSync(wordlistPath);
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading wordlist file:", error);
        return [{ normie: "Error", imposters: ["File", "Missing"] }];
    }
};


let lobbies = readDb();

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

// --- API ROUTES ---

app.post('/api/user', (req, res) => {
    const { username } = req.body;
    if (!username || username.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Username must be at least 3 characters long.' });
    }
    res.cookie('username', username, { maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, message: 'Username set successfully.' });
});

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
        lobbies[lobbyId].settings = { imposterCount: 1, timer: 60, useSameImposterWord: true };
        lobbies[lobbyId].votes = {};
    }

    writeDb(lobbies);
    res.json({ success: true, lobbyId });
});

app.post('/api/lobby/join', (req, res) => {
    const { lobbyId } = req.body;
    const username = req.cookies.username;

    if (!lobbies[lobbyId]) {
        return res.status(404).json({ success: false, message: 'Lobby not found.' });
    }
    if (!username) {
        return res.status(401).json({ success: false, message: 'You must set a username first.' });
    }

    const lobby = lobbies[lobbyId];
    if (lobby.gameState !== 'setup') {
        return res.status(403).json({ success: false, message: 'Cannot join a game that has already started.' });
    }

    if (!lobby.players.find(p => p.name === username)) {
        lobby.players.push({ name: username });
        writeDb(lobbies);
    }

    res.json({ success: true, lobbyId, players: lobby.players });
});

app.post('/api/lobby/leave', (req, res) => {
    const { lobbyId } = req.body;
    const username = req.cookies.username;

    if (!lobbies[lobbyId] || !username) {
        return res.json({ success: true });
    }

    const lobby = lobbies[lobbyId];
    if (lobby.host === username) {
        delete lobbies[lobbyId];
    } else {
        lobby.players = lobby.players.filter(p => p.name !== username);
        if (lobby.players.length === 0) {
            delete lobbies[lobbyId];
        }
    }

    writeDb(lobbies);
    res.json({ success: true, message: 'You have left the lobby.' });
});

app.get('/api/lobby/:lobbyId', (req, res) => {
    const { lobbyId } = req.params;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby) {
        return res.status(404).json({ success: false, message: 'Lobby not found.' });
    }

    if (lobby.game === 'imposter' && lobby.gameState === 'discussion' && Date.now() >= lobby.timerEndsAt) {
        lobby.gameState = 'voting';
        writeDb(lobbies);
    }

    const isHost = lobby.host === username;

    let personalLobbyState = { ...lobby };
    if (lobby.game === 'imposter' && (lobby.gameState === 'discussion' || lobby.gameState === 'ended')) {
        const me = lobby.players.find(p => p.name === username);
        personalLobbyState.me = me;
        if (lobby.gameState !== 'ended') {
            personalLobbyState.players = lobby.players.map(p => ({ name: p.name }));
        }
    }

    res.json({ success: true, lobby: personalLobbyState, isHost });
});

// --- GAME SPECIFIC ROUTES ---

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

app.post('/api/game/imposter/start', async (req, res) => {
    const { lobbyId, settings } = req.body;
    const lobby = lobbies[lobbyId];
    const username = req.cookies.username;

    if (!lobby || lobby.host !== username) {
        return res.status(403).json({ success: false, message: 'Only the host can start the game.' });
    }
    if (lobby.players.length <= settings.imposterCount) {
        return res.status(400).json({ success: false, message: 'You must have at least one Normie. Please reduce the number of imposters.' });
    }

    lobby.settings = settings;
    lobby.votes = {};

    let playersToAssign = [...lobby.players];
    const imposters = [];
    for (let i = 0; i < settings.imposterCount; i++) {
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

    const wordPairs = await getWordPairs();
    const wordPair = wordPairs[Math.floor(Math.random() * wordPairs.length)];

    lobby.players.forEach(player => {
        if (player.role === 'Normie') {
            player.word = wordPair.normie;
        }
    });

    if (settings.useSameImposterWord) {
        const imposterWord = wordPair.imposters[Math.floor(Math.random() * wordPair.imposters.length)];
        imposters.forEach(imposter => imposter.word = imposterWord);
    } else {
        imposters.forEach(imposter => {
            imposter.word = wordPair.imposters[Math.floor(Math.random() * wordPair.imposters.length)];
        });
    }

    // NEW: Randomly select a starting player.
    const startingPlayerIndex = Math.floor(Math.random() * lobby.players.length);
    lobby.startingPlayer = lobby.players[startingPlayerIndex].name;

    lobby.gameState = 'discussion';
    lobby.timerEndsAt = Date.now() + (Number(settings.timer) * 1000);

    writeDb(lobbies);
    res.json({ success: true });
});

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
    if (lobby.votes[username].length < lobby.settings.imposterCount && !lobby.votes[username].includes(voteFor)) {
        lobby.votes[username].push(voteFor);
    }

    let totalVotes = 0;
    for (const user in lobby.votes) {
        totalVotes += lobby.votes[user].length;
    }

    if (totalVotes >= lobby.players.length * lobby.settings.imposterCount) {
        lobby.gameState = 'ended';

        const voteCounts = {};
        lobby.players.forEach(p => voteCounts[p.name] = 0);
        for (const voter in lobby.votes) {
            lobby.votes[voter].forEach(votedFor => {
                if(voteCounts[votedFor] !== undefined) {
                    voteCounts[votedFor]++;
                }
            });
        }
        lobby.voteResults = voteCounts;
    }

    writeDb(lobbies);
    res.json({ success: true });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
