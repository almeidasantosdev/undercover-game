import { describe, expect, it } from '@jest/globals';
import { canStartMatch, startButtonLabel, winnerTitle } from './gameDisplay.ts';

describe('textos da interface', () => {
  it('mostra o vencedor de cada resultado e nada quando o código é desconhecido', () => {
    expect(winnerTitle('CIVILIANS_WIN')).toBe('Civis Venceram!');
    expect(winnerTitle('IMPOSTORS_WIN')).toBe('Impostores Venceram!');
    expect(winnerTitle('MR_WHITE_WINS')).toBe('Sr. Branco Venceu!');
    expect(winnerTitle(null)).toBe('');
    expect(winnerTitle('OUTRO')).toBe('');
  });

  it('só libera o começo a partir de três jogadores', () => {
    expect(canStartMatch(2)).toBe(false);
    expect(canStartMatch(3)).toBe(true);
    expect(startButtonLabel(2)).toBe('Aguardando Jogadores (Min 3)...');
    expect(startButtonLabel(3)).toBe('COMEÇAR PARTIDA AGORA');
  });
});
