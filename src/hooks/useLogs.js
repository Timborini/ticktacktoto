import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
} from 'firebase/firestore';
import {
  LOGS_QUERY_LIMIT,
  STATUS_FILTERS,
} from '../constants.js';

function toLog(doc) {
  const data = doc.data();
  let submissionDate = null;
  if (data.submissionDate) {
    if (typeof data.submissionDate === 'number') {
      submissionDate = data.submissionDate;
    } else if (data.submissionDate.toDate) {
      submissionDate = data.submissionDate.toDate();
    }
  }
  return {
    id: doc.id,
    ticketId: data.ticketId || 'No Ticket ID',
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    accumulatedMs: data.accumulatedMs || 0,
    note: data.note || '',
    status: data.status || 'unsubmitted',
    submissionDate,
    createdAt: data.createdAt || null,
  };
}

export function useLogs({ db, getCollectionRef, dateRangeStart, dateRangeEnd }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [activeLog, setActiveLog] = useState(null);
  const activeLogRef = useRef(null);

  useEffect(() => {
    activeLogRef.current = activeLog;
  }, [activeLog]);

  const onActiveLogChange = useCallback((callback) => {
    if (activeLogRef.current !== activeLog) {
      callback(activeLog);
    }
  }, [activeLog]);

  useEffect(() => {
    if (!getCollectionRef) return;

    setIsLoading(true);
    const constraints = [];
    try {
      if (dateRangeStart) {
        const startMs = new Date(dateRangeStart).getTime();
        if (!Number.isNaN(startMs)) constraints.push(where('endTime', '>=', startMs));
      }
      if (dateRangeEnd) {
        const endMs = new Date(dateRangeEnd).getTime() + (24 * 60 * 60 * 1000 - 1);
        if (!Number.isNaN(endMs)) constraints.push(where('endTime', '<=', endMs));
      }
    } catch { }

    let unsubscribeSingle = null;
    let unsubscribeRanged = null;
    let unsubscribeActive = null;

    if (constraints.length === 0) {
      const q = query(getCollectionRef, orderBy('endTime', 'desc'), limit(LOGS_QUERY_LIMIT));
      unsubscribeSingle = onSnapshot(q, (snapshot) => {
        let fetchedLogs = [];
        let currentActiveLog = null;

        snapshot.docs.forEach((doc) => {
          const log = toLog(doc);
          if (log.endTime === null) currentActiveLog = log;
          else fetchedLogs.push(log);
        });

        setLogs(fetchedLogs);
        setActiveLog(currentActiveLog);
        setIsLoading(false);
        setHasLoadedOnce(true);
      }, (error) => {
        if (import.meta.env.DEV) console.error('Firestore snapshot error:', error);
        if (error.code !== 'permission-denied') {
          setFirebaseError('Failed to load real-time data. Check console.');
        }
        setIsLoading(false);
        setHasLoadedOnce(true);
      });
    } else {
      let rangedLogs = [];
      let activeLogLocal = null;
      let gotRanged = false;
      let gotActive = false;

      const recompute = () => {
        setLogs(rangedLogs);
        setActiveLog(activeLogLocal);
        if (gotRanged && gotActive) {
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
      };

      const rangedQuery = query(getCollectionRef, ...constraints);
      unsubscribeRanged = onSnapshot(rangedQuery, (snapshot) => {
        rangedLogs = [];
        snapshot.docs.forEach((doc) => {
          const log = toLog(doc);
          if (log.endTime !== null) rangedLogs.push(log);
        });
        gotRanged = true;
        recompute();
      }, (error) => {
        if (import.meta.env.DEV) console.error('Firestore ranged snapshot error:', error);
        setFirebaseError('Failed to load ranged data. Check console.');
        gotRanged = true;
        recompute();
      });

      const activeQuery = query(getCollectionRef, where('endTime', '==', null));
      unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
        const first = snapshot.docs[0];
        activeLogLocal = first ? toLog(first) : null;
        gotActive = true;
        recompute();
      }, (error) => {
        if (import.meta.env.DEV) console.error('Firestore active snapshot error:', error);
        setFirebaseError('Failed to load active session. Check console.');
        gotActive = true;
        recompute();
      });
    }

    return () => {
      if (unsubscribeSingle) unsubscribeSingle();
      if (unsubscribeRanged) unsubscribeRanged();
      if (unsubscribeActive) unsubscribeActive();
    };
  }, [getCollectionRef, dateRangeStart, dateRangeEnd]);

  return {
    logs,
    isLoading,
    hasLoadedOnce,
    firebaseError,
    activeLog,
    setActiveLog,
    setFirebaseError,
  };
}
