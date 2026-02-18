const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  db: null,
  city: null,
  schedule: [],
  today: null,
  deferredPrompt: null
};

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1600);
}

function pad(n){ return String(n).padStart(2,"0"); }

function formatTodayLabel(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Yan","Fev","Mar","Apr","May","Iyun","Iyul","Avg","Sen","Okt","Noy","Dek"];
  return `${pad(d.getDate())}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function loadTheme(){
  const t = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = t;
}
function toggleTheme(){
  const cur = document.documentElement.dataset.theme || "dark";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  toast(next === "dark" ? "Dark theme ✅" : "Light theme ✅");
}

function getLocalISODate(){
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth()+1);
  const d = pad(now.getDate());
  return `${y}-${m}-${d}`;
}

function findTodayRow(){
  const iso = getLocalISODate();
  return state.schedule.find(r => r.date === iso) || state.schedule[0] || null;
}

function buildCitySelect(){
  const sel = $("#citySelect");
  sel.innerHTML = "";
  state.db.cities.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });

  const saved = localStorage.getItem("city") || state.db.meta.defaultCity || state.db.cities[0]?.name;
  sel.value = state.db.cities.some(c => c.name === saved) ? saved : state.db.cities[0]?.name;

  sel.addEventListener("change", () => {
    localStorage.setItem("city", sel.value);
    setCity(sel.value);
    toast("Shahar o‘zgartirildi ✅");
  });
}

function setCity(cityName){
  const city = state.db.cities.find(c => c.name === cityName) || state.db.cities[0];
  state.city = city;
  state.schedule = city.schedule || [];
  renderAll();
}

function renderHeader(){
  $("#subTitle").textContent = `Offline • ${state.city?.name || ""}`;
}

function renderToday(){
  const row = findTodayRow();
  state.today = row;

  if(!row){
    $("#todayLabel").textContent = "Ma’lumot topilmadi";
    $("#suhoor").textContent = "—";
    $("#iftar").textContent = "—";
    $("#dayNumber").textContent = "—";
    $("#dayFill").style.width = "0%";
    $("#dayMini").textContent = "—";
    return;
  }

  $("#todayLabel").textContent = `${formatTodayLabel(row.date)} • ${row.day}-kun`;
  $("#suhoor").textContent = row.suhoor;
  $("#iftar").textContent = row.iftar;
  $("#dayNumber").textContent = row.day;

  // progress (taxminan 30 kun)
  const total = Math.max(...state.schedule.map(x => x.day), 30);
  const pct = Math.min(100, Math.max(0, (row.day / total) * 100));
  $("#dayFill").style.width = `${pct}%`;
  $("#dayMini").textContent = `${row.day}/${total} kun`;
}

function renderCalendar(){
  const wrap = $("#calendarTable");
  if(!state.schedule.length){
    wrap.innerHTML = `<div class="trow"><div>—</div><div>Jadval yo‘q</div><div></div><div></div></div>`;
    return;
  }

  const header = `
    <div class="trow th">
      <div>Kun</div>
      <div>Sana</div>
      <div>Saharlik</div>
      <div>Iftor</div>
    </div>
  `;

  const rows = state.schedule.map(r => {
    const isToday = state.today && r.date === state.today.date;
    return `
      <div class="trow" data-date="${r.date}" style="${isToday ? "background: rgba(124,92,255,.10);" : ""}">
        <div><span class="badgeDay">${r.day}-kun</span></div>
        <div>${r.date}</div>
        <div>${r.suhoor}</div>
        <div>${r.iftar}</div>
      </div>
    `;
  }).join("");

  wrap.innerHTML = header + rows;

  // click row -> scroll to top + set "today view"
  wrap.querySelectorAll(".trow[data-date]").forEach(el => {
    el.addEventListener("click", () => {
      const d = el.getAttribute("data-date");
      const found = state.schedule.find(x => x.date === d);
      if(found){
        $("#todayLabel").textContent = `${formatTodayLabel(found.date)} • ${found.day}-kun`;
        $("#suhoor").textContent = found.suhoor;
        $("#iftar").textContent = found.iftar;
        $("#dayNumber").textContent = found.day;
        toast("Tanlandi ✅");
        window.scrollTo({top:0, behavior:"smooth"});
      }
    });
  });
}

function renderDuas(){
  const dua = state.db.content?.dua;
  if(!dua) return;

  $("#duaSuhoorTitle").textContent = dua.suhoor.title;
  $("#duaSuhoorAr").textContent = dua.suhoor.arabic;
  $("#duaSuhoorLa").textContent = dua.suhoor.latin;
  $("#duaSuhoorMean").textContent = dua.suhoor.meaning;

  $("#duaIftarTitle").textContent = dua.iftar.title;
  $("#duaIftarAr").textContent = dua.iftar.arabic;
  $("#duaIftarLa").textContent = dua.iftar.latin;
  $("#duaIftarMean").textContent = dua.iftar.meaning;
}

function renderTips(){
  const tips = state.db.content?.tips || [];
  const wrap = $("#tipsList");
  wrap.innerHTML = tips.map(t => `
    <div class="tip">
      <h4>${t.title}</h4>
      <p>${t.text}</p>
    </div>
  `).join("");
}

function setupTabs(){
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      $("#tab-calendar").classList.toggle("hidden", tab !== "calendar");
      $("#tab-duas").classList.toggle("hidden", tab !== "duas");
      $("#tab-dhikr").classList.toggle("hidden", tab !== "dhikr");
      $("#tab-tips").classList.toggle("hidden", tab !== "tips");
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });
}

function setupSearch(){
  $("#goDate").addEventListener("click", () => {
    const v = ($("#searchDate").value || "").trim();
    if(!v) return toast("Sana kiriting: YYYY-MM-DD");
    const row = state.schedule.find(x => x.date === v);
    if(!row) return toast("Topilmadi ❌");

    const el = document.querySelector(`.trow[data-date="${v}"]`);
    if(el){
      el.scrollIntoView({behavior:"smooth", block:"center"});
      el.animate([{transform:"scale(1)"},{transform:"scale(1.02)"},{transform:"scale(1)"}], {duration:450});
      toast("Topildi ✅");
    }
  });
}

function setupCopyButtons(){
  $$("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const key = btn.getAttribute("data-copy");
      const dua = state.db.content?.dua?.[key];
      if(!dua) return;

      const text = `${dua.title}\n\n${dua.arabic}\n\n${dua.latin}\n\n${dua.meaning}`;
      try{
        await navigator.clipboard.writeText(text);
        toast("Nusxa olindi ✅");
      }catch{
        toast("Clipboard ruxsat bermadi ❌");
      }
    });
  });
}

function setupDhikr(){
  const key = "dhikrCount";
  const get = () => Number(localStorage.getItem(key) || "0");
  const set = (v) => { localStorage.setItem(key, String(v)); $("#dhikrCount").textContent = v; };

  set(get());

  $("#tapDhikr").addEventListener("click", () => {
    const v = get() + 1;
    set(v);
    if(navigator.vibrate) navigator.vibrate(10);
  });

  $("#minusDhikr").addEventListener("click", () => {
    const v = Math.max(0, get() - 1);
    set(v);
    if(navigator.vibrate) navigator.vibrate(8);
  });

  $("#resetDhikr").addEventListener("click", () => {
    set(0);
    toast("Reset ✅");
  });
}

function parseTimeToday(hhmm){
  const [h,m] = hhmm.split(":").map(Number);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  return d;
}

function updateCountdown(){
  const row = state.today;
  if(!row){ $("#countdown").textContent = "—"; return; }

  const now = new Date();
  const su = parseTimeToday(row.suhoor);
  const ift = parseTimeToday(row.iftar);

  // Next event logic:
  // - If now < suhoor -> countdown to suhoor ("Saharlik")
  // - Else if now < iftar -> countdown to iftar ("Iftor")
  // - Else -> countdown to next day suhoor
  let target = null;
  let label = "Keyingi";

  if(now < su){
    target = su; label = "Saharlikgacha";
  }else if(now < ift){
    target = ift; label = "Iftorgacha";
  }else{
    const next = state.schedule.find(x => x.day === row.day + 1);
    if(next){
      // next day suhoor
      const t = new Date(next.date + "T00:00:00");
      const [h,m] = next.suhoor.split(":").map(Number);
      target = new Date(t.getFullYear(), t.getMonth(), t.getDate(), h, m, 0, 0);
      label = "Ertangi sahargacha";
    }else{
      target = null;
      label = "Keyingi";
    }
  }

  $("#nextLabel").textContent = label;
  if(!target){ $("#countdown").textContent = "—"; return; }

  const diff = Math.max(0, target - now);
  const totalSec = Math.floor(diff/1000);
  const hh = Math.floor(totalSec/3600);
  const mm = Math.floor((totalSec%3600)/60);
  const ss = totalSec%60;

  $("#countdown").textContent = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function renderAll(){
  renderHeader();
  renderToday();
  renderCalendar();
  renderDuas();
  renderTips();
  updateCountdown();
}

async function loadDB(){
  const res = await fetch("/db.json", {cache:"no-store"});
  if(!res.ok) throw new Error("db.json topilmadi");
  state.db = await res.json();
}

function setupPWAInstall(){
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    $("#installBtn").hidden = false;
  });

  $("#installBtn").addEventListener("click", async () => {
    if(!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    $("#installBtn").hidden = true;
  });
}

function setupServiceWorker(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  }
}

function setupOnlineBadge(){
  const badge = $("#offlineBadge");
  const update = () => {
    const online = navigator.onLine;
    badge.textContent = online ? "🟢 Online/Offline tayyor" : "🟣 Offline rejim";
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

async function init(){
  loadTheme();
  $("#themeBtn").addEventListener("click", toggleTheme);

  setupTabs();
  setupSearch();
  setupCopyButtons();
  setupDhikr();
  setupPWAInstall();
  setupServiceWorker();
  setupOnlineBadge();

  try{
    await loadDB();
    buildCitySelect();
    setCity($("#citySelect").value);
    toast("Ma’lumot yuklandi ✅");
  }catch(e){
    toast("db.json xatolik ❌");
    console.error(e);
  }

  setInterval(updateCountdown, 1000);
}

init();
