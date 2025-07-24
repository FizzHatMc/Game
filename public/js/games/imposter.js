// public/js/games/imposter.js

window.Imposter = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let timerInterval = null;
    let categories = [];

    const t = window.i18n.t.bind(window.i18n);

    const render = (state) => {
        if (!container) return;a
        let content = '';
        if (state.lobbyId && state.lobby) {
            switch (state.lobby.gameState) {
                case 'setup': content = renderSetup(state); break;
                case 'discussion': content = renderDiscussion(state); break;
                case 'voting': content = renderVoting(state); break;
                case 'ended': content = renderEnded(state); break;
                default: content = `<p>An error has occurred (Unknown game state: ${state.lobby.gameState}).</p>`;
            }
        } else {
            content = renderLobbyJoin();
        }
        
        const html = `
            <div class="card">
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <button id="back-to-selection" class="secondary">${t('backToGames')}</button>
                    ${state.lobbyId ? `<button id="leave-lobby-btn" class="secondary" style="border-color: #e74c3c; color: #e74c3c;">${t('leaveLobby')}</button>` : ''}
                </div>
                <h2>${t('imposter.title')}</h2>
                ${content}
            </div>
        `;
        container.innerHTML = html;
        addEventListeners(state);

        if (state.lobbyId && state.lobby && state.lobby.gameState === 'discussion') {
            startTimer(state.lobby.timerEndsAt);
        }
        if (state.lobbyId && state.lobby && state.lobby.gameState === 'setup') {
            new QRCode(document.getElementById("qrcode"), {
                text: `${window.location.origin}#join=${state.lobbyId}`,
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
    `;

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
                <div id="qrcode" class="qr-code"></div>
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
                           <span>${maxImposterPercentage}%</span>
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

    const renderDiscussion = (state) => {
        const { lobby, isHost } = state;
        const me = lobby.players.find(p => p.name === document.cookie.replace(/(?:(?:^|.*;\s*)username\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
        if (!me) return `<p>Error: Could not find your player data.</p>`;

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

    const renderVoting = (state) => {
        const { lobby } = state;
        const username = document.cookie.replace(/(?:(?:^|.*;\s*)username\s*\=\s*([^;]*).*$)|^.*$/, "$1");
        const votesCast = (lobby.votes && lobby.votes[username]) ? lobby.votes[username].length : 0;
        const totalVotesAllowed = lobby.settings.imposterCount;

        let votingHeader = `<h3>${t('imposter.voteRound')}</h3>`;
        if (lobby.currentRound > 1) {
             votingHeader += `<p>${t('imposter.moreImposters')}</p>`;
        }
        
        const votingButtons = lobby.players
            .map(p => `<button class="vote-btn" data-player-name="${p.name}">${p.name}</button>`)
            .join('');

        if (votesCast >= totalVotesAllowed) {
            return `
                <h3>${t('imposter.castYourVote')}</h3>
                <p>${t('imposter.waitingForVotes')}</p>
            `;
        }

        return `
            ${votingHeader}
            <p>${t('imposter.castYourVote')} (${votesCast + 1} / ${totalVotesAllowed})</p>
            <div class="vote-buttons">
                ${votingButtons}
            </div>
        `;
    };

    const renderEnded = (state) => {
        const { lobby, isHost } = state;
        const voteEntries = Object.entries(lobby.voteResults || {}).map(([player, count]) => `<li>${player}: ${count} ${t('imposter.votes')}</li>`).join('');
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
        const backBtn = document.getElementById('back-to-selection');
        if (backBtn) backBtn.addEventListener('click', handleGoBack);

        if (state.lobbyId) {
            const leaveBtn = document.getElementById('leave-lobby-btn');
            if (leaveBtn) leaveBtn.addEventListener('click', handleLeaveLobby);
        }

        if (!state.lobbyId) {
            const createLobbyBtn = document.getElementById('create-lobby-btn');
            if (createLobbyBtn) createLobbyBtn.addEventListener('click', handleCreateLobby);
            return;
        }

        if (state.lobby.gameState === 'setup' && state.isHost) {
            document.querySelectorAll('.setting-item input, .setting-item select, .category-checkbox').forEach(el => el.addEventListener('change', handleSettingsChange));
            document.getElementById('imposter-max-percentage')?.addEventListener('input', handleSettingsChange);
            document.getElementById('start-game-btn')?.addEventListener('click', handleStartGame);
        } else if (state.lobby.gameState === 'voting') {
             document.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', handleVote));
        } else if (state.lobby.gameState === 'ended' && state.isHost) {
             document.getElementById('restart-game-btn')?.addEventListener('click', handleRestartGame);
        }
    };

    const handleGoBack = () => { if (lobbyId) handleLeaveLobby(); else cleanup(); if (goBackCallback) goBackCallback(); };
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
        } else {
             if (messageEl) messageEl.textContent = '';
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
        container.innerHTML = '';
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
