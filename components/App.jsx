"use client";

import { useState, useEffect, useCallback, useRef } from "react";
// Supabase import - works in Next.js, gracefully skipped in artifact
let supabase;
try { supabase = require("../lib/supabase").supabase; } catch(e) { supabase = null; }

const START = new Date(2026, 3, 1);
const END = new Date(2027, 2, 30);
const WARRIORS = [
  { id:"lucy13", alias:"Lucy13", gender:"F", pin:"1111", role:"warrior", calGoal:"deficit" },
  { id:"meliodas99", alias:"Meliodas99", gender:"M", pin:"2222", role:"admin", calGoal:"deficit" },
  { id:"neko98", alias:"Neko98", gender:"F", pin:"3333", role:"warrior", calGoal:"deficit" },
  { id:"optimus69", alias:"Optimus69", gender:"M", pin:"4444", role:"warrior", calGoal:"surplus" },
  { id:"rezio21", alias:"Rezio21", gender:"M", pin:"5555", role:"warrior", calGoal:"deficit" },
  { id:"tifalockhart88", alias:"TifaLockhart88", gender:"F", pin:"6666", role:"warrior", calGoal:"deficit" },
];
const MODS = [
  { id:"emeraldphantom", alias:"EmeraldPhantom", gender:"F", pin:"7777", role:"moderator" },
  { id:"annihilator69", alias:"Annihilator69", gender:"M", pin:"8888", role:"moderator" },
];
const ALL = [...WARRIORS, ...MODS];
const BEX = ["Bench Press","Squat","Deadlift","OHP","Chest Press","Pull-Ups","Push-Ups"];
const GEX = ["Weights (hrs)","Cardio (hrs)","Yoga (hrs)","Stretching (hrs)","Water Drinking (L)"];
const RANKS = [
  {n:"DIAMOND",min:0.95,bg:"#00BFFF",fg:"#fff",e:"💎"},
  {n:"PLATINUM",min:0.85,bg:"#6C3FC5",fg:"#fff",e:"⚡"},
  {n:"GOLD",min:0.70,bg:"#FFD700",fg:"#000",e:"🥇"},
  {n:"SILVER",min:0.50,bg:"#A8A9AD",fg:"#000",e:"🥈"},
  {n:"BRONZE",min:0,bg:"#CD7F32",fg:"#fff",e:"🥉"},
];
function gR(p){if(p==null||isNaN(p))return null;for(const t of RANKS){if(p>=t.min)return t;}return RANKS[4];}
const MSGS={
  perfect:["Absolute MACHINE. 💎","You showed OUT.","Consistency is jealous.","No notes. Excellence.","The gym bows to you."],
  great:["Strong. Consistent.","85%+ and hungry? Mindset.","Couch people envy you.","Solid. Close the gap.","Getting built different."],
  ok:["Mid. But you showed up.","Average = last place here.","Couch misses you.","50% in, 50% out.","Competition outworking you."],
  bad:["Grandma moves more.","Rest WEEK energy.","Leaderboard is crying.","Sloth vibes.","Participation trophy earned."],
  cheat:["Cheat day nutrition. Enjoy.","Pizza earned. Remember weigh-in.","Recharge only. We watch."],
};
function gMsg(p,c){if(c)return MSGS.cheat[Math.floor(Math.random()*MSGS.cheat.length)];const a=p>=.95?MSGS.perfect:p>=.75?MSGS.great:p>=.5?MSGS.ok:MSGS.bad;return a[Math.floor(Math.random()*a.length)];}

// Achievement definitions
const ACHIEVEMENTS = [
  {id:"first_log",name:"First Steps",desc:"Logged your first day",icon:"🏁",check:(d,uid)=>Object.keys(d?.[uid]?.daily||{}).length>=1},
  {id:"streak_7",name:"Week Warrior",desc:"7-day streak",icon:"🔥",check:(d,uid)=>calcStrk(d,uid)>=7},
  {id:"streak_30",name:"Monthly Machine",desc:"30-day streak",icon:"⚡",check:(d,uid)=>calcStrk(d,uid)>=30},
  {id:"streak_100",name:"Centurion",desc:"100-day streak",icon:"💯",check:(d,uid)=>calcStrk(d,uid)>=100},
  {id:"first_diamond",name:"Diamond Debut",desc:"Hit Diamond rank in a week",icon:"💎",check:(d,uid)=>{for(let w=0;w<52;w++){const s=calcWk(d,uid,w);if(s.consistency>=0.95)return true;}return false;}},
  {id:"multiplier_max",name:"Max Power",desc:"Hit 1.25x multiplier",icon:"🚀",check:(d,uid)=>{for(let w=0;w<52;w++){const s=calcWk(d,uid,w);if(s.multiplier>=1.25)return true;}return false;}},
  {id:"perfect_day",name:"Flawless",desc:"Score 100% in a day",icon:"✨",check:(d,uid)=>{const ks=Object.keys(d?.[uid]?.daily||{});for(const k of ks){const dt=new Date(k+"T00:00:00");const e=d[uid].daily[k];const r=calcP(e,dt,uid,d);if(r.mx>0&&r.pts>=r.mx)return true;}return false;}},
];

function dB(a,b){return Math.round((b-a)/864e5);}
function toK(d){return d.toISOString().split("T")[0];}
const DF=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function fm(d){return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();}
function gWI(d){return Math.floor(dB(START,d)/7);}
function gWN(d){return gWI(d)+1;}
function isW(d){const w=gWI(d),i=dB(START,d)%7;return w%2===0?[0,2,4,5].includes(i):[1,3,6].includes(i);}
function gWT(w){return w%2===0?4:3;}
function gWS(d){const dow=d.getDay(),off=(dow+4)%7,ws=new Date(d);ws.setDate(ws.getDate()-off);ws.setHours(0,0,0,0);return ws;}
function gWE(ws){const we=new Date(ws);we.setDate(we.getDate()+6);return we;}
function tog(c,v){return c===v?"":v;}

const SK="tf4_data";
// Local cache - loads from Supabase on login, falls back to localStorage
function ld(){try{return JSON.parse(localStorage.getItem(SK))||{};}catch{return{};}}
function sv(d){localStorage.setItem(SK,JSON.stringify(d));}


// Guard: if supabase not available, sync functions are no-ops
const _sb = () => !!supabase;
// Supabase sync functions
async function loadFromSupabase() {
  const data = {};
  if (!supabase) return data;
  try {
    // Fetch all data in parallel
    const [usersRes, logsRes, targetsRes, exLogsRes, weightsRes, flagsRes, commentsRes, cheatsRes, pendingRes] = await Promise.all([
      supabase.from("users").select("*"),
      supabase.from("daily_logs").select("*"),
      supabase.from("exercise_targets").select("*"),
      supabase.from("exercise_logs").select("*"),
      supabase.from("weights").select("*"),
      supabase.from("flags").select("*"),
      supabase.from("comments").select("*"),
      supabase.from("cheat_days").select("*"),
      supabase.from("pending_exercises").select("*"),
    ]);

    // Build user ID map from Supabase UUIDs to our local alias-based IDs
    const userMap = {};
    const userMapReverse = {};
    (usersRes.data || []).forEach(u => {
      const localId = u.alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      userMap[u.id] = localId;
      userMapReverse[localId] = u.id;
      // Store PIN from DB
      if (!data._dbPins) data._dbPins = {};
      data._dbPins[localId] = u.pin;
    });
    data._userMap = userMap;
    data._userMapReverse = userMapReverse;

    // Process daily logs
    (logsRes.data || []).forEach(log => {
      const uid = userMap[log.user_id];
      if (!uid) return;
      if (!data[uid]) data[uid] = { daily: {}, exercise: {}, weight: {}, exerciseTargets: {}, cheatDays: {}, strengthProofs: {} };
      data[uid].daily[log.log_date] = {
        workout: log.workout || "",
        calTarget: log.cal_target || "",
        ateClean: log.ate_clean || "",
        ateOnTime: log.ate_on_time || "",
        sleep: log.sleep || "",
        steps: log.steps || "",
        water: log.water || "",
        protein: log.protein || "",
        carbs: log.carbs || "",
        fats: log.fats || "",
        calories: log.calories || "",
        photo: log.photo || null,
        comment: log.comment || "",
        _dbId: log.id,
      };
    });

    // Process exercise targets
    (targetsRes.data || []).forEach(t => {
      const uid = userMap[t.user_id];
      if (!uid) return;
      if (!data[uid]) data[uid] = { daily: {}, exercise: {}, weight: {}, exerciseTargets: {}, cheatDays: {}, strengthProofs: {} };
      if (!data[uid].exerciseTargets) data[uid].exerciseTargets = {};
      data[uid].exerciseTargets[t.exercise_name] = {
        starting: t.starting_value,
        weekly: t.weekly_target,
        monthly: t.monthly_target,
      };
    });

    // Process exercise logs
    (exLogsRes.data || []).forEach(el => {
      const uid = userMap[el.user_id];
      if (!uid) return;
      if (!data[uid]) data[uid] = { daily: {}, exercise: {}, weight: {}, exerciseTargets: {}, cheatDays: {}, strengthProofs: {} };
      if (!data[uid].exercise) data[uid].exercise = {};
      if (!data[uid].exercise[el.week_num]) data[uid].exercise[el.week_num] = {};
      data[uid].exercise[el.week_num][el.exercise_name] = el.best_value;
      // Store proof
      if (el.proof_photo) {
        if (!data[uid].strengthProofs) data[uid].strengthProofs = {};
        data[uid].strengthProofs[el.week_num + "_" + el.exercise_name] = el.proof_photo;
      }
      // Store proof status
      if (!data._proofApprovals) data._proofApprovals = {};
      data._proofApprovals[uid + "_" + el.week_num + "_" + el.exercise_name] = el.proof_status || "pending";
    });

    // Process weights
    (weightsRes.data || []).forEach(w => {
      const uid = userMap[w.user_id];
      if (!uid) return;
      if (!data[uid]) data[uid] = { daily: {}, exercise: {}, weight: {}, exerciseTargets: {}, cheatDays: {}, strengthProofs: {} };
      if (!data[uid].weight) data[uid].weight = {};
      data[uid].weight[w.week_num] = w.weight_kg;
    });

    // Process flags
    data._flags = {};
    (flagsRes.data || []).forEach(f => {
      const uid = userMap[f.user_id];
      const modUid = userMap[f.mod_id];
      if (!uid) return;
      const k = uid + "_" + f.log_date;
      if (!data._flags[k]) data._flags[k] = [];
      data._flags[k].push({
        modId: modUid,
        msg: f.message,
        severity: f.severity,
        deduction: f.deduction,
        ts: new Date(f.created_at).getTime(),
        response: f.response || null,
        resolved: f.resolved,
        genuine: f.genuine,
        _dbId: f.id,
      });
    });

    // Process comments
    data._comments = {};
    (commentsRes.data || []).forEach(c => {
      const uid = userMap[c.user_id];
      const authorUid = userMap[c.author_id];
      if (!uid) return;
      const k = uid + "_" + c.log_date;
      if (!data._comments[k]) data._comments[k] = [];
      data._comments[k].push({ authorId: authorUid, msg: c.message, ts: new Date(c.created_at).getTime() });
    });

    // Process cheat days
    (cheatsRes.data || []).forEach(cd => {
      const uid = userMap[cd.user_id];
      if (!uid) return;
      if (!data[uid]) data[uid] = { daily: {}, exercise: {}, weight: {}, exerciseTargets: {}, cheatDays: {}, strengthProofs: {} };
      if (!data[uid].cheatDays) data[uid].cheatDays = {};
      data[uid].cheatDays[cd.week_num] = cd.day_index;
    });

    // Process pending exercises
    data._pendingExercises = (pendingRes.data || []).map(pe => ({
      uid: userMap[pe.user_id],
      name: pe.exercise_name,
      unit: pe.unit,
      status: pe.status,
      ts: new Date(pe.created_at).getTime(),
      _dbId: pe.id,
    }));

  } catch (err) {
    console.error("Failed to load from Supabase:", err);
  }
  return data;
}

