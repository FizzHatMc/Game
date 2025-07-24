// public/js/main.js

window.i18n = {
    translations: {},
    currentLang: 'en',
    t: function(key, replacements = {}) {
        const lang = this.translations[this.currentLang];
        if (!lang) return key;
        let text = key.split('.').reduce((obj, i) => obj && obj[i], lang) || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    },
    init: async function() {
        this.currentLang = localStorage.getItem('language') || 'en';
        try {
            const response = await fetch('/js/translations.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.translations = await response.json();
        } catch (error) {
            console.error("Could not load translations:", error);
        }
    }
};

async function App() {
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
    // NEW: Centralized join elements
    const joinLobbyInput = document.getElementById('join-lobby-input');
    const joinLobbyBtn = document.getElementById('join-lobby-btn');
    const joinLobbyMessage = document.getElementById('join-lobby-message');

    const games = [
        { id: 'spin-the-bottle', nameKey: 'spinTheBottle.title', descKey: 'spinTheBottle.description' },
        { id: 'imposter', nameKey: 'imposter.title', descKey: 'imposter.description' }
    ];

    const applyTranslations = () => { /* ... unchanged ... */ };
    const handleLanguageChange = () => { /* ... unchanged ... */ };
    const applyTheme = (isDarkMode) => { /* ... unchanged ... */ };
    const toggleTheme = () => applyTheme(!document.body.classList.contains('light-mode'));
    
    const checkForJoinLink = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#join=')) {
            sessionStorage.setItem('lobbyToJoin', hash.substring(6));
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
    };

    // FIX: Renamed and repurposed to handle all session restoration
    const restoreSession = async () => {
        const activeLobby = sessionStorage.getItem('activeLobbyId') || sessionStorage.getItem('lobbyToJoin');
        if (localStorage.getItem('username_set')) {
            if (activeLobby) {
                await joinLobby(activeLobby, true);
                sessionStorage.removeItem('lobbyToJoin'); // Clean up join link
            } else {
                showGameSelection();
            }
        } else {
            showUsernameSetup();
        }
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
                await restoreSession(); // After setting name, try to join/restore
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

    // NEW: Centralized function to join any lobby by its code
    const joinLobby = async (lobbyId, isAutoJoin = false) => {
        try {
            const res = await fetch(`/api/lobby/${lobbyId}`);
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem('activeLobbyId', lobbyId);
                loadGame(data.lobby.game, lobbyId);
            } else {
                if (!isAutoJoin) joinLobbyMessage.textContent = i18n.t('lobbyNotFound');
            }
        } catch (error) {
            console.error("Failed to join lobby:", error);
            if (!isAutoJoin) joinLobbyMessage.textContent = 'An error occurred.';
        }
    };

    // --- Initial Setup ---
    checkForJoinLink();
    
    langSwitcher.value = i18n.currentLang;
    applyTranslations();
    
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme === 'dark');
    
    await restoreSession();

    // --- Event Listeners ---
    themeToggle.addEventListener('change', toggleTheme);
    langSwitcher.addEventListener('change', handleLanguageChange);
    setUsernameBtn.addEventListener('click', handleSetUsername);
    usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSetUsername(); });
    joinLobbyBtn.addEventListener('click', () => joinLobby(joinLobbyInput.value.trim()));
}

document.addEventListener('DOMContentLoaded', async () => {
    await window.i18n.init();
    App();
});
