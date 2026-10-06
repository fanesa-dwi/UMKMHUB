const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const search = $('#global-search');
let toastTimer;
const dateLabel=$('.welcome-row .date-label');
if(dateLabel)dateLabel.textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()).toLocaleUpperCase('id');
function toast(message) {
  const box = $('#toast'); box.textContent = message; box.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 2400);
}
function money(value) { return new Intl.NumberFormat('id-ID').format(value); }
function showRegistration() { $('#registration-modal').showModal(); }
function whatsappUrl(phone, businessName='UMKM') { const digits=String(phone||'').replace(/\D/g,'');if(!digits)return '';const intl=digits.startsWith('0')?`62${digits.slice(1)}`:digits;return `https://wa.me/${intl}?text=${encodeURIComponent(`Halo ${businessName}, saya melihat usaha Anda di UMKMHUB dan ingin bertanya tentang produknya.`)}`; }
async function compressBusinessPhoto(file){if(!file||!file.type.startsWith('image/'))return '';const source=URL.createObjectURL(file);try{const image=new Image();image.src=source;await image.decode();const scale=Math.min(1,480/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.72));if(!blob)return '';return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}catch{return '';}finally{URL.revokeObjectURL(source);}}
let activeProfileBusinessId='';

function syncDashboard(data) {
  const [total, active, verified] = $$('.stat-card > strong');
  if (total) total.textContent = money(data.metrics.total);
  if (active) active.textContent = money(data.metrics.active);
  if (verified) verified.textContent = money(data.metrics.verified);
  const sellerLink=$('.seller-dashboard-link');if(sellerLink)sellerLink.hidden=!data.activeSellerEmail;
  const available=new Set(data.businesses.filter(row=>!row.isDemo&&row.status==='Terverifikasi').map(row=>row.id));
  $$('.business-card').forEach(card => {
    const id = card.dataset.id;
    if (!id) return;
    if(!available.has(id)){card.remove();return;}
    const followed=UMKMStore.has('following',id),saved=UMKMStore.has('saved',id);
    const follow=$('.follow-button',card),save=$('.save-button',card);
    if(follow){follow.classList.toggle('following',followed);follow.textContent=followed?'✓ Diikuti':'+ Ikuti';}
    if(save){save.classList.toggle('saved',saved);save.textContent=saved?'♥':'♡';}
    const item = data.businesses.find(row => row.id === id);
    if(item){
      const title=$('.business-title b',card),meta=$('.business-title small',card),description=$('.business-detail > p',card);
      if(title)title.textContent=item.name;
      if(meta)meta.textContent=`● ${item.category} · ${item.region}`;
      if(description)description.textContent=item.description||'Usaha lokal yang tumbuh bersama komunitas.';
      const emoji=$('.cover-emoji',card);if(emoji&&item.icon)emoji.textContent=item.icon;
      const product=Array.isArray(item.productList)?item.productList[0]:null;
      let preview=$('.product-preview',card);
      if(product&&!preview){preview=document.createElement('div');preview.className='product-preview';preview.innerHTML='<span class="product-thumb">📦</span><span><b></b><small></small></span><span class="product-arrow">↗</span>';description?.after(preview);}
      if(preview&&product){$('.product-preview b',preview).textContent=product.name;$('.product-preview small',preview).textContent=`Rp ${money(product.price)}`;}
      if(preview&&!product)preview.remove();
      card.dataset.name=`${item.name} ${item.category} ${item.region}`.toLocaleLowerCase('id');
    }
    const badge = $('.verified', card);
    if (badge && item) {
      badge.textContent = item.status === 'Terverifikasi' ? '✓ Terverifikasi' : item.status;
      badge.classList.toggle('pending-business', item.status === 'Menunggu Verifikasi');
    }
  });
}

$$('.business-card').forEach(card => {
  const title = $('.business-title b', card)?.textContent;
  const matched=UMKMStore.get().businesses.find(item=>item.name===title);
  card.dataset.id = matched?.id || title?.toLowerCase().replaceAll(' ', '-');
});

