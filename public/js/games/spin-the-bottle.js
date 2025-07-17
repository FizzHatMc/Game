// public/js/games/spin-the-bottle.js

window.SpinTheBottle = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;

    const render = (state) => {
        if (!container) return;

        const html = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <button id="back-to-selection" class="secondary">&larr; Back to Games</button>
                    ${state.lobbyId ? '<button id="leave-lobby-btn" class="secondary" style="border-color: #e74c3c; color: #e74c3c;">Leave Lobby</button>' : ''}
                </div>
                <h2>Spin the Bottle</h2>
                ${!state.lobbyId ? renderLobbyJoin(state.lobbyToJoin) : renderLobby(state)}
            </div>
        `;
        container.innerHTML = html;
        addEventListeners();

        if (state.lobbyId && document.getElementById('qrcode')) {
            document.getElementById('qrcode').innerHTML = "";
            new QRCode(document.getElementById('qrcode'), {
                text: window.location.origin + '#join=' + state.lobbyId,
                width: 128,
                height: 128,
            });
        }
    };

    const renderLobbyJoin = (lobbyToJoin = '') => `
        <p>Create a new lobby or enter a code to join one.</p>
        <div class="input-group">
            <button id="create-lobby-btn">Create New Lobby</button>
        </div>
        <hr style="margin: 20px 0; border-color: var(--border-color-dark);">
        <div class="input-group">
            <input type="text" id="join-lobby-input" placeholder="Enter Lobby Code" value="${lobbyToJoin}">
            <button id="join-lobby-btn">Join Lobby</button>
        </div>
        <p id="lobby-message" class="message"></p>
    `;

    const renderLobby = (state) => `
        <p>Lobby Code: <strong style="font-size: 1.2em; letter-spacing: 2px;">${state.lobbyId}</strong></p>
        <div style="text-align: center;">
            <p>Scan with your phone to join!</p>
            <div id="qrcode"></div>
        </div>
        <hr style="margin: 20px 0; border-color: var(--border-color-dark);">
        <p><strong>Players:</strong></p>
        <ul class="player-list">
            ${state.players.map(p => `<li class="player-tag">${p.name} ${p.name === state.host ? '👑 (Host)' : ''}</li>`).join('')}
        </ul>
        <div class="game-result" id="game-result-display">
            ${state.lastResult || 'Waiting for the host to spin...'}
        </div>
        <div class="input-group">
            <button id="spin-btn" ${state.isHost ? '' : 'disabled'}>Spin the Bottle</button>
        </div>
        <p id="game-message" class="message"></p>
        ${!state.isHost ? '<p>Only the host can start the game.</p>' : ''}
    `;

    const addEventListeners = () => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('join-lobby-btn')?.addEventListener('click', handleJoinLobby);
        document.getElementById('spin-btn')?.addEventListener('click', handleSpin);
    };

    const handleGoBack = () => {
        cleanup();
        if(goBackCallback) goBackCallback();
    };

    const handleLeaveLobby = async () => {
        await fetch('/api/lobby/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
        });
        handleGoBack();
    };

    // FIX: This now sends the correct gameType to the server.
    const handleCreateLobby = async () => {
        const response = await fetch('/api/lobby/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameType: 'spin-the-bottle' })
        });
        const data = await response.json();
        if (data.success) {
            lobbyId = data.lobbyId;
            startPolling();
        }
    };

    const handleJoinLobby = async () => {
        const lobbyInput = document.getElementById('join-lobby-input');
        const lobbyMsg = document.getElementById('lobby-message');
        const idToJoin = lobbyInput.value.trim();
        if (!idToJoin) {
            lobbyMsg.textContent = 'Please enter a lobby code.';
            lobbyMsg.className = 'message error';
            return;
        }

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
            lobbyMsg.textContent = data.message;
        }
    };

    const handleSpin = async () => {
        const gameMsg = document.getElementById('game-message');
        gameMsg.textContent = '';
        const response = await fetch('/api/game/spin-the-bottle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
        });
        const data = await response.json();
        if (!data.success) {
            gameMsg.textContent = data.message;
            gameMsg.className = 'message error';
        }
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
            if (response.status === 404) {
                cleanup();
                container.innerHTML = `
                    <div class="card">
                        <p class="message error">Lobby not found. The host may have left.</p>
                        <button id="back-to-selection" class="secondary">Back to Games</button>
                    </div>`;
                addEventListeners();
                return;
            }
            const data = await response.json();
            if (data.success) {
                render({
                    lobbyId: lobbyId,
                    players: data.lobby.players,
                    host: data.lobby.host,
                    isHost: data.isHost,
                    lastResult: data.lobby.lastResult
                });
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    };

    const cleanup = () => {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        lobbyId = null;
        container.innerHTML = '';
    };

    const init = (gameContainer, backCallback, lobbyToJoin = null) => {
        container = gameContainer;
        goBackCallback = backCallback;
        render({ lobbyId: null, lobbyToJoin: lobbyToJoin });

        if (lobbyToJoin) {
            handleJoinLobby();
        }
    };

    return {
        init,
        cleanup
    };
})();