// Write helpers - write to Supabase in background
async function syncDailyLog(userMapReverse, uid, date, entry) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try {
    await supabase.from("daily_logs").upsert({
      user_id: dbUid, log_date: date,
      workout: entry.workout || "", cal_target: entry.calTarget || "",
      ate_clean: entry.ateClean || "", ate_on_time: entry.ateOnTime || "",
      sleep: entry.sleep || 0, steps: entry.steps || 0, water: entry.water || 0,
      protein: entry.protein || 0, carbs: entry.carbs || 0, fats: entry.fats || 0,
      calories: entry.calories || 0, photo: entry.photo || "", comment: entry.comment || "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,log_date" });
  } catch (e) { console.error("Sync daily log error:", e); }
}

async function syncExerciseTarget(userMapReverse, uid, exName, targets) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try {
    await supabase.from("exercise_targets").upsert({
      user_id: dbUid, exercise_name: exName,
      starting_value: targets.starting || 0, weekly_target: targets.weekly || 0,
      monthly_target: targets.monthly || 0, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,exercise_name" });
  } catch (e) { console.error("Sync target error:", e); }
}

async function syncExerciseLog(userMapReverse, uid, weekNum, exName, bestValue, proofPhoto) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try {
    const payload = { user_id: dbUid, week_num: weekNum, exercise_name: exName, best_value: bestValue || 0 };
    if (proofPhoto !== undefined) payload.proof_photo = proofPhoto || "";
    await supabase.from("exercise_logs").upsert(payload, { onConflict: "user_id,week_num,exercise_name" });
  } catch (e) { console.error("Sync exercise log error:", e); }
}

async function syncWeight(userMapReverse, uid, weekNum, kg) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try {
    await supabase.from("weights").upsert({ user_id: dbUid, week_num: weekNum, weight_kg: kg }, { onConflict: "user_id,week_num" });
  } catch (e) { console.error("Sync weight error:", e); }
}

async function syncCheatDay(userMapReverse, uid, weekNum, dayIndex) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try {
    if (dayIndex === null) {
      await supabase.from("cheat_days").delete().eq("user_id", dbUid).eq("week_num", weekNum);
    } else {
      await supabase.from("cheat_days").upsert({ user_id: dbUid, week_num: weekNum, day_index: dayIndex }, { onConflict: "user_id,week_num" });
    }
  } catch (e) { console.error("Sync cheat error:", e); }
}

async function syncFlag(userMapReverse, uid, date, modUid, msg, sev, ded) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  const dbModId = userMapReverse?.[modUid];
  if (!dbUid || !dbModId) return;
  try {
    await supabase.from("flags").insert({ user_id: dbUid, log_date: date, mod_id: dbModId, message: msg, severity: sev, deduction: ded });
  } catch (e) { console.error("Sync flag error:", e); }
}

async function syncFlagResponse(flagDbId, response) {
  if(!_sb()||!flagDbId) return;
  try { await supabase.from("flags").update({ response }).eq("id", flagDbId); } catch (e) { console.error(e); }
}

async function syncFlagResolve(flagDbId, genuine) {
  if(!_sb()||!flagDbId) return;
  try { await supabase.from("flags").update({ resolved: true, genuine }).eq("id", flagDbId); } catch (e) { console.error(e); }
}

async function syncComment(userMapReverse, uid, date, authorUid, msg) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  const dbAuthorId = userMapReverse?.[authorUid];
  if (!dbUid || !dbAuthorId) return;
  try { await supabase.from("comments").insert({ user_id: dbUid, log_date: date, author_id: dbAuthorId, message: msg }); } catch (e) { console.error(e); }
}

async function syncPendingExercise(userMapReverse, uid, name, unit) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try { await supabase.from("pending_exercises").insert({ user_id: dbUid, exercise_name: name, unit }); } catch (e) { console.error(e); }
}

async function syncApproveExercise(dbId, approved) {
  if(!_sb()||!dbId) return;
  try { await supabase.from("pending_exercises").update({ status: approved ? "approved" : "rejected" }).eq("id", dbId); } catch (e) { console.error(e); }
}

async function syncPin(userMapReverse, uid, newPin) {
  if(!_sb())return;
  const dbUid = userMapReverse?.[uid];
  if (!dbUid) return;
  try { await supabase.from("users").update({ pin: newPin }).eq("id", dbUid); } catch (e) { console.error(e); }
}
function ini(d,u){if(!d[u])d[u]={daily:{},exercise:{},weight:{},exerciseTargets:{},cheatDays:{},strengthProofs:{}};return d;}
function gE(d,u,k){return d?.[u]?.daily?.[k]||null;}
function sE(d,u,k,e){ini(d,u);d[u].daily[k]=e;syncDailyLog(d._userMapReverse,u,k,e);return{...d};}
function gEx(d,u,w){return d?.[u]?.exercise?.[w]||{};}
function sEx(d,u,w,e){ini(d,u);if(!d[u].exercise)d[u].exercise={};d[u].exercise[w]=e;Object.entries(e).forEach(([ex,val])=>{if(val!=="")syncExerciseLog(d._userMapReverse,u,w,ex,val);});return{...d};}
function gWt(d,u,w){return d?.[u]?.weight?.[w]||null;}
function sWt(d,u,w,k){ini(d,u);if(!d[u].weight)d[u].weight={};d[u].weight[w]=k;syncWeight(d._userMapReverse,u,w,k);return{...d};}
function gT(d,u){return d?.[u]?.exerciseTargets||{};}
function sT(d,u,t){ini(d,u);d[u].exerciseTargets=t;Object.entries(t).forEach(([ex,val])=>{syncExerciseTarget(d._userMapReverse,u,ex,val);});return{...d};}
function gCD(d,u,w){return d?.[u]?.cheatDays?.[w]??null;}
function sCD(d,u,w,i){ini(d,u);if(!d[u].cheatDays)d[u].cheatDays={};if(i===null)delete d[u].cheatDays[w];else d[u].cheatDays[w]=i;syncCheatDay(d._userMapReverse,u,w,i);return{...d};}
function gFl(d){return d?._flags||{};}
function aFl(d,u,k,m,msg,sev,ded){if(!d._flags)d._flags={};const key=u+"_"+k;if(!d._flags[key])d._flags[key]=[];d._flags[key].push({modId:m,msg,severity:sev||"medium",deduction:ded||0.4,ts:Date.now(),response:null,resolved:false,genuine:null});syncFlag(d._userMapReverse,u,k,m,msg,sev||"medium",ded||0.4);return{...d};}
function rFl(d,u,k,i,r){const key=u+"_"+k;if(d._flags?.[key]?.[i]){d._flags[key][i].response=r;syncFlagResponse(d._flags[key][i]._dbId,r);}return{...d};}
function resFl(d,u,k,i,g){const key=u+"_"+k;if(d._flags?.[key]?.[i]){d._flags[key][i].resolved=true;d._flags[key][i].genuine=g;syncFlagResolve(d._flags[key][i]._dbId,g);}return{...d};}
function gCom(d,u,k){return d?._comments?.[u+"_"+k]||[];}
function aCom(d,u,k,a,m){if(!d._comments)d._comments={};const key=u+"_"+k;if(!d._comments[key])d._comments[key]=[];d._comments[key].push({authorId:a,msg:m,ts:Date.now()});syncComment(d._userMapReverse,u,k,a,m);return{...d};}
function gPE(d){return d?._pendingExercises||[];}
function aPE(d,u,n,un){if(!d._pendingExercises)d._pendingExercises=[];d._pendingExercises.push({uid:u,name:n,unit:un,status:"pending",ts:Date.now()});syncPendingExercise(d._userMapReverse,u,n,un);return{...d};}
function appPE(d,i,ok){if(d._pendingExercises?.[i]){d._pendingExercises[i].status=ok?"approved":"rejected";syncApproveExercise(d._pendingExercises[i]._dbId,ok);}return{...d};}
function gCE(d,u){return(d?._pendingExercises||[]).filter(e=>e.uid===u&&e.status==="approved").map(e=>e.name);}
function gSP(d,u,w,e){return d?.[u]?.strengthProofs?.[w+"_"+e]||null;}
function sSP(d,u,w,e,p){ini(d,u);if(!d[u].strengthProofs)d[u].strengthProofs={};d[u].strengthProofs[w+"_"+e]=p;return{...d};}
function gPS(d,u,w,e){return d?._proofApprovals?.[u+"_"+w+"_"+e]||"pending";}
function sPS(d,u,w,e,s){if(!d._proofApprovals)d._proofApprovals={};d._proofApprovals[u+"_"+w+"_"+e]=s;
  const dbUid=d._userMapReverse?.[u];if(dbUid){supabase.from("exercise_logs").update({proof_status:s}).eq("user_id",dbUid).eq("week_num",w).eq("exercise_name",e).then(()=>{}).catch(e=>console.error(e));}
  return{...d};}

// H2H challenges
function gH2H(d){return d?._h2h||[];}
function aH2H(d,from,to,wn){if(!d._h2h)d._h2h=[];d._h2h.push({from,to,weekNum:wn,ts:Date.now(),accepted:null});return{...d};}
function accH2H(d,i,accept){if(d._h2h?.[i])d._h2h[i].accepted=accept;return{...d};}

function calcP(entry,d,uid,data){
  const wn=gWN(d),cd=gCD(data,uid,wn),diw=dB(START,d)%7;
  const isC=cd!==null&&cd===diw;
  // For entries with data: R or N = rest (mx=3), otherwise mx=4
  // For null entries: use old schedule (isW) for backward compat
  const isRest=entry&&(entry.workout==="R"||entry.workout==="N");
  const scheduleMx=isW(d)?4:3;
  const mx=entry?(isRest?3:4):scheduleMx;
  if(!entry&&!isC)return{pts:0,mx:scheduleMx,isCheat:false};
  if(!entry&&isC)return{pts:1,mx:scheduleMx,isCheat:true};
  let pts=0;
  if(entry.workout&&entry.workout!=="R"&&entry.workout!=="N")pts+=1;
  if(isC){pts+=1;}else{if(entry.calTarget==="Y")pts+=.33;if(entry.ateClean==="Y")pts+=.33;if(entry.ateOnTime==="Y")pts+=.34;}
  if(entry.sleep>0)pts+=Math.min(entry.sleep/7,1);
  if(entry.steps>0)pts+=Math.min(entry.steps/10000,1);
  return{pts,mx,isCheat:isC};
}

