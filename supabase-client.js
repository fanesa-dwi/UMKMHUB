(() => {
  const config = window.UMKMHUB_SUPABASE_CONFIG;
  if (!config?.url || !config?.publishableKey || !window.supabase?.createClient) {
    window.UMKMHUB_REMOTE = { ready: false, error: 'Supabase client/configuration missing' };
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const toInternationalPhone = value => { const digits=String(value||'').replace(/\D/g,''); return digits.startsWith('0')?`+62${digits.slice(1)}`:digits.startsWith('62')?`+${digits}`:digits.startsWith('8')?`+62${digits}`:`+${digits}`; };
  window.UMKMHUB_REMOTE = {
    ready: true,
    client,
    toInternationalPhone,
    signUpSeller: (phone,password,metadata) => client.auth.signUp({ phone: toInternationalPhone(phone), password, options: { data: metadata } }),
    signInSeller: (phone,password) => client.auth.signInWithPassword({ phone: toInternationalPhone(phone), password }),
    verifySellerPhone: (phone,token) => client.auth.verifyOtp({ phone: toInternationalPhone(phone), token, type: 'sms' }),
    signInAdmin: (email,password) => client.auth.signInWithPassword({ email, password }),
    signOut: () => client.auth.signOut(),
    session: () => client.auth.getSession(),
    currentUser: () => client.auth.getUser(),
    isAdmin: async () => { const {data:{user},error}=await client.auth.getUser(); if(error||!user)return false; const {data,error:roleError}=await client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle(); return !roleError&&data?.role==='admin'; }
  };
})();
