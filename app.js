const SUBJECTS_CORE = ["English","Math","Science","Chinese", "Thai"];
const SUBJECTS_COCORE = ["Drama","Art","ICT","Social Studies","Music","PE"];

const $ = (id) => document.getElementById(id);

function toBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function safeText(s){
  return (s || "").toString().replace(/[<>&]/g, (c)=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c]));
}

function downloadBlob(filename, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
}

async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  }catch{
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("Copied to clipboard!");
  }
}

/* --------------------------
   State (auto-saved)
--------------------------- */
const defaultState = {
  studentName: "",
  studentSection: "",
  studentPhoto: "",

  favCore: "",
  favCoCore: "",
  favActivity: "",
  favExplanation: "",

  challenge1: "",
  challenge2: "",
  challengeExplanation: "",

  ratings: {},

  imgCore: "",
  imgCoCore: "",

  comments: ""
};

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem("slc_state_v1");
    if(!raw) return structuredClone(defaultState);
    const obj = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...obj };
  }catch{
    return structuredClone(defaultState);
  }
}

function saveState(){
  localStorage.setItem("slc_state_v1", JSON.stringify(state));
  updateSentences();
  updateAverages();
  updatePresentName();

  // if present is open, keep it updated
  if($("presentOverlay")?.style.display === "block"){
    renderSlide();
  }
}

/* --------------------------
   Export / Import JSON
--------------------------- */
function exportToJSON(){
  const name = (state.studentName || "name")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const filename = `slc-${name || "name"}.json`;

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
}


async function importFromJSONFile(file){
  const text = await file.text();
  let payload;
  try{
    payload = JSON.parse(text);
  }catch{
    alert("That file is not valid JSON.");
    return;
  }

  const incoming = payload?.state;
  if(!incoming || typeof incoming !== "object"){
    alert("JSON file missing 'state'.");
    return;
  }

  state = { ...structuredClone(defaultState), ...incoming };
  localStorage.setItem("slc_state_v1", JSON.stringify(state));
  applyStateToUI();
  alert("Imported successfully!");
}

/* --------------------------
   Build Star UI
--------------------------- */
function buildStarRow(subject, groupKey){
  const row = document.createElement("div");
  row.className = "subjectRow";

  const name = document.createElement("div");
  name.className = "subjectName";
  name.textContent = subject;

  const starBar = document.createElement("div");
  starBar.className = "starBar";

  const key = `${groupKey}:${subject}`;
  const current = Number(state.ratings[key] || 0);

  for(let i=1;i<=5;i++){
    const b = document.createElement("div");
    b.className = "star" + (i <= current ? " on" : "");
    b.textContent = "⭐";
    b.title = `${i} star${i>1?"s":""}`;
    b.addEventListener("click", () => {
      state.ratings[key] = i;
      [...starBar.children].forEach((child, idx) => {
        child.classList.toggle("on", idx < i);
      });
      saveState();
    });
    starBar.appendChild(b);
  }

  row.appendChild(name);
  row.appendChild(starBar);
  return row;
}

function renderSubjects(){
  const coreList = $("coreList");
  const cocoreList = $("cocoreList");
  coreList.innerHTML = "";
  cocoreList.innerHTML = "";

  SUBJECTS_CORE.forEach(s => coreList.appendChild(buildStarRow(s, "core")));
  SUBJECTS_COCORE.forEach(s => cocoreList.appendChild(buildStarRow(s, "cocore")));

  updateAverages();
}

function updateAverages(){
  const coreVals = SUBJECTS_CORE.map(s => Number(state.ratings[`core:${s}`] || 0)).filter(n => n>0);
  const cocoreVals = SUBJECTS_COCORE.map(s => Number(state.ratings[`cocore:${s}`] || 0)).filter(n => n>0);

  $("avgCore").textContent = coreVals.length
    ? `Average: ${(coreVals.reduce((a,b)=>a+b,0)/coreVals.length).toFixed(1)}`
    : "Average: —";

  $("avgCoCore").textContent = cocoreVals.length
    ? `Average: ${(cocoreVals.reduce((a,b)=>a+b,0)/cocoreVals.length).toFixed(1)}`
    : "Average: —";
}

