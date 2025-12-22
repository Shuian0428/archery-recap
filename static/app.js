window.App = (() => {

  const COLORS = {
    main: "rgba(245,158,11,0.95)",     // 橘（主線）
    avg:  "rgba(56,189,248,0.35)",     // 淡藍（場均線）
    avg2: "rgba(232,238,247,0.28)",    // 淡白（備用）
  };

  function fmtNum(x, digits=2){
    if(x === null || x === undefined || Number.isNaN(x)) return "-";
    if(typeof x !== "number") return String(x);
    const p = Math.pow(10, digits);
    return String(Math.round(x * p) / p);
  }
  function fmtPct(x){
    if(x === null || x === undefined || Number.isNaN(x)) return "-";
    return (x * 100).toFixed(1) + "%";
  }

  function arrowPoints(v){
    if(v === null || v === undefined) return 0;
    const s = String(v).trim().toUpperCase();
    if(s === "X") return 10;
    if(s === "M" || s === "") return 0;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function arrowBucket(v){
    if(v === null || v === undefined) return "M";
    const s = String(v).trim().toUpperCase();
    if(s === "X") return "X";
    if(s === "M" || s === "") return "M";
    const n = parseInt(s, 10);
    if(!Number.isFinite(n)) return "OTHER";
    if(n === 10) return "10";
    if(n === 9) return "9";
    if(n === 8 || n === 7) return "RED";
    if(n === 6 || n === 5) return "BLUE";
    return "OTHER";
  }

  function flattenRound(round6x6){
    if(!Array.isArray(round6x6)) return [];
    const out = [];
    for(const item of round6x6){
      if(Array.isArray(item)) out.push(...item);
      else out.push(item);
    }
    return out;
  }

  function getRoundKey(i){ return `第${i}局箭值`; }

  function arrMinMax(arr){
    const v = arr.filter(x => typeof x === "number" && Number.isFinite(x));
    if(!v.length) return {min: null, max: null};
    return {min: Math.min(...v), max: Math.max(...v)};
  }

  function padAxis(min, max, pad){
    if(min === null || max === null) return {};
    return { suggestedMin: min - pad, suggestedMax: max + pad };
  }

  function computeStats(payload){
    const ar = payload.archer;
    const dayMap = payload.day_map;

    // rounds 1..12
    const rounds = [];
    for(let i=1;i<=12;i++){
      rounds.push(flattenRound(ar[getRoundKey(i)]));
    }

    const allArrows = rounds.flat();
    const totalArrows = allArrows.length;
    const totalScore = allArrows.reduce((s,a)=> s + arrowPoints(a), 0);

    const counts = {X:0,"10":0,"9":0,RED:0,BLUE:0,M:0,OTHER:0};
    for(const a of allArrows){
      const b = arrowBucket(a);
      counts[b] = (counts[b] || 0) + 1;
    }

    // per round scores
    const roundScores = rounds.map(r => r.length ? r.reduce((s,a)=> s+arrowPoints(a), 0) : null);

    // per double scores
    const doubleScores = [];
    for(let j=0;j<6;j++){
      const a = roundScores[j*2], b = roundScores[j*2+1];
      doubleScores.push((a===null||b===null) ? null : (a+b));
    }

    // ends: 72 ends
    const endScores = [];
    const endLabels = [];
    for(let r=1;r<=12;r++){
      const arr = rounds[r-1];
      if(!arr.length) continue;
      for(let e=1;e<=6;e++){
        const seg = arr.slice((e-1)*6, e*6);
        if(seg.length<6) continue;
        endScores.push(seg.reduce((s,a)=> s+arrowPoints(a), 0));
        endLabels.push(`第${r}局第${e}趟`);
      }
    }

    // best round(s)
    let bestRoundScore = null, bestRounds=[];
    roundScores.forEach((sc, idx)=>{
      if(sc===null) return;
      const r = idx+1;
      if(bestRoundScore===null || sc>bestRoundScore){
        bestRoundScore=sc; bestRounds=[r];
      }else if(sc===bestRoundScore){
        bestRounds.push(r);
      }
    });

    // best end(s)
    let bestEndScore = null, bestEnds=[];
    endScores.forEach((sc, idx)=>{
      if(bestEndScore===null || sc>bestEndScore){
        bestEndScore=sc; bestEnds=[endLabels[idx]];
      }else if(sc===bestEndScore){
        bestEnds.push(endLabels[idx]);
      }
    });

    const avgArrow = totalArrows ? totalScore/totalArrows : null;
    const tenRate = totalArrows ? (counts.X + counts["10"]) / totalArrows : null;
    const ninePlusRate = totalArrows ? (counts.X + counts["10"] + counts["9"]) / totalArrows : null;
    const xInTen = (counts.X + counts["10"]) ? counts.X/(counts.X+counts["10"]) : null;

    // daily stats (each day 144 arrows)
    function dayStats(roundIdxs){ // [1..12]
      const arrows = [];
      for(const r of roundIdxs){
        arrows.push(...rounds[r-1]);
      }
      const score = arrows.reduce((s,a)=> s+arrowPoints(a), 0);
      const total = arrows.length;
      const c = {X:0,"10":0,"9":0,RED:0,BLUE:0,M:0,OTHER:0};
      for(const a of arrows){
        const b = arrowBucket(a);
        c[b] = (c[b]||0)+1;
      }
      return {
        arrows: total,
        score,
        avg_arrow: total ? score/total : null,
        ten_rate: total ? (c.X + c["10"]) / total : null,
        nine_plus_rate: total ? (c.X + c["10"] + c["9"]) / total : null
      };
    }

    const day1 = dayStats(dayMap.Day1);
    const day2 = dayStats(dayMap.Day2);
    const day3 = dayStats(dayMap.Day3);

    // ranks already in data
    const roundRanks = Array.isArray(ar["各局序位"]) ? ar["各局序位"].map(x => (x===null||x===undefined)? null : Number(x)) : [];
    const doubleRanks = Array.isArray(ar["雙局序位"]) ? ar["雙局序位"].map(x => (x===null||x===undefined)? null : Number(x)) : [];

    const maxRoundRank = Math.max(...roundRanks.filter(x=>Number.isFinite(x)), 1);
    const maxDoubleRank = Math.max(...doubleRanks.filter(x=>Number.isFinite(x)), 1);

    return {
      totalArrows, totalScore, counts,
      roundScores, doubleScores, endScores, endLabels,
      bestRounds, bestRoundScore, bestEnds, bestEndScore,
      avgArrow, tenRate, ninePlusRate, xInTen,
      day1, day2, day3,
      roundRanks, doubleRanks,
      maxRoundRank, maxDoubleRank
    };
  }

  function kpiCell(title, value, cls){
    const c = document.createElement("div");
    c.className = "k";
    c.innerHTML = `<div class="t">${title}</div><div class="v ${cls||""}">${value ?? "-"}</div>`;
    return c;
  }

  function dayItem(title, value){
    const c = document.createElement("div");
    c.className = "dayItem";
    c.innerHTML = `<div class="t">${title}</div><div class="v">${value ?? "-"}</div>`;
    return c;
  }

  function makeLineChart(canvas, labels, dsMain, dsAvg, yOpt={}){
    return new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: dsMain.label,
            data: dsMain.data,
            tension: 0.25,
            borderColor: COLORS.main,
            backgroundColor: COLORS.main,
            pointRadius: 2,
            borderWidth: 2
          },
          ...(dsAvg ? [{
            label: dsAvg.label,
            data: dsAvg.data,
            tension: 0.25,
            borderColor: COLORS.avg,
            backgroundColor: COLORS.avg,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [6,4]
          }] : [])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: {
          x: { ticks: { maxTicksLimit: 12 } },
          y: yOpt
        }
      }
    });
  }

  async function initIndex(){
    const res = await fetch("/api/athletes");
    const payload = await res.json();
    const data = payload.athletes || [];

    const grid = document.getElementById("grid");
    const q = document.getElementById("q");

    function card(a){
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="card-h" style="margin-bottom:8px">${a.name}</div>
        <div class="text" style="margin-bottom:6px">${a.unit || ""}</div>
        <div class="text">組別：<span style="color:rgba(245,158,11,.95)">${a.group}</span></div>
        <div class="text">總名次：<span style="color:rgba(56,189,248,.95);font-weight:800">${a.final_rank ?? "-"}</span></div>
        <div style="margin-top:10px">
          <a class="link" href="/athlete/${encodeURIComponent(a.id)}">查看比賽回顧 →</a>
        </div>
      `;
      return div;
    }

    function render(list){
      grid.innerHTML = "";
      for(const a of list) grid.appendChild(card(a));
    }

    render(data);

    q.addEventListener("input", ()=>{
      const s = q.value.trim().toLowerCase();
      if(!s){ render(data); return; }
      render(data.filter(x =>
        (x.name||"").toLowerCase().includes(s) ||
        (x.unit||"").toLowerCase().includes(s) ||
        (x.group||"").toLowerCase().includes(s)
      ));
    });
  }

  async function initAthlete(id){
    const res = await fetch(`/api/athlete/${encodeURIComponent(id)}`);
    const payload = await res.json();

    const stats = computeStats(payload);
    const avg = payload.group_avg || {};

    document.getElementById("sub").textContent =
      `${payload.name}｜${payload.unit || ""}｜${payload.group}｜總名次：${payload.final_rank ?? "-"}`;

    // KPI（更有層次：主值橘色、比率藍色、分布用一般）
    const kpi = document.getElementById("kpi");
    kpi.innerHTML = "";
    kpi.appendChild(kpiCell("總箭數", stats.totalArrows, "em"));
    kpi.appendChild(kpiCell("總分", stats.totalScore, "em"));
    kpi.appendChild(kpiCell("平均箭值", fmtNum(stats.avgArrow), "blue"));
    kpi.appendChild(kpiCell("10分命中率", fmtPct(stats.tenRate), "blue"));
    kpi.appendChild(kpiCell("9分以上命中率", fmtPct(stats.ninePlusRate), "blue"));
    kpi.appendChild(kpiCell("10中X比例", fmtPct(stats.xInTen), "blue"));

    kpi.appendChild(kpiCell("X", stats.counts.X));
    kpi.appendChild(kpiCell("10", stats.counts["10"]));
    kpi.appendChild(kpiCell("9", stats.counts["9"]));
    kpi.appendChild(kpiCell("紅圈(7&8)", stats.counts.RED));
    kpi.appendChild(kpiCell("藍圈(5&6)", stats.counts.BLUE));
    

    // Best text（字更大）
    const best = document.getElementById("best");
    best.innerHTML =
      `最佳單局：第 <span style="color:rgba(245,158,11,.95)">${stats.bestRounds.join("、")}</span> 局，` +
      `<span style="color:rgba(56,189,248,.95)">${stats.bestRoundScore ?? "-"}</span> 分<br/>` +
      `最佳單趟：<span style="color:rgba(245,158,11,.95)">${stats.bestEnds.join("、")}</span>，` +
      `<span style="color:rgba(56,189,248,.95)">${stats.bestEndScore ?? "-"}</span> 分`;

    // Dist bars（用橫條 + 佔比，資訊更集中）
    const distBars = document.getElementById("distBars");
    distBars.innerHTML = "";

    const total = stats.totalArrows || 0;
    const bars = [
      { key: "X", label: "X", val: stats.counts.X, color: "rgba(245,158,11,.95)" },
      { key: "10", label: "10", val: stats.counts["10"], color: "rgba(245,158,11,.75)" },
      { key: "9", label: "9", val: stats.counts["9"], color: "rgba(245,158,11,.55)" },
      { key: "RED", label: "紅圈(7&8)", val: stats.counts.RED, color: "rgba(239,68,68,.75)" },
      { key: "BLUE", label: "藍圈(5&6)", val: stats.counts.BLUE, color: "rgba(59,130,246,.75)" },
 
    ];

    for (const b of bars) {
      const pct = total ? (b.val / total) : 0;
      const row = document.createElement("div");
      row.className = "distRow";
      row.innerHTML = `
        <div class="distLabel">${b.label}</div>
        <div class="distTrack">
          <div class="distFill" style="width:${(pct*100).toFixed(2)}%; background:${b.color}"></div>
        </div>
        <div class="distVal">${b.val} <span class="distPct">(${(pct*100).toFixed(1)}%)</span></div>
      `;
      distBars.appendChild(row);
    }


    // Daily cards（避免混行）
    const d1 = document.getElementById("day1");
    const d2 = document.getElementById("day2");
    const d3 = document.getElementById("day3");
    d1.innerHTML = ""; d2.innerHTML=""; d3.innerHTML="";

    const dayCells = (dayStats, label) => ([
      ["總分", dayStats.score],
      ["平均箭值", fmtNum(dayStats.avg_arrow)],
      ["10分命中率", fmtPct(dayStats.ten_rate)],
      ["9+命中率", fmtPct(dayStats.nine_plus_rate)]
    ]);

    for(const [t,v] of dayCells(stats.day1)){
      d1.appendChild(dayItem(t, v));
    }
    for(const [t,v] of dayCells(stats.day2)){
      d2.appendChild(dayItem(t, v));
    }
    for(const [t,v] of dayCells(stats.day3)){
      d3.appendChild(dayItem(t, v));
    }

    // ===== Charts with group average + padding =====
    // 1) round score
    const rMM = arrMinMax(stats.roundScores);
    makeLineChart(
      document.getElementById("roundScore"),
      Array.from({length:12}, (_,i)=> `第${i+1}局`),
      { label: "個人成績", data: stats.roundScores },
      avg.roundScores ? { label: "同組場均", data: avg.roundScores } : null,
      { ...padAxis(rMM.min, rMM.max, 12) }
    );

    // 2) double score
    const dMM = arrMinMax(stats.doubleScores);
    makeLineChart(
      document.getElementById("doubleScore"),
      Array.from({length:6}, (_,i)=> `第${i+1}場(雙局)`),
      { label: "個人成績", data: stats.doubleScores },
      avg.doubleScores ? { label: "同組場均", data: avg.doubleScores } : null,
      { ...padAxis(dMM.min, dMM.max, 18) }
    );

    // 3) end score (72)
    const eMM = arrMinMax(stats.endScores);
    makeLineChart(
      document.getElementById("endScore"),
      stats.endLabels.length ? stats.endLabels : Array.from({length:72}, (_,i)=> `第${i+1}趟`),
      { label: "個人成績", data: stats.endScores },
      avg.endScores ? { label: "同組場均", data: avg.endScores } : null,
      { ...padAxis(eMM.min, eMM.max, 4) , ticks:{ maxTicksLimit: 10 } }
    );

    // 4) day totals
    const dayTotals = [stats.day1.score, stats.day2.score, stats.day3.score];
    const dayMM = arrMinMax(dayTotals);
    makeLineChart(
      document.getElementById("dayChart"),
      ["Day1","Day2","Day3"],
      { label: "個人成績", data: dayTotals },
      avg.dayTotals ? { label: "同組場均", data: avg.dayTotals } : null,
      { ...padAxis(dayMM.min, dayMM.max, 30) }
    );

    // 5) round rank (reverse: 1 on top)
    new Chart(document.getElementById("roundRank"), {
      type: "line",
      data: {
        labels: Array.from({length: stats.roundRanks.length || 12}, (_,i)=> `第${i+1}局`),
        datasets: [
          {
            label: "個人成績",
            data: stats.roundRanks,
            tension:.25,
            borderColor: COLORS.main,
            borderWidth: 2,
            pointRadius: 2
          }
        ]

      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        scales:{
          y:{
            reverse:true,
            min: 1,
            suggestedMax: stats.maxRoundRank || 1,
            ticks:{ stepSize: 1 }
          }
        }
      }
    });

    // 6) double rank (NEW)
    new Chart(document.getElementById("doubleRank"), {
      type: "line",
      data: {
        labels: Array.from({length: stats.doubleRanks.length || 6}, (_,i)=> `第${i+1}場`),
        datasets: [
          {
            label: "個人成績",
            data: stats.doubleRanks,
            tension:.25,
            borderColor: COLORS.main,
            borderWidth: 2,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        scales:{
          y:{
            reverse:true,
            min: 1,
            suggestedMax: stats.maxDoubleRank || 1,
            ticks:{ stepSize: 1 }
          }
        }
      }
    });
  }

  return { initIndex, initAthlete };
})();
async function initIndexStatic(){
  const res = await fetch("./data/athletes_index.json");
  const payload = await res.json();
  const data = payload.athletes || [];

  const grid = document.getElementById("grid");
  const q = document.getElementById("q");

  function card(a){
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="card-h" style="margin-bottom:8px">${a.name}</div>
      <div class="text" style="margin-bottom:6px">${a.unit || ""}</div>
      <div class="text">組別：<span style="color:rgba(245,158,11,.95)">${a.group}</span></div>
      <div class="text">總名次：<span style="color:rgba(56,189,248,.95);font-weight:800">${a.final_rank ?? "-"}</span></div>
      <div style="margin-top:10px">
        <a class="link" href="./athlete.html?id=${encodeURIComponent(a.id)}">查看比賽回顧 →</a>
      </div>
    `;
    return div;
  }

  function render(list){
    grid.innerHTML = "";
    for(const a of list) grid.appendChild(card(a));
  }

  render(data);

  q.addEventListener("input", ()=>{
    const s = q.value.trim().toLowerCase();
    if(!s){ render(data); return; }
    render(data.filter(x =>
      (x.name||"").toLowerCase().includes(s) ||
      (x.unit||"").toLowerCase().includes(s) ||
      (x.group||"").toLowerCase().includes(s)
    ));
  });
}

async function initAthleteStatic(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if(!id){
    document.body.innerHTML = "缺少 id";
    return;
  }
  const res = await fetch(`./data/athletes/${encodeURIComponent(id)}.json`);
  const payload = await res.json();

  // 直接重用你現有 initAthlete 的渲染流程：把它抽成 helper 也行
  // 這裡最簡單：呼叫你現有 initAthlete 的內部邏輯，
  // 但你目前 initAthlete 會 fetch /api。為避免大改，
  // 你可以把原本 initAthlete 的「fetch 之後」內容抽成 renderAthlete(payload)。
  // 如果你不想重構，就把 initAthlete 裡 fetch 後面的內容貼到這裡。
  await window.App.__renderAthleteFromPayload(payload);
}

