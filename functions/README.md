# Dogear Token Exchange Function

Cloud Function for secure OAuth token exchange.

## Setup

### 1. Create a Secret for Client Secret

```bash
# Create the secret in Google Cloud Secret Manager
echo -n "YOUR_CLIENT_SECRET" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-

# Grant the Cloud Function access to the secret
gcloud secrets add-iam-policy-binding GOOGLE_CLIENT_SECRET \
    --role=roles/secretmanager.secretAccessor \
    --member=serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com
```

### 2. Deploy the Function

```bash
cd functions

# Deploy with environment variable for client ID and secret from Secret Manager
gcloud functions deploy exchangeToken \
    --gen2 \
    --runtime=nodejs20 \
    --region=us-central1 \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=GOOGLE_CLIENT_ID=YOUR_CLIENT_ID \
    --set-secrets=GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest
```

### 3. Get the Function URL

After deployment, get the function URL:

```bash
gcloud functions describe exchangeToken --gen2 --region=us-central1 --format='value(serviceConfig.uri)'
```

### 4. Update Frontend Environment

Add the function URL to your `.env`:

```
VITE_TOKEN_ENDPOINT=https://your-function-url/exchangeToken
```

## API Reference

### Exchange Authorization Code

**Request:**
```http
POST /exchangeToken
Content-Type: application/json

{
    "code": "4/0AX4XfWh...",
    "redirect_uri": "http://localhost:5173"
}
```

**Response:**
```json
{
    "access_token": "ya29.a0AfH6SM...",
    "refresh_token": "1//0g...",
    "expires_in": 3599,
    "token_type": "Bearer"
}
```

### Refresh Access Token

**Request:**
```http
POST /exchangeToken
Content-Type: application/json

{
    "refresh_token": "1//0g..."
}
```

**Response:**
```json
{
    "access_token": "ya29.a0AfH6SM...",
    "expires_in": 3599,
    "token_type": "Bearer"
}
```

## Security Notes

- The `client_secret` is stored in Google Cloud Secret Manager, never exposed to clients
- CORS is configured to allow requests from the frontend
- In production, update the `Access-Control-Allow-Origin` header to your specific domain