function createBusinessCard(item) {
  const card = document.createElement('article'); card.className = 'business-card newly-added'; card.dataset.id = item.id; card.dataset.name = `${item.name} ${item.category} ${item.region}`.toLowerCase();
  const cover = document.createElement('div'); cover.className = `business-cover cover-${item.category.toLowerCase()}`;
  const emoji = document.createElement('span'); emoji.className = 'cover-emoji'; emoji.textContent = item.icon || '🏪';
  const status = document.createElement('span'); status.className = `verified ${item.status === 'Terverifikasi' ? '' : 'pending-business'}`; status.textContent = item.status === 'Terverifikasi' ? '✓ Terverifikasi' : item.status;
  const save = document.createElement('button'); save.className = 'save-button'; save.setAttribute('aria-label', `Simpan ${item.name}`); save.textContent = '♡'; cover.append(emoji, status, save);
  const detail = document.createElement('div'); detail.className = 'business-detail';
  const head = document.createElement('div'); head.className = 'business-head';
  const avatar = document.createElement('span'); avatar.className = 'avatar business-avatar avatar-1'; avatar.textContent = item.icon || '🏪';
  const title = document.createElement('span'); title.className = 'business-title'; const name = document.createElement('b'); name.textContent = item.name; const meta = document.createElement('small'); meta.textContent = `● ${item.category} · ${item.region}`; title.append(name, meta);
  const follow = document.createElement('button'); follow.className = 'follow-button'; follow.textContent = '+ Ikuti'; head.append(avatar, title, follow);
  const desc = document.createElement('p'); desc.textContent = item.description || 'Usaha lokal yang tumbuh bersama komunitas.';
  const product=(Array.isArray(item.productList)?item.productList:[])[0];
  if(product){const preview=document.createElement('div');preview.className='product-preview';preview.innerHTML='<span class="product-thumb">📦</span><span><b></b><small></small></span><span class="product-arrow">↗</span>';$('.product-preview b',preview).textContent=product.name;$('.product-preview small',preview).textContent=`Rp ${money(product.price)}`;detail.append(head,desc,preview);}else detail.append(head,desc);
  const footer = document.createElement('div'); footer.className = 'card-footer'; footer.innerHTML = '<span>♡ <b class="like-count">0</b> suka</span><button class="like-button" aria-label="Sukai">♡</button><button class="card-contact">Hubungi ↗</button>';
  detail.append(footer); card.append(cover, detail); $('#business-grid').prepend(card); bindBusinessCard(card);
}

function openBusinessProfile(item) {
  if(!item)return;
  const profile = $('#profile-modal');
  $('.profile-name', profile).textContent = item.name;
  $('.profile-category', profile).textContent = item.category || 'UMKM';
  $('.profile-location', profile).textContent = `📍 ${item.region || 'Indonesia'}`;
  const logo=$('.profile-modal-emoji',profile);logo.replaceChildren();if(item.photoDataUrl){const image=document.createElement('img');image.src=item.photoDataUrl;image.alt=`Logo ${item.name}`;image.className='profile-logo-image';logo.append(image);}else logo.textContent=item.icon||'🏪';
  $('.profile-about', profile).textContent = item.description || 'Usaha lokal yang tumbuh bersama komunitas UMKMHUB.';
  activeProfileBusinessId=item.id;
  const follow = $('.profile-follow', profile); follow.dataset.businessId = item.id;
  follow.classList.toggle('following', UMKMStore.has('following', item.id)); follow.textContent = follow.classList.contains('following') ? '✓ Diikuti' : '+ Ikuti';
  const products = $('.profile-products', profile); products.replaceChildren();
  const productSeeds=item.productList||[];
  if(!productSeeds.length){const empty=document.createElement('p');empty.className='profile-no-products';empty.textContent='Produk akan ditampilkan di sini.';products.append(empty);}
  productSeeds.forEach(product => { const el = document.createElement('div'); el.className = 'profile-product'; el.innerHTML = `<span>${item.icon||'📦'}</span><div><b></b><small></small></div>`; $('b', el).textContent = product.name; $('small', el).textContent = `Rp ${money(product.price||0)}`; products.append(el); });
  profile.showModal();
}
function profileFor(card) { openBusinessProfile(UMKMStore.get().businesses.find(row => row.id === card.dataset.id)); }

