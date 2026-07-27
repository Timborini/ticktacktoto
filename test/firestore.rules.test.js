import { readFileSync } from 'node:fs';
import { describe, test, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';

const PROJECT_ID = 'demo-time-tracker';
const APP_ID = 'default-app-id';
const SHARE_ID = 'team-share';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';

let testEnv;

const authedDb = (uid) => testEnv.authenticatedContext(uid).firestore();
const unauthedDb = () => testEnv.unauthenticatedContext().firestore();

const userEntryRef = (uid, entryId) =>
  doc(authedDb(uid), 'artifacts', APP_ID, 'users', uid, 'time_entries', entryId);

const shareRef = (uid, shareId = SHARE_ID) =>
  doc(authedDb(uid), 'artifacts', APP_ID, 'public_shares', shareId);

const shareEntryRef = (uid, entryId, shareId = SHARE_ID) =>
  doc(authedDb(uid), 'artifacts', APP_ID, 'public_data', shareId, 'time_entries', entryId);

const errorReportRef = (uid) =>
  collection(authedDb(uid), 'artifacts', APP_ID, 'error_reports');

const validEntry = (overrides = {}) => ({
  ticketId: 'PROJ-1',
  startTime: Date.now(),
  endTime: null,
  accumulatedMs: 1000,
  note: 'did some work',
  status: 'unsubmitted',
  createdAt: Date.now(),
  createdBy: ALICE,
  ...overrides,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('user time_entries', () => {
  test('unauthenticated users cannot read', async () => {
    await assertFails(getDoc(doc(unauthedDb(), 'artifacts', APP_ID, 'users', ALICE, 'time_entries', 'e1')));
  });

  test('owner can create, read, update and delete their own entries', async () => {
    await assertSucceeds(setDoc(userEntryRef(ALICE, 'e1'), validEntry()));
    await assertSucceeds(getDoc(userEntryRef(ALICE, 'e1')));
    await assertSucceeds(setDoc(userEntryRef(ALICE, 'e1'), validEntry({ note: 'updated' })));
    await assertSucceeds(deleteDoc(userEntryRef(ALICE, 'e1')));
  });

  test('another user cannot read or write someone else\'s entries', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'artifacts', APP_ID, 'users', ALICE, 'time_entries', 'e1'), validEntry());
    });
    await assertFails(getDoc(doc(authedDb(BOB), 'artifacts', APP_ID, 'users', ALICE, 'time_entries', 'e1')));
    await assertFails(setDoc(doc(authedDb(BOB), 'artifacts', APP_ID, 'users', ALICE, 'time_entries', 'e2'), validEntry()));
  });

  test('rejects a note that is too long', async () => {
    await assertFails(setDoc(userEntryRef(ALICE, 'e1'), validEntry({ note: 'x'.repeat(5001) })));
  });

  test('rejects a note containing HTML characters', async () => {
    await assertFails(setDoc(userEntryRef(ALICE, 'e1'), validEntry({ note: '<b>bold</b>' })));
  });

  test('rejects a ticketId containing HTML characters', async () => {
    await assertFails(setDoc(userEntryRef(ALICE, 'e1'), validEntry({ ticketId: '<script>' })));
  });

  test('rejects accumulatedMs beyond the 30-day cap', async () => {
    await assertFails(setDoc(userEntryRef(ALICE, 'e1'), validEntry({ accumulatedMs: 86400000 * 30 })));
  });

  test('rejects an invalid status value', async () => {
    await assertFails(setDoc(userEntryRef(ALICE, 'e1'), validEntry({ status: 'approved' })));
  });
});

