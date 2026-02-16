export interface PrizeTier {
  count: number;
  amount: number;
}

export interface GameConfig {
  tiers: PrizeTier[]; // e.g. [{count: 1, amount: 1000}, {count: 10, amount: 100}]
  totalCards: number;
  winMessage: string;
  loseMessage: string;
}

export interface GamePair {
  my: number;
  house: number;
  prize: number; // The prize associated with this specific row
  isWin: boolean;
}

export interface GameResult {
  id: number;
  isWin: boolean;
  games: GamePair[]; // 2 comparison rows
  bonusPrize: number; // The prize in the bottom bonus area
  isBonusWin: boolean; // Whether the bonus area is the winning factor
  totalPrizeAmount: number; // Total won (sum of all winning areas)
  isPlayed: boolean; // Tracking if scratched
}

export interface ScratchCardProps {
  cardId: number;
  config: GameConfig;
  onClose: () => void;
}