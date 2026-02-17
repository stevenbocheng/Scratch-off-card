import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, ensureAuth } from '../firebaseConfig';

export function useAuth() {
    const [uid, setUid] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Trigger anonymous sign-in
        ensureAuth().catch(console.error);

        const unsub = onAuthStateChanged(auth, (user) => {
            setUid(user?.uid ?? null);
            setLoading(false);
        });
        return unsub;
    }, []);

    return { uid, loading };
}
