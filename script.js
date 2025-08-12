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

  /* ---------- helpers ---------- */
  const LOCAL_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'>
      <rect width='100%' height='100%' fill='#0b1220'/>
      <circle cx='256' cy='200' r='96' fill='#8da3b8'/>
      <rect x='148' y='310' width='216' height='130' rx='24' fill='#8da3b8'/>
    </svg>`);

  const proxify = (raw) => {
    const noProto = raw.replace(/^https?:\/\//, "");
    // weserv proxy keeps it CORS-safe for canvas; cover & sharpen
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

  /* ---------- avatar fetching ---------- */

  // 1) Fast JSON to resolve the actual pbs image, then proxify it
  async function fetchViaLegacyJSON(handle){
    try {
      const u = handle.replace(/^@/,"").trim();
      const url = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(u)}`;
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 3500);
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!r.ok) return null;
      const data = await r.json();
      if (!Array.isArray(data) || !data[0] || !data[0].profile_image_url) return null;
      let img = data[0].profile_image_url.replace("_normal", "_400x400");
      return proxify(img);
    } catch { return null; }
  }

  // 2) Aggressive race (original + proxied variants)
  const raceTimeout = 3500;
  function avatarSources(handle, bustToken=""){
    const u = handle.replace(/^@/,"").trim().toLowerCase();
    const bust = (url)=> url + (url.includes("?")?"&":"?") + "t=" + bustToken;
    const originals = [
      bust(`https://unavatar.io/twitter/${u}?fallback=false`),
      bust(`https://unavatar.io/x/${u}?fallback=false`),
      bust(`https://unavatar.io/${u}?fallback=false`),
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
        img.referrerPolicy="no-referrer";
        img.onload=()=>{ if(settled) return; settled=true; clearTimeout(timer); resolve(src); };
        img.onerror=()=>{};
        img.src=src;
      });
    });
  }

  async function pickAvatarURL(handle){
    // try JSON first (usually instant)
    const jsonSrc = await fetchViaLegacyJSON(handle);
    if (jsonSrc) return jsonSrc;

    // race common endpoints
    let src = await raceImages(avatarSources(handle, Date.now()), raceTimeout);
    if (src) return src;

    // quick retry
    src = await raceImages(avatarSources(handle, Date.now()+1), raceTimeout);
    return src;
  }

  async function loadAvatar(handle){
    // show something instantly, then swap when real avatar is ready
    profileImg.src = LOCAL_PLACEHOLDER;
    profileImg.crossOrigin = "anonymous";
    profileImg.referrerPolicy = "no-referrer";
    profileFallback?.classList.add("d-none");
    setRibbonWidthToProfile();

    const foundSrc = await pickAvatarURL(handle);
    if (foundSrc){
      profileImg.setAttribute("fetchpriority","high");
      profileImg.src = foundSrc;
      await waitForImage(profileImg);
      setRibbonWidthToProfile();
      return true;
    } else {
      // keep placeholder visible and show retry hint (optional)
      profileFallback?.classList.remove("d-none");
      setRibbonWidthToProfile();
      return false;
    }
  }

  /* ---------- submit flow ---------- */
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const handle=(handleInput.value||"").trim().replace(/^@/,"");
    if(!/^[A-Za-z0-9_]{1,15}$/.test(handle)){ handleInput.focus(); return; }

    handleLabel.textContent = `@${handle}`;
    seatLabel.textContent   = randomSeat();

    // QR sized to CSS
    const url = `https://x.com/${handle}`;
    qrImg.crossOrigin = "anonymous";
    qrImg.referrerPolicy = "no-referrer";
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}&t=${Date.now()}`;

    // swap pages immediately for snappy UX
    formPage.classList.add("d-none");
    idCardPage.classList.remove("d-none");

    // start avatar load (placeholder shows immediately)
    const avatarPromise = loadAvatar(handle);

    // enable download as soon as QR is ready
    await waitForImage(qrImg);
    if (downloadBtn) downloadBtn.disabled = false;

    avatarPromise.finally(setRibbonWidthToProfile);
  });

  retryPhotoLink?.addEventListener("click", async (e)=>{
    e.preventDefault();
    const h = (handleLabel.textContent||"").replace(/^@/,"");
    if(!h) return;
    await loadAvatar(h);
  });

  /* ---------- download ---------- */
  downloadBtn?.addEventListener("click", async ()=>{
    if (downloadBtn.disabled) return;
    const card = document.getElementById("card");
    const canvas = await html2canvas(card, {
      backgroundColor:null,
      useCORS:true,
      allowTaint:false,
      scale:2.2
    });
    const a=document.createElement("a");
    a.download="aztec-town-hall-id.jpg";
    a.href=canvas.toDataURL("image/jpeg",1.0);
    a.click();
  });
});
