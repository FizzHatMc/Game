// public/js/games/spin-the-bottle.js

window.SpinTheBottle = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;

    const t = window.i18n.t.bind(window.i18n);

    const render = (state) => {
        if (!container) return;
        const { lobby, isHost, lobbyId: currentLobbyId } = state;

        let content = '';
        if (currentLobbyId && lobby) {
            const playersList = lobby.players.map(p => `
                <li>
                    ${p.name}
                    ${p.name === lobby.host ? `<span class="host-tag">${t('spinTheBottle.host')}</span>` : ''}
                </li>
            `).join('');

            content = `
                <div class="lobby-info">
                    <p>${t('spinTheBottle.lobbyCode')}: <strong>${currentLobbyId}</strong></p>
                    <div id="qrcode" class="qr-code" title="${t('qrCodeFullscreen')}"></div>
                    <p class="small-text">${t('spinTheBottle.shareWithFriends')}</p>
                </div>
                <div class="player-list">
                    <h3>${t('spinTheBottle.players')}</h3>
                    <ul>${playersList}</ul>
                </div>
                <div class="game-actions">
                    ${isHost ? `<button id="spin-btn">${t('spinTheBottle.spinTheBottle')}</button>` : `<p>${t('spinTheBottle.waitingForHost')}</p>`}
                    <p id="spin-result" class="message">${lobby.lastResult || ''}</p>
                </div>
            `;
        } else {
            content = `
                <p>${t('createOrJoin')}</p>
                <div class="input-group">
                    <button id="create-lobby-btn">${t('createLobby')}</button>
                </div>
            `;
        }

        const html = `
            <div class="card">
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <button id="back-to-selection" class="secondary">${t('backToGames')}</button>
                    ${currentLobbyId ? `<button id="leave-lobby-btn" class="secondary destructive">${t('leaveLobby')}</button>` : ''}
                </div>
                <h2>${t('spinTheBottle.title')}</h2>
                ${content}
            </div>
        `;
        container.innerHTML = html;

        if (currentLobbyId) {
            // Generate QR Code
            new QRCode(document.getElementById("qrcode"), {
                text: `${window.location.origin}#join=${currentLobbyId}`,
                width: 128,
                height: 128,
                correctLevel: QRCode.CorrectLevel.H // High error correction for better scanability
            });
        }
        addEventListeners(state);
    };

    const addEventListeners = (state) => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('spin-btn')?.addEventListener('click', handleSpin);

        // NEW: Add click listener for fullscreen QR code
        document.getElementById('qrcode')?.addEventListener('click', () => handleFullscreenQr(state.lobbyId));
    };

    const handleFullscreenQr = (lobbyId) => {
        if (!lobbyId) return;
        const overlay = document.createElement('div');
        overlay.className = 'qr-fullscreen-overlay';
        overlay.innerHTML = `<div class="qr-code-large" id="qr-code-fullscreen"></div>`;
        document.body.appendChild(overlay);

        // Generate a larger QR code for the overlay
        new QRCode(document.getElementById("qr-code-fullscreen"), {
            text: `${window.location.origin}#join=${lobbyId}`,
            width: 256,
            height: 256,
            correctLevel: QRCode.CorrectLevel.H
        });

        // Remove overlay when clicked
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    };

    const handleGoBack = () => {
        if (lobbyId) {
            handleLeaveLobby();
        } else {
            cleanup();
            if (goBackCallback) goBackCallback();
        }
    };

    const handleLeaveLobby = async () => {
        sessionStorage.removeItem('activeLobbyId');
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
            body: JSON.stringify({ gameType: 'spin-the-bottle' })
        });
        const data = await response.json();
        if (data.success) {
            lobbyId = data.lobbyId;
            sessionStorage.setItem('activeLobbyId', lobbyId);
            startPolling();
        }
    };

    const handleSpin = async () => {
        await fetch('/api/game/spin-the-bottle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId })
        });
        // The result will be updated on the next poll
    };

    const pollLobbyState = async () => {
        if (!lobbyId) return;
        try {
            const res = await fetch(`/api/lobby/${lobbyId}`);
            if (!res.ok) {
                console.error(`Lobby ${lobbyId} not found, cleaning up.`);
                cleanup();
                if (goBackCallback) goBackCallback();
                return;
            }
            const data = await res.json();
            if (data.success) {
                render({ ...data, lobbyId });
            }
        } catch (error) {
            console.error('Polling error:', error);
            cleanup();
        }
    };
    
    const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
        lobbyId = null;
        if(container) container.innerHTML = '';
    };

    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollLobbyState();
        pollInterval = setInterval(pollLobbyState, 2000);
    };

    const init = (gameContainer, backCallback, lobbyToJoin = null) => {
        container = gameContainer;
        goBackCallback = backCallback;
        
        if (lobbyToJoin) {
            lobbyId = lobbyToJoin;
            startPolling();
        } else {
            render({ lobby: null, isHost: false, lobbyId: null });
        }
    };

    const refresh = () => {
        if(lobbyId) pollLobbyState();
    };

    return { init, cleanup, refresh };
})();
