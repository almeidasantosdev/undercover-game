const words = require('./words');
const {
    createGame,
    createPlayer,
    applySettingChange,
    canStartGame,
    resolveImpostorCounts,
    buildRoles,
    pickWordPair,
    shuffle,
    ensureFirstPlayerIsNotMrWhite,
    beginMatch,
    applyDescription,
    resolveVote,
    resolveMrWhiteGuess,
    awardScores,
    winnerFromCounts
} = require('./gameLogic');

function player(partial) {
    return {
        id: partial.id,
        name: partial.name || partial.id,
        role: partial.role ?? null,
        word: partial.word ?? null,
        isAlive: partial.isAlive ?? true,
        votes: partial.votes ?? 0,
        score: partial.score ?? 0,
        description: partial.description ?? ''
    };
}

function lobbyWith(ids, settings) {
    const game = createGame('sala');
    ids.forEach((id) => game.players.push(createPlayer(id, id)));
    if (settings) game.settings = { ...game.settings, ...settings };
    return game;
}

describe('sala e jogador', () => {
    it('cria a sala no lobby com um Sr. Branco e um espião', () => {
        expect(createGame('batata')).toEqual({
            id: 'batata',
            players: [],
            phase: 'LOBBY',
            wordPair: {},
            turnIndex: 0,
            winner: null,
            usedIndices: [],
            settings: { mrWhiteCount: 1, undercoverCount: 1 },
            deleteTimer: null
        });
    });

    it('cria o jogador vivo, sem papel e sem ponto', () => {
        expect(createPlayer('abc', 'Ana')).toEqual({
            id: 'abc',
            name: 'Ana',
            role: null,
            word: null,
            isAlive: true,
            votes: 0,
            score: 0,
            description: ''
        });
    });
});

describe('configuração da sala', () => {
    it('sobe e desce a quantidade sem passar de zero', () => {
        const settings = { mrWhiteCount: 1, undercoverCount: 0 };

        applySettingChange(settings, 'undercoverCount', 1);
        expect(settings.undercoverCount).toBe(1);

        applySettingChange(settings, 'mrWhiteCount', -1);
        expect(settings.mrWhiteCount).toBe(0);

        applySettingChange(settings, 'mrWhiteCount', -1);
        expect(settings.mrWhiteCount).toBe(0);
    });

    it('só deixa começar no lobby, com pelo menos três jogadores', () => {
        expect(canStartGame(null)).toBe(false);
        expect(canStartGame(lobbyWith(['a', 'b']))).toBe(false);

        const game = lobbyWith(['a', 'b', 'c']);
        expect(canStartGame(game)).toBe(true);

        game.phase = 'DESCRIPTION';
        expect(canStartGame(game)).toBe(false);
    });
});

describe('papéis', () => {
    it('mantém a configuração quando ainda sobra civil', () => {
        expect(resolveImpostorCounts(5, 1, 1)).toEqual({
            countMrWhite: 1,
            countUndercover: 1
        });
    });

    it('reduz os impostores quando eles ocupariam a sala inteira', () => {
        expect(resolveImpostorCounts(3, 2, 2)).toEqual({
            countMrWhite: 1,
            countUndercover: 0
        });
        expect(resolveImpostorCounts(4, 4, 4)).toEqual({
            countMrWhite: 1,
            countUndercover: 1
        });
    });

    it('completa a lista com civis', () => {
        expect(buildRoles(5, 1, 1)).toEqual([
            'mr_white',
            'undercover',
            'civilian',
            'civilian',
            'civilian'
        ]);
    });
});

describe('palavras', () => {
    const pairs = [
        { civilian: 'Copo', undercover: 'Taça' },
        { civilian: 'Gato', undercover: 'Tigre' }
    ];

    it('sorteia um par ainda não usado', () => {
        const picked = pickWordPair(pairs, [], () => 0);
        expect(picked.selectedIndex).toBe(0);
        expect(picked.wordPair).toEqual(pairs[0]);
        expect(picked.usedIndices).toEqual([0]);

        const second = pickWordPair(pairs, picked.usedIndices, () => 0.99);
        expect(second.selectedIndex).toBe(1);
        expect(second.usedIndices).toEqual([0, 1]);
    });

    it('recomeça a lista quando todos os pares já saíram', () => {
        const picked = pickWordPair(pairs, [0, 1], () => 0);
        expect(picked.selectedIndex).toBe(0);
        expect(picked.usedIndices).toEqual([0]);
    });

    it('o banco usado pelo servidor tem pares com as duas palavras', () => {
        expect(words.length).toBeGreaterThan(0);
        words.forEach((pair) => {
            expect(typeof pair.civilian).toBe('string');
            expect(typeof pair.undercover).toBe('string');
            expect(pair.civilian.trim().length).toBeGreaterThan(0);
            expect(pair.undercover.trim().length).toBeGreaterThan(0);
        });
    });
});

