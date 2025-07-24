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
                    <div id="qrcode" class="qr-code"></div>
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
                    ${currentLobbyId ? `<button id="leave-lobby-btn" class="secondary" style="border-color: #e74c3c; color: #e74c3c;">${t('leaveLobby')}</button>` : ''}
                </div>
                <h2>${t('spinTheBottle.title')}</h2>
                ${content}
            </div>
        `;
        container.innerHTML = html;

        if (currentLobbyId) {
            new QRCode(document.getElementById("qrcode"), {
                text: `${window.location.origin}#join=${currentLobbyId}`,
                width: 128,
                height: 128,
            });
        }
        addEventListeners(state);
    };

    const addEventListeners = (state) => {
        const backBtn = document.getElementById('back-to-selection');
        if (backBtn) backBtn.addEventListener('click', handleGoBack);

        if (state.lobbyId) {
            const leaveBtn = document.getElementById('leave-lobby-btn');
            if (leaveBtn) leaveBtn.addEventListener('click', handleLeaveLobby);

            if (state.isHost) {
                const spinBtn = document.getElementById('spin-btn');
                if (spinBtn) spinBtn.addEventListener('click', handleSpin);
            }
        } else {
            const createLobbyBtn = document.getElementById('create-lobby-btn');
            if (createLobbyBtn) createLobbyBtn.addEventListener('click', handleCreateLobby);
        }
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
        container.innerHTML = '';
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
            sessionStorage.setItem('activeLobbyId', lobbyId);
            startPolling();
        } else {
            render({ lobby: null, isHost: false, lobbyId: null });
        }
    };

    const refresh = () => {
        pollLobbyState();
    };

    return { init, cleanup, refresh };
})();