/* --------------------------
   Sentences
--------------------------- */
function updateSentences(){
  const favCore = state.favCore || "…";
  const favCo = state.favCoCore ? `, and my favorite co-core subject is ${state.favCoCore}` : "";
  const favAct = state.favActivity ? `, and my favorite activity is ${state.favActivity}` : "";

  $("favSentence").textContent =
    `My favorite subject is ${favCore}${favCo}${favAct}.`;

  const c1 = state.challenge1 || "…";
  const c2 = state.challenge2 ? ` and another challenging subject is ${state.challenge2}` : "";
  $("challengeSentence").textContent =
    `One of the most challenging subject is ${c1}${c2}.`;
}

function updatePresentName(){
  const n = state.studentName?.trim();
  const sec = state.studentSection?.trim();

  if(n && sec) $("presentName").textContent = `Presenter: ${n} • ${sec}`;
  else if(n) $("presentName").textContent = `Presenter: ${n}`;
  else if(sec) $("presentName").textContent = `Student-Led Conference • ${sec}`;
  else $("presentName").textContent = "Student-Led Conference";
}


/* --------------------------
   Challenge dropdown rule
--------------------------- */
function syncChallengeOptions(){
  const c1 = $("challenge1");
  const c2 = $("challenge2");

  const v1 = c1.value;
  const v2 = c2.value;

  if(v1 && v2 && v1 === v2){
    c2.value = "";
    state.challenge2 = "";
  }

  [...c2.options].forEach(opt => {
    if(!opt.value) return;
    const block = v1 && opt.value === v1;
    opt.hidden = block;
    opt.disabled = block;
  });

  [...c1.options].forEach(opt => {
    if(!opt.value) return;
    const block = v2 && opt.value === v2;
    opt.hidden = block;
    opt.disabled = block;
  });
}

/* --------------------------
   Photo + Images
--------------------------- */
function setAvatar(base64){
  const img = $("studentPhotoPreview");
  const emoji = $("avatar").querySelector(".emoji");
  if(base64){
    img.src = base64;
    img.style.display = "block";
    emoji.style.display = "none";
  }else{
    img.removeAttribute("src");
    img.style.display = "none";
    emoji.style.display = "block";
  }
}

function setFavImage(which, base64, skipSave=false){
  if(which === "core"){
    state.imgCore = base64 || "";
    const tag = $("imgCoreTag");
    const ph = $("imgPrevCore").querySelector(".ph");
    if(base64){
      tag.src = base64;
      tag.style.display = "block";
      ph.style.display = "none";
    }else{
      tag.removeAttribute("src");
      tag.style.display = "none";
      ph.style.display = "block";
    }
  }else{
    state.imgCoCore = base64 || "";
    const tag = $("imgCoCoreTag");
    const ph = $("imgPrevCoCore").querySelector(".ph");
    if(base64){
      tag.src = base64;
      tag.style.display = "block";
      ph.style.display = "none";
    }else{
      tag.removeAttribute("src");
      tag.style.display = "none";
      ph.style.display = "block";
    }
  }
  if(!skipSave) saveState();
}

/* --------------------------
   Apply state to UI (used by import)
--------------------------- */
function applyStateToUI(){
  $("studentName").value = state.studentName || "";
  $("studentSection").value = state.studentSection || "";
  $("favActivity").value = state.favActivity || "";
  $("favExplanation").value = state.favExplanation || "";
  $("challengeExplanation").value = state.challengeExplanation || "";
  $("comments").value = state.comments || "";

  $("favCore").value = state.favCore || "";
  $("favCoCore").value = state.favCoCore || "";
  $("challenge1").value = state.challenge1 || "";
  $("challenge2").value = state.challenge2 || "";

  setAvatar(state.studentPhoto || "");
  setFavImage("core", state.imgCore || "", true);
  setFavImage("cocore", state.imgCoCore || "", true);

  renderSubjects();

  syncChallengeOptions();
  updateSentences();
  updateAverages();
  updatePresentName();

  if($("presentOverlay").style.display === "block"){
    renderSlide();
  }
}

