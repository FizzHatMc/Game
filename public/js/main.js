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

function App() {
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

    const applyTranslations = () => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerHTML = i18n.t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = i18n.t(el.getAttribute('data-i18n-placeholder'));
        });
        document.title = i18n.t('siteTitle');
        if (!gameSelectionSection.classList.contains('hidden')) {
            populateGameList();
        }
    };
    
    const handleLanguageChange = () => {
        i18n.currentLang = langSwitcher.value;
        localStorage.setItem('language', i18n.currentLang);
        applyTranslations();
        if (currentGame && currentGame.refresh) {
            currentGame.refresh();
        }
    };

    const applyTheme = (isDarkMode) => {
        document.body.classList.toggle('light-mode', !isDarkMode);
        document.body.classList.toggle('dark-mode', isDarkMode);
        themeToggle.checked = !isDarkMode;
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    };
    const toggleTheme = () => applyTheme(!document.body.classList.contains('light-mode'));
    
    const checkForJoinLink = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#join=')) {
            sessionStorage.setItem('lobbyToJoin', hash.substring(6));
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
    };

    const restoreSession = async () => {
        const activeLobby = sessionStorage.getItem('activeLobbyId');
        const lobbyToJoin = sessionStorage.getItem('lobbyToJoin');

        if (localStorage.getItem('username_set')) {
            if (activeLobby) {
                // If we were already in a lobby, try to rejoin it.
                await joinLobby(activeLobby, true);
            } else if (lobbyToJoin) {
                // If we clicked a link, join that lobby.
                await joinLobby(lobbyToJoin);
                sessionStorage.removeItem('lobbyToJoin');
            } else {
                // Otherwise, show the game selection screen.
                showGameSelection();
            }
        } else {
            showUsernameSetup();
        }
    };

    const showUsernameSetup = () => {
        usernameSection.classList.remove('hidden');
        gameSelectionSection.classList.add('hidden');
        gameInterfaceSection.classList.add('hidden');
    };

    const showGameSelection = () => {
        usernameSection.classList.add('hidden');
        gameSelectionSection.classList.remove('hidden');
        gameInterfaceSection.classList.add('hidden');
        populateGameList();
        
        const showJoinFormBtn = document.getElementById('show-join-form-btn');
        const joinFormContainer = document.getElementById('join-form-container');
        const joinLobbyInput = document.getElementById('join-lobby-input');
        const joinLobbyBtn = document.getElementById('join-lobby-btn');
        
        if (showJoinFormBtn) {
            showJoinFormBtn.addEventListener('click', () => {
                joinFormContainer.classList.toggle('hidden');
            });
        }

        if(joinLobbyBtn) {
            joinLobbyBtn.addEventListener('click', () => joinLobby(joinLobbyInput.value.trim()));
        }
    };
    
    const showGameInterface = () => {
        usernameSection.classList.add('hidden');
        gameSelectionSection.classList.add('hidden');
        gameInterfaceSection.classList.remove('hidden');
    };

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
                await restoreSession();
            } else {
                usernameMessage.textContent = data.message;
            }
        } catch (error) {
            usernameMessage.textContent = 'An error occurred.';
        }
    };

    const populateGameList = () => {
        if (!gameListContainer) return;
        gameListContainer.innerHTML = '';
        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'card game-card';
            card.dataset.gameId = game.id;
            card.innerHTML = `
                <h3>${i18n.t(game.nameKey)}</h3>
                <p>${i18n.t(game.descKey)}</p>
            `;
            card.addEventListener('click', () => loadGame(game.id));
            gameListContainer.appendChild(card);
        });
    };

    const loadGame = (gameId, lobbyToJoin = null) => {
        if (currentGame && currentGame.cleanup) currentGame.cleanup();
        gameInterfaceSection.innerHTML = '';

        const script = document.createElement('script');
        script.src = `/js/games/${gameId}.js`;
        script.onload = () => {
            const gameObjectName = gameId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
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

    const joinLobby = async (lobbyId, isRestoring = false) => {
        const joinLobbyMessage = document.getElementById('join-lobby-message');
        if (!lobbyId) return;
        
        try {
            // FIX: Always send a POST request to the /join endpoint to ensure the player is added.
            const joinRes = await fetch('/api/lobby/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lobbyId })
            });

            const joinData = await joinRes.json();

            if (joinData.success) {
                // After successfully joining, fetch the game type to load the correct game.
                const lobbyInfoRes = await fetch(`/api/lobby/${lobbyId}`);
                const lobbyInfoData = await lobbyInfoRes.json();

                if (lobbyInfoData.success) {
                    sessionStorage.setItem('activeLobbyId', lobbyId);
                    loadGame(lobbyInfoData.lobby.game, lobbyId);
                } else {
                     if (joinLobbyMessage) joinLobbyMessage.textContent = lobbyInfoData.message || i18n.t('lobbyNotFound');
                }
            } else {
                 if (joinLobbyMessage) joinLobbyMessage.textContent = joinData.message || i18n.t('lobbyNotFound');
                 if (isRestoring) {
                     // If restoring a session to a now-dead lobby, clear it and go to game selection.
                     sessionStorage.removeItem('activeLobbyId');
                     showGameSelection();
                 }
            }
        } catch (error) {
            console.error("Failed to join lobby:", error);
            if (joinLobbyMessage) joinLobbyMessage.textContent = 'An error occurred.';
        }
    };

    const initialize = async () => {
        await i18n.init();
        
        // Initial setup calls
        checkForJoinLink();
        langSwitcher.value = i18n.currentLang;
        applyTranslations();
        
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme === 'dark');
        
        await restoreSession();

        // Top-level event listeners
        themeToggle.addEventListener('change', toggleTheme);
        langSwitcher.addEventListener('change', handleLanguageChange);
        if(setUsernameBtn) {
            setUsernameBtn.addEventListener('click', handleSetUsername);
            usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSetUsername(); });
        }
    };

    initialize();
}

document.addEventListener('DOMContentLoaded', App);
