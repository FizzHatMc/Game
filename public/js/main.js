// public/js/main.js

// NEW: Define a global object to handle all translation logic.
// This makes it robust and accessible to all game scripts.
window.i18n = {
    translations: {},
    currentLang: 'en',
    // Fetches the translation file and sets the current language.
    init: async function() {
        this.currentLang = localStorage.getItem('language') || 'en';
        try {
            // FIX: Use an absolute path to be more robust.
            const response = await fetch('/js/translations.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error("Could not load translations:", error);
        }
    },
    // The main translation function.
    t: function(key, replacements = {}) {
        const lang = this.translations[this.currentLang];
        if (!lang) return key; // Fallback to key if language not found
        let text = key.split('.').reduce((obj, i) => obj && obj[i], lang) || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        return text;
    }
};


document.addEventListener('DOMContentLoaded', async () => {
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
        // FIX: Corrected typo in description key.
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
        populateGameList(); // Repopulate list with correct language
    };

    const handleLanguageChange = () => {
        i18n.currentLang = langSwitcher.value;
        localStorage.setItem('language', i18n.currentLang);
        applyTranslations();
        // If a game is active, re-render it with the new language
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

    const checkLoginState = () => {
        if (localStorage.getItem('username_set')) showGameSelection();
        else showUsernameSetup();
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
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const data = await response.json();

            if (data.success) {
                usernameMessage.textContent = i18n.t('usernameSuccess');
                usernameMessage.className = 'message success';
                localStorage.setItem('username_set', 'true');
                setTimeout(showGameSelection, 1000);
            } else {
                usernameMessage.textContent = data.message;
                usernameMessage.className = 'message error';
            }
        } catch (error) {
            usernameMessage.textContent = 'An error occurred. Please try again.';
            usernameMessage.className = 'message error';
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

    const loadGame = (gameId) => {
        if (currentGame && currentGame.cleanup) currentGame.cleanup();
        gameInterfaceSection.innerHTML = '';

        const script = document.createElement('script');
        script.src = `/js/games/${gameId}.js`;
        script.onload = () => {
            const gameObjectName = gameId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('').replace('-', '');
            if (window[gameObjectName] && typeof window[gameObjectName].init === 'function') {
                currentGame = window[gameObjectName];
                currentGame.init(gameInterfaceSection, showGameSelection);
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

    langSwitcher.value = i18n.currentLang;
    applyTranslations();

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme === 'dark');
    checkLoginState();

    // --- Event Listeners ---
    themeToggle.addEventListener('change', toggleTheme);
    langSwitcher.addEventListener('change', handleLanguageChange);
    setUsernameBtn.addEventListener('click', handleSetUsername);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSetUsername();
    });
});