/* --------------------------
   Bind Inputs
--------------------------- */
function bindInputs(){
  // Student
  $("studentName").value = state.studentName;
  $("studentName").addEventListener("input", e => {
    state.studentName = e.target.value;
    saveState();
  });

    $("studentSection").value = state.studentSection || "";
    $("studentSection").addEventListener("input", e => {
    state.studentSection = e.target.value;
    saveState();
    });

  setAvatar(state.studentPhoto);

  async function handleStudentPhotoFile(file){
    if(!file) return;
    state.studentPhoto = await toBase64(file);
    setAvatar(state.studentPhoto);
    saveState();
  }

  $("studentPhoto").addEventListener("change", async (e) => {
    await handleStudentPhotoFile(e.target.files?.[0]);
    e.target.value = "";
  });

  // camera
  $("btnStudentCam").addEventListener("click", () => $("studentPhotoCam").click());
  $("studentPhotoCam").addEventListener("change", async (e) => {
    await handleStudentPhotoFile(e.target.files?.[0]);
    e.target.value = "";
  });

  // Favorites
  $("favCore").value = state.favCore;
  $("favCoCore").value = state.favCoCore;
  $("favActivity").value = state.favActivity;
  $("favExplanation").value = state.favExplanation;

  ["favCore","favCoCore"].forEach(id=>{
    $(id).addEventListener("change", e => { state[id] = e.target.value; saveState(); });
  });
  $("favActivity").addEventListener("input", e => { state.favActivity = e.target.value; saveState(); });
  $("favExplanation").addEventListener("input", e => { state.favExplanation = e.target.value; saveState(); });

  // Challenges
  $("challenge1").value = state.challenge1;
  $("challenge2").value = state.challenge2;
  $("challengeExplanation").value = state.challengeExplanation;

  $("challenge1").addEventListener("change", e => {
    state.challenge1 = e.target.value;
    if(state.challenge1 && state.challenge1 === $("challenge2").value){
      $("challenge2").value = "";
      state.challenge2 = "";
    }
    syncChallengeOptions();
    saveState();
  });

  $("challenge2").addEventListener("change", e => {
    state.challenge2 = e.target.value;
    if(state.challenge2 && state.challenge2 === $("challenge1").value){
      $("challenge1").value = "";
      state.challenge1 = "";
    }
    syncChallengeOptions();
    saveState();
  });

  $("challengeExplanation").addEventListener("input", e => {
    state.challengeExplanation = e.target.value;
    saveState();
  });

  // Favorite images
  setFavImage("core", state.imgCore, true);
  setFavImage("cocore", state.imgCoCore, true);

  async function handleFavImage(which, file){
    if(!file) return;
    setFavImage(which, await toBase64(file));
  }

  $("imgCore").addEventListener("change", async (e)=>{
    await handleFavImage("core", e.target.files?.[0]);
    e.target.value = "";
  });

  $("imgCoCore").addEventListener("change", async (e)=>{
    await handleFavImage("cocore", e.target.files?.[0]);
    e.target.value = "";
  });

  // camera for fav images
  $("btnCoreCam").addEventListener("click", () => $("imgCoreCam").click());
  $("imgCoreCam").addEventListener("change", async (e)=>{
    await handleFavImage("core", e.target.files?.[0]);
    e.target.value = "";
  });

  $("btnCoCoreCam").addEventListener("click", () => $("imgCoCoreCam").click());
  $("imgCoCoreCam").addEventListener("change", async (e)=>{
    await handleFavImage("cocore", e.target.files?.[0]);
    e.target.value = "";
  });

  // Comments
  $("comments").value = state.comments;
  $("comments").addEventListener("input", e => {
    state.comments = e.target.value;
    saveState();
  });

  syncChallengeOptions();
  updateSentences();
  updatePresentName();
}

/* --------------------------
   MENU (NEW)
--------------------------- */
function openMenu(){
  $("menuPanel").classList.add("open");
  $("menuBtn").setAttribute("aria-expanded","true");
  $("menuPanel").setAttribute("aria-hidden","false");
}
function closeMenu(){
  $("menuPanel").classList.remove("open");
  $("menuBtn").setAttribute("aria-expanded","false");
  $("menuPanel").setAttribute("aria-hidden","true");
}
function toggleMenu(){
  const isOpen = $("menuPanel").classList.contains("open");
  isOpen ? closeMenu() : openMenu();
}

