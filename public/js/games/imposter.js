// public/js/games/imposter.js

window.Imposter = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let timerInterval = null;
    let myVotes = [];

    // FIX: Use the new global translation object and bind 'this' correctly.
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

    const renderSetup = (state) => `
        <p>${t('spinTheBottle.lobbyCode')}: <strong style="font-size: 1.2em; letter-spacing: 2px;">${state.lobbyId}</strong></p>
        <div id="qrcode" style="background: white; padding: 16px; border-radius: 8px; margin: 20px auto; width: fit-content;"></div>
        <hr style="margin: 20px 0;">
        <p><strong>${t('spinTheBottle.players')}:</strong></p>
        <ul class="player-list">
            ${state.lobby.players.map(p => `<li class="player-tag">${p.name} ${p.name === state.lobby.host ? `👑 ${t('spinTheBottle.host')}` : ''}</li>`).join('')}
        </ul>
        <div class="imposter-settings">
            <h4>${t('imposter.gameSettings')}</h4>
            <label for="imposter-count">${t('imposter.imposterCount')}</label>
            <input type="number" id="imposter-count" min="1" value="${state.lobby.settings.imposterCount}" ${!state.isHost ? 'disabled' : ''}>
            <label for="timer-duration">${t('imposter.timerDuration')}</label>
            <input type="number" id="timer-duration" min="30" step="15" value="${state.lobby.settings.timer}" ${!state.isHost ? 'disabled' : ''}>
            
            <div class="setting-toggle" style="display: flex; align-items: center; margin-top: 15px;">
                <label for="same-imposter-word" style="margin: 0 10px 0 0;">${t('imposter.sameWord')}</label>
                <input type="checkbox" id="same-imposter-word" ${state.lobby.settings.useSameImposterWord ? 'checked' : ''} ${!state.isHost ? 'disabled' : ''}>
            </div>
        </div>
        <button id="start-game-btn" ${!state.isHost ? 'disabled' : ''}>${t('imposter.startGame')}</button>
        <p id="game-message" class="message"></p>
        ${!state.isHost ? `<p>${t('imposter.waitingForHost')}</p>` : ''}
    `;

    const renderDiscussion = (state) => `
        <div class="imposter-reveal">
            <p>${t('imposter.youAreA')}</p>
            <h3 class="${state.lobby.me.role.toLowerCase()}">${t(`imposter.${state.lobby.me.role.toLowerCase()}`)}</h3>
            <p>${t('imposter.yourWordIs')}</p>
            <h4>${state.lobby.me.word}</h4>
        </div>
        <hr style="margin: 20px 0;">
        <div class="starting-player" style="text-align: center; margin-bottom: 20px;">
            <h3><strong>${state.lobby.startingPlayer}</strong> ${t('imposter.startsTheRound')}</h3>
        </div>
        <div class="imposter-timer">
            <p>${t('imposter.timeRemaining')}</p>
            <div id="timer-display">--:--</div>
        </div>
    `;

    const renderVoting = (state) => {
        const votesLeft = state.lobby.settings.imposterCount - myVotes.length;
        return `
            <h3>${t('imposter.timesUp')}</h3>
            <p>${t('imposter.votesLeft', { count: votesLeft })}</p>
            <div class="player-vote-list">
                ${state.lobby.players.map(p => {
            const hasVotedFor = myVotes.includes(p.name);
            const canVote = votesLeft > 0;
            return `<button class="vote-btn" data-vote-for="${p.name}" ${hasVotedFor || !canVote ? 'disabled' : ''}>${p.name} ${hasVotedFor ? '✓' : ''}</button>`
        }).join('')}
            </div>
            <p id="game-message" class="message">${votesLeft <= 0 ? t('imposter.waitingForVotes') : ''}</p>
        `;
    };

    const renderEnded = (state) => {
        const results = state.lobby.voteResults;
        let content = `<h4>${t('imposter.voteCounts')}</h4><ul>`;
        for (const player in results) {
            content += `<li><strong>${player}:</strong> ${results[player]} ${t('imposter.votes')}</li>`;
        }
        content += `</ul><hr style="margin-top: 20px;"><h4 style="margin-top: 20px;">${t('imposter.roleReveal')}</h4><ul>`;
        state.lobby.players.forEach(p => {
            content += `<li><strong>${p.name}</strong> ${t('imposter.wasA')} <span class="${p.role.toLowerCase()}">${t(`imposter.${p.role.toLowerCase()}`)}</span></li>`;
        });
        content += '</ul>';

        return `
            <h3>${t('imposter.gameOver')}</h3>
            ${content}
            <button id="play-again-btn" class="${state.isHost ? '' : 'hidden'}">${t('imposter.playAgain')}</button>
        `;
    };


    const addEventListeners = (state) => {
        document.getElementById('back-to-selection')?.addEventListener('click', handleGoBack);
        document.getElementById('leave-lobby-btn')?.addEventListener('click', handleLeaveLobby);
        document.getElementById('create-lobby-btn')?.addEventListener('click', handleCreateLobby);
        document.getElementById('join-lobby-btn')?.addEventListener('click', handleJoinLobby);
        document.getElementById('start-game-btn')?.addEventListener('click', handleStartGame);
        document.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', handleVote));
        document.getElementById('play-again-btn')?.addEventListener('click', handleCreateLobby);

        if (state.isHost) {
            document.getElementById('imposter-count')?.addEventListener('input', handleSettingsChange);
            document.getElementById('timer-duration')?.addEventListener('input', handleSettingsChange);
            document.getElementById('same-imposter-word')?.addEventListener('change', handleSettingsChange);
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
            useSameImposterWord: document.getElementById('same-imposter-word').checked,
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
            imposterCount: document.getElementById('imposter-count').value,
            timer: document.getElementById('timer-duration').value,
            useSameImposterWord: document.getElementById('same-imposter-word').checked,
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
            if (remaining < 0) {
                clearInterval(timerInterval);
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
                settings: { imposterCount: 1, timer: 60, useSameImposterWord: true }
            },
            isHost: false,
            lobbyId: null
        });
    };

    return { init, cleanup };
})();
