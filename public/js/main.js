// public/js/main.js

// Define the global i18n object. This will be accessible by all game scripts.
window.i18n = {
    translations: {},
    currentLang: 'en',
    
    // The main translation function.
    t: function(key, replacements = {}) {
        const lang = this.translations[this.currentLang];
        if (!lang) return key; // Fallback to key if language not found
        let text = key.split('.').reduce((obj, i) => obj && obj[i], lang) || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    },

    // Fetches the translation file and sets the current language.
    init: async function() {
        this.currentLang = localStorage.getItem('language') || 'en';
        try {
            const response = await fetch('/js/translation.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error("Could not load translations:", error);
        }
    }
};

// This is the main application logic. It will only run after the DOM is ready.
async function App() {
    // --- State ---
    let currentGame = null;

    // --- DOM Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const langSwitcher = document.getElementById('language-switcher');
    const usernameSection = document.getElementById('username-section');
    const usernameInput = document.getElementById('username-input');
    const setUsernameBtn = document.getElementById('set-username-btn');
    const usernameMessage = document.getElementById('username-message');
    const gameSelectionSection = document.getElementById('game-selection');
    const gameListContainer = document.getElementById('game-list');
    const gameInterfaceSection = document.getElementById('game-interface');

    // --- Game Definitions ---
    const games = [
        { id: 'spin-the-bottle', nameKey: 'spinTheBottle.title', descKey: 'spinTheBottle.description' },
        { id: 'imposter', nameKey: 'imposter.title', descKey: 'imposter.description' }
    ];

    // --- I18n Functions ---
    const applyTranslations = () => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerHTML = i18n.t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = i18n.t(el.getAttribute('data-i18n-placeholder'));
        });
        document.title = i18n.t('siteTitle');
        populateGameList();
    };

    const handleLanguageChange = () => {
        i18n.currentLang = langSwitcher.value;
        localStorage.setItem('language', i18n.currentLang);
        applyTranslations();
        if (currentGame && currentGame.refresh) {
            currentGame.refresh();
        }
    };

    // --- General Functions ---
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

    const checkLoginState = async () => {
        if (localStorage.getItem('username_set')) {
            await attemptAutoJoin();
        } else {
            showUsernameSetup();
        }
    };

    const attemptAutoJoin = async () => {
        const lobbyToJoin = sessionStorage.getItem('lobbyToJoin');
        if (lobbyToJoin) {
            try {
                const res = await fetch(`/api/lobby/${lobbyToJoin}`);
                const data = await res.json();
                if (data.success) {
                    sessionStorage.removeItem('lobbyToJoin');
                    loadGame(data.lobby.game, lobbyToJoin);
                    return;
                }
            } catch (error) {
                console.error("Failed to auto-join lobby:", error);
            }
        }
        showGameSelection();
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
            usernameMessage.className = 'message error';
            return;
        }
        try {
            const response = await fetch('/api/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }), });
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('username_set', 'true');
                await attemptAutoJoin();
            } else {
                usernameMessage.textContent = data.message;
            }
        } catch (error) {
            usernameMessage.textContent = 'An error occurred.';
        }
    };

    const populateGameList = () => {
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

    // --- Initial Setup ---
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
}

// FIX: This new structure ensures translations are loaded *before* the main app logic runs.
document.addEventListener('DOMContentLoaded', async () => {
    // First, initialize the translation system.
    await window.i18n.init();
    // Then, run the main application logic.
    App();
});
