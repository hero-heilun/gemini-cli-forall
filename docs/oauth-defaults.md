# OAuth Default Configuration

This document contains the default OAuth credentials for the Gemini CLI application.

## Default Credentials

For development and testing purposes, you can use these default OAuth credentials:

- **Client ID**: `681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com`
- **Client Secret**: `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`

## Setup Instructions

1. Copy `.env.example` to `.env`
2. Replace the placeholder values with the default credentials above
3. For production use, create your own OAuth application at [Google Cloud Console](https://console.cloud.google.com/)

## Security Note

These credentials are safe to use for installed applications according to Google's OAuth2 documentation:
https://developers.google.com/identity/protocols/oauth2#installed