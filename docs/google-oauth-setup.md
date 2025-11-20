# Google OAuth Setup for Token Refresh

## Issue: "Sync failed. Need to login again"

If you're experiencing issues with automatic token refresh, check the following in your Google Cloud Console:

## 1. OAuth Consent Screen Status

**Critical:** The OAuth consent screen must be set to **"Production"** mode, not "Testing" mode.

### Why this matters:
- **Testing mode:** Refresh tokens expire after **7 days**
- **Production mode:** Refresh tokens remain valid indefinitely (unless revoked by the user)

### How to check and fix:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **OAuth consent screen**
4. Check the **Publishing status** at the top
5. If it says "Testing", click **"PUBLISH APP"** to move it to Production

**Note:** Moving to Production may require:
- App verification if you're using sensitive scopes
- Privacy policy URL
- Terms of service URL
- Support email

## 2. OAuth Client Configuration

Ensure your OAuth 2.0 Client ID is properly configured:

1. Go to **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Verify:
   - **Application type:** Web application
   - **Authorized JavaScript origins:** Includes your app's domain (e.g., `http://localhost:8000`)
   - **Authorized redirect URIs:** Should include your app's domain

## 3. Token Refresh Behavior

The app now uses `prompt: 'none'` for silent token refresh. This means:
- If the user's session is still valid, tokens will refresh automatically
- If the session has expired, the user will need to sign in again

## 4. Common Issues

### Issue: Tokens expire after 7 days
**Solution:** Move OAuth consent screen to Production mode (see #1 above)

### Issue: "immediate_failed" error
**Cause:** User's Google session has expired or been revoked
**Solution:** User needs to sign in again manually

### Issue: "access_denied" error
**Cause:** User is not added as a test user (if in Testing mode) or app is not verified (if in Production)
**Solution:** 
- If Testing: Add user to test users list
- If Production: Complete app verification process

## 5. Testing Token Refresh

To test if token refresh is working:
1. Sign in to Google Drive sync
2. Wait for the token to expire (typically 1 hour)
3. Trigger a sync operation
4. The token should refresh automatically without requiring re-authentication

If it still fails after moving to Production mode, check the browser console for specific error messages.

