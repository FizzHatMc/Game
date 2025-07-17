// public/js/games/imposter.js

window.Imposter = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let timerInterval = null;
    let myVotes = [];

    const render = (state) => {
        if (!container) return;

        let content = '';
        switch (state.lobby.gameState) {
            case 'setup':
                myVotes = []; // Reset votes on new game
                content = renderSetup(state);
                break;
            case 'discussion':
                content = renderDiscussion(state);
                break;
            case 'voting':
                content = renderVoting(state);
                break;
            case 'ended':
                content = renderEnded(state);
                break;
            default:
                content = `<p>An error has occurred.</p>`;
        }

        const html = `
            <div class="card">
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <button id="back-to-selection" class="secondary">&larr; Back to Games</button>
                    ${state.lobbyId ? '<button id="leave-lobby-btn" class="secondary" style="border-color: #e74c3c; color: #e74c3c;">Leave Lobby</button>' : ''}
                </div>
                <h2>Imposter</h2>
                ${!state.lobbyId ? renderLobbyJoin() : content}
            </div>
        `;
        container.innerHTML = html;
        addEventListeners(state);

        if (state.lobby.gameState === 'discussion') {
            startTimer(state.lobby.timerEndsAt);
        }
    };

    const renderLobbyJoin = () => `
        <p>Create a new lobby or enter a code to join one.</p>
        <div class="input-group">
            <button id="create-lobby-btn">Create New Lobby</button>
        </div>
        <hr style="margin: 20px 0;">
        <div class="input-group">
            <input type="text" id="join-lobby-input" placeholder="Enter Lobby Code">
            <button id="join-lobby-btn">Join Lobby</button>
        </div>
        <p id="lobby-message" class="message"></p>
    `;

    const renderSetup = (state) => `
        <p>Lobby Code: <strong style="font-size: 1.2em; letter-spacing: 2px;">${state.lobbyId}</strong></p>
        <div id="qrcode" style="background: white; padding: 16px; border-radius: 8px; margin: 20px auto; width: fit-content;"></div>
        <hr style="margin: 20px 0;">
        <p><strong>Players:</strong></p>
        <ul class="player-list">
            ${state.lobby.players.map(p => `<li class="player-tag">${p.name} ${p.name === state.lobby.host ? '👑 (Host)' : ''}</li>`).join('')}
        </ul>
        <div class="imposter-settings">
            <h4>Game Settings</h4>
            <label for="imposter-count">Number of Imposters:</label>
            <input type="number" id="imposter-count" min="1" value="${state.lobby.settings.imposterCount}" ${!state.isHost ? 'disabled' : ''}>
            <label for="timer-duration">Round Timer (seconds):</label>
            <input type="number" id="timer-duration" min="30" step="15" value="${state.lobby.settings.timer}" ${!state.isHost ? 'disabled' : ''}>
        </div>
        <button id="start-game-btn" ${!state.isHost ? 'disabled' : ''}>Start Game</button>
        <p id="game-message" class="message"></p>
        ${!state.isHost ? '<p>Waiting for the host to start the game.</p>' : ''}
    `;

    const renderDiscussion = (state) => {
        return `
            <div class="imposter-reveal">
                <p>You are a...</p>
                <h3 class="${state.lobby.me.role.toLowerCase()}">${state.lobby.me.role}</h3>
                <p>Your word is:</p>
                <h4>${state.lobby.me.word}</h4>
            </div>
            <div class="imposter-timer">
                <p>Time Remaining:</p>
                <div id="timer-display">--:--</div>
            </div>
        `;
    };

    const renderVoting = (state) => {
        const votesLeft = state.lobby.settings.imposterCount - myVotes.length;
        return `
            <h3>Time's Up! Vote for who you think is the Imposter.</h3>
            <p>You have <strong>${votesLeft}</strong> vote(s) left.</p>
            <div class="player-vote-list">
                ${state.lobby.players.map(p => {
            const hasVotedFor = myVotes.includes(p.name);
            return `<button class="vote-btn" data-vote-for="${p.name}" ${hasVotedFor ? 'disabled' : ''}>${p.name} ${hasVotedFor ? '✓' : ''}</button>`
        }).join('')}
            </div>
            <p id="game-message" class="message">${votesLeft <= 0 ? 'Waiting for other players to vote...' : ''}</p>
        `;
    };

    const renderEnded = (state) => {
        const results = state.lobby.voteResults;
        let content = '<h4>Vote Counts:</h4><ul>';
        for (const player in results) {
            content += `<li><strong>${player}:</strong> ${results[player]} votes</li>`;
        }
        content += '</ul><hr><h4 style="margin-top: 20px;">Role Reveal:</h4><ul>';
        state.lobby.players.forEach(p => {
            content += `<li><strong>${p.name}</strong> was a <span class="${p.role.toLowerCase()}">${p.role}</span></li>`;
        });
        content += '</ul>';

        return `
            <h3>Game Over!</h3>
            ${content}
            <button id="play-again-btn">Play Again</button>
        `;
    };


    const addEventListeners = (state) => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('join-lobby-btn')?.addEventListener('click', handleJoinLobby);
        document.getElementById('start-game-btn')?.addEventListener('click', handleStartGame);
        document.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', handleVote));
        document.getElementById('play-again-btn')?.addEventListener('click', handleCreateLobby); // Host can restart

        if (state.isHost) {
            document.getElementById('imposter-count')?.addEventListener('input', handleSettingsChange);
            document.getElementById('timer-duration')?.addEventListener('input', handleSettingsChange);
        }

        if (state.lobbyId && state.lobby.gameState === 'setup' && document.getElementById('qrcode')) {
            document.getElementById('qrcode').innerHTML = "";
            new QRCode(document.getElementById('qrcode'), { text: `${window.location.origin}#join=${state.lobbyId}`, width: 128, height: 128 });
        }
    };

    const handleGoBack = () => {
        if (lobbyId) handleLeaveLobby();
        else cleanup();
        if (goBackCallback) goBackCallback();
    };

    const handleLeaveLobby = async () => {
        await fetch('/api/lobby/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
        });
        cleanup();
        if (goBackCallback) goBackCallback();
    };

    const handleCreateLobby = async () => {
        const response = await fetch('/api/lobby/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameType: 'imposter' })
        });
        const data = await response.json();
        if (data.success) {
            lobbyId = data.lobbyId;
            startPolling();
        }
    };

    const handleJoinLobby = async () => {
        const idToJoin = document.getElementById('join-lobby-input').value.trim();
        if (!idToJoin) return;
        const response = await fetch('/api/lobby/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId: idToJoin }),
        });
        const data = await response.json();
        if (data.success) {
            lobbyId = data.lobbyId;
            startPolling();
        } else {
            document.getElementById('lobby-message').textContent = data.message;
        }
    };

    const handleSettingsChange = async () => {
        const settings = {
            imposterCount: document.getElementById('imposter-count').value,
            timer: document.getElementById('timer-duration').value,
        };
        await fetch('/api/game/imposter/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId, settings }),
        });
    };

    const handleStartGame = async () => {
        const gameMessage = document.getElementById('game-message');
        gameMessage.textContent = ''; // Clear previous errors
        const settings = {
            imposterCount: document.getElementById('imposter-count').value,
            timer: document.getElementById('timer-duration').value,
        };
        const response = await fetch('/api/game/imposter/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId, settings }),
        });
        const data = await response.json();
        if (!data.success) {
            gameMessage.textContent = data.message;
        }
    };

    const handleVote = async (e) => {
        const voteFor = e.target.dataset.voteFor;
        myVotes.push(voteFor);
        e.target.disabled = true;
        e.target.textContent += ' ✓';

        await fetch('/api/game/imposter/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId, voteFor }),
        });
    };

    const startTimer = (endTime) => {
        if (timerInterval) clearInterval(timerInterval);
        const timerDisplay = document.getElementById('timer-display');

        const updateTimer = () => {
            if (!timerDisplay) {
                clearInterval(timerInterval);
                return;
            }
            const remaining = Math.round((endTime - Date.now()) / 1000);
            if (remaining < 0) { // Use < 0 to avoid showing 00:00 for a second
                clearInterval(timerInterval);
                // No need to set text to 00:00, polling will change state
            } else {
                const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
                const seconds = (remaining % 60).toString().padStart(2, '0');
                timerDisplay.textContent = `${minutes}:${seconds}`;
            }
        };
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    };

    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollLobbyState();
        pollInterval = setInterval(pollLobbyState, 2000);
    };

    const pollLobbyState = async () => {
        if (!lobbyId) return;
        try {
            const response = await fetch(`/api/lobby/${lobbyId}`);
            if (!response.ok) {
                handleGoBack();
                return;
            }
            const data = await response.json();
            if (data.success) {
                data.lobbyId = lobbyId;
                render(data);
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    };

    const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        if (timerInterval) clearInterval(timerInterval);
        pollInterval = null;
        timerInterval = null;
        lobbyId = null;
        container.innerHTML = '';
    };

    const init = (gameContainer, backCallback) => {
        container = gameContainer;
        goBackCallback = backCallback;
        render({
            lobby: {
                gameState: 'setup',
                players: [],
                settings: { imposterCount: 1, timer: 60 }
            },
            isHost: false,
            lobbyId: null
        });
    };

    return { init, cleanup };
})();
