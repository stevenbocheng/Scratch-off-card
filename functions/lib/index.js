"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupStaleLocks = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const COLLECTION_NAME = "games";
const GAME_ID = "default";
const STALE_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute
/**
 * cleanupStaleLocks
 *
 * Runs every 1 minute. Finds cards stuck in 'scratching' status longer than
 * STALE_TIMEOUT_MS and **force-completes** them (NOT reset to available).
 *
 * This is the anti-cheat penalty: abandoning a card = wasting it.
 */
exports.cleanupStaleLocks = (0, scheduler_1.onSchedule)("every 1 minutes", async () => {
    const gameRef = db.collection(COLLECTION_NAME).doc(GAME_ID);
    await db.runTransaction(async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists) {
            console.log("No game document found, skipping.");
            return;
        }
        const data = gameDoc.data();
        const deck = data.deck;
        const now = Date.now();
        let changed = false;
        const newDeck = deck.map((card) => {
            if (card.status === "scratching" &&
                card.lockedAt &&
                now - card.lockedAt > STALE_TIMEOUT_MS) {
                console.log(`Force-completing card ${card.id} (locked by ${card.lockedBy} at ${new Date(card.lockedAt).toISOString()}, stale for ${Math.round((now - card.lockedAt) / 1000)}s)`);
                changed = true;
                return Object.assign(Object.assign({}, card), { status: "completed", isPlayed: true, progress: 100, lockedBy: null, lockedAt: null });
            }
            return card;
        });
        if (changed) {
            transaction.update(gameRef, { deck: newDeck });
            console.log("Stale locks cleaned up.");
        }
        else {
            console.log("No stale locks found.");
        }
    });
});
//# sourceMappingURL=index.js.map