// Progressive avatar + smaller ID (clean build)

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("twitter-form");
  const handleInput = document.getElementById("twitter-handle");

  const formPage = document.getElementById("form-page");
  const idCardPage = document.getElementById("id-card-page");

  const profileImg = document.getElementById("profile-img");
  const profileFallback = document.getElementById("profile-fallback");
  const retryPhotoLink = document.getElementById("retry-photo");
  const handleLabel = document.getElementById("handle-display");
  const seatLabel = document.getElementById("seat-number");
  const qrImg = document.getElementById("qr-code");
  const downloadBtn = document.getElementById("download-btn");
  const confirmedRibbon = document.getElementById("confirmed-ribbon");

  // tiny inline placeholder (if low-res fails)
  const LOCAL_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
      <rect width='100%' height='100%' fill='#0b1220'/>
      <circle cx='128' cy='96' r='56' fill='#8da3b8'/>
      <rect x='74' y='160' width='108' height='72' rx='14' fill='#8da3b8'/>
    </svg>`);

  // CORS-safe proxy for canvas (so downloads include the avatar)
  const proxify = (raw) => {
    const noProto = raw.replace(/^https?:\/\//, "");
    return `https://images.weserv.nl/?url=${encodeURIComponent(noProto)}&w=512&h=512&fit=cover&il&af`;
  };

  function setRibbonWidthToProfile(){
    const w = Math.round(profileImg.getBoundingClientRect().width);
    if (w > 0 && confirmedRibbon) confirmedRibbon.style.setProperty("--confirm-width", w + "px");
  }
  window.addEventListener("resize", setRibbonWidthToProfile);

  function randomSeat(){
    const g=String(Math.floor(Math.random()*25)+1).padStart(2,"0");
    const r=String(Math.floor(Math.random()*20)+1).padStart(2,"0");
    const s=String(Math.floor(Math.random()*50)+1).padStart(2,"0");
    return `Gate ${g} · Row ${r} · Seat ${s}`;
  }

  function waitForImage(el){
    return new Promise((res)=>{ if(el.complete && el.naturalWidth>0) return res(true);
      el.onload=()=>res(true); el.onerror=()=>res(true); });
  }

  /* ---------- Avatar discovery ---------- */
  async function fetchViaLegacyJSON(handle){
    try {
      const u = handle.replace(/^@/,"").trim();
      const url = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(u)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return null;
      const data = await r.json();
      if (!Array.isArray(data) || !data[0] || !data[0].profile_image_url) return null;
      return {
        low: proxify(data[0].profile_image_url),                         // ..._normal
        high: proxify(data[0].profile_image_url.replace("_normal","_400x400"))
      };
    } catch { return null; }
  }

  async function fetchViaUnavatarJSON(handle){
    try{
      const u = handle.replace(/^@/,"").trim().toLowerCase();
      const url = `https://unavatar.io/${encodeURIComponent(u)}.json`;
      const r = await fetch(url, { cache: "no-store" });
      if(!r.ok) return null;
      const data = await r.json();
      if (data?.url) return { low: proxify(data.url), high: proxify(data.url) };
      return null;
    }catch{ return null; }
  }

  const raceTimeout = 2000;
  function avatarSources(handle, bustToken=""){
    const u = handle.replace(/^@/,"").trim().toLowerCase();
    const bust = (url)=> url + (url.includes("?")?"&":"?") + "t=" + bustToken;
    const originals = [
      bust(`https://unavatar.io/twitter/${u}?fallback=false`),
      bust(`https://twivatar.glitch.me/${u}`),
      bust(`https://twitter.com/${u}/profile_image?size=original`)
    ];
    const withProxies = [];
    originals.forEach(src => { withProxies.push(src, proxify(src)); });
    return withProxies;
  }

  function raceImages(urls, timeout=raceTimeout){
    return new Promise((resolve)=>{
      let settled=false;
      const timer = setTimeout(()=>{ if(!settled){ settled=true; resolve(null); } }, timeout);
      urls.forEach(src=>{
        const img=new Image();
        img.crossOrigin="anonymous";
        img.onload=()=>{ if(settled) return; settled=true; clearTimeout(timer); resolve(src); };
        img.onerror=()=>{};
        img.src=src;
      });
    });
  }

  // Build {low, high} for progressive swap
  async function pickAvatarPair(handle){
    let pair = await fetchViaLegacyJSON(handle);
    if (pair) return pair;

    pair = await fetchViaUnavatarJSON(handle);
    if (pair) return pair;

    // Fallback: low from unavatar size=64, race for high
    const u = handle.replace(/^@/,"").trim().toLowerCase();
    const low = proxify(`https://unavatar.io/twitter/${u}?fallback=false&size=64`);
    let high = await raceImages(avatarSources(handle, Date.now()), raceTimeout);
    if (!high) high = await raceImages(avatarSources(handle, Date.now()+1), raceTimeout);
    if (high) high = proxify(high);
    return { low, high: high || low };
  }

  async function loadAvatar(handle){
    profileFallback.classList.add("d-none");

    const { low, high } = await pickAvatarPair(handle);

    profileImg.setAttribute("fetchpriority","high");
    profileImg.crossOrigin = "anonymous";
    profileImg.referrerPolicy = "no-referrer";
    profileImg.src = low || LOCAL_PLACEHOLDER;     // show something immediately
    await waitForImage(profileImg);
    setRibbonWidthToProfile();

    if (high && high !== low) {
      const hi = new Image();
      hi.crossOrigin = "anonymous";
      hi.onload = () => { profileImg.src = high; setRibbonWidthToProfile(); };
      hi.onerror = () => {};
      hi.src = high;
    }
  }

  /* ---------- Generate ---------- */
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const handle=(handleInput.value||"").trim().replace(/^@/,"");
    if(!/^[A-Za-z0-9_]{1,15}$/.test(handle)){ handleInput.focus(); return; }

    handleLabel.textContent = `@${handle}`;
    seatLabel.textContent   = randomSeat();

    const url = `https://x.com/${handle}`;
    qrImg.crossOrigin = "anonymous";
    qrImg.referrerPolicy = "no-referrer";
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}&t=${Date.now()}`;

    formPage.classList.add("d-none");
    idCardPage.classList.remove("d-none");

    loadAvatar(handle);

    await waitForImage(qrImg);
    downloadBtn.disabled = false;
  });

  retryPhotoLink?.addEventListener("click", async (e)=>{
    e.preventDefault();
    const h = (handleLabel.textContent||"").replace(/^@/,"");
    if(!h) return;
    await loadAvatar(h);
  });

  /* ---------- Download ---------- */
  downloadBtn?.addEventListener("click", async ()=>{
    const card = document.getElementById("card");
    const canvas = await html2canvas(card, { backgroundColor:null, useCORS:true, scale:2 });
    const a=document.createElement("a");
    a.download="aztec-town-hall-id.jpg";
    a.href=canvas.toDataURL("image/jpeg",1.0);
    a.click();
  });
});
