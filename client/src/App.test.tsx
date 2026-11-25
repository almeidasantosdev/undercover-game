import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const mockSocket = {
  id: 'me',
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.unstable_mockModule('socket.io-client', () => ({
  default: () => mockSocket,
}));

const { default: App } = await import('./App.tsx');

afterEach(() => {
  cleanup();
});

interface Player {
  id: string;
  name: string;
  role: 'civilian' | 'undercover' | 'mr_white' | null;
  word: string | null;
  isAlive: boolean;
  votes: number;
  score: number;
  description: string;
}

interface GameState {
  id: string;
  players: Player[];
  phase: 'LOBBY' | 'DESCRIPTION' | 'VOTING' | 'MR_WHITE_GUESS' | 'GAME_OVER';
  wordPair: { civilian: string; undercover: string } | null;
  turnIndex: number;
  winner: string | null;
  settings: { mrWhiteCount: number; undercoverCount: number };
}

function player(partial: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    role: null,
    word: null,
    isAlive: true,
    votes: 0,
    score: 0,
    description: '',
    ...partial,
  };
}

function game(partial: Partial<GameState>): GameState {
  return {
    id: 'sala',
    players: [player({ id: 'me', name: 'Ana' })],
    phase: 'LOBBY',
    wordPair: { civilian: 'Copo', undercover: 'Taça' },
    turnIndex: 0,
    winner: null,
    settings: { mrWhiteCount: 1, undercoverCount: 1 },
    ...partial,
  };
}

function pushGame(state: GameState) {
  const calls = mockSocket.on.mock.calls.filter((call) => call[0] === 'update_game');
  const handler = calls.at(-1)?.[1] as ((next: GameState) => void) | undefined;
  if (!handler) throw new Error('Cliente não registrou update_game.');
  act(() => handler(state));
}

function join(name = 'Ana', room = 'sala') {
  fireEvent.change(screen.getByPlaceholderText('Ex: João'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('Ex: Batata'), { target: { value: room } });
  fireEvent.click(screen.getByRole('button', { name: 'ENTRAR NA SALA' }));
}

describe('tela de entrada', () => {
  beforeEach(() => {
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
  });

  it('mostra o título, as regras e o link do autor', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /SPY & WHITE GAME/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /REGRAS/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.rules-list li')).toHaveLength(9);
    expect(screen.getByText(/A PALAVRA CORRETA É A DOS CIVIS!/i)).toBeInTheDocument();

    const author = screen.getByRole('link', { name: 'Kleidson Almeida Santos' });
    expect(author).toHaveAttribute('href', 'https://kadevpt.vercel.app/');
    expect(author).toHaveAttribute('target', '_blank');
    expect(author).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('não entra na sala sem apelido e nome da sala', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR NA SALA' }));
    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'ENTRAR NA SALA' })).toBeInTheDocument();
  });

  it('entra na sala e mostra a conexão até o estado chegar', () => {
    render(<App />);
    join();

    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', {
      roomId: 'sala',
      playerName: 'Ana',
    });
    expect(screen.getByRole('heading', { name: 'Conectando...' })).toBeInTheDocument();
  });
});