function calcStrk(d,u){
  const today=new Date();today.setHours(0,0,0,0);let s=0;const dt=new Date(today);
  while(dt>=START){const e=gE(d,u,toK(dt));if(e&&(e.workout||e.calTarget||e.sleep||e.steps))s++;else break;dt.setDate(dt.getDate()-1);}
  return s;
}

function calcWk(data,uid,wi,upTo){
  const ws=new Date(START);ws.setDate(ws.getDate()+wi*7);
  const we=gWE(ws),ed=upTo?new Date(Math.min(we.getTime(),upTo.getTime())):we;
  let tp=0,tm=0,woDone=0;const target=4;
  for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d>ed||d>END||d<START)continue;const e=gE(data,uid,toK(d));const r=calcP(e,d,uid,data);tp+=r.pts;tm+=r.mx;if(e&&e.workout&&e.workout!=="R"&&e.workout!=="N"&&e.workout!=="")woDone++;}
  let cb=0;if(woDone>=target)cb=3;else if(woDone>=target-1)cb=2;else if(woDone>=target-2)cb=1;
  const member=WARRIORS.find(m=>m.id===uid);
  const allEx=[...(member?.gender==="F"?GEX:BEX),...gCE(data,uid)];
  const tgts=gT(data,uid),exD=gEx(data,uid,wi+1);
  let tMet=0,tTot=0;
  allEx.forEach(ex=>{const wt=tgts?.[ex]?.weekly,best=exD?.[ex];if(best!==undefined&&best!==""&&wt){tTot++;if(Number(best)>=Number(wt))tMet++;}});
  // Each target met = +0.05, max 5 contribute = 1.25x
  let mul=1;if(tMet>0)mul=1+Math.min(tMet,5)*0.05;
  // Flag deductions for this week
  let flagDed=0;
  for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d>ed||d>END||d<START)continue;
    const flags=gFl(data)[uid+"_"+toK(d)]||[];
    flags.forEach(f=>{if(f.resolved&&f.genuine)flagDed+=f.deduction;});
  }
  const con=tm>0?tp/tm:null,wkT=Math.max(0,(tp+cb-flagDed)*mul);
  return{totalPts:tp,totalMax:tm,workoutsDone:woDone,target,conBonus:cb,multiplier:mul,consistency:con,weekTotal:wkT,targetsMet:tMet,totalTargets:tTot,flagDed};
}

function getBests(data,uid){
  const member=WARRIORS.find(m=>m.id===uid);if(!member)return{};
  const allEx=[...(member.gender==="F"?GEX:BEX),...gCE(data,uid)];
  const bests={},tgts=gT(data,uid);
  allEx.forEach(ex=>{let best=null;for(let w=1;w<=52;w++){const v=gEx(data,uid,w)?.[ex];if(v!==undefined&&v!==""&&(best===null||Number(v)>best))best=Number(v);}
    bests[ex]={best,target:tgts?.[ex]?.weekly||null,hit:best!==null&&tgts?.[ex]?.weekly&&best>=Number(tgts[ex].weekly)};});
  return bests;
}

// Weekly MVP
function getMVP(data,wi){
  const today=new Date();today.setHours(0,0,0,0);
  let best=null,bestPct=-1;
  WARRIORS.forEach(m=>{const s=calcWk(data,m.id,wi,wi<gWI(today)?null:today);if(s.consistency!==null&&s.consistency>bestPct){bestPct=s.consistency;best=m;}});
  return best;
}

const CSS=`@keyframes scaleIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}`;

function RB({pct,size}){const r=gR(pct);if(!r)return(<span className="inline-block px-2 py-0.5 rounded text-xs" style={{background:"#333",color:"#666"}}>--</span>);const c=size==="sm"?"text-xs px-2 py-0.5":size==="lg"?"text-lg px-4 py-2 font-black":"text-sm px-3 py-1 font-bold";return(<span className={"inline-block rounded-lg "+c} style={{background:r.bg,color:r.fg}}>{r.e} {r.n}</span>);}
function Pop({show,onClose,children}){if(!show)return null;return(<div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,.7)",backdropFilter:"blur(4px)"}}><div className="bg-[#0D2137] rounded-2xl p-6 max-w-sm w-full border border-white/10" style={{animation:"scaleIn .3s ease"}}>{children}<button onClick={onClose} className="w-full mt-4 py-3 rounded-xl font-bold text-white" style={{background:"linear-gradient(135deg,#FF4B2B,#FF8C42)"}}>CLOSE</button></div></div>);}
function B({children,onClick,className,style}){return(<button onClick={onClick} className={"active:scale-95 transition-transform "+(className||"")} style={style||{}}>{children}</button>);}

function Login({onLogin}){
  const[sel,setSel]=useState(null);const[pin,setPin]=useState("");const[err,setErr]=useState("");
  const[changingPin,setChangingPin]=useState(false);const[newPin,setNewPin]=useState("");
  const[isFirstTime,setIsFirstTime]=useState(false);const[confirmPin,setConfirmPin]=useState("");
  
  function go(){
    const u=ALL.find(u=>u.id===sel);
    if(!u)return;
    // Check PINs: Supabase DB > localStorage > default
    const cachedData=ld();
    const dbPin=cachedData?._dbPins?.[u.id];
    const savedPins=JSON.parse(localStorage.getItem("tf_pins")||"{}");
    const userPin=dbPin||savedPins[u.id]||u.pin;
    // First time: no custom PIN set (still default)
    if(userPin===u.pin&&pin===u.pin){
      setIsFirstTime(true);return;
    }
    if(pin===userPin)onLogin(u);
    else{setErr("Wrong PIN");setPin("");}
  }
  
  function setupPin(){
    if(newPin.length!==4){setErr("PIN must be 4 digits");return;}
    if(newPin!==confirmPin){setErr("PINs don't match");setConfirmPin("");return;}
    const savedPins=JSON.parse(localStorage.getItem("tf_pins")||"{}");
    savedPins[sel]=newPin;
    localStorage.setItem("tf_pins",JSON.stringify(savedPins));
    // Update cached DB pins + sync to Supabase
    const cachedData=ld();
    if(cachedData._dbPins)cachedData._dbPins[sel]=newPin;
    sv(cachedData);
    syncPin(cachedData._userMapReverse,sel,newPin);
    setIsFirstTime(false);setNewPin("");setConfirmPin("");
    const u=ALL.find(u=>u.id===sel);
    if(u)onLogin(u);
  }
  
  function changePin(){
    if(newPin.length!==4){setErr("PIN must be 4 digits");return;}
    const savedPins=JSON.parse(localStorage.getItem("tf_pins")||"{}");
    savedPins[sel]=newPin;
    localStorage.setItem("tf_pins",JSON.stringify(savedPins));
    // Update cached DB pins too so login works immediately
    const cachedData=ld();
    if(cachedData._dbPins)cachedData._dbPins[sel]=newPin;
    sv(cachedData);
    syncPin(cachedData._userMapReverse,sel,newPin);
    setChangingPin(false);setNewPin("");setConfirmPin("");setErr("PIN changed! ✓");
  }
  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{background:"linear-gradient(135deg,#0A1628,#0D2137 50%,#0a0a1a)"}}>
      <style>{CSS}</style>
      <div className="absolute top-0 left-0 w-full h-1.5" style={{background:"linear-gradient(90deg,#00D4FF,#FF4B2B,#FFD700)"}}/>
      <div className="text-6xl mb-4" style={{animation:"pulse 2s infinite"}}>💪</div>
      <h1 className="text-5xl font-black text-white mb-1 tracking-tight">TEAM FITNESS</h1>
      <p className="text-sm mb-8 font-bold tracking-widest" style={{color:"#00D4FF"}}>ACCOUNTABILITY CHALLENGE</p>
      <div className="w-full max-w-md bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
        <p className="text-cyan-400 text-xs font-bold mb-3 tracking-wider">⚔️ WARRIORS</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {WARRIORS.map(m=>(<B key={m.id} onClick={()=>{setSel(m.id);setErr("");setPin("");setChangingPin(false);}} className={"p-3 rounded-xl text-sm font-bold transition-all "+(sel===m.id?"ring-2 ring-cyan-400 scale-105 bg-cyan-500/15 text-cyan-400":"bg-white/5 text-white/40 hover:bg-white/10")}>
            <span className="text-2xl block mb-1">{m.gender==="F"?"👩":"💪"}</span>
            {m.alias}{m.role==="admin"&&<span className="ml-1">⚙️</span>}
          </B>))}
        </div>
        <p className="text-orange-400 text-xs font-bold mb-3 tracking-wider">🛡️ MODERATORS</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {MODS.map(m=>(<B key={m.id} onClick={()=>{setSel(m.id);setErr("");setPin("");setChangingPin(false);}} className={"p-3 rounded-xl text-sm font-bold transition-all "+(sel===m.id?"ring-2 ring-orange-400 scale-105 bg-orange-500/15 text-orange-400":"bg-white/5 text-white/40 hover:bg-white/10")}>
            <span className="text-2xl block mb-1">🛡️</span>{m.alias}
          </B>))}
        </div>
        {sel&&(<div className="space-y-3">
          {!changingPin?(<>
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Enter PIN" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/g,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} className="w-full p-4 rounded-xl bg-white/10 text-white text-center text-2xl tracking-[0.5em] border border-white/20 focus:border-cyan-400 focus:outline-none"/>
            {err&&<p className={err==="PIN changed!"?"text-emerald-400 text-sm text-center":"text-red-400 text-sm text-center"}>{err}</p>}
            <B onClick={go} className="w-full p-4 rounded-xl font-black text-white text-lg tracking-wider" style={{background:"linear-gradient(135deg,#FF4B2B,#FF8C42)"}}>LET'S GO 🔥</B>
            <B onClick={()=>setChangingPin(true)} className="w-full p-2 text-white/20 text-xs hover:text-white/40">Change PIN</B>
          </>):(<>
            <p className="text-white/50 text-xs text-center">Enter new 4-digit PIN</p>
            <input type="password" inputMode="numeric" maxLength={4} placeholder="New PIN" value={newPin} onChange={e=>setNewPin(e.target.value.replace(/\D/g,""))} className="w-full p-4 rounded-xl bg-white/10 text-white text-center text-2xl tracking-[0.5em] border border-white/20 focus:border-cyan-400 focus:outline-none"/>
            <div className="flex gap-2">
              <B onClick={changePin} className="flex-1 p-3 rounded-xl font-bold text-white bg-emerald-500/20 text-emerald-400">Save</B>
              <B onClick={()=>setChangingPin(false)} className="flex-1 p-3 rounded-xl font-bold bg-white/5 text-white/40">Cancel</B>
            </div>
          </>)}
        </div>)}
        <p className="text-white/15 text-xs text-center mt-4">First time? Use default PIN (1111-8888) to set your own</p>
      </div>
    </div>
  );
}

