const PUBLIC_HOLIDAY_SERVICE_KEY = "여기에_공공데이터_API_KEY";

const REGION_POOL = [
  { id:"gangnam", name:"서울 강남", lat:37.4979, lon:127.0276, weight:95, type:"business" },
  { id:"hongdae", name:"서울 홍대", lat:37.5563, lon:126.9236, weight:88, type:"hotplace" },
  { id:"seongsu", name:"서울 성수", lat:37.5446, lon:127.0557, weight:86, type:"hotplace" },
  { id:"yeouido", name:"서울 여의도", lat:37.5219, lon:126.9245, weight:84, type:"business" },
  { id:"jamsil", name:"서울 잠실", lat:37.5133, lon:127.1002, weight:82, type:"city" },
  { id:"incheon_airport", name:"인천공항", lat:37.4602, lon:126.4407, weight:90, type:"airport" },
  { id:"suwon", name:"수원", lat:37.2636, lon:127.0286, weight:72, type:"city" },
  { id:"busan_haeundae", name:"부산 해운대", lat:35.1587, lon:129.1604, weight:88, type:"beach" },
  { id:"jeju", name:"제주", lat:33.4996, lon:126.5312, weight:92, type:"travel" },
  { id:"gangneung", name:"강릉", lat:37.7519, lon:128.8761, weight:80, type:"travel" },
  { id:"sokcho", name:"속초", lat:38.2070, lon:128.5918, weight:76, type:"travel" },
  { id:"daegu", name:"대구 동성로", lat:35.8693, lon:128.5940, weight:78, type:"city" },
  { id:"gwangju", name:"광주 충장로", lat:35.1480, lon:126.9144, weight:70, type:"city" },
  { id:"daejeon", name:"대전 둔산", lat:36.3510, lon:127.3788, weight:70, type:"city" }
];

const ACTIVE_REGION_LIMIT = 7;
const REGION_WEATHER_TTL = 10 * 60 * 1000;

const toastEl = document.getElementById("toast");
const regionWeatherCache = new Map();

let holidayCache = null;
let predictions = [];

let profile = {
  nickname:"WETTY",
  points:12800,
  hitRate:72,
  streak:5,
  referral:"WETTY777"
};

function toast(msg){
  if(!toastEl) return;

  toastEl.textContent = msg;
  toastEl.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(()=>{
    toastEl.classList.remove("show");
  },2000);
}

function syncProfile(){
  document.getElementById("nickname").textContent = profile.nickname;
  document.getElementById("profileName").textContent = profile.nickname;
  document.getElementById("profileCode").textContent = `초대코드 ${profile.referral}`;
  document.getElementById("profilePoint").textContent = `${profile.points.toLocaleString()}P`;
  document.getElementById("profileRate").textContent = `${profile.hitRate}%`;
  document.getElementById("profileStreak").textContent = profile.streak;
}

function formatDate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

