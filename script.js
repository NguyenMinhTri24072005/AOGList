const KEY = "bxh_giai_dau_aog_v1";
const TEAM_LOGOS = {
  "SGP": "logo/55px-Saigon_Phantom_2020_allmode.png",
  "FPT": "logo/100px-FPT_Polytechnic.png",
  "FL": "logo/56px-Team_Flash_allmode.png",
  "BOOM": "logo/37px-Boom_Esports_allmode.png",
  "1S": "logo/53px-One_Star_Esports_no_text_allmode.png",
  "BOX": "logo/32px-Box_Gaming_2020_allmode.png",
  "GAM": "logo/54px-GAM_Esports_2021_allmode.png",
  "TS": "logo/100px-Team_Secret_darkmode.png",
  "RRQ": "logo/70px-Rex_Regum_Qeon_allmode.png"
};
const DEFAULT_TEAMS = [
  { id: "SGP", name: "Saigon Phantom", logo: TEAM_LOGOS["SGP"] },
  { id: "FPT", name: "FPT Polytechnic", logo: TEAM_LOGOS["FPT"] },
  { id: "FL", name: "Team Flash", logo: TEAM_LOGOS["FL"] },
  { id: "BOOM", name: "BOOM Esports VN", logo: TEAM_LOGOS["BOOM"] },
  { id: "1S", name: "One Star Esports", logo: TEAM_LOGOS["1S"] },
  { id: "BOX", name: "Box Gaming", logo: TEAM_LOGOS["BOX"] },
  { id: "GAM", name: "GAM Esports", logo: TEAM_LOGOS["GAM"] },
  { id: "TS", name: "Team Secret", logo: TEAM_LOGOS["TS"] },
  { id: "RRQ", name: "Rex Regum Qeon VN", logo: TEAM_LOGOS["RRQ"] }
];
const uid = () => Math.random().toString(36).slice(2, 10);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const DEFAULT_SPECIAL_WEEKS = [
  {
    week: 5,
    name: "Chuyển nhượng",
    title: "TUẦN 5: CHUYỂN NHƯỢNG GIỮA MÙA",
    desc: "Kỳ chuyển nhượng & bổ sung nhân sự giữa mùa giải Đấu Trường Danh Vọng Mùa Đông 2026. Không có trận đấu diễn ra trong tuần này.",
    dates: "21/09 – 27/09/2026"
  }
];

function fresh() {
  const sid = uid();
  return {
    teams: DEFAULT_TEAMS.map(t => ({ id: t.id, name: t.name, logo: t.logo, w: 0, l: 0, gw: 0, gl: 0 })),
    matches: [],
    specialWeeks: DEFAULT_SPECIAL_WEEKS.slice(),
    scenarios: [{ id: sid, name: "Kịch bản 1", picks: {} }],
    active: sid,
    settings: { top: 6, tiebreak: "diff_h2h", legsTotal: 2, legsDone: 1, defaultBo: 5 }
  };
}

function normalise(s) {
  s.teams = (s.teams || []).map(t => ({
    id: t.id || uid(),
    name: t.name,
    logo: t.logo || TEAM_LOGOS[t.id] || "",
    w: +t.w || 0,
    l: +t.l || 0,
    gw: +t.gw || 0,
    gl: +t.gl || 0
  }));

  s.matches = (s.matches || []).map(m => {
    const a = m.teamA || m.a;
    const b = m.teamB || m.b;
    let sa = m.scoreA !== undefined ? m.scoreA : m.sa;
    let sb = m.scoreB !== undefined ? m.scoreB : m.sb;
    sa = sa !== null && sa !== "" && Number.isInteger(+sa) ? +sa : null;
    sb = sb !== null && sb !== "" && Number.isInteger(+sb) ? +sb : null;

    return {
      id: m.id || uid(),
      leg: m.leg || 1,
      week: m.week || 1,
      a: a,
      b: b,
      teamA: a,
      teamB: b,
      sa: sa,
      sb: sb,
      scoreA: sa,
      scoreB: sb,
      bo: Number(m.bo) || 5,
      date: m.date || ""
    };
  });

  s.specialWeeks = Array.isArray(s.specialWeeks) && s.specialWeeks.length ? s.specialWeeks : DEFAULT_SPECIAL_WEEKS.slice();
  s.settings = Object.assign({ top: 6, tiebreak: "diff_h2h", legsTotal: 2, legsDone: 1, defaultBo: 5 }, s.settings || {});
  if (!Array.isArray(s.scenarios) || !s.scenarios.length) s.scenarios = [{ id: uid(), name: "Kịch bản 1", picks: {} }];
  if (!s.scenarios.some(x => x.id === s.active)) s.active = s.scenarios[0].id;
  return s;
}

function formatForStorage(st) {
  return {
    teams: st.teams.map(t => ({
      id: t.id,
      name: t.name,
      logo: t.logo || TEAM_LOGOS[t.id] || ""
    })),
    matches: st.matches.map(m => ({
      id: m.id,
      leg: m.leg || 1,
      week: m.week || 1,
      teamA: m.teamA || m.a,
      teamB: m.teamB || m.b,
      scoreA: m.sa !== undefined ? m.sa : (m.scoreA !== undefined ? m.scoreA : null),
      scoreB: m.sb !== undefined ? m.sb : (m.scoreB !== undefined ? m.scoreB : null),
      bo: m.bo || 5,
      date: m.date || ""
    })),
    specialWeeks: st.specialWeeks || DEFAULT_SPECIAL_WEEKS.slice(),
    scenarios: st.scenarios || [],
    active: st.active,
    settings: st.settings
  };
}

let state = fresh();
let editingId = null;
let lastJsonString = "";

// Đọc dữ liệu từ LocalStorage hoặc Server API / File data.json
async function loadData(forceServer = false) {
  // 1. Nếu không ép tải từ server, kiểm tra LocalStorage trước để giữ nguyên tỉ số và kịch bản người dùng đã nhập
  if (!forceServer) {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.teams) && parsed.matches && parsed.matches.length > 0) {
          state = normalise(parsed);
          lastJsonString = JSON.stringify(formatForStorage(state));
          return false;
        }
      }
    } catch (err) { }
  }

  let loadedData = null;

  // 2. Tải dữ liệu từ API server Node.js (/api/data)
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
        loadedData = parsed;
        lastJsonString = text;
      }
    }
  } catch (e) { }

  // 3. Dự phòng fetch trực tiếp tệp data.json tĩnh
  if (!loadedData) {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
          loadedData = parsed;
          lastJsonString = text;
        }
      }
    } catch (e) { }
  }

  // 4. Dự phòng từ data.js (nếu mở file:/// bị CORS chặn fetch)
  if (!loadedData && typeof window.INITIAL_DATA !== "undefined") {
    if (window.INITIAL_DATA && Array.isArray(window.INITIAL_DATA.teams) && window.INITIAL_DATA.matches) {
      loadedData = window.INITIAL_DATA;
      lastJsonString = JSON.stringify(loadedData);
    }
  }

  // 5. Nếu có dữ liệu từ file/server -> cập nhật state & localStorage
  if (loadedData) {
    // Giữ lại các kịch bản người dùng đã tạo trong LocalStorage nếu có
    try {
      const existing = localStorage.getItem(KEY);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed && Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
          loadedData.scenarios = parsed.scenarios;
          loadedData.active = parsed.active;
        }
      }
    } catch (err) { }

    state = normalise(loadedData);
    localStorage.setItem(KEY, JSON.stringify(formatForStorage(state)));
    return true;
  }

  // 6. Dự phòng đọc từ LocalStorage nếu fetch thất bại
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.teams) && parsed.matches && parsed.matches.length > 0) {
        state = normalise(parsed);
        return false;
      }
    }
  } catch (err) { }

  state = fresh();
  return false;
}

// Lưu kịch bản: CHỈ lưu vào LocalStorage của trình duyệt, không gửi và không ghi vào server / data.json
function saveScenario() {
  const exportPayload = formatForStorage(state);
  localStorage.setItem(KEY, JSON.stringify(exportPayload));
}

// Ghi dữ liệu giải đấu (kết quả thực tế, đội, trận đấu, cài đặt)
async function save() {
  const exportPayload = formatForStorage(state);
  localStorage.setItem(KEY, JSON.stringify(exportPayload));

  // Khi lưu vào file server data.json, chỉ lưu dữ liệu giải đấu chính thức, không lưu kịch bản thử nghiệm
  const serverPayload = {
    ...exportPayload,
    scenarios: [{ id: "default", name: "Kịch bản 1", picks: {} }],
    active: "default"
  };
  const jsonStr = JSON.stringify(serverPayload, null, 2);
  lastJsonString = jsonStr;

  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonStr
    });
  } catch (e) {
    console.warn("Chưa khởi chạy Server Node.js (server.js). Dữ liệu tạm thời lưu vào LocalStorage.");
  }
}

