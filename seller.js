const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
let toastTimer,currentBusinessId='';
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2400);}
window.addEventListener('umkmhub:sync-error',event=>toast(`Sinkronisasi gagal: ${event.detail||'periksa koneksi Supabase.'}`));
const money=value=>new Intl.NumberFormat('id-ID').format(Number(value)||0);
const email=UMKMStore.getActiveSellerEmail();
let owned=UMKMStore.ownedBusinesses(email);
const requested=new URLSearchParams(location.search).get('business');
if(requested&&owned.some(item=>item.id===requested))currentBusinessId=requested;
else currentBusinessId=owned[0]?.id||'';

function selectedBusiness(){return UMKMStore.ownedBusinesses(email).find(item=>item.id===currentBusinessId)||null;}
function render(){
  owned=UMKMStore.ownedBusinesses(email);
  if(!owned.some(item=>item.id===currentBusinessId))currentBusinessId=owned[0]?.id||'';
  $('#seller-empty').hidden=owned.length>0;$('#seller-workspace').hidden=owned.length===0;$('#business-switch-wrap').hidden=owned.length<2;
  $('#seller-account-email').textContent=email||'Belum masuk sebagai penjual';
  if(!owned.length)return;
  const item=selectedBusiness();if(!item)return;
  $('#seller-account-name').textContent=item.owner||'Pemilik UMKM';$('#seller-avatar').textContent=(item.owner||'UM').split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
  $('#seller-status').textContent=item.status;
  const switcher=$('#business-switch');
  if(switcher.options.length!==owned.length||![...switcher.options].some(option=>option.value===currentBusinessId)){
    switcher.replaceChildren(...owned.map(row=>new Option(row.name,row.id)));
  }
  switcher.value=currentBusinessId;
  const form=$('#seller-profile-form');
  for(const name of ['name','category','whatsapp','address','year','employees','revenue','social','description']){
    const control=form.elements.namedItem(name);
    const key=name==='name'?'name':name==='whatsapp'?'whatsapp':name;
    if(control)control.value=item[key]??(name==='whatsapp'?item.phone||'':'');
  }
  $('#seller-product-count').textContent=(item.productList||[]).length;
  $('#product-total').textContent=`${(item.productList||[]).length} produk`;
  renderProducts(item);renderPosts();
  $('#open-public-profile').href=`index.html#discover`;
}
function renderProducts(item){
  const root=$('#seller-products');root.replaceChildren();
  const products=Array.isArray(item.productList)?item.productList:[];
  if(!products.length){const empty=document.createElement('div');empty.className='seller-no-products';empty.textContent='Belum ada produk. Tambahkan produk agar muncul di profil publik.';root.append(empty);return;}
  products.forEach((product,index)=>{const row=document.createElement('div');row.className='seller-product-row';const icon=document.createElement('span');icon.className='seller-product-icon';icon.textContent=product.icon||item.icon||'📦';const details=document.createElement('span');details.className='seller-product-info';const name=document.createElement('b');name.textContent=product.name;const price=document.createElement('small');price.textContent=`Rp ${money(product.price)}`;details.append(name,price);const remove=document.createElement('button');remove.type='button';remove.textContent='Hapus';remove.setAttribute('aria-label',`Hapus produk ${product.name}`);remove.addEventListener('click',()=>{const next=[...products];next.splice(index,1);UMKMStore.updateProducts(currentBusinessId,next);toast('Produk dihapus dari katalog.');});row.append(icon,details,remove);root.append(row);});
}
function renderPosts(){
  const root=$('#seller-post-list');root.replaceChildren();
  const posts=UMKMStore.get().posts.filter(post=>post.businessId===currentBusinessId);
  if(!posts.length){const empty=document.createElement('div');empty.className='seller-no-products';empty.textContent='Postingan usahamu akan tampil di sini.';root.append(empty);return;}
  posts.forEach(post=>{const row=document.createElement('article');row.className='seller-post-item';const text=document.createElement('p');text.textContent=post.text;const detail=document.createElement('small');detail.textContent=[post.product,post.price].filter(Boolean).join(' · ')||'Postingan komunitas';row.append(text,detail);root.append(row);});
}

$('#business-switch').addEventListener('change',event=>{currentBusinessId=event.currentTarget.value;history.replaceState(null,'',`seller.html?business=${encodeURIComponent(currentBusinessId)}`);render();});
$('#seller-profile-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget),address=String(form.get('address')).trim(),whatsapp=String(form.get('whatsapp')).trim();
  const changed=UMKMStore.updateBusiness(currentBusinessId,{name:String(form.get('name')).trim(),category:String(form.get('category')),whatsapp,phone:whatsapp,address,region:address.split(',').at(-1).trim()||address,year:Number(form.get('year'))||null,employees:Number(form.get('employees'))||0,revenue:Number(String(form.get('revenue')).replace(/\D/g,''))||0,social:String(form.get('social')).trim(),description:String(form.get('description')).trim()});
  toast(changed?'Profil usaha tersimpan dan disinkronkan.':'Profil tidak ditemukan.');
});
$('#add-product-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget),item=selectedBusiness();if(!item)return;
  const products=[...(item.productList||[]),{name:String(form.get('productName')).trim(),price:Number(form.get('productPrice'))||0,icon:String(form.get('productIcon')).trim()||item.icon||'📦'}];
  UMKMStore.updateProducts(currentBusinessId,products);event.currentTarget.reset();toast('Produk ditambahkan ke profil publik.');
});
$('#seller-post-form').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.currentTarget),item=selectedBusiness();if(!item)return;
  UMKMStore.addPost({text:String(form.get('postText')).trim(),product:String(form.get('postProduct')).trim(),price:String(form.get('postPrice')).trim(),businessId:item.id,businessName:item.name,ownerEmail:email});
  event.currentTarget.reset();toast('Postingan dipublikasikan ke komunitas.');
});
$$('.seller-nav').forEach(link=>link.addEventListener('click',()=>{$$('.seller-nav').forEach(item=>item.classList.remove('active'));link.classList.add('active');}));
$('#seller-logout').addEventListener('click',()=>{UMKMStore.logoutSeller();location.href='index.html#discover';});
UMKMStore.subscribe(render);
render();
