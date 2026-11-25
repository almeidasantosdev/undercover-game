export function winnerTitle(winner: string | null): string {
  if (winner === 'CIVILIANS_WIN') return 'Civis Venceram!';
  if (winner === 'IMPOSTORS_WIN') return 'Impostores Venceram!';
  if (winner === 'MR_WHITE_WINS') return 'Sr. Branco Venceu!';
  return '';
}

export function canStartMatch(playerCount: number): boolean {
  return playerCount >= 3;
}

export function startButtonLabel(playerCount: number): string {
  if (playerCount < 3) return 'Aguardando Jogadores (Min 3)...';
  return 'COMEÇAR PARTIDA AGORA';
}
