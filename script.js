// script.js
document.addEventListener("DOMContentLoaded", () => {
  const form        = document.getElementById("twitter-form");
  const handleInput = document.getElementById("twitter-handle");

  const formPage   = document.getElementById("form-page");
  const idCardPage = document.getElementById("id-card-page");

  const profileImg   = document.getElementById("profile-img");
  const profileFallback = document.getElementById("profile-fallback");
  const retryPhotoLink = document.getElementById("retry-photo");
  const handleLabel  = document.getElementById("handle-display");
  const seatLabel    = document.getElementById("seat-number");
  const qrImg        = document.getElementById("qr-code");
  const downloadBtn  = document.getElementById("download-btn");
  const confirmedRibbon = document.getElementById("confirmed-ribbon");

  // ---------- Helpers ----------
  const proxify = (raw) => {
    const noProto = raw.replace(/^https?:\/\//, "");
    return `https://images.weserv.nl/?url=${encodeURIComponent(noProto)}&w=512&h=512&fit=cover&il&af`;
  };

  function setRibbonWidthToProfile(){
    const w = Math.round(profileImg.getBoundingClientRect().width);
    if (w > 0 && confirmedRibbon) {
      confirmedRibbon.style.setProperty("--confirm-width", w + "px");
      confirmedRibbon.style.width = "var(--confirm-width)";
    }
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

  // ---------- Avatar: add legacy JSON path FIRST ----------
  async function fetchViaLegacyJSON(handle){
    try {
      const u = handle.replace(/^@/,"").trim();
      const url = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(u)}`;
      const r = await fetch(url, { credentials: "omit", cache: "no-store" });
      if (!r.ok) return null;
      const data = await r.json();
      if (!Array.isArray(data) || !data[0] || !data[0].profile_image_url) return null;
      // get a bigger image (replace _normal with _400x400 if present)
      let img = data[0].profile_image_url.replace("_normal", "_400x400");
      return proxify(img); // proxy for CORS + canvas safety
    } catch { return null; }
  }

  // Fallback race of common endpoints (original + proxied)
  const raceTimeout = 4500;
  function avatarSources(handle, bustToken = ""){
    const u = handle.replace(/^@/,"").trim().toLowerCase();
    const bust = (url) => url + (url.includes("?") ? "&" : "?") + "t=" + bustToken;

    const originals = [
      bust(`https://unavatar.io/twitter/${u}?fallback=false`),
      bust(`https://unavatar.io/x/${u}?fallback=false`),
      bust(`https://unavatar.io/${u}?fallback=false`),
      bust(`https://twivatar.glitch.me/${u}`),
      bust(`https://twitter.com/${u}/profile_image?size=original`)
    ];
    const withProxies = [];
    originals.forEach(src => withProxies.push(src, proxify(src)));
    return withProxies;
  }

  function raceImages(urls, timeout = raceTimeout){
    return new Promise((resolve)=>{
      let settled=false;
      const timer = setTimeout(()=>{ if(!settled){ settled=true; resolve(null); } }, timeout);
      urls.forEach(src=>{
        const img=new Image();
        img.crossOrigin="anonymous";
        img.referrerPolicy="no-referrer";
        img.onload=()=>{ if(settled) return; settled=true; clearTimeout(timer); resolve(src); };
        img.onerror=()=>{};
        img.src=src;
      });
    });
  }

  async function fetchAvatarOrFail(handle){
    // 1) Legacy JSON (most reliable for many accounts like @chukagobu)
    const legacy = await fetchViaLegacyJSON(handle);
    if (legacy) return legacy;

    // 2) Race typical endpoints
    let src = await raceImages(avatarSources(handle, Date.now()), raceTimeout);
    if (src) return src;

    // 3) Quick retry
    src = await raceImages(avatarSources(handle, Date.now()+1), raceTimeout);
    return src;
  }

  const LOCAL_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <rect width='100%' height='100%' fill='#0b1220'/>
      <circle cx='256' cy='200' r='96' fill='#8da3b8'/>
      <rect x='148' y='310' width='216' height='130' rx='24' fill='#8da3b8'/>
    </svg>`);

  async function loadAvatar(handle){
    profileImg.removeAttribute("src");
    profileFallback?.classList.add("d-none");

    const foundSrc = await fetchAvatarOrFail(handle);
    profileImg.setAttribute("fetchpriority","high");
    profileImg.crossOrigin="anonymous";
    profileImg.referrerPolicy="no-referrer";
    profileImg.src = foundSrc || LOCAL_PLACEHOLDER;

    await waitForImage(profileImg);
    if (!foundSrc) profileFallback?.classList.remove("d-none");
    setRibbonWidthToProfile();
    return Boolean(foundSrc);
  }

  // ---------- Submit ----------
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const handle=(handleInput.value||"").trim().replace(/^@/,"");
    if(!/^[A-Za-z0-9_]{1,15}$/.test(handle)){ handleInput.focus(); return; }

    handleLabel.textContent = `@${handle}`;
    seatLabel.textContent   = randomSeat();

    const url = `https://x.com/${handle}`;
    qrImg.crossOrigin = "anonymous";
    qrImg.referrerPolicy = "no-referrer";
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}&t=${Date.now()}`;

    formPage.classList.add("d-none");
    idCardPage.classList.remove("d-none");

    const avatarPromise = loadAvatar(handle);

    await waitForImage(qrImg);
    if (downloadBtn) downloadBtn.disabled = false;

    avatarPromise.finally(()=> setRibbonWidthToProfile());
  });

  retryPhotoLink?.addEventListener("click", async (e)=>{
    e.preventDefault();
    const h = (handleLabel.textContent||"").replace(/^@/,"");
    if(!h) return;
    await loadAvatar(h);
  });

  // ---------- Download ----------
  downloadBtn?.addEventListener("click", async ()=>{
    if (downloadBtn.disabled) return;
    const card = document.getElementById("card");
    const canvas = await html2canvas(card, {
      backgroundColor:null,
      useCORS:true,
      allowTaint:false,
      scale:2.6
    });
    const a=document.createElement("a");
    a.download="aztec-town-hall-id.jpg";
    a.href=canvas.toDataURL("image/jpeg",1.0);
    a.click();
  });
});
