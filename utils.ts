import { GameConfig, GameResult, GamePair, PrizeTier } from './types';

export const triggerHaptic = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Generate a shuffled deck of results
export const generateDeck = (config: GameConfig): GameResult[] => {
  const deck: GameResult[] = [];
  const { tiers, totalCards } = config;

  // 1. Create Winning Cards
  tiers.forEach(tier => {
    for (let i = 0; i < tier.count; i++) {
      deck.push(createCardResult(deck.length + 1, true, tier.amount));
    }
  });

  // 2. Fill the rest with Losing Cards
  const remaining = totalCards - deck.length;
  for (let i = 0; i < remaining; i++) {
    deck.push(createCardResult(deck.length + 1, false, 0));
  }

  // 3. Shuffle
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Re-assign IDs to match grid position
  return deck.map((card, index) => ({ ...card, id: index + 1 }));
};

const getRandomFakePrize = (targetAmount: number = 0) => {
  const amounts = [10, 20, 50, 100, 200, 500, 1000];
  // Filter out the target amount so losing rows don't look like winners visually
  const valid = amounts.filter(a => a !== targetAmount);
  return valid[Math.floor(Math.random() * valid.length)];
};

const createCardResult = (id: number, isWin: boolean, prizeAmount: number): GameResult => {
  const games: GamePair[] = [];
  let isBonusWin = false;
  let bonusPrize = 0;

  // Determine winning spots and distribution
  // Spots: 0 (Row 1), 1 (Row 2), 2 (Bonus)
  const winSpots: { index: number; amount: number }[] = [];

  if (isWin) {
    // Logic: Randomly distribute the prize amount
    // 50% chance to split the prize if it's large enough (>= 20)
    const shouldSplit = prizeAmount >= 20 && Math.random() > 0.5;

    if (shouldSplit) {
      // Split into 2 random spots
      const spot1 = Math.floor(Math.random() * 3);
      let spot2 = Math.floor(Math.random() * 3);
      while (spot2 === spot1) spot2 = Math.floor(Math.random() * 3);

      // Simple even split for cleaner numbers (or random split)
      // To ensure integers, we use floor.
      const part1 = Math.ceil(prizeAmount / 2);
      const part2 = prizeAmount - part1;

      winSpots.push({ index: spot1, amount: part1 });
      winSpots.push({ index: spot2, amount: part2 });
    } else {
      // All in one spot
      const spot = Math.floor(Math.random() * 3);
      winSpots.push({ index: spot, amount: prizeAmount });
    }
  }

  // Generate 2 rows (Index 0 and 1)
  for (let i = 0; i < 2; i++) {
    const spotData = winSpots.find(s => s.index === i);
    const rowIsWinner = !!spotData;
    const realPrize = spotData ? spotData.amount : 0;

    // If winner, show real prize. If loser, show a random fake prize.
    // For rows, we keep the "fake prize" logic because the win condition depends on the number comparison (VS).
    const displayPrize = rowIsWinner ? realPrize : getRandomFakePrize(prizeAmount);

    let my, house;
    if (rowIsWinner) {
      // WIN: My > House (Strictly Greater)
      house = Math.floor(Math.random() * 8) + 1; // 1-8
      my = Math.floor(Math.random() * (9 - house)) + house + 1; // house+1 to 9
    } else {
      // LOSS: My < House (Strictly Smaller) - No Draws allowed
      my = Math.floor(Math.random() * 8) + 1; // 1-8
      house = Math.floor(Math.random() * (9 - my)) + my + 1; // my+1 to 9
    }

    games.push({ my, house, isWin: rowIsWinner, prize: displayPrize });
  }

  // Generate Bonus Section (Index 2)
  const bonusSpotData = winSpots.find(s => s.index === 2);
  if (bonusSpotData) {
    isBonusWin = true;
    bonusPrize = bonusSpotData.amount;
  } else {
    isBonusWin = false;
    // FIX: If not a winner, bonus prize must be 0. 
    // Do not show fake random numbers in the bonus area to avoid confusion.
    bonusPrize = 0;
  }

  // Calculate strict total from generated spots to be 100% accurate
  const calculatedTotal = games.reduce((sum, g) => sum + (g.isWin ? g.prize : 0), 0) + (isBonusWin ? bonusPrize : 0);

  return {
    id,
    isWin, // Overall card win status
    games,
    bonusPrize,
    isBonusWin,
    totalPrizeAmount: calculatedTotal, // Should match prizeAmount passed in
    isPlayed: false
  };
};

