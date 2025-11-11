# Google OAuth Setup Checklist

## Current Configuration
- **Callback URL**: `http://localhost:5000/api/auth/google/callback`
- **Client ID**: Set in .env file
- **Client Secret**: Set in .env file

## Steps to Fix 400 Error

### 1. Verify Redirect URI in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, make sure you have EXACTLY:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
   - Must match EXACTLY (including http vs https, port number, path)
   - No trailing slashes
   - Case-sensitive

### 2. Check OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Make sure:
   - App is in **Testing** mode (for development) or **Published** (for production)
   - If in Testing mode, add your email as a **Test user**
   - Scopes include: `profile` and `email`
   - App name and support email are filled

### 3. Verify APIs are Enabled

1. Go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google+ API** (or Google Identity Services)
   - **People API** (recommended)

### 4. Common Issues

- **400 Error**: Usually means redirect URI mismatch
- **403 Error**: OAuth consent screen not configured or app not published
- **Redirect URI mismatch**: Check for typos, http vs https, port numbers

### 5. Test the Configuration

After making changes:
1. Restart your backend server
2. Clear browser cookies for localhost
3. Try logging in again

## Need Help?

Check the server logs when you click "Continue with Google" - it will show the callback URL being used.
