(() => {
  const KEY = 'umkmhub.shared.v1';
  const PREF_KEY = 'umkmhub.preferences.v1';
  const demoIds = new Set(['hisnesfood', 'dapur-bu-sari', 'ruang-rona', 'kopi-sudut', 'kedai-pagi']);
  const seed = {
    metrics: { total: 0, active: 0, newThisMonth: 0, verified: 0, pending: 0, inactive: 0 },
    businesses: [],
    posts: [], saved: [], following: [], likes: {}, comments:{}, activeSellerEmail: ''
  };
  let data; let storageReady=true;let activeUserId='';
  const remote=window.UMKMHUB_REMOTE;
  try {
    data = JSON.parse(localStorage.getItem(KEY));
    if (!data || !data.metrics || !Array.isArray(data.businesses)) throw new Error('Invalid shared data');
  } catch {
    data = seed;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { storageReady=false; }
  }
  try{const prefs=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');for(const key of ['saved','following','likes','comments'])if(prefs[key]!==undefined)data[key]=prefs[key];}catch{}
  const profileDefaults={
    'hisnesfood':{phone:'0812 0000 0000',whatsapp:'0812 0000 0000',productList:[{name:'Chicken Katsu',price:15000},{name:'Nugget Ikan',price:15000},{name:'Dimsum',price:20000}]},
    'dapur-bu-sari':{phone:'6281234567890',whatsapp:'6281234567890',productList:[{name:'Rendang Sapi Premium',price:45000}]},
    'ruang-rona':{phone:'6281234567891',whatsapp:'6281234567891',productList:[{name:'Scarf Batik Sekar',price:125000}]},
    'kopi-sudut':{phone:'6281234567892',whatsapp:'6281234567892',productList:[{name:'Es Kopi Gula Aren',price:22000}]}
  };
  data.businesses.forEach(item=>{const defaults=profileDefaults[item.id]||{};for(const [key,value] of Object.entries(defaults))if(item[key]===undefined)item[key]=value;if(item.phone&&!item.whatsapp)item.whatsapp=item.phone;if(!Array.isArray(item.productList))item.productList=[];if(item.email&&!item.ownerEmail)item.ownerEmail=String(item.email).toLowerCase();if(demoIds.has(item.id))item.isDemo=true;});
  const previousBusinessCount=data.businesses.length;
  data.businesses=data.businesses.filter(item=>!demoIds.has(item.id));
  const demoDataRemoved=data.businesses.length!==previousBusinessCount;
  if(!Array.isArray(data.posts))data.posts=[];
  data.posts=data.posts.filter(post=>!demoIds.has(post.businessId));
  if(!Array.isArray(data.saved))data.saved=[];
  if(!Array.isArray(data.following))data.following=[];
  data.saved=data.saved.filter(id=>!demoIds.has(id));data.following=data.following.filter(id=>!demoIds.has(id));
  if(data.likes&&typeof data.likes==='object')for(const id of demoIds)delete data.likes[id];
  if(!data.comments||typeof data.comments!=='object')data.comments={};
  if(!data.activeSellerEmail)data.activeSellerEmail='';
  if(data.activeSellerEmail&&!data.businesses.some(item=>item.ownerEmail===data.activeSellerEmail&&item.status==='Terverifikasi'&&item.passwordHash))data.activeSellerEmail='';
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalizePhone=value=>{const digits=String(value||'').replace(/\D/g,'');return digits.startsWith('0')?`62${digits.slice(1)}`:digits;};
  const toHex=bytes=>[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
  async function derivePassword(password,saltHex){
    if(!globalThis.crypto?.subtle)throw new Error('Secure password hashing is unavailable in this browser.');
    const salt=saltHex?Uint8Array.from(saltHex.match(/.{2}/g)||[],part=>parseInt(part,16)):crypto.getRandomValues(new Uint8Array(16));
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256);
    return {salt:toHex(salt),hash:toHex(bits)};
  }
  const calculateMetrics = businesses => {
    const accounts=businesses.filter(item=>!item.isDemo), now=new Date();
    const monthNew=accounts.filter(item=>{if(!item.createdAt)return false;const date=new Date(item.createdAt);return !Number.isNaN(date.getTime())&&date.getMonth()===now.getMonth()&&date.getFullYear()===now.getFullYear();}).length;
    const inactive=accounts.filter(item=>item.status==='Tidak Aktif'||item.businessStatus==='Tidak Aktif').length;
    return {total:accounts.length,active:accounts.length-inactive,newThisMonth:monthNew,verified:accounts.filter(item=>item.status==='Terverifikasi').length,pending:accounts.filter(item=>item.status==='Menunggu Verifikasi').length,inactive};
  };
  data.metrics=calculateMetrics(data.businesses);
  if(demoDataRemoved&&storageReady){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{storageReady=false;}}
  const publish = () => {
    data.metrics=calculateMetrics(data.businesses);
    if(storageReady){try{if(remote?.ready)localStorage.setItem(PREF_KEY,JSON.stringify({saved:data.saved,following:data.following,likes:data.likes,comments:data.comments}));else localStorage.setItem(KEY, JSON.stringify(data));}catch{storageReady=false;}}
    window.dispatchEvent(new CustomEvent('umkmhub:update', { detail: clone(data) }));
  };
  const fromRow=row=>({id:String(row.id),ownerId:row.owner_id,name:row.name,owner:row.owner,phone:row.phone,whatsapp:row.phone,email:row.email,ownerEmail:row.email,ownerAddress:row.owner_address,category:row.category,year:row.year,address:row.address,region:row.region,description:row.description,employees:row.employees,revenue:Number(row.revenue)||0,products:row.products,productList:row.product_list||[],businessStatus:row.business_status,status:row.status,social:row.social,photoDataUrl:row.photo_url||'',createdAt:row.created_at,icon:'🏪'});
  const toRow=(item,userId)=>({owner_id:userId,name:item.name,owner:item.owner,phone:item.whatsapp||item.phone,email:item.ownerEmail||item.email,owner_address:item.ownerAddress||'',category:item.category||'Lainnya',year:item.year||null,address:item.address||'',region:item.region||'',description:item.description||'',employees:Number(item.employees)||0,revenue:Number(item.revenue)||0,products:Number(item.products)||0,product_list:item.productList||[],business_status:item.businessStatus||'Aktif',social:item.social||null,photo_url:item.photoDataUrl?.startsWith('https://')?item.photoDataUrl:null,status:item.status||'Menunggu Verifikasi'});
  async function refreshRemote(){
    if(!remote?.ready)return;
    const {data:{user}}=await remote.client.auth.getUser();activeUserId=user?.id||'';const admin=user?await remote.isAdmin():false;data.activeSellerEmail=user&&!admin?(user.phone||user.email||''):'';
    const [directoryResult,privateResult,postsResult]=await Promise.all([
      remote.client.from('business_directory').select('*').order('created_at',{ascending:false}),
      user?remote.client.from('businesses').select('*').order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
      remote.client.from('posts').select('*').order('created_at',{ascending:false})
    ]);
    if(directoryResult.error)throw directoryResult.error;
    if(privateResult.error)throw privateResult.error;
    const businesses=[...(privateResult.data||[])];for(const row of directoryResult.data||[])if(!businesses.some(privateRow=>String(privateRow.id)===String(row.id)))businesses.push(row);
    const postsResultError=postsResult.error;
    if(postsResultError&&postsResultError.code!=='42P01')throw postsResultError;
    data.businesses=businesses.map(fromRow);
    data.posts=(postsResult.data||[]).map(row=>({id:row.id,businessId:String(row.business_id),ownerId:row.owner_id,text:row.text,product:row.product,price:row.price,createdAt:row.created_at}));
    data.metrics=calculateMetrics(data.businesses);publish();
  }
  async function persistBusiness(item,insert=false){
    if(!remote?.ready)return item;
    const {data:{user},error:authError}=await remote.client.auth.getUser();
    if(authError||!user)throw new Error('Silakan masuk terlebih dahulu.');
    const payload=toRow(item,user.id);let query;
    if(insert)query=await remote.client.from('businesses').insert(payload).select('*').single();
    else query=await remote.client.from('businesses').update(payload).eq('id',item.id).select('*').single();
    if(query.error)throw query.error;
    const saved=fromRow(query.data);const index=data.businesses.findIndex(row=>row.id===saved.id);if(index<0)data.businesses.unshift(saved);else data.businesses[index]=saved;publish();return saved;
  }
  if(remote?.ready){
    refreshRemote().catch(error=>{console.error('UMKMHUB Supabase sync:',error);window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message}));});
    remote.client.auth.onAuthStateChange((_event,session)=>{activeUserId=session?.user?.id||'';data.activeSellerEmail=session?.user?.phone||session?.user?.email||'';setTimeout(()=>refreshRemote().catch(error=>console.error('UMKMHUB sync:',error)),0);});
    remote.client.channel('umkmhub-live').on('postgres_changes',{event:'*',schema:'public',table:'businesses'},()=>refreshRemote().catch(()=>{})).on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>refreshRemote().catch(()=>{})).subscribe();
    window.addEventListener('focus',()=>refreshRemote().catch(()=>{}));
    setInterval(()=>refreshRemote().catch(()=>{}),30000);
  }
  window.addEventListener('storage', event => {
    if (event.key !== KEY || !event.newValue) return;
    try { data = JSON.parse(event.newValue); window.dispatchEvent(new CustomEvent('umkmhub:update', { detail: clone(data) })); } catch { /* Keep the last valid state. */ }
  });
  window.UMKMStore = {
    key: KEY,
    get: () => clone(data),
    refreshRemote,
    addBusiness(business) {
      const item = { ...business, id: business.id || crypto.randomUUID(), status: 'Menunggu Verifikasi', createdAt: new Date().toISOString() };
      item.ownerEmail=(item.ownerEmail||item.email||'').trim().toLowerCase();
      if(!item.whatsapp&&item.phone)item.whatsapp=item.phone;
      data.businesses.unshift(item);
      publish();if(remote?.ready)persistBusiness(item,true).catch(error=>{console.error('UMKMHUB save:',error);window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message}));});return clone(item);
    },
    getActiveSellerEmail:()=>data.activeSellerEmail||'',
    logoutSeller(){data.activeSellerEmail='';activeUserId='';publish();if(remote?.ready)remote.signOut();},
    setActiveSellerEmail(email){const normalized=String(email||'').trim().toLowerCase();data.activeSellerEmail=data.businesses.some(item=>item.ownerEmail===normalized&&item.status==='Terverifikasi'&&item.passwordHash)?normalized:'';publish();},
    hasSellerAccount(phone,email){const normalizedPhone=normalizePhone(phone),normalizedEmail=String(email||'').trim().toLowerCase();return data.businesses.some(item=>(!remote?.ready||item.ownerId)&&(normalizedPhone&&normalizePhone(item.phone||item.whatsapp)===normalizedPhone||normalizedEmail&&String(item.ownerEmail||item.email||'').trim().toLowerCase()===normalizedEmail));},
    createSellerCredential(password){return derivePassword(password);},
    async registerSeller(phone,password,metadata){if(!remote?.ready)throw new Error('Koneksi Supabase belum tersedia.');const result=await remote.signUpSeller(phone,password,metadata);if(result.error)throw result.error;if(!result.data.session)return {user:result.data.user,needsOtp:true};return this.finishSellerRegistration(result.data.user);},
    async verifySellerPhone(phone,token){const result=await remote.verifySellerPhone(phone,token);if(result.error)throw result.error;return this.finishSellerRegistration(result.data.user);},
    async finishSellerRegistration(user){const claimed=await remote.client.rpc('claim_legacy_businesses_by_phone');if(claimed.error)throw claimed.error;await refreshRemote();return {user,claimed:claimed.data||[]};},
    async migrateLocalBusinesses(){
      if(!remote?.ready||!await remote.isAdmin())throw new Error('Hanya admin yang dapat mengimpor data lama.');
      let legacy;try{legacy=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{throw new Error('Data lokal laptop tidak dapat dibaca.');}
      const existing=data.businesses.map(item=>normalizePhone(item.phone||item.whatsapp));
      const rows=(legacy.businesses||[]).filter(item=>!item.isDemo&&!existing.includes(normalizePhone(item.phone||item.whatsapp))&&item.name&&item.phone&&item.email).map(item=>({owner_id:null,name:item.name,owner:item.owner||'Pemilik UMKM',phone:item.whatsapp||item.phone,email:item.ownerEmail||item.email,owner_address:item.ownerAddress||'',category:item.category||'Lainnya',year:item.year||null,address:item.address||'',region:item.region||'',description:item.description||'',employees:Number(item.employees)||0,revenue:Number(item.revenue)||0,products:Number(item.products)||0,product_list:Array.isArray(item.productList)?item.productList:[],business_status:item.businessStatus==='Tidak Aktif'?'Tidak Aktif':'Aktif',social:item.social||null,photo_url:item.photoDataUrl?.startsWith('https://')?item.photoDataUrl:null,status:['Terverifikasi','Menunggu Verifikasi','Tidak Aktif'].includes(item.status)?item.status:'Menunggu Verifikasi'}));
      if(!rows.length)return {count:0};const {data:inserted,error}=await remote.client.from('businesses').insert(rows).select('id');if(error)throw error;await refreshRemote();return {count:inserted.length};
    },
    async loginSeller(phone,password){
      if(remote?.ready){const signed=await remote.signInSeller(phone,password);if(signed.error)return {ok:false,reason:'invalid'};const user=signed.data.user;const {data:rows,error}=await remote.client.from('businesses').select('*').eq('owner_id',user.id);if(error)return {ok:false,reason:'not-found'};const found=(rows||[]).map(fromRow);data.businesses=found;const approved=found.find(row=>row.status==='Terverifikasi'&&row.businessStatus!=='Tidak Aktif');if(!approved){await remote.signOut();return {ok:false,reason:found.some(row=>row.status==='Menunggu Verifikasi')?'pending':'inactive'};}data.activeSellerEmail=user.phone||user.email||'';publish();return {ok:true,business:clone(approved)};}
      const normalizedPhone=normalizePhone(phone),item=data.businesses.find(row=>normalizedPhone&&normalizePhone(row.phone||row.whatsapp)===normalizedPhone);
      if(!item)return {ok:false,reason:'not-found'};
      if(item.status==='Menunggu Verifikasi')return {ok:false,reason:'pending'};
      if(item.status!=='Terverifikasi'||item.businessStatus==='Tidak Aktif')return {ok:false,reason:'inactive'};
      if(!item.passwordHash||!item.passwordSalt)return {ok:false,reason:'credential-missing'};
      const derived=await derivePassword(password,item.passwordSalt);
      if(derived.hash!==item.passwordHash)return {ok:false,reason:'invalid'};
      data.activeSellerEmail=String(item.ownerEmail||item.email||'').trim().toLowerCase();publish();return {ok:true,business:clone(item)};
    },
    ownedBusinesses(email=data.activeSellerEmail){const owner=String(email||'').trim().toLowerCase();return data.businesses.filter(item=>item.ownerId?item.ownerId===activeUserId:item.ownerEmail===owner);},
    updateBusiness(id,patch){const item=data.businesses.find(row=>row.id===id);if(!item)return null;Object.assign(item,patch);publish();if(remote?.ready)persistBusiness(item).catch(error=>window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message})));return clone(item);},
    updateProducts(id,products){const item=data.businesses.find(row=>row.id===id);if(!item)return null;item.productList=products;item.products=products.length;publish();if(remote?.ready)persistBusiness(item).catch(error=>window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message})));return clone(item);},
    removeBusiness(id) {
      const index = data.businesses.findIndex(row => row.id === id);
      if (index < 0) return null;
      const [item] = data.businesses.splice(index, 1);
      data.saved = data.saved.filter(value => value !== id);
      data.following = data.following.filter(value => value !== id);
      delete data.likes[id];
      if(data.activeSellerEmail&&!data.businesses.some(row=>row.ownerEmail===data.activeSellerEmail))data.activeSellerEmail='';
      publish();if(remote?.ready)remote.client.from('businesses').delete().eq('id',id).then(({error})=>{if(error)window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message}));});return clone(item);
    },
    setStatus(id, status) {
      const item = data.businesses.find(row => row.id === id);
      if (!item || item.status === status) return;
      item.status = status;
      if(status!=='Terverifikasi'&&data.activeSellerEmail===item.ownerEmail)data.activeSellerEmail='';
      publish();if(remote?.ready)remote.client.from('businesses').update({status}).eq('id',id).then(({error})=>{if(error)window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message}));});
    },
    toggleIn(list, id) {
      const values = data[list]; const index = values.indexOf(id);
      if (index >= 0) values.splice(index, 1); else values.push(id);
      publish(); return index < 0;
    },
    has(list, id) { return data[list].includes(id); },
    toggleLike(id) {
      data.likes[id] = !data.likes[id]; publish(); return data.likes[id];
    },
    addComment(postId,text){if(!data.comments[postId])data.comments[postId]=[];data.comments[postId].push({text:String(text),createdAt:new Date().toISOString()});publish();},
    addPost(post) { const item={ ...post, id: crypto.randomUUID(), createdAt: new Date().toISOString() };data.posts.unshift(item);publish();if(remote?.ready)remote.client.auth.getUser().then(async({data:{user}})=>{if(!user)throw new Error('Silakan masuk sebagai penjual.');const {error}=await remote.client.from('posts').insert({business_id:item.businessId,owner_id:user.id,text:item.text,product:item.product||null,price:item.price||null});if(error)throw error;}).catch(error=>window.dispatchEvent(new CustomEvent('umkmhub:sync-error',{detail:error.message}))); },
    subscribe(handler) { window.addEventListener('umkmhub:update', event => handler(event.detail)); }
  };
})();
