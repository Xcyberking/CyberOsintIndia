'use server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const enc = encodeURIComponent;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/[/]$/, '');

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=' + enc(error.message));
  redirect('/dashboard');
}

export async function signUp(form: FormData) {
  const supabase = await createClient();
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const name = String(form.get('name') || '').trim().slice(0, 60);
  const ref = String(form.get('referral_code') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const back = (msg: string) => '/register?error=' + enc(msg) + (ref ? '&ref=' + ref : '');
  if (password.length < 8) redirect(back('Password must be at least 8 characters'));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name, referral_code: ref }, emailRedirectTo: site() + '/auth/callback' },
  });
  if (error) redirect(back(error.message));
  // Email confirmation OFF in Supabase -> a session exists immediately: go straight in.
  if (data.session) redirect('/dashboard');
  redirect('/login?message=' + enc('Check your email to confirm your account, then log in.'));
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: site() + '/auth/callback' } });
  if (error) redirect('/login?error=' + enc(error.message));
  if (data.url) redirect(data.url);
}

export async function sendPasswordReset(form: FormData) {
  const supabase = await createClient();
  const email = String(form.get('email') || '').trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: site() + '/auth/callback?next=/reset-password' });
  if (error) redirect('/forgot-password?error=' + enc(error.message));
  redirect('/forgot-password?message=' + enc('Password reset email sent'));
}

export async function updatePassword(form: FormData) {
  const supabase = await createClient();
  const password = String(form.get('password') || '');
  if (password.length < 8) redirect('/reset-password?error=' + enc('Password must be at least 8 characters'));
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/reset-password?error=' + enc(error.message));
  redirect('/login?message=' + enc('Password updated'));
}

export async function saveProfile(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const displayName = String(form.get('display_name') || '').trim();
  const bio = String(form.get('bio') || '').trim();
  if (displayName.length < 2 || displayName.length > 60) redirect('/profile?error=' + enc('Display name must be 2-60 characters'));
  if (bio.length > 160) redirect('/profile?error=' + enc('Bio must be 160 characters or less'));
  const { error } = await supabase.from('profiles').update({ display_name: displayName, bio }).eq('id', user.id);
  if (error) redirect('/profile?error=' + enc(error.message));
  redirect('/profile?message=' + enc('Profile updated successfully'));
}

export async function changePasswordFromProfile(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const password = String(form.get('password') || '');
  if (password.length < 8) redirect('/profile?error=' + enc('Password must be at least 8 characters'));
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/profile?error=' + enc(error.message));
  redirect('/profile?message=' + enc('Password updated successfully'));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
