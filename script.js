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

  const LOCAL_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'><rect width='100%' height='100%' fill='#0b1220'/></svg>`);
  const proxify = raw => `https://images.weserv.nl/?url=${encodeURIComponent(raw.replace(/^https?:\/\//, ""))}&w=512&h=512&fit=cover&il&af`;

  const fetchViaLegacyJSON = async handle => {
    try {
      const url = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(handle)}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();
      if (data[0]?.profile_image_url) return proxify(data[0].profile_image_url.replace("_normal", "_400x400"));
    } catch { return null; }
  };

  const avatarSources = (handle, bustToken="") => {
    const u = handle.toLowerCase();
    const bust = url => url + (url.includes("?")?"&":"?") + "t=" + bustToken;
    const urls = [
      `https://unavatar.io/twitter/${u}`,
      `https://unavatar.io/x/${u}`,
      `https://twivatar.glitch.me/${u}`,
      `https://twitter.com/${u}/profile_image?size=original`
    ];
    return urls.flatMap(src => [bust(src), proxify(bust(src))]);
  };

  const raceImages = (urls, timeout=2000) => new Promise(resolve => {
    let done=false;
    const timer=setTimeout(()=>!done&&(done=true,resolve(null)), timeout);
    urls.forEach(src=>{
      const img=new Image();
      img.crossOrigin="anonymous";
      img.onload=()=>{if(!done){done=true;clearTimeout(timer);resolve(src);}};
      img.src=src;
    });
  });

  const pickAvatarURL = async handle => {
    let src = await fetchViaLegacyJSON(handle);
    if (src) return src;
    src = await raceImages(avatarSources(handle, Date.now()), 2000);
    if (src) return src;
    return await raceImages(avatarSources(handle, Date.now()+1), 2000);
  };

  const loadAvatar = async handle => {
    profileImg.src = LOCAL_PLACEHOLDER;
    const foundSrc = await pickAvatarURL(handle);
    if (foundSrc) profileImg.src = foundSrc;
  };

  const randomSeat = () => `Gate ${String(Math.floor(Math.random()*25)+1).padStart(2,"0")} · Row ${String(Math.floor(Math.random()*20)+1).padStart(2,"0")} · Seat ${String(Math.floor(Math.random()*50)+1).padStart(2,"0")}`;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const handle = handleInput.value.replace(/^@/, "");
    handleLabel.textContent = `@${handle}`;
    seatLabel.textContent = randomSeat();
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(`https://x.com/${handle}`)}`;
    formPage.classList.add("d-none");
    idCardPage.classList.remove("d-none");
    loadAvatar(handle);
  });

  downloadBtn.addEventListener("click", async () => {
    const card = document.getElementById("card");
    const canvas = await html2canvas(card, { backgroundColor:null, useCORS:true, scale:2.2 });
    const a=document.createElement("a");
    a.download="aztec-town-hall-id.jpg";
    a.href=canvas.toDataURL("image/jpeg",1.0);
    a.click();
  });
});
