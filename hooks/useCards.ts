import { useState, useEffect } from 'react';
import { GameService, GameState } from '../services/gameService';
import { GameConfig, GameResult, CardStatus } from '../types';

/**
 * Backward compat: derive `status` from legacy `isPlayed` field
 * for cards stored before the refactor.
 */
function migrateCard(card: GameResult): GameResult {
    if (!card.status) {
        return {
            ...card,
            status: card.isPlayed ? 'completed' : 'available' as CardStatus,
            progress: card.isPlayed ? 100 : 0,
        };
    }
    return card;
}

export function useCards(snapshotId?: string | null) {
    const [cards, setCards] = useState<GameResult[]>([]);
    const [config, setConfig] = useState<GameConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Snapshot mode: one-time fetch
        if (snapshotId) {
            GameService.getCard(snapshotId)
                .then((data) => {
                    if (data) {
                        setConfig(data.config);
                        setCards(data.deck.map(migrateCard));
                    } else {
                        setError('找不到該分享卡片。');
                    }
                })
                .catch((err) => {
                    console.error(err);
                    setError('載入分享資料失敗。');
                })
                .finally(() => setLoading(false));
            return;
        }

        // Live mode: subscribe to default game
        console.log('useCards: Initializing LIVE subscription...');
        const unsub = GameService.subscribeToGame((data: GameState | null) => {
            if (data && data.config && Array.isArray(data.deck)) {
                const now = Date.now();
                const migratedDeck = data.deck.map(migrateCard);

                // Debug log to see if data is actually arriving
                const completedCount = migratedDeck.filter(c => c.status === 'completed').length;
                console.log(`[Sync] Received snapshot. Completed: ${completedCount}/${migratedDeck.length}`);

                setConfig(data.config);
                setCards(migratedDeck);

                // --- Crowdsourced Cleanup ---
                const staleIds = migratedDeck
                    .filter(c => c.status === 'scratching' && (!c.lockedAt || (now - c.lockedAt) > 45000))
                    .map(c => c.id);

                if (staleIds.length > 0) {
                    GameService.forceCompleteStaleCards(staleIds).catch(console.error);
                }
            } else {
                console.warn('useCards: Received empty or invalid data from Firestore.');
                setCards([]);
                setConfig(null);
            }
            setLoading(false);
        });

        return unsub;
    }, [snapshotId]);

    return { cards, config, loading, error, setCards, setConfig };
}