describe('início da partida', () => {
    it('distribui palavras conforme o papel e não deixa o Sr. Branco falar primeiro', () => {
        const game = lobbyWith(['ana', 'bruno', 'carla', 'duda', 'eva'], {
            mrWhiteCount: 1,
            undercoverCount: 1
        });
        game.players[0].score = 4;

        beginMatch(game, words, () => 0.2);

        const byRole = game.players.reduce((acc, p) => {
            acc[p.role] = (acc[p.role] || 0) + 1;
            return acc;
        }, {});

        expect(game.phase).toBe('DESCRIPTION');
        expect(game.turnIndex).toBe(0);
        expect(game.winner).toBeNull();
        expect(byRole).toEqual({ mr_white: 1, undercover: 1, civilian: 3 });
        expect(game.players[0].role).not.toBe('mr_white');
        expect(game.usedIndices).toHaveLength(1);
        expect(words).toContainEqual(game.wordPair);

        game.players.forEach((p) => {
            expect(p.isAlive).toBe(true);
            expect(p.votes).toBe(0);
            expect(p.description).toBe('');
            if (p.role === 'civilian') expect(p.word).toBe(game.wordPair.civilian);
            if (p.role === 'undercover') expect(p.word).toBe(game.wordPair.undercover);
            if (p.role === 'mr_white') expect(p.word).toBeNull();
        });

        const ana = game.players.find((p) => p.id === 'ana');
        expect(ana.score).toBe(4);
    });

    it('segura a configuração quando não haveria civil', () => {
        const game = lobbyWith(['ana', 'bruno', 'carla'], {
            mrWhiteCount: 5,
            undercoverCount: 5
        });

        beginMatch(game, words, () => 0);

        const whites = game.players.filter((p) => p.role === 'mr_white');
        const spies = game.players.filter((p) => p.role === 'undercover');
        const civilians = game.players.filter((p) => p.role === 'civilian');

        expect(whites).toHaveLength(1);
        expect(spies).toHaveLength(0);
        expect(civilians).toHaveLength(2);
        expect(game.players[0].role).not.toBe('mr_white');
    });

    it('usa o sorteio padrão quando nenhum gerador é informado', () => {
        const names = ['ana', 'bruno', 'carla'];
        shuffle(names);
        expect(names).toHaveLength(3);
        expect(names).toEqual(expect.arrayContaining(['ana', 'bruno', 'carla']));

        const picked = pickWordPair(words, []);
        expect(picked.wordPair).toBe(words[picked.selectedIndex]);
        expect(picked.usedIndices).toEqual([picked.selectedIndex]);

        const game = lobbyWith(['ana', 'bruno', 'carla']);
        beginMatch(game, words);
        expect(game.phase).toBe('DESCRIPTION');
        expect(game.players).toHaveLength(3);
        expect(game.players[0].role).not.toBe('mr_white');
    });

    it('move o Sr. Branco para o fim enquanto ele estiver na frente', () => {
        const players = [
            player({ id: 'w1', role: 'mr_white' }),
            player({ id: 'w2', role: 'mr_white' }),
            player({ id: 'c', role: 'civilian' })
        ];

        ensureFirstPlayerIsNotMrWhite(players);

        expect(players.map((p) => p.id)).toEqual(['c', 'w1', 'w2']);
    });
});

describe('descrições', () => {
    function round() {
        const game = createGame('sala');
        game.phase = 'DESCRIPTION';
        game.turnIndex = 0;
        game.players = [
            player({ id: 'ana', isAlive: true }),
            player({ id: 'bruno', isAlive: false }),
            player({ id: 'carla', isAlive: true })
        ];
        return game;
    }

    it('ignora quem não está na vez', () => {
        const game = round();
        expect(applyDescription(game, 'carla', 'macio')).toBe(false);
        expect(game.players[0].description).toBe('');
        expect(game.phase).toBe('DESCRIPTION');
        expect(game.turnIndex).toBe(0);
    });

    it('pula quem já foi eliminado e passa a vez', () => {
        const game = round();
        expect(applyDescription(game, 'ana', 'redondo')).toBe(true);
        expect(game.players[0].description).toBe('redondo');
        expect(game.turnIndex).toBe(2);
        expect(game.phase).toBe('DESCRIPTION');
    });

    it('abre a votação depois da última pista', () => {
        const game = round();
        game.turnIndex = 2;
        expect(applyDescription(game, 'carla', 'verde')).toBe(true);
        expect(game.phase).toBe('VOTING');
        expect(game.turnIndex).toBe(2);
    });
});

