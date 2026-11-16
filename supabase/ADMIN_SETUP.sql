-- Run after a user has registered and confirmed their email.
-- Replace the address below with your own verified account email.
update public.profiles set role='admin' where email='YOUR_VERIFIED_EMAIL';
-- Confirm that exactly your account has the admin role:
select id,email,role,credits from public.profiles where role='admin';