function bindBusinessCard(card) {
  const id = card.dataset.id;
  $('.business-title', card)?.addEventListener('click', () => profileFor(card));
  $('.follow-button', card)?.addEventListener('click', event => {
    const followed = UMKMStore.toggleIn('following', id); event.currentTarget.classList.toggle('following', followed); event.currentTarget.textContent = followed ? '✓ Diikuti' : '+ Ikuti'; toast(followed ? 'Kamu mengikuti usaha ini.' : 'Usaha dihapus dari daftar ikutan.');
  });
  $('.save-button', card)?.addEventListener('click', event => {
    const saved = UMKMStore.toggleIn('saved', id); event.currentTarget.classList.toggle('saved', saved); event.currentTarget.textContent = saved ? '♥' : '♡'; toast(saved ? 'UMKM disimpan.' : 'UMKM dihapus dari simpanan.');
  });
  $('.like-button', card)?.addEventListener('click', event => {
    const liked = UMKMStore.toggleLike(id); event.currentTarget.classList.toggle('liked', liked); event.currentTarget.textContent = liked ? '♥' : '♡';
    const count = $('.like-count', card); count.textContent = Math.max(0, Number(count.textContent) + (liked ? 1 : -1));
  });
  $('.card-contact',card)?.addEventListener('click',event=>{event.stopPropagation();const item=UMKMStore.get().businesses.find(row=>row.id===id);const url=whatsappUrl(item?.whatsapp||item?.phone,item?.name);if(url)window.open(url,'_blank','noopener,noreferrer');else toast('Nomor WhatsApp penjual belum tersedia.');});
}

$$('.business-card').forEach(bindBusinessCard);
function renderAddedBusinesses(data) {
  $$('.business-card').forEach(card=>{const item=data.businesses.find(row=>row.id===card.dataset.id);if(!item||item.isDemo)card.remove();});
  const existing = new Set($$('.business-card').map(card => card.dataset.id));
  data.businesses.filter(item=>!item.isDemo&&item.status==='Terverifikasi').forEach(item => { if (!existing.has(item.id)) createBusinessCard(item); });
  renderBuyerCategories(data);
  syncDashboard(data);
  const hisnesfood=data.businesses.some(item=>item.id==='hisnesfood'&&!item.isDemo);
  const post=document.querySelector('[data-business-id="hisnesfood"]');if(post)post.hidden=!hisnesfood;
}

function renderBuyerCategories(data){
  const root=$('.category-row'),selected=root.querySelector('.category-chip.selected')?.dataset.category||'Semua',icons={Kuliner:'🍲',Fashion:'🧵',Kerajinan:'🪴',Kecantikan:'🌼',Minuman:'🥤',Jasa:'💻',Lainnya:'✳'};
  const categories=[...new Set(data.businesses.filter(item=>!item.isDemo&&item.status==='Terverifikasi').map(item=>item.category).filter(Boolean))].sort();
  const values=['Semua',...categories];root.replaceChildren(...values.map((value,index)=>{const button=document.createElement('button');button.className='category-chip';button.dataset.category=value;button.textContent=index===0?'✳ Semua':`${icons[value]||'🏪'} ${value}`;button.classList.toggle('selected',value===selected);return button;}));
  if(!root.querySelector('.selected'))root.firstElementChild?.classList.add('selected');
}

