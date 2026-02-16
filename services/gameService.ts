import { db } from "../firebaseConfig";
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    updateDoc,
    serverTimestamp,
    Timestamp,
    runTransaction,
    addDoc,
    collection
} from "firebase/firestore";
import { GameConfig, CardData } from "../types";

const COLLECTION_NAME = "games";
const GAME_ID = "default";

export interface GameState {
    config: GameConfig;
    deck: CardData[];
    updatedAt: any;
    lockedCards?: number[]; // Array of locked card IDs (for quick lookup if needed, though they are in deck)
}

export const GameService = {
    // --- Admin Functions ---

    /**
     * Save the current deck and configuration to Firestore.
     * This overwrites the existing game data.
     */
    async saveGameToCloud(config: GameConfig, deck: CardData[]) {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        // Convert dates to timestamps if necessary, but here we just store plain data
        const data = {
            config,
            // We store the deck as a sub-collection or a field? 
            // For simplicity and atomic updates, we can store it as a field if it's not too huge (< 1MB).
            // 100 cards is fine as a field.
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
    async saveCard(config: GameConfig, deck: CardData[]): Promise<string> {
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
     * This callback is triggered whenever the game is updated (new deck published).
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
     * Returns true if lock is successful, false otherwise.
     */
    async lockCard(cardId: number, sessionId: string): Promise<boolean> {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        try {
            await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameRef);
                if (!gameDoc.exists()) {
                    throw "Game does not exist";
                }

                const data = gameDoc.data() as GameState;
                const deck = data.deck;
                const cardIndex = deck.findIndex(c => c.id === cardId);

                if (cardIndex === -1) throw "Card not found";

                const card = deck[cardIndex];

                // Check availability
                // 1. If played, reject
                if (card.isPlayed) {
                    throw "Card already played";
                }

                // 2. If locked by someone else
                const now = Date.now();
                const LOCK_TIMEOUT = 2 * 60 * 1000; // 2 minutes

                if (card.lockedBy && card.lockedBy !== sessionId) {
                    // Check if lock expired
                    if (card.lockedAt && (now - card.lockedAt < LOCK_TIMEOUT)) {
                        throw "Card is locked by someone else";
                    }
                }

                // Lock it
                const newDeck = [...deck];
                newDeck[cardIndex] = {
                    ...card,
                    lockedBy: sessionId,
                    lockedAt: now
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
     * Update a card's state (e.g., mark as played).
     * This should be called when scratch is complete.
     */
    async updateCardState(cardId: number, partialData: Partial<CardData>) {
        const gameRef = doc(db, COLLECTION_NAME, GAME_ID);

        // We use transaction to ensure we update the latest array
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
    }
};
