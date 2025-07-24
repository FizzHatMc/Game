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
        if (!container) return;
        let content = '';
        switch (state.lobby.gameState) {
            case 'setup': content = renderSetup(state); break;
            case 'discussion': content = renderDiscussion(state); break;
            case 'voting': content = renderVoting(state); break;
            case 'ended': content = renderEnded(state); break;
            default: content = `<p>An error has occurred.</p>`;
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
        if (state.lobby.gameState === 'discussion') startTimer(state.lobby.timerEndsAt);
    };
    
    const renderLobbyJoin = () => `
        <p>${t('createOrJoin')}</p>
        <div class="input-group">
            <button id="create-lobby-btn">${t('createLobby')}</button>
        </div>
    `;

    const renderSetup = (state) => { /* ... unchanged ... */ };
    const renderDiscussion = (state) => { /* ... unchanged ... */ };
    const renderVoting = (state) => { /* ... unchanged ... */ };
    const renderEnded = (state) => { /* ... unchanged ... */ };
    const addEventListeners = (state) => { /* ... unchanged ... */ };

    const handleGoBack = () => { if (lobbyId) handleLeaveLobby(); else cleanup(); if (goBackCallback) goBackCallback(); };
    const handleLeaveLobby = async () => { sessionStorage.removeItem('activeLobbyId'); await fetch('/api/lobby/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lobbyId }), }); cleanup(); if (goBackCallback) goBackCallback(); };
    const handleCreateLobby = async () => { const response = await fetch('/api/lobby/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameType: 'imposter' }) }); const data = await response.json(); if (data.success) { lobbyId = data.lobbyId; sessionStorage.setItem('activeLobbyId', lobbyId); startPolling(); } };
    const handleSettingsChange = async () => { /* ... unchanged ... */ };
    const handleStartGame = async () => { /* ... unchanged ... */ };
    const handleVote = async (e) => { /* ... unchanged ... */ };
    const handleRestartGame = async () => { /* ... unchanged ... */ };
    const startTimer = (endTime) => { /* ... unchanged ... */ };
    const pollLobbyState = async () => { /* ... unchanged ... */ };
    const cleanup = () => { /* ... unchanged ... */ };
    const fetchCategories = async () => { /* ... unchanged ... */ };
    const startPolling = () => { if (pollInterval) clearInterval(pollInterval); pollLobbyState(); pollInterval = setInterval(pollLobbyState, 2000); };

    const init = async (gameContainer, backCallback, lobbyToJoin = null) => {
        container = gameContainer;
        goBackCallback = backCallback;
        await fetchCategories();
        
        if (lobbyToJoin) {
            lobbyId = lobbyToJoin;
            sessionStorage.setItem('activeLobbyId', lobbyId);
            startPolling();
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