function applySearch() {
  const localSearch=$('#discover-search'),q = (localSearch?.value||search?.value||'').trim().toLocaleLowerCase('id');
  const category = $('.category-chip.selected')?.dataset.category || 'Semua'; let shown = 0;
  $$('.business-card').forEach(card => {
    const item = UMKMStore.get().businesses.find(row => row.id === card.dataset.id);
    const products=(item?.productList||[]).map(product=>product.name).join(' ');
    const text = `${card.dataset.name} ${$('.business-title', card)?.innerText || ''} ${item?.description || ''} ${products}`.toLocaleLowerCase('id');
    const match = (!q || text.includes(q)) && (category === 'Semua' || text.includes(category.toLocaleLowerCase('id')));
    card.hidden = !match; if (match) shown++;
  });
  $('#empty-search').hidden = shown > 0;
}
search?.addEventListener('input',()=>{$('#discover-search').value=search.value;applySearch();});
function setupBuyerDiscover(){
  const section=$('#discover'),heading=$('.section-heading',section),eyebrow=$('.eyebrow',heading),title=$('h2',heading),chips=$('.category-row',section);
  section.classList.add('buyer-discover');eyebrow.textContent='TEMUKAN USAHA LOKAL';title.textContent='Cari UMKM yang kamu butuhkan';
  if(!$('.discover-intro',heading)){const intro=document.createElement('p');intro.className='discover-intro';intro.textContent='Jelajah tanpa akun. Hubungi penjual dan lanjutkan transaksi langsung melalui WhatsApp.';heading.append(intro);}
  if(!$('#discover-search')){const finder=document.createElement('label');finder.className='discover-search';finder.innerHTML='<span aria-hidden="true">⌕</span><input id="discover-search" type="search" placeholder="Cari nama usaha, produk, atau lokasi" aria-label="Cari UMKM berdasarkan nama, produk, atau lokasi">';chips.before(finder);}
  $('#discover-search').addEventListener('input',()=>{search.value=$('#discover-search').value;applySearch();});
}
setupBuyerDiscover();
$('.category-row').addEventListener('click',event=>{const chip=event.target.closest('.category-chip');if(!chip)return;$$('.category-chip').forEach(node=>node.classList.remove('selected'));chip.classList.add('selected');applySearch();});
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && search) { event.preventDefault(); search.focus(); } if (event.key === 'Escape') $$('dialog[open]').forEach(dialog => dialog.close()); });
$$('#add-business, #mobile-add').forEach(button => button.addEventListener('click', showRegistration));
$$('.registration-modal .modal-close, #registration-cancel').forEach(button => button.addEventListener('click', () => $('#registration-modal').close()));
const registrationForm=$('#registration-form'),registrationDialog=$('#registration-modal'),registrationBusinessNodes=$$('#registration-form > .form-section-title, #registration-form > .form-grid'),registrationAccountStep=$('#seller-account-step'),registrationNext=$('#registration-next');
registrationForm.noValidate=true;
let registrationStep=1;
function setRegistrationStep(step){registrationStep=step;registrationBusinessNodes.forEach(node=>node.hidden=step===2);registrationAccountStep.hidden=step!==2;$('#registration-back').hidden=step===1;registrationNext.innerHTML=step===1?'Selanjutnya <span>→</span>':'Kirim pendaftaran <span>→</span>';$('#registration-note').innerHTML=step===1?'Data usaha akan ditinjau admin sebelum akun penjual diaktifkan.':'Setelah admin menyetujui, kamu dapat masuk memakai nomor WhatsApp dan kata sandi ini.';$('#seller-account-phone').value=registrationForm.elements.namedItem('phone').value.trim();if(step===2)$('#seller-password').focus();}
function resetRegistration(){registrationForm.reset();setRegistrationStep(1);}
$('#registration-back').addEventListener('click',()=>setRegistrationStep(1));
registrationDialog.addEventListener('close',resetRegistration);
$('#registration-modal').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
const sellerLoginDialog=$('#seller-login-modal'),sellerLoginForm=$('#seller-login-form');
$('#seller-login-trigger').addEventListener('click',()=>sellerLoginDialog.showModal());
$('.seller-login-close').addEventListener('click',()=>sellerLoginDialog.close());
sellerLoginDialog.addEventListener('click',event=>{if(event.target===event.currentTarget)sellerLoginDialog.close();});
$('#seller-register-trigger').addEventListener('click',()=>{sellerLoginDialog.close();registrationDialog.showModal();});
registrationForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(registrationStep===1){
    const invalid=registrationBusinessNodes.flatMap(node=>[...node.querySelectorAll('input,select,textarea')]).find(field=>field.required&&!field.checkValidity());
    if(invalid){invalid.reportValidity();return;}
    const phone=registrationForm.elements.namedItem('phone').value.trim(),email=registrationForm.elements.namedItem('email').value.trim();
    if(!/^[+\d\s()-]{9,18}$/.test(phone)){toast('Masukkan nomor WhatsApp yang valid.');registrationForm.elements.namedItem('phone').focus();return;}
    if(UMKMStore.hasSellerAccount(phone,email)){toast('Nomor WhatsApp atau email sudah digunakan akun penjual lain.');return;}
    setRegistrationStep(2);return;
  }
  const password=$('#seller-password').value,confirmation=$('#seller-password-confirm').value;
  if(password.length<8){toast('Kata sandi minimal 8 karakter.');$('#seller-password').focus();return;}
  if(password!==confirmation){toast('Ulangi kata sandi dengan benar.');$('#seller-password-confirm').focus();return;}
  const f=new FormData(registrationForm),address=String(f.get('address')).trim(),whatsapp=String(f.get('phone')).trim(),email=String(f.get('email')).trim().toLowerCase();
  if(UMKMStore.hasSellerAccount(whatsapp,email)){toast('Nomor WhatsApp atau email sudah digunakan akun penjual lain.');setRegistrationStep(1);return;}
  registrationNext.disabled=true;
  try{
    const credential=await UMKMStore.createSellerCredential(password);
    const item=UMKMStore.addBusiness({name:String(f.get('business')).trim(),owner:String(f.get('owner')).trim(),phone:whatsapp,whatsapp,email,ownerEmail:email,passwordSalt:credential.salt,passwordHash:credential.hash,ownerAddress:String(f.get('ownerAddress')).trim(),category:String(f.get('category')),year:Number(f.get('year'))||null,region:address.split(',').at(-1).trim()||address,address,description:String(f.get('description')).trim(),employees:Number(f.get('employees'))||0,revenue:Number(String(f.get('revenue')).replace(/\D/g,''))||0,products:Number(f.get('products'))||0,productList:[],businessStatus:String(f.get('businessStatus')),social:String(f.get('social')).trim(),photoName:f.get('photo')?.name||'',photoDataUrl:await compressBusinessPhoto(f.get('photo')),icon:'🏪'});
    registrationDialog.close();toast(`${item.name} terkirim untuk verifikasi. Login aktif setelah admin menyetujui.`);
  }catch(error){toast(error?.message?.includes('Secure password')?'Browser belum mendukung penyimpanan kata sandi aman. Buka melalui localhost atau HTTPS.':'Pendaftaran gagal disimpan. Coba lagi.');}
  finally{registrationNext.disabled=false;}
});
sellerLoginForm.addEventListener('submit',async event=>{
  event.preventDefault();const form=new FormData(sellerLoginForm),phone=String(form.get('phone')).trim(),password=String(form.get('password')),message=$('#seller-login-message'),submit=sellerLoginForm.querySelector('[type="submit"]');
  message.textContent='Memeriksa akun…';submit.disabled=true;
  try{const result=await UMKMStore.loginSeller(phone,password);if(!result.ok){message.textContent=({pending:'Pendaftaran masih menunggu verifikasi admin.',inactive:'Akun penjual sedang tidak aktif.',invalid:'Nomor WhatsApp atau kata sandi salah.','not-found':'Akun dengan nomor tersebut tidak ditemukan.','credential-missing':'Akun lama belum memiliki kata sandi. Hubungi admin untuk mengaktifkannya.'})[result.reason]||'Tidak dapat masuk.';return;}location.href='seller.html';}
  catch{message.textContent='Login gagal. Pastikan browser mendukung penyimpanan aman dan coba lagi.';}
  finally{submit.disabled=false;}
});

