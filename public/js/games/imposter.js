// public/js/games/imposter.js

window.Imposter = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let timerInterval = null;
    let myVotes = [];
    let categories = []; // Cache for categories

    const t = window.i18n.t.bind(window.i18n);

    const render = (state) => {
        if (!container) return;

        let content = '';
        switch (state.lobby.gameState) {
            case 'setup':
                myVotes = [];
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
                    <button id="back-to-selection" class="secondary">${t('backToGames')}</button>
                    ${state.lobbyId ? `<button id="leave-lobby-btn" class="secondary" style="border-color: #e74c3c; color: #e74c3c;">${t('leaveLobby')}</button>` : ''}
                </div>
                <h2>${t('imposter.title')}</h2>
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

    const renderSetup = (state) => {
        const settings = state.lobby.settings;
        const isRandomMode = settings.imposterCountMode === 'random';

        return `
        <p>${t('spinTheBottle.lobbyCode')}: <strong style="font-size: 1.2em; letter-spacing: 2px;">${state.lobbyId}</strong></p>
        <div id="qrcode" style="background: white; padding: 16px; border-radius: 8px; margin: 20px auto; width: fit-content;"></div>
        <hr style="margin: 20px 0;">
        <p><strong>${t('spinTheBottle.players')}:</strong></p>
        <ul class="player-list">
            ${state.lobby.players.map(p => `<li class="player-tag">${p.name} ${p.name === state.lobby.host ? `👑 ${t('spinTheBottle.host')}` : ''}</li>`).join('')}
        </ul>
        <div class="imposter-settings">
            <h4>${t('imposter.gameSettings')}</h4>

            <!-- Categories -->
            <label>${t('imposter.categories')}:</label>
            <div id="category-list" class="category-list">
                ${categories.map(cat => `
                    <div class="category-item">
                        <input type="checkbox" id="cat-${cat.id}" value="${cat.id}" 
                               ${settings.selectedCategories.includes(cat.id) ? 'checked' : ''} 
                               ${!state.isHost ? 'disabled' : ''}>
                        <label for="cat-${cat.id}">${cat.name}</label>
                    </div>
                `).join('') || `<p>${t('imposter.noCategories')}</p>`}
            </div>

            <!-- Imposter Count -->
            <label for="imposter-count-mode">${t('imposter.imposterCount')}</label>
            <select id="imposter-count-mode" ${!state.isHost ? 'disabled' : ''}>
                <option value="fixed" ${!isRandomMode ? 'selected' : ''}>${t('imposter.fixed')}</option>
                <option value="random" ${isRandomMode ? 'selected' : ''}>${t('imposter.random')}</option>
            </select>

            <div id="imposter-fixed-settings" class="${isRandomMode ? 'hidden' : ''}">
                <input type="number" id="imposter-count" min="1" value="${settings.imposterCount}" ${!state.isHost ? 'disabled' : ''}>
            </div>
            <div id="imposter-random-settings" class="${!isRandomMode ? 'hidden' : ''}">
                <label for="max-imposter-percentage">${t('imposter.maxPercentage')}: ${settings.maxImposterPercentage}%</label>
                <input type="range" id="max-imposter-percentage" min="10" max="90" step="5" value="${settings.maxImposterPercentage}" ${!state.isHost ? 'disabled' : ''}>
            </div>

            <!-- Timer -->
            <label for="timer-duration">${t('imposter.timerDuration')}</label>
            <input type="number" id="timer-duration" min="30" step="15" value="${settings.timer}" ${!state.isHost ? 'disabled' : ''}>
            
            <div class="setting-toggle" style="display: flex; align-items: center; margin-top: 15px;">
                <label for="same-imposter-word" style="margin: 0 10px 0 0;">${t('imposter.sameWord')}</label>
                <input type="checkbox" id="same-imposter-word" ${settings.useSameImposterWord ? 'checked' : ''} ${!state.isHost ? 'disabled' : ''}>
            </div>
        </div>
        <button id="start-game-btn" ${!state.isHost ? 'disabled' : ''}>${t('imposter.startGame')}</button>
        <p id="game-message" class="message"></p>
        ${!state.isHost ? `<p>${t('imposter.waitingForHost')}</p>` : ''}
    `;
    }

    const renderDiscussion = (state) => `...`; // Unchanged
    const renderVoting = (state) => `...`; // Unchanged
    const renderEnded = (state) => `...`; // Unchanged

    const addEventListeners = (state) => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('join-lobby-btn')?.addEventListener('click', handleJoinLobby);
        document.getElementById('start-game-btn')?.addEventListener('click', handleStartGame);
        document.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', handleVote));
        document.getElementById('play-again-btn')?.addEventListener('click', handleCreateLobby);

        if (state.isHost) {
            document.getElementById('imposter-count-mode')?.addEventListener('change', handleSettingsChange);
            document.getElementById('imposter-count')?.addEventListener('input', handleSettingsChange);
            document.getElementById('max-imposter-percentage')?.addEventListener('input', handleSettingsChange);
            document.getElementById('timer-duration')?.addEventListener('input', handleSettingsChange);
            document.getElementById('same-imposter-word')?.addEventListener('change', handleSettingsChange);
            document.querySelectorAll('#category-list input[type="checkbox"]').forEach(box => box.addEventListener('change', handleSettingsChange));
        }

        if (state.lobbyId && state.lobby.gameState === 'setup' && document.getElementById('qrcode')) {
            document.getElementById('qrcode').innerHTML = "";
            new QRCode(document.getElementById('qrcode'), { text: `${window.location.origin}#join=${state.lobbyId}`, width: 128, height: 128 });
        }
    };

    const handleGoBack = () => { /* ... */ }; // Unchanged
    const handleLeaveLobby = async () => { /* ... */ }; // Unchanged
    const handleCreateLobby = async () => { /* ... */ }; // Unchanged
    const handleJoinLobby = async () => { /* ... */ }; // Unchanged

    const handleSettingsChange = async () => {
        const selectedCategories = Array.from(document.querySelectorAll('#category-list input:checked')).map(cb => parseInt(cb.value));
        const settings = {
            imposterCountMode: document.getElementById('imposter-count-mode').value,
            imposterCount: document.getElementById('imposter-count').value,
            maxImposterPercentage: document.getElementById('max-imposter-percentage').value,
            timer: document.getElementById('timer-duration').value,
            useSameImposterWord: document.getElementById('same-imposter-word').checked,
            selectedCategories: selectedCategories
        };
        await fetch('/api/game/imposter/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId, settings }),
        });
    };

    const handleStartGame = async () => {
        const gameMessage = document.getElementById('game-message');
        gameMessage.textContent = '';
        const settings = {
            imposterCountMode: document.getElementById('imposter-count-mode').value,
            imposterCount: document.getElementById('imposter-count').value,
            maxImposterPercentage: document.getElementById('max-imposter-percentage').value,
            timer: document.getElementById('timer-duration').value,
            useSameImposterWord: document.getElementById('same-imposter-word').checked,
            selectedCategories: Array.from(document.querySelectorAll('#category-list input:checked')).map(cb => parseInt(cb.value))
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

    const handleVote = async (e) => { /* ... */ }; // Unchanged
    const startTimer = (endTime) => { /* ... */ }; // Unchanged

    const pollLobbyState = async () => { /* ... */ }; // Unchanged
    const cleanup = () => { /* ... */ }; // Unchanged

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/game/imposter/categories');
            const data = await response.json();
            if (data.success) {
                categories = data.categories;
            }
        } catch (error) {
            console.error("Could not fetch categories:", error);
        }
    };

    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollLobbyState();
        pollInterval = setInterval(pollLobbyState, 2000);
    };

    const init = async (gameContainer, backCallback) => {
        container = gameContainer;
        goBackCallback = backCallback;
        await fetchCategories(); // Fetch categories before the first render
        render({
            lobby: {
                gameState: 'setup',
                players: [],
                settings: {
                    imposterCount: 1,
                    imposterCountMode: 'fixed',
                    maxImposterPercentage: 50,
                    timer: 60,
                    useSameImposterWord: true,
                    selectedCategories: []
                }
            },
            isHost: false,
            lobbyId: null
        });
    };

    return { init, cleanup };
})();
