# SPY & WHITE

Jogo de festa em que o grupo precisa achar o impostor. Cada jogador recebe uma palavra. A maioria recebe a mesma; o espião recebe uma parecida e não sabe que a dele é diferente. Há também o papel Mr. White. Os jogadores descrevem a palavra, votam e tentam eliminar quem não pertence ao grupo.

O repositório tem duas partes:

- `client` — interface React publicada em https://spywhitegame.vercel.app
- `server` — salas em tempo real com Socket.IO, fases de lobby e pares de palavras em `server/words.js`

## Como rodar

No servidor:

```bash
cd server
npm install
node index.js
```

No cliente:

```bash
cd client
npm install
npm run dev
```