function Board({data,user}){
  const today=new Date();today.setHours(0,0,0,0);const wi=gWI(today),wn=wi+1,ws=gWS(today);
  const[exp,setExp]=useState(null);
  const mvp=getMVP(data,wi);
  const stats=WARRIORS.map(m=>{const s=calcWk(data,m.id,wi,today);return{...m,...s,streak:calcStrk(data,m.id),weight:gWt(data,m.id,wn),bests:getBests(data,m.id)};}).sort((a,b)=>b.weekTotal-a.weekTotal);
  const dk=toK(today);

  return(
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h2 className="text-lg font-black text-white mb-0.5">LEADERBOARD</h2>
      <p className="text-xs mb-2" style={{color:"#FF4B2B"}}>Week {wn} | {fm(ws)} - {fm(gWE(ws))}</p>
      {mvp&&(<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 mb-3 text-center"><span className="text-yellow-400 text-xs font-bold">🏆 WEEKLY MVP: {mvp.alias}</span></div>)}
      <div className="space-y-2">{stats.map((m,i)=>{const isE=exp===m.id;const flags=gFl(data)[m.id+"_"+dk]||[];const coms=gCom(data,m.id,dk);
        return(<B key={m.id} onClick={()=>setExp(isE?null:m.id)} className={"w-full text-left rounded-xl border transition-all "+(isE?"border-cyan-500/30 bg-cyan-500/5":"border-white/10 bg-white/5")}>
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black" style={{color:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":"#444"}}>#{i+1}</span>
                <div>
                  <p className="text-white font-bold text-sm">{m.alias}{m.id===mvp?.id&&" 🏆"}</p>
                  <div className="flex gap-2 text-xs text-white/30"><span>🔥{m.streak}d</span>{m.weight&&<span>⚖️{m.weight}kg</span>}<span>{m.workoutsDone}/{m.target}wo</span></div>
                </div>
              </div>
              <div className="text-right"><RB pct={m.consistency} size="sm"/><p className="text-cyan-400 font-bold text-sm mt-1">{m.weekTotal.toFixed(1)}pts</p></div>
            </div>
            {isE&&(<div className="mt-3 pt-3 border-t border-white/10" style={{animation:"fadeSlide .2s ease"}}>
              <div className="grid grid-cols-5 gap-1.5 text-center mb-2">
                {[["Daily",m.totalPts.toFixed(1),""],["Bonus","+"+m.conBonus,""],["Flags",m.flagDed>0?"-"+m.flagDed.toFixed(1):"0","#E74C3C"],["Multi",m.multiplier.toFixed(2)+"x",m.multiplier>1?"#00D4FF":"#666"],["Total",m.weekTotal.toFixed(1),"#00D4FF"]].map(([l,v,c],j)=>(
                  <div key={j} className={"rounded-lg p-1.5 "+(j===4?"bg-cyan-500/10":"bg-white/5")}><p className="text-white/30 text-[10px]">{l}</p><p className="font-bold text-xs" style={{color:c||"#fff"}}>{v}</p></div>
                ))}
              </div>
              <div className="mb-2"><p className="text-white/20 text-[10px] mb-1">Strength:</p><div className="flex flex-wrap gap-1">{Object.entries(m.bests).map(([ex,b])=>(<span key={ex} className={"text-[10px] px-1 py-0.5 rounded "+(b.hit?"bg-emerald-500/20 text-emerald-400":b.best!==null?"bg-white/5 text-white/30":"bg-white/5 text-white/10")}>{ex.replace(/\(.*\)/,"").trim()}:{b.best!==null?b.best:"--"}</span>))}</div></div>
              {flags.length>0&&flags.map((f,fi)=>(<div key={fi} className="bg-red-500/10 rounded p-1 mb-1"><p className="text-red-400 text-[10px]">⚠️{f.severity} -{f.deduction}pt | {f.msg}{f.resolved?(f.genuine?" [UPHELD]":" [DISMISSED]"):""}</p></div>))}
              {coms.length>0&&coms.map((c,ci)=>(<p key={ci} className="text-white/30 text-[10px]"><span className="text-cyan-400">{ALL.find(u=>u.id===c.authorId)?.alias}:</span> {c.msg}</p>))}
              <p className="text-white/20 text-[10px] mt-1">{m.consistency!==null?(m.consistency*100).toFixed(1)+"%":"--"} | Tgt:{m.targetsMet}/{m.totalTargets} {m.targetsMet<5&&m.totalTargets>0?"(need 5 for multi)":""}</p>
            </div>)}
          </div>
        </B>);})}</div>
    </div>
  );
}

function LogTab({user,data,setData,setTab}){
  const today=new Date();today.setHours(0,0,0,0);const[vd,setVd]=useState(today);const[popup,setPopup]=useState(null);const[flagPop,setFlagPop]=useState(null);const[showCal,setShowCal]=useState(false);
  const dk=toK(vd),wn=gWN(vd),wi=wn-1;
  const entry=gE(data,user.id,dk)||{workout:"",calTarget:"",ateClean:"",ateOnTime:"",sleep:"",steps:"",water:"",protein:"",carbs:"",fats:"",calories:"",photo:null,comment:""};
  const diw=dB(START,vd)%7,cd=gCD(data,user.id,wn),isC=cd!==null&&cd===diw;
  const hasD=entry.workout||entry.calTarget||entry.sleep||entry.steps;
  const isCheatDay=cd!==null&&cd===diw;
  const{pts,mx}=calcP((hasD||isCheatDay)?entry:null,vd,user.id,data);
  const streak=calcStrk(data,user.id),mem=WARRIORS.find(w=>w.id===user.id);
  const pct=mx>0?pts/mx:0,isT=toK(vd)===toK(today),wkS=calcWk(data,user.id,wi,today);
  const myFlags=(gFl(data)[user.id+"_"+dk]||[]);
  const unresolvedFlags=myFlags.filter(f=>!f.resolved&&!f.response);

  function up(f,v){setData(sE(data,user.id,dk,{...entry,[f]:v}));}
  function nav(d){const nd=new Date(vd);nd.setDate(nd.getDate()+d);if(nd>=START&&nd<=END)setVd(nd);}

  // Show flag popup if there are unresolved flags
  useEffect(()=>{if(unresolvedFlags.length>0&&!flagPop)setFlagPop(true);},[dk]);

  return(
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <B onClick={()=>nav(-1)} className="p-2 rounded-lg bg-white/5 text-white/60 text-xl">←</B>
        <B onClick={()=>setShowCal(!showCal)} className="text-center">
          <p className="text-white font-bold">{DF[vd.getDay()]}</p>
          <p className="text-white/40 text-xs">{fm(vd)} | Week {wn} 📅</p>
          {isT&&<span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">TODAY</span>}
        </B>
        <B onClick={()=>nav(1)} className="p-2 rounded-lg bg-white/5 text-white/60 text-xl">→</B>
      </div>
      {showCal&&<CalView data={data} uid={user.id} onSelect={d=>setVd(d)} onClose={()=>setShowCal(false)}/>}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 text-center py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400">{wkS.workoutsDone}/4 workouts this week</div>
        <div className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50">🔥{streak}d</div>
      </div>
      {cd===null?(<B onClick={()=>setData(sCD(data,user.id,wn,diw))} className="w-full mb-3 p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold">🍕 Use Cheat Day - 1/week</B>):isC?(<B onClick={()=>setData(sCD(data,user.id,wn,null))} className="w-full mb-3 p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold text-center">🍕 CHEAT DAY - Nutrition auto 1pt (tap to undo)</B>):(<div className="w-full mb-3 p-2 rounded-xl bg-white/5 text-white/20 text-xs text-center">Cheat used this week</div>)}
      <div className="flex justify-center mb-4"><div className="w-24 h-24 rounded-full flex flex-col items-center justify-center border-4" style={{borderColor:pct>=.95?"#00D4FF":pct>=.7?"#27AE60":pct>0?"#F39C12":"#333",background:"rgba(255,255,255,.03)"}}><span className="text-2xl font-black text-white">{pts.toFixed(1)}</span><span className="text-xs text-white/30">/{mx}pts</span></div></div>
      <B onClick={()=>setTab("strength")} className="w-full mb-3 p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"><span className="text-white/40 text-xs">💪 Multiplier {wkS.targetsMet+"/5 = "+wkS.multiplier.toFixed(2)+"x"}</span><span className="text-sm font-bold" style={{color:wkS.multiplier>1?"#00D4FF":"#555"}}>{wkS.multiplier.toFixed(2)}x →</span></B>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">WORKOUT <span className="text-white/20">({wkS.workoutsDone}/4 this week)</span></label><div className="grid grid-cols-5 gap-1.5">{[["G","Gym"],["C","Cardio"],["H","Home"],["S","Sports"],["R","Rest"]].map(([v,l])=>(<B key={v} onClick={()=>{up("workout",tog(entry.workout,v));if(typeof navigator!=="undefined"&&navigator.vibrate)navigator.vibrate(30);}} className={"py-2 rounded-lg text-xs font-bold "+(entry.workout===v?(v==="R"?"bg-orange-500/30 text-orange-400 ring-1 ring-orange-400":"bg-cyan-500/30 text-cyan-400 ring-1 ring-cyan-400"):"bg-white/5 text-white/30")}>{l}</B>))}</div>{wkS.workoutsDone>=4&&entry.workout!==""&&entry.workout!=="R"&&<p className="text-yellow-400 text-xs mt-1">✓ 4/4 workouts done this week!</p>}</div>

      {isC?(<div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20 mb-2"><p className="text-yellow-400 text-xs font-bold">🍕 Nutrition auto 1pt (cheat day)</p></div>):(<div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">NUTRITION (3 criteria = 1pt)</label>
        {[{f:"calTarget",l:mem?.calGoal==="surplus"?"Cal Surplus":"Cal Deficit",p:".33"},{f:"ateClean",l:"Ate Clean",p:".33"},{f:"ateOnTime",l:"On Time",p:".34"}].map(c=>(<div key={c.f} className="flex items-center justify-between mb-1.5"><span className="text-white/60 text-xs">{c.l} <span className="text-white/20">({c.p})</span></span><div className="flex gap-1">{["Y","N"].map(v=>(<B key={v} onClick={()=>{up(c.f,tog(entry[c.f],v));if(typeof navigator!=="undefined"&&navigator.vibrate)navigator.vibrate(20);}} className={"px-3 py-1 rounded text-xs font-bold "+(entry[c.f]===v?(v==="Y"?"bg-emerald-500/30 text-emerald-400":"bg-red-500/30 text-red-400"):"bg-white/5 text-white/20")}>{v}</B>))}</div></div>))}</div>)}

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">SLEEP (hrs)</label><input type="number" step=".5" min="0" max="14" placeholder="7.5" value={entry.sleep} onChange={e=>up("sleep",e.target.value===""?"":parseFloat(e.target.value)||0)} className="w-full p-2.5 rounded-lg bg-white/10 text-white text-center border border-white/20 focus:border-cyan-400 focus:outline-none"/>{entry.sleep>0&&<p className="text-xs mt-1" style={{color:entry.sleep>=7?"#00D4FF":"#F39C12"}}>+{Math.min(entry.sleep/7,1).toFixed(2)}pt</p>}</div>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">STEPS</label><input type="number" step="100" min="0" placeholder="8500" value={entry.steps} onChange={e=>up("steps",e.target.value===""?"":parseInt(e.target.value)||0)} className="w-full p-2.5 rounded-lg bg-white/10 text-white text-center border border-white/20 focus:border-cyan-400 focus:outline-none"/>{entry.steps>0&&<p className="text-xs mt-1" style={{color:entry.steps>=10000?"#00D4FF":"#F39C12"}}>+{Math.min(entry.steps/10000,1).toFixed(2)}pt</p>}</div>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">💧 WATER (litres) <span className="text-white/20">tracked, not scored</span></label><input type="number" min="0" max="10" step=".1" placeholder="2.0" value={entry.water} onChange={e=>up("water",e.target.value===""?"":parseFloat(e.target.value)||0)} className="w-full p-2.5 rounded-lg bg-white/10 text-white text-center border border-white/20 focus:border-cyan-400 focus:outline-none"/>
        {entry.water!==""&&entry.water<1.5&&<p className="text-xs mt-1 text-red-400">⚠️ Under 1.5L! Muscles need water. Drink up!</p>}
        {entry.water!==""&&entry.water>=1.5&&entry.water<2.5&&<p className="text-xs mt-1 text-yellow-400">Decent. Push for 2.5L+</p>}
        {entry.water!==""&&entry.water>=2.5&&<p className="text-xs mt-1 text-emerald-400">💧 Hydration royalty!</p>}
      </div>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">MACROS (optional)</label><div className="grid grid-cols-4 gap-2">{[["protein","Prot"],["carbs","Carbs"],["fats","Fats"],["calories","Cal"]].map(([f,l])=>(<div key={f}><p className="text-white/20 text-[10px] text-center mb-1">{l}</p><input type="number" min="0" placeholder="0" value={entry[f]} onChange={e=>up(f,e.target.value===""?"":parseInt(e.target.value)||0)} className="w-full p-1.5 rounded bg-white/10 text-white text-center text-xs border border-white/15 focus:border-cyan-400 focus:outline-none"/></div>))}</div></div>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">📸 PHOTO</label>{entry.photo?(<div className="text-center"><p className="text-emerald-400 text-xs">Saved ✓</p><B onClick={()=>up("photo",null)} className="text-red-400 text-xs">Remove</B></div>):(<input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>up("photo",ev.target.result);r.readAsDataURL(f);}}} className="w-full text-xs text-white/40 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-white/10 file:text-white/60"/>)}</div>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><label className="text-white/40 text-xs mb-1.5 block">💬 NOTES</label><textarea rows={2} placeholder="How was today?" value={entry.comment} onChange={e=>up("comment",e.target.value)} className="w-full p-2 rounded-lg bg-white/10 text-white text-sm border border-white/20 focus:border-cyan-400 focus:outline-none resize-none"/></div>

      {myFlags.length>0&&(<div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 mb-2" style={{animation:"shake .3s ease"}}><p className="text-red-400 text-xs font-bold mb-1">⚠️ FLAGGED ({myFlags.length})</p>{myFlags.map((f,i)=>(<div key={i} className="mb-2 bg-white/5 rounded-lg p-2"><div className="flex justify-between items-center mb-1"><span className="text-red-400 text-xs font-bold">{f.severity?.toUpperCase()} | -{f.deduction}pt</span>{f.resolved&&<span className={"text-xs px-1.5 py-0.5 rounded "+(f.genuine?"bg-red-500/20 text-red-400":"bg-emerald-500/20 text-emerald-400")}>{f.genuine?"Upheld":"Dismissed"}</span>}</div><p className="text-white/60 text-xs">{ALL.find(u=>u.id===f.modId)?.alias}: {f.msg}</p>{f.response&&<p className="text-cyan-400 text-xs mt-0.5">You: {f.response}</p>}{!f.response&&!f.resolved&&(<div className="flex gap-1 mt-1"><input placeholder="Justify..." className="flex-1 p-1.5 rounded bg-white/10 text-white text-xs border border-white/20 focus:outline-none" id={"fr"+i}/><B onClick={()=>{const el=document.getElementById("fr"+i);if(el?.value)setData(rFl(data,user.id,dk,i,el.value));}} className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-bold">Reply</B></div>)}</div>))}</div>)}

      <B onClick={()=>setPopup({pts,mx,pct,msg:gMsg(pct,isC),isCheat:isC})} className="w-full p-3 rounded-xl font-bold text-white text-lg mt-2 hover:scale-105 transition-transform" style={{background:"linear-gradient(135deg,#00D4FF,#0099CC)"}}>LOG DAY ✓</B>

      <Pop show={!!popup} onClose={()=>setPopup(null)}>{popup&&(<div className="text-center"><div className="text-5xl mb-3">{popup.isCheat?"🍕":popup.pct>=.95?"🔥":popup.pct>=.75?"💪":popup.pct>=.5?"👊":"😬"}</div><p className="text-white font-black text-xl mb-1">{popup.pts.toFixed(1)}/{popup.mx}pts</p><div className="mb-2"><RB pct={popup.pct} size="md"/></div><p className="text-white/60 text-sm italic">{popup.msg}</p></div>)}</Pop>

      {/* Flag notification popup */}
      <Pop show={flagPop&&unresolvedFlags.length>0} onClose={()=>setFlagPop(false)}>
        <div className="text-center" style={{animation:"shake .5s ease"}}>
          <div className="text-5xl mb-3">🚨</div>
          <p className="text-red-400 font-black text-xl mb-2">YOU'VE BEEN FLAGGED!</p>
          {unresolvedFlags.map((f,i)=>(<div key={i} className="bg-red-500/10 rounded-lg p-2 mb-2 text-left"><p className="text-red-400 text-xs font-bold">{f.severity?.toUpperCase()} | -{f.deduction}pt</p><p className="text-white/60 text-xs">{ALL.find(u=>u.id===f.modId)?.alias}: {f.msg}</p></div>))}
          <p className="text-white/40 text-xs">Respond in the Log to defend yourself!</p>
        </div>
      </Pop>
    </div>
  );
}

