// public/js/games/spin-the-bottle.js

window.SpinTheBottle = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let lastRenderedState = {}; // Cache the last state

    // Use the global getTranslation function
    const t = window.i18n.t.bind(window.i18n);

    const render = (state) => {
        if (!container) return;
        lastRenderedState = state; // Update cache

        const html = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <button id="back-to-selection" class="secondary">${t('backToGames')}</button>
                    ${state.lobbyId ? `<button id="leave-lobby-btn" class="secondary" style="border-color: #e74c3c; color: #e74c3c;">${t('leaveLobby')}</button>` : ''}
                </div>
                <h2>${t('spinTheBottle.title')}</h2>
                ${!state.lobbyId ? renderLobbyJoin() : renderLobby(state)}
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

    const renderLobbyJoin = () => `
        <p>${t('createOrJoin')}</p>
        <div class="input-group">
            <button id="create-lobby-btn">${t('createLobby')}</button>
        </div>
        <hr style="margin: 20px 0;">
        <div class="input-group">
            <input type="text" id="join-lobby-input" placeholder="${t('enterLobbyCode')}">
            <button id="join-lobby-btn">${t('joinLobby')}</button>
        </div>
        <p id="lobby-message" class="message"></p>
    `;

    const renderLobby = (state) => `
        <p>${t('spinTheBottle.lobbyCode')}: <strong style="font-size: 1.2em; letter-spacing: 2px;">${state.lobbyId}</strong></p>
        <div style="text-align: center;">
            <p>${t('spinTheBottle.shareWithFriends')}</p>
            <div id="qrcode"></div>
        </div>
        <hr style="margin: 20px 0;">
        <p><strong>${t('spinTheBottle.players')}:</strong></p>
        <ul class="player-list">
            ${state.players.map(p => `<li class="player-tag">${p.name} ${p.name === state.host ? `👑 ${t('spinTheBottle.host')}` : ''}</li>`).join('')}
        </ul>
        <div class="game-result" id="game-result-display">
            ${state.lastResult || t('spinTheBottle.waitingForHost')}
        </div>
        <div class="input-group">
            <button id="spin-btn" ${state.isHost ? '' : 'disabled'}>${t('spinTheBottle.spinTheBottle')}</button>
        </div>
        <p id="game-message" class="message"></p>
        ${!state.isHost ? `<p>${t('spinTheBottle.onlyHostSpins')}</p>` : ''}
    `;

    const addEventListeners = () => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('join-lobby-btn')?.addEventListener('click', handleJoinLobby);
        document.getElementById('spin-btn')?.addEventListener('click', handleSpin);
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
        if(goBackCallback) goBackCallback();
    };

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
            lobbyMsg.textContent = t('enterLobbyCode');
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
            if (!response.ok) {
                cleanup();
                const card = document.querySelector('#game-interface .card');
                if(card) card.innerHTML = `<p class="message error">${t('lobbyNotFound')}</p><button id="back-to-selection" class="secondary">${t('backToGames')}</button>`;
                document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
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
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
        lobbyId = null;
        container.innerHTML = '';
    };

    const init = (gameContainer, backCallback) => {
        container = gameContainer;
        goBackCallback = backCallback;
        render({ lobbyId: null });
    };

    // NEW: Function to re-render the component with the current language.
    const refresh = () => {
        if(lastRenderedState) render(lastRenderedState);
    }

    return { init, cleanup, refresh };
})();
