// Supabase Edge Function to create users
// Deploy this to Supabase Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { email, password, role, approved } = await req.json()

    // Create Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if requesting user is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError) {
      console.error('User error:', userError)
      throw new Error('Invalid token')
    }
    
    if (!user) {
      throw new Error('User not found')
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, approved')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw new Error('Could not fetch user profile')
    }

    if (!profile) {
      throw new Error('Profile not found')
    }

    if (profile.role !== 'admin' || !profile.approved) {
      throw new Error('Unauthorized: Admin access required')
    }

    // Create the new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (createError) {
      console.error('Create error:', createError)
      throw createError
    }

    // Update the profile with role and approval
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role,
        approved,
      })
      .eq('id', newUser.user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