function StrTab({user,data,setData}){
  const today=new Date();today.setHours(0,0,0,0);const wn=gWN(today),wi=wn-1;
  const exercises=[...(user.gender==="F"?GEX:BEX),...gCE(data,user.id)];
  const targets=gT(data,user.id),exData=gEx(data,user.id,wn),stats=calcWk(data,user.id,wi,today);
  const[showT,setShowT]=useState(false);const[newN,setNewN]=useState("");const[newU,setNewU]=useState("kg");
  const pending=gPE(data).filter(e=>e.uid===user.id);
  return(
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h2 className="text-lg font-black text-white mb-0.5">STRENGTH</h2>
      <p className="text-xs text-white/40 mb-3">Week {wn} | Min 5 targets for multiplier</p>
      <div className="rounded-xl p-4 mb-3 border" style={{background:stats.multiplier>1?"rgba(0,212,255,.1)":"rgba(255,255,255,.03)",borderColor:stats.multiplier>1?"rgba(0,212,255,.3)":"rgba(255,255,255,.1)"}}>
        <div className="flex items-center justify-between mb-2">
          <div><p className="text-white/30 text-xs">MULTIPLIER</p><p className="text-3xl font-black" style={{color:stats.multiplier>1?"#00D4FF":"#444"}}>{stats.multiplier.toFixed(2)}x</p></div>
          <div className="text-right"><p className="text-white/30 text-xs">{stats.targetsMet} of 5</p>
            <div className="flex gap-1 mt-1">{[0,1,2,3,4].map(i=>(<div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{background:i<stats.targetsMet?"#00D4FF":"rgba(255,255,255,.05)",color:i<stats.targetsMet?"#0A1628":"#333"}}>{i<stats.targetsMet?"✓":""}</div>))}</div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full" style={{width:Math.min(stats.targetsMet/5*100,100)+"%",background:"linear-gradient(90deg,#00D4FF,#FF4B2B)"}}/></div>
        <p className="text-white/20 text-[10px] mt-1">Each met = +0.05x | Max 5 = 1.25x</p>
      </div>
      <B onClick={()=>setShowT(!showT)} className="w-full mb-3 p-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs">{showT?"Hide":"Set/Edit"} Targets</B>
      {showT&&<div className="mb-3 space-y-2">{exercises.map(ex=>(<div key={ex} className="bg-white/5 rounded-xl p-3 border border-white/10"><p className="text-white text-sm font-bold mb-2">{ex}</p><div className="grid grid-cols-3 gap-2">{["starting","weekly","monthly"].map(f=>(<div key={f}><label className="text-white/20 text-xs block mb-1 capitalize">{f}</label><input type="number" step="any" placeholder="0" value={targets?.[ex]?.[f]??""} onChange={e=>{const t={...targets};if(!t[ex])t[ex]={};t[ex][f]=e.target.value===""?"":parseFloat(e.target.value)||0;setData(sT(data,user.id,t));}} className="w-full p-1.5 rounded bg-white/10 text-white text-center text-xs border border-white/15 focus:border-cyan-400 focus:outline-none"/></div>))}</div></div>))}</div>}
      <p className="text-white/40 text-xs mb-2">BEST THIS WEEK</p>
      <div className="space-y-2">{exercises.map(ex=>{const best=exData?.[ex]??"",wt=targets?.[ex]?.weekly,hit=best!==""&&wt&&Number(best)>=Number(wt);const unit=user.gender==="F"?"hrs":(ex.includes("Pull")||ex.includes("Push")?"reps":"kg");const proof=gSP(data,user.id,wn,ex),pStatus=gPS(data,user.id,wn,ex);
        return(<div key={ex} className={"rounded-xl p-3 border "+(hit?"border-emerald-500/30 bg-emerald-500/5":"border-white/10 bg-white/5")}>
          <div className="flex justify-between items-center mb-1.5"><span className="text-white text-sm font-bold">{ex}</span>{wt&&<span className="text-white/20 text-xs">Tgt:{wt}{unit}</span>}</div>
          <div className="flex items-center gap-2"><input type="number" step="any" placeholder={"Best "+unit} value={best} onChange={e=>{const ed={...exData,[ex]:e.target.value===""?"":parseFloat(e.target.value)||0};setData(sEx(data,user.id,wn,ed));}} className="flex-1 p-2 rounded-lg bg-white/10 text-white text-center text-sm border border-white/20 focus:border-cyan-400 focus:outline-none"/>{best!==""&&<span className={"text-xs font-bold px-2 py-1 rounded "+(hit?"bg-emerald-500/20 text-emerald-400":"bg-red-500/20 text-red-400")}>{hit?"HIT":"MISS"}</span>}</div>
          {hit&&<div className="mt-1.5">{proof?(<div className="flex items-center justify-between"><span className={"text-xs "+(pStatus==="approved"?"text-emerald-400":pStatus==="rejected"?"text-red-400":"text-yellow-400")}>📸 {pStatus}</span><B onClick={()=>setData(sSP(data,user.id,wn,ex,null))} className="text-red-400 text-xs">Remove</B></div>):(<label className="flex items-center gap-1 text-xs text-white/30 cursor-pointer"><span>📸 Upload proof</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>setData(sSP(data,user.id,wn,ex,ev.target.result));r.readAsDataURL(f);}}}/></label>)}</div>}
        </div>);})}</div>
      <div className="mt-4 bg-white/5 rounded-xl p-3 border border-white/10"><p className="text-white/40 text-xs mb-2">REQUEST NEW EXERCISE</p><div className="flex gap-2"><input placeholder="Name" value={newN} onChange={e=>setNewN(e.target.value)} className="flex-1 p-2 rounded-lg bg-white/10 text-white text-sm border border-white/20 focus:border-cyan-400 focus:outline-none"/><select value={newU} onChange={e=>setNewU(e.target.value)} className="p-2 rounded-lg bg-white/10 text-white text-xs border border-white/20"><option value="kg">kg</option><option value="reps">reps</option><option value="hrs">hrs</option></select><B onClick={()=>{if(newN.trim()){setData(aPE(data,user.id,newN.trim(),newU));setNewN("");}}} className="px-3 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold">Send</B></div>{pending.length>0&&<div className="mt-2">{pending.map((p,i)=>(<p key={i} className={"text-xs "+(p.status==="pending"?"text-yellow-400":p.status==="approved"?"text-emerald-400":"text-red-400")}>{p.name} - {p.status}</p>))}</div>}</div>
    </div>
  );
}

