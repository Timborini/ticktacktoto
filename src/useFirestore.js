import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, onSnapshot,
  doc, updateDoc, deleteDoc, addDoc, where, getDocs, writeBatch, getFirestore
} from 'firebase/firestore';

const appId = 'default-app-id'; 

/**
 * Custom hook to manage all Firestore interactions and related state.
 * @param {object} db - The Firestore database instance.
 * @param {string} userId - The authenticated user's ID.
 * @param {string|null} shareId - An optional ID for accessing shared data.
 * @returns {object} - State and functions for interacting with Firestore.
 */
export const useFirestore = (db, userId, shareId) => {
    const [logs, setLogs] = useState([]);
    const [ticketStatuses, setTicketStatuses] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [firebaseError, setFirebaseError] = useState(null);
    
    // State derived from Firestore data
    const [activeLogData, setActiveLogData] = useState(null); 
    const [isTimerRunning, setIsTimerRunning] = useState(false); 
    const [isTimerPaused, setIsTimerPaused] = useState(false); 
    const [runningLogDocId, setRunningLogDocId] = useState(null);

    // --- Firestore Data Path Helpers ---
    const getCollectionRef = useMemo(() => {
      if (db && userId) {
        if (shareId) {
          return collection(db, 'artifacts', appId, 'public/data', shareId, 'time_entries');
        }
        return collection(db, 'artifacts', appId, 'users', userId, 'time_entries');
      }
      return null;
    }, [db, userId, shareId]);
    
    const getTicketStatusCollectionRef = useMemo(() => {
      if (db && userId) {
        if (shareId) {
          return collection(db, 'artifacts', appId, 'public/data', shareId, 'ticket_statuses');
        }
        return collection(db, 'artifacts', appId, 'users', userId, 'ticket_statuses');
      }
      return null;
    }, [db, userId, shareId]);

    // --- Real-time Listeners ---
    useEffect(() => {
      if (!getTicketStatusCollectionRef) return;
      const q = query(getTicketStatusCollectionRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const statuses = {};
          snapshot.docs.forEach((doc) => {
              const data = doc.data();
              if (data.ticketId) {
                  statuses[data.ticketId] = { id: doc.id, isClosed: data.isClosed || false };
              }
          });
          setTicketStatuses(statuses);
      }, (error) => {
          console.error('Firestore ticket status snapshot error:', error);
          setFirebaseError('Failed to load ticket statuses.');
      });
      return () => unsubscribe();
    }, [getTicketStatusCollectionRef]);
  
    useEffect(() => {
      if (!getCollectionRef) {
        setIsLoading(!!userId);
        return;
      }
      
      setIsLoading(true);
      const q = query(getCollectionRef);
  
      const unsubscribe = onSnapshot(q, (snapshot) => {
        let fetchedLogs = [];
        let currentActiveLog = null;
  
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const log = {
            id: doc.id,
            ticketId: data.ticketId || 'No Ticket ID',
            startTime: data.startTime || null, 
            endTime: data.endTime || null, 
            accumulatedMs: data.accumulatedMs || 0,
            note: data.note || '',
            status: data.status || 'unsubmitted'
          };
  
          if (log.endTime === null) {
            currentActiveLog = log;
          } else {
            fetchedLogs.push(log);
          }
        });
  
        setLogs(fetchedLogs);
  
        if (currentActiveLog) {
          setRunningLogDocId(currentActiveLog.id);
          setActiveLogData(currentActiveLog); 
          setIsTimerRunning(!!currentActiveLog.startTime);
          setIsTimerPaused(!currentActiveLog.startTime);
        } else {
          setRunningLogDocId(null);
          setActiveLogData(null); 
          setIsTimerRunning(false);
          setIsTimerPaused(false);
        }
  
        setIsLoading(false);
      }, (error) => {
        console.error('Firestore snapshot error:', error);
        setFirebaseError('Failed to load real-time data.');
        setIsLoading(false);
      });
  
      return () => unsubscribe();
    }, [getCollectionRef, userId]);

    // --- Action Functions ---
    const pauseTimer = useCallback(async (currentNote) => {
      if (!runningLogDocId || !isTimerRunning || !getCollectionRef || !activeLogData) return;
  
      setIsLoading(true);
      const stopTime = Date.now();
      const currentRunDuration = stopTime - activeLogData.startTime; 
      const newAccumulatedMs = activeLogData.accumulatedMs + Math.max(0, currentRunDuration); 
  
      try {
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          startTime: null,
          accumulatedMs: newAccumulatedMs,
          note: currentNote.trim(),
        });
      } catch (error) {
        console.error('Error pausing timer:', error);
        setFirebaseError('Failed to pause timer.');
      } finally {
        setIsLoading(false);
      }
    }, [runningLogDocId, isTimerRunning, getCollectionRef, activeLogData]);
  
    const stopTimer = useCallback(async (currentNote, isAutoOverride = false) => {
      if (!runningLogDocId || !getCollectionRef || !activeLogData) return;
  
      setIsLoading(true);
      const finalStopTime = Date.now();
      let finalAccumulatedMs = activeLogData.accumulatedMs; 
  
      if (isTimerRunning) {
          const currentRunDuration = finalStopTime - activeLogData.startTime;
          finalAccumulatedMs += Math.max(1000, currentRunDuration); 
      } else if (isTimerPaused) {
          finalAccumulatedMs = activeLogData.accumulatedMs;
          if (finalAccumulatedMs < 1000) finalAccumulatedMs = 1000;
      }
  
      try {
        await updateDoc(doc(getCollectionRef, runningLogDocId), {
          endTime: finalStopTime,
          startTime: null,
          accumulatedMs: finalAccumulatedMs,
          note: currentNote.trim(),
          status: 'unsubmitted'
        });
      } catch (error) {
        console.error('Error stopping timer:', error);
        setFirebaseError('Failed to stop timer.');
      } finally {
        setIsLoading(false);
      }
    }, [runningLogDocId, getCollectionRef, isTimerRunning, isTimerPaused, activeLogData]);
  
    const startNewSession = useCallback(async (ticketId, note = '') => {
      if(!getCollectionRef) return;
      setIsLoading(true);
      const startTimestamp = Date.now();
      try {
          const newEntry = {
              ticketId: ticketId.trim(),
              startTime: startTimestamp,
              endTime: null,
              accumulatedMs: 0,
              note: note.trim(),
              status: 'unsubmitted'
          };
          await addDoc(getCollectionRef, newEntry);
      } catch (error) {
          console.error('Error starting new timer:', error);
          setFirebaseError('Failed to start new timer.');
      } finally {
          setIsLoading(false);
      }
    }, [getCollectionRef]);
  
    const startOrResumeTimer = useCallback(async (currentTicketId, currentNote) => {
      if (!getCollectionRef || currentTicketId.trim() === '') return;
      if (isTimerRunning) return;
  
      setIsLoading(true);
      const startTimestamp = Date.now();
  
      try {
        if (isTimerPaused) {
          if (!runningLogDocId) throw new Error("Paused log ID missing.");
          await updateDoc(doc(getCollectionRef, runningLogDocId), {
            startTime: startTimestamp,
            note: currentNote.trim(),
          });
        } else {
          await startNewSession(currentTicketId, currentNote);
        }
      } catch (error) {
        console.error('Error starting/resuming timer:', error);
        setFirebaseError(`Failed to ${isTimerPaused ? 'resume' : 'start'} timer.`);
      } finally {
        setIsLoading(false);
      }
    }, [getCollectionRef, isTimerRunning, isTimerPaused, runningLogDocId, startNewSession]);
    
    const handleCloseTicket = useCallback(async (ticketId) => {
      if (!getTicketStatusCollectionRef || isLoading) return;
      setIsLoading(true);
      const statusEntry = ticketStatuses[ticketId];
      try {
          if (statusEntry && statusEntry.id) {
              await updateDoc(doc(getTicketStatusCollectionRef, statusEntry.id), { isClosed: true });
          } else {
              await addDoc(getTicketStatusCollectionRef, { ticketId: ticketId, isClosed: true });
          }
      } catch (error) {
          console.error('Error closing ticket:', error);
          setFirebaseError(`Failed to close ticket ${ticketId}.`);
      } finally {
          setIsLoading(false);
      }
    }, [getTicketStatusCollectionRef, isLoading, ticketStatuses]);
    
    const handleReopenTicket = useCallback(async (ticketId) => {
      if (!getTicketStatusCollectionRef || isLoading) return;
      setIsLoading(true);
      const statusEntry = ticketStatuses[ticketId];
      try {
          if (statusEntry && statusEntry.id) {
              await updateDoc(doc(getTicketStatusCollectionRef, statusEntry.id), { isClosed: false });
          }
      } catch (error) {
          console.error('Error reopening ticket:', error);
          setFirebaseError(`Failed to reopen ticket ${ticketId}.`);
      } finally {
          setIsLoading(false);
      }
    }, [getTicketStatusCollectionRef, isLoading, ticketStatuses]);
  
    const handleConfirmDelete = useCallback(async (logToDelete) => {
      if (!logToDelete || !getCollectionRef) return;
      setIsLoading(true);
      try {
          await deleteDoc(doc(getCollectionRef, logToDelete.id));
      } catch (error) {
          console.error('Error deleting log:', error);
          setFirebaseError('Failed to delete log entry.');
      } finally {
          setIsLoading(false);
      }
    }, [getCollectionRef]);
    
    const handleReallocateSession = useCallback(async (sessionId, newTicketId) => {
      if (!sessionId || !newTicketId || !getCollectionRef) return;
      setIsLoading(true);
      try {
          const sessionRef = doc(getCollectionRef, sessionId);
          await updateDoc(sessionRef, { ticketId: newTicketId });
      } catch (error) {
          console.error("Error reallocating session:", error);
          setFirebaseError("Failed to reallocate session.");
      } finally {
          setIsLoading(false);
      }
    }, [getCollectionRef]);
  
    const handleUpdateTicketId = useCallback(async (oldTicketId, newTicketId) => {
      if (!newTicketId || oldTicketId === newTicketId || !getCollectionRef || !getTicketStatusCollectionRef || !db) return;
      setIsLoading(true);
      const batch = writeBatch(db);
      try {
        const sessionsQuery = query(getCollectionRef, where("ticketId", "==", oldTicketId));
        const sessionSnapshots = await getDocs(sessionsQuery);
        sessionSnapshots.forEach((doc) => {
          batch.update(doc.ref, { ticketId: newTicketId });
        });
  
        const statusQuery = query(getTicketStatusCollectionRef, where("ticketId", "==", oldTicketId));
        const statusSnapshots = await getDocs(statusQuery);
        statusSnapshots.forEach((doc) => {
          batch.update(doc.ref, { ticketId: newTicketId });
        });
  
        await batch.commit();
      } catch (error) {
        console.error("Error updating ticket ID:", error);
        setFirebaseError("Failed to update ticket ID.");
      } finally {
        setIsLoading(false);
      }
    }, [getCollectionRef, getTicketStatusCollectionRef, db]);
  
    const handleMarkSessionsSubmitted = useCallback(async (sessionIdsToUpdate) => {
        if (sessionIdsToUpdate.size === 0 || !getCollectionRef || !db) return;
        setIsLoading(true);
        const batch = writeBatch(db);
        try {
            sessionIdsToUpdate.forEach(sessionId => {
                const docRef = doc(getCollectionRef, sessionId);
                batch.update(docRef, { status: 'submitted' });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking sessions as submitted:", error);
            setFirebaseError("Failed to mark sessions as submitted.");
        } finally {
            setIsLoading(false);
        }
    }, [getCollectionRef, db]);
  
    const handleMarkSessionsUnsubmitted = useCallback(async (sessionIdsToUpdate) => {
        if (sessionIdsToUpdate.size === 0 || !getCollectionRef || !db) return;
        setIsLoading(true);
        const batch = writeBatch(db);
        try {
            sessionIdsToUpdate.forEach(sessionId => {
                const docRef = doc(getCollectionRef, sessionId);
                batch.update(docRef, { status: 'unsubmitted' });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error marking sessions as unsubmitted:", error);
            setFirebaseError("Failed to mark sessions as unsubmitted.");
        } finally {
            setIsLoading(false);
        }
    }, [getCollectionRef, db]);

    return {
        logs,
        ticketStatuses,
        isLoading,
        firebaseError,
        activeLogData,
        isTimerRunning,
        isTimerPaused,
        pauseTimer,
        stopTimer,
        startNewSession,
        startOrResumeTimer,
        handleCloseTicket,
        handleReopenTicket,
        handleConfirmDelete,
        handleReallocateSession,
        handleUpdateTicketId,
        handleMarkSessionsSubmitted,
        handleMarkSessionsUnsubmitted,
    };
};

