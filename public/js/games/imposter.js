// public/js/games/imposter.js

window.Imposter = (() => {
    // This self-contained module manages the state and UI for the Imposter game.
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let timerInterval = null;
    let categories = [];

    // A helper function to get translated text.
    const t = window.i18n.t.bind(window.i18n);

    // FIX: Create a reliable, centralized way to read the username cookie.
    const getUsername = () => {
        const cookies = document.cookie.split('; ');
        for (const cookie of cookies) {
            const [name, value] = cookie.split('=');
            if (name === 'username') {
                return decodeURIComponent(value);
            }
        }
        return null;
    };

    /**
     * The main render function. It decides which view to show based on the lobby's state.
     * @param {object} state - The current state of the game lobby.
     */
    const render = (state) => {
        if (!container) return; // Exit if the game container element isn't set.
        
        let content = '';
        if (state.lobbyId && state.lobby) {
            // If we are in a lobby, determine which game screen to show.
            switch (state.lobby.gameState) {
                case 'setup':
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
                    // Fallback for any unknown game state.
                    content = `<p>An error has occurred (Unknown game state: ${state.lobby.gameState}).</p>`;
            }
        } else {
            // If not in a lobby, show the initial screen to create one.
            content = renderLobbyJoin();
        }
        
        // Construct the final HTML for the game interface.
        const html = `
            <div class="card">
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <button id="back-to-selection" class="secondary">${t('backToGames')}</button>
                    ${state.lobbyId ? `<button id="leave-lobby-btn" class="secondary destructive">${t('leaveLobby')}</button>` : ''}
                </div>
                <h2>${t('imposter.title')}</h2>
                ${content}
            </div>
        `;
        container.innerHTML = html;
        
        // Attach all necessary event listeners to the new UI elements.
        addEventListeners(state);

        // Specific actions after rendering, like starting a timer or showing a QR code.
        if (state.lobbyId && state.lobby) {
            if (state.lobby.gameState === 'discussion') {
                startTimer(state.lobby.timerEndsAt);
            } else if (state.lobby.gameState === 'setup') {
                new QRCode(document.getElementById("qrcode"), {
                    text: `${window.location.origin}#join=${state.lobbyId}`,
                    width: 128,
                    height: 128,
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }
    };
    
    // Renders the initial screen for a player to create a new lobby.
    const renderLobbyJoin = () => `
        <p>${t('createOrJoin')}</p>
        <div class="input-group">
            <button id="create-lobby-btn">${t('createLobby')}</button>
        </div>
    `;

    // Renders the setup/lobby screen where the host configures the game.
    const renderSetup = (state) => {
        const { lobby, isHost } = state;
        const settings = lobby.settings || {};
        const playersList = lobby.players.map(p => `
            <li>
                ${p.name}
                ${p.name === lobby.host ? `<span class="host-tag">${t('spinTheBottle.host')}</span>` : ''}
            </li>
        `).join('');

        const categoriesList = categories.map(cat => `
            <label class="checkbox-label">
                <input type="checkbox" class="category-checkbox" value="${cat.id}" ${settings.selectedCategories && settings.selectedCategories.includes(cat.id) ? 'checked' : ''} ${!isHost ? 'disabled' : ''}>
                ${cat.name}
            </label>
        `).join('');

        const imposterCountMode = settings.imposterCountMode || 'fixed';
        const imposterCount = settings.imposterCount || 1;
        const maxImposterPercentage = settings.maxImposterPercentage || 50;
        const timer = settings.timer || 60;
        const useSameWord = settings.useSameImposterWord === undefined ? true : settings.useSameImposterWord;
        
        return `
            <div class="lobby-info">
                <p>${t('spinTheBottle.lobbyCode')}: <strong>${state.lobbyId}</strong></p>
                <div id="qrcode" class="qr-code" title="${t('qrCodeFullscreen')}"></div>
                <p class="small-text">${t('spinTheBottle.shareWithFriends')}</p>
            </div>
            <div class="imposter-setup-container">
                <div class="player-list-setup">
                    <h3>${t('spinTheBottle.players')}</h3>
                    <ul>${playersList}</ul>
                </div>
                <div class="game-settings">
                    <h3>${t('imposter.gameSettings')}</h3>
                    ${isHost ? '' : `<p>${t('imposter.waitingForHost')}</p>`}
                    
                    <div class="setting-item">
                        <label>${t('imposter.categories')}:</label>
                        <div class="category-list">${categories.length > 0 ? categoriesList : t('imposter.noCategories')}</div>
                    </div>

                    <div class="setting-item">
                        <label>${t('imposter.imposterCount')}</label>
                        <select id="imposter-count-mode" ${!isHost ? 'disabled' : ''}>
                            <option value="fixed" ${imposterCountMode === 'fixed' ? 'selected' : ''}>${t('imposter.fixed')}</option>
                            <option value="random" ${imposterCountMode === 'random' ? 'selected' : ''}>${t('imposter.random')}</option>
                        </select>
                        <input type="number" id="imposter-count-fixed" class="${imposterCountMode !== 'fixed' ? 'hidden' : ''}" value="${imposterCount}" min="1" ${!isHost ? 'disabled' : ''}>
                        <div id="imposter-random-container" class="${imposterCountMode !== 'random' ? 'hidden' : ''}">
                           <input type="range" id="imposter-max-percentage" min="10" max="90" value="${maxImposterPercentage}" ${!isHost ? 'disabled' : ''}>
                           <span id="percentage-display">${maxImposterPercentage}%</span>
                           <label class="small-text">${t('imposter.maxPercentage')}</label>
                        </div>
                    </div>

                    <div class="setting-item">
                        <label for="timer-duration">${t('imposter.timerDuration')}</label>
                        <input id="timer-duration" type="number" min="10" value="${timer}" ${!isHost ? 'disabled' : ''}>
                    </div>

                     <div class="setting-item">
                        <label for="same-imposter-word">${t('imposter.sameWord')}</label>
                        <input id="same-imposter-word" type="checkbox" ${useSameWord ? 'checked' : ''} ${!isHost ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
            ${isHost ? `<button id="start-game-btn">${t('imposter.startGame')}</button>` : ''}
            <p id="start-game-message" class="message error"></p>
        `;
    };

    // Renders the discussion phase screen, revealing roles and words.
    const renderDiscussion = (state) => {
        const { lobby } = state;
        const username = getUsername(); // Use the reliable function
        const me = lobby.players.find(p => p.name === username);

        if (!me || !me.role) {
            console.error("Could not find player data for user:", username, "in lobby:", lobby);
            return `<p>${t('errorPlayerNotFound')}</p>`;
        }

        return `
            <div class="role-reveal">
                <h3>${t('imposter.youAreA')} <span class="${me.role.toLowerCase()}">${t(`imposter.${me.role.toLowerCase()}`)}</span></h3>
                <p>${t('imposter.yourWordIs')} <strong>${me.word}</strong></p>
            </div>
            <hr>
            <div class="discussion-info">
                <p><strong>${lobby.startingPlayer}</strong> ${t('imposter.startsTheRound')}</p>
                <div id="timer-display">${t('imposter.timeRemaining')} --:--</div>
            </div>
        `;
    };

    // Renders the voting screen.
    const renderVoting = (state) => {
        const { lobby } = state;
        const username = getUsername();
        const myVotes = (lobby.votes && lobby.votes[username]) || [];

        if (myVotes.length >= lobby.currentRound) {
            return `
                <h3>${t('imposter.voteRound')} ${lobby.currentRound}</h3>
                <p>${t('imposter.waitingForVotes')}</p>
            `;
        }

        const votingHeader = `<h3>${t('imposter.voteRound')} ${lobby.currentRound}</h3>`;
        const subHeader = lobby.currentRound > 1 ? `<p>${t('imposter.moreImposters')}</p>` : '';
        
        const votingButtons = lobby.players
            .map(p => `<button class="vote-btn" data-player-name="${p.name}">${p.name}</button>`)
            .join('');
        
        return `
            ${votingHeader}
            ${subHeader}
            <p>${t('imposter.castYourVote')}</p>
            <div class="vote-buttons">
                ${votingButtons}
            </div>
        `;
    };

    // Renders the final game over screen with results.
    const renderEnded = (state) => {
        const { lobby, isHost } = state;
        const voteEntries = Object.entries(lobby.voteResults || {}).sort(([,a],[,b]) => b-a).map(([player, count]) => `<li>${player}: ${count} ${t('imposter.votes')}</li>`).join('');
        const roleEntries = lobby.players.map(p => `<li>${p.name} - ${t(`imposter.${p.role.toLowerCase()}`)} (${p.word})</li>`).join('');

        return `
            <h3>${t('imposter.gameOver')}</h3>
            <div class="results-container">
                <div class="vote-results">
                    <h4>${t('imposter.voteCounts')}</h4>
                    <ul>${voteEntries}</ul>
                </div>
                <div class="role-reveal-final">
                    <h4>${t('imposter.roleReveal')}</h4>
                    <ul>${roleEntries}</ul>
                </div>
            </div>
            ${isHost ? `<button id="restart-game-btn">${t('imposter.playAgain')}</button>` : ''}
        `;
    };
    
    const addEventListeners = (state) => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('qrcode')?.addEventListener('click', () => handleFullscreenQr(state.lobbyId));

        if (state.isHost && state.lobby?.gameState === 'setup') {
            document.getElementById('imposter-count-mode')?.addEventListener('change', handleSettingsChange);
            document.getElementById('imposter-count-fixed')?.addEventListener('change', handleSettingsChange);
            document.getElementById('imposter-max-percentage')?.addEventListener('input', (e) => {
                const display = document.getElementById('percentage-display');
                if(display) display.textContent = `${e.target.value}%`;
            });
            document.getElementById('imposter-max-percentage')?.addEventListener('change', handleSettingsChange);
            document.getElementById('timer-duration')?.addEventListener('change', handleSettingsChange);
            document.getElementById('same-imposter-word')?.addEventListener('change', handleSettingsChange);
            document.querySelectorAll('.category-checkbox').forEach(cb => cb.addEventListener('change', handleSettingsChange));
            document.getElementById('start-game-btn')?.addEventListener('click', handleStartGame);
        }
        
        if (state.lobby?.gameState === 'voting') {
             document.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', handleVote));
        }
        
        if (state.isHost && state.lobby?.gameState === 'ended') {
             document.getElementById('restart-game-btn')?.addEventListener('click', handleRestartGame);
        }
    };
    
    const handleFullscreenQr = (lobbyId) => {
        if (!lobbyId) return;
        const overlay = document.createElement('div');
        overlay.className = 'qr-fullscreen-overlay';
        overlay.innerHTML = `<div class="qr-code-large" id="qr-code-fullscreen"></div>`;
        document.body.appendChild(overlay);

        new QRCode(document.getElementById("qr-code-fullscreen"), {
            text: `${window.location.origin}#join=${lobbyId}`,
            width: 256,
            height: 256,
            correctLevel: QRCode.CorrectLevel.H
        });

        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    };

    const handleGoBack = () => { if (lobbyId) { handleLeaveLobby(); } else { cleanup(); if (goBackCallback) goBackCallback(); }};
    const handleLeaveLobby = async () => { sessionStorage.removeItem('activeLobbyId'); await fetch('/api/lobby/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId }), }); cleanup(); if (goBackCallback) goBackCallback(); };
    const handleCreateLobby = async () => { const response = await fetch('/api/lobby/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameType: 'imposter' }) }); const data = await response.json(); if (data.success) { lobbyId = data.lobbyId; sessionStorage.setItem('activeLobbyId', lobbyId); startPolling(); } };
    
    const handleSettingsChange = async () => {
        const settings = {
            imposterCountMode: document.getElementById('imposter-count-mode').value,
            imposterCount: parseInt(document.getElementById('imposter-count-fixed').value, 10),
            maxImposterPercentage: parseInt(document.getElementById('imposter-max-percentage').value, 10),
            timer: parseInt(document.getElementById('timer-duration').value, 10),
            useSameImposterWord: document.getElementById('same-imposter-word').checked,
            selectedCategories: Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => parseInt(cb.value, 10)),
        };
        await fetch('/api/game/imposter/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId, settings }) });
    };
    
    const handleStartGame = async () => {
        const messageEl = document.getElementById('start-game-message');
        if(messageEl) messageEl.textContent = '';
        
        const settings = {
            imposterCountMode: document.getElementById('imposter-count-mode').value,
            imposterCount: parseInt(document.getElementById('imposter-count-fixed').value, 10),
            maxImposterPercentage: parseInt(document.getElementById('imposter-max-percentage').value, 10),
            timer: parseInt(document.getElementById('timer-duration').value, 10),
            useSameImposterWord: document.getElementById('same-imposter-word').checked,
            selectedCategories: Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => parseInt(cb.value, 10)),
        };

        const res = await fetch('/api/game/imposter/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId, settings }) });
        if (!res.ok) {
            const error = await res.json();
            if (messageEl) messageEl.textContent = error.message || 'An error occurred.';
        }
    };
    
    const handleVote = async (e) => {
        const playerName = e.target.dataset.playerName;
        await fetch('/api/game/imposter/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId, voteFor: playerName }) });
    };
    
    const handleRestartGame = async () => {
        await fetch('/api/game/imposter/restart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId }) });
    };
    
    const startTimer = (endTime) => {
        if (timerInterval) clearInterval(timerInterval);
        const timerDisplay = document.getElementById('timer-display');
        
        const updateTimer = () => {
            const remaining = Math.max(0, endTime - Date.now());
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            if(timerDisplay) timerDisplay.textContent = `${t('imposter.timeRemaining')} ${minutes}:${seconds.toString().padStart(2, '0')}`;
            if (remaining <= 0) {
                clearInterval(timerInterval);
                if(timerDisplay) timerDisplay.textContent = t('imposter.timesUp');
            }
        };
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
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
        if (timerInterval) clearInterval(timerInterval);
        pollInterval = null;
        timerInterval = null;
        lobbyId = null;
        if(container) container.innerHTML = '';
    };
    
    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/game/imposter/categories');
            const data = await res.json();
            if (data.success) {
                categories = data.categories;
            }
        } catch(e) {
            console.error("Could not fetch categories", e);
        }
    };
    
    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollLobbyState();
        pollInterval = setInterval(pollLobbyState, 2000);
    };

    const init = async (gameContainer, backCallback, lobbyToJoin = null) => {
        container = gameContainer;
        goBackCallback = backCallback;
        await fetchCategories();
        
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
