# Firestore Rules Deployment Guide

This guide explains how to deploy the Firestore security rules to fix the "permission-denied" error.

## Why This Error Occurs

The error "Failed to load real-time data: permission-denied" occurs when:
1. The Firestore security rules haven't been deployed to Firebase
2. Anonymous authentication is not enabled in Firebase Console
3. The rules in Firebase don't match the rules in the `firestore.rules` file

## Solution: Deploy Firestore Rules

### Option 1: Deploy via Firebase Console (Recommended for Quick Fix)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: `time-tracker-9a56c` (or your project ID)

2. **Navigate to Firestore Rules**
   - Click on "Firestore Database" in the left sidebar
   - Click on the "Rules" tab at the top

3. **Copy and Paste Rules**
   - Open the `firestore.rules` file from your project
   - Copy all the contents
   - Paste them into the Firebase Console rules editor

4. **Publish the Rules**
   - Click the "Publish" button
   - Wait for the deployment to complete

### Option 2: Deploy via Firebase CLI (Recommended for CI/CD)

1. **Install Firebase CLI** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase** (if not already initialized)
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Use the existing `firestore.rules` file

4. **Deploy the Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

## Enable Anonymous Authentication

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project

2. **Navigate to Authentication**
   - Click on "Authentication" in the left sidebar
   - Click on "Sign-in method" tab

3. **Enable Anonymous Authentication**
   - Find "Anonymous" in the list of providers
   - Click on it
   - Toggle "Enable" to ON
   - Click "Save"

## Verify the Fix

After deploying the rules and enabling anonymous authentication:

1. **Refresh your application**
   - The error should disappear
   - You should be able to see and create time entries

2. **Check the Browser Console**
   - Open Developer Tools (F12)
   - Look for any error messages
   - You should see successful Firestore connections

## Troubleshooting

### Still Getting Permission Denied?

1. **Verify Rules Are Deployed**
   - Go to Firebase Console → Firestore Database → Rules
   - Verify the rules match the `firestore.rules` file
   - Look for the rule: `allow read: if request.auth != null && request.auth.uid == userId;`

2. **Verify Anonymous Auth is Enabled**
   - Go to Firebase Console → Authentication → Sign-in method
   - Verify "Anonymous" is enabled (green toggle)

3. **Check User Authentication**
   - Open Browser Console
   - Look for log messages showing user authentication
   - Verify you see a User ID in the console

4. **Verify Collection Path**
   - The collection path should be: `artifacts/{appId}/users/{userId}/time_entries`
   - Check the console logs for the actual collection path
   - Ensure it matches the rules pattern

### Rules Not Matching?

If your rules don't match, make sure:
- The `appId` in your `.env` file matches the `appId` used in the collection path
- The rules use the same path structure: `artifacts/{appId}/users/{userId}/time_entries`
- The rules allow read operations for authenticated users with matching userId

## Additional Resources

- [Firebase Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Anonymous Authentication Documentation](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firebase CLI Documentation](https://firebase.google.com/docs/cli)

