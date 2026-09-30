# Firebase & Supabase Setup Tutorial for RouteGuard (2026)

This tutorial provides up-to-date, step-by-step instructions for setting up Firebase and Supabase services for the RouteGuard PWA project, reflecting the latest changes and best practices as of 2026.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Firebase Setup (2026)](#firebase-setup-2026)
3. [Supabase Setup (2026)](#supabase-setup-2026)
4. [Environment Configuration](#environment-configuration)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Prerequisites

Before beginning, ensure you have:
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Google account (for Firebase)
- GitHub or email account (for Supabase)
- Basic understanding of web services and APIs
- RouteGuard project cloned locally

---

## Firebase Setup (2026)

Firebase provides cloud messaging capabilities for RouteGuard's notification system.

### Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter project name: `routeguard-pwa-notifications` (or your preferred name)
4. **IMPORTANT 2026 CHANGE**: Disable Google Analytics if not needed (to simplify setup)
5. Click **"Create project"**
6. Wait for project provisioning (~30 seconds)

### Step 2: Register Your Web App
1. In your Firebase project overview, click the **web icon** (`</>`) to add a web app
2. Enter app nickname: `routeguard-pwa-web`
3. **IMPORTANT 2026 CHANGE**: Leave "Set up Firebase Hosting" unchecked (RouteGuard uses separate hosting)
4. Click **"Register app"**

### Step 3: Get Your Firebase Configuration
1. You'll see a config object similar to this:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
2. **DO NOT CLOSE THIS PAGE** - you'll need these values for your `.env` file
3. Click **"Continue to console"**

### Step 4: Set Up Cloud Messaging (FCM)
1. In the left sidebar, go to **"Project Settings"** (gear icon) → **"Cloud Messaging"**
2. Under **"Web Push certificates"**:
   - Click **"Generate key pair"** if you haven't already
   - Copy the **VAPID key** (you'll need this for `VITE_FIREBASE_VAPID_KEY`)
3. **2026 NOTE**: FCM now uses VAPID keys by default for web push - no additional setup needed

### Step 5: (Optional) Enable Email/Password Authentication
If you plan to use Firebase Auth alongside Supabase Auth (not required for RouteGuard):
1. Go to **"Authentication"** → **"Sign-in method"**
2. Enable **"Email/Password"** provider
3. Configure email templates if desired

---

## Supabase Setup (2026)

Supabase provides the backend database, authentication, storage, and real-time capabilities for RouteGuard.

### Step 1: Create a Supabase Project
1. Go to [Supabase](https://supabase.com/)
2. Click **"New Project"** (you may need to sign in with GitHub or email)
3. Enter project details:
   - Name: `routeguard-pwa` (or your preferred name)
   - Database password: **Generate and save securely** (you'll need this for CLI access)
   - Region: Select closest to your user base (e.g., `us-east-1` for North America)
4. Click **"Create new project"**
5. Wait for project provisioning (~1-2 minutes)

### Step 2: Get Your Project Configuration
1. Once project is ready, go to **Project Settings** (⚙️ icon) → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://your-project-ref.supabase.co`)
   - **anon public key** (starts with `sb_publishable_...`)
   - **service_role key** (for administrative operations - keep secure!)
3. **2026 CHANGE**: Supabase now provides **publishable keys** by default - use these for `VITE_SUPABASE_PUBLISHABLE_KEY`

### Step 3: Enable Required Extensions
Supabase uses PostGIS for geographic queries and pgcrypto for security.

1. Go to **Database** → **Extensions**
2. Search for and enable:
   - `postgis` (for geographic queries and hazard proximity calculations)
   - `pgcrypto` (for cryptographic functions)
3. Click **"Enable"** for each extension

### Step 4: Configure Storage for Hazard Photos
RouteGuard stores hazard photos in Supabase Storage.

1. Go to **Storage** → **New Bucket**
2. Enter:
   - Name: `hazard-photos`
   - Make it **PUBLIC** (so hazard images can be displayed without authentication)
   - Enable **Row Level Security (RLS)** (recommended)
3. Click **"Create bucket"**

### Step 5: Enable Realtime Publication
Supabase Realtime is used for live hazard updates between clients.

1. Go to **Database** → **Replication**
2. Find the **"Publication"** section
3. Ensure these tables are published (they should be by default):
   - `hazards`
   - `agency_advisories`
   - `agency_requests`
   - `user_profiles`
   - `hazard_confirmations`
   - `hazard_comments`
   - `hazard_votes`
   - `notifications`
4. If any are missing, click the three dots (...) → **"Replicate"**

### Step 6: Set Up Email Authentication (Optional)
Supabase handles authentication for RouteGuard.

1. Go to **Authentication** → **Settings**
2. Under **"Email"**:
   - Enable **"Email confirmations"** (recommended)
   - Enable **"Confirmed email required"** (optional but recommended for production)
   - Configure email templates:
     - Confirmation email
     - Password reset email
     - Magic link email (if using)
3. **2026 NOTE**: Supabase now offers improved email delivery rates and templates

---

## Environment Configuration

Now that you have both services configured, let's set up your environment variables.

### Step 1: Create Your `.env` File
Copy the template I provided earlier:
```bash
cp .env.example .env
```

### Step 2: Fill in Your Values
Edit `.env` with your actual configuration:

```env
# Supabase Configuration
# Get these from your Supabase project settings (Settings ▸ API)
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Firebase Configuration (for notifications)
# Get these from your Firebase project settings
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_FIREBASE_VAPID_KEY=your-firebase-vapid-key

# Optional Feature Flags
VITE_USE_ROUTING_WORKER=true  # Enable web worker for routing (if supported)
```

### Step 3: Important Security Notes
1. **NEVER commit your `.env` file** to version control (it's already in `.gitignore`)
2. Use environment variable injection in your hosting platform (Vercel, Netlify, etc.)
3. The `service_role key` should ONLY be used in trusted server environments - NEVER expose it to the frontend
4. Consider using **Secret Managers** or **Vaults** for production deployments

---

## Verification & Testing

Let's verify your configuration works correctly.

### Step 1: Test Supabase Connection
Run this test script to verify your Supabase setup:

```javascript
// test-supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('count')
    .limit(1)
  
  if (error) {
    console.error('❌ Supabase Connection failed:', error)
    return false
  }
  
  console.log('✅ Supabase Connection successful!')
  return true
}

testConnection()
```

Run with: `node test-supabase.js`

### Step 2: Test Firebase Configuration
Run this test to verify Firebase setup:

```javascript
// test-firebase.js
import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

try {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  console.log('✅ Firebase Configuration successful!');
  console.log('   App name:', app.name);
  console.log('   Messaging initialized:', !!messaging);
} catch (error) {
  console.error('❌ Firebase Configuration failed:', error);
}
```

Run with: `node test-firebase.js`

### Step 3: Test RouteGuard Build
Finally, test that your RouteGuard project builds correctly with the new configuration:

```bash
npm run build
```

If successful, you should see:
```
✓ built in X.Xs
```

---

## Troubleshooting Common Issues

### Firebase Issues

**Problem**: "Firebase: Error (FirebaseError: Firebase: Need to provide options, when not being deployed to hosting via source."**
- **Solution**: Ensure all `VITE_FIREBASE_*` variables are correctly set in your `.env` file
- **Solution**: Check for typos in variable names (case-sensitive)

**Problem**: "Failed to initialize Firebase Messaging"**
- **Solution**: Verify `VITE_FIREBASE_VAPID_KEY` is correctly set
- **Solution**: Ensure you're using Firebase SDK v9+ (modular syntax) - RouteGuard uses this

**Problem**: Notification permissions not working**
- **Solution**: Check browser settings allow notifications for localhost
- **Solution**: Ensure you're calling `requestFCMPermission()` after user interaction (not on page load)

### Supabase Issues

**Problem**: "Invalid supabaseUrl: must be a valid URL"**
- **Solution**: Ensure `VITE_SUPABASE_URL` includes `https://` prefix
- **Solution**: Check for trailing spaces in your `.env` file

**Problem**: "PostGIS extension not enabled"**
- **Solution**: Go to Supabase Dashboard → Database → Extensions and enable `postgis`
- **Solution**: Run `CREATE EXTENSION IF NOT EXISTS postgis;` in SQL editor

**Problem**: "Storage bucket not found"**
- **Solution**: Verify you created the `hazard-photos` bucket in Supabase Storage
- **Solution**: Check bucket is set to PUBLIC (for direct image access)
- **Solution**: Verify RLS policies allow public read access

**Problem**: Realtime updates not working**
- **Solution**: Check Supabase Dashboard → Database → Replication to ensure tables are published
- **Solution**: Verify network allows WebSocket connections (ports 443, 80)
- **Solution**: Check browser console for WebSocket connection errors

### Build Issues

**Problem**: "Cannot find module '@supabase/supabase-js'" or similar**
- **Solution**: Run `npm install` to ensure dependencies are installed
- **Solution**: Check `package.json` for correct dependency versions

**Problem**: "Unused CSS selector warnings"**
- **Solution**: These are warnings, not errors - they don't prevent building
- **Solution**: To fix: review and remove unused selectors in your CSS files
- **Solution**: Refer to `DEBUG_CSS.md` in your docs folder for guidance

---

## 2026-Specific Considerations

### Firebase Updates (2026)
1. **Modular SDK Required**: RouteGuard uses Firebase v9+ modular syntax - ensure you're not trying to use older namespaced imports
2. **VAPID Keys Standard**: FCM now requires VAPID keys for web push by default
3. **Improved Error Handling**: Firebase SDK v9+ provides better error messages - pay attention to console warnings
4. **Analytics Optional**: Google Analytics is now truly optional and doesn't affect core functionality

### Supabase Updates (2026)
1. **Publishable Keys Default**: Supabase now provides publishable keys by default for client-side usage
2. **Enhanced PostGIS**: Improved performance for geographic queries with better indexing
3. **RLS Policy Improvements**: More intuitive policy creation UI in dashboard
4. **Realtime Updates**: More efficient change propagation with lower latency
5. **Improved Storage**: Better CDN integration and faster image delivery

### RouteGuard Specific (2026)
1. **Web Worker Flag**: `VITE_USE_ROUTING_WORKER` enables/disables routing calculations in web workers
2. **Environment Validation**: Built-in checks for missing environment variables during startup
3. **Graceful Degradation**: App functions with limited features if Firebase/Supabase misconfigured
4. **Improved Error Reporting**: Better error messages when services are unreachable

---

## Deployment Considerations

When deploying to production:

### Vercel/Netlify/Cloudflare Pages
1. Add environment variables in your platform's dashboard
2. Use the exact same variable names as in your `.env.example`
3. **Do NOT** include the `.env` file in your repository
4. Trigger a redeploy after adding environment variables

### Docker/Self-Hosted
1. Pass environment variables when running your container:
   ```bash
   docker run -p 3000:3000 --env-file .env.production routeguard-pwa
   ```
2. Or use Kubernetes secrets/ConfigMaps for production deployments

### Environment-Specific Files
Consider creating:
- `.env.development` for local development
- `.env.staging` for staging environment  
- `.env.production` for production
- Update your build scripts to use the appropriate file

---

## Final Checklist

Before considering your setup complete:

### Firebase
- [ ] Project created in Firebase Console
- [ ] Web app registered
- [ ] Configuration values copied to `.env`
- [ ] VAPID key generated and copied
- [ ] (Optional) Email/Password auth configured if needed
- [ ] Firebase connection test passes

### Supabase
- [ ] Project created in Supabase
- [ ] Project URL and keys copied to `.env`
- [ ] PostGIS and pgcrypto extensions enabled
- [ ] `hazard-photos` storage bucket created and set to PUBLIC
- [ ] Realtime publication enabled for all required tables
- [ ] (Optional) Email authentication configured
- [ ] Supabase connection test passes

### RouteGuard
- [ ] `.env` file created with all required variables
- [ ] `npm install` completed (if not already done)
- [ ] `npm run build` completes without errors
- [ ] Application loads correctly in browser
- [ ] Basic functions work (login, map display, etc.)

---

## Need More Help?

If you encounter issues not covered here:

1. **Check the logs**: Browser console often has specific error messages
2. **Review documentation**:
   - Firebase: https://firebase.google.com/docs
   - Supabase: https://supabase.com/docs
   - RouteGuard: Check `README.md` and files in `docs/` folder
3. **Look at existing issues**: Check if similar problems have been solved in project discussions
4. **Ask for help**: If you're working with a team, reach out to someone with more experience

Your RouteGuard project should now be fully configured with both Firebase and Supabase services ready to power its notification system, real-time updates, authentication, and data storage capabilities!

*Last updated: September 2026*