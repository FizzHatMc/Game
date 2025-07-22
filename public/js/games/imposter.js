// public/js/games/imposter.js

window.Imposter = (() => {
    let container;
    let goBackCallback;
    let lobbyId = null;
    let pollInterval = null;
    let timerInterval = null;
    let categories = [];

    const t = window.i18n.t.bind(window.i18n);

    const render = (state) => { /* ... unchanged ... */ };
    const renderLobbyJoin = () => { /* ... unchanged ... */ };
    const renderSetup = (state) => { /* ... unchanged ... */ };
    const renderDiscussion = (state) => { /* ... unchanged ... */ };

    // REVAMPED: Voting UI for multiple rounds
    const renderVoting = (state) => {
        const round = state.lobby.votingRound;
        const totalRounds = state.lobby.actualImposterCount;
        const hasVotedThisRound = state.lobby.playerVotes && state.lobby.playerVotes[state.username];

        let roundTitle = t('imposter.voteRound', { round, totalRounds });
        if (round > 1 && !hasVotedThisRound) {
            roundTitle = t('imposter.moreImposters') + "<br>" + roundTitle;
        }

        return `
            <h3>${roundTitle}</h3>
            <div class="player-vote-list">
                ${state.lobby.players.map(p => 
                    `<button class="vote-btn" data-vote-for="${p.name}" ${hasVotedThisRound ? 'disabled' : ''}>${p.name}</button>`
                ).join('')}
            </div>
            <p id="game-message" class="message">${hasVotedThisRound ? t('imposter.waitingForVotes') : t('imposter.castYourVote')}</p>
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
        // NEW: Event listener for the restart button
        document.getElementById('play-again-btn')?.addEventListener('click', handleRestartGame);

        if (state.isHost) { /* ... unchanged ... */ }
        if (state.lobbyId && state.lobby.gameState === 'setup' && document.getElementById('qrcode')) { /* ... unchanged ... */ }
    };

    const handleGoBack = () => { /* ... unchanged ... */ };
    const handleLeaveLobby = async () => { /* ... unchanged ... */ };
    const handleCreateLobby = async () => { /* ... unchanged ... */ };
    
    const handleJoinLobby = async (idToJoin) => {
        const lobbyInput = document.getElementById('join-lobby-input');
        const lobbyIdToJoin = idToJoin || lobbyInput.value.trim();
        if (!lobbyIdToJoin) return;
        
        const response = await fetch('/api/lobby/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId: lobbyIdToJoin }), });
        const data = await response.json();
        if (data.success) {
            lobbyId = data.lobbyId;
            startPolling();
        } else {
            if (lobbyInput) document.getElementById('lobby-message').textContent = data.message;
        }
    };

    const handleSettingsChange = async () => { /* ... unchanged ... */ };
    const handleStartGame = async () => { /* ... unchanged ... */ };
    
    // REVAMPED: Voting logic for single vote per round
    const handleVote = async (e) => {
        const voteFor = e.target.dataset.voteFor;
        // Disable all buttons to prevent multiple votes
        document.querySelectorAll('.vote-btn').forEach(btn => btn.disabled = true);
        
        await fetch('/api/game/imposter/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId, voteFor }),
        });
    };

    // NEW: Function to handle restarting the game
    const handleRestartGame = async () => {
        await fetch('/api/game/imposter/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lobbyId }),
        });
        // The next poll will automatically show the setup screen
    };
    
    const startTimer = (endTime) => { /* ... unchanged ... */ };
    const pollLobbyState = async () => { /* ... unchanged ... */ };
    const cleanup = () => { /* ... unchanged ... */ };
    const fetchCategories = async () => { /* ... unchanged ... */ };
    const startPolling = () => { /* ... unchanged ... */ };

    const init = async (gameContainer, backCallback, lobbyToJoin = null) => {
        container = gameContainer;
        goBackCallback = backCallback;
        await fetchCategories();
        
        if (lobbyToJoin) {
            handleJoinLobby(lobbyToJoin);
        } else {
            render({
                lobby: { gameState: 'setup', players: [], settings: { imposterCount: 1, imposterCountMode: 'fixed', maxImposterPercentage: 50, timer: 60, useSameImposterWord: true, selectedCategories: [] } },
                isHost: false,
                lobbyId: null
            });
        }
    };

    return { init, cleanup };
})();
