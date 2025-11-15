# Google Drive Sync Integration

This document describes how to set up and use the Google Drive sync feature in Goaly.

## Overview

The Google Drive sync integration allows users to:
- Authenticate with their Google account
- Upload their goal data to Google Drive for backup
- Download and restore data from Google Drive across devices
- Handle version conflicts automatically

## Setup

### Prerequisites

1. A Google Cloud Project with the Google Drive API enabled
2. OAuth 2.0 credentials (Client ID) configured
3. An API key for the Google Drive API

### Configuration Steps

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google Drive API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

2.5. **Configure OAuth Consent Screen** (Important!)
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in the required app information:
     - App name: "Goaly" (or your preferred name)
     - User support email: Your email
     - Developer contact information: Your email
   - Click "Save and Continue" through the scopes section (scopes are handled automatically)
   - In the "Test users" section, click "Add users"
   - Add your Google account email (e.g., `fabian.segatz@gmail.com`)
   - Click "Save and Continue"
   - **Note:** While the app is in "Testing" mode, only added test users can authenticate. For production use, you'll need to submit for verification.

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application" as the application type
   - **Important:** Under "Authorized JavaScript origins", add:
     - `http://localhost:8000` (for local development)
     - `http://localhost` (if using a different port)
     - Your production domain (e.g., `https://yourdomain.com`) when deploying
   - **Note:** For Google Identity Services (used by this app), you typically do NOT need to add redirect URIs. Leave the "Authorized redirect URIs" field empty or remove any existing entries if you get redirect_uri_mismatch errors.
   - Copy the **Client ID** (it should look like: `123456789-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com`)

4. **Create API Key**
   - In "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API key"
   - Copy the **API Key**
   - (Optional) Restrict the API key to Google Drive API for security

5. **Configure Goaly**

   You need to provide the API key and Client ID to Goaly. The recommended approach is to use a local configuration file for development:

   **For Local Development:**
   
   1. Copy the example configuration file:
      ```bash
      cp config.local.js.example config.local.js
      ```
   
   2. Edit `config.local.js` and add your credentials:
      ```javascript
      window.GOOGLE_API_KEY = "your-api-key-here";
      window.GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com";
      ```
   
   **Note:** `config.local.js` is in `.gitignore` and will not be committed to version control. The application will automatically load this file if it exists.

   **For Production/CI/CD:**
   
   The credentials are automatically injected during deployment using GitHub Actions secrets:
   
   1. Go to your GitHub repository: Settings > Secrets and variables > Actions
   2. Add the following secrets:
      - `GOOGLE_API_KEY` - Your Google API key
      - `GOOGLE_CLIENT_ID` - Your Google OAuth 2.0 Client ID
   
   The GitHub Actions workflow (`.github/workflows/static.yml`) will automatically inject these credentials into `config.local.js` during deployment to GitHub Pages.

   **Note:** For production, consider using environment-specific configuration or a secure configuration service.

## Usage

### Authentication

1. Open the Settings view in Goaly
2. Scroll to the "Google Drive Sync" section
3. Click "Sign in with Google"
4. Complete the OAuth flow in the popup window
5. Grant the necessary permissions (the app only requests access to files it creates)

### Syncing Data

1. After authentication, the "Sync Now" button will appear
2. Click "Sync Now" to upload your current goal data to Google Drive
3. The app will:
   - Check for conflicts with existing data in Google Drive
   - Prompt you if conflicts are detected
   - Upload your data if no conflicts exist

### Conflict Resolution

The sync feature handles several types of conflicts:

- **Newer Remote Data**: If the data in Google Drive is newer than local data, you'll be prompted to download it
- **Version Mismatch**: If the remote data uses a different version format, you'll be prompted to choose an action
- **Older Version**: If the remote data uses an older version, you can choose to upload your newer local data

### Downloading Data

To restore data from Google Drive:
1. Ensure you're authenticated
2. Click "Sync Now" - if remote data is newer, you'll be prompted to download
3. Alternatively, the app will automatically detect conflicts and offer to download

## Technical Details

### Permissions

The integration uses the minimum required scope:
- `https://www.googleapis.com/auth/drive.file` - Access only to files created by the app

This ensures the app can only access files it creates, not your entire Google Drive.

### Data Storage

- Data is stored in a folder named "Goaly" in the user's Google Drive
- The data file is named `goaly-data.json`
- File ID is stored locally to enable efficient updates

### Token Management

- Access tokens are stored in browser localStorage
- Tokens are automatically refreshed when needed
- Users can sign out to revoke access

### Version Compatibility

The sync feature respects Goaly's versioning system:
- Data files include version information
- Version conflicts are detected and handled
- Older versions are automatically migrated when downloaded

## Troubleshooting

### "Google Drive sync is not configured"

This means the API key and/or Client ID are not set. Check your configuration.

### "Authentication failed" or "redirect_uri_mismatch"

- Ensure your OAuth credentials are correctly configured
- Check that **Authorized JavaScript origins** includes your exact origin:
  - For local development: `http://localhost:8000` (no trailing slash)
  - For production: `https://yourdomain.com` (no trailing slash)
- **Important:** If you see "redirect_uri_mismatch" error:
  1. Go to Google Cloud Console > APIs & Services > Credentials
  2. Click on your OAuth 2.0 Client ID
  3. Under "Authorized redirect URIs", **remove all entries** (Google Identity Services doesn't use redirect URIs)
  4. Make sure "Authorized JavaScript origins" has your origin (e.g., `http://localhost:8000`)
  5. Click "Save"
  6. Wait a few minutes for changes to propagate, then try again
- Verify the Client ID is correct and matches the one in your HTML

### "Access blocked" or "access_denied" (Error 403)

This error means the app is in "Testing" mode and your email is not added as a test user. To fix:

1. Go to Google Cloud Console > APIs & Services > OAuth consent screen
2. Scroll down to the "Test users" section
3. Click "Add users"
4. Enter your Google account email address (the one you're trying to sign in with)
5. Click "Add"
6. Wait a few minutes for changes to propagate
7. Try signing in again

**Note:** While in Testing mode, only users explicitly added as test users can authenticate. For production use with multiple users, you'll need to submit your app for Google verification (required for sensitive scopes like Google Drive).

### "Upload/Download failed"

- Check your internet connection
- Ensure you're still authenticated (tokens may have expired)
- Try signing out and signing back in

### Sync conflicts not resolving

- Check the version of your local and remote data
- Consider manually exporting/importing data if conflicts persist

## Security Considerations

1. **API Key Security**: 
   - Restrict your API key to specific APIs (Google Drive API)
   - Consider using domain restrictions for production

2. **OAuth Credentials**:
   - Keep your Client ID and Client Secret secure
   - Never commit credentials to version control
   - Use environment variables or secure configuration management

3. **Token Storage**:
   - Tokens are stored in browser localStorage
   - Users should sign out on shared devices
   - Consider implementing additional security measures for sensitive deployments

## Future Enhancements

Potential improvements for future versions:
- Automatic periodic sync
- Background sync when data changes
- Multiple sync providers
- Sync history and conflict resolution UI
- Selective sync (sync only specific goals)

## Support

For issues or questions:
- Check the [GitHub Issues](https://github.com/fsegatz/goaly/issues)
- Review the main [README.md](../README.md) for general setup
- Consult the [Developer Guide](../developer-guide.md) for technical details