function HistTab({data}){
  const today=new Date();today.setHours(0,0,0,0);const cwi=gWI(today);const weeks=[];
  for(let wi=0;wi<=Math.min(cwi,51);wi++){const ws=new Date(START);ws.setDate(ws.getDate()+wi*7);const res=WARRIORS.map(m=>({...m,...calcWk(data,m.id,wi,wi<cwi?null:today)})).sort((a,b)=>b.weekTotal-a.weekTotal);weeks.push({wn:wi+1,start:ws,end:gWE(ws),results:res,live:wi===cwi});}
  return(<div className="p-4 pb-24 max-w-lg mx-auto"><h2 className="text-lg font-black text-white mb-0.5">HALL OF FAME</h2><p className="text-xs text-white/30 mb-4">Weekly champions</p><div className="space-y-2">{weeks.reverse().map(w=>{const win=w.results[0],run=w.results[1];return(<div key={w.wn} className={"rounded-xl p-3 border "+(w.live?"border-cyan-500/30 bg-cyan-500/5":"border-white/10 bg-white/5")}><div className="flex justify-between items-center mb-2"><span className="text-white font-bold text-sm">Week {w.wn} {w.live&&<span className="text-cyan-400 text-xs">LIVE</span>}</span><span className="text-white/20 text-xs">{fm(w.start)}</span></div><div className="flex gap-2"><div className="flex-1 bg-white/5 rounded-lg p-2 text-center"><p className="text-yellow-400 text-xs font-bold">👑 WINNER</p><p className="text-white text-sm font-bold">{win?.alias||"--"}</p><RB pct={win?.consistency} size="sm"/></div><div className="flex-1 bg-white/5 rounded-lg p-2 text-center"><p className="text-white/30 text-xs font-bold">🥈 RUNNER-UP</p><p className="text-white text-sm font-bold">{run?.alias||"--"}</p><RB pct={run?.consistency} size="sm"/></div></div></div>);})}</div></div>);
}