describe('partida', () => {
  beforeEach(() => {
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
    render(<App />);
    join();
  });

  it('pede o jogador de volta quando o estado não o encontra', () => {
    pushGame(game({
      players: [player({ id: 'outro', name: 'Bruno' })],
    }));

    expect(screen.getByText('Erro: Reinicie a página.')).toBeInTheDocument();
  });

  it('segura o início com menos de três e permite configurar a sala', () => {
    pushGame(game({
      players: [
        player({ id: 'me', name: 'Ana' }),
        player({ id: 'b', name: 'Bruno' }),
      ],
    }));

    const start = screen.getByRole('button', { name: 'Aguardando Jogadores (Min 3)...' });
    expect(start).toBeDisabled();
    expect(screen.getByText('Ana (Você)')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    expect(document.querySelector('.secret-card')).toBeNull();

    const plus = screen.getAllByRole('button', { name: '+' });
    const minus = screen.getAllByRole('button', { name: '-' });
    fireEvent.click(minus[0]);
    fireEvent.click(plus[0]);
    fireEvent.click(minus[1]);
    fireEvent.click(plus[1]);

    expect(mockSocket.emit).toHaveBeenCalledWith('change_settings', {
      roomId: 'sala',
      setting: 'mrWhiteCount',
      change: -1,
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('change_settings', {
      roomId: 'sala',
      setting: 'mrWhiteCount',
      change: 1,
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('change_settings', {
      roomId: 'sala',
      setting: 'undercoverCount',
      change: -1,
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('change_settings', {
      roomId: 'sala',
      setting: 'undercoverCount',
      change: 1,
    });
  });

  it('mostra zero quando a configuração da sala não veio', () => {
    const state = game({
      players: [player({ id: 'me', name: 'Ana' })],
    });
    pushGame({ ...state, settings: undefined as unknown as GameState['settings'] });

    expect(document.querySelector('.settings-box')?.textContent).toContain('Total de Inimigos: 0');
  });

  it('começa a partida quando já há três jogadores', () => {
    pushGame(game({
      players: [
        player({ id: 'me', name: 'Ana' }),
        player({ id: 'b', name: 'Bruno' }),
        player({ id: 'c', name: 'Carla' }),
      ],
    }));

    fireEvent.click(screen.getByRole('button', { name: 'COMEÇAR PARTIDA AGORA' }));
    expect(mockSocket.emit).toHaveBeenCalledWith('start_game', 'sala');
  });

  it('mostra a palavra de quem não é o Sr. Branco e envia a pista na sua vez', () => {
    pushGame(game({
      phase: 'DESCRIPTION',
      turnIndex: 0,
      players: [
        player({ id: 'me', name: 'Ana', role: 'civilian', word: 'Copo' }),
        player({ id: 'b', name: 'Bruno', role: 'undercover', word: 'Taça', description: 'festa' }),
      ],
    }));

    expect(screen.getByText('Copo')).toBeInTheDocument();
    const log = document.querySelector('.descriptions-log');
    expect(log?.textContent).toContain('Bruno:');
    expect(log?.textContent).toContain('"festa"');
    expect(log?.textContent).toContain('...');

    const input = screen.getByPlaceholderText('Descreva sua palavra com 1 termo...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }));
    expect(mockSocket.emit).not.toHaveBeenCalledWith('send_description', expect.anything());

    fireEvent.change(input, { target: { value: 'vidro' } });
    fireEvent.click(screen.getByRole('button', { name: 'ENVIAR' }));
    expect(mockSocket.emit).toHaveBeenCalledWith('send_description', {
      roomId: 'sala',
      text: 'vidro',
    });
    expect(input).toHaveValue('');
  });

  it('não pede pista fora da vez, nem para quem já saiu', () => {
    pushGame(game({
      phase: 'DESCRIPTION',
      turnIndex: 1,
      players: [
        player({ id: 'me', name: 'Ana', role: 'civilian', word: 'Copo' }),
        player({ id: 'b', name: 'Bruno', role: 'mr_white' }),
      ],
    }));

    expect(screen.queryByPlaceholderText('Descreva sua palavra com 1 termo...')).not.toBeInTheDocument();

    pushGame(game({
      phase: 'DESCRIPTION',
      turnIndex: 0,
      players: [
        player({ id: 'me', name: 'Ana', role: 'civilian', word: 'Copo', isAlive: false }),
        player({ id: 'b', name: 'Bruno', role: 'undercover', word: 'Taça' }),
      ],
    }));

    expect(screen.queryByPlaceholderText('Descreva sua palavra com 1 termo...')).not.toBeInTheDocument();
  });

  it('mostra o aviso de Sr. Branco', () => {
    pushGame(game({
      phase: 'DESCRIPTION',
      turnIndex: 1,
      players: [
        player({ id: 'me', name: 'Ana', role: 'mr_white' }),
        player({ id: 'b', name: 'Bruno', role: 'civilian', word: 'Copo' }),
      ],
    }));

    expect(screen.getByText('VOCÊ É O SR. BRANCO! 🤫')).toBeInTheDocument();
    expect(document.querySelector('.secret-card')).toHaveClass('white-role');
  });

  it('lista só os outros jogadores vivos na votação', () => {
    pushGame(game({
      phase: 'VOTING',
      players: [
        player({ id: 'me', name: 'Ana', role: 'civilian', word: 'Copo', votes: 2 }),
        player({ id: 'b', name: 'Bruno', role: 'undercover', word: 'Taça' }),
        player({ id: 'c', name: 'Carla', role: 'mr_white', isAlive: false }),
      ],
    }));

    expect(screen.getByRole('button', { name: 'Bruno' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carla' })).not.toBeInTheDocument();
    expect(screen.getByText('Seus votos recebidos: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bruno' }));
    expect(mockSocket.emit).toHaveBeenCalledWith('vote_player', {
      roomId: 'sala',
      targetId: 'b',
    });
  });

  it('abre o chute só para o Sr. Branco eliminado', () => {
    pushGame(game({
      phase: 'MR_WHITE_GUESS',
      players: [
        player({ id: 'me', name: 'Ana', role: 'civilian', word: 'Copo' }),
        player({ id: 'b', name: 'Bruno', role: 'mr_white', isAlive: false }),
      ],
    }));

    expect(screen.getByText('Ele tem uma chance de adivinhar.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Qual é a palavra dos civis?')).not.toBeInTheDocument();

    pushGame(game({
      phase: 'MR_WHITE_GUESS',
      players: [
        player({ id: 'me', name: 'Ana', role: 'mr_white', isAlive: false }),
        player({ id: 'b', name: 'Bruno', role: 'civilian', word: 'Copo' }),
      ],
    }));

    fireEvent.change(screen.getByPlaceholderText('Qual é a palavra dos civis?'), {
      target: { value: 'Copo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'TENTAR SALVAR' }));
    expect(mockSocket.emit).toHaveBeenCalledWith('mr_white_guess', {
      roomId: 'sala',
      guess: 'Copo',
    });
  });

  it('mostra quem venceu, revela as palavras e oferece outra partida', () => {
    pushGame(game({
      phase: 'GAME_OVER',
      winner: 'CIVILIANS_WIN',
      players: [
        player({ id: 'me', name: 'Ana', role: 'civilian', word: 'Copo', score: 2 }),
        player({ id: 'b', name: 'Bruno', role: 'undercover', word: 'Taça', score: 0 }),
      ],
    }));

    expect(screen.getByRole('heading', { name: 'Civis Venceram!' })).toBeInTheDocument();
    expect(screen.getAllByText('Copo').length).toBeGreaterThan(0);
    expect(screen.getByText('Taça')).toBeInTheDocument();
    expect(document.querySelector('.score-list')?.textContent).toContain('Ana:');
    expect(document.querySelector('.score-list')?.textContent).toContain('2');

    pushGame(game({
      phase: 'GAME_OVER',
      winner: 'IMPOSTORS_WIN',
      players: [player({ id: 'me', name: 'Ana' })],
    }));
    expect(screen.getByRole('heading', { name: 'Impostores Venceram!' })).toBeInTheDocument();

    pushGame(game({
      phase: 'GAME_OVER',
      winner: 'MR_WHITE_WINS',
      players: [player({ id: 'me', name: 'Ana' })],
    }));
    expect(screen.getByRole('heading', { name: 'Sr. Branco Venceu!' })).toBeInTheDocument();

    pushGame(game({
      phase: 'GAME_OVER',
      winner: null,
      wordPair: null,
      players: [player({ id: 'me', name: 'Ana' })],
    }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('');
    expect(screen.queryByText(/Civis:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'JOGAR NOVAMENTE' }));
    expect(mockSocket.emit).toHaveBeenCalledWith('start_game', 'sala');
  });
});
