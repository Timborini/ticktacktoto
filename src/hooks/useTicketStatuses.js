import { useState, useEffect } from 'react';
import { query, onSnapshot } from 'firebase/firestore';

export function useTicketStatuses({ getTicketStatusCollectionRef }) {
  const [ticketStatuses, setTicketStatuses] = useState({});
  const [firebaseError, setFirebaseError] = useState(null);

  useEffect(() => {
    if (!getTicketStatusCollectionRef) return;

    const q = query(getTicketStatusCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTicketStatuses((prev) => {
        const next = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.ticketId) {
            next[data.ticketId] = { id: doc.id, isClosed: data.isClosed || false };
          }
        });
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (
          prevKeys.length === nextKeys.length &&
          prevKeys.every((k) =>
            prev[k]?.isClosed === next[k]?.isClosed && prev[k]?.id === next[k]?.id
          )
        ) {
          return prev;
        }
        return next;
      });
    }, (error) => {
      if (import.meta.env.DEV) console.error('Firestore ticket status snapshot error:', error);
      if (error.code !== 'permission-denied') {
        setFirebaseError('Failed to load ticket statuses. Check console.');
      }
    });

    return () => unsubscribe();
  }, [getTicketStatusCollectionRef]);

  return { ticketStatuses, setTicketStatuses, firebaseError, setFirebaseError };
}