function StatsTab({user,data,setData}){
  const today=new Date();today.setHours(0,0,0,0);const cwn=gWN(today);const cwi=gWI(today);
  const[wi,setWi]=useState("");const[vu,setVu]=useState(user.id);
  const[compWi,setCompWi]=useState(cwi);
  const streak=calcStrk(data,vu),vm=WARRIORS.find(m=>m.id===vu);
  const mN=["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];const months=[];
  for(let mo=0;mo<12;mo++){const yr=mo<9?2026:2027,mn=(3+mo)%12+1;const fd=new Date(yr,mn-1,1),ld=new Date(yr,mn,0);let tp=0,tm=0;for(let d=new Date(fd);d<=ld&&d<=END&&d>=START;d.setDate(d.getDate()+1)){if(d>today)break;const r=calcP(gE(data,vu,toK(d)),d,vu,data);tp+=r.pts;tm+=r.mx;}months.push({name:mN[mo],pct:tm>0?tp/tm:null});}
  let tP=0,tM=0;for(let d=new Date(START);d<=today&&d<=END;d.setDate(d.getDate()+1)){const r=calcP(gE(data,vu,toK(d)),d,vu,data);tP+=r.pts;tM+=r.mx;}
  const oP=tM>0?tP/tM:null,bests=getBests(data,vu);
  const weights=[];for(let w=1;w<=Math.min(cwn,52);w++){const kg=gWt(data,vu,w);if(kg)weights.push({week:w,kg:Number(kg)});}
  const sW=weights[0]?.kg,cW=weights[weights.length-1]?.kg,ch=sW&&cW?cW-sW:null;
  // Achievements
  const achs=ACHIEVEMENTS.filter(a=>a.check(data,vu));
  return(
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <div className="flex gap-1 mb-3 overflow-x-auto">{WARRIORS.map(m=>(<B key={m.id} onClick={()=>setVu(m.id)} className={"px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap "+(vu===m.id?"bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-400":"bg-white/5 text-white/30")}>{m.alias}</B>))}</div>
      <h2 className="text-lg font-black text-white mb-3">{vm?.alias}</h2>

      {/* Weekly comparison table with nav */}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3 overflow-x-auto">
        <div className="flex items-center justify-between mb-2">
          <B onClick={()=>setCompWi(Math.max(0,compWi-1))} className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs" style={{opacity:compWi===0?0.3:1}}>← Prev</B>
          <p className="text-white/60 text-xs font-bold">📊 WEEK {compWi+1} {compWi===cwi&&<span className="text-cyan-400">(LIVE)</span>}</p>
          <B onClick={()=>setCompWi(Math.min(cwi,compWi+1))} className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs" style={{opacity:compWi===cwi?0.3:1}}>Next →</B>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/30 py-1 pr-2">Date</th>
              {WARRIORS.map(w=>(<th key={w.id} className="text-center text-white/40 py-1 px-1" style={{minWidth:"55px"}}>{w.alias.slice(0,6)}</th>))}
            </tr>
          </thead>
          <tbody>
            {(()=>{const ws=new Date(START);ws.setDate(ws.getDate()+compWi*7);const rows=[];
              for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d>today||d>END)continue;
                const dk=toK(d);const dayName=DF[d.getDay()].slice(0,3);
                rows.push(<tr key={dk} className="border-b border-white/5">
                  <td className="text-white/30 py-1.5 pr-2 whitespace-nowrap">{dayName} {d.getDate()}</td>
                  {WARRIORS.map(w=>{const e=gE(data,w.id,dk);const r=e?calcP(e,d,w.id,data):{pts:0,mx:4};
                    return(<td key={w.id} className="text-center py-1.5 px-1">
                      {e?(<div>
                        <span className="font-bold" style={{color:r.pts>=r.mx*.9?"#00D4FF":r.pts>=r.mx*.7?"#27AE60":r.pts>0?"#F39C12":"#E74C3C"}}>{r.pts.toFixed(1)}</span>
                        <div className="text-[9px] text-white/20">{e.sleep?e.sleep+"h":"-"} | {e.steps||"-"} | {e.water?e.water+"L":"-"}</div>
                      </div>):(<span className="text-white/10">-</span>)}
                    </td>);
                  })}
                </tr>);
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center mb-3"><p className="text-white/30 text-xs mb-2">OVERALL</p><RB pct={oP} size="lg"/><p className="text-white/30 text-sm mt-2">{oP!==null?(oP*100).toFixed(1)+"%":"No data"}</p><p className="text-white/20 text-xs">{tP.toFixed(1)}/{tM}pts | 🔥{streak}d</p></div>
      {achs.length>0&&<div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-2">🏅 ACHIEVEMENTS</p><div className="flex flex-wrap gap-1">{achs.map(a=>(<span key={a.id} className="text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400">{a.icon} {a.name}</span>))}</div></div>}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-2">STRENGTH BESTS</p><div className="space-y-1">{Object.entries(bests).map(([ex,b])=>(<div key={ex} className="flex justify-between items-center"><span className="text-white/50 text-xs">{ex}</span><div className="flex items-center gap-1"><span className="text-white font-bold text-xs">{b.best!==null?b.best:"--"}</span>{b.target&&<span className={"text-[10px] px-1 py-0.5 rounded "+(b.hit?"bg-emerald-500/20 text-emerald-400":"bg-red-500/20 text-red-400")}>{b.hit?"MET":"MISS"}</span>}</div></div>))}</div></div>
      <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-3">MONTHLY</p><div className="flex items-end gap-1" style={{height:"80px"}}>{months.map((m,i)=>(<div key={i} className="flex-1 flex flex-col items-center justify-end h-full"><div className="w-full rounded-t" style={{height:m.pct!==null?(m.pct*100)+"%":"0%",minHeight:m.pct>0?"3px":"0",background:m.pct>=.95?"#00BFFF":m.pct>=.85?"#6C3FC5":m.pct>=.7?"#FFD700":m.pct>=.5?"#A8A9AD":m.pct>0?"#CD7F32":"#222"}}/><p className="text-white/20 text-[10px] mt-1">{m.name}</p></div>))}</div></div>
      {vu===user.id&&<div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-2">WEIGHT</p>{sW&&<div className="grid grid-cols-3 gap-2 mb-2 text-center"><div className="bg-white/5 rounded-lg p-1.5"><p className="text-white/20 text-[10px]">Start</p><p className="text-white font-bold text-sm">{sW}</p></div><div className="bg-white/5 rounded-lg p-1.5"><p className="text-white/20 text-[10px]">Now</p><p className="text-white font-bold text-sm">{cW}</p></div><div className="bg-white/5 rounded-lg p-1.5"><p className="text-white/20 text-[10px]">Chg</p><p className="font-bold text-sm" style={{color:ch<0?"#27AE60":ch>0?"#E74C3C":"#888"}}>{ch>0?"+":""}{ch?.toFixed(1)||"--"}</p></div></div>}<div className="flex gap-2"><input type="number" step=".1" placeholder={"Wk "+cwn} value={wi} onChange={e=>setWi(e.target.value)} className="flex-1 p-2 rounded-lg bg-white/10 text-white text-center text-sm border border-white/20 focus:border-cyan-400 focus:outline-none"/><B onClick={()=>{if(wi){setData(sWt(data,user.id,cwn,parseFloat(wi)));setWi("");}}} className="px-4 rounded-lg font-bold text-sm text-white" style={{background:"linear-gradient(135deg,#00D4FF,#0099CC)"}}>Save</B></div></div>}
    </div>
  );
}

function ModView({user,data,setData}){
  const today=new Date();today.setHours(0,0,0,0);const localDate=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");const[selW,setSelW]=useState(null);const[selD,setSelD]=useState(localDate);const[modCompWi,setModCompWi]=useState(gWI(today));
  const[flagMsg,setFlagMsg]=useState("");const[comMsg,setComMsg]=useState("");const[flagSev,setFlagSev]=useState("medium");const[flagDed,setFlagDed]=useState(0.4);
  const[modTab,setModTab]=useState("overview");const[flagPop,setFlagPop]=useState(null);
  const pending=gPE(data),pendC=pending.filter(p=>p.status==="pending").length;
  let proofC=0;WARRIORS.forEach(w=>{const allEx=[...(w.gender==="F"?GEX:BEX),...gCE(data,w.id)];for(let wk=1;wk<=52;wk++){allEx.forEach(ex=>{if(gSP(data,w.id,wk,ex)&&gPS(data,w.id,wk,ex)==="pending")proofC++;});}});
  return(
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h2 className="text-lg font-black text-white mb-0.5">🛡️ MOD PANEL</h2><p className="text-xs text-orange-400 mb-3">{user.alias}</p>
      <div className="flex gap-1.5 mb-4">{[["overview","Overview"],["review","Review"],["proofs","Proofs"],["exercises","Exercises"]].map(([t,l])=>(<B key={t} onClick={()=>setModTab(t)} className={"flex-1 py-2 rounded-lg text-xs font-bold relative "+(modTab===t?"bg-orange-500/20 text-orange-400 ring-1 ring-orange-400":"bg-white/5 text-white/30")}>{l}{t==="exercises"&&pendC>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{pendC}</span>}{t==="proofs"&&proofC>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center">{proofC}</span>}</B>))}</div>

      {modTab==="overview"&&<div><Board data={data} user={user}/>{(pendC>0||proofC>0)&&<div className="mt-2 bg-orange-500/10 rounded-xl p-2 border border-orange-500/20"><p className="text-orange-400 text-xs font-bold">{pendC>0?pendC+" exercise request(s) ":""}{proofC>0?proofC+" proof(s) pending":""}</p></div>}
        {/* Weekly comparison table for mods */}
        <div className="mt-3 bg-white/5 rounded-xl p-3 border border-white/10 overflow-x-auto">
          <div className="flex items-center justify-between mb-2">
            <B onClick={()=>setModCompWi(Math.max(0,modCompWi-1))} className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs" style={{opacity:modCompWi===0?0.3:1}}>← Prev</B>
            <p className="text-orange-400 text-xs font-bold">📊 WEEK {modCompWi+1} {modCompWi===gWI(today)&&<span className="text-cyan-400">(LIVE)</span>}</p>
            <B onClick={()=>setModCompWi(Math.min(gWI(today),modCompWi+1))} className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs" style={{opacity:modCompWi===gWI(today)?0.3:1}}>Next →</B>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/30 py-1 pr-2">Date</th>
                {WARRIORS.map(w=>(<th key={w.id} className="text-center text-white/40 py-1 px-1" style={{minWidth:"55px"}}>{w.alias.slice(0,6)}</th>))}
              </tr>
            </thead>
            <tbody>
              {(()=>{const ws=new Date(START);ws.setDate(ws.getDate()+modCompWi*7);const rows=[];
                for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(d.getDate()+i);if(d>today||d>END)continue;
                  const dk=toK(d);const dayName=DF[d.getDay()].slice(0,3);
                  rows.push(<tr key={dk} className="border-b border-white/5">
                    <td className="text-white/30 py-1.5 pr-2 whitespace-nowrap">{dayName} {d.getDate()}</td>
                    {WARRIORS.map(w=>{const e=gE(data,w.id,dk);const r=e?calcP(e,d,w.id,data):{pts:0,mx:4};
                      return(<td key={w.id} className="text-center py-1.5 px-1">
                        {e?(<div>
                          <span className="font-bold" style={{color:r.pts>=r.mx*.9?"#00D4FF":r.pts>=r.mx*.7?"#27AE60":r.pts>0?"#F39C12":"#E74C3C"}}>{r.pts.toFixed(1)}</span>
                          <div className="text-[9px] text-white/20">{e.sleep?e.sleep+"h":"-"} | {e.steps||"-"} | {e.water?e.water+"L":"-"}</div>
                        </div>):(<span className="text-white/10">-</span>)}
                      </td>);
                    })}
                  </tr>);
                }
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      </div>}

      {modTab==="review"&&<div>
        <div className="grid grid-cols-3 gap-2 mb-3">{WARRIORS.map(w=>(<B key={w.id} onClick={()=>setSelW(w.id)} className={"p-2 rounded-lg text-xs font-bold "+(selW===w.id?"bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-400":"bg-white/5 text-white/30")}>{w.alias}</B>))}</div>
        {selW&&<div>
          <input type="date" value={selD} onChange={e=>setSelD(e.target.value)} className="w-full mb-3 p-2 rounded-lg bg-white/10 text-white text-sm border border-white/20 focus:outline-none"/>
          {(()=>{const e=gE(data,selW,selD);if(!e)return(<p className="text-white/30 text-xs">No data</p>);const dateParts=selD.split("-"),dispDate=dateParts[2]+"/"+dateParts[1]+"/"+dateParts[0],d=new Date(selD+"T12:00:00"),r=calcP(e,d,selW,data),w=WARRIORS.find(x=>x.id===selW);
            return(<div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-3">
              <p className="text-white font-bold text-sm mb-2">{w?.alias} - {dispDate}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-white/50 mb-2"><p>Workout: <span className="text-white">{e.workout||"--"}</span></p><p>Cal: <span className="text-white">{e.calTarget||"--"}</span></p><p>Clean: <span className="text-white">{e.ateClean||"--"}</span></p><p>OnTime: <span className="text-white">{e.ateOnTime||"--"}</span></p><p>Sleep: <span className="text-white">{e.sleep||"--"}h</span></p><p>Steps: <span className="text-white">{e.steps||"--"}</span></p><p>Water: <span className="text-white">{e.water||"--"}L</span></p><p>Pts: <span className="text-cyan-400 font-bold">{r.pts.toFixed(1)}/{r.mx}</span></p></div>
              {e.photo&&<div className="mb-2"><p className="text-white/30 text-xs mb-1">📸 Proof:</p><img src={e.photo} alt="proof" className="w-full rounded-lg max-h-48 object-cover"/></div>}
              {e.comment&&<p className="text-white/40 text-xs italic mb-2">"{e.comment}"</p>}
              {/* Flag UI */}
              <div className="bg-red-500/5 rounded-lg p-2 mb-2 border border-red-500/10">
                <p className="text-red-400 text-xs font-bold mb-1.5">FLAG ENTRY</p>
                <div className="flex gap-1 mb-1.5">{[["low","Low","0.2","#F39C12"],["medium","Med","0.4","#E67E22"],["high","High","0.6","#E74C3C"],["critical","Crit","1.0","#C0392B"]].map(([s,l,d,c])=>(<B key={s} onClick={()=>{setFlagSev(s);setFlagDed(parseFloat(d));}} className={"flex-1 py-1.5 rounded text-xs font-bold "+(flagSev===s?"ring-1":"bg-white/5 text-white/30")} style={flagSev===s?{background:c+"30",color:c}:{}}>{l}<br/><span className="text-[9px] opacity-60">-{d}pt</span></B>))}</div>
                <input placeholder="Reason..." value={flagMsg} onChange={e=>setFlagMsg(e.target.value)} className="w-full mb-1.5 p-2 rounded-lg bg-white/10 text-white text-xs border border-white/20 focus:outline-none"/>
                <B onClick={()=>{if(flagMsg.trim()){if(typeof navigator!=="undefined"&&navigator.vibrate)navigator.vibrate([100,50,100]);setData(aFl(data,selW,selD,user.id,flagMsg.trim(),flagSev,flagDed));setFlagMsg("");setFlagPop({sev:flagSev,ded:flagDed,warrior:w?.alias});}}} className="w-full py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold">⚠️ Flag ({flagSev} | -{flagDed}pt)</B>
              </div>
              <div className="flex gap-2 mb-2"><input placeholder="Comment..." value={comMsg} onChange={e=>setComMsg(e.target.value)} className="flex-1 p-2 rounded-lg bg-white/10 text-white text-xs border border-white/20 focus:outline-none"/><B onClick={()=>{if(comMsg.trim()){setData(aCom(data,selW,selD,user.id,comMsg.trim()));setComMsg("");}}} className="px-3 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold">💬</B></div>
              {/* Existing flags with resolve */}
              {(gFl(data)[selW+"_"+selD]||[]).map((f,i)=>(<div key={i} className="mt-1.5 rounded p-2" style={{background:f.severity==="critical"?"rgba(192,57,43,.15)":f.severity==="high"?"rgba(231,76,60,.1)":"rgba(230,126,34,.1)"}}><div className="flex justify-between items-center"><p className="text-red-400 text-xs font-bold">{f.severity?.toUpperCase()} -{f.deduction}pt</p>{f.resolved&&<span className={"text-xs px-1.5 py-0.5 rounded "+(f.genuine?"bg-red-500/20 text-red-400":"bg-emerald-500/20 text-emerald-400")}>{f.genuine?"Confirmed":"Dismissed"}</span>}</div><p className="text-white/60 text-xs">{f.msg}</p>{f.response&&<p className="text-cyan-400 text-xs">Warrior: {f.response}</p>}{f.response&&!f.resolved&&<div className="flex gap-1 mt-1"><B onClick={()=>setData(resFl(data,selW,selD,i,true))} className="flex-1 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold">Genuine</B><B onClick={()=>setData(resFl(data,selW,selD,i,false))} className="flex-1 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">Dismiss</B></div>}</div>))}
            </div>);})()}
        </div>}
        <Pop show={!!flagPop} onClose={()=>setFlagPop(null)}><div className="text-center"><div className="text-5xl mb-3">🚨</div><p className="text-red-400 font-black text-xl mb-2">FLAG SENT!</p><p className="text-white/60 text-sm">{flagPop?.warrior} has been flagged ({flagPop?.sev} | -{flagPop?.ded}pt)</p><p className="text-white/30 text-xs mt-2">They must respond to defend themselves.</p></div></Pop>
      </div>}

      {modTab==="proofs"&&<div><p className="text-white/40 text-xs mb-2">Strength proofs awaiting review</p>{proofC===0&&<p className="text-white/20 text-xs">None pending</p>}
        {WARRIORS.map(w=>{const allEx=[...(w.gender==="F"?GEX:BEX),...gCE(data,w.id)];return allEx.map(ex=>{for(let wk=1;wk<=52;wk++){const proof=gSP(data,w.id,wk,ex);if(proof&&gPS(data,w.id,wk,ex)==="pending")return(<div key={w.id+wk+ex} className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2"><div className="flex justify-between items-center mb-2"><div><p className="text-white text-sm font-bold">{w.alias}</p><p className="text-white/30 text-xs">Wk{wk} | {ex}</p></div><div className="flex gap-1"><B onClick={()=>setData(sPS(data,w.id,wk,ex,"approved"))} className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</B><B onClick={()=>setData(sPS(data,w.id,wk,ex,"rejected"))} className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold">✗</B></div></div><img src={proof} alt="proof" className="w-full rounded-lg max-h-48 object-cover"/></div>);}return null;});})}
      </div>}

      {modTab==="exercises"&&<div><p className="text-white/40 text-xs mb-2">Pending</p>{pendC===0&&<p className="text-white/20 text-xs">None</p>}{pending.map((p,i)=>p.status==="pending"&&(<div key={i} className="bg-white/5 rounded-xl p-3 border border-white/10 mb-2 flex items-center justify-between"><div><p className="text-white text-sm font-bold">{p.name} ({p.unit})</p><p className="text-white/30 text-xs">{WARRIORS.find(w=>w.id===p.uid)?.alias}</p></div><div className="flex gap-2"><B onClick={()=>setData(appPE(data,i,true))} className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓</B><B onClick={()=>setData(appPE(data,i,false))} className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold">✗</B></div></div>))}</div>}
    </div>
  );
}

function AdminPanel({user,data,setData}){
  function exportAll(){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="tf_FULL_backup_"+toK(new Date())+".json";a.click();URL.revokeObjectURL(url);}
  function exportCSV(){let csv="Member,Date,Workout,CalTarget,AteClean,AteOnTime,Sleep,Steps,Water,Protein,Carbs,Fats,Calories,Comment\n";WARRIORS.forEach(m=>{Object.entries(data?.[m.id]?.daily||{}).forEach(([dk,e])=>{csv+=`${m.alias},${dk},${e.workout||""},${e.calTarget||""},${e.ateClean||""},${e.ateOnTime||""},${e.sleep||""},${e.steps||""},${e.water||""},${e.protein||""},${e.carbs||""},${e.fats||""},${e.calories||""},"${(e.comment||"").replace(/"/g,"'")}"\n`;});});const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="tf_logs_"+toK(new Date())+".csv";a.click();URL.revokeObjectURL(url);}
  return(
    <div className="p-4 pb-24 max-w-lg mx-auto">
      <h2 className="text-lg font-black text-white mb-0.5">⚙️ ADMIN</h2><p className="text-xs text-white/30 mb-4">{user.alias}</p>
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-2">DATA EXPORT</p><p className="text-white/20 text-[10px] mb-2">JSON = full backup (all data, flags, proofs, comments). CSV = daily logs only.</p><div className="flex gap-2"><B onClick={exportAll} className="flex-1 p-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold">Export JSON</B><B onClick={exportCSV} className="flex-1 p-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">Export CSV</B></div></div>
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-2">MEMBERS & PINs</p>{WARRIORS.map(m=>{const savedPins=JSON.parse(localStorage.getItem("tf_pins")||"{}");const currentPin=savedPins[m.id]||m.pin;return(<p key={m.id} className="text-white text-xs mb-1">{m.alias} <span className="text-white/30">({m.gender}) PIN: {currentPin} {m.role==="admin"?"⚙️":""}</span></p>);})}<p className="text-white/40 text-xs mt-2 mb-1">Mods:</p>{MODS.map(m=>{const savedPins=JSON.parse(localStorage.getItem("tf_pins")||"{}");const currentPin=savedPins[m.id]||m.pin;return(<p key={m.id} className="text-white text-xs mb-1">{m.alias} <span className="text-white/30">({m.gender}) PIN: {currentPin}</span></p>);})}</div>
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-3"><p className="text-white/40 text-xs mb-2">STORAGE</p><p className="text-white text-xs">{(JSON.stringify(data).length/1024).toFixed(1)} KB</p><B onClick={()=>{if(confirm("Clear ALL data?"))setData({});}} className="mt-2 px-3 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold">Reset All</B></div>
    </div>
  );
}


function CalView({data,uid,onSelect,onClose}){
  const today=new Date();today.setHours(0,0,0,0);
  const[mo,setMo]=useState(today.getMonth());const[yr,setYr]=useState(today.getFullYear());
  const firstDay=new Date(yr,mo,1);const lastDay=new Date(yr,mo+1,0);
  const startDow=firstDay.getDay();const daysInMonth=lastDay.getDate();
  const mNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const cells=[];
  for(let i=0;i<startDow;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);

  function prevMo(){if(mo===0){setMo(11);setYr(yr-1);}else setMo(mo-1);}
  function nextMo(){if(mo===11){setMo(0);setYr(yr+1);}else setMo(mo+1);}

  return(
    <div className="bg-[#0D2137] rounded-2xl p-4 border border-white/10 mb-3" style={{animation:"scaleIn .3s ease"}}>
      <div className="flex justify-between items-center mb-3">
        <B onClick={prevMo} className="text-white/40 text-lg px-2">←</B>
        <p className="text-white font-bold text-sm">{mNames[mo]} {yr}</p>
        <B onClick={nextMo} className="text-white/40 text-lg px-2">→</B>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {["S","M","T","W","T","F","S"].map((d,i)=>(<p key={i} className="text-white/20 text-[10px] font-bold">{d}</p>))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day,i)=>{
          if(!day)return(<div key={i}/>);
          const dt=new Date(yr,mo,day);dt.setHours(0,0,0,0);
          const dk=toK(dt);
          const entry=gE(data,uid,dk);
          const inRange=dt>=START&&dt<=END;
          const isToday=dk===toK(today);
          let bg="#1a1a2e";let ring="";
          if(inRange&&entry){
            const r=calcP(entry,dt,uid,data);
            const pct=r.mx>0?r.pts/r.mx:0;
            bg=pct>=.95?"#00BFFF30":pct>=.7?"#27AE6030":pct>.3?"#F39C1230":"#E74C3C30";
          }
          if(isToday)ring="ring-1 ring-cyan-400";
          return(<B key={i} onClick={()=>{onSelect(dt);onClose();}} className={"w-full aspect-square rounded-lg flex flex-col items-center justify-center text-xs "+ring} style={{background:inRange?bg:"transparent"}}>
            <span className={inRange?"text-white":"text-white/10"}>{day}</span>
            {inRange&&entry&&(()=>{const r=calcP(entry,dt,uid,data);return(<span className="text-[8px] text-white/40">{r.pts.toFixed(1)}</span>);})()}
          </B>);
        })}
      </div>
      <div className="mt-2 flex justify-between">
        <div className="flex gap-2 text-[9px]">
          <span className="text-white/30">■ <span style={{color:"#00BFFF"}}>95%+</span></span>
          <span className="text-white/30">■ <span style={{color:"#27AE60"}}>70%+</span></span>
          <span className="text-white/30">■ <span style={{color:"#F39C12"}}>30%+</span></span>
          <span className="text-white/30">■ <span style={{color:"#E74C3C"}}>low</span></span>
        </div>
        <B onClick={onClose} className="text-white/30 text-xs">Close</B>
      </div>
    </div>
  );
}

const TABS=[{id:"board",l:"Board",i:"🏆"},{id:"log",l:"Log",i:"+"},{id:"strength",l:"Str",i:"💪"},{id:"history",l:"Fame",i:"📜"},{id:"stats",l:"Stats",i:"📊"}];

export default function App(){
  const[user,setUser]=useState(null);const[data,setDS]=useState(ld());const[tab,setTab]=useState("board");
  const[loading,setLoading]=useState(true);
  const refreshRef=useRef(null);
  const setData=useCallback(nd=>{setDS(nd);sv(nd);},[]);

  // Load data from Supabase on mount - Supabase is source of truth
  useEffect(()=>{
    async function init(){
      try{
        const sbData=await loadFromSupabase();
        if(Object.keys(sbData).length>2){
          // Supabase has data - use it as source of truth
          setDS(sbData);sv(sbData);
        }
      }catch(e){console.error(e);}
      setLoading(false);
    }
    init();
    const s=localStorage.getItem("tf4_user");if(s){const m=ALL.find(u=>u.id===s);if(m)setUser(m);}
  },[]);

  // Refresh from Supabase every 60 seconds - ONLY when user is not actively editing
  useEffect(()=>{
    if(!user)return;
    refreshRef.current=setInterval(async()=>{
      try{
        // Skip refresh if user is on Log tab (actively editing) or has focused input
        if(tab==="log")return;
        const activeEl=document.activeElement;
        if(activeEl&&(activeEl.tagName==="INPUT"||activeEl.tagName==="TEXTAREA"))return;
        const sbData=await loadFromSupabase();
        if(Object.keys(sbData).length>2){setDS(sbData);sv(sbData);}
      }catch(e){}
    },60000);
    return()=>clearInterval(refreshRef.current);
  },[user,tab]);
  if(loading)return(<div className="min-h-screen flex items-center justify-center" style={{background:"linear-gradient(135deg,#0A1628,#0D2137)"}}><div className="text-center"><div className="text-5xl mb-4" style={{animation:"pulse 1.5s infinite"}}>💪</div><p className="text-white/60 text-sm">Loading Team Fitness...</p></div></div>);
  if(!user)return(<Login onLogin={m=>{setUser(m);localStorage.setItem("tf4_user",m.id);}}/>);
  const isMod=user.role==="moderator",isAdm=user.role==="admin";
  const tabs=isAdm?[...TABS,{id:"admin",l:"Admin",i:"⚙️"}]:TABS;
  return(
    <div className="min-h-screen" style={{background:"linear-gradient(180deg,#0A1628,#0D1B2A)"}}>
      <style>{CSS}</style>
      <div className="sticky top-0 z-50 px-4 py-2.5 flex justify-between items-center" style={{background:"rgba(10,22,40,.95)",backdropFilter:"blur(10px)",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        <div className="flex items-center gap-2"><span className="text-white font-bold text-sm">{isMod?"🛡️ ":""}{user.alias}{isAdm?" ⚙️":""}</span><span className={"text-xs px-1.5 py-0.5 rounded "+(isMod?"bg-orange-500/20 text-orange-400":"bg-cyan-500/20 text-cyan-400")}>{isMod?"MOD":"WARRIOR"}</span></div>
        <B onClick={()=>{setUser(null);localStorage.removeItem("tf4_user");setTab("board");}} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20">Logout</B>
      </div>
      <div key={tab} style={{animation:"fadeSlide .25s ease"}}>
        {isMod?<ModView user={user} data={data} setData={setData}/>
         :tab==="board"?<Board data={data} user={user}/>
         :tab==="log"?<LogTab user={user} data={data} setData={setData} setTab={setTab}/>
         :tab==="strength"?<StrTab user={user} data={data} setData={setData}/>
         :tab==="history"?<HistTab data={data}/>
                  :tab==="admin"&&isAdm?<AdminPanel user={user} data={data} setData={setData}/>
         :<StatsTab user={user} data={data} setData={setData}/>}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50 flex" style={{background:"rgba(10,22,40,.98)",borderTop:"1px solid rgba(255,255,255,.08)",paddingBottom:"max(env(safe-area-inset-bottom), 8px)",paddingTop:"4px"}}>
        {isMod?(<B onClick={()=>setTab("board")} className="flex-1 py-4 flex flex-col items-center gap-1" style={{color:"#F39C12"}}><span className="text-2xl">🛡️</span><span className="text-xs font-bold">Mod Panel</span></B>)
         :tabs.map(t=>(<B key={t.id} onClick={()=>{setTab(t.id);if(typeof navigator!=="undefined"&&navigator.vibrate)navigator.vibrate(15);}} className="flex-1 py-3 flex flex-col items-center gap-1" style={{color:tab===t.id?(t.id==="admin"?"#E74C3C":"#00D4FF"):"rgba(255,255,255,.25)"}}><span className="text-2xl">{t.i}</span><span className="text-xs font-bold">{t.l}</span></B>))}
      </div>
    </div>
  );
}
