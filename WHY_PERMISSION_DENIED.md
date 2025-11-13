# Why "Permission Denied" Error Appeared

## The Root Cause

The error appeared because **Firestore security rules were added to the repository but never deployed to Firebase**.

## Timeline

1. **Commit `dc05d6a`** (Security improvements)
   - Security rules were added to `firestore.rules` file
   - Rules had a bug: tried to validate `request.resource.data` on READ operations
   - Rules were **never deployed** to Firebase (see `SECURITY_AND_PERFORMANCE_IMPROVEMENTS.md` line 199-207)

2. **Why it worked before:**
   - Firebase was likely in **test mode** with temporary rules like:
     ```javascript
     allow read, write: if request.time < timestamp.date(2024, 12, 31);
     ```
   - Test mode allows all operations until the expiration date
   - When test mode expired, Firebase reverted to default rules (deny all)

3. **Commit `ca473d7`** (Our fix)
   - Fixed the bug by separating read and write rules
   - Read operations no longer validate `request.resource.data`
   - Rules are now correct, but **still need to be deployed**

## Why This Is An Issue Now

- Firebase test mode rules expired (or were manually disabled)
- Default Firestore rules are: **deny all access**
- Your app is trying to read data but rules aren't deployed
- Result: `permission-denied` error

## The Solution

Deploy the fixed rules to Firebase:

### Option 1: Firebase Console (Quickest)
1. Go to https://console.firebase.google.com/
2. Select project: `time-tracker-9a56c`
3. Firestore Database → Rules
4. Copy contents of `firestore.rules`
5. Paste and click "Publish"

### Option 2: Firebase CLI
```bash
firebase deploy --only firestore:rules
```

## Key Takeaway

**Rules in the repository are not automatically deployed to Firebase.** You must manually deploy them either through the Firebase Console or Firebase CLI.

## Prevention

Consider setting up:
- CI/CD pipeline to auto-deploy rules on merge to main
- Firebase CLI in your deployment process
- Automated testing of Firestore rules