async function isHoliday(){
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2,"0");
  const todayKey = formatDate(today);
  const cacheKey = `${y}-${m}`;

  if(!PUBLIC_HOLIDAY_SERVICE_KEY || PUBLIC_HOLIDAY_SERVICE_KEY.includes("여기에")){
    return false;
  }

  if(holidayCache && holidayCache.key === cacheKey){
    return holidayCache.dates.includes(todayKey);
  }

  try{
    const url =
      `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
      `?serviceKey=${encodeURIComponent(PUBLIC_HOLIDAY_SERVICE_KEY)}` +
      `&solYear=${y}` +
      `&solMonth=${m}` +
      `&_type=json`;

    const res = await fetch(url);
    if(!res.ok) return false;

    const json = await res.json();
    let items = json?.response?.body?.items?.item || [];

    if(!Array.isArray(items)){
      items = [items];
    }

    const dates = items
      .filter(item => item?.isHoliday === "Y" || item?.isHoliday === true)
      .map(item => {
        const d = String(item.locdate);
        return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
      });

    holidayCache = {
      key: cacheKey,
      dates
    };

    return dates.includes(todayKey);

  }catch(e){
    return false;
  }
}

async function getDayMode(){
  const today = new Date();
  const day = today.getDay();

  const holiday = await isHoliday();

  if(holiday) return "holiday";
  if(day === 0 || day === 6) return "weekend";

  return "weekday";
}

async function fetchRegionWeather(lat,lon){
  const key = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
  const now = Date.now();

  const cached = regionWeatherCache.get(key);

  if(cached && now - cached.ts < REGION_WEATHER_TTL){
    return cached.data;
  }

  try{
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
      `&hourly=precipitation_probability,temperature_2m` +
      `&past_days=1` +
      `&forecast_days=1` +
      `&timezone=Asia%2FSeoul`;

    const res = await fetch(url);

    if(!res.ok){
      return null;
    }

    const json = await res.json();

    const c = json.current || {};
    const hourly = json.hourly || {};
    const times = hourly.time || [];
    const probs = hourly.precipitation_probability || [];
    const temps = hourly.temperature_2m || [];

    const nowTime = new Date();

    let bestIndex = 0;
    let bestDiff = Infinity;

    for(let i = 0; i < times.length; i++){
      const diff = Math.abs(new Date(times[i]).getTime() - nowTime.getTime());

      if(diff < bestDiff){
        bestDiff = diff;
        bestIndex = i;
      }
    }

    const yesterdayTime = new Date(nowTime.getTime() - 24 * 60 * 60 * 1000);

    let yIndex = 0;
    let yDiff = Infinity;

    for(let i = 0; i < times.length; i++){
      const diff = Math.abs(new Date(times[i]).getTime() - yesterdayTime.getTime());

      if(diff < yDiff){
        yDiff = diff;
        yIndex = i;
      }
    }

    const temp = Number(c.temperature_2m ?? temps[bestIndex] ?? 0);
    const yesterdayTemp = Number(temps[yIndex] ?? temp);

    const data = {
      temp,
      feelsLike:Number(c.apparent_temperature ?? temp),
      precipitation:Number(c.precipitation ?? 0),
      weatherCode:Number(c.weather_code ?? 0),
      wind:Number(c.wind_speed_10m ?? 0),
      rainProb:Number(probs[bestIndex] ?? 0),
      tempDiff:Math.round(temp - yesterdayTemp)
    };

    regionWeatherCache.set(key,{
      data,
      ts:now
    });

    return data;

  }catch(e){
    return null;
  }
}

function getWeatherIcon(w){
  if(w.precipitation > 0) return "🌧️";
  if(w.rainProb >= 60) return "☔";
  if(w.rainProb >= 35) return "🌦️";
  if(w.wind >= 8) return "💨";
  if(w.temp >= 30) return "🔥";
  if(w.temp <= 0) return "❄️";
  return "🌤️";
}

function getWeatherDesc(w){
  if(w.precipitation > 0) return "현재 비가 감지되고 있습니다.";
  if(w.rainProb >= 60) return "비 가능성이 높은 지역입니다.";
  if(w.rainProb >= 35) return "비가 올지 애매한 흐름입니다.";
  if(w.wind >= 8) return "바람이 강해질 가능성이 있습니다.";
  if(w.temp >= 30) return "체감 더위가 높은 지역입니다.";
  if(w.temp <= 0) return "추위 이슈가 있는 지역입니다.";
  return "현재는 큰 날씨 이슈가 적습니다.";
}

async function loadCurrentWeather(){
  if(!navigator.geolocation){
    setWeatherFallback();
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const w = await fetchRegionWeather(lat,lon);

    if(!w){
      setWeatherFallback();
      return;
    }

    document.getElementById("currentTemp").textContent = `${Math.round(w.temp)}°`;
    document.getElementById("feelsLike").textContent = `${Math.round(w.feelsLike)}°`;
    document.getElementById("rainChance").textContent = `${w.rainProb}%`;
    document.getElementById("windSpeed").textContent = `${w.wind.toFixed(1)}m/s`;
    document.getElementById("tempDiff").textContent = `${w.tempDiff >= 0 ? "+" : ""}${w.tempDiff}°`;
    document.getElementById("weatherIcon").textContent = getWeatherIcon(w);
    document.getElementById("weatherDesc").textContent = getWeatherDesc(w);

  },()=>{
    setWeatherFallback();
  });
}

function setWeatherFallback(){
  document.getElementById("currentTemp").textContent = "--°";
  document.getElementById("feelsLike").textContent = "--°";
  document.getElementById("rainChance").textContent = "--%";
  document.getElementById("windSpeed").textContent = "--";
  document.getElementById("tempDiff").textContent = "--°";
  document.getElementById("weatherIcon").textContent = "🌤️";
  document.getElementById("weatherDesc").textContent = "위치 권한을 허용하면 현재 날씨가 표시됩니다.";
}

function refreshWeather(){
  regionWeatherCache.clear();
  toast("날씨 새로고침 중 🌦️");

  loadCurrentWeather();
  buildPredictions();
}

function hasWeatherIssue(w){
  return (
    w.rainProb >= 35 ||
    w.precipitation > 0 ||
    w.wind >= 8 ||
    Math.abs(w.tempDiff) >= 5 ||
    w.temp >= 30 ||
    w.temp <= 0
  );
}

function getPredictionType(w){
  if(w.wind >= 8) return "wind";
  if(w.temp >= 30) return "heat";
  if(w.temp <= 0) return "cold";
  return "rain";
}

function getIssueReasons(w){
  const reasons = [];

  if(w.precipitation > 0) reasons.push("현재 강수 감지");
  if(w.rainProb >= 70) reasons.push("강수확률 높음");
  else if(w.rainProb >= 35) reasons.push("비 가능성 있음");

  if(w.wind >= 8) reasons.push("강풍 가능성");
  if(Math.abs(w.tempDiff) >= 5) reasons.push("기온 변화 큼");
  if(w.temp >= 30) reasons.push("더위 이슈");
  if(w.temp <= 0) reasons.push("추위 이슈");

  return reasons;
}

function getModeBonus(region, mode){
  let bonus = 0;

  if(mode === "holiday"){
    if(region.type === "travel") bonus += 35;
    if(region.type === "airport") bonus += 32;
    if(region.type === "beach") bonus += 28;
    if(region.type === "hotplace") bonus += 18;
  }

  if(mode === "weekend"){
    if(region.type === "travel") bonus += 28;
    if(region.type === "beach") bonus += 25;
    if(region.type === "airport") bonus += 20;
    if(region.type === "hotplace") bonus += 20;
  }

  if(mode === "weekday"){
    if(region.type === "business") bonus += 24;
    if(region.type === "city") bonus += 16;
    if(region.type === "hotplace") bonus += 12;
  }

  return bonus;
}

function getWeatherIssueScore(w, region, mode){
  let score = region.weight || 50;

  score += getModeBonus(region, mode);

  if(w.rainProb >= 70) score += 45;
  else if(w.rainProb >= 35) score += 28;

  if(w.precipitation > 0) score += 40;
  if(w.wind >= 8) score += 24;
  if(Math.abs(w.tempDiff) >= 5) score += 22;
  if(w.temp >= 30) score += 20;
  if(w.temp <= 0) score += 20;

  return score;
}

function makePrediction(region,w,score,mode){
  const type = getPredictionType(w);

  let title = `${region.name}, 비 올까?`;
  let yesLabel = "온다";
  let noLabel = "안 온다";
  let basePercent = w.rainProb;

  if(type === "wind"){
    title = `${region.name}, 바람 강할까?`;
    yesLabel = "세다";
    noLabel = "약하다";
    basePercent = w.wind * 8;
  }

  if(type === "heat"){
    title = `${region.name}, 오늘 덥게 느껴질까?`;
    yesLabel = "덥다";
    noLabel = "괜찮다";
    basePercent = w.feelsLike * 2.4;
  }

  if(type === "cold"){
    title = `${region.name}, 오늘 춥게 느껴질까?`;
    yesLabel = "춥다";
    noLabel = "괜찮다";
    basePercent = 70 - w.feelsLike * 2;
  }

  const yes = Math.max(5, Math.min(95, Math.round(basePercent)));
  const no = 100 - yes;

  return {
    id:region.id,
    region:region.name,
    title,
    type,
    mode,
    yes,
    no,
    yesLabel,
    noLabel,
    yesStake:yes * 180,
    noStake:no * 120,
    total:score * 250,
    reasons:getIssueReasons(w)
  };
}

async function buildPredictions(){
  toast("날씨 이슈 지역 선별 중");

  const mode = await getDayMode();
  const list = [];

  for(const region of REGION_POOL){
    const w = await fetchRegionWeather(region.lat,region.lon);

    if(!w) continue;
    if(!hasWeatherIssue(w)) continue;

    const score = getWeatherIssueScore(w, region, mode);

    list.push(
      makePrediction(region,w,score,mode)
    );
  }

  predictions = list
    .sort((a,b)=>b.total-a.total)
    .slice(0,ACTIVE_REGION_LIMIT);

  if(!predictions.length){
    predictions = [
      {
        id:"fallback_seoul",
        region:"서울",
        title:"오늘 서울, 비 올까?",
        type:"rain",
        mode,
        yes:42,
        no:58,
        yesLabel:"온다",
        noLabel:"안 온다",
        yesStake:7200,
        noStake:9800,
        total:17000,
        reasons:["현재 큰 이슈는 적지만 예측 흐름 유지"]
      }
    ];
  }

  renderHotList();
  renderMarkets();
}

function renderHotList(){
  const box = document.getElementById("hotList");
  if(!box) return;

  box.innerHTML = "";

  const sorted = [...predictions]
    .sort((a,b)=>b.total-a.total)
    .slice(0,3);

  sorted.forEach((item,index)=>{
    const div = document.createElement("div");

    div.className = "board-item";

    div.innerHTML = `
      <div>
        <div class="bi-title">${index + 1}. ${item.region}</div>
        <div class="bi-sub">${item.title}</div>
      </div>
      <div class="bi-right">${item.total.toLocaleString()}P</div>
    `;

    box.appendChild(div);
  });
}

function renderMarkets(){
  const box = document.getElementById("marketList");
  if(!box) return;

  box.innerHTML = "";

  predictions.forEach(item=>{
    const card = document.createElement("div");

    card.className = "market-card";

    card.innerHTML = `
      <div class="market-region">${item.region}</div>

      <div class="market-title">${item.title}</div>

      <div class="market-meta">
        <span>${getModeLabel(item.mode)} · ${item.reasons.join(" · ")}</span>
        <span>${item.total.toLocaleString()}P</span>
      </div>

      <div class="market-grid">
        <div class="market-cell">
          <span>${item.yesLabel}</span>
          <strong>${item.yes}%</strong>
          <small>${item.yesStake.toLocaleString()}P</small>
        </div>

        <div class="market-cell">
          <span>${item.noLabel}</span>
          <strong>${item.no}%</strong>
          <small>${item.noStake.toLocaleString()}P</small>
        </div>
      </div>

      <div class="vote-row">
        <button class="vote-btn rain" onclick="vote('${safeText(item.title)}','${item.yesLabel}')">
          ${item.yesLabel}
        </button>

        <button class="vote-btn clear" onclick="vote('${safeText(item.title)}','${item.noLabel}')">
          ${item.noLabel}
        </button>
      </div>
    `;

    box.appendChild(card);
  });
}

function safeText(value){
  return String(value || "")
    .replaceAll("'","\\'")
    .replaceAll('"','&quot;');
}

function getModeLabel(mode){
  if(mode === "holiday") return "공휴일 이슈";
  if(mode === "weekend") return "주말 이슈";
  return "평일 이슈";
}

function vote(title,choice){
  const ok = confirm(`${title}\n\n'${choice}'에 참여할까요?`);

  if(!ok) return;

  toast(`${choice} 참여 완료 ✓`);
}

function checkin(){
  profile.points += 100;
  syncProfile();
  toast("출석 포인트 지급 완료 🎉");
}

function copyInvite(){
  const text = `WETTY BETTY 초대코드 : ${profile.referral}`;

  if(navigator.clipboard){
    navigator.clipboard.writeText(text);
    toast("초대코드 복사 완료 🎁");
    return;
  }

  toast(text);
}

function onProfileClick(){
  document.getElementById("profileModal")?.classList.add("show");
}

function closeModal(){
  document.getElementById("profileModal")?.classList.remove("show");
}

function logout(){
  closeModal();
  toast("로그아웃 완료");
}

function setActiveNav(index){
  document.querySelectorAll(".nav-btn").forEach((btn,i)=>{
    btn.classList.toggle("active", i === index);
  });
}

function goHome(){
  setActiveNav(0);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goPicks(){
  setActiveNav(1);
  document.getElementById("marketList")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function goRank(){
  setActiveNav(2);
  document.getElementById("hotList")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".nav-btn").forEach((btn,index)=>{
    btn.onclick = ()=>{
      if(index === 0) goHome();
      if(index === 1) goPicks();
      if(index === 2) goRank();
      if(index === 3) onProfileClick();
    };
  });

  syncProfile();
  loadCurrentWeather();
  buildPredictions();
});

setInterval(()=>{
  buildPredictions();
},10 * 60 * 1000);

setInterval(()=>{
  loadCurrentWeather();
},10 * 60 * 1000);
