# Supabase Setup Guide for RouteGuard

This document provides detailed instructions for setting up Supabase for the RouteGuard application.

## Prerequisites

1. Supabase account (https://supabase.com/)
2. Supabase CLI installed (`npm install -g supabase`)
3. Git installed
4. Node.js 18.x or later

## Step 1: Create Supabase Project

1. Log in to [Supabase](https://supabase.com/)
2. Click "New Project"
3. Enter project details:
   - Name: `routeguard-pwa` (or your preferred name)
   - Database password: Generate a strong password and save it securely
   - Region: Select closest to your user base
4. Click "Create new project"

## Step 2: Get Project Configuration

1. Go to your project settings (Settings ▸ API)
2. Copy these values:
   - Project URL
   - anon public key
   - service_role key (for administrative operations)
3. Create `.env` file in project root:
   ```env
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Step 3: Install Supabase CLI and Link Project

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link local project to Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

## Step 4: Set Up Database Schema

The RouteGuard application requires specific tables and extensions. Follow these steps:

### Enable Required Extensions

Run these SQL commands in the Supabase SQL editor:

```sql
-- Enable PostGIS for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pgcrypto for cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Apply Database Schema

You can apply the schema in several ways:

#### Recommended: Apply the checked-in migrations
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Review the dry-run output before applying. The standard migration set uses verification-based reputation. Do not move the optional vote-based migration into `supabase/migrations` at the same time as migration 004.

#### Alternative: Apply the bootstrap schema manually
```bash
Copy and paste the contents of `supabase/schema.sql` into the Supabase SQL editor and run it.

## Step 5: Configure Storage for Hazard Photos

RouteGuard uses Supabase Storage for storing hazard photos uploaded by users.

### Create Storage Bucket
```bash
# Using Supabase CLI
supabase storage create bucket hazard-photos --public

# Or via Supabase Dashboard:
# 1. Go to Storage section
# 2. Click "New Bucket"
# 3. Name: hazard-photos
# 4. Make it PUBLIC (for easy access to hazard images)
# 5. Enable Row Level Security (RLS)
```

### Configure Storage Bucket Policies

Set up appropriate RLS policies for the hazard-photos bucket:

1. **Allow authenticated users to upload files**
2. **Allow public read access to files** (since hazard photos need to be visible to all app users)
3. **Allow users to update/delete only their own files**

Example policy for uploads:
```sql
create policy "Users can upload hazard photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'hazard-photos');
```

Example policy for public access:
```sql
create policy "Anyone can view hazard photos"
on storage.objects for select
to public
using (bucket_id = 'hazard-photos');
```

## Step 6: Enable Realtime Publication

Supabase Realtime is used for live hazard updates. Enable publication for required tables:

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

## Step 7: Set Up Email Authentication (Optional but Recommended)

If you want to use email/password authentication:

1. Go to Authentication ▸ Settings
2. Under "Email", enable:
   - Email confirmations
   - Confirmed email required (optional but recommended)
3. Configure email templates:
   - Confirmation email
   - Password reset email
   - Magic link email (if using)
4. Optionally, set up email sender (Supabase provides a default, but you can customize)

## Step 8: Test the Connection

Create a simple test script to verify your Supabase connection:

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
    console.error('Connection failed:', error)
    return false
  }
  
  console.log('Connection successful!')
  return true
}

testConnection()
```

Run it with:
```bash
node test-supabase.js
```

## Step 9: Set Up Row Level Security (RLS)

RLS is crucial for data security in RouteGuard. Ensure all tables have appropriate policies.

### Example RLS Policies

#### User Profiles Table
```sql
-- Users can view their own profile
create policy "Users can view own profile"
on user_profiles for select
using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
on user_profiles for update
using (auth.uid() = id);

-- Insert policy for profiles (typically handled via trigger)
create policy "Allow insert of user profile"
on user_profiles for insert
with check (auth.uid() = id);
```

#### Hazards Table
```sql
-- Anyone can view hazards (with appropriate filtering)
create policy "Anyone can view hazards"
on hazards for select
using (true);

-- Authenticated users can insert hazards
create policy "Authenticated users can insert hazards"
on hazards for insert
with check (auth.role() = 'authenticated');

-- Users can update/delete their own hazards
create policy "Users can update own hazards"
on hazards for update
using (auth.uid() = user_id);

create policy "Users can delete own hazards"
on hazards for delete
using (auth.uid() = user_id);
```

## Step 10: Set Up Database Functions and Triggers

Some RouteGuard features rely on database functions:

### Hazard Status Calculation Function
This function calculates hazard status based on confirmations:
```sql
-- Create or replace the function for calculating hazard status
create or replace function calculate_hazard_status(hazard_id uuid)
returns hazard_status as $$
declare
  confirmation_count integer;
  status hazard_status;
begin
  select count(*) into confirmation_count
  from hazard_confirmations
  where hazard_id = calculate_hazard_status.hazard_id
    and confirmation = true;
  
  if confirmation_count >= 5 then
    status := 'confirmed_active';
  elsif confirmation_count >= 3 then
    status := 'needs_verification';
  else
    status := 'unconfirmed';
  end if;
  
  return status;
end;
$$ language plpgsql;
```

### Triggers for Automatic Updates
Set up triggers to automatically update hazard status when confirmations change:
```sql
create trigger update_hazard_status_after_confirmation
after insert or update or delete on hazard_confirmations
for each row
execute function calculate_hazard_status(NEW.hazard_id);
```

## Step 11: Configure API Rate Limits (Optional but Recommended)

To prevent abuse, consider setting up rate limits:

1. Go to API ▸ Settings
2. Configure rate limits for:
   - Auth API
   - Realtime API
   - Storage API
   - PostgREST API

## Step 12: Set Up Custom Domain (Optional)

If you want to use a custom domain for your Supabase project:

1. Go to Domain settings
2. Add your custom domain (e.g., `db.yourcity.gov`)
3. Follow the DNS verification steps
4. Wait for propagation (can take up to 24 hours)

## Step 13: Enable SSL/Enforce HTTPS

Supabase enforces HTTPS by default, but ensure:
1. All API calls use HTTPS
2. Your frontend application enforces HTTPS
3. Consider using HSTS headers in your frontend

## Step 14: Set Up Monitoring and Alerts

### Enable Query Logging
1. Go to Settings ▸ Database
2. Enable "Query logging" if needed for debugging
3. Be mindful of performance impact

### Set Up Usage Alerts
1. Go to Usage section
2. Set up alerts for:
   - Database storage usage
   - Bandwidth usage
   - Request counts
   - Compute time

## Step 15: Backup Configuration

While Supabase provides automatic backups, consider:

1. **Manual backups**: Use `supabase db dump` periodically
2. **Point-in-time recovery**: Familiarize yourself with the process
3. **Backup retention**: Supabase retains backups for 7 days by default

Example manual backup:
```bash
supabase db dump --backup-name routeguard-backup-$(date +%Y%m%d)
```

## Step 16: Test Essential Features

After setup, test these core functionalities:

1. **User authentication** (signup, login, password reset)
2. **Hazard reporting** (create, read, update, delete)
3. **Real-time updates** (open two browser windows, create hazard in one, see if it appears in other)
4. **Photo upload** to storage bucket
5. **Role-based access** (test different user types)
6. **Geographic queries** (test proximity-based hazard retrieval)

## Troubleshooting Common Issues

### Connection Issues
- Double-check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values
- Verify Supabase project is active and not paused
- Check network connectivity and firewall rules

### Authentication Problems
- Verify email provider settings if using email authentication
- Confirm JWT settings are correct
- Check that email templates are set up properly

### Storage Access Issues
- Check bucket permissions and RLS policies
- Verify file size limits are not exceeded
- Confirm CORS settings if using direct browser uploads
- Check storage bucket is set to public (if needed for direct access)

### Real-time Updates Not Working
- Verify realtime publication is enabled for tables
- Check that clients are properly subscribing to changes
- Confirm network connectivity allows WebSocket connections
- Check for browser extensions blocking WebSockets

## Maintenance Procedures

### Regular Tasks
1. **Weekly**: Review usage metrics and set up alerts if needed
2. **Monthly**: Test backup and recovery procedures
3. **Quarterly**: Review and optimize database indexes
4. **As needed**: Update Row Level Security policies as features evolve

### Performance Optimization
1. Monitor slow queries in the Supabase dashboard
2. Add database indexes as needed based on query patterns
3. Consider using database functions for complex calculations
4. Use Supabase Edge Functions for heavy computations when needed

## Security Best Practices

1. **Never expose service_role key** to the frontend - use only in trusted server environments
2. **Enable RLS on all tables** - this is your last line of defense
3. **Use HTTPS everywhere** - Supabase enforces this, but ensure your frontend does too
4. **Regularly rotate API keys** if you suspect a compromise
5. **Monitor authentication logs** for suspicious activity
6. **Implement rate limiting** on custom endpoints if you add any

## Resources

- Supabase Documentation: https://supabase.com/docs
- Supabase CLI Reference: https://supabase.com/docs/reference/cli
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security
- Storage: https://supabase.com/docs/guides/storage
- Realtime: https://supabase.com/docs/guides/realtime
- PostGIS: https://postgis.net/