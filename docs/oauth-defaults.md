# OAuth Configuration Guide

This document explains how to configure OAuth credentials for the Gemini CLI application.

## Getting OAuth Credentials

### Option 1: Use Default Credentials (Recommended for Testing)
The original Gemini CLI uses publicly available OAuth credentials for installed applications. 
These are considered safe according to Google's OAuth2 documentation for desktop applications.

To get the default credentials:
1. Check the original Gemini CLI repository
2. Or create your own OAuth application (recommended for production)

### Option 2: Create Your Own OAuth Application
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the required APIs
4. Create OAuth 2.0 credentials for "Desktop Application"
5. Download the credentials

## Setup Instructions

1. Copy `.env.example` to `.env`
2. Set your OAuth credentials in the `.env` file
3. Run the application

## Security Note

For installed applications, OAuth client secrets are not treated as secrets according to Google's documentation:
https://developers.google.com/identity/protocols/oauth2#installed