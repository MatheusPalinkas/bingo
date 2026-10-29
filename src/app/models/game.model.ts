export type BingoLetter = 'B' | 'I' | 'N' | 'G' | 'O';

export interface BingoBall {
  number: number;
  letter: BingoLetter;
  label: string;
}

export type GameStatus = 'em-andamento' | 'finalizada';

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  drawnNumbers: number[];
}
