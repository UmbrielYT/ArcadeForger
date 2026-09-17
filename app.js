/* ArcadeForge Community Plus
   Replace only these two values with your Supabase Project URL and Publishable key. */
const SB_URL="YOUR_SUPABASE_URL";
const SB_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY";
let db=null;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
let user=null,profile=null,authMode="login",owned=new Set(),equipped={outfit:null,colour:null,hat:null,accessory:null};
const GAME_COST=1000,VIP_COST=5000,PASS_COST=2500;
const shop=[
 ["hoodie","Forge Hoodie","🧥",100,"Outfit"],["cyber","Cyber Hoodie","🧥",250,"Outfit"],["gold","Golden Jacket","🥋",700,"Outfit"],
 ["ruby","Ruby Colour","🔴",150,"Colour"],["ocean","Ocean Colour","🔵",150,"Colour"],["green","Emerald Colour","🟢",150,"Colour"],
 ["cap","Forge Cap","🧢",200,"Hat"],["crown","Crown","👑",1000,"Hat"],["wizard","Wizard Hat","🧙",750,"Hat"],
 ["glasses","Cool Glasses","🕶️",300,"Accessory"],["star","Star Badge","⭐",400,"Accessory"],["sparkles","Sparkles","✨",800,"Accessory"]
];
const passRewards=[[1,"🪙 300 Coins","coins",300],[2,"🧢 Forge Cap","item","cap"],[3,"🪙 500 Coins","coins",500],[4,"🧥 Cyber Hoodie","item","cyber"],[5,"🪙 750 Coins","coins",750],[6,"⭐ Star Badge","item","star"],[7,"🪙 1,000 Coins","coins",1000],[8,"🧙 Wizard Hat","item","wizard"],[9,"🪙 1,500 Coins","coins",1500],[10,"👑 Crown","item","crown"]];
const colourEmoji={ruby:"🔴",ocean:"🔵",green:"🟢"};
function configured(){return typeof window.supabase!=="undefined"&&!SB_URL.startsWith("YOUR_")&&!SB_KEY.startsWith("YOUR_")}
function ensureDb(){if(!configured()){toast("Connect Supabase in app.js first. See SETUP.md.");return false}if(!db)db=window.supabase.createClient(SB_URL,SB_KEY);return true}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>x.classList.remove("show"),3200)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function coins(){const n=profile?.is_admin?"∞":(profile?.coins||0);["#coinPill","#shopCoins","#sideCoinBig"].forEach(id=>{const x=$(id);if(x)x.textContent=n});const sc=$("#sideCoins");if(sc)sc.textContent=profile?(profile.is_admin?"ADMIN · ∞ coins":`${profile.coins||0} coins`):"Sign in"}
function needLogin(){toast("Please sign in first.");openAuth("login")}
function character(){const outfit=equipped.outfit?shop.find(x=>x[0]===equipped.outfit)?.[2]:"👕";const hat=equipped.hat?shop.find(x=>x[0]===equipped.hat)?.[2]:"";const acc=equipped.accessory?shop.find(x=>x[0]===equipped.accessory)?.[2]:"";const col=equipped.colour?colourEmoji[equipped.colour]:"🟦";return {outfit,hat,acc,col}}
function avatarHtml(cls="avatar") {const c=character();return `<div class="${cls}"><span class="avHat">${c.hat}</span><span class="avHead">🙂</span><span class="avBody">${c.outfit}</span><span class="avCol">${c.col}</span><span class="avAcc">${c.acc}</span></div>`}
async function loadInventory(){owned=new Set();equipped={outfit:null,colour:null,hat:null,accessory:null};if(!user)return;const r=await db.from("inventory").select("item_id,equipped").eq("user_id",user.id);if(r.data)r.data.forEach(row=>{owned.add(row.item_id);if(row.equipped){const it=shop.find(x=>x[0]===row.item_id);if(it)equipped[{Outfit:"outfit",Colour:"colour",Hat:"hat",Accessory:"accessory"}[it[4]]]=it[0]}})}
async function refresh(){if(!configured()){user=null;profile=null;owned=new Set();equipped={outfit:null,colour:null,hat:null,accessory:null};renderShop();updatePass();loadLocalGames();coins();return;}try{const s=await db.auth.getSession();user=s.data.session?.user||null;profile=null;if(user){let r=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();if(r.error)throw r.error;profile=r.data;await loadInventory();$("#authBtn").textContent="Sign out";$("#mobileAuth").textContent="Sign out";$("#heroUser").textContent=`${profile?.is_admin?"👑 ":""}Welcome, ${profile?.username||user.email?.split("@")[0]||"Player"}!`;$("#heroSub").textContent=profile?.is_admin?"ADMIN · ∞ Forger Coins":`🪙 ${profile?.coins||0} coins · ${profile?.battle_xp||0} Battle XP`;$("#sideName").textContent=profile?.username||"Player";$("#sideAvatar").innerHTML=avatarHtml("miniCharacter");$("#heroAvatar").innerHTML=avatarHtml("heroAvatar");await renderProfile();updatePass()}else{$("#authBtn").textContent="Sign in";$("#mobileAuth").textContent="Sign in";$("#heroUser").textContent="Welcome to ArcadeForge";$("#heroSub").textContent="Sign in to save your profile and earn coins";$("#sideName").textContent="Guest";$("#sideAvatar").textContent="🧑";$("#heroAvatar").textContent="🧑";updatePass()}coins();renderShop();loadGames()}catch(e){console.error(e);toast(e.message||"Could not load your account.")}}
function localGames(){return [
 {id:"local-clicker",title:"Crystal Clicker",description:"Tap the crystal and beat your score.",icon:"💎",template:"clicker",plays:1240,likes:88,creator_id:"local",created_at:"2026-09-01",profiles:{username:"ArcadeForge",is_admin:true}},
 {id:"local-reaction",title:"Reaction Rush",description:"Wait for the signal, then click as fast as you can.",icon:"⚡",template:"reaction",plays:980,likes:74,creator_id:"local",created_at:"2026-09-02",profiles:{username:"ArcadeForge",is_admin:true}},
 {id:"local-memory",title:"Memory Match",description:"Match every pair before time runs out.",icon:"🧠",template:"memory",plays:760,likes:61,creator_id:"local",created_at:"2026-09-03",profiles:{username:"ArcadeForge",is_admin:true}},
 {id:"local-dodger",title:"Space Dodger",description:"Dodge falling meteors and survive.",icon:"🚀",template:"dodger",plays:1510,likes:102,creator_id:"local",created_at:"2026-09-04",profiles:{username:"ArcadeForge",is_admin:true}},
 {id:"local-snake",title:"Neon Snake",description:"Eat apples and grow without hitting yourself.",icon:"🐍",template:"snake",plays:1120,likes:93,creator_id:"local",created_at:"2026-09-05",profiles:{username:"ArcadeForge",is_admin:true}}
];}
function loadLocalGames(){const q=$("#search")?.value.trim().toLowerCase()||"";let games=localGames().filter(g=>!q||`${g.title} ${g.description}`.toLowerCase().includes(q));const sort=$("#sort")?.value||"new";if(sort==="plays")games.sort((a,b)=>b.plays-a.plays);if(sort==="likes")games.sort((a,b)=>b.likes-a.likes);renderGames(games);$("#gameCount").textContent=games.length;$("#featured").innerHTML=games.slice(0,6).map(card).join("");$("#creatorCount").textContent="1";$("#playCount").textContent=games.reduce((a,g)=>a+g.plays,0).toLocaleString();$("#leaderCount").textContent=user?"1":"0";}
async function loadGames(){if(!configured()){loadLocalGames();return;}if(!ensureDb())return;const q=$("#search")?.value.trim()||"",sort=$("#sort")?.value||"new";let query=db.from("games").select("id,title,description,icon,template,plays,likes,created_at,creator_id,profiles(username,is_admin)").eq("published",true);if(q)query=query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);query=sort==="plays"?query.order("plays",{ascending:false}):sort==="likes"?query.order("likes",{ascending:false}):query.order("created_at",{ascending:false});const r=await query.limit(60);if(r.error){console.error(r.error);toast("Could not load community games: "+r.error.message);return}const games=r.data||[];renderGames(games);$("#gameCount").textContent=games.length;$("#featured").innerHTML=games.slice(0,6).map(card).join("")||empty("No community games yet.");$("#creatorCount").textContent=new Set(games.map(g=>g.profiles?.username).filter(Boolean)).size;$("#playCount").textContent=games.reduce((a,g)=>a+(g.plays||0),0);$("#leaderCount").textContent=user?"1":"0"}
function empty(t){return `<div class="panel center">${esc(t)}</div>`}
function card(g){const creator=g.profiles?.username||"Creator";const admin=g.profiles?.is_admin?" <span class=adminTag>ADMIN</span>":"";return `<article class="card"><div class="cardArt">${esc(g.icon||"🎮")}</div><div class="cardBody"><h3>${esc(g.title)}</h3><p>${esc(g.description||"")}</p><div class="meta"><span>by ${esc(creator)}${admin} · ▶ ${g.plays||0}</span><button class="like" data-like="${g.id}">♥ ${g.likes||0}</button></div><button class="primary wide" data-play="${g.id}">Play</button></div></article>`}
function renderGames(games){$("#gamesGrid").innerHTML=games.map(card).join("")||empty("No games found.");$$('[data-play]').forEach(b=>b.onclick=()=>playGame(b.dataset.play));$$('[data-like]').forEach(b=>b.onclick=()=>likeGame(b.dataset.like))}
async function likeGame(id){if(!user)return needLogin();const r=await db.rpc("toggle_game_like",{game_id:id});if(r.error)toast(r.error.message);else{toast(r.data?"❤️ Liked!":"Like removed");loadGames()}}
async function playGame(id){if(!configured()){const g=localGames().find(x=>x.id===id);if(!g)return toast("Game not found");$("#gameModal").classList.remove("hidden");launch(g);return;}if(!ensureDb())return;const r=await db.from("games").select("*").eq("id",id).single();if(r.error)return toast(r.error.message);const p=await db.rpc("record_play",{game_id:id});if(p.error)toast(p.error.message);$("#gameModal").classList.remove("hidden");launch(r.data);if(user)setTimeout(refresh,700)}
function launch(g){const m=$("#gameMount");m.innerHTML=`<div class="gameShell"><div class="gamePlayerHead">${avatarHtml("gameAvatar")}<div><h2>${esc(g.icon||"🎮")} ${esc(g.title)}</h2><p>${esc(g.description||"")}</p></div></div><div id="miniGame"></div></div>`;const a=$("#miniGame");if(g.template==="clicker")clicker(a);else if(g.template==="reaction")reaction(a);else if(g.template==="memory")memory(a);else if(g.template==="snake")snake(a);else dodger(a)}
function reward(n){if(user)db.rpc("award_game_coins",{amount:n}).then(r=>{if(r.error)toast(r.error.message);else refresh()})}
function clicker(a){let n=0,t=10,done=false;a.innerHTML=`<p>Score: <b id="cs">0</b> · <b id="ct">10</b>s</p><button class="bigAction" id="cb">💎 CLICK!</button>`;$("#cb").onclick=()=>{if(!done){n++;$("#cs").textContent=n}};const x=setInterval(()=>{t--;$("#ct").textContent=Math.max(0,t);if(t<=0){done=true;clearInterval(x);$("#cb").disabled=true;reward(Math.min(50,10+n));toast("Round complete! Coins + Battle XP earned.")}},1000)}
function reaction(a){a.innerHTML=`<div class="reaction" id="rb">Wait for green…</div>`;let ready=false,start=0,finished=false;const timer=setTimeout(()=>{ready=true;start=performance.now();$("#rb").classList.add("ready");$("#rb").textContent="CLICK NOW!"},1000+Math.random()*2500);$("#rb").onclick=()=>{if(finished)return;if(!ready){clearTimeout(timer);toast("Too early!");return}finished=true;const ms=Math.round(performance.now()-start);$("#rb").textContent=`${ms} ms`;reward(Math.max(15,70-Math.floor(ms/10)))}}
function memory(a){const v=["🍎","🚀","⭐","🎮","💎","🐸","🔥","🌙"],c=[...v,...v].sort(()=>Math.random()-.5),open=[];a.innerHTML=`<div class="memory" id="mb"></div>`;c.forEach(x=>{const b=document.createElement("button");b.textContent="❔";b.onclick=()=>{if(b.textContent!=="❔"||open.length===2)return;b.textContent=x;open.push(b);if(open.length===2){const[p,q]=open;if(p.textContent===q.textContent){open.length=0;if($$("#mb button").every(z=>z.textContent!=="❔")){reward(60);toast("All matched!")}}else setTimeout(()=>{p.textContent=q.textContent="❔";open.length=0},500)}};$("#mb").appendChild(b)})}
function snake(a){a.innerHTML=`<canvas width="480" height="480" id="sc"></canvas><p>Arrow keys to move.</p>`;const c=$("#sc"),x=c.getContext("2d"),s=[{x:10,y:10}],d={x:1,y:0};let f={x:4,y:5},dead=false;const key=e=>{if(e.key==="ArrowUp"&&d.y!==1){d.x=0;d.y=-1}if(e.key==="ArrowDown"&&d.y!==-1){d.x=0;d.y=1}if(e.key==="ArrowLeft"&&d.x!==1){d.x=-1;d.y=0}if(e.key==="ArrowRight"&&d.x!==-1){d.x=1;d.y=0}};window.addEventListener("keydown",key);function loop(){if(dead){window.removeEventListener("keydown",key);return}const h={x:s[0].x+d.x,y:s[0].y+d.y};if(h.x<0||h.y<0||h.x>=20||h.y>=20||s.some(p=>p.x===h.x&&p.y===h.y)){dead=true;reward(Math.min(50,20+s.length*3));toast("Snake over!");window.removeEventListener("keydown",key);return}s.unshift(h);if(h.x===f.x&&h.y===f.y){f={x:Math.random()*20|0,y:Math.random()*20|0}}else s.pop();x.clearRect(0,0,480,480);x.font="22px sans-serif";x.fillText("🍎",f.x*24,f.y*24+21);s.forEach(p=>x.fillText("🟩",p.x*24,p.y*24+21));setTimeout(loop,130)}loop()}
function dodger(a){a.innerHTML=`<canvas width="640" height="360" id="dc"></canvas><p>Use A/D or ←/→. Survive!</p>`;const c=$("#dc"),x=c.getContext("2d");let px=300,rocks=[],left=false,right=false,start=performance.now(),done=false;const kd=e=>{if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")left=true;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")right=true},ku=e=>{if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")left=false;if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")right=false};window.addEventListener("keydown",kd);window.addEventListener("keyup",ku);function loop(now){if(done)return;x.clearRect(0,0,640,360);if(left)px-=6;if(right)px+=6;px=Math.max(0,Math.min(600,px));if(Math.random()<.04)rocks.push({x:Math.random()*610,y:-20});rocks.forEach(r=>r.y+=3);x.font="24px sans-serif";x.fillText("🚀",px,335);rocks.forEach(r=>x.fillText("☄️",r.x,r.y));if(rocks.some(r=>r.y>300&&Math.abs(r.x-px)<35)){done=true;reward(Math.min(50,20+Math.floor((now-start)/1000)));toast("Round over! Reward earned.");window.removeEventListener("keydown",kd);window.removeEventListener("keyup",ku);return}requestAnimationFrame(loop)}requestAnimationFrame(loop)}
function openAuth(mode){authMode=mode;$("#authTitle").textContent=mode==="login"?"Sign in":"Create account";$("#authSubmit").textContent=mode==="login"?"Sign in":"Create account";$("#usernameWrap").style.display=mode==="login"?"none":"block";$("#switchAuth").textContent=mode==="login"?"Need an account? Sign up":"Already have an account? Sign in";$("#authMsg").textContent="";$("#authModal").classList.remove("hidden");setTimeout(()=>$("#email").focus(),50)}
async function authSubmit(e){
  e.preventDefault();
  if(!ensureDb()) return;
  const email=$("#email").value.trim();
  const password=$("#password").value;
  const btn=$("#authSubmit");
  btn.disabled=true;
  $("#authMsg").textContent="Working…";
  try{
    let r;
    if(authMode==="login") {
      r=await db.auth.signInWithPassword({email,password});
    } else {
      const username=$("#username").value.trim();
      if(!username){ $("#authMsg").textContent="Choose a username."; return; }
      r=await db.auth.signUp({email,password,options:{data:{username}}});
    }
    if(r.error){
      $("#authMsg").textContent=prettyAuthError(r.error);
      return;
    }
    if(authMode==="signup" && r.data && r.data.session===null){
      $("#authMsg").textContent="Account created. Check your email to confirm it, then sign in.";
    } else {
      $("#authModal").classList.add("hidden");
      await refresh();
    }
  }catch(err){
    console.error(err);
    $("#authMsg").textContent=prettyAuthError(err);
  }finally{
    btn.disabled=false;
  }
}
function prettyAuthError(e){const m=e?.message||String(e);if(/invalid login credentials/i.test(m))return "Email or password is incorrect.";if(/email not confirmed/i.test(m))return "Please confirm your email first, then sign in.";if(/user already registered/i.test(m))return "That email already has an account. Switch to Sign in.";if(/password/i.test(m)&&/6|short|characters/i.test(m))return "Password must be at least 6 characters.";return m}
$("#authForm").onsubmit=authSubmit;$("#authBtn").onclick=async()=>{if(user){await db.auth.signOut();await refresh()}else openAuth("login")};$("#mobileAuth").onclick=()=>user?db.auth.signOut().then(refresh):openAuth("login");$("#profileSign").onclick=()=>openAuth("login");$("#switchAuth").onclick=()=>openAuth(authMode==="login"?"signup":"login");$$('[data-close]').forEach(x=>x.onclick=()=>x.closest(".modal").classList.add("hidden"));
function detectTemplate(p){p=p.toLowerCase();if(/snake|worm|grid/.test(p))return"snake";if(/memory|match|pairs|cards/.test(p))return"memory";if(/reaction|reflex|quick|speed|fast/.test(p))return"reaction";if(/space|meteor|dodge|survive|rocket/.test(p))return"dodger";return"clicker"}
function aiName(t){if($("#aiName").value.trim())return $("#aiName").value.trim();return {snake:"Neon Snake Arena",memory:"Memory Mayhem",reaction:"Reaction Rush",dodger:"Meteor Escape",clicker:"Crystal Clicker X"}[t]}
$("#aiPrompt").oninput=()=>{const p=$("#aiPrompt").value.trim(),t=detectTemplate(p);$("#previewName").textContent=$("#aiName").value.trim()||"AI will name it";$("#previewDesc").textContent=p||"Describe your idea and the generator will build it here.";$("#previewType").textContent=p?`Template detected: ${t}`:"Waiting for idea…"};["aiName","aiIcon"].forEach(id=>$("#"+id).oninput=()=>{$("#previewName").textContent=$("#aiName").value||"AI will name it";$("#previewIcon").textContent=$("#aiIcon").value||"🤖"});
$("#aiForm").onsubmit=async e=>{e.preventDefault();if(!user)return needLogin();const prompt=$("#aiPrompt").value.trim();if(!prompt)return;const template=detectTemplate(prompt),title=aiName(template),description=prompt.slice(0,160),icon=$("#aiIcon").value||"🤖";const r=await db.rpc("create_game_paid",{p_title:title,p_description:description,p_template:template,p_icon:icon});if(r.error)toast(r.error.message);else{toast(profile?.is_admin?"🤖 Game forged by admin!":"🤖 Game forged! 1,000 coins spent.");e.target.reset();$("#aiIcon").value="🤖";await refresh();location.hash="games"}};
let shopFilter="all";
function renderShop(){const grid=$("#shopGrid");if(!grid)return;let html=`<div class="shopItem vipItem"><div class="icon">👑</div><b>VIP</b><small>VIP badge + special profile status</small><div class="price"><span>🪙 5,000</span><button class="buy" id="buyVip" ${profile?.vip?"disabled":""}>${profile?.vip?"Owned":"Buy VIP"}</button></div></div>`;const list=shop.filter(i=>shopFilter==="all"||i[4]===shopFilter);html+=list.map(i=>`<div class="shopItem ${owned.has(i[0])?"owned":""}"><div class="icon">${i[2]}</div><b>${i[1]}</b><small>${i[4]}</small><div class="price"><span>🪙 ${i[3].toLocaleString()}</span><button class="buy" data-buy="${i[0]}" ${owned.has(i[0])?"disabled":""}>${owned.has(i[0])?"Owned":"Buy"}</button></div></div>`).join("");grid.innerHTML=html;$("#buyVip").onclick=buyVip;$$('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.filter===shopFilter))}
$$('.tab').forEach(b=>b.onclick=()=>{shopFilter=b.dataset.filter;renderShop()});
async function buyVip(){if(!user)return needLogin();const r=await db.rpc("buy_vip");if(r.error)toast(r.error.message);else{toast("👑 VIP unlocked!");await refresh()}}
async function buy(id){if(!user)return needLogin();if(owned.has(id))return;const r=await db.rpc("buy_cosmetic",{item_id:id});if(r.error)toast(r.error.message);else{toast("✨ Item unlocked! Equip it in your Profile.");await refresh()}}
function renderPass(){const grid=$("#battleRewards");grid.innerHTML=passRewards.map(r=>{const unlocked=(profile?.battle_xp||0)>=r[0]*100;return `<div class="reward ${unlocked?"ready":""}"><b>Tier ${r[0]}</b><span>${r[1]}</span><small>${profile?.battle_pass?(unlocked?"Unlocked":"Locked until "+(r[0]*100)+" XP"):"Buy the pass to unlock"}</small><button class="buyReward" data-tier="${r[0]}" ${profile?.battle_pass&&unlocked?"":"disabled"}>Claim</button></div>`}).join("");$$('[data-tier]').forEach(b=>b.onclick=()=>claimReward(+b.dataset.tier))}
function updatePass(){renderPass();const ownedPass=!!profile?.battle_pass;$("#passStatus").textContent=ownedPass?`ACTIVE · ${Math.min(10,Math.floor((profile?.battle_xp||0)/100))}/10 TIERS`:"NOT OWNED";$("#bpProgress").textContent=user?`Battle XP: ${profile?.battle_xp||0} · ${Math.max(0,100-((profile?.battle_xp||0)%100))} XP to next tier`:"Sign in to see your progress.";$("#buyPass").disabled=!user||ownedPass;$("#buyPass").textContent=ownedPass?"Battle Pass Owned":"Buy Battle Pass — 🪙 2,500"}
async function claimReward(tier){if(!user)return needLogin();const r=await db.rpc("claim_battle_reward",{p_tier:tier});if(r.error)toast(r.error.message);else{toast("🎁 Battle Pass reward claimed!");await refresh()}}
$("#buyPass").onclick=async()=>{if(!user)return needLogin();const r=await db.rpc("buy_battle_pass");if(r.error)toast(r.error.message);else{toast("🎟️ Battle Pass unlocked!");await refresh()}};
async function daily(){if(!user)return needLogin();const r=await db.rpc("claim_daily_reward");if(r.error)toast(r.error.message);else if(r.data?.claimed){toast(`🌞 Daily reward: +${r.data.coins} coins and +${r.data.xp} Battle XP!`);await refresh()}else toast("🌞 Daily reward already claimed today.")}
async function equip(id){if(!user)return needLogin();if(!owned.has(id))return toast("Buy this item in the Store first.");const r=await db.rpc("equip_cosmetic",{item_id:id});if(r.error)toast(r.error.message);else{toast("✨ Equipped!");await refresh()}}
function itemName(id){return shop.find(x=>x[0]===id)?.[1]||id}
async function renderProfile(){if(!user)return;const inv=await db.from("inventory").select("item_id,equipped").eq("user_id",user.id);const items=inv.data||[];const admin=profile?.is_admin?"👑 ADMIN · ∞ COINS":"";const vip=profile?.vip?"👑 VIP":"";const cosmetics=shop.filter(i=>owned.has(i[0]));$("#profileContent").innerHTML=`<div class="panel characterPanel"><div class="characterStage">${avatarHtml("bigCharacter")}</div><div class="profileInfo"><span class="eyebrow">PLAYER PROFILE</span><h1>${esc(profile?.username||"Player")}</h1><p class="badges">${admin||vip||"Community Player"}</p><div class="profileStats"><span>🪙 ${profile?.is_admin?"∞":(profile?.coins||0)} Coins</span><span>🎮 ${profile?.games_created||0} Games</span><span>🎟️ ${profile?.battle_xp||0} XP</span></div><button class="primary" id="dailyBtn">🌞 Claim Daily Reward</button><button class="secondary" id="logout2">Sign out</button></div></div><div class="panel"><div class="sectionTitle"><div><span class="eyebrow">CHARACTER DESIGNER</span><h2>Equip your owned items</h2></div><span class="hint">Only purchased/claimed items can be equipped.</span></div><div class="equipGrid">${["Outfit","Colour","Hat","Accessory"].map(type=>{const arr=cosmetics.filter(i=>i[4]===type);return `<div class="equipBox"><h3>${type}</h3>${arr.length?arr.map(i=>`<button class="equipBtn ${equipped[{Outfit:"outfit",Colour:"colour",Hat:"hat",Accessory:"accessory"}[type]]===i[0]?"equipped":""}" data-equip="${i[0]}"><span>${i[2]}</span>${esc(i[1])}${equipped[{Outfit:"outfit",Colour:"colour",Hat:"hat",Accessory:"accessory"}[type]]===i[0]?" ✓":""}</button>`).join(""):"<small>Buy items in the Store.</small>"}</div>`}).join("")}</div></div><div class="panel"><h2>Owned cosmetics</h2><p>${items.length?items.map(x=>`<span class="ownedChip">${esc(itemName(x.item_id))}${x.equipped?" ✓":""}</span>`).join(""):"No cosmetics yet — visit the Store!"}</p></div>`;$("#dailyBtn").onclick=daily;$("#logout2").onclick=async()=>{await db.auth.signOut();await refresh()};$$('[data-equip]').forEach(b=>b.onclick=()=>equip(b.dataset.equip))}
$("#search").oninput=loadGames;$("#sort").onchange=loadGames;db=null;
function init(){if(configured())db=window.supabase.createClient(SB_URL,SB_KEY);else toast("ArcadeForge is ready. Add your Supabase URL and Publishable key in app.js to enable accounts.");renderShop();updatePass();if(configured()){db.auth.onAuthStateChange(()=>setTimeout(refresh,0));refresh()}}
init();

/* Navigation + sidebar behavior. Kept at the end so it also works when Supabase is not configured. */
function showPage(name,updateHash=true){
  const allowed=["home","games","create","shop","battlepass","profile"];
  if(!allowed.includes(name)) name="home";
  $$(".page").forEach(p=>p.classList.toggle("pageActive",p.id===name));
  $$(".sideNav a[data-page]").forEach(a=>a.classList.toggle("active",a.dataset.page===name));
  if(updateHash && location.hash!==`#${name}`) history.replaceState(null,"",`#${name}`);
  const page=$("#"+name); if(page) window.scrollTo({top:0,behavior:"smooth"});
  closeMobileSidebar();
}
function handleHash(){showPage((location.hash||"#home").slice(1),false)}
function closeMobileSidebar(){
  $("#sidebar")?.classList.remove("mobileOpen");
  $("#sidebarBackdrop")?.classList.add("hidden");
}
function openMobileSidebar(){
  $("#sidebar")?.classList.add("mobileOpen");
  $("#sidebarBackdrop")?.classList.remove("hidden");
}
function setupNavigation(){
  $$(".sideNav a[data-page], .brand[data-page]").forEach(a=>a.addEventListener("click",()=>setTimeout(handleHash,0)));
  $$(".actions a, .mobileTop .brand").forEach(a=>a.addEventListener("click",()=>setTimeout(handleHash,0)));
  $("#collapseSidebar")?.addEventListener("click",()=>{
    $("#sidebar")?.classList.toggle("collapsed");
    const collapsed=$("#sidebar")?.classList.contains("collapsed");
    localStorage.setItem("af_sidebar_collapsed",collapsed?"1":"0");
  });
  if(localStorage.getItem("af_sidebar_collapsed")==="1") $("#sidebar")?.classList.add("collapsed");
  $("#mobileMenu")?.addEventListener("click",openMobileSidebar);
  $("#sidebarBackdrop")?.addEventListener("click",closeMobileSidebar);
  $(".sideUser")?.addEventListener("click",()=>{location.hash="#profile";handleHash();});
  $(".sideUser")?.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();location.hash="#profile";handleHash();}});
  window.addEventListener("hashchange",handleHash);
  handleHash();
}
setupNavigation();