const teamName = id => (state.teams.find(t => t.id === id) || { name: id || "?" }).name;
const teamLogo = id => {
  const t = state.teams.find(x => x.id === id);
  return (t && t.logo) || TEAM_LOGOS[id] || "";
};
const needWins = bo => Math.ceil(bo / 2);
const isPlayed = m => Number.isInteger(m.sa) && Number.isInteger(m.sb);
const activeSc = () => state.scenarios.find(s => s.id === state.active);

function validScore(bo, sa, sb) {
  const need = needWins(bo);
  return Number.isInteger(sa) && Number.isInteger(sb) && Math.max(sa, sb) === need && Math.min(sa, sb) >= 0 && Math.min(sa, sb) <= need - 1;
}
function scoreOptions(bo) {
  const need = needWins(bo), out = [];
  for (let k = 0; k < need; k++) out.push(`${need}-${k}`);
  for (let k = need - 1; k >= 0; k--) out.push(`${k}-${need}`);
  return out;
}
function parseScore(str) {
  const m = /^\s*(\d+)\s*[-:]\s*(\d+)\s*$/.exec(String(str));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function getDayInfo(dateStr) {
  if (!dateStr) return { dayName: "Chưa xếp lịch", dateFmt: "—", timeFmt: "—", rawDate: "9999" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { dayName: "Chưa xếp lịch", dateFmt: "—", timeFmt: "—", rawDate: "9999" };
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[d.getDay()];
  const dateFmt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const timeFmt = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const rawDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { dayName, dateFmt, timeFmt, rawDate };
}

function inferWeekFromDate(dateIso) {
  if (!dateIso) return null;
  const targetTime = new Date(dateIso).getTime();
  if (isNaN(targetTime)) return null;

  let bestWeek = null, minDiff = Infinity;
  (state.matches || []).forEach(m => {
    if (m.date && m.week) {
      const mt = new Date(m.date).getTime();
      if (!isNaN(mt)) {
        const diff = Math.abs(targetTime - mt);
        if (diff < minDiff) {
          minDiff = diff;
          bestWeek = m.week;
        }
      }
    }
  });

  // Nếu khoảng cách trong vòng 4 ngày (khoảng cách cùng 1 tuần thi đấu), tự động chọn tuần đó
  if (minDiff <= 4 * 24 * 3600 * 1000) {
    return bestWeek;
  }
  return null;
}

/* ---------- Tính xếp hạng ---------- */
function compute(results) {
  const row = {};
  state.teams.forEach(t => row[t.id] = { id: t.id, name: t.name, w: t.w || 0, l: t.l || 0, gw: t.gw || 0, gl: t.gl || 0 });
  results.forEach(m => {
    const a = row[m.a], b = row[m.b];
    if (!a || !b) return;
    a.gw += m.sa; a.gl += m.sb; b.gw += m.sb; b.gl += m.sa;
    if (m.sa > m.sb) { a.w++; b.l++; } else { b.w++; a.l++; }
  });
  const list = Object.values(row);
  list.forEach(r => { r.p = r.w + r.l; r.diff = r.gw - r.gl; r.pts = r.w; });
  // Tính thành tích đối đầu giữa x và y
  const h2h = (x, y) => {
    let wx = 0, wy = 0;
    let gwx = 0, gwy = 0;
    results.forEach(m => {
      if (m.a === x.id && m.b === y.id) {
        if (m.sa > m.sb) wx++; else if (m.sb > m.sa) wy++;
        gwx += m.sa; gwy += m.sb;
      } else if (m.a === y.id && m.b === x.id) {
        if (m.sa > m.sb) wy++; else if (m.sb > m.sa) wx++;
        gwx += m.sb; gwy += m.sa;
      }
    });
    // 1. Số trận thắng đối đầu
    if (wx !== wy) return wx - wy;
    // 2. Hiệu số ván đối đầu
    return gwx - gwy;
  };

  list.sort((x, y) => {
    // 1. Điểm số (số trận thắng)
    if (y.pts !== x.pts) return y.pts - x.pts;

    const tb = state.settings.tiebreak || "diff_h2h";

    if (tb === "h2h") {
      // Đối đầu → Hiệu số ván → Ván thắng → Tên
      const h = h2h(x, y);
      if (h !== 0) return -h;
      if (y.diff !== x.diff) return y.diff - x.diff;
      if (y.gw !== x.gw) return y.gw - x.gw;
      return x.name.localeCompare(y.name);
    }

    if (tb === "diff") {
      // Hiệu số ván → Ván thắng → Đối đầu → Tên
      if (y.diff !== x.diff) return y.diff - x.diff;
      if (y.gw !== x.gw) return y.gw - x.gw;
      const h = h2h(x, y);
      if (h !== 0) return -h;
      return x.name.localeCompare(y.name);
    }

    // Chuẩn AOG ("diff_h2h"): Điểm → Hiệu số ván → Đối đầu → Ván thắng → Tên
    if (y.diff !== x.diff) return y.diff - x.diff;
    const h = h2h(x, y);
    if (h !== 0) return -h;
    if (y.gw !== x.gw) return y.gw - x.gw;
    return x.name.localeCompare(y.name);
  });
  return list;
}

const realResults = () => state.matches.filter(isPlayed).map(m => ({ a: m.a, b: m.b, sa: m.sa, sb: m.sb }));

function remaining() {
  return state.matches.map((m, i) => ({ m, i })).filter(x => !isPlayed(x.m))
    .sort((x, y) => (x.m.date || "9999").localeCompare(y.m.date || "9999") || x.i - y.i)
    .map((x, k) => ({ n: k + 1, m: x.m }));
}
function scenarioResults(sc) {
  const res = realResults();
  state.matches.filter(m => !isPlayed(m)).forEach(m => {
    const p = sc.picks[m.id] && parseScore(sc.picks[m.id]);
    if (p && validScore(m.bo, p[0], p[1])) res.push({ a: m.a, b: m.b, sa: p[0], sb: p[1] });
  });
  return res;
}
const pickOf = (sc, m) => { const p = sc.picks[m.id] && parseScore(sc.picks[m.id]); return p && validScore(m.bo, p[0], p[1]) ? p : null; };

/* ---------- Tab ---------- */
let tab = "real";
function setTab(t) {
  tab = t;
  $("tabReal").classList.toggle("on", t === "real");
  $("tabScn").classList.toggle("on", t === "scn");
  $("viewReal").classList.toggle("hide", t !== "real");
  $("viewScn").classList.toggle("hide", t !== "scn");
  renderAll();
}
$("tabReal").onclick = () => setTab("real");
$("tabScn").onclick = () => setTab("scn");

/* ---------- Render: thực tế ---------- */
function renderStandings() {
  const top = Number(state.settings.top) || 0;
  const tb = $("standings") ? $("standings").tBodies[0] : null;
  if (!tb) return;
  tb.innerHTML = "";

  const selWeek = $("standingsWeek") ? $("standingsWeek").value : "all";
  const selMode = $("standingsMode") ? $("standingsMode").value : "cumulative";
  const modeWrap = $("standingsModeWrap");
  if (modeWrap) {
    modeWrap.style.display = selWeek === "all" ? "none" : "flex";
  }

  // Lọc danh sách trận đấu dùng để tính bảng xếp hạng
  let filteredMatches = [];
  if (selWeek === "all") {
    filteredMatches = state.matches.filter(isPlayed);
  } else {
    const targetW = Number(selWeek);
    if (selMode === "single") {
      filteredMatches = state.matches.filter(m => isPlayed(m) && Number(m.week) === targetW);
    } else {
      filteredMatches = state.matches.filter(m => isPlayed(m) && Number(m.week) <= targetW);
    }
  }

  const results = filteredMatches.map(m => ({ a: m.a, b: m.b, sa: m.sa, sb: m.sb }));
  const curRankList = compute(results);

  // Tính biến động thứ hạng (Delta) so với tuần trước đó
  let prevRankMap = null;
  const playedWeeks = Array.from(new Set(state.matches.filter(isPlayed).map(m => Number(m.week)).filter(Boolean))).sort((a, b) => a - b);

  if (selMode === "cumulative" || selWeek === "all") {
    let compareWeek = null;
    if (selWeek === "all") {
      if (playedWeeks.length >= 2) {
        compareWeek = playedWeeks[playedWeeks.length - 2];
      }
    } else {
      const targetW = Number(selWeek);
      const idx = playedWeeks.indexOf(targetW);
      if (idx > 0) {
        compareWeek = playedWeeks[idx - 1];
      }
    }

    if (compareWeek !== null) {
      const prevMatches = state.matches.filter(m => isPlayed(m) && Number(m.week) <= compareWeek).map(m => ({ a: m.a, b: m.b, sa: m.sa, sb: m.sb }));
      const prevList = compute(prevMatches);
      prevRankMap = {};
      prevList.forEach((r, idx) => { prevRankMap[r.id] = idx + 1; });
    }
  }

  // Cập nhật tiêu đề phụ & thông báo tuần đang xem
  const subEl = $("standingsSubtitle");
  const noticeEl = $("standingsNotice");
  const noticeText = $("standingsNoticeText");

  if (selWeek === "all") {
    if (subEl) subEl.textContent = `Toàn bộ giải đấu (Hiện tại • ${results.length} trận đã đấu)`;
    if (noticeEl) {
      noticeEl.hidden = true;
      noticeEl.style.display = "none";
    }
  } else {
    const targetW = Number(selWeek);
    if (selMode === "single") {
      if (subEl) subEl.textContent = `Riêng Tuần ${targetW} • (${results.length} trận đã đấu)`;
      if (noticeText) noticeText.innerHTML = `Đang xem BXH riêng trong <b>Tuần ${targetW}</b> (tổng ${results.length} trận).`;
    } else {
      if (subEl) subEl.textContent = `Sau Tuần ${targetW} • Lũy kế (${results.length} trận đã đấu)`;
      if (noticeText) noticeText.innerHTML = `Đang xem BXH tính đến hết <b>Tuần ${targetW}</b> (tổng ${results.length} trận từ Tuần 1 đến Tuần ${targetW}).`;
    }
    if (noticeEl) {
      noticeEl.hidden = false;
      noticeEl.style.display = "flex";
    }
  }

  // Render các hàng trong bảng xếp hạng
  curRankList.forEach((r, i) => {
    const tr = document.createElement("tr");
    const rank = i + 1;
    const isTopCut = top && rank <= top;
    if (isTopCut) tr.classList.add("top");
    if (top && rank === top) tr.classList.add("cut");

    let rankClass = "rank-norm";
    if (rank === 1) rankClass = "rank-1";
    else if (rank === 2) rankClass = "rank-2";
    else if (rank === 3) rankClass = "rank-3";
    else if (rank <= 4) rankClass = "rank-4";
    else if (isTopCut) rankClass = "rank-top";

    let deltaHtml = `<span class="delta-badge delta-same">–</span>`;
    if (prevRankMap && prevRankMap[r.id] !== undefined) {
      const dl = prevRankMap[r.id] - rank;
      if (dl > 0) deltaHtml = `<span class="delta-badge delta-up">▲${dl}</span>`;
      else if (dl < 0) deltaHtml = `<span class="delta-badge delta-down">▼${-dl}</span>`;
    }

    const diffClass = r.diff > 0 ? "diff-pos" : r.diff < 0 ? "diff-neg" : "diff-zero";
    const diffSign = r.diff > 0 ? `+${r.diff}` : `${r.diff}`;
    const logo = teamLogo(r.id);
    const logoHtml = logo ? `<div class="team-logo-wrap-sm"><img class="team-logo-sm" src="${esc(logo)}" alt="${esc(r.id)}" onerror="this.style.display='none'"></div>` : `<div class="team-logo-wrap-sm"></div>`;

    tr.innerHTML = `
      <td class="col-rank"><span class="rank-badge ${rankClass}">${rank}</span></td>
      <td class="col-delta">${deltaHtml}</td>
      <td class="name col-team">
        <div class="team-cell">
          ${logoHtml}
          <div class="team-meta">
            <span class="team-name-text">${esc(r.name)}</span>
            <span class="team-code-pill">${esc(r.id)}</span>
          </div>
        </div>
      </td>
      <td class="col-stat">${r.p}</td>
      <td class="col-stat stat-win">${r.w}</td>
      <td class="col-stat stat-lose">${r.l}</td>
      <td class="col-stat">${r.gw}</td>
      <td class="col-stat">${r.gl}</td>
      <td class="col-stat"><span class="diff-pill ${diffClass}">${diffSign}</span></td>
      <td class="col-pts"><span class="pts-pill">${r.pts}</span></td>
    `;
    tb.appendChild(tr);
  });
}

function renderBase() {
  const tb = $("baseTable").tBodies[0]; tb.innerHTML = "";
  state.teams.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="name">${esc(t.name)}</td>` +
      ["w", "l", "gw", "gl"].map(f => `<td><input type="number" min="0" data-team="${t.id}" data-f="${f}" value="${t[f] || 0}"></td>`).join("") +
      `<td><button class="ghost sm" data-ren="${t.id}">✎</button> <button class="danger sm" data-del="${t.id}">×</button></td>`;
    tb.appendChild(tr);
  });
}

function renderWeekSelects() {
  const weeks = new Set();
  state.matches.forEach(m => { if (m.week) weeks.add(m.week); });
  (state.specialWeeks || []).forEach(sw => weeks.add(sw.week));
  for (let i = 1; i <= 8; i++) weeks.add(i);
  const sortedWeeks = Array.from(weeks).sort((a, b) => a - b);
  const curF = $("filterWeek") ? $("filterWeek").value : "all";
  const curScF = $("scFilterWeek") ? $("scFilterWeek").value : "all";
  const curMW = $("matchWeek") ? $("matchWeek").value : "1";
  const curStW = $("standingsWeek") ? $("standingsWeek").value : "all";

  let opts = '<option value="all">Tất cả tuần</option>';
  let formOpts = '';
  let standingsOpts = '<option value="all">Hiện tại (Toàn giải)</option>';

  sortedWeeks.forEach(w => {
    const sw = (state.specialWeeks || []).find(s => s.week === w);
    const label = sw ? `Tuần ${w} (${sw.name || "Chuyển nhượng"})` : `Tuần ${w}`;
    opts += `<option value="${w}">${label}</option>`;
    if (!sw) {
      formOpts += `<option value="${w}">Tuần ${w}</option>`;
      const weekMatches = state.matches.filter(m => Number(m.week) === w);
      if (weekMatches.length) {
        const playedCount = state.matches.filter(m => isPlayed(m) && Number(m.week) <= w).length;
        const countLabel = playedCount > 0 ? ` (${playedCount} trận)` : ` (Chưa đấu)`;
        standingsOpts += `<option value="${w}">Sau Tuần ${w}${countLabel}</option>`;
      }
    }
  });

  if ($("filterWeek")) {
    $("filterWeek").innerHTML = opts;
    if (weeks.has(+curF) || curF === "all") $("filterWeek").value = curF;
  }
  if ($("scFilterWeek")) {
    $("scFilterWeek").innerHTML = opts;
    if (weeks.has(+curScF) || curScF === "all") $("scFilterWeek").value = curScF;
  }
  if ($("matchWeek")) {
    $("matchWeek").innerHTML = formOpts;
    if (weeks.has(+curMW)) $("matchWeek").value = curMW;
  }
  if ($("standingsWeek")) {
    $("standingsWeek").innerHTML = standingsOpts;
    if (weeks.has(+curStW) || curStW === "all") $("standingsWeek").value = curStW;
  }
}

function renderTeamSelects() {
  const opts = state.teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const keep = { A: $("teamA").value, B: $("teamB").value, F: $("filterTeam").value, S: $("scTeam").value };
  $("teamA").innerHTML = opts; $("teamB").innerHTML = opts;
  $("filterTeam").innerHTML = `<option value="">Tất cả đội</option>` + opts;
  $("scTeam").innerHTML = `<option value="">Tất cả đội</option>` + opts;
  const has = id => state.teams.some(t => t.id === id);
  if (has(keep.A)) $("teamA").value = keep.A;
  if (has(keep.B)) $("teamB").value = keep.B; else if (state.teams.length > 1) $("teamB").selectedIndex = 1;
  if (has(keep.F)) $("filterTeam").value = keep.F;
  if (has(keep.S)) $("scTeam").value = keep.S;
}

function renderMatches() {
  const f = $("filter").value, ft = $("filterTeam").value, fw = $("filterWeek") ? $("filterWeek").value : "all";
  let list = state.matches.slice().sort((x, y) => (x.date || "9999").localeCompare(y.date || "9999"));
  if (f === "todo") list = list.filter(m => !isPlayed(m));
  if (f === "done") list = list.filter(isPlayed);
  if (ft) list = list.filter(m => m.a === ft || m.b === ft);
  if (fw !== "all") list = list.filter(m => String(m.week) === fw);

  const container = $("matchesSchedule");
  if (!container) return;
  container.innerHTML = "";

  // Nhóm theo Tuần -> Ngày
  const byWeek = {};
  list.forEach(m => {
    const w = m.week || 1;
    if (!byWeek[w]) byWeek[w] = {};
    const dInfo = getDayInfo(m.date);
    const dayKey = dInfo.rawDate;
    if (!byWeek[w][dayKey]) byWeek[w][dayKey] = { dayInfo: dInfo, matches: [] };
    byWeek[w][dayKey].matches.push(m);
  });

  // Đảm bảo tuần đặc biệt (Tuần 5) xuất hiện nếu không bị lọc theo đội tuyển
  const allWeeksSet = new Set(Object.keys(byWeek).map(Number));
  if (!ft && (fw === "all" || (state.specialWeeks || []).some(sw => String(sw.week) === fw))) {
    (state.specialWeeks || []).forEach(sw => {
      if (fw === "all" || String(sw.week) === fw) {
        allWeeksSet.add(sw.week);
        if (!byWeek[sw.week]) byWeek[sw.week] = {};
      }
    });
  }

  const sortedAllWeeks = Array.from(allWeeksSet).sort((a, b) => a - b);

  if (!sortedAllWeeks.length) {
    container.innerHTML = `<div class="mute" style="text-align:center;padding:24px">Chưa có trận đấu nào phù hợp bộ lọc.</div>`;
    return;
  }

  sortedAllWeeks.forEach(w => {
    const sw = (state.specialWeeks || []).find(s => s.week === Number(w));
    const dayKeys = byWeek[w] ? Object.keys(byWeek[w]).sort() : [];

    // Nếu là tuần chuyển nhượng giữa mùa (không có trận đấu)
    if (sw && dayKeys.length === 0) {
      const specialCard = document.createElement("div");
      specialCard.className = "week-card special-week-card";
      specialCard.innerHTML = `
        <div class="week-header special-week-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span>🔄 ${esc(sw.title || `TUẦN ${w}: CHUYỂN NHƯỢNG GIỮA MÙA`)}</span>
            <span class="tag warn" style="font-weight:600">Thị trường chuyển nhượng</span>
          </div>
          <span class="badge" style="background:#223048;color:#fbbf24;border-color:rgba(245,158,11,0.4)">${esc(sw.dates || "Giữa mùa")}</span>
        </div>
        <div class="transfer-banner">
          <div class="transfer-icon">🔁</div>
          <div class="transfer-content">
            <div class="transfer-title">Kỳ chuyển nhượng &amp; củng cố lực lượng</div>
            <div class="transfer-desc">${esc(sw.desc || "Các đội tuyển tiến hành bổ sung nhân sự, điều chỉnh chiến thuật chuẩn bị cho Lượt về. Tuần này không có trận đấu diễn ra.")}</div>
          </div>
        </div>
      `;
      container.appendChild(specialCard);
      return;
    }

    const weekCard = document.createElement("div");
    weekCard.className = "week-card";

    let weekPlayed = 0, weekTotal = 0;
    Object.values(byWeek[w]).forEach(group => {
      weekTotal += group.matches.length;
      weekPlayed += group.matches.filter(isPlayed).length;
    });

    weekCard.innerHTML = `
      <div class="week-header">
        <span>📅 TUẦN ${w}</span>
        <span class="badge">${weekPlayed}/${weekTotal} trận đã đấu</span>
      </div>
    `;

    dayKeys.forEach(dKey => {
      const dayGroup = byWeek[w][dKey];
      const dayCard = document.createElement("div");
      dayCard.className = "day-card";
      dayCard.innerHTML = `
        <div class="day-header">
          <span>🗓️ ${dayGroup.dayInfo.dayName}, ${dayGroup.dayInfo.dateFmt}</span>
        </div>
      `;

      const matchList = document.createElement("div");
      matchList.className = "match-list";

      dayGroup.matches.forEach(m => {
        const played = isPlayed(m);
        const aw = played && m.sa > m.sb;
        const bw = played && m.sb > m.sa;
        const timeFmt = getDayInfo(m.date).timeFmt;
        const logoA = teamLogo(m.a);
        const logoB = teamLogo(m.b);
        const logoAHtml = logoA ? `<div class="team-logo-wrap"><img class="team-logo" src="${esc(logoA)}" alt="${esc(m.a)}" onerror="this.style.display='none'"></div>` : `<div class="team-logo-wrap"></div>`;
        const logoBHtml = logoB ? `<div class="team-logo-wrap"><img class="team-logo" src="${esc(logoB)}" alt="${esc(m.b)}" onerror="this.style.display='none'"></div>` : `<div class="team-logo-wrap"></div>`;

        const card = document.createElement("div");
        card.className = "match-card" + (played ? " played" : "");
        card.setAttribute("data-card-match", m.id);
        card.innerHTML = `
          <div class="match-time-tag">
            <span class="match-time">${timeFmt}</span>
            <span class="tag ${m.bo === 7 ? "bo7" : "bo5"}">BO${m.bo}</span>
          </div>
          <div class="match-teams">
            <div class="team-box left ${aw ? "win" : (played && bw ? "lose" : "")}">
              <div class="team-meta">
                <span class="team-name" title="${esc(teamName(m.a))}">${esc(teamName(m.a))}</span>
                <span class="team-sub">${esc(m.a)}</span>
              </div>
              ${logoAHtml}
            </div>
            <div class="score-box quick-score-box ${played ? "played" : ""}">
              <input type="number" 
                     min="0" 
                     max="9" 
                     class="score-num-input ${aw ? "winner" : ""}" 
                     data-mid="${m.id}" 
                     data-side="a" 
                     value="${m.sa !== null && m.sa !== undefined ? m.sa : ""}" 
                     placeholder="-" 
                     title="Nhập tỉ số ván đội ${esc(m.a)}">
              <span class="score-colon">:</span>
              <input type="number" 
                     min="0" 
                     max="9" 
                     class="score-num-input ${bw ? "winner" : ""}" 
                     data-mid="${m.id}" 
                     data-side="b" 
                     value="${m.sb !== null && m.sb !== undefined ? m.sb : ""}" 
                     placeholder="-" 
                     title="Nhập tỉ số ván đội ${esc(m.b)}">
            </div>
            <div class="team-box right ${bw ? "win" : (played && aw ? "lose" : "")}">
              ${logoBHtml}
              <div class="team-meta">
                <span class="team-name" title="${esc(teamName(m.b))}">${esc(teamName(m.b))}</span>
                <span class="team-sub">${esc(m.b)}</span>
              </div>
            </div>
          </div>
          <div class="match-actions">
            ${played ? `<button class="ghost sm btn-icon btn-reset" data-reset="${m.id}" title="Reset về chưa đấu (xóa kết quả)">↺</button>` : ""}
            <button class="ghost sm btn-icon btn-edit" data-edit="${m.id}" title="Chỉnh chi tiết (ngày, đội, thể thức)">✎</button>
            <button class="danger sm btn-icon btn-del" data-rm="${m.id}" title="Xóa trận">×</button>
          </div>
        `;
        matchList.appendChild(card);
      });

      dayCard.appendChild(matchList);
      weekCard.appendChild(dayCard);
    });

    container.appendChild(weekCard);
  });
}

/* ---------- Render: kịch bản ---------- */
function renderScenario() {
  const sc = activeSc();
  $("scSel").innerHTML = state.scenarios.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  $("scSel").value = sc.id;
  if ($("scDel")) {
    $("scDel").disabled = false;
    $("scDel").title = state.scenarios.length < 2 ? "Đặt lại kịch bản này về ban đầu" : "Xóa kịch bản này";
  }

  const top = Number(state.settings.top) || 0;
  const realRank = {}; compute(realResults()).forEach((r, i) => realRank[r.id] = i + 1);
  const list = compute(scenarioResults(sc));

  const undecided = {}; state.teams.forEach(t => undecided[t.id] = 0);
  let totalUndecided = 0;
  state.matches.filter(m => !isPlayed(m)).forEach(m => {
    if (!pickOf(sc, m)) { undecided[m.a]++; undecided[m.b]++; totalUndecided++; }
  });
  list.forEach(r => { r.rem = undecided[r.id]; r.max = r.pts + r.rem; });

  const tb = $("scStandings").tBodies[0]; tb.innerHTML = "";
  list.forEach((r, i) => {
    const rank = i + 1;
    let status = "";
    if (top) {
      if (totalUndecided === 0) status = rank <= top ? "ok" : "bad";
      else {
        const others = list.filter(o => o.id !== r.id);
        if (others.filter(o => o.max >= r.pts).length < top) status = "ok";
        else if (others.filter(o => o.pts > r.max).length >= top) status = "bad";
        else status = "open";
      }
    }
    const label = { ok: "✔ Vào Top " + top, bad: "✖ Bị loại", open: "⚡ Còn cơ hội" }[status] || "";
    const tagClass = { ok: "tag-playoff", bad: "tag-out", open: "tag-open" }[status] || "";

    const dl = realRank[r.id] - rank;
    const deltaHtml = dl > 0 ? `<span class="delta-badge delta-up">▲${dl}</span>` : dl < 0 ? `<span class="delta-badge delta-down">▼${-dl}</span>` : `<span class="delta-badge delta-same">–</span>`;

    let rankClass = "rank-norm";
    if (rank === 1) rankClass = "rank-1";
    else if (rank === 2) rankClass = "rank-2";
    else if (rank === 3) rankClass = "rank-3";
    else if (rank <= 4) rankClass = "rank-4";
    else if (top && rank <= top) rankClass = "rank-top";

    const diffClass = r.diff > 0 ? "diff-pos" : r.diff < 0 ? "diff-neg" : "diff-zero";
    const diffSign = r.diff > 0 ? `+${r.diff}` : `${r.diff}`;
    const logo = teamLogo(r.id);
    const logoHtml = logo ? `<div class="team-logo-wrap-sm"><img class="team-logo-sm" src="${esc(logo)}" alt="${esc(r.id)}" onerror="this.style.display='none'"></div>` : `<div class="team-logo-wrap-sm"></div>`;

    const tr = document.createElement("tr");
    if (top && rank <= top) tr.classList.add("top");
    if (top && rank === top) tr.classList.add("cut");

    tr.innerHTML = `
      <td class="col-rank"><span class="rank-badge ${rankClass}">${rank}</span></td>
      <td class="col-delta">${deltaHtml}</td>
      <td class="name col-team">
        <div class="team-cell">
          ${logoHtml}
          <div class="team-meta">
            <span class="team-name-text">${esc(r.name)}</span>
            <span class="team-code-pill">${esc(r.id)}</span>
          </div>
        </div>
      </td>
      <td class="col-stat">${r.rem}</td>
      <td class="col-pts"><span class="pts-pill">${r.pts}</span></td>
      <td class="col-stat stat-max">${r.max}</td>
      <td class="col-stat"><span class="diff-pill ${diffClass}">${diffSign}</span></td>
      <td class="col-status">${label ? `<span class="tag ${tagClass}">${label}</span>` : ""}</td>
    `;
    tb.appendChild(tr);
  });

  const ft = $("scTeam").value;
  const fw = $("scFilterWeek") ? $("scFilterWeek").value : "all";
  let rem = remaining();
  const picked = rem.filter(x => pickOf(sc, x.m)).length;
  $("scCount").textContent = `Đã chọn ${picked}/${rem.length} trận chưa đấu.`;

  if (ft) rem = rem.filter(x => x.m.a === ft || x.m.b === ft);
  if (fw !== "all") rem = rem.filter(x => String(x.m.week) === fw);
  $("qWin").disabled = $("qLose").disabled = $("qClearTeam").disabled = !ft;

  const container = $("scMatchesSchedule");
  if (!container) return;
  container.innerHTML = "";

  // Nhóm theo Tuần -> Ngày
  const byWeek = {};
  rem.forEach(({ n, m }) => {
    const w = m.week || 1;
    if (!byWeek[w]) byWeek[w] = {};
    const dInfo = getDayInfo(m.date);
    const dayKey = dInfo.rawDate;
    if (!byWeek[w][dayKey]) byWeek[w][dayKey] = { dayInfo: dInfo, items: [] };
    byWeek[w][dayKey].items.push({ n, m });
  });

  const sortedScWeeks = Array.from(new Set(Object.keys(byWeek).map(Number))).sort((a, b) => a - b);

  if (!sortedScWeeks.length) {
    container.innerHTML = `<div class="mute" style="text-align:center;padding:24px">Không có trận chưa đấu nào phù hợp bộ lọc.</div>`;
    return;
  }

  sortedScWeeks.forEach(w => {
    const dayKeys = byWeek[w] ? Object.keys(byWeek[w]).sort() : [];
    if (!dayKeys.length) return;

    const weekCard = document.createElement("div");
    weekCard.className = "week-card";
    weekCard.innerHTML = `<div class="week-header"><span>📅 TUẦN ${w} (Dự đoán)</span></div>`;

    dayKeys.forEach(dKey => {
      const dayGroup = byWeek[w][dKey];
      const dayCard = document.createElement("div");
      dayCard.className = "day-card";
      dayCard.innerHTML = `<div class="day-header"><span>🗓️ ${dayGroup.dayInfo.dayName}, ${dayGroup.dayInfo.dateFmt}</span></div>`;

      const matchList = document.createElement("div");
      matchList.className = "match-list";

      dayGroup.items.forEach(({ n, m }) => {
        const p = pickOf(sc, m), cur = p ? `${p[0]}-${p[1]}` : "";
        const aw = p && p[0] > p[1];
        const bw = p && p[1] > p[0];
        const hasPick = !!p;

        const opts = `<option value="">— Dự đoán —</option>` + scoreOptions(m.bo).map(s => {
          const parts = s.split("-");
          const winner = Number(parts[0]) > Number(parts[1]) ? m.a : m.b;
          return `<option value="${s}" ${s === cur ? "selected" : ""}>${parts[0]} - ${parts[1]} (${winner})</option>`;
        }).join("");

        const timeFmt = getDayInfo(m.date).timeFmt;
        const logoA = teamLogo(m.a);
        const logoB = teamLogo(m.b);
        const logoAHtml = logoA ? `<div class="team-logo-wrap"><img class="team-logo" src="${esc(logoA)}" alt="${esc(m.a)}" onerror="this.style.display='none'"></div>` : `<div class="team-logo-wrap"></div>`;
        const logoBHtml = logoB ? `<div class="team-logo-wrap"><img class="team-logo" src="${esc(logoB)}" alt="${esc(m.b)}" onerror="this.style.display='none'"></div>` : `<div class="team-logo-wrap"></div>`;

        const card = document.createElement("div");
        card.className = "match-card" + (hasPick ? " sc-picked-card" : "");
        card.innerHTML = `
          <div class="match-time-tag">
            <span class="match-time">#${n} • ${timeFmt}</span>
            <span class="tag ${m.bo === 7 ? "bo7" : "bo5"}">BO${m.bo}</span>
          </div>
          <div class="match-teams">
            <div class="team-box left ${aw ? "win" : (hasPick && bw ? "lose" : "")}">
              <div class="team-meta">
                <span class="team-name" title="${esc(teamName(m.a))}">${esc(teamName(m.a))}</span>
                <span class="team-sub">${esc(m.a)}</span>
              </div>
              ${logoAHtml}
            </div>
            <div class="score-box sc-pick-box ${hasPick ? "picked" : ""}">
              <select data-pick="${m.id}">${opts}</select>
            </div>
            <div class="team-box right ${bw ? "win" : (hasPick && aw ? "lose" : "")}">
              ${logoBHtml}
              <div class="team-meta">
                <span class="team-name" title="${esc(teamName(m.b))}">${esc(teamName(m.b))}</span>
                <span class="team-sub">${esc(m.b)}</span>
              </div>
            </div>
          </div>
        `;
        matchList.appendChild(card);
      });

      dayCard.appendChild(matchList);
      weekCard.appendChild(dayCard);
    });

    container.appendChild(weekCard);
  });
}

if ($("scMatchesSchedule")) {
  $("scMatchesSchedule").addEventListener("change", e => {
    const id = e.target.dataset.pick; if (!id) return;
    const sc = activeSc();
    if (e.target.value) sc.picks[id] = e.target.value; else delete sc.picks[id];
    saveScenario(); renderScenario();
  });
}

if ($("filterWeek")) $("filterWeek").onchange = renderMatches;
if ($("scFilterWeek")) $("scFilterWeek").onchange = renderScenario;
$("scTeam").onchange = renderScenario;
$("scSel").onchange = e => { state.active = e.target.value; saveScenario(); renderScenario(); };

$("scNew").onclick = () => {
  const n = prompt("Tên kịch bản:", "Kịch bản " + (state.scenarios.length + 1)); if (!n) return;
  const s = { id: uid(), name: n.trim(), picks: {} }; state.scenarios.push(s); state.active = s.id; saveScenario(); renderScenario();
};
$("scDup").onclick = () => {
  const c = activeSc(), s = { id: uid(), name: c.name + " (bản sao)", picks: Object.assign({}, c.picks) };
  state.scenarios.push(s); state.active = s.id; saveScenario(); renderScenario();
};
$("scRen").onclick = () => { const c = activeSc(), n = prompt("Tên mới:", c.name); if (n && n.trim()) { c.name = n.trim(); saveScenario(); renderScenario(); } };
$("scDel").onclick = () => {
  if (state.scenarios.length < 2) {
    if (!confirm("Đặt lại kịch bản này về mặc định (xóa hết tỉ số đã dự đoán)?")) return;
    const sc = activeSc();
    sc.name = "Kịch bản 1";
    sc.picks = {};
    saveScenario();
    renderScenario();
    return;
  }
  if (!confirm("Xóa kịch bản này?")) return;
  state.scenarios = state.scenarios.filter(s => s.id !== state.active);
  state.active = state.scenarios[0].id;
  saveScenario();
  renderScenario();
};
function quick(mode) {
  const t = $("scTeam").value; if (!t) return; const sc = activeSc();
  state.matches.filter(m => !isPlayed(m) && (m.a === t || m.b === t)).forEach(m => {
    if (mode === "clear") { delete sc.picks[m.id]; return; }
    const need = needWins(m.bo), teamIsA = m.a === t, win = mode === "win";
    sc.picks[m.id] = (teamIsA === win) ? `${need}-0` : `0-${need}`;
  });
  saveScenario(); renderScenario();
}
$("qWin").onclick = () => quick("win");
$("qLose").onclick = () => quick("lose");
$("qClearTeam").onclick = () => quick("clear");
$("qClearAll").onclick = () => { activeSc().picks = {}; saveScenario(); renderScenario(); };

/* ---------- AI ---------- */
function buildAIText() {
  const sc = activeSc(), st = state.settings, top = st.top;
  const real = compute(realResults());
  const rem = remaining();
  const L = [];
  L.push("Bạn là trợ lý phân tích giải đấu Liên Quân Mobile (vòng tròn tính điểm).");
  L.push("");
  const tbDesc = st.tiebreak === "h2h"
    ? "đối đầu, rồi hiệu số ván, rồi tổng ván thắng"
    : (st.tiebreak === "diff"
      ? "hiệu số ván, rồi tổng ván thắng, rồi đối đầu"
      : "hiệu số ván, rồi đối đầu trực tiếp, rồi tổng số ván thắng (chuẩn AOG)");
  L.push(`Top ${top} đi tiếp. Bằng điểm xếp theo: ${tbDesc}.`);
  L.push("");
  L.push("BẢNG XẾP HẠNG THỰC TẾ HIỆN TẠI (hạng. đội | thắng-thua | ván thắng-ván thua | hiệu số | điểm):");
  real.forEach((r, i) => L.push(`${i + 1}. ${r.name} | ${r.w}-${r.l} | ${r.gw}-${r.gl} | ${r.diff >= 0 ? "+" : ""}${r.diff} | ${r.pts}đ`));
  L.push("");
  L.push(`CÁC TRẬN CHƯA ĐẤU (${rem.length} trận; n | đội A vs đội B | thể thức | dự đoán hiện có trong kịch bản "${sc.name}"):`);
  rem.forEach(({ n, m }) => { const p = pickOf(sc, m); L.push(`${n} | ${teamName(m.a)} vs ${teamName(m.b)} | BO${m.bo} | ${p ? p[0] + "-" + p[1] : "chưa chọn"}`); });
  L.push("");
  L.push("YÊU CẦU: <ghi yêu cầu của bạn ở đây, ví dụ: tìm kịch bản ít trận thắng nhất để đội Rex Regum Qeon VN vào top 6>");
  L.push("");
  L.push("ĐỊNH DẠNG TRẢ LỜI: giải thích ngắn, rồi cho đúng một khối JSON:");
  L.push('{"name":"tên kịch bản","picks":[{"n":1,"score":"3-0"},{"n":2,"score":"2-3"}]}');
  L.push("- n là số thứ tự trận ở danh sách trên. score viết theo dạng (ván của đội A)-(ván của đội B), tức đội đứng trước trong dòng đó.");
  L.push("- score hợp lệ: BO5 chỉ 3-0, 3-1, 3-2, 2-3, 1-3, 0-3. BO7 chỉ 4-0, 4-1, 4-2, 4-3, 3-4, 2-4, 1-4, 0-4.");
  L.push("- Chỉ liệt kê các trận bạn quyết định; trận không liệt kê coi như chưa chọn.");
  return L.join("\n");
}
$("btnBuild").onclick = () => { $("aiOut").value = buildAIText(); $("copyMsg").textContent = ""; };
$("btnCopy").onclick = () => {
  const ta = $("aiOut"); ta.value = buildAIText(); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { }
  if (!ok && navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => { $("copyMsg").textContent = "Đã sao chép."; $("copyMsg").className = "msg ok"; });
  else { $("copyMsg").textContent = ok ? "Đã sao chép." : "Không tự sao chép được, hãy bôi đen và Ctrl+C."; $("copyMsg").className = "msg " + (ok ? "ok" : "err"); }
};
function loadAI(intoNew) {
  const out = $("aiMsg"); const text = $("aiIn").value;
  const mt = /\{[\s\S]*\}/.exec(text);
  if (!mt) { out.textContent = "Không tìm thấy JSON."; out.className = "msg err"; return; }
  let data; try { data = JSON.parse(mt[0]); } catch (e) { out.textContent = "JSON không hợp lệ: " + e.message; out.className = "msg err"; return; }
  let picks = data.picks;
  if (picks && !Array.isArray(picks) && typeof picks === "object") picks = Object.entries(picks).map(([n, score]) => ({ n: Number(n), score }));
  if (!Array.isArray(picks)) { out.textContent = 'Thiếu mảng "picks".'; out.className = "msg err"; return; }
  const rem = remaining(), byN = {}; rem.forEach(x => byN[x.n] = x.m);
  const newPicks = {}, errs = [];
  picks.forEach(p => {
    const m = byN[p.n], sc = parseScore(p.score);
    if (!m) return errs.push(`n=${p.n}: không có trận này`);
    if (!sc || !validScore(m.bo, sc[0], sc[1])) return errs.push(`n=${p.n}: tỉ số "${p.score}" không hợp lệ cho BO${m.bo}`);
    newPicks[m.id] = `${sc[0]}-${sc[1]}`;
  });
  let target;
  if (intoNew) { target = { id: uid(), name: (data.name || "Kịch bản từ AI").toString().slice(0, 60), picks: {} }; state.scenarios.push(target); state.active = target.id; }
  else target = activeSc();
  Object.assign(target.picks, newPicks); saveScenario(); renderScenario();
  const n = Object.keys(newPicks).length;
  out.textContent = `Đã nạp ${n} trận` + (errs.length ? `, bỏ qua ${errs.length}: ${errs.slice(0, 5).join("; ")}` : ".");
  out.className = "msg " + (errs.length ? "err" : "ok");
}
$("btnLoadNew").onclick = () => loadAI(true);
$("btnLoadCur").onclick = () => loadAI(false);

/* ---------- Form trận ---------- */
function say(text, kind) { const m = $("msg"); m.textContent = text; m.className = "msg " + (kind || ""); }
function readForm() {
  const a = $("teamA").value, b = $("teamB").value, bo = Number($("bo").value);
  const rawA = $("scoreA").value.trim(), rawB = $("scoreB").value.trim();
  if (!a || !b) return { error: "Chưa có đủ đội." };
  if (a === b) return { error: "Hai đội phải khác nhau." };
  let sa = null, sb = null;
  if (rawA !== "" || rawB !== "") {
    if (rawA === "" || rawB === "") return { error: "Nhập đủ tỉ số hai bên, hoặc để trống cả hai." };
    sa = Number(rawA); sb = Number(rawB);
    if (!Number.isInteger(sa) || !Number.isInteger(sb) || sa < 0 || sb < 0) {
      return { error: "Tỉ số ván phải là số nguyên từ 0 trở lên." };
    }
    if (sa === sb) {
      return { error: "Tỉ số hai đội không thể bằng nhau (phải có một đội thắng)." };
    }
    const maxWin = needWins(bo);
    if (Math.max(sa, sb) > maxWin) {
      return { error: `Thể thức BO${bo} chỉ thi đấu tối đa đến ${maxWin} ván thắng.` };
    }
  }

  // Parse Ngày (ngày/tháng/năm) và Giờ (giờ:phút)
  let dateIso = "";
  const rawDate = $("dateStr").value.trim();
  const rawTime = $("timeStr").value.trim() || "17:00";
  if (rawDate) {
    const parts = rawDate.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = "20" + year;
      dateIso = `${year}-${month}-${day}T${rawTime}:00`;
    } else {
      return { error: "Ngày thi đấu phải theo định dạng ngày/tháng/năm (ví dụ: 05/03/2026)." };
    }
  }

  const weekVal = $("matchWeek") ? Number($("matchWeek").value) : null;
  const week = (weekVal && !isNaN(weekVal) && weekVal > 0) ? weekVal : (inferWeekFromDate(dateIso) || 1);
  const leg = week <= 4 ? 1 : 2;

  return { m: { a, b, teamA: a, teamB: b, bo, date: dateIso, week, leg, sa, sb, scoreA: sa, scoreB: sb } };
}
function resetForm() {
  editingId = null;
  $("scoreA").value = "";
  $("scoreB").value = "";
  $("dateStr").value = "";
  $("timeStr").value = "17:00";
  if ($("datePicker")) $("datePicker").value = "";
  const curFw = $("filterWeek") ? $("filterWeek").value : "all";
  if ($("matchWeek")) {
    $("matchWeek").value = (curFw !== "all" && !isNaN(+curFw)) ? curFw : "1";
  }
  $("formTitle").textContent = "➕ Thêm trận đấu mới";
  $("btnSave").textContent = "Lưu trận";
  $("btnCancel").hidden = true;
  if ($("btnClearScore")) $("btnClearScore").hidden = true;
  if (editingId && $("matchFormDetails")) $("matchFormDetails").open = false;
}
$("btnSave").onclick = () => {
  const r = readForm(); if (r.error) return say(r.error, "err");
  if (editingId) {
    const i = state.matches.findIndex(m => m.id === editingId);
    state.matches[i] = { ...state.matches[i], ...r.m, id: editingId };
    say("Đã cập nhật trận.", "ok");
  } else {
    state.matches.push({ id: uid(), ...r.m });
    say("Đã thêm trận.", "ok");
  }
  save(); resetForm(); renderAll();
};
$("btnCancel").onclick = () => { resetForm(); say(""); };

if ($("btnClearScore")) {
  $("btnClearScore").onclick = async () => {
    $("scoreA").value = "";
    $("scoreB").value = "";
    if (editingId) {
      const m = state.matches.find(x => x.id === editingId);
      if (m) {
        m.sa = null;
        m.sb = null;
        m.scoreA = null;
        m.scoreB = null;
        await save();
        resetForm();
        renderAll();
        say("Đã xóa kết quả, trận trở về trạng thái chưa đấu.", "ok");
      }
    }
  };
}

function autoInferWeekFromDateInput() {
  const rawDate = $("dateStr") ? $("dateStr").value.trim() : "";
  if (!rawDate) return;
  const parts = rawDate.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = "20" + year;
    const iso = `${year}-${month}-${day}T12:00:00`;
    const inferred = inferWeekFromDate(iso);
    if (inferred && $("matchWeek")) {
      $("matchWeek").value = inferred;
    }
  }
}

if ($("dateStr")) {
  $("dateStr").addEventListener("input", autoInferWeekFromDateInput);
  $("dateStr").addEventListener("change", autoInferWeekFromDateInput);
  $("dateStr").addEventListener("blur", autoInferWeekFromDateInput);
}

if ($("btnPickDate") && $("datePicker")) {
  $("btnPickDate").onclick = () => {
    try { $("datePicker").showPicker(); } catch (e) { $("datePicker").click(); }
  };
  $("datePicker").onchange = () => {
    if ($("datePicker").value) {
      const parts = $("datePicker").value.split("-");
      if (parts.length === 3) {
        $("dateStr").value = `${parts[2]}/${parts[1]}/${parts[0]}`;
        autoInferWeekFromDateInput();
      }
    }
  };
}

// Cập nhật giao diện của 1 thẻ trận đấu mà không cần render lại toàn bộ danh sách (tránh mất focus/bàn phím)
function updateMatchCardUI(card, m) {
  if (!card) return;
  const played = isPlayed(m);
  const aw = played && m.sa > m.sb;
  const bw = played && m.sb > m.sa;

  card.classList.toggle("played", played);

  const scoreBox = card.querySelector(".quick-score-box");
  if (scoreBox) {
    scoreBox.classList.toggle("played", played);
  }

  const inputA = card.querySelector('input[data-side="a"]');
  const inputB = card.querySelector('input[data-side="b"]');
  if (inputA) inputA.classList.toggle("winner", aw);
  if (inputB) inputB.classList.toggle("winner", bw);

  const teamLeft = card.querySelector(".team-box.left");
  const teamRight = card.querySelector(".team-box.right");
  if (teamLeft) {
    teamLeft.classList.toggle("win", aw);
    teamLeft.classList.toggle("lose", played && bw);
  }
  if (teamRight) {
    teamRight.classList.toggle("win", bw);
    teamRight.classList.toggle("lose", played && aw);
  }

  // Cập nhật nút reset ↺
  const actions = card.querySelector(".match-actions");
  if (actions) {
    let btnReset = actions.querySelector("button[data-reset]");
    if (played) {
      if (!btnReset) {
        btnReset = document.createElement("button");
        btnReset.className = "ghost sm btn-icon btn-reset";
        btnReset.setAttribute("data-reset", m.id);
        btnReset.title = "Reset về chưa đấu (xóa kết quả)";
        btnReset.textContent = "↺";
        actions.insertBefore(btnReset, actions.firstChild);
      }
    } else {
      if (btnReset) btnReset.remove();
    }
  }
}

if ($("matchesSchedule")) {
  // Focus & select all text on click for immediate typing
  $("matchesSchedule").addEventListener("focusin", e => {
    if (e.target.classList.contains("score-num-input")) {
      setTimeout(() => {
        try { e.target.select(); } catch (err) {}
      }, 50);
    }
  });

  // Keyboard navigation: Enter, Arrows, Backspace
  $("matchesSchedule").addEventListener("keydown", e => {
    if (!e.target.classList.contains("score-num-input")) return;
    const side = e.target.dataset.side;
    const card = e.target.closest(".match-card");
    if (!card) return;

    const inputA = card.querySelector('input[data-side="a"]');
    const inputB = card.querySelector('input[data-side="b"]');

    if (e.key === "Enter") {
      e.preventDefault();
      if (side === "a" && inputB) {
        inputB.focus();
        setTimeout(() => { try { inputB.select(); } catch (err) {} }, 50);
      } else if (inputB) {
        inputB.blur();
      }
    } else if (e.key === "ArrowRight" && side === "a") {
      if (inputB && (e.target.selectionStart === e.target.value.length || e.target.value === "")) {
        inputB.focus();
        setTimeout(() => { try { inputB.select(); } catch (err) {} }, 50);
      }
    } else if (e.key === "ArrowLeft" && side === "b") {
      if (inputA && (e.target.selectionStart === 0 || e.target.value === "")) {
        inputA.focus();
        setTimeout(() => { try { inputA.select(); } catch (err) {} }, 50);
      }
    } else if (e.key === "Backspace" && side === "b" && e.target.value === "") {
      if (inputA) {
        inputA.focus();
        setTimeout(() => { try { inputA.select(); } catch (err) {} }, 50);
      }
    }
  });

  // Nhập điểm trực tiếp - phản hồi tức thì và không làm mất focus
  $("matchesSchedule").addEventListener("input", e => {
    if (!e.target.classList.contains("score-num-input")) return;
    const side = e.target.dataset.side;
    const mid = e.target.dataset.mid;
    const card = e.target.closest(".match-card");
    if (!card || !mid) return;

    const m = state.matches.find(x => x.id === mid);
    if (!m) return;

    const inputA = card.querySelector('input[data-side="a"]');
    const inputB = card.querySelector('input[data-side="b"]');
    if (!inputA || !inputB) return;

    // Tự động chuyển sang ô B khi đã nhập 1 chữ số vào ô A và ô B đang trống
    if (side === "a" && e.target.value.length >= 1 && inputB.value === "") {
      inputB.focus();
      setTimeout(() => { try { inputB.select(); } catch (err) {} }, 50);
    }

    const rawA = inputA.value.trim();
    const rawB = inputB.value.trim();

    if (rawA === "" && rawB === "") {
      m.sa = null;
      m.sb = null;
      m.scoreA = null;
      m.scoreB = null;
      updateMatchCardUI(card, m);
      save();
      renderStandings();
      renderBase();
      return;
    }

    if (rawA !== "" && rawB !== "") {
      const nA = parseInt(rawA, 10);
      const nB = parseInt(rawB, 10);
      if (!isNaN(nA) && !isNaN(nB) && nA >= 0 && nB >= 0) {
        m.sa = nA;
        m.sb = nB;
        m.scoreA = nA;
        m.scoreB = nB;
        updateMatchCardUI(card, m);
        save();
        renderStandings();
        renderBase();
      }
    }
  });

  // Lưu khi blur hoặc Enter
  $("matchesSchedule").addEventListener("change", async e => {
    if (!e.target.classList.contains("score-num-input")) return;
    const mid = e.target.dataset.mid;
    if (!mid) return;
    const m = state.matches.find(x => x.id === mid);
    if (!m) return;

    const card = e.target.closest(".match-card");
    if (!card) return;
    const inputA = card.querySelector('input[data-side="a"]');
    const inputB = card.querySelector('input[data-side="b"]');
    if (!inputA || !inputB) return;

    const rawA = inputA.value.trim();
    const rawB = inputB.value.trim();

    if (rawA === "" && rawB === "") {
      m.sa = null;
      m.sb = null;
      m.scoreA = null;
      m.scoreB = null;
    } else if (rawA !== "" && rawB !== "") {
      const nA = parseInt(rawA, 10);
      const nB = parseInt(rawB, 10);
      if (!isNaN(nA) && !isNaN(nB) && nA >= 0 && nB >= 0) {
        m.sa = nA;
        m.sb = nB;
        m.scoreA = nA;
        m.scoreB = nB;
      }
    }
    updateMatchCardUI(card, m);
    if (editingId === mid) {
      $("scoreA").value = m.sa !== null ? m.sa : "";
      $("scoreB").value = m.sb !== null ? m.sb : "";
    }
    await save();
    renderStandings();
    renderBase();
  });

  $("matchesSchedule").addEventListener("click", async e => {
    const rst = e.target.dataset.reset;
    if (rst) {
      const m = state.matches.find(x => x.id === rst);
      if (m) {
        m.sa = null;
        m.sb = null;
        m.scoreA = null;
        m.scoreB = null;
        if (editingId === rst) {
          $("scoreA").value = "";
          $("scoreB").value = "";
          if ($("btnClearScore")) $("btnClearScore").hidden = true;
        }
        const card = e.target.closest(".match-card");
        if (card) {
          const inputA = card.querySelector('input[data-side="a"]');
          const inputB = card.querySelector('input[data-side="b"]');
          if (inputA) inputA.value = "";
          if (inputB) inputB.value = "";
          updateMatchCardUI(card, m);
        }
        await save();
        renderStandings();
        renderBase();
      }
      return;
    }

    const ed = e.target.dataset.edit, rm = e.target.dataset.rm;
    if (ed) {
      const m = state.matches.find(x => x.id === ed); editingId = ed;
      $("teamA").value = m.a; $("teamB").value = m.b; $("bo").value = m.bo;
      if ($("matchWeek") && m.week) $("matchWeek").value = m.week;
      if (m.date) {
        const d = new Date(m.date);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          $("dateStr").value = `${dd}/${mm}/${yyyy}`;
          $("timeStr").value = `${hh}:${min}`;
          if ($("datePicker")) $("datePicker").value = `${yyyy}-${mm}-${dd}`;
        } else {
          $("dateStr").value = "";
          $("timeStr").value = "17:00";
        }
      } else {
        $("dateStr").value = "";
        $("timeStr").value = "17:00";
      }
      $("scoreA").value = isPlayed(m) ? m.sa : ""; $("scoreB").value = isPlayed(m) ? m.sb : "";
      if ($("matchFormDetails")) $("matchFormDetails").open = true;
      $("formTitle").textContent = "✏️ Sửa trận (" + esc(m.a) + " vs " + esc(m.b) + ")";
      $("btnSave").textContent = "Cập nhật";
      $("btnCancel").hidden = false;
      if ($("btnClearScore")) $("btnClearScore").hidden = !isPlayed(m);
      if ($("matchFormDetails")) $("matchFormDetails").scrollIntoView({ behavior: "smooth", block: "start" });
      $("scoreA").focus();
    }
    if (rm && confirm("Xóa trận này?")) {
      state.matches = state.matches.filter(x => x.id !== rm);
      if (editingId === rm) resetForm();
      save(); renderAll();
    }
  });
}

$("btnClearTodo").onclick = () => {
  const n = state.matches.filter(m => !isPlayed(m)).length;
  if (n && confirm(`Xóa ${n} trận chưa đấu?`)) { state.matches = state.matches.filter(isPlayed); save(); renderAll(); }
};
$("filter").onchange = renderMatches;
$("filterTeam").onchange = renderMatches;

if ($("standingsWeek")) $("standingsWeek").onchange = renderStandings;
if ($("standingsMode")) $("standingsMode").onchange = renderStandings;
if ($("btnResetStandingsWeek")) {
  $("btnResetStandingsWeek").onclick = () => {
    if ($("standingsWeek")) $("standingsWeek").value = "all";
    renderStandings();
  };
}
if ($("btnJumpToMatchesWeek")) {
  $("btnJumpToMatchesWeek").onclick = () => {
    const curW = $("standingsWeek") ? $("standingsWeek").value : "all";
    if (curW !== "all" && $("filterWeek")) {
      $("filterWeek").value = curW;
      renderMatches();
    }
    const sched = $("matchesSchedule");
    if (sched) sched.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* ---------- Đội & điểm khởi đầu ---------- */
$("baseTable").addEventListener("change", e => {
  const id = e.target.dataset.team; if (!id) return;
  const t = state.teams.find(x => x.id === id); t[e.target.dataset.f] = Math.max(0, Number(e.target.value) || 0);
  save(); renderAll();
});
$("baseTable").addEventListener("click", e => {
  const del = e.target.dataset.del, ren = e.target.dataset.ren;
  if (ren) { const t = state.teams.find(x => x.id === ren), n = prompt("Tên mới:", t.name); if (n && n.trim()) { t.name = n.trim(); save(); renderAll(); } }
  if (del) {
    const t = state.teams.find(x => x.id === del), used = state.matches.filter(m => m.a === del || m.b === del).length;
    if (confirm(`Xóa "${t.name}"${used ? ` và ${used} trận liên quan` : ""}?`)) {
      state.teams = state.teams.filter(x => x.id !== del); state.matches = state.matches.filter(m => m.a !== del && m.b !== del); save(); renderAll();
    }
  }
});
$("btnAddTeam").onclick = () => {
  const n = $("newTeam").value.trim(); if (!n) return;
  if (state.teams.some(t => t.name.toLowerCase() === n.toLowerCase())) return alert("Tên đội đã tồn tại.");
  state.teams.push({ id: uid(), name: n, w: 0, l: 0, gw: 0, gl: 0 }); $("newTeam").value = ""; save(); renderAll();
};

/* ---------- Sinh lịch ---------- */
$("btnGen").onclick = () => {
  const total = Number($("legsTotal").value) || 0, done = Number($("legsDone").value) || 0, bo = Number($("genBo").value);
  Object.assign(state.settings, { legsTotal: total, legsDone: done, defaultBo: bo });
  let added = 0;
  for (let i = 0; i < state.teams.length; i++) for (let j = i + 1; j < state.teams.length; j++) {
    const A = state.teams[i].id, B = state.teams[j].id;
    const have = state.matches.filter(m => (m.a === A && m.b === B) || (m.a === B && m.b === A)).length;
    for (let k = 0; k < total - done - have; k++) {
      state.matches.push({ id: uid(), a: A, b: B, teamA: A, teamB: B, bo, date: "", sa: null, sb: null, scoreA: null, scoreB: null });
      added++;
    }
  }
  save(); renderAll(); say(added ? `Đã sinh ${added} trận chưa đấu.` : "Không có trận nào cần sinh thêm.", added ? "ok" : "");
};

/* ---------- Cài đặt, xuất/nhập ---------- */
$("topN").onchange = e => { state.settings.top = Math.max(0, Number(e.target.value) || 0); save(); renderAll(); };
$("tiebreak").onchange = e => { state.settings.tiebreak = e.target.value; save(); renderAll(); };
$("btnExport").onclick = () => {
  const exportPayload = formatForStorage(state);
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "giai-dau-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); URL.revokeObjectURL(a.href);
};
$("btnImport").onclick = () => $("fileImport").click();
$("fileImport").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = async () => {
    try {
      const s = JSON.parse(rd.result);
      if (!Array.isArray(s.teams) || !Array.isArray(s.matches)) throw new Error();
      if (confirm("Thay toàn bộ dữ liệu hiện tại bằng file này?")) {
        state = normalise(s);
        await save();
        resetForm();
        initUI();
      }
    } catch (err) { alert("File JSON không hợp lệ."); }
  };
  rd.readAsText(f); e.target.value = "";
};
$("btnReset").onclick = async () => {
  if (confirm("Khôi phục toàn bộ về dữ liệu gốc từ file data.json?")) {
    localStorage.removeItem(KEY);
    lastJsonString = "";
    await loadData(true);
    resetForm();
    initUI();
  }
};

/* ---------- Khởi tạo ---------- */
function renderAll() {
  renderTeamSelects();
  renderWeekSelects();
  if (tab === "real") { renderStandings(); renderBase(); renderMatches(); }
  else renderScenario();
}
function initUI() {
  $("topN").value = state.settings.top;
  $("tiebreak").value = state.settings.tiebreak;
  $("legsTotal").value = state.settings.legsTotal;
  $("legsDone").value = state.settings.legsDone;
  $("genBo").value = String(state.settings.defaultBo);
  $("aiOut").value = "";
  renderAll();
  if (tab === "scn") $("aiOut").value = buildAIText();
}

async function init() {
  await loadData();
  initUI();
  // Tự động kiểm tra đồng bộ CHỈ trên localhost khi người dùng chỉnh sửa data.json qua VS Code/Notepad
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    setInterval(async () => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        if (res.ok) {
          const text = await res.text();
          if (!lastJsonString) {
            lastJsonString = text;
            return;
          }
          if (text !== lastJsonString) {
            lastJsonString = text;
            const parsed = JSON.parse(text);
            if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.matches) && parsed.matches.length > 0) {
              // Giữ nguyên kịch bản của người dùng trong LocalStorage khi đồng bộ file server
              parsed.scenarios = state.scenarios;
              parsed.active = state.active;
              state = normalise(parsed);
              localStorage.setItem(KEY, JSON.stringify(formatForStorage(state)));
              renderAll();
            }
          }
        }
      } catch (e) { }
    }, 3000);
  }
}

$("tabScn").addEventListener("click", () => { $("aiOut").value = buildAIText(); });
init();
