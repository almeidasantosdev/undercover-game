// Regras da partida, separadas do Socket.IO.
// index.js continua dono das salas, da conexão e do que é enviado aos clientes.

function createGame(roomId) {
    return {
        id: roomId,
        players: [],
        phase: 'LOBBY',
        wordPair: {},
        turnIndex: 0,
        winner: null,
        usedIndices: [],
        settings: {
            mrWhiteCount: 1,
            undercoverCount: 1
        },
        deleteTimer: null
    };
}

function createPlayer(id, playerName) {
    return {
        id: id,
        name: playerName,
        role: null,
        word: null,
        isAlive: true,
        votes: 0,
        score: 0,
        description: ""
    };
}

function applySettingChange(settings, setting, change) {
    let newValue = settings[setting] + change;
    if (newValue < 0) newValue = 0;
    settings[setting] = newValue;
    return settings;
}

function canStartGame(game) {
    if (!game) return false;
    return game.players.length >= 3 && game.phase === 'LOBBY';
}

function resolveImpostorCounts(totalPlayers, mrWhiteCount, undercoverCount) {
    let countMrWhite = mrWhiteCount;
    let countUndercover = undercoverCount;

    if ((countMrWhite + countUndercover) >= totalPlayers) {
        countMrWhite = 1;
        countUndercover = Math.max(0, Math.floor((totalPlayers - 2) / 2));
    }

    return { countMrWhite, countUndercover };
}

function buildRoles(totalPlayers, countMrWhite, countUndercover) {
    const roles = [];
    for (let i = 0; i < countMrWhite; i++) roles.push('mr_white');
    for (let i = 0; i < countUndercover; i++) roles.push('undercover');
    while (roles.length < totalPlayers) roles.push('civilian');
    return roles;
}

function shuffle(array, random = Math.random) {
    array.sort(() => random() - 0.5);
    return array;
}

function pickWordPair(wordDatabase, usedIndices, random = Math.random) {
    const nextUsed = usedIndices.slice();
    let availableIndices = [];

    for (let i = 0; i < wordDatabase.length; i++) {
        if (!nextUsed.includes(i)) availableIndices.push(i);
    }

    if (availableIndices.length === 0) {
        nextUsed.length = 0;
        for (let i = 0; i < wordDatabase.length; i++) availableIndices.push(i);
    }

    const randomIndexPos = Math.floor(random() * availableIndices.length);
    const selectedIndex = availableIndices[randomIndexPos];
    nextUsed.push(selectedIndex);

    return {
        wordPair: wordDatabase[selectedIndex],
        usedIndices: nextUsed,
        selectedIndex
    };
}

function assignPlayerRound(player, role, wordPair) {
    player.role = role;
    player.isAlive = true;
    player.votes = 0;
    player.description = "";
    if (role === 'civilian') player.word = wordPair.civilian;
    else if (role === 'undercover') player.word = wordPair.undercover;
    else player.word = null;
    return player;
}

function ensureFirstPlayerIsNotMrWhite(players) {
    while (players[0].role === 'mr_white') {
        const firstPlayer = players.shift();
        players.push(firstPlayer);
    }
    return players;
}

function beginMatch(game, wordDatabase, random = Math.random) {
    const totalPlayers = game.players.length;
    const counts = resolveImpostorCounts(
        totalPlayers,
        game.settings.mrWhiteCount,
        game.settings.undercoverCount
    );
    const roles = buildRoles(totalPlayers, counts.countMrWhite, counts.countUndercover);
    shuffle(roles, random);

    game.phase = 'DESCRIPTION';
    game.turnIndex = 0;
    game.winner = null;

    const picked = pickWordPair(wordDatabase, game.usedIndices, random);
    game.wordPair = picked.wordPair;
    game.usedIndices = picked.usedIndices;

    game.players.forEach((player, index) => {
        assignPlayerRound(player, roles[index], game.wordPair);
    });

    shuffle(game.players, random);
    ensureFirstPlayerIsNotMrWhite(game.players);
    return game;
}

function applyDescription(game, playerId, text) {
    const currentPlayer = game.players[game.turnIndex];
    if (currentPlayer.id !== playerId) return false;

    currentPlayer.description = text;
    let nextIndex = game.turnIndex + 1;
    while (nextIndex < game.players.length && !game.players[nextIndex].isAlive) nextIndex++;

    if (nextIndex >= game.players.length) game.phase = 'VOTING';
    else game.turnIndex = nextIndex;
    return true;
}

function playerWithMostVotes(players) {
    return players.reduce((prev, current) => (prev.votes > current.votes) ? prev : current);
}

function awardScores(players, result) {
    players.forEach(p => {
        if (result === 'CIVILIANS_WIN' && p.role === 'civilian') p.score += 2;
        if (result === 'MR_WHITE_WINS' && p.role === 'mr_white') p.score += 6;
        if (result === 'IMPOSTORS_WIN') {
            if (p.role === 'undercover') p.score += 10;
            if (p.role === 'mr_white') p.score += 10;
        }
    });
}

function finishGame(game, result) {
    game.phase = 'GAME_OVER';
    game.winner = result;
    awardScores(game.players, result);
}

function livingCounts(players) {
    const civiliansAlive = players.filter(p => p.role === 'civilian' && p.isAlive).length;
    const impostorsAlive = players.filter(p => (p.role === 'undercover' || p.role === 'mr_white') && p.isAlive).length;
    return { civiliansAlive, impostorsAlive };
}

function winnerFromCounts(civiliansAlive, impostorsAlive) {
    if (impostorsAlive === 0) return 'CIVILIANS_WIN';
    if (impostorsAlive >= civiliansAlive) return 'IMPOSTORS_WIN';
    return null;
}

function applyWinCheck(game) {
    const counts = livingCounts(game.players);
    const result = winnerFromCounts(counts.civiliansAlive, counts.impostorsAlive);
    if (result) finishGame(game, result);
    return result;
}

function resetForNextDescription(players) {
    players.forEach(p => { p.votes = 0; p.description = ""; });
    let turnIndex = 0;
    while (!players[turnIndex].isAlive) turnIndex++;
    return turnIndex;
}

function resolveVote(game, targetId) {
    const target = game.players.find(p => p.id === targetId);
    if (target) target.votes += 1;

    const totalVotes = game.players.reduce((acc, p) => acc + p.votes, 0);
    const aliveCount = game.players.filter(p => p.isAlive).length;

    if (totalVotes >= aliveCount) {
        const eliminated = playerWithMostVotes(game.players);
        eliminated.isAlive = false;

        if (eliminated.role === 'mr_white') {
            game.phase = 'MR_WHITE_GUESS';
            return { emit: true };
        }

        applyWinCheck(game);
        if (game.phase !== 'GAME_OVER' && game.phase !== 'MR_WHITE_GUESS') {
            game.turnIndex = resetForNextDescription(game.players);
            game.phase = 'DESCRIPTION';
            return { emit: true };
        }

        return { emit: false };
    }

    return { emit: true };
}

function guessMatchesCivilianWord(civilianWord, guess) {
    const correctWord = civilianWord.toLowerCase();
    return guess.toLowerCase().trim() === correctWord;
}

function resolveMrWhiteGuess(game, guess) {
    if (guessMatchesCivilianWord(game.wordPair.civilian, guess)) {
        finishGame(game, 'MR_WHITE_WINS');
        return 'MR_WHITE_WINS';
    }
    return applyWinCheck(game);
}

module.exports = {
    createGame,
    createPlayer,
    applySettingChange,
    canStartGame,
    resolveImpostorCounts,
    buildRoles,
    shuffle,
    pickWordPair,
    assignPlayerRound,
    ensureFirstPlayerIsNotMrWhite,
    beginMatch,
    applyDescription,
    resolveVote,
    resolveMrWhiteGuess,
    awardScores,
    livingCounts,
    winnerFromCounts,
    finishGame
};
