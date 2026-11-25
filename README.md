# SPY & WHITE

[![CI](https://github.com/almeidasantosdev/undercover-game/actions/workflows/ci.yml/badge.svg)](https://github.com/almeidasantosdev/undercover-game/actions/workflows/ci.yml)

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

## Testes

Na raiz do repositório, com as dependências do `client` e do `server` já instaladas:

```bash
npm test
```

O comando roda o Jest nos dois lados e imprime um resumo de cobertura.

No servidor, os testes cobrem as regras da partida: montagem da sala, papéis, distribuição das palavras, rodada de pistas, votação, eliminação, chute do Sr. Branco, vitória e pontuação.

```bash
cd server
npm install
npm test
```

No cliente, os testes cobrem os textos de vitória, o botão de início e as telas principais: entrada, lobby, pista, votação, chute e fim de jogo.

```bash
cd client
npm install
npm test
```

## Integração contínua

Em cada pull request e em cada push na branch `main`, o GitHub Actions instala as dependências, executa o lint e o build do cliente e roda os testes com cobertura.
