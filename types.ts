export interface PrizeTier {
  count: number;
  amount: number;
}

export interface GameConfig {
  tiers: PrizeTier[]; // e.g. [{count: 1, amount: 1000}, {count: 10, amount: 100}]
  totalCards: number;
  winMessage: string;
  loseMessage: string;
  scratchSound?: string; // Optional custom sound URL
  bgMusic?: string;      // Background music URL (blob or remote)
  bgMusicLoopStart?: number; // Start time in seconds
  bgMusicLoopEnd?: number;   // End time in seconds
  bgMusicEnabled: boolean; // Toggle for background music
  coverImage?: string;     // Base64 data URL for custom cover image
  lastResetAt?: number;    // Timestamp of the last global game reset
}

export interface GamePair {
  my: number;
  house: number;
  prize: number; // The prize associated with this specific row
  isWin: boolean;
}

export type CardStatus = 'available' | 'scratching' | 'completed';

export interface GameResult {
  id: number;
  isWin: boolean;
  status: CardStatus; // State machine: available → scratching → completed
  games: GamePair[]; // 2 comparison rows
  bonusPrize: number; // The prize in the bottom bonus area
  isBonusWin: boolean; // Whether the bonus area is the winning factor
  totalPrizeAmount: number; // Total won (sum of all winning areas)
  isPlayed: boolean; // Kept for backward compat
  progress: number; // 0-100 scratch percentage
  isRevealed?: boolean; // UI state for animation
  lockedBy?: string; // UID of locker
  lockedAt?: number; // Timestamp of lock
}

export type CardData = GameResult;

export interface ScratchCardProps {
  cardId: number;
  config: GameConfig;
  onClose: () => void;
}