import { db, ensureAuth } from "../firebaseConfig";
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp,
    runTransaction,
    addDoc,
    collection
} from "firebase/firestore";
import { GameConfig, GameResult } from "../types";

const COLLECTION_NAME = "games";
const GAME_ID = "default";

export interface GameState {
    config: GameConfig;
    deck: GameResult[];
    updatedAt: any;
}

export const GameService = {
    // --- Admin Functions ---

    /**
     * Save the current deck and configuration to Firestore.
     * This overwrites the existing game data.
     */
    async saveGameToCloud(config: GameConfig, deck: GameResult[]) {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);
        const data = {
            config: {
                ...config,
                lastResetAt: Date.now()
            },
            deck,
            updatedAt: serverTimestamp()
        };
        await setDoc(gameRef, data);
        return true;
    },

    /**
     * Save a snapshot of the game to a unique document in the 'cards' collection.
     * Returns the generated Document ID for sharing.
     */
    async saveCard(config: GameConfig, deck: GameResult[]): Promise<string> {
        const colRef = collection(db, "cards");
        const docRef = await addDoc(colRef, {
            config,
            deck,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    },

    /**
     * Retrieve a saved card snapshot by its Document ID.
     */
    async getCard(id: string): Promise<GameState | null> {
        const docRef = doc(db, "cards", id);
        const snap = await getDoc(docRef);
        return snap.exists() ? (snap.data() as GameState) : null;
    },

    // --- Player Functions ---

    /**
     * Subscribe to the game state.
     * Triggered whenever the game is updated (new deck published).
     */
    subscribeToGame(callback: (data: GameState | null) => void) {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);
        return onSnapshot(gameRef, (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data() as GameState);
            } else {
                callback(null);
            }
        });
    },

    /**
     * Attempt to lock a card for scratching.
     * Anti-cheat: if the user already has a 'scratching' card, reject.
     * Only cards with status === 'available' can be locked.
     */
    async lockCard(cardId: number): Promise<boolean> {
        const userId = await ensureAuth();
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameRef);
                if (!gameDoc.exists()) throw "Game does not exist";

                const data = gameDoc.data() as GameState;
                const deck = data.deck;

                const newDeck = [...deck];

                // Anti-cheat: check if user already has a scratching card
                const existingIdx = newDeck.findIndex(c => c.status === 'scratching' && c.lockedBy === userId);
                if (existingIdx !== -1) {
                    const existing = newDeck[existingIdx];
                    // Logic optimization: if the current card is actually "finished" (>90% or 100%),
                    // we allow them to pick a new one by auto-completing the old one right here.
                    if (existing.progress >= 90) {
                        newDeck[existingIdx] = {
                            ...existing,
                            status: 'completed',
                            isPlayed: true,
                            isRevealed: true,
                            progress: 100,
                            lockedBy: undefined,
                            lockedAt: undefined
                        };
                        // Now proceed to lock the new card
                    } else {
                        throw "User already has an active card";
                    }
                }

                const cardIndex = newDeck.findIndex(c => c.id === cardId);
                if (cardIndex === -1) throw "Card not found";

                const card = newDeck[cardIndex];

                // Only available cards can be locked
                if (card.status !== 'available') {
                    throw "Card is not available";
                }

                newDeck[cardIndex] = {
                    ...card,
                    status: 'scratching',
                    lockedBy: userId,
                    lockedAt: Date.now(),
                    progress: 0 // Reset progress for new scratch
                };

                transaction.update(gameRef, { deck: newDeck });
            });
            return true;
        } catch (e) {
            console.error("Lock failed:", e);
            return false;
        }
    },

    /**
     * Update scratch progress for a card.
     * Only the user who locked the card can update it.
     */
    async updateCardProgress(cardId: number, progress: number) {
        const userId = await ensureAuth();
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw "Game does not exist";

            const data = gameDoc.data() as GameState;
            const deck = data.deck;
            const cardIndex = deck.findIndex(c => c.id === cardId);

            if (cardIndex === -1) throw "Card not found";

            const card = deck[cardIndex];
            if (card.lockedBy !== userId) throw "Not your card";
            if (card.status !== 'scratching') throw "Card is not being scratched";

            const newDeck = [...deck];
            newDeck[cardIndex] = {
                ...newDeck[cardIndex],
                progress: Math.min(100, Math.max(0, progress))
            };

            transaction.update(gameRef, { deck: newDeck });
        });
    },

    /**
     * Mark a card as completed. Sets status to 'completed',
     * isPlayed to true, clears lock.
     */
    async completeCard(cardId: number) {
        const userId = await ensureAuth();
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw "Game does not exist";

            const data = gameDoc.data() as GameState;
            const deck = data.deck;
            const cardIndex = deck.findIndex(c => c.id === cardId);

            if (cardIndex === -1) throw "Card not found";

            const card = deck[cardIndex];
            if (card.lockedBy !== userId) throw "Not your card";

            const newDeck = [...deck];
            newDeck[cardIndex] = {
                ...newDeck[cardIndex],
                status: 'completed',
                isPlayed: true,
                isRevealed: true,
                progress: 100,
                lockedBy: undefined,
                lockedAt: undefined
            };

            transaction.update(gameRef, { deck: newDeck });
        });
    },

    /**
     * Force complete cards that have been stale (scratching) for over 1 minute.
     * This is used by active clients to "crowdsource" the cleanup since
     * we are not using Cloud Functions.
     */
    async forceCompleteStaleCards(staleCardIds: number[]) {
        if (staleCardIds.length === 0) return;
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) return;

            const data = gameDoc.data() as GameState;
            const deck = [...data.deck];
            let changed = false;

            staleCardIds.forEach(id => {
                const idx = deck.findIndex(c => c.id === id);
                if (idx !== -1 && deck[idx].status === 'scratching') {
                    // Double check stale condition inside transaction
                    const card = deck[idx];
                    const now = Date.now();
                    // If lockedAt is missing, or it's over 45s, mark as completed
                    const isStale = !card.lockedAt || (now - card.lockedAt) > 45000;

                    if (isStale) {
                        deck[idx] = {
                            ...card,
                            status: 'completed',
                            isPlayed: true,
                            isRevealed: true,
                            progress: 100,
                            lockedBy: undefined,
                            lockedAt: undefined
                        };
                        changed = true;
                    }
                }
            });

            if (changed) {
                transaction.update(gameRef, { deck });
            }
        });
    },

    /**
     * Legacy: Update a card's state (e.g., mark as played).
     * Kept for backward compat during migration.
     */
    async updateCardState(cardId: number, partialData: Partial<GameResult>) {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw "Game does not exist";

            const data = gameDoc.data() as GameState;
            const deck = data.deck;
            const cardIndex = deck.findIndex(c => c.id === cardId);

            if (cardIndex === -1) throw "Card not found";

            const newDeck = [...deck];
            newDeck[cardIndex] = {
                ...newDeck[cardIndex],
                ...partialData
            };

            transaction.update(gameRef, { deck: newDeck });
        });
    },

    /**
     * Admin only: Reset all scratching cards back to available.
     */
    async resetAllLocks() {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) throw "Game does not exist";

            const data = gameDoc.data() as GameState;
            const deck = [...data.deck];
            let changed = false;

            deck.forEach((card, idx) => {
                if (card.status === 'scratching') {
                    deck[idx] = {
                        ...card,
                        status: 'available',
                        lockedBy: undefined,
                        lockedAt: undefined,
                        progress: 0
                    };
                    changed = true;
                }
            });

            if (changed) {
                transaction.update(gameRef, { deck });
            }
        });
    }
};
