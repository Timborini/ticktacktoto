import { useState, useEffect, useRef, useCallback } from 'react';
import {
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
  getDocs,
  startAfter,
} from 'firebase/firestore';
import {
  LOGS_QUERY_LIMIT,
  RANGED_LOGS_QUERY_LIMIT,
} from '../constants.js';
import { parseLocalDate } from '../utils/helpers.js';
import toast from 'react-hot-toast';

export function toLog(doc) {
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

function buildDateConstraints(dateRangeStart, dateRangeEnd) {
  const constraints = [];
  const startDate = dateRangeStart ? parseLocalDate(dateRangeStart) : null;
  const endDate = dateRangeEnd ? parseLocalDate(dateRangeEnd) : null;
  if (startDate) constraints.push(where('endTime', '>=', startDate.getTime()));
  if (endDate) constraints.push(where('endTime', '<=', endDate.getTime() + (24 * 60 * 60 * 1000 - 1)));
  return constraints;
}

export function useLogs({ getCollectionRef, dateRangeStart, dateRangeEnd }) {
  const [logs, setLogs] = useState([]);
  const [extraLogs, setExtraLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [activeLog, setActiveLog] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const lastVisibleRef = useRef(null);

  const pageLimit = dateRangeStart || dateRangeEnd ? RANGED_LOGS_QUERY_LIMIT : LOGS_QUERY_LIMIT;

  useEffect(() => {
    if (!getCollectionRef) {
      setLogs([]);
      setExtraLogs([]);
      setActiveLog(null);
      setHasMore(false);
      lastVisibleRef.current = null;
      setIsLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    setIsLoading(true);
    setExtraLogs([]);
    lastVisibleRef.current = null;

    const constraints = buildDateConstraints(dateRangeStart, dateRangeEnd);

    let completedLogs = [];
    let activeLogLocal = null;
    let gotCompleted = false;
    let gotActive = false;

    const recompute = () => {
      setLogs(completedLogs);
      setActiveLog(activeLogLocal);
      if (gotCompleted && gotActive) {
        setIsLoading(false);
        setHasLoadedOnce(true);
      }
    };

    const onError = (label) => (error) => {
      if (import.meta.env.DEV) console.error(`Firestore ${label} snapshot error:`, error);
      if (error.code !== 'permission-denied') {
        setFirebaseError(`Failed to load ${label} data. Please refresh the page.`);
      }
    };

    // Completed sessions: bounded. A running/paused session has endTime == null
    // and sorts last in descending order, so it is fetched by a dedicated query
    // below to guarantee it is never pushed out of the limit window.
    const completedQuery = query(
      getCollectionRef,
      ...constraints,
      orderBy('endTime', 'desc'),
      limit(pageLimit)
    );

    const unsubscribeCompleted = onSnapshot(completedQuery, (snapshot) => {
      completedLogs = [];
      snapshot.docs.forEach((doc) => {
        const log = toLog(doc);
        if (log.endTime !== null) completedLogs.push(log);
      });
      // Only track the cursor / has-more before manual pagination starts;
      // afterwards loadMore owns those updates.
      if (lastVisibleRef.current === null) {
        lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
        setHasMore(snapshot.docs.length >= pageLimit);
      }
      gotCompleted = true;
      recompute();
    }, (error) => {
      onError('completed')(error);
      gotCompleted = true;
      recompute();
    });

    const activeQuery = query(getCollectionRef, where('endTime', '==', null));
    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      if (snapshot.docs.length > 1 && import.meta.env.DEV) {
        console.warn(`Found ${snapshot.docs.length} sessions with endTime == null; using the most recent.`);
      }
      const sorted = snapshot.docs.map(toLog).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      activeLogLocal = sorted[0] || null;
      gotActive = true;
      recompute();
    }, (error) => {
      onError('active session')(error);
      gotActive = true;
      recompute();
    });

    return () => {
      unsubscribeCompleted();
      unsubscribeActive();
    };
  }, [getCollectionRef, dateRangeStart, dateRangeEnd, pageLimit]);

  const loadMore = useCallback(async () => {
    if (!getCollectionRef || !lastVisibleRef.current || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const constraints = buildDateConstraints(dateRangeStart, dateRangeEnd);
      const nextPageQuery = query(
        getCollectionRef,
        ...constraints,
        orderBy('endTime', 'desc'),
        startAfter(lastVisibleRef.current),
        limit(pageLimit)
      );
      const snapshot = await getDocs(nextPageQuery);

      if (snapshot.docs.length > 0) {
        lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1];
        const page = snapshot.docs.map(toLog).filter((log) => log.endTime !== null);
        setExtraLogs((prev) => {
          const seen = new Set(prev.map((log) => log.id));
          return [...prev, ...page.filter((log) => !seen.has(log.id))];
        });
      }
      if (snapshot.docs.length < pageLimit) setHasMore(false);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Firestore load-more error:', error);
      if (error.code !== 'permission-denied') {
        toast.error('Failed to load older sessions. Please try again.');
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [getCollectionRef, dateRangeStart, dateRangeEnd, pageLimit, isLoadingMore]);

  // Merge realtime first page with manually paginated older pages, deduped by id
  // (the realtime listener's version wins so fresh edits are reflected).
  const allLogs = (() => {
    const byId = new Map();
    extraLogs.forEach((log) => byId.set(log.id, log));
    logs.forEach((log) => byId.set(log.id, log));
    return Array.from(byId.values());
  })();

  return {
    logs: allLogs,
    isLoading,
    isLoadingMore,
    hasLoadedOnce,
    firebaseError,
    activeLog,
    hasMore,
    loadMore,
    setFirebaseError,
  };
}