// Sound Manager (Unchanged)
const SCRATCH_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3";
const WIN_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3";

export class SoundManager {
  private scratchAudio: HTMLAudioElement;
  private winAudio: HTMLAudioElement;
  private bgMusicAudio: HTMLAudioElement | null = null;
  private isScratching: boolean = false;
  private bgMusicLoopStart: number = 0;
  private bgMusicLoopEnd: number = 0;

  constructor() {
    this.scratchAudio = new Audio(SCRATCH_SOUND_URL);
    this.scratchAudio.loop = true;
    this.scratchAudio.volume = 0.5;

    this.winAudio = new Audio(WIN_SOUND_URL);
    this.winAudio.volume = 0.8;
  }

  setScratchSound(url: string) {
    if (url && url !== this.scratchAudio.src) {
      this.stopScratch();
      this.scratchAudio = new Audio(url);
      this.scratchAudio.loop = true;
      this.scratchAudio.volume = 0.5;
    }
  }

  playScratch() {
    if (!this.isScratching) {
      this.scratchAudio.play().catch(() => { });
      this.isScratching = true;
    }
  }

  stopScratch() {
    if (this.isScratching) {
      this.scratchAudio.pause();
      this.scratchAudio.currentTime = 0;
      this.isScratching = false;
    }
  }

  playWin() {
    this.winAudio.currentTime = 0;
    this.winAudio.play().catch(() => { });
  }

  // --- Background Music Logic ---

  setBgMusic(url: string, loopStart: number = 0, loopEnd: number = 0) {
    // If same URL, just update constraints
    if (this.bgMusicAudio && this.bgMusicAudio.src === url) {
      this.bgMusicLoopStart = loopStart;
      this.bgMusicLoopEnd = loopEnd;
      return;
    }

    // Stop existing
    if (this.bgMusicAudio) {
      this.bgMusicAudio.pause();
      this.bgMusicAudio = null;
    }

    if (!url) return;

    this.bgMusicAudio = new Audio(url);
    this.bgMusicAudio.loop = true; // Default loop for whole file
    this.bgMusicAudio.volume = 0.3; // Background volume
    this.bgMusicLoopStart = loopStart;
    this.bgMusicLoopEnd = loopEnd;

    // Custom Loop Logic
    this.bgMusicAudio.ontimeupdate = () => {
      if (this.bgMusicAudio && this.bgMusicLoopEnd > 0) {
        if (this.bgMusicAudio.currentTime >= this.bgMusicLoopEnd) {
          this.bgMusicAudio.currentTime = this.bgMusicLoopStart;
          this.bgMusicAudio.play().catch(() => { });
        }
      }
    };
  }

  setBgMusicEnabled(enabled: boolean) {
    if (enabled) {
      this.playBgMusic();
    } else {
      this.stopBgMusic();
    }
  }

  playBgMusic() {
    if (this.bgMusicAudio) {
      // If start time is set and we are at 0, jump to start
      if (this.bgMusicLoopStart > 0 && this.bgMusicAudio.currentTime < this.bgMusicLoopStart) {
        this.bgMusicAudio.currentTime = this.bgMusicLoopStart;
      }
      this.bgMusicAudio.play().catch(() => {
        console.log("Auto-play blocked, waiting for interaction");
      });
    }
  }

  stopBgMusic() {
    if (this.bgMusicAudio) {
      this.bgMusicAudio.pause();
    }
  }
}