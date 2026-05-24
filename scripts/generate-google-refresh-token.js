const { google } = require('googleapis');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('================================================================');
  console.log('  Google OAuth2 Refresh Token Generator Utility for LMS Platform');
  console.log('================================================================\n');
  console.log('This script will help you generate a Google OAuth2 refresh token');
  console.log('using a Google Cloud Console Desktop Application client credential.\n');

  // Load .env if it exists in the root directory to populate defaults
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    });
  }

  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    clientId = await question('👉 Enter your GOOGLE_CLIENT_ID: ');
  } else {
    console.log(`Using GOOGLE_CLIENT_ID from environment: ${clientId.slice(0, 12)}...`);
  }

  if (!clientSecret) {
    clientSecret = await question('👉 Enter your GOOGLE_CLIENT_SECRET: ');
  } else {
    console.log(`Using GOOGLE_CLIENT_SECRET from environment: [REDACTED]`);
  }

  clientId = clientId.trim();
  clientSecret = clientSecret.trim();

  if (!clientId || !clientSecret) {
    console.error('❌ Error: Both Client ID and Client Secret are required.');
    rl.close();
    return;
  }

  // Desktop App Client uses http://localhost as redirect URI or special custom port.
  // The googleapis library handles http://localhost beautifully for Desktop App credentials.
  const REDIRECT_URI = 'http://localhost';

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  // Generate auth URL
  // We request 'https://www.googleapis.com/auth/drive' scope to allow full write access
  // to target folders created manually by the user (as discussed in architectural notes).
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Crucial to request offline access to obtain a refresh_token
    prompt: 'consent',     // Force the consent screen to ensure a refresh_token is returned
    scope: ['https://www.googleapis.com/auth/drive']
  });

  console.log('\n----------------------------------------------------------------');
  console.log('1. Open this URL in your web browser to authorize the app:');
  console.log('----------------------------------------------------------------');
  console.log(authUrl);
  console.log('----------------------------------------------------------------');
  console.log('\n2. Log in, click "Advanced" -> "Go to ... (unsafe)" if a safety warning appears.');
  console.log('3. Complete authorization and grant permissions.');
  console.log('4. The browser will redirect to a page that may fail to load (e.g. localhost connection refused).');
  console.log('5. Copy the FULL URL of the page you were redirected to (or copy the "code" query parameter value).\n');

  let codeOrUrl = await question('👉 Paste the redirected URL or Code here: ');
  codeOrUrl = codeOrUrl.trim();

  if (!codeOrUrl) {
    console.error('❌ Error: Input cannot be empty.');
    rl.close();
    return;
  }

  let code = codeOrUrl;
  // If user pasted the full URL, extract the "code" parameter automatically
  if (codeOrUrl.startsWith('http://') || codeOrUrl.startsWith('https://')) {
    try {
      const urlObj = new URL(codeOrUrl);
      const extractedCode = urlObj.searchParams.get('code');
      if (extractedCode) {
        code = extractedCode;
        console.log(`\nParsed authorization code: ${code.slice(0, 10)}...`);
      } else {
        console.log('\nCould not extract code parameter from URL, attempting to use the input as raw code.');
      }
    } catch (e) {
      // Ignore URL parse error and fallback to raw input
    }
  }

  console.log('\nExchanging code for tokens...');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Authorization exchange succeeded!');
    console.log('\n================================================================');
    console.log('  YOUR GOOGLE OAUTH2 REFRESH TOKEN (Save to .env)');
    console.log('================================================================');
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || '⚠️ No refresh token returned. Try removing app access and re-consenting.'}`);
    console.log('================================================================');
    console.log('\nNote: Keep the refresh token secret and do not share it or check it into Git.');

    if (!tokens.refresh_token) {
      console.warn('\n⚠️ WARNING: No refresh token was returned.');
      console.warn('Google only returns a refresh token the first time a user consents.');
      console.warn('To fix this, go to https://myaccount.google.com/connections, remove permissions for your app, and run this script again.');
    }
  } catch (err) {
    console.error('❌ Error exchanging authorization code:', err.message);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
