// public/js/main.js

window.i18n = { /* ... unchanged ... */ };

document.addEventListener('DOMContentLoaded', async () => {
    let currentGame = null;
    const themeToggle = document.getElementById('theme-toggle');
    const langSwitcher = document.getElementById('language-switcher');
    const usernameSection = document.getElementById('username-section');
    const usernameInput = document.getElementById('username-input');
    const setUsernameBtn = document.getElementById('set-username-btn');
    const usernameMessage = document.getElementById('username-message');
    const gameSelectionSection = document.getElementById('game-selection');
    const gameListContainer = document.getElementById('game-list');
    const gameInterfaceSection = document.getElementById('game-interface');

    const games = [
        { id: 'spin-the-bottle', nameKey: 'spinTheBottle.title', descKey: 'spinTheBottle.description' },
        { id: 'imposter', nameKey: 'imposter.title', descKey: 'imposter.description' }
    ];

    const applyTranslations = () => { /* ... unchanged ... */ };
    const handleLanguageChange = () => { /* ... unchanged ... */ };
    const applyTheme = (isDarkMode) => { /* ... unchanged ... */ };
    const toggleTheme = () => applyTheme(!document.body.classList.contains('light-mode'));
    
    // NEW: Function to check for a lobby ID in the URL hash
    const checkForJoinLink = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#join=')) {
            const lobbyId = hash.substring(6);
            // Store it so we can use it after the user sets their name
            sessionStorage.setItem('lobbyToJoin', lobbyId);
            // Clean the URL for a better user experience
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
    };

    const checkLoginState = async () => {
        if (localStorage.getItem('username_set')) {
            await attemptAutoJoin();
        } else {
            showUsernameSetup();
        }
    };

    // NEW: Logic to automatically join a lobby after login
    const attemptAutoJoin = async () => {
        const lobbyToJoin = sessionStorage.getItem('lobbyToJoin');
        if (lobbyToJoin) {
            try {
                // We need to ask the server what game this lobby is for
                const res = await fetch(`/api/lobby/${lobbyToJoin}`);
                const data = await res.json();
                if (data.success) {
                    sessionStorage.removeItem('lobbyToJoin'); // Clear it after use
                    loadGame(data.lobby.game, lobbyToJoin);
                    return;
                }
            } catch (error) {
                console.error("Failed to auto-join lobby:", error);
            }
        }
        // If no auto-join is needed, just show the game selection
        showGameSelection();
    };

    const showUsernameSetup = () => { /* ... unchanged ... */ };
    const showGameSelection = () => { /* ... unchanged ... */ };
    const showGameInterface = () => { /* ... unchanged ... */ };

    const handleSetUsername = async () => {
        const username = usernameInput.value.trim();
        if (username.length < 3) {
            usernameMessage.textContent = i18n.t('usernameError');
            return;
        }
        try {
            const response = await fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }), });
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('username_set', 'true');
                // After setting name, try to auto-join
                await attemptAutoJoin();
            } else {
                usernameMessage.textContent = data.message;
            }
        } catch (error) {
            usernameMessage.textContent = 'An error occurred.';
        }
    };

    const populateGameList = () => { /* ... unchanged ... */ };

    const loadGame = (gameId, lobbyToJoin = null) => {
        if (currentGame && currentGame.cleanup) currentGame.cleanup();
        gameInterfaceSection.innerHTML = '';

        const script = document.createElement('script');
        script.src = `/js/games/${gameId}.js`;
        script.onload = () => {
            const gameObjectName = gameId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('').replace('-', '');
            if (window[gameObjectName] && typeof window[gameObjectName].init === 'function') {
                currentGame = window[gameObjectName];
                // Pass the lobby ID to the game's init function
                currentGame.init(gameInterfaceSection, showGameSelection, lobbyToJoin);
                showGameInterface();
            } else {
                gameInterfaceSection.innerHTML = `<p class="message error">Error loading game.</p>`;
                showGameSelection();
            }
        };
        script.onerror = () => {
            gameInterfaceSection.innerHTML = `<p class="message error">Could not load game files.</p>`;
        };
        document.body.appendChild(script);
    };

    // --- Initial Setup ---
    await window.i18n.init();
    checkForJoinLink();
    
    langSwitcher.value = i18n.currentLang;
    applyTranslations();
    
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme === 'dark');
    
    await checkLoginState();

    // --- Event Listeners ---
    themeToggle.addEventListener('change', toggleTheme);
    langSwitcher.addEventListener('change', handleLanguageChange);
    setUsernameBtn.addEventListener('click', handleSetUsername);
    usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSetUsername(); });
});
