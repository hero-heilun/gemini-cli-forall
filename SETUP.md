# Gemini CLI Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up OAuth credentials:**
   Copy `.env.example` to `.env` and add OAuth credentials:
   ```bash
   cp .env.example .env
   ```

3. **Get OAuth Credentials:**
   - For testing: Use the same credentials as the original Google Gemini CLI
   - For production: Create your own at [Google Cloud Console](https://console.cloud.google.com/)

4. **Run the application:**
   ```bash
   npm start
   ```

## OAuth Credentials for Testing

The original Google Gemini CLI uses public OAuth credentials that are safe for installed applications.
You can find these in the original repository or create your own following Google's guidelines.

According to Google's OAuth2 documentation, client secrets for installed applications are not treated as confidential:
- https://developers.google.com/identity/protocols/oauth2#installed
- https://tools.ietf.org/html/rfc8252#section-8.4

## Development

- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`