function bindMenu(){
  $("menuBtn").addEventListener("click", (e)=>{
    e.stopPropagation();
    toggleMenu();
  });

  // close when clicking outside
  document.addEventListener("click", () => closeMenu());

  // close when pressing Esc (only closes menu, not present)
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && $("menuPanel").classList.contains("open")){
      closeMenu();
    }
  });

  // prevent closing when clicking inside menu
  $("menuPanel").addEventListener("click", (e)=> e.stopPropagation());
}

/* --------------------------
   Buttons (UPDATED for MENU order)
   1 Present
   2 Import JSON
   3 Export JSON
   4 Print
   5 Reset
--------------------------- */
function bindButtons(){
  // 1 Present
  $("btnPresent").addEventListener("click", () => {
    closeMenu();
    openPresent();
  });

  // 2 Import JSON
  $("btnImportJson").addEventListener("click", () => {
    closeMenu();
    $("importJsonFile").click();
  });

  $("importJsonFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if(f) await importFromJSONFile(f);
    e.target.value = "";
  });

  // 3 Export JSON
  $("btnExportJson").addEventListener("click", () => {
    closeMenu();
    exportToJSON();
  });

  // 4 Print
  $("btnPrint").addEventListener("click", () => {
    closeMenu();
    window.print();
  });

  // 5 Reset
  $("btnReset").addEventListener("click", () => {
    closeMenu();
    if(!confirm("Reset everything? This will clear all saved data on this device.")) return;
    localStorage.removeItem("slc_state_v1");
    state = structuredClone(defaultState);
    location.reload();
  });
}

/* --------------------------
   Presentation Slides
--------------------------- */
let slideIndex = 0;

function starsTextFor(subject, groupKey){
  const n = Number(state.ratings[`${groupKey}:${subject}`] || 0);
  if(!n) return "—";
  return "⭐".repeat(n);
}