$$('.feed-like').forEach(button => button.addEventListener('click', event => { const node=event.currentTarget; const liked=node.classList.toggle('liked'); const n=Number(node.dataset.count||node.querySelector('span').textContent.match(/\d+/)?.[0]||0)+(liked?1:-1);node.dataset.count=n;node.innerHTML=`${liked?'♥':'♡'} <span>${n} suka</span>`; }));
$$('.comment-box button').forEach(button => button.addEventListener('click', event => { const input=event.currentTarget.closest('.comment-box').querySelector('input'); if(!input.value.trim()){input.focus();return;} toast('Komentarmu berhasil ditambahkan.');input.value=''; }));
$$('.comment-box input').forEach(input => input.addEventListener('keydown', event => { if(event.key==='Enter') input.closest('.comment-box').querySelector('button').click(); }));
$$('.share-action').forEach(button => button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Tautan berhasil disalin.'); } catch { toast('Tautan siap dibagikan.'); } }));

const postModal=$('#post-modal'); $('#compose-post').addEventListener('click',()=>postModal.showModal());
$$('.post-close,.post-cancel').forEach(button=>button.addEventListener('click',()=>postModal.close()));
$('#post-form').addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget),seller=UMKMStore.ownedBusinesses()[0];if(!seller){toast('Masuk sebagai penjual untuk membuat postingan.');postModal.close();return;}UMKMStore.addPost({text:String(f.get('postText')).trim(),product:String(f.get('postProduct')).trim(),price:String(f.get('postPrice')).trim(),businessId:seller.id,businessName:seller.name,ownerEmail:seller.ownerEmail});postModal.close();event.currentTarget.reset();toast('Postingan dipublikasikan.');});
function renderPosts(data){const community=$('#community');$$('.user-post',community).forEach(node=>node.remove());data.posts.filter(post=>post.businessId&&data.businesses.some(item=>item.id===post.businessId&&item.status==='Terverifikasi'&&!item.isDemo)).forEach(post=>{const business=data.businesses.find(item=>item.id===post.businessId);const card=document.createElement('article');card.className='feed-card user-post';const heading=document.createElement('div');heading.className='feed-top';const storeLink=document.createElement('button');storeLink.type='button';storeLink.className='community-store-link';const avatar=document.createElement('span');avatar.className='community-store-avatar';if(business.photoDataUrl){const image=document.createElement('img');image.src=business.photoDataUrl;image.alt='';avatar.append(image);}else avatar.textContent=business.icon||'🏪';const identity=document.createElement('span');identity.className='community-store-name';identity.innerHTML='<b></b><small></small>';identity.querySelector('b').textContent=business.name;identity.querySelector('small').textContent=`${business.category||'UMKM'} · ${business.region||'Indonesia'} · ✓ Terverifikasi`;storeLink.append(avatar,identity);storeLink.setAttribute('aria-label',`Lihat profil toko ${business.name}`);storeLink.addEventListener('click',()=>openBusinessProfile(business));heading.append(storeLink);const follow=document.createElement('button');follow.className='post-follow';const isFollowing=UMKMStore.has('following',business.id);follow.textContent=isFollowing?'✓ Diikuti':'+ Ikuti';follow.classList.toggle('following',isFollowing);follow.addEventListener('click',()=>UMKMStore.toggleIn('following',business.id));const save=document.createElement('button');save.type='button';save.className='post-save';save.setAttribute('aria-label',`Simpan ${business.name}`);const isSaved=UMKMStore.has('saved',business.id);save.textContent=isSaved?'♥ Tersimpan':'♡ Simpan';save.classList.toggle('is-saved',isSaved);save.addEventListener('click',()=>UMKMStore.toggleIn('saved',business.id));heading.append(save,follow);card.append(heading);const p=document.createElement('p');p.textContent=post.text;card.append(p);if(post.product){const product=document.createElement('div');product.className='post-product';product.innerHTML='<span>📦</span><div><b></b><small></small></div><button type="button">Lihat produk ↗</button>';$('.post-product b',product).textContent=post.product;$('.post-product small',product).textContent=post.price||'Hubungi untuk harga';$('button',product).addEventListener('click',()=>openBusinessProfile(business));card.append(product);}const contact=document.createElement('button');contact.type='button';contact.className='community-contact-button';contact.textContent='Kunjungi toko & lihat semua produk';contact.addEventListener('click',()=>openBusinessProfile(business));card.append(contact);const actions=document.createElement('div');actions.className='feed-actions';actions.innerHTML='<button class="feed-like">♡ <span>0 suka</span></button><button class="comment-action">▢ <span>0 komentar</span></button><button class="share-action">↗ <span>Bagikan</span></button>';actions.querySelector('.feed-like').addEventListener('click',event=>{const button=event.currentTarget,liked=button.classList.toggle('liked');button.innerHTML=`${liked?'♥':'♡'} <span>${liked?1:0} suka</span>`;});actions.querySelector('.comment-action').addEventListener('click',()=>toast('Ruang komentar siap dibuka.'));actions.querySelector('.share-action').addEventListener('click',()=>toast('Tautan postingan siap dibagikan.'));card.append(actions);community.append(card);});}
function syncCommunityEmpty(data){const empty=$('#community-empty');if(empty)empty.hidden=data.posts.some(post=>post.businessId&&data.businesses.some(item=>item.id===post.businessId&&item.status==='Terverifikasi'&&!item.isDemo));$('#compose-post').hidden=!data.activeSellerEmail;}
function renderSavedBusinesses(data){const root=$('#saved-grid'),empty=$('#saved-empty');if(!root||!empty)return;const saved=data.businesses.filter(item=>data.saved.includes(item.id)&&item.status==='Terverifikasi'&&!item.isDemo);root.replaceChildren();empty.hidden=saved.length>0;saved.forEach(item=>{const card=document.createElement('article');card.className='saved-card';const avatar=document.createElement('span');avatar.className='saved-avatar';if(item.photoDataUrl){const image=document.createElement('img');image.src=item.photoDataUrl;image.alt=`Logo ${item.name}`;avatar.append(image);}else avatar.textContent=item.icon||'🏪';const info=document.createElement('div');info.className='saved-info';const name=document.createElement('b');name.textContent=item.name;const meta=document.createElement('small');meta.textContent=`${item.category||'UMKM'} · ${item.region||'Indonesia'}`;info.append(name,meta);const visit=document.createElement('button');visit.type='button';visit.className='saved-visit';visit.textContent='Lihat toko & produk';visit.addEventListener('click',()=>openBusinessProfile(item));const remove=document.createElement('button');remove.type='button';remove.className='saved-remove';remove.setAttribute('aria-label',`Hapus ${item.name} dari daftar tersimpan`);remove.textContent='♥';remove.addEventListener('click',()=>UMKMStore.toggleIn('saved',item.id));card.append(avatar,info,visit,remove);root.append(card);});}