describe('votação e eliminação', () => {
    function votingGame() {
        const game = createGame('sala');
        game.phase = 'VOTING';
        game.wordPair = { civilian: 'Copo', undercover: 'Taça' };
        game.players = [
            player({ id: 'ana', role: 'civilian', description: 'vidro' }),
            player({ id: 'bruno', role: 'undercover', description: 'festa' }),
            player({ id: 'carla', role: 'mr_white' }),
            player({ id: 'duda', role: 'civilian', isAlive: false, description: 'já foi' })
        ];
        return game;
    }

    it('espera até cada vivo ter votado', () => {
        const game = votingGame();
        const result = resolveVote(game, 'bruno');

        expect(result.emit).toBe(true);
        expect(game.phase).toBe('VOTING');
        expect(game.players.find((p) => p.id === 'bruno').votes).toBe(1);
        expect(game.players.every((p) => p.isAlive === (p.id !== 'duda'))).toBe(true);
    });

    it('não soma voto quando o alvo não existe', () => {
        const game = votingGame();
        const result = resolveVote(game, 'ninguem');

        expect(result.emit).toBe(true);
        expect(game.players.every((p) => p.votes === 0)).toBe(true);
    });

    it('no empate, elimina o último jogador entre os mais votados', () => {
        const game = votingGame();
        game.players = [
            player({ id: 'ana', role: 'civilian', votes: 1 }),
            player({ id: 'bruno', role: 'undercover', votes: 1 }),
            player({ id: 'carla', role: 'civilian', votes: 1 }),
            player({ id: 'duda', role: 'civilian', votes: 0 })
        ];

        const result = resolveVote(game, 'duda');

        expect(result.emit).toBe(true);
        expect(game.players.find((p) => p.id === 'duda').isAlive).toBe(false);
        expect(game.players.filter((p) => p.id !== 'duda').every((p) => p.isAlive)).toBe(true);
        expect(game.phase).toBe('DESCRIPTION');
        expect(game.players.every((p) => p.votes === 0)).toBe(true);
    });

    it('dá a chance de chute quando o eliminado é o Sr. Branco', () => {
        const game = votingGame();
        game.players.forEach((p) => {
            if (p.isAlive) p.votes = 1;
        });
        game.players.find((p) => p.id === 'carla').votes = 5;

        const result = resolveVote(game, 'ana');

        expect(result.emit).toBe(true);
        expect(game.phase).toBe('MR_WHITE_GUESS');
        expect(game.players.find((p) => p.id === 'carla').isAlive).toBe(false);
        expect(game.winner).toBeNull();
        expect(game.players.find((p) => p.id === 'carla').score).toBe(0);
        expect(game.players.find((p) => p.id === 'ana').description).toBe('vidro');
    });

    it('civis vencem quando o último impostor sai, e esse fim não é anunciado neste ramo', () => {
        const game = votingGame();
        game.players = [
            player({ id: 'ana', role: 'civilian', votes: 0, score: 3 }),
            player({ id: 'bruno', role: 'undercover', votes: 2 }),
            player({ id: 'carla', role: 'civilian', votes: 0 })
        ];

        const result = resolveVote(game, 'bruno');

        expect(result.emit).toBe(false);
        expect(game.phase).toBe('GAME_OVER');
        expect(game.winner).toBe('CIVILIANS_WIN');
        expect(game.players.find((p) => p.id === 'bruno').isAlive).toBe(false);
        expect(game.players.find((p) => p.id === 'ana').score).toBe(5);
        expect(game.players.find((p) => p.id === 'carla').score).toBe(2);
        expect(game.players.find((p) => p.id === 'bruno').score).toBe(0);
        expect(game.players.find((p) => p.id === 'bruno').votes).toBe(3);
    });

    it('impostores vencem quando ficam em número igual ou maior que os civis', () => {
        const game = votingGame();
        game.players = [
            player({ id: 'ana', role: 'civilian', votes: 2 }),
            player({ id: 'bruno', role: 'undercover' }),
            player({ id: 'carla', role: 'mr_white', isAlive: false, score: 1 })
        ];

        const result = resolveVote(game, 'ana');

        expect(result.emit).toBe(false);
        expect(game.winner).toBe('IMPOSTORS_WIN');
        expect(game.players.find((p) => p.id === 'bruno').score).toBe(10);
        expect(game.players.find((p) => p.id === 'carla').score).toBe(11);
        expect(game.players.find((p) => p.id === 'ana').score).toBe(0);
    });

    it('a rodada seguinte começa no primeiro jogador ainda vivo', () => {
        const game = votingGame();
        game.players = [
            player({ id: 'ana', role: 'civilian', isAlive: false, votes: 0, description: 'x' }),
            player({ id: 'bruno', role: 'undercover', votes: 0, description: 'y' }),
            player({ id: 'carla', role: 'civilian', votes: 0, description: 'z' }),
            player({ id: 'duda', role: 'civilian', votes: 1, description: 'w' }),
            player({ id: 'eva', role: 'civilian', votes: 2, description: 'v' })
        ];

        const result = resolveVote(game, 'eva');

        expect(result.emit).toBe(true);
        expect(game.phase).toBe('DESCRIPTION');
        expect(game.winner).toBeNull();
        expect(game.turnIndex).toBe(1);
        expect(game.players.every((p) => p.votes === 0 && p.description === '')).toBe(true);
    });
});