function makeSlides(){
  const name = safeText(state.studentName?.trim() || "Student");
  const section = safeText(state.studentSection?.trim() || "");

  const favCore = safeText(state.favCore || "—");
  const favCo = safeText(state.favCoCore || "—");
  const favAct = safeText(state.favActivity || "—");
  const favExplain = safeText(state.favExplanation || "");

  const chall1 = safeText(state.challenge1 || "—");
  const chall2 = safeText(state.challenge2 || "—");
  const challExplain = safeText(state.challengeExplanation || "");

  const comments = safeText(state.comments || "");

  const photoHTML = state.studentPhoto
    ? `<div class="photoFrame"><img src="${state.studentPhoto}" alt="Student photo"></div>`
    : `<div class="photoFrame" style="font-size:68px;">🧒</div>`;

  // NOTE: images now use contain to avoid ugly cropping
  const favCoreImg = state.imgCore
    ? `<div class="bigCard"><div class="bigLine">📘 Core Image</div>
        <img src="${state.imgCore}" alt="Favorite core" style="width:100%;height:260px;object-fit:contain;border-radius:18px;border:2px solid rgba(33,53,71,.10);background:#fff;margin-top:10px;">
      </div>`
    : `<div class="bigCard"><div class="bigLine">📘 Core Image</div><div style="margin-top:10px;color:#5b6b7a;font-weight:900;">(No image yet)</div></div>`;

  const favCoImg = state.imgCoCore
    ? `<div class="bigCard"><div class="bigLine">🎨 Co-core Image</div>
        <img src="${state.imgCoCore}" alt="Favorite co-core" style="width:100%;height:260px;object-fit:contain;border-radius:18px;border:2px solid rgba(33,53,71,.10);background:#fff;margin-top:10px;">
      </div>`
    : `<div class="bigCard"><div class="bigLine">🎨 Co-core Image</div><div style="margin-top:10px;color:#5b6b7a;font-weight:900;">(No image yet)</div></div>`;

  const favAuto =
    `My favorite subject is ${state.favCore || "…"}${
      state.favCoCore ? `, and my favorite co-core subject is ${state.favCoCore}` : ""
    }${
      state.favActivity ? `, and my favorite activity is ${state.favActivity}` : ""
    }.`;

  const challAuto =
    `One of the most challenging subject is ${state.challenge1 || "…"}${
      state.challenge2 ? ` and another challenging subject is ${state.challenge2}` : ""
    }.`;

  const starsCoreRows = SUBJECTS_CORE.map(s => `
    <tr>
      <td style="font-weight:1000;">${s}</td>
      <td style="text-align:right;">${starsTextFor(s,"core")}</td>
    </tr>`).join("");

  const starsCoCoreRows = SUBJECTS_COCORE.map(s => `
    <tr>
      <td style="font-weight:1000;">${s}</td>
      <td style="text-align:right;">${starsTextFor(s,"cocore")}</td>
    </tr>`).join("");

  return [
    {
      title: "👋 Hello!",
      body: `
        <div class="slideGrid two">
          <div class="bigCard" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
            ${photoHTML}
            <div style="min-width:220px;flex:1;">
              <div style="color:#5b6b7a;font-weight:1000;">Presenter</div>
              <div style="font-size:42px;font-weight:1000;letter-spacing:.2px;line-height:1.1;">${name}</div>
              ${section ? `<div style="margin-top:6px;color:#5b6b7a;font-weight:1000;font-size:18px;">Section: ${section}</div>` : ""}

              <div class="chips">
                <span class="chip">🎤 I can speak clearly</span>
                <span class="chip good">🌟 I will share my learning</span>
              </div>
            </div>
          </div>

          <div class="bigCard">
            <div class="bigLine">🚀 Today I will talk about…</div>
            <div class="chips">
              <span class="chip">🌟 Favorites</span>
              <span class="chip warn">🧩 Challenges</span>
              <span class="chip good">⭐ My Stars</span>
              <span class="chip">💬 Comments</span>
            </div>
            <div style="margin-top:12px;color:#5b6b7a;font-weight:900;">
              (Tip: Use ⬅ ➡ keys to move slides)
            </div>
          </div>
        </div>
      `
    },
    {
      title: "🌟 My Favorite Subjects",
      body: `
        <div class="bigCard">
          <div class="bigLine">✨ ${safeText(favAuto)}</div>
        </div>

        <div class="slideGrid two" style="margin-top:14px;">
          <div class="bigCard">
            <div class="bigLine">My picks</div>
            <div class="chips">
              <span class="chip good">📘 Core: ${favCore}</span>
              <span class="chip">🎨 Co-core: ${favCo}</span>
              <span class="chip warn">🎯 Activity: ${favAct}</span>
            </div>
          </div>

          <div class="bigCard">
            <div class="bigLine">My explanation</div>
            <div style="margin-top:10px;color:#5b6b7a;font-weight:900;line-height:1.5;">
          
              ${favExplain || "<i>(No explanation yet)</i>"}
            </div>
          </div>
        </div>
      `
    },
    {
      title: "🧩 Challenging Subjects",
      body: `
        <div class="bigCard">
          <div class="bigLine">💪 ${safeText(challAuto)}</div>
        </div>

        <div class="slideGrid two" style="margin-top:14px;">
          <div class="bigCard">
            <div class="bigLine">My challenges</div>
            <div class="chips">
              <span class="chip warn">1️⃣ ${chall1}</span>
              <span class="chip warn">2️⃣ ${chall2}</span>
            </div>
            <div style="margin-top:12px;color:#5b6b7a;font-weight:900;">
              It’s okay to find something hard — that’s how we grow!
            </div>
          </div>

          <div class="bigCard">
            <div class="bigLine">How I will improve</div>
            <div style="margin-top:10px;color:#5b6b7a;font-weight:900;line-height:1.5;">
              
              ${challExplain || "<i>(No explanation yet)</i>"}
            </div>
          </div>
        </div>
      `
    },
    {
      title: "⭐ My Subject Stars",
      body: `
        <div class="slideGrid two">
          <div class="bigCard">
            <div class="bigLine">📘 Core Stars</div>
            <table class="starsTable" style="margin-top:10px;">
              ${starsCoreRows}
            </table>
          </div>

          <div class="bigCard">
            <div class="bigLine">🎨 Co-core Stars</div>
            <table class="starsTable" style="margin-top:10px;">
              ${starsCoCoreRows}
            </table>
          </div>
        </div>

        <div class="bigCard" style="margin-top:14px;">
          <div class="bigLine">🌈 What my stars mean</div>
          <div class="chips" style="margin-top:10px;">
            <span class="chip">⭐ 1 = practice more</span>
            <span class="chip">⭐⭐⭐ 3 = improving</span>
            <span class="chip good">⭐⭐⭐⭐⭐ 5 = confident</span>
          </div>
        </div>
      `
    },
    {
      title: "🖼️ Favorite Subject Images",
      body: `
        <div class="slideGrid two">
          ${favCoreImg}
          ${favCoImg}
        </div>
        <div class="bigCard" style="margin-top:14px;">
          <div class="bigLine">🎨 Why I chose these images</div>
          <div style="margin-top:8px;color:#5b6b7a;font-weight:900;">
            (You can tell a short story about what you see!)
          </div>
        </div>
      `
    },
    {
      title: "💬 Comments",
      body: `
        <div class="bigCard">
          <div class="bigLine">🗣️ What I want to share</div>
          <div style="margin-top:12px; font-size:22px; font-weight:900; color:#213547; line-height:1.6;">
            ${comments ? comments.replace(/\n/g,"<br/>") : "<i>(No comments yet)</i>"}
          </div>
        </div>

        <div class="bigCard" style="margin-top:14px;">
          <div class="bigLine">🙏 Thank you for listening!</div>
          <div class="chips" style="margin-top:10px;">
            <span class="chip good">🌟 I will keep trying!</span>
            <span class="chip">📚 I will keep learning!</span>
            <span class="chip warn">😊 I can improve!</span>
          </div>
        </div>
      `
    }
  ];
}