describe('public shares', () => {
  const seedShare = () =>
    testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'artifacts', APP_ID, 'public_shares', SHARE_ID), {
        createdBy: ALICE,
        members: [ALICE, BOB],
      });
    });

  test('create requires createdBy == uid and creator membership', async () => {
    await assertSucceeds(setDoc(shareRef(ALICE, 'share-1'), { createdBy: ALICE, members: [ALICE] }));
    await assertFails(setDoc(shareRef(BOB, 'share-2'), { createdBy: ALICE, members: [ALICE, BOB] }));
    await assertFails(setDoc(shareRef(BOB, 'share-3'), { createdBy: BOB, members: [ALICE] }));
  });

  test('members can read share metadata, non-members cannot', async () => {
    await seedShare();
    await assertSucceeds(getDoc(shareRef(BOB)));
    const CAROL = 'carol-uid';
    await assertFails(getDoc(shareRef(CAROL)));
  });

  test('members cannot remove the owner or transfer ownership', async () => {
    await seedShare();
    await assertFails(setDoc(shareRef(BOB), { createdBy: ALICE, members: [BOB] }));
    await assertFails(setDoc(shareRef(BOB), { createdBy: BOB, members: [ALICE, BOB] }));
    await assertSucceeds(setDoc(shareRef(BOB), { createdBy: ALICE, members: [ALICE, BOB, 'carol-uid'] }));
  });

  test('only the owner can delete the share', async () => {
    await seedShare();
    await assertFails(deleteDoc(shareRef(BOB)));
    await assertSucceeds(deleteDoc(shareRef(ALICE)));
  });

  test('share data create requires createdBy == uid', async () => {
    await seedShare();
    await assertSucceeds(setDoc(shareEntryRef(BOB, 'e1'), validEntry({ createdBy: BOB })));
    await assertFails(setDoc(shareEntryRef(BOB, 'e2'), validEntry({ createdBy: ALICE })));
  });

  test('non-members cannot read share data', async () => {
    await seedShare();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'artifacts', APP_ID, 'public_data', SHARE_ID, 'time_entries', 'e1'),
        validEntry()
      );
    });
    await assertFails(getDoc(doc(authedDb('carol-uid'), 'artifacts', APP_ID, 'public_data', SHARE_ID, 'time_entries', 'e1')));
    await assertSucceeds(getDoc(shareEntryRef(ALICE, 'e1')));
  });
});

describe('error_reports', () => {
  const validReport = {
    message: 'Something broke',
    source: 'window.onerror',
    stack: 'Error: Something broke\n  at foo (bar.js:1:1)',
    url: 'http://localhost:5173/',
    userAgent: 'vitest',
    userId: ALICE,
    createdAt: Date.now(),
  };

  test('authenticated users can create valid reports', async () => {
    await assertSucceeds(addDoc(errorReportRef(ALICE), validReport));
  });

  test('reports cannot be read, updated, or deleted', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'artifacts', APP_ID, 'error_reports', 'r1'), validReport);
    });
    await assertFails(getDoc(doc(authedDb(ALICE), 'artifacts', APP_ID, 'error_reports', 'r1')));
    await assertFails(setDoc(doc(authedDb(ALICE), 'artifacts', APP_ID, 'error_reports', 'r1'), validReport));
    await assertFails(deleteDoc(doc(authedDb(ALICE), 'artifacts', APP_ID, 'error_reports', 'r1')));
  });

  test('rejects oversized or spoofed reports', async () => {
    await assertFails(addDoc(errorReportRef(ALICE), { ...validReport, message: 'x'.repeat(2001) }));
    await assertFails(addDoc(errorReportRef(ALICE), { ...validReport, userId: BOB }));
    await assertFails(addDoc(errorReportRef(ALICE), { message: 'missing required fields' }));
  });

  test('unauthenticated users cannot create reports', async () => {
    await assertFails(addDoc(collection(unauthedDb(), 'artifacts', APP_ID, 'error_reports'), validReport));
  });
});

describe('default deny', () => {
  test('arbitrary paths are denied', async () => {
    await assertFails(getDoc(doc(authedDb(ALICE), 'some', 'random', 'path', 'doc')));
    await assertFails(setDoc(doc(authedDb(ALICE), 'artifacts', APP_ID, 'admin', 'config'), { x: 1 }));
  });
});