function syncSellerPostActions(data){
  const posts=data.posts.filter(post=>post.businessId&&data.businesses.some(item=>item.id===post.businessId&&item.status==='Terverifikasi'&&!item.isDemo));
  $$('.user-post').forEach((card,index)=>{
    const post=posts[index];if(!post)return;card.dataset.postId=post.id;
    const liked=Boolean(data.likes[`post:${post.id}`]);const like=card.querySelector('.feed-like');
    if(like){like.classList.toggle('liked',liked);like.innerHTML=`${liked?'♥':'♡'} <span>${liked?1:0} suka</span>`;}
    const comments=data.comments[post.id]||[];const commentButton=card.querySelector('.comment-action');
    if(commentButton)commentButton.innerHTML=`▢ <span>${comments.length} komentar</span>`;
    let thread=card.querySelector('.seller-comment-thread');if(!thread){thread=document.createElement('div');thread.className='seller-comment-thread';card.append(thread);}
    thread.replaceChildren(...comments.map(comment=>{const line=document.createElement('p');line.textContent=comment.text;return line;}));
    let composer=card.querySelector('.comment-box');if(!composer){composer=document.createElement('div');composer.className='comment-box';composer.innerHTML='<span class="avatar mini user-avatar">🧑</span><input aria-label="Tulis komentar" placeholder="Tulis komentar yang baik..."><button>Kirim</button>';card.append(composer);}
  });
}
document.addEventListener('click',event=>{
  const like=event.target.closest('.user-post .feed-like');
  if(like){event.preventDefault();event.stopImmediatePropagation();UMKMStore.toggleLike(`post:${like.closest('.user-post').dataset.postId}`);return;}
  const send=event.target.closest('.user-post .comment-box button');
  if(send){event.preventDefault();event.stopImmediatePropagation();const card=send.closest('.user-post'),input=card.querySelector('.comment-box input'),text=input.value.trim();if(!text){input.focus();return;}const id=card.dataset.postId;input.value='';UMKMStore.addComment(id,text);toast('Komentar berhasil ditambahkan.');return;}
  const comment=event.target.closest('.user-post .comment-action');
  if(comment){event.preventDefault();event.stopImmediatePropagation();comment.closest('.user-post').querySelector('.comment-box input').focus();}
},true);

