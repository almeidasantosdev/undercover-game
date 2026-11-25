// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Importa o banco de palavras externo
const wordDatabase = require('./words');
const {
    createGame,
    createPlayer,
    applySettingChange,
    canStartGame,
    beginMatch,
    applyDescription,
    resolveVote,
    resolveMrWhiteGuess
} = require('./gameLogic');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    }
});

let games = {}; 

io.on('connection', (socket) => {
    console.log(`Nova conexão: ${socket.id}`);

    // 1. Entrar/Criar Sala
    socket.on('join_room', ({ roomId, playerName }) => {
        // --- FIX: Sai da sala anterior se houver (evita duplicidade) ---
        if (socket.data.roomId) {
            socket.leave(socket.data.roomId);
        }

        socket.join(roomId);
        
        // --- O SEGREDO: Salva a sala DENTRO do socket ---
        socket.data.roomId = roomId; 
        socket.data.playerName = playerName;

        // Se a sala não existe, cria
        if (!games[roomId]) {
            games[roomId] = createGame(roomId);
        }

        const game = games[roomId];

        // Cancela exclusão se a sala ia ser deletada
        if (game.deleteTimer) {
            console.log(`Sala ${roomId}: Exclusão cancelada (alguém entrou).`);
            clearTimeout(game.deleteTimer);
            game.deleteTimer = null;
        }

        // Verifica se o jogador já não está na lista (pra não duplicar nome se der F5)
        const existingPlayer = game.players.find(p => p.id === socket.id);
        if (!existingPlayer) {
            game.players.push(createPlayer(socket.id, playerName));
        }

        io.to(roomId).emit('update_game', game);
    });

    socket.on('change_settings', ({ roomId, setting, change }) => {
        const game = games[roomId];
        if (!game || game.phase !== 'LOBBY') return;
        applySettingChange(game.settings, setting, change);
        io.to(roomId).emit('update_game', game);
    });

    socket.on('start_game', (roomId) => {
        const game = games[roomId];
        if (!canStartGame(game)) return;
        beginMatch(game, wordDatabase);
        io.to(roomId).emit('update_game', game);
    });

    socket.on('send_description', ({ roomId, text }) => {
        const game = games[roomId];
        if (!game) return;
        if (applyDescription(game, socket.id, text)) {
            io.to(roomId).emit('update_game', game);
        }
    });

    socket.on('vote_player', ({ roomId, targetId }) => {
        const game = games[roomId];
        if (!game) return;
        const result = resolveVote(game, targetId);
        if (result.emit) io.to(roomId).emit('update_game', game);
    });

    socket.on('mr_white_guess', ({ roomId, guess }) => {
        const game = games[roomId];
        if (!game) return;
        resolveMrWhiteGuess(game, guess);
        io.to(roomId).emit('update_game', game);
    });

    // --- NOVA LÓGICA DE DESCONEXÃO (DIRETA E RÁPIDA) ---
    socket.on('disconnect', () => {
        console.log(`Desconectado: ${socket.id}`);
        
        // Recupera a sala direto do "crachá" do socket
        const roomId = socket.data.roomId; 

        if (roomId && games[roomId]) {
            const game = games[roomId];
            
            // Remove o jogador
            game.players = game.players.filter(p => p.id !== socket.id);
            
            // Avisa a sala IMEDIATAMENTE
            io.to(roomId).emit('update_game', game);
            
            console.log(`Jogador removido da sala ${roomId}. Restam: ${game.players.length}`);

            // Verifica se esvaziou
            if (game.players.length === 0) {
                console.log(`Sala ${roomId} vazia. Excluindo em 5 minutos...`);
                game.deleteTimer = setTimeout(() => {
                    console.log(`Sala ${roomId} expirou e foi excluída.`);
                    delete games[roomId];
                }, 5 * 60 * 1000);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVIDOR RODANDO NA PORTA ${PORT}`);
});
