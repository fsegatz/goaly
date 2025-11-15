# Goaly MVP - Goal Tracking App

Goaly is a lightweight goal management web application that blends priority scoring with recurring reviews. It helps you focus on the most impactful goals while keeping everything entirely in the browser.

## Quick Start

```bash
# Install dependencies (one-time)
npm install

# (Optional) Set up Google Drive sync for local development
# Copy the example config and add your credentials:
cp config.local.js.example config.local.js
# Edit config.local.js with your Google API credentials

# Launch a static dev server
npx --yes serve -l 8000

# The app is now available at http://localhost:8000
```

You can also host locally with `python -m http.server 8000` or `php -S localhost:8000`.

**Note:** Google Drive sync requires API credentials. See `docs/integrations/google-drive.md` for setup instructions.

## Basic Usage
- Open `http://localhost:8000` in a modern browser.
- Click `+ New goal` to add a goal with motivation, urgency, and optional deadline.
- Adjust goals over time; priority updates instantly based on your inputs.
- Use the Export and Import actions to back up or restore your goals via JSON.

Explore the full documentation in `docs/index.md` for feature details, developer setup, and testing guidance.

