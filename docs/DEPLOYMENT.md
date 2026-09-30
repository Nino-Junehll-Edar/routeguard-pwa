# RouteGuard Deployment Guide

This document provides a comprehensive guide for deploying the RouteGuard application to production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Application Configuration](#application-configuration)
5. [Build Process](#build-process)
6. [Deployment Options](#deployment-options)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Rollback Procedures](#rollback-procedures)
9. [Maintenance Procedures](#maintenance-procedures)

## Prerequisites

Before deploying RouteGuard, ensure you have:

1. **Supabase Account**: A Supabase organization and project
2. **Node.js**: Version 18.x or later
3. **Package Manager**: npm or pnpm
4. **Git**: For version control
5. **CLI Tools**: 
   - Supabase CLI (`supabase`)
   - Firebase CLI (if using Firebase features)
6. **Domain**: Optional custom domain for production

## Environment Setup

### 1. Create Supabase Project

1. Log in to [Supabase](https://supabase.com/)
2. Create a new project or use an existing one
3. Note your project reference and API keys

### 2. Set Up Environment Variables

Create a `.env.production` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Firebase Configuration (for notifications)
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

> **Security Note**: Never commit `.env` files to version control. Use environment variable injection in your hosting platform.

### 3. Configure Supabase Project

Run the following steps to set up your Supabase project:

#### Apply Database Schema

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Start Supabase services (if using local development)
supabase start

# Apply database migrations
supabase db push --dry-run
supabase db push

# Alternatively, apply migrations individually in order:
supabase db reset --linked  # Reset database to clean state
supabase migration up       # Apply all migrations
```

#### Enable Required Extensions

Ensure these extensions are enabled in your Supabase database:
- `postgis` (for geospatial queries)
- `pgcrypto` (for cryptographic functions)

#### Configure Storage

Create a storage bucket for hazard photos:

```bash
# Using Supabase CLI
supabase storage create bucket hazard-photos --public

# Or create via Supabase Dashboard:
# 1. Go to Storage section
# 2. Click "New Bucket"
// 3. Name: hazard-photos
// 4. Make it PUBLIC (for easy access to hazard images)
// 5. Enable Row Level Security (RLS)
```

#### Configure Realtime Publication

Ensure realtime publication is enabled for required tables:

```sql
-- Enable replication for tables
alter publication supabase_realtime add table hazards;
alter publication supabase_realtime add table agency_advisories;
alter publication supabase_realtime add table agency_requests;
alter publication supabase_realtime add table user_profiles;
alter publication supabase_realtime add table hazard_confirmations;
alter publication supabase_realtime add table hazard_comments;
alter publication supabase_realtime add table hazard_votes;
alter publication supabase_realtime add table notifications;
```

## Application Configuration

### 1. Optimize Build for Production

The `vite.config.js` file has been optimized for production with:
- Code splitting for vendor libraries
- Minification
- Asset optimization
- Tree shaking

### 2. Environment-Specific Configuration

Consider creating environment-specific configuration files:
- `.env.development` for local development
- `.env.staging` for staging environment
- `.env.production` for production

### 3. Firebase Configuration

If using Firebase Cloud Messaging:
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Add a web app to your Firebase project
3. Copy the configuration values to your environment variables
4. Ensure you have configured Cloud Messaging properly
5. Set up a service worker for FCM reception (if needed)

## Build Process

### 1. Install Dependencies

```bash
npm ci  # Using clean install for reproducible builds
```

### 2. Run Tests (Optional but Recommended)

```bash
npm test  # Runs vitest tests
```

### 3. Build for Production

```bash
npm run build
```

This will generate optimized assets in the `/build` directory.

### 4. Preview Build Locally

```bash
npm run preview
```

This allows you to test the production build locally before deployment.

## Deployment Options

RouteGuard can be deployed to various platforms. Here are the most common options:

### Option 1: Vercel (Recommended for SvelteKit)

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Configure environment variables in Vercel dashboard
5. Set up custom domain if needed

### Option 2: Netlify

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Login: `netlify login`
3. Deploy: `netlify deploy --prod`
4. Configure environment variables in Netlify dashboard
5. Set up custom domain if needed

### Option 3: Cloudflare Pages

1. Install Wrangler: `npm i -g wrangler`
2. Login: `wrangler login`
3. Create project: `wrangler pages project create routeguard-pwa`
4. Deploy: `wrangler pages deploy build`
5. Configure environment variables in Cloudflare dashboard
6. Set up custom domain if needed

### Option 4: Traditional VPS/Server

1. Install Node.js on your server
2. Copy the built assets to your server
3. Use a process manager like PM2 to run the server:
   ```bash
   npm i -g pm2
   pm2 start "node build" --name routeguard
   ```
4. Configure nginx/apache as a reverse proxy
5. Set up SSL certificate (Let's Encrypt recommended)
6. Set up process monitoring and logging

### Option 5: Docker Container

Create a Dockerfile:

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/build ./build
COPY package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["node", "build"]
```

Build and run:
```bash
docker build -t routeguard-pwa .
docker run -p 3000:3000 --env-file .env.production routeguard-pwa
```

### Setting Up Custom Domain (if applicable)

If you have a custom domain for your RouteGuard deployment:

#### For Vercel:
1. In your Vercel project dashboard, go to Settings > Domains
2. Add your custom domain (e.g., `routeguard.yourcity.gov`)
3. Vercel will provide DNS records to configure
4. Update your DNS provider with the provided records
5. Wait for DNS propagation (can take up to 24 hours)

#### For Netlify:
1. In your Netlify site dashboard, go to Site settings > Domain management
2. Add your custom domain
3. Netlify will provide DNS records to configure
4. Update your DNS provider with the provided records
5. Wait for DNS propagation

#### For Cloudflare Pages:
1. In your Cloudflare account, go to Workers & Pages > Your project > Custom domains
2. Add your custom domain
3. Cloudflare will automatically configure DNS if using Cloudflare nameservers
4. Otherwise, follow the provided DNS configuration instructions

#### For Traditional VPS/Server:
1. Configure your web server (nginx/apache) to listen on your custom domain
2. Set up SSL certificate using Let's Encrypt or your preferred provider
3. Configure reverse proxy to point to your Node.js application
4. Ensure proper DNS records point to your server's IP address

### Setting Up CDN for Static Assets (if needed)

For improved performance and global availability, consider setting up a CDN for static assets:

#### Using Vercel's Built-in CDN:
- Vercel automatically serves static assets via its global edge network
- No additional configuration needed
- Assets are cached at the edge for fast delivery worldwide

#### Using Netlify's Built-in CDN:
- Netlify automatically serves static assets via its global CDN
- No additional configuration needed
- Assets are cached at the edge for fast delivery worldwide

#### Using Cloudflare (Recommended for Custom Setups):
1. Sign up for Cloudflare and add your domain
2. Update your nameservers to point to Cloudflare
3. Enable CDN proxying for your domain (orange cloud icon)
4. Configure caching rules:
   - Cache static assets (JS, CSS, images) for longer periods
   - Cache API responses appropriately (be careful with user-specific data)
   - Set cache levels and TTL values based on your needs
5. Enable additional performance features:
   - Auto Minify for HTML, CSS, JavaScript
   - Brotli compression
   - HTTP/2 and HTTP/3 support
   - Image optimization (if using Cloudflare Images)

#### Using AWS CloudFront (Alternative):
1. Create an S3 bucket for your static assets
2. Upload your built assets to the S3 bucket
3. Create a CloudFront distribution pointing to the S3 bucket
4. Configure cache behaviors and TTL settings
5. Point your custom domain to the CloudFront distribution
6. Configure origin access identity for secure S3 access

#### Self-Hosted CDN Options:
- Use nginx with caching proxy features
- Implement Varnish as a caching layer
- Use any reverse proxy with caching capabilities

When implementing a CDN, consider:
1. **Cache Invalidation Strategy**: How and when to clear cached assets when deploying updates
2. **HTTPS Enforcement**: Ensure all traffic is served over HTTPS
3. **Geographic Coverage**: Choose a CDN with points of presence near your user base
4. **Cost Considerations**: Bandwidth and request costs associated with CDN usage
5. **Security Features**: WAF, DDoS protection, bot management if needed

## Post-Deployment Verification

After deployment, verify the following:

### 1. Health Checks

- Visit the application URL and verify it loads correctly
- Check browser console for JavaScript errors
- Verify responsive design on mobile and desktop

### 2. Authentication Flow

- Test user registration
- Test user login
- Test email verification (if implemented)
- Test password reset (if implemented)
- Test role-based access control

### 3. Core Features

- Test map loading and hazard display
- Test hazard reporting (with photo upload if applicable)
- Test real-time updates (open two browsers, report in one, see if other updates)
- Test notification system (if configured)
- Test routing functionality
- Test agency request flow (if applicable)
- Test administrative features (if applicable)

### 4. Database Connectivity

- Verify Supabase connection is working
- Check that real-time subscriptions are active
- Verify storage access for hazard photos

### 5. Performance

- Check page load times (aim for < 3 seconds)
- Verify bundle sizes are reasonable
- Check that code splitting is working
- Test on various network conditions (3G, 4G, WiFi)

### 6. Security

- Verify HTTPS is properly configured
- Check that environment variables are not exposed
- Test that RLS policies are working correctly
- Verify that unauthorized access is properly blocked

## Rollback Procedures

If issues are discovered after deployment:

### 1. Quick Rollback (Same Day)

If you deployed recently and need to rollback:

#### Vercel/Netlify/Cloudflare:
- Use the platform's rollback feature to deploy the previous deployment
- This is usually instantaneous and preserves environment variables

#### Docker:
```bash
# Stop current container
docker stop routeguard-pwa

# Start previous version (if you tagged it)
docker start routeguard-pwa:previous-tag

# Or rebuild previous version
git checkout previous-commit-shash
docker build -t routeguard-pwa:previous .
docker run -p 3000:3000 --env-file .env.production routeguard-pwa:previous
```

### 2. Database Rollback

If you need to rollback database changes:

#### Using Supabase Point-in-Time Recovery:
1. Go to Supabase Dashboard > Database > Backups
2. Select Point-in-time recovery
3. Choose a time before the problematic deployment
4. Follow the recovery process

#### Using Manual Backup:
1. Identify the backup to restore from
2. Use pg_restore to restore the database
3. Verify data integrity

### 3. Communication Plan

During rollback:
1. Notify users if downtime is expected
2. Update status page if applicable
3. Document the issue and resolution
4. Conduct post-mortem analysis

## Maintenance Procedures

### 1. Regular Updates

- Keep dependencies updated: `npm outdated` and `npm update`
- Monitor Supabase for platform updates
- Keep Node.js version current
- Apply security patches promptly

### 2. Monitoring

Set up monitoring for:
- Application uptime and response times
- Error rates and exception tracking
- Database performance metrics
- Storage usage and costs
- Bandwidth and traffic patterns

### 3. Log Management

- Implement centralized logging if scale warrants it
- Set up log rotation for self-hosted deployments
- Monitor logs for errors and suspicious activity
- Retain logs according to your data retention policy

### 4. Backup Verification

Regularly test your backup and recovery procedures:
- Monthly: Test restore from latest backup
- Quarterly: Perform full disaster recovery drill
- After major changes: Verify backup integrity

### 5. Performance Optimization

- Monitor bundle sizes and split code as needed
- Optimize database queries based on usage patterns
- Consider adding caching layers for frequently accessed data
- Optimize asset delivery (CDN, compression, caching headers)

### 6. Security Updates

- Regularly scan for vulnerabilities: `npm audit`
- Keep all dependencies up to date
- Monitor security advisories for Supabase, Firebase, and other services
- Conduct periodic security assessments

## Troubleshooting Common Issues

### 1. Connection Issues

**Problem**: Application cannot connect to Supabase
**Solutions**:
- Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values
- Verify Supabase project is active and not paused
- Check network connectivity and firewall rules
- Ensure database connection limits are not exceeded

### 2. Authentication Problems

**Problem**: Users cannot log in or register
**Solutions**:
- Verify Supabase Auth configuration
- Check email provider settings (if using email authentication)
- Ensure JWT settings are correct
- Confirm that email templates are set up properly

### 3. Storage Access Issues

**Problem**: Hazard photos not uploading or not displaying
**Solutions**:
- Check bucket permissions and RLS policies
- Verify file size limits are not exceeded
- Confirm CORS settings if using direct browser uploads
- Check storage bucket is set to public (if needed for direct access)

### 4. Real-time Updates Not Working

**Problem**: Changes not reflecting in real-time across clients
**Solutions**:
- Verify realtime publication is enabled for tables
- Check that clients are properly subscribing to changes
- Confirm network connectivity allows WebSocket connections
- Check for browser extensions blocking WebSockets

### 5. Performance Issues

**Problem**: Slow page loads or interactions
**Solutions**:
- Analyze bundle contents with `rollup-plugin-visualizer`
- Check for inefficient database queries
- Optimize image sizes and formats
- Consider implementing pagination for large lists
- Review and optimize A* algorithm performance if routing is slow

## Version Release Process

For releasing new versions of RouteGuard:

### 1. Preparation

1. Ensure all tests pass: `npm test`
2. Update version number in package.json using semantic versioning
3. Update CHANGELOG.md with notable changes
4. Ensure documentation is up to date
5. Create release branch: `git checkout -b release/vX.Y.Z`

### 2. Build and Test

1. Build production version: `npm run build`
2. Test build locally: `npm run preview`
3. Deploy to staging environment if available
4. Perform final verification tests

### 3. Release

1. Merge release branch to main: `git checkout main && git merge release/vX.Y.Z`
2. Tag the release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
3. Push tags: `git push --tags`
4. Deploy to production using your preferred method
5. Announce release to users and stakeholders

### 4. Post-Release

1. Monitor application closely for first 24-48 hours
2. Check error logs and performance metrics
3. Gather user feedback
4. Plan next version based on feedback and roadmap

## Conclusion

Deploying RouteGuard requires careful attention to both application and infrastructure components. By following this guide, you can ensure a smooth deployment process with proper backup, monitoring, and rollback capabilities.

Remember to:
- Always test changes in a staging environment before production
- Keep backups of both code and data
- Monitor your application post-deployment
- Document any deviations from standard procedures
- Continuously improve your deployment process based on experience

For additional support, consult the Supabase, SvelteKit, and Firebase documentation as needed.