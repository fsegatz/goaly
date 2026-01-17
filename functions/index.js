const functions = require('@google-cloud/functions-framework');

/**
 * Token Exchange Cloud Function
 * 
 * Handles OAuth token exchange and refresh for Goaly.
 * This function securely exchanges authorization codes and refresh tokens
 * with Google's OAuth server, keeping the client_secret secure.
 * 
 * Endpoints:
 * - POST with { code } - Exchange auth code for tokens
 * - POST with { refresh_token } - Refresh an access token
 */

// Configuration from environment/secrets
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// CORS headers for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // In production, restrict to your domain
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

/**
 * Exchange authorization code for access and refresh tokens
 */
async function exchangeCode(code, redirectUri) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    return response.json();
}

/**
 * Refresh an access token using a refresh token
 */
async function refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    return response.json();
}

/**
 * Main Cloud Function entry point
 */
functions.http('exchangeToken', async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders);
        res.status(204).send('');
        return;
    }

    // Set CORS headers for all responses
    res.set(corsHeaders);

    // Only accept POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { code, refresh_token, redirect_uri } = req.body;

        // Validate required environment variables
        if (!CLIENT_ID || !CLIENT_SECRET) {
            console.error('Missing CLIENT_ID or CLIENT_SECRET environment variables');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }

        let result;

        if (code) {
            // Exchange authorization code for tokens
            if (!redirect_uri) {
                res.status(400).json({ error: 'redirect_uri is required when exchanging code' });
                return;
            }
            result = await exchangeCode(code, redirect_uri);
        } else if (refresh_token) {
            // Refresh the access token
            result = await refreshAccessToken(refresh_token);
        } else {
            res.status(400).json({ error: 'Either code or refresh_token is required' });
            return;
        }

        // Check for OAuth errors
        if (result.error) {
            console.error('OAuth error:', result.error, result.error_description);
            res.status(400).json({
                error: result.error,
                error_description: result.error_description
            });
            return;
        }

        // Return tokens to client
        res.status(200).json({
            access_token: result.access_token,
            refresh_token: result.refresh_token, // Only present on initial exchange
            expires_in: result.expires_in,
            token_type: result.token_type
        });

    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
