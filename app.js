const toastEl = document.getElementById("toast");

let profile = {
nickname:"WETTY",
points:12800,
hitRate:72,
streak:5,
referral:"WETTY777"
};

let predictions = [
{
id:1,
region:"서울",
title:"오늘 밤 비 올까?",
yes:68,
no:32,
yesStake:14200,
noStake:6100,
total:20300
},
{
id:2,
region:"부산",
title:"내일 오전 강풍 올까?",
yes:54,
no:46,
yesStake:9100,
noStake:7800,
total:16900
},
{
id:3,
region:"제주",
title:"주말 비 시작될까?",
yes:81,
no:19,
yesStake:30100,
noStake:4200,
total:34300
}
];

function toast(msg){

toastEl.textContent = msg;

toastEl.classList.add("show");

clearTimeout(window.toastTimer);

window.toastTimer = setTimeout(()=>{
toastEl.classList.remove("show");
},2000);

}

function syncProfile(){

document.getElementById("nickname").textContent =
profile.nickname;

document.getElementById("profileName").textContent =
profile.nickname;

document.getElementById("profileCode").textContent =
`초대코드 ${profile.referral}`;

document.getElementById("profilePoint").textContent =
`${profile.points.toLocaleString()}P`;

document.getElementById("profileRate").textContent =
`${profile.hitRate}%`;

document.getElementById("profileStreak").textContent =
profile.streak;

}

function renderHotList(){

const box = document.getElementById("hotList");

box.innerHTML = "";

const sorted = [...predictions]
.sort((a,b)=>b.total-a.total)
.slice(0,3);

sorted.forEach((item,index)=>{

const div = document.createElement("div");

div.className = "board-item";

div.innerHTML = `
<div>
<div class="bi-title">
${index + 1}. ${item.region}
</div>

<div class="bi-sub">
${item.title}
</div>
</div>

<div class="bi-right">
${item.total.toLocaleString()}P
</div>
`;

box.appendChild(div);

});

}

function renderMarkets(){

const box = document.getElementById("marketList");

box.innerHTML = "";

predictions.forEach(item=>{

const card = document.createElement("div");

card.className = "market-card";

card.innerHTML = `
<div class="market-region">
${item.region}
</div>

<div class="market-title">
${item.title}
</div>

<div class="market-meta">
<span>실시간 참여</span>
<span>${item.total.toLocaleString()}P</span>
</div>

<div class="market-grid">

<div class="market-cell">
<span>온다</span>
<strong>${item.yes}%</strong>
<small>${item.yesStake.toLocaleString()}P</small>
</div>

<div class="market-cell">
<span>안 온다</span>
<strong>${item.no}%</strong>
<small>${item.noStake.toLocaleString()}P</small>
</div>

</div>

<div class="vote-row">

<button class="vote-btn rain"
onclick="vote('${item.title}','온다')">
온다
</button>

<button class="vote-btn clear"
onclick="vote('${item.title}','안 온다')">
안 온다
</button>

</div>
`;

box.appendChild(card);

});

}

function vote(title,choice){

const ok = confirm(
`${title}\n\n'${choice}'에 참여할까요?`
);

if(!ok) return;

toast(`${choice} 참여 완료 ✓`);

}

function checkin(){
toast("출석 포인트 지급 완료 🎉");
}

function copyInvite(){

navigator.clipboard.writeText(
`WETTY BETTY 초대코드 : ${profile.referral}`
);

toast("초대코드 복사 완료 🎁");

}

function onProfileClick(){

document
.getElementById("profileModal")
.classList.add("show");

}

function closeModal(){

document
.getElementById("profileModal")
.classList.remove("show");

}

function refreshWeather(){

toast("날씨 새로고침 완료 🌦️");

}

function logout(){

closeModal();

toast("로그아웃 완료");

}

syncProfile();
renderHotList();
renderMarkets();