function renderSlide(){
  const slides = makeSlides();
  slideIndex = Math.max(0, Math.min(slideIndex, slides.length - 1));
  const s = slides[slideIndex];

  const dots = slides.map((_, i) =>
    `<span class="dot ${i===slideIndex ? "on" : ""}"></span>`
  ).join("");

  $("slideBox").innerHTML = `
    <div class="slideInner">
      <div class="slideTopBar">
        <h3 class="slideTitle">${s.title}</h3>
        <div class="slideMeta">
          <span class="slidePill">Slide ${slideIndex+1} / ${slides.length}</span>
          <span class="dots" aria-label="progress">${dots}</span>
        </div>
      </div>
      <div>${s.body}</div>
    </div>
  `;
}


function openPresent(){
  $("presentOverlay").style.display = "block";
  $("presentOverlay").setAttribute("aria-hidden","false");
  slideIndex = 0;
  renderSlide();

  const el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
}

function closePresent(){
  $("presentOverlay").style.display = "none";
  $("presentOverlay").setAttribute("aria-hidden","true");
  if(document.fullscreenElement && document.exitFullscreen){
    document.exitFullscreen().catch(()=>{});
  }
}



/* --------------------------
   Presentation bindings (UPDATED: no share button here)
--------------------------- */
function bindPresentation(){
  $("btnExitPresent").addEventListener("click", closePresent);
  $("btnPrev").addEventListener("click", ()=>{ slideIndex--; renderSlide(); });
  $("btnNext").addEventListener("click", ()=>{ slideIndex++; renderSlide(); });

  document.addEventListener("keydown", (e)=>{
    const open = $("presentOverlay").style.display === "block";
    if(!open) return;

    if(e.key === "Escape") closePresent();
    if(e.key === "ArrowLeft"){ slideIndex--; renderSlide(); }
    if(e.key === "ArrowRight"){ slideIndex++; renderSlide(); }
  });
}

/* --------------------------
   Init (UPDATED)
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderSubjects();
  bindInputs();
  bindMenu();       // ✅ NEW
  bindButtons();    // ✅ menu order buttons
  bindPresentation();
  updateSentences();
  updateAverages();
  updatePresentName();
});