$('.profile-close').addEventListener('click',()=>$('#profile-modal').close());
$('.profile-follow').addEventListener('click',event=>{const button=event.currentTarget;const followed=UMKMStore.toggleIn('following',button.dataset.businessId);button.classList.toggle('following',followed);button.textContent=followed?'✓ Diikuti':'+ Ikuti';});
$('.contact-owner').addEventListener('click',()=>{const item=UMKMStore.get().businesses.find(row=>row.id===activeProfileBusinessId);const url=whatsappUrl(item?.whatsapp||item?.phone,item?.name);if(url)window.open(url,'_blank','noopener,noreferrer');else toast('Nomor WhatsApp penjual belum tersedia.');});
$('#mobile-profile-link')?.addEventListener('click',event=>{if(!UMKMStore.getActiveSellerEmail()){event.preventDefault();toast('Daftarkan usaha terlebih dahulu untuk membuat dashboard penjual.');}});
$('.view-all')?.addEventListener('click',event=>{event.preventDefault();$('#business-grid')?.scrollIntoView({behavior:'smooth',block:'center'});});
$$('.feed-more').forEach(button=>button.addEventListener('click',()=>toast('Pilihan postingan: laporkan atau salin tautan.')));
$$('.feed-actions button:not(.feed-like):not(.share-action)').forEach(button=>button.addEventListener('click',()=>button.closest('.feed-card').querySelector('.comment-box input')?.focus()||toast('Komentar pada postingan.')));
$$('.hero-dots i').forEach((dot,index)=>dot.addEventListener('click',()=>{$$('.hero-dots i').forEach(item=>item.classList.remove('on'));dot.classList.add('on');const messages=['Bangga produk lokal','Cerita usaha penuh makna','Tumbuh bersama komunitas'];$('.floating-note').textContent=`✦  ${messages[index]}`;}));
$('.text-link').addEventListener('click',()=>location.hash='programs');
$('#faq-seller-register')?.addEventListener('click',showRegistration);
$$('.post-product>button').forEach(button=>button.addEventListener('click',()=>{const item=UMKMStore.get().businesses.find(row=>row.id==='hisnesfood');const url=whatsappUrl(item?.whatsapp||item?.phone,'Hisnesfood');if(url)window.open(url,'_blank','noopener,noreferrer');else toast('Nomor WhatsApp penjual belum tersedia.');}));
$$('a[href^="#"]').forEach(anchor=>{if(anchor.classList.contains('view-all')||anchor.classList.contains('see-all'))return;anchor.addEventListener('click',event=>{const target=$(anchor.getAttribute('href'));if(!target){event.preventDefault();toast('Halaman ini akan segera tersedia.');}});});

const initial=UMKMStore.get();renderAddedBusinesses(initial);renderPosts(initial);renderSavedBusinesses(initial);syncCommunityEmpty(initial);syncSellerPostActions(initial);applySearch();UMKMStore.subscribe(data=>{renderAddedBusinesses(data);renderPosts(data);renderSavedBusinesses(data);syncCommunityEmpty(data);syncSellerPostActions(data);applySearch();});
if(UMKMStore.getActiveSellerEmail()){$('.seller-dashboard-link').hidden=false;$('#seller-login-trigger').hidden=true;}
function syncActiveNavigation(){const allowed=new Set(['home','community','programs','saved','tentang']),requested=location.hash.slice(1),page=allowed.has(requested)?requested:'home';$$('.page-view').forEach(view=>{view.hidden=view.dataset.pageView!==page;});$$('.main-nav .nav-link[href^="#"],.mobile-nav a[href^="#"]').forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${page}`));window.scrollTo(0,0);}
window.addEventListener('hashchange',syncActiveNavigation);syncActiveNavigation();
