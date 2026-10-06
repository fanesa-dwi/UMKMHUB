(() => {
  const KEY = 'umkmhub.shared.v1';
  const demoIds = new Set(['hisnesfood', 'dapur-bu-sari', 'ruang-rona', 'kopi-sudut', 'kedai-pagi']);
  const seed = {
    metrics: { total: 0, active: 0, newThisMonth: 0, verified: 0, pending: 0, inactive: 0 },
    businesses: [],
    posts: [], saved: [], following: [], likes: {}, comments:{}, activeSellerEmail: ''
  };
  let data; let storageReady=true;
  try {
    data = JSON.parse(localStorage.getItem(KEY));
    if (!data || !data.metrics || !Array.isArray(data.businesses)) throw new Error('Invalid shared data');
  } catch {
    data = seed;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { storageReady=false; }
  }
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
    if(storageReady){try{localStorage.setItem(KEY, JSON.stringify(data));}catch{storageReady=false;}}
    window.dispatchEvent(new CustomEvent('umkmhub:update', { detail: clone(data) }));
  };
  window.addEventListener('storage', event => {
    if (event.key !== KEY || !event.newValue) return;
    try { data = JSON.parse(event.newValue); window.dispatchEvent(new CustomEvent('umkmhub:update', { detail: clone(data) })); } catch { /* Keep the last valid state. */ }
  });
  window.UMKMStore = {
    key: KEY,
    get: () => clone(data),
    addBusiness(business) {
      const item = { ...business, id: business.id || `umkm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, status: 'Menunggu Verifikasi', createdAt: new Date().toISOString() };
      item.ownerEmail=(item.ownerEmail||item.email||'').trim().toLowerCase();
      if(!item.whatsapp&&item.phone)item.whatsapp=item.phone;
      data.businesses.unshift(item);
      publish(); return clone(item);
    },
    getActiveSellerEmail:()=>data.activeSellerEmail||'',
    logoutSeller(){data.activeSellerEmail='';publish();},
    setActiveSellerEmail(email){const normalized=String(email||'').trim().toLowerCase();data.activeSellerEmail=data.businesses.some(item=>item.ownerEmail===normalized&&item.status==='Terverifikasi'&&item.passwordHash)?normalized:'';publish();},
    hasSellerAccount(phone,email){const normalizedPhone=normalizePhone(phone),normalizedEmail=String(email||'').trim().toLowerCase();return data.businesses.some(item=>(normalizedPhone&&normalizePhone(item.phone||item.whatsapp)===normalizedPhone)||(normalizedEmail&&String(item.ownerEmail||item.email||'').trim().toLowerCase()===normalizedEmail));},
    createSellerCredential(password){return derivePassword(password);},
    async loginSeller(phone,password){
      const normalizedPhone=normalizePhone(phone),item=data.businesses.find(row=>normalizedPhone&&normalizePhone(row.phone||row.whatsapp)===normalizedPhone);
      if(!item)return {ok:false,reason:'not-found'};
      if(item.status==='Menunggu Verifikasi')return {ok:false,reason:'pending'};
      if(item.status!=='Terverifikasi'||item.businessStatus==='Tidak Aktif')return {ok:false,reason:'inactive'};
      if(!item.passwordHash||!item.passwordSalt)return {ok:false,reason:'credential-missing'};
      const derived=await derivePassword(password,item.passwordSalt);
      if(derived.hash!==item.passwordHash)return {ok:false,reason:'invalid'};
      data.activeSellerEmail=String(item.ownerEmail||item.email||'').trim().toLowerCase();publish();return {ok:true,business:clone(item)};
    },
    ownedBusinesses(email=data.activeSellerEmail){const owner=String(email||'').trim().toLowerCase();return data.businesses.filter(item=>item.ownerEmail&&item.ownerEmail===owner);},
    updateBusiness(id,patch){const item=data.businesses.find(row=>row.id===id);if(!item||item.ownerEmail&&item.ownerEmail!==data.activeSellerEmail)return null;Object.assign(item,patch);publish();return clone(item);},
    updateProducts(id,products){const item=data.businesses.find(row=>row.id===id);if(!item||item.ownerEmail&&item.ownerEmail!==data.activeSellerEmail)return null;item.productList=products;item.products=products.length;publish();return clone(item);},
    removeBusiness(id) {
      const index = data.businesses.findIndex(row => row.id === id);
      if (index < 0) return null;
      const [item] = data.businesses.splice(index, 1);
      data.saved = data.saved.filter(value => value !== id);
      data.following = data.following.filter(value => value !== id);
      delete data.likes[id];
      if(data.activeSellerEmail&&!data.businesses.some(row=>row.ownerEmail===data.activeSellerEmail))data.activeSellerEmail='';
      publish(); return clone(item);
    },
    setStatus(id, status) {
      const item = data.businesses.find(row => row.id === id);
      if (!item || item.status === status) return;
      item.status = status;
      if(status!=='Terverifikasi'&&data.activeSellerEmail===item.ownerEmail)data.activeSellerEmail='';
      publish();
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
    addPost(post) { data.posts.unshift({ ...post, id: `post-${Date.now()}`, createdAt: new Date().toISOString() }); publish(); },
    subscribe(handler) { window.addEventListener('umkmhub:update', event => handler(event.detail)); }
  };
})();
