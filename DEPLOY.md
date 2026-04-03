## E & S closet - New Client Deployment Checklist

Target time: under 2 hours end-to-end.

### Information to collect from client before starting
- [ ] Store name
- [ ] Store tagline
- [ ] Primary and accent brand colors
- [ ] Logo file (PNG, transparent background preferred)
- [ ] Hero image for homepage
- [ ] Contact email and WhatsApp number
- [ ] Social media handles
- [ ] City and delivery areas
- [ ] Resend account API key (or create one for them)
- [ ] Whether they want Google login enabled

### Supabase setup (~30 mins)
- [ ] Create new Supabase project at `supabase.com`
- [ ] Run all table migrations from `supabase/setup.md`
- [ ] Run all RPC migrations from `supabase/setup.md`
- [ ] Create storage buckets with correct public/private settings
- [ ] Apply all RLS policies
- [ ] Deploy all edge functions
- [ ] Add `RESEND_API_KEY` to edge function secrets
- [ ] Add `STYLESYNC_API_KEY` to edge function secrets
- [ ] Add `PAYSTACK_SECRET_KEY` to edge function secrets
- [ ] Add `GEMINI_API_KEY` secret if `ai_product_autofill` is still using Gemini
- [ ] In Paystack dashboard, set webhook URL to `https://[your-supabase-project].supabase.co/functions/v1/handle_paystack_webhook`
- [ ] In Paystack webhook settings, subscribe to `charge.success` and `charge.failed`
- [ ] Enable Google OAuth in Supabase Auth settings (if needed)
- [ ] Note Supabase project URL and publishable key

### StyleSyncs setup (~5 mins)
- [ ] Log into Vestigh/StyleSyncs admin dashboard
- [ ] Generate new API key for this client
- [ ] Set appropriate request limit based on their tier
- [ ] Note the API key

### Project configuration (~20 mins)
- [ ] Copy base project to new folder named after client
- [ ] Fill in `src/config/store.config.ts` completely
- [ ] Create `.env` file from `.env.example`
- [ ] Add Supabase URL and publishable key to `.env`
- [ ] Add StyleSyncs API key to `.env`
- [ ] Add logo image to `/public/logo.png`
- [ ] Add hero image to `/public/hero.jpg`
- [ ] Verify feature flags match what client needs
- [ ] Run locally and confirm branding looks correct

### Deploy to Vercel (~15 mins)
- [ ] Push project to new GitHub repository
- [ ] Connect repository to Vercel
- [ ] Add all environment variables in Vercel project settings
- [ ] Set custom domain or subdomain (`clientname.vestigh.com`)
- [ ] Trigger deployment and wait for build to complete
- [ ] Confirm site loads correctly on the domain

### Post-deployment testing (~20 mins)
- [ ] Create a test product with image
- [ ] Test try-on flow end to end
- [ ] Test guest browsing and product pages
- [ ] Test account registration and login
- [ ] Test Google login if enabled
- [ ] Place a test order and confirm order confirmation email arrives
- [ ] Log into admin panel and confirm order appears
- [ ] Update test order status and confirm status update email arrives
- [ ] Delete test order after confirming everything works

### Client handover (~10 mins)
- [ ] Share admin panel URL with client
- [ ] Create their `super_admin` account
- [ ] Walk them through adding their first real product
- [ ] Share the store URL
- [ ] Save their credentials and config details securely

### Completion checklist
- [ ] Deployment completed in under 2 hours
- [ ] Client profile captured in `src/config/client-template.md`
- [ ] All credentials stored securely