describe('chute do Sr. Branco', () => {
    function guessGame() {
        const game = createGame('sala');
        game.phase = 'MR_WHITE_GUESS';
        game.wordPair = { civilian: 'McDonalds', undercover: 'Burger King' };
        game.players = [
            player({ id: 'ana', role: 'civilian', score: 1 }),
            player({ id: 'bruno', role: 'undercover', score: 2 }),
            player({ id: 'carla', role: 'mr_white', isAlive: false, score: 3 })
        ];
        return game;
    }

    it('aceita o palpite da palavra civil ignorando maiúsculas e espaços nas pontas', () => {
        const game = guessGame();
        expect(resolveMrWhiteGuess(game, '  mCdOnAlDs  ')).toBe('MR_WHITE_WINS');
        expect(game.phase).toBe('GAME_OVER');
        expect(game.winner).toBe('MR_WHITE_WINS');
        expect(game.players.find((p) => p.id === 'carla').score).toBe(9);
        expect(game.players.find((p) => p.id === 'ana').score).toBe(1);
        expect(game.players.find((p) => p.id === 'bruno').score).toBe(2);
    });

    it('palpite errado não encerra a partida enquanto os civis ainda são maioria', () => {
        const game = guessGame();
        game.players.push(player({ id: 'duda', role: 'civilian' }));

        expect(resolveMrWhiteGuess(game, 'Burger King')).toBeNull();
        expect(game.phase).toBe('MR_WHITE_GUESS');
        expect(game.winner).toBeNull();
        expect(game.players.every((p) => p.score === (p.id === 'ana' ? 1 : p.id === 'bruno' ? 2 : p.id === 'carla' ? 3 : 0))).toBe(true);
    });

    it('palpite errado entrega a vitória aos civis se não restou impostor', () => {
        const game = guessGame();
        game.players.find((p) => p.id === 'bruno').isAlive = false;

        expect(resolveMrWhiteGuess(game, 'telegram')).toBe('CIVILIANS_WIN');
        expect(game.winner).toBe('CIVILIANS_WIN');
        expect(game.players.find((p) => p.id === 'ana').score).toBe(3);
        expect(game.players.find((p) => p.id === 'carla').score).toBe(3);
    });

    it('palpite errado entrega a vitória aos impostores quando eles alcançam os civis', () => {
        const game = guessGame();

        expect(resolveMrWhiteGuess(game, 'errado')).toBe('IMPOSTORS_WIN');
        expect(game.players.find((p) => p.id === 'bruno').score).toBe(12);
        expect(game.players.find((p) => p.id === 'carla').score).toBe(13);
        expect(game.players.find((p) => p.id === 'ana').score).toBe(1);
    });
});

describe('condição de vitória e pontuação', () => {
    it('civis vencem sem impostor vivo, mesmo que ninguém mais esteja vivo', () => {
        expect(winnerFromCounts(0, 0)).toBe('CIVILIANS_WIN');
        expect(winnerFromCounts(2, 0)).toBe('CIVILIANS_WIN');
    });

    it('impostores vencem no empate e quando passam os civis', () => {
        expect(winnerFromCounts(1, 1)).toBe('IMPOSTORS_WIN');
        expect(winnerFromCounts(1, 2)).toBe('IMPOSTORS_WIN');
    });

    it('a partida continua quando ainda há mais civis', () => {
        expect(winnerFromCounts(2, 1)).toBeNull();
    });

    it('soma os pontos em cima do placar que já existia', () => {
        const players = [
            player({ id: 'c', role: 'civilian', score: 4, isAlive: false }),
            player({ id: 'u', role: 'undercover', score: 1 }),
            player({ id: 'w', role: 'mr_white', score: 1 })
        ];

        awardScores(players, 'CIVILIANS_WIN');
        expect(players.map((p) => p.score)).toEqual([6, 1, 1]);
    });
});
