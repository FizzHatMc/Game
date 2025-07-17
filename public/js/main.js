// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const themeToggle = document.getElementById('theme-toggle');
    const usernameSection = document.getElementById('username-section');
    const usernameInput = document.getElementById('username-input');
    const setUsernameBtn = document.getElementById('set-username-btn');
    const usernameMessage = document.getElementById('username-message');
    const gameSelectionSection = document.getElementById('game-selection');
    const gameListContainer = document.getElementById('game-list');
    const gameInterfaceSection = document.getElementById('game-interface');

    // --- State ---
    let currentGame = null;

    // --- Game Definitions ---
    const games = [
        {
            id: 'spin-the-bottle',
            name: 'Spin the Bottle',
            description: 'A classic party game. The host spins to pick a player.',
        },
        {
            id: 'imposter',
            name: 'Imposter',
            description: 'Find the imposter who has a slightly different word.',
        }
    ];

    // --- Functions ---

    const applyTheme = (isDarkMode) => {
        if (isDarkMode) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            themeToggle.checked = false;
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            themeToggle.checked = true;
        }
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    };

    const toggleTheme = () => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        applyTheme(!isDarkMode);
    };

    const checkForJoinLink = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#join=')) {
            const lobbyId = hash.substring(6);
            sessionStorage.setItem('lobbyToJoin', lobbyId);
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
    };

    const checkLoginState = () => {
        if (localStorage.getItem('username_set')) {
            showGameSelection();
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

        const lobbyToJoin = sessionStorage.getItem('lobbyToJoin');
        if (lobbyToJoin) {
            sessionStorage.removeItem('lobbyToJoin');
            // We don't know which game it is, so we can't auto-join.
            // For now, we just show the selection. A more advanced implementation
            // could have the server tell us the game type for a given lobby ID.
            alert(`To join lobby ${lobbyToJoin}, please select the correct game.`);
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
            usernameMessage.textContent = 'Username must be at least 3 characters.';
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
                usernameMessage.textContent = data.message;
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
            console.error('Error setting username:', error);
        }
    };

    const populateGameList = () => {
        gameListContainer.innerHTML = '';
        games.forEach(game => {
            const card = document.createElement('div');
            card.className = 'card game-card';
            card.dataset.gameId = game.id;
            card.innerHTML = `
                <h3>${game.name}</h3>
                <p>${game.description}</p>
            `;
            card.addEventListener('click', () => loadGame(game.id));
            gameListContainer.appendChild(card);
        });
    };

    const loadGame = (gameId) => {
        if (currentGame && currentGame.cleanup) {
            currentGame.cleanup();
        }
        gameInterfaceSection.innerHTML = '';

        const script = document.createElement('script');
        script.src = `js/games/${gameId}.js`;
        script.onload = () => {
            const gameObjectName = gameId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('').replace('-', '');
            if (window[gameObjectName] && typeof window[gameObjectName].init === 'function') {
                currentGame = window[gameObjectName];
                currentGame.init(gameInterfaceSection, showGameSelection);
                showGameInterface();
            } else {
                console.error(`Failed to initialize game: ${gameId}. 'init' function not found on window.${gameObjectName}`);
                gameInterfaceSection.innerHTML = `<p class="message error">Error loading game. Please try again.</p>`;
                showGameSelection();
            }
        };
        script.onerror = () => {
            console.error(`Failed to load script for game: ${gameId}`);
            gameInterfaceSection.innerHTML = `<p class="message error">Could not load game files.</p>`;
        };
        document.body.appendChild(script);
    };


    // --- Event Listeners ---
    themeToggle.addEventListener('change', toggleTheme);
    setUsernameBtn.addEventListener('click', handleSetUsername);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSetUsername();
        }
    });

    // --- Initial Setup ---
    checkForJoinLink();
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme === 'dark');
    checkLoginState();
});
