/* =========================================================
   تدريب نافس علوم — منطق المنصة
   إعداد المعلمة: نعمة هرشان
   ========================================================= */
const APP = {
  name:'تدريب نافس علوم',
  teacher:'نعمة هرشان',
  pin:'1234'
};

/* ---------- تخزين (لكل طالبة مساحة بيانات مستقلة) ---------- */
const K = { profile:'profile', progress:'progress', attempts:'attempts', msg:'msg', goal:'goal', pin:'nafes_pin', theme:'nafes_theme' };
const GLOBAL_KEYS = ['nafes_pin','nafes_theme','nafas_registry','nafas_active','nafas_uploads'];
let U = { id: localStorage.getItem('nafas_active') || '' };
const uk = (base) => GLOBAL_KEYS.indexOf(base) > -1 ? base : 'nafas_u_' + U.id + '_' + base;
const g = (k, d) => { try { const v = localStorage.getItem(uk(k)); return v ? JSON.parse(v) : d; } catch { return d; } };
const s = (k, v) => localStorage.setItem(uk(k), JSON.stringify(v));
const gRaw = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const sRaw = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const readUser = (id, base, d) => gRaw('nafas_u_' + id + '_' + base, d);
const writeUser = (id, base, v) => sRaw('nafas_u_' + id + '_' + base, v);
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

let profile = g(K.profile, { name:'', school:'' });
let progress = g(K.progress, {});       // key -> {mcq:{best,attempts,corrected}, tasks:{done}, last:ts}
let attempts = g(K.attempts, []);        // سجل المحاولات
let messages = g(K.msg, []);             // رسائل ولي الأمر
let goal = g(K.goal, 10);
let pin = g(K.pin, APP.pin);

/* ---------- الطالبات: السجل وتسجيل الدخول ---------- */
const getRegistry = () => gRaw('nafas_registry', []);
const saveRegistry = (reg) => sRaw('nafas_registry', reg);
const studentExists = (id) => getRegistry().some(x => x.id === id);

function loadUserData(){
  profile = g(K.profile, { name:'', school:'' });
  progress = g(K.progress, {});
  attempts = g(K.attempts, []);
  messages = g(K.msg, []);
  goal = g(K.goal, 10);
}
function logLogin(){
  const reg = getRegistry();
  const st = reg.find(x => x.id === U.id);
  if(!st) return;
  st.lastSeen = Date.now();
  st.sessions = (st.sessions || 0) + 1;
  st.logins = st.logins || {};
  const d = today();
  st.logins[d] = (st.logins[d] || 0) + 1;
  saveRegistry(reg);
  syncPushSoon();
}
function migrateLegacy(){
  const legacyMap = { nafas_profile:'profile', nafas_progress:'progress', nafas_attempts:'attempts', nafas_msg:'msg', nafas_goal:'goal' };
  if(!localStorage.getItem('nafas_registry')){
    const legacy = gRaw('nafes_profile', null);
    if(!legacy) return;
    const id = 'u' + Date.now();
    const st = { id, name: legacy.name || 'طالبة', school: legacy.school || '', cls:'',
                 firstSeen:Date.now(), lastSeen:Date.now(), sessions:1, logins:{} };
    st.logins[today()] = 1;
    saveRegistry([st]);
    Object.keys(legacyMap).forEach(k => { const v = localStorage.getItem(k); if(v) writeUser(id, legacyMap[k], JSON.parse(v)); });
    localStorage.setItem('nafas_active', id);
    U.id = id;
    return;
  }
  // سجل طالبات موجود مسبقاً: ننسب أي إنجاز قديم (قبل نظام تعدد الطالبات) للطالبة النشطة
  const legacyAttempts = gRaw('nafes_attempts', []);
  if(!legacyAttempts.length) return;
  const reg = getRegistry();
  const target = reg.find(x => x.id === U.id) || reg[0];
  if(!target) return;
  if(readUser(target.id, 'attempts', []).length){
    Object.keys(legacyMap).forEach(k => localStorage.removeItem(k));
    return;
  }
  writeUser(target.id, 'attempts', legacyAttempts);
  const lp = gRaw('nafes_profile', null);
  if(lp && !readUser(target.id, 'profile', {}).name) writeUser(target.id, 'profile', lp);
  const lprog = gRaw('nafes_progress', null);
  if(lprog && !Object.keys(readUser(target.id, 'progress', {})).length) writeUser(target.id, 'progress', lprog);
  Object.keys(legacyMap).forEach(k => localStorage.removeItem(k));
}
function renderLoginGate(){
  const list = $('#loginList');
  if(!list) return;
  const reg = getRegistry();
  list.innerHTML = reg.length ? reg.map(st =>
    '<button class="lg-user" data-id="' + st.id + '"><span class="avatar">' + esc((st.name || '؟').trim()[0]) + '</span>' +
    '<span class="lg-u"><b>' + esc(st.name) + '</b><small>' + esc(st.school || 'بدون مدرسة') + ' • آخر دخول: ' +
    (st.lastSeen ? new Date(st.lastSeen).toLocaleDateString('ar-SA') : '—') + '</small></span></button>').join('')
    : '<div class="empty">لا توجد طالبات مسجلات على هذا الجهاز بعد — سجّلي حساباً جديداً بالأسفل.</div>';
  list.querySelectorAll('[data-id]').forEach(b => b.onclick = () => activateUser(b.dataset.id));
  showLoginRole('');
  $('#loginGate').hidden = false;
}
function activateUser(id){
  U.id = id;
  localStorage.setItem('nafas_active', id);
  loadUserData();
  logLogin();
  $('#loginGate').hidden = true;
  renderAll();
  syncPushSoon();
  const un = unreadFor(U.id, profile.name);
  toast(un ? 'أهلًا ' + (profile.name || '') + ' 👋 — لديك ' + un + ' رسالة من معلمة 📩' : 'أهلًا ' + (profile.name || '') + ' 👋');
}
function addStudent(){
  const name = $('#lgName').value.trim(), school = $('#lgSchool').value.trim(), cls = $('#lgClass').value.trim();
  if(!name){ toast('اكتبي اسم الطالبة أولاً ✍️'); return; }
  const reg = getRegistry();
  const id = 'u' + Date.now() + Math.floor(Math.random() * 900);
  reg.push({ id, name, school, cls, firstSeen:Date.now(), lastSeen:Date.now(), sessions:0, logins:{} });
  saveRegistry(reg);
  U.id = id; localStorage.setItem('nafas_active', id);
  profile = { name, school, cls };
  s(K.profile, profile); s(K.progress, {}); s(K.attempts, []); s(K.msg, []); s(K.goal, 10);
  loadUserData();
  logLogin();
  $('#lgName').value = ''; $('#lgSchool').value = ''; $('#lgClass').value = '';
  $('#loginGate').hidden = true;
  renderAll();
  toast('تم تسجيل ' + name + ' ✅');
}
function logoutToRoles(role){
  U.id = '';
  localStorage.removeItem('nafas_active');
  teacherAuthed = false;
  const tp = $('#teacherPanel'); if(tp) tp.hidden = true;
  const tb = $('#teacherBody'); if(tb) tb.hidden = true;
  const tg = $('#teacherGate'); if(tg) tg.hidden = false;
  const tin = $('#teacherPin'); if(tin) tin.value = '';
  const pb = $('#parentBody'); if(pb) pb.hidden = true;
  const pg = $('#parentGate'); if(pg) pg.hidden = false;
  const pi = $('#pinInput'); if(pi) pi.value = '';
  const md = $('#modal'); if(md) md.hidden = true;
  const ip = $('#inboxPanel'); if(ip) ip.hidden = true;
  $$('.panel').forEach(p => p.classList.remove('show'));
  const hub = $('#sec-hub'); if(hub) hub.classList.add('show');
  $$('.mainnav button').forEach(b => b.classList.toggle('active', b.dataset.sec === 'hub'));
  const nav = $('#mainNav'); if(nav) nav.classList.remove('open');
  renderLoginGate();
  if(role) showLoginRole(role);
  toast('تم الخروج — اختاري الدور من جديد 👋');
}
function switchUser(){ logoutToRoles('student'); }
function renderAll(){
  renderProfile(); renderHub(); renderTrain(); renderProgress(); renderUploaded();
  renderInbox(); renderBell();
  watchInboxRead();
  const an = $('#activeName'); if(an) an.textContent = profile.name || 'الطالبة';
}

let state = { mode:null, subject:null, field:null, items:[], idx:0, answers:{}, hints:{}, taskSelf:{}, startTs:0, onlyWrong:false };

/* ---------- مساعدات ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const el = (t, c, h) => { const e = document.createElement(t); if(c) e.className = c; if(h!=null) e.innerHTML = h; return e; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const today = () => new Date().toISOString().slice(0,10);
const LETTERS = ['أ','ب','ج','د'];

function fieldKey(sub, f){ return sub + '|' + f.code; }
function getProg(k){ return progress[k] || { mcq:{best:0,attempts:0,correct:0}, tasks:{done:0}, last:0 }; }
function setProg(k, v){ progress[k] = v; s(K.progress, progress); }
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 2600); }
function daysBetween(a, b){ return Math.round((new Date(b) - new Date(a)) / 86400000); }

/* ---------- بناء المحتوى ---------- */
function buildBank(){
  return {
    life: { name:'علوم الحياة', short:'حياة', icon:'🧬', tone:'emerald', desc:'الخلية والجسم الحي، التصنيف والتنوع، الأنظمة البيئية، والوراثة.', fields:[F11, F12, F13, F14] },
    earth:{ name:'علوم الأرض والفضاء', short:'أرض وفضاء', icon:'🌍', tone:'sky', desc:'الكون والنظام الشمسي، النظام الأرضي، والنشاط البشري.', fields:[E31, E32, E33] }
  };
}
const BANK = buildBank();
// ربط بنك أسئلة الرسوم بكل مجال
Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
  f.figs = (typeof FIGS !== 'undefined' && FIGS[f.code]) ? FIGS[f.code] : [];
}));

/* ---------- التنقل ---------- */
function go(id){
  $$('.mainnav button').forEach(b => b.classList.toggle('active', b.dataset.sec === id));
  $$('.panel').forEach(p => p.classList.remove('show'));
  $('#sec-' + id).classList.add('show');
  window.scrollTo({ top:0, behavior:'smooth' });
  $('#mainNav').classList.remove('open');
  if(id === 'hub') renderHub();
  if(typeof checkInboxVisible === 'function') setTimeout(checkInboxVisible, 400);
  if(id === 'train') renderTrain();
  if(id === 'progress') renderProgress();
}
$$('.mainnav button').forEach(b => b.onclick = () => go(b.dataset.sec));
$('#menuBtn').onclick = () => $('#mainNav').classList.toggle('open');

/* ---------- الملف الشخصي ---------- */
function saveProfile(){
  const n = $('#pName').value.trim(), sc = $('#pSchool').value.trim();
  profile = { name:n, school:sc };
  s(K.profile, profile);
  renderProfile();
  toast('تم حفظ بياناتك ✅');
}
function renderProfile(){
  $('#pName').value = profile.name || '';
  $('#pSchool').value = profile.school || '';
  const chip = $('#userChip');
  if(profile.name){
    chip.innerHTML = '<span class="avatar">' + profile.name.trim()[0] + '</span>' + profile.name + ' • ' + (profile.school || 'بلا مدرسة');
  } else {
    chip.innerHTML = '<span class="avatar">؟</span>سجّلي اسمك';
  }
  $('#heroTitle').textContent = profile.name ? ('أهلًا يا ' + profile.name + ' 🌸') : 'أهلًا بكِ في تدريب نافس علوم 🌸';
}

/* ---------- الرئيسية ---------- */
function renderHub(){
  const att = attempts;
  const correct = att.filter(a => a.mode === 'mcq').reduce((s, a) => s + a.correct, 0);
  const answeredToday = att.filter(a => a.date === today()).reduce((s, a) => s + a.answered, 0);
  $('#msCorrect').textContent = correct;
  $('#msXp').textContent = att.reduce((s, a) => s + (a.xp || 0), 0);
  $('#msCert').textContent = att.filter(a => a.score >= 60).length;
  const p = pct(Math.min(answeredToday, goal), goal);
  $('#dayRing').style.setProperty('--p', p);
  $('#dayRingVal').textContent = p + '%';
  $('#dayGoalTxt').textContent = goal + ' أسئلة';
  $('#streakVal').textContent = streakDays();

  // المجالات
  const grid = $('#subjectsGrid'); grid.innerHTML = '';
  Object.keys(BANK).forEach(sub => {
    const b = BANK[sub];
    const fields = b.fields.map(f => getProg(fieldKey(sub, f)));
    const done = fields.reduce((s, p) => s + (p.mcq ? p.mcq.attempts : 0), 0);
    const best = fields.reduce((s, p) => s + (p.mcq ? p.mcq.best : 0), 0);
    const card = el('div', 'subj t-' + b.tone);
    card.innerHTML = '<div class="sico">' + b.icon + '</div><h3>' + b.name + '</h3><p>' + b.desc + '</p>' +
      '<div class="sbar"><i style="width:' + pct(best, 100) + '%"></i></div>' +
      '<div class="smeta"><span>' + b.fields.length + ' مجالات فرعية</span><span>أفضل نتيجة ' + best + '%</span></div>';
    card.onclick = () => { go('train'); selectSubject(sub); };
    grid.appendChild(card);
  });

  // متابعة
  const cont = $('#continueRow'); cont.innerHTML = '';
  const recent = attempts.slice().reverse().slice(0, 3);
  if(!recent.length){
    cont.innerHTML = '<div class="card"><p class="muted">لم تبدئي بعد — ابدئي باختبار في أي مجال فرعي.</p></div>';
  } else {
    recent.forEach(a => {
      const c = el('div','cont');
      c.innerHTML = '<div class="cico">' + (a.mode === 'mcq' ? '📝' : '🔎') + '</div><div><b>' + a.title + '</b><small>' + a.score + '% • ' + a.date + '</small></div>';
      c.onclick = () => { go('progress'); };
      cont.appendChild(c);
    });
  }

  // الأوسمة اليومية
  const tm = $('#todayMedals');
  if(tm){
    const dm = dailyMedalsFor(U.id);
    tm.innerHTML = dm.length ? dm.map(x => '<div class="medal-card"><div class="mc-i">' + x.i + '</div><b>' + x.n + '</b><small>' + x.d + '</small></div>').join('')
      : '<div class="empty">لم تحصد وسام اليوم بعد — ابدئي باختبار لتحصد أول وسام 🌅</div>';
  }

  // الأوسمة
  const badges = $('#badgesRow');
  const earned = medalsFor(U.id);
  const allMedals = [
    { i:'🌱', n:'البداية', d:'أول إنجاز منجز' },
    { i:'📚', n:'المجتهدة', d:'٥ محاولات أو أكثر' },
    { i:'💯', n:'التفوق', d:'اختبار بدرجة كاملة' },
    { i:'🎯', n:'الدقة العالية', d:'٩٠٪ فأكثر في اختبار' },
    { i:'🏅', n:'المتمكّنة', d:'متوسط دقة ٨٠٪ فأكثر' },
    { i:'🖼️', n:'قارئة الأشكال', d:'أنجزتِ أسئلة الرسوم' },
    { i:'✍️', n:'المخطّطة', d:'٥ مهام مؤشر' },
    { i:'🧠', n:'الشارحة', d:'١٥ مهمة مؤشر' },
    { i:'🔥', n:'المواظبة', d:'٣ أيام متتالية' },
    { i:'👑', n:'السيطرة', d:'ستة أوسمة فأكثر' }
  ];
  badges.innerHTML = '';
  allMedals.forEach(md => {
    const got = earned.some(x => x.n === md.n);
    badges.appendChild(el('div', 'badge' + (got ? ' on' : ''),
      '<div class="bico">' + md.i + '</div><b>' + md.n + '</b><small>' + (got ? 'مكتسبة' : md.d) + '</small>'));
  });

  // رسالة ولي الأمر
  const pm = $('#parentMsg');
  if(messages.length){
    const m = messages[messages.length - 1];
    pm.hidden = false;
    pm.innerHTML = '💌 <b>رسالة من ولي الأمر:</b> ' + m.text;
  } else pm.hidden = true;
  renderInbox();
  renderBell();
}
function streakDays(){
  const days = [...new Set(attempts.map(a => a.date))].sort().reverse();
  if(!days.length) return 0;
  let streak = 1;
  for(let i = 0; i < days.length - 1; i++){
    if(daysBetween(days[i+1], days[i]) === 1) streak++; else break;
  }
  return days[0] === today() ? streak : streak;
}

/* ---------- التدريب ---------- */
let curSubject = 'life';
function selectSubject(sub){ curSubject = sub; renderTrain(); }
function renderTrain(){
  const tabs = $('#subjectTabs'); tabs.innerHTML = '';
  Object.keys(BANK).forEach(k => {
    const b = BANK[k];
    const btn = el('button', 'stab' + (k === curSubject ? ' active' : ''), b.icon + ' ' + b.name);
    btn.onclick = () => { curSubject = k; renderTrain(); };
    tabs.appendChild(btn);
  });
  const b = BANK[curSubject];
  const box = $('#chaptersBox'); box.innerHTML = '';
  const head = el('div','ind');
  head.innerHTML = '<h4><svg><use href="#i-flag"/></svg> المجال: ' + b.name + '</h4><p>' + b.desc + '</p>';
  box.appendChild(head);

  const grid = el('div','chapters-grid');
  b.fields.forEach(f => {
    const p = getProg(fieldKey(curSubject, f));
    const card = el('div','chap');
    const tDone = p.tasks ? p.tasks.done : 0;
    const at = attempts.filter(a => a.subject === curSubject && a.field === f.code && a.mode === 'mcq');
    const figAt = attempts.filter(a => a.subject === curSubject && a.field === f.code && a.mode === 'fig');
    const figBest = figAt.reduce((m, a) => Math.max(m, a.score), 0);
    card.innerHTML =
      '<div class="chap-top"><h4>' + f.title + '</h4><span class="code">' + f.code + '</span></div>' +
      '<div class="pbar"><i style="width:' + pct(Math.max(p.mcq.best, figBest), 100) + '%"></i></div>' +
      '<div class="pfoot"><span>أفضل نتيجة: ' + p.mcq.best + '%</span><span>محاولات: ' + at.length + '</span><span>مهام: ' + tDone + '/' + f.tasks.length + '</span></div>' +
      '<div class="chap-acts">' +
        '<button class="btn btn-primary btn-sm" data-a="mcq">📝 اختبار (10 أسئلة)</button>' +
        '<button class="btn btn-soft btn-sm" data-a="tasks">🔎 مهام المؤشر (5)</button>' +
        (f.figs.length ? '<button class="btn btn-ghost btn-sm" data-a="figs">🖼️ الرسوم (' + f.figs.length + ')</button>' : '') +
      '</div>';
    const ind = el('details');
    ind.style.marginTop = '4px';
    ind.innerHTML = '<summary style="cursor:pointer;font-size:13px;color:var(--muted)">المؤشر وناتج التعلم</summary>' +
      '<div class="ind" style="margin-top:8px"><p class="out"><b>ناتج التعلم:</b> ' + f.out + '</p>' +
      '<ul class="indlist">' + f.ind.map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
    card.appendChild(ind);
    card.querySelectorAll('[data-a]').forEach(btn => {
      btn.onclick = () => {
        const a = btn.dataset.a;
        if (a === 'mcq') startMCQ(curSubject, f);
        else if (a === 'tasks') startTasks(curSubject, f);
        else openFigSets(curSubject, f);
      };
    });
    grid.appendChild(card);
  });
  box.appendChild(grid);
}

/* ---------- اختبار اختيار من متعدد ---------- */
function showQuiz(){ const q = document.getElementById('quizBox'); if(q) q.hidden = false; }

function startMCQ(sub, f, onlyWrong){
  showQuiz();
  state.mode = 'mcq'; state.subject = sub; state.field = f;
  state.items = f.mcq.map((q, i) => Object.assign({}, q, { i }));
  if(onlyWrong && state.wrongIds){
    const w = state.items.filter(q => state.wrongIds.indexOf(q.i) > -1);
    if(w.length) state.items = w;
  }
  state.onlyWrong = !!onlyWrong;
  state.idx = 0; state.answers = {}; state.hints = {}; state.startTs = Date.now();
  renderQuiz();
  $('#quizBox').scrollIntoView({ behavior:'smooth', block:'start' });
}
function renderQuiz(){
  const f = state.field;
  const total = state.items.length;
  const answered = Object.keys(state.answers).length;
  const correct = state.items.filter(q => state.answers[q.i] === q.a).length;
  const box = $('#quizBox');
  const q = state.items[state.idx];
  const answeredThis = state.answers[q.i] !== undefined;
  const isRight = answeredThis && state.answers[q.i] === q.a;

  let html = '<div class="quiz-head"><div class="qh-top"><h3>' + (state.onlyWrong ? '🔄 إعادة الأسئلة الخاطئة — ' : '') + f.title + '</h3>' +
    '<div class="qh-stats">' +
      '<span class="pill"><svg><use href="#i-check"/></svg> صحيح: ' + correct + '</span>' +
      '<span class="pill">تمت الإجابة: ' + answered + '/' + total + '</span>' +
      '<span class="pill tip">⏱ ' + (state.mode === 'mcq' ? 'بلا وقت محدد' : '') + '</span>' +
    '</div></div>' +
    '<div class="pbar"><i style="width:' + pct(answered, total) + '%"></i></div>' +
    '<div class="qnav">' + state.items.map((x, i) => {
      const st = state.answers[x.i] === undefined ? '' : (state.answers[x.i] === x.a ? ' done' : ' err');
      return '<button class="qdot' + st + (i === state.idx ? ' cur' : '') + '" data-go="' + i + '">' + (x.i + 1) + '</button>';
    }).join('') + '</div></div>';

  // بطاقة السؤال
  html += '<div class="qcard"><div class="qnum">السؤال ' + (state.idx + 1) + ' من ' + total + ' — المجال ' + f.code + '</div>' +
    '<div class="qtext">' + q.q + '</div>' +
    '<div class="opts">' + q.o.map((o, j) => {
      let cls = 'opt';
      if(answeredThis){
        cls += ' locked';
        if(j === q.a) cls += ' correct';
        else if(j === state.answers[q.i]) cls += ' wrong';
      }
      return '<button class="' + cls + '" data-pick="' + j + '"><span class="ol">' + LETTERS[j] + '</span><span>' + o + '</span></button>';
    }).join('') + '</div>';

  // التلميحات
  const hUsed = state.hints[q.i] || 0;
  if(hUsed > 0){
    html += '<div class="hintbox"><b>💡 تلميح ' + hUsed + ':</b> ' + (hUsed === 1 ? q.h1 : q.h1 + ' ' + q.h2) + '</div>';
  }
  if(!answeredThis){
    html += '<div class="qfoot">' +
      (hUsed < 1 ? '<button class="btn btn-soft" data-hint="1">💡 أظهِلي تلميحا</button>' : '') +
      (hUsed < 2 ? '<button class="btn btn-soft" data-hint="2">💡 تلميح إضافي</button>' : '') +
      '<button class="btn btn-ghost" data-skip="1">تخطي السؤال</button>' +
      '</div>';
  } else {
    html += '<div class="feedback ' + (isRight ? 'ok' : 'bad') + '">' +
      (isRight ? '✅ إجابة صحيحة، أحسنتِ! ' : '❌ إجابة غير صحيحة. الصواب: <b>' + LETTERS[q.a] + '</b> — ' + q.o[q.a]) +
      '<div class="enrich"><b>📖 شرح وثراء:</b> ' + q.tip + '</div></div>';
    if(!isRight){
      html += '<div class="qfoot"><button class="btn btn-soft" data-retry="1">🔄 أعيدي محاولة هذا السؤال</button></div>';
    }
    html += '<div class="qfoot">' +
      (state.idx > 0 ? '<button class="btn btn-back" data-nav="-1">السابق</button>' : '') +
      (state.idx < total - 1 ? '<button class="btn btn-primary" data-nav="1">التالي ➜</button>' : '') +
      '<button class="btn btn-ghost" data-finish="1">🏁 عرض النتيجة</button>' +
      '</div>';
  }
  box.innerHTML = html;

  box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => pick(+b.dataset.pick));
  box.querySelectorAll('[data-hint]').forEach(b => b.onclick = () => { state.hints[q.i] = +b.dataset.hint; renderQuiz(); });
  box.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => { next(); });
  box.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { state.idx = Math.max(0, Math.min(total - 1, state.idx + +b.dataset.nav)); renderQuiz(); });
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { state.idx = +b.dataset.go; renderQuiz(); });
  box.querySelectorAll('[data-retry]').forEach(b => b.onclick = () => { delete state.answers[q.i]; renderQuiz(); });
  box.querySelectorAll('[data-finish]').forEach(b => b.onclick = () => finishMCQ());
}
function pick(j){
  const q = state.items[state.idx];
  if(state.answers[q.i] !== undefined) return;
  state.answers[q.i] = j;
  renderQuiz();
}
function next(){
  if(state.idx < state.items.length - 1){ state.idx++; renderQuiz(); } else finishMCQ();
}
function finishMCQ(){
  const f = state.field, sub = state.subject;
  const total = state.items.length;
  const correct = state.items.filter(q => state.answers[q.i] === q.a).length;
  const score = pct(correct, total);
  const wrongIds = state.items.filter(q => state.answers[q.i] !== q.a).map(q => q.i);
  const hintsUsed = Object.keys(state.hints).length;

  const k = fieldKey(sub, f);
  const p = getProg(k);
  p.mcq = p.mcq || { best:0, attempts:0, correct:0 };
  p.mcq.attempts++;
  p.mcq.best = Math.max(p.mcq.best, score);
  p.mcq.correct = (p.mcq.correct || 0) + correct;
  p.last = Date.now();
  setProg(k, p);

  attempts.push({
    mode:'mcq', subject:sub, field:f.code, title:f.title, score, correct, total,
    answered: Object.keys(state.answers).length, hints:hintsUsed, retry:!!state.onlyWrong,
    wrong:wrongIds, attemptNo:p.mcq.attempts,
    date: today(), time:new Date().toLocaleTimeString('ar-SA'),
    xp: correct * 10 + (score >= 80 ? 20 : 0)
  });
  s(K.attempts, attempts);
  syncPushSoon();

  const msg = score >= 90 ? 'ممتاز 🌟 نتيجة رائعة، أنتِ جاهزة للاختبار الحقيقي.'
            : score >= 75 ? 'رائع جدا 👏 استمري على هذا المنوال!'
            : score >= 60 ? 'جيد 💡 راجعي التلميحات والإثراء ثم أعيدي المحاولة.'
            : 'لا بأس 💪 راجعي قسم الإثراء، والتدريبات الفردية تساعدكِ أكثر.';
  let html = '<div class="result"><h2>' + (score >= 60 ? '🎉 أحسنتِ!' : '📝 لندرس معاً') + '</h2>' +
    '<div class="big">' + score + '%</div>' +
    '<p>الإجابات الصحيحة: <b>' + correct + '</b> من ' + total + ' • المحاولة رقم ' + p.mcq.attempts + ' • أفضل نتيجة ' + p.mcq.best + '% • تلميحات: ' + hintsUsed + '</p>' +
    '<div class="why"><b>💡 كيف أقرأ نتيجتي؟</b><br>' + msg + '</div>' +
    '<div class="qfoot" style="justify-content:center">' +
      (wrongIds.length ? '<button class="btn btn-soft" data-retrywrong="1">🔄 إعادة الأسئلة الخاطئة (' + wrongIds.length + ')</button>' : '') +
      (score < 80 ? '<button class="btn btn-soft" data-plan="1">📋 خطتي العلاجية</button>' : '') +
      '<button class="btn btn-primary" data-again="1">🔁 إعادة الاختبار كاملاً</button>' +
      '<button class="btn btn-ghost" data-cert="1">🎓 شهادة الإنجاز</button>' +
      '<button class="btn btn-back" data-back="1">رجوع للمجالات</button>' +
    '</div></div>';

  // مراجعة
  html += '<div class="card"><h3>📋 مراجعة الإجابات</h3>' + state.items.map(q => {
    const a = state.answers[q.i];
    const ok = a === q.a;
    return '<div class="review-row ' + (ok ? 'ok' : 'bad') + '"><div class="rq">' + (q.i + 1) + ') ' + q.q + '</div>' +
      '<div class="rr">' + (a === undefined ? 'لم تجيبي' : 'إجابتك: ' + q.o[a]) + ' | الصواب: ' + q.o[q.a] + '</div>' +
      '<div class="rr" style="color:var(--ink2);margin-top:5px">💡 ' + q.tip + '</div></div>';
  }).join('') + '</div>';

  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-retrywrong]').forEach(b => b.onclick = () => { state.wrongIds = wrongIds; startMCQ(sub, f, true); });
  $('#quizBox').querySelectorAll('[data-again]').forEach(b => b.onclick = () => startMCQ(sub, f));
  $('#quizBox').querySelectorAll('[data-plan]').forEach(b => b.onclick = () => showPlan(sub, f));
  $('#quizBox').querySelectorAll('[data-cert]').forEach(b => b.onclick = () => showCert(f.title, score, correct, total));
  $('#quizBox').querySelectorAll('[data-back]').forEach(b => b.onclick = () => { go('train'); });
  renderHub();
  setTimeout(() => showCert(f.title, score, correct, total), 450);
}

/* ---------- بنك أسئلة الرسوم ---------- */
function figChunks(f){ return Math.ceil(f.figs.length / 10); }
function openFigSets(sub, f){
  go('train');
  showQuiz();
  const chunks = figChunks(f);
  let html = '<div class="quiz-head"><div class="qh-top"><h3>🖼️ أسئلة الرسوم والأشكال — ' + f.title + '</h3>' +
    '<span class="pill">' + f.figs.length + ' سؤالاً</span></div>' +
    '<p class="muted" style="margin:6px 0 0">مقاطع أصلية من كتاب نافس، تشمل أسئلة الأشكال والجداول. اختاري مجموعة للبدء.</p></div>';
  html += '<div class="figsets">';
  for(let c = 0; c < chunks; c++){
    const n = Math.min(10, f.figs.length - c * 10);
    html += '<button class="figset" data-set="' + c + '"><b>المجموعة ' + (c + 1) + '</b><span>' + n + ' أسئلة</span></button>';
  }
  html += '</div>';
  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-set]').forEach(b => b.onclick = () => startFigs(sub, f, +b.dataset.set));
  $('#quizBox').scrollIntoView({ behavior:'smooth', block:'start' });
}
function startFigs(sub, f, chunk, override){
  showQuiz();
  state.mode = 'fig'; state.subject = sub; state.field = f; state.figChunk = chunk;
  const all = f.figs.map((x, i) => Object.assign({}, x, { i }));
  state.figAll = all;
  state.items = override || all.slice(chunk * 10, chunk * 10 + 10);
  state.idx = 0; state.answers = {}; state.hints = {}; state.startTs = Date.now();
  state.onlyWrong = !!override;
  renderFigQuiz();
  $('#quizBox').scrollIntoView({ behavior:'smooth', block:'start' });
}
function renderFigQuiz(){
  const f = state.field, total = state.items.length, q = state.items[state.idx];
  const answered = Object.keys(state.answers).length;
  const correct = state.items.filter(x => state.answers[x.i] === x.a).length;
  const done = state.answers[q.i] !== undefined;
  const ok = done && state.answers[q.i] === q.a;
  let html = '<div class="quiz-head"><div class="qh-top"><h3>🖼️ ' + f.title + ' — الرسوم</h3>' +
    '<div class="qh-stats"><span class="pill"><svg><use href="#i-check"/></svg> صحيح: ' + correct + '</span>' +
    '<span class="pill">تمت: ' + answered + '/' + total + '</span>' +
    '<span class="pill tip">من النموذج الرسمي</span></div></div>' +
    '<div class="pbar"><i style="width:' + pct(answered, total) + '%"></i></div>' +
    '<div class="qnav">' + state.items.map((x, i) => {
      const st = state.answers[x.i] === undefined ? '' : (state.answers[x.i] === x.a ? ' done' : ' err');
      return '<button class="qdot' + st + (i === state.idx ? ' cur' : '') + '" data-go="' + i + '">' + (i + 1) + '</button>';
    }).join('') + '</div></div>';

  html += '<div class="qcard"><div class="qnum">سؤال الشكل ' + (state.idx + 1) + ' من ' + total + ' — المجال ' + f.code + '</div>' +
    '<img class="figimg" src="' + q.img + '" alt="سؤال رسم من نافس" data-zoom="' + q.img + '">' +
    '<p class="muted" style="margin:8px 0 0;font-size:13px">اضغطي على الصورة لتكبيرها، ثم اختاري الحرف الصحيح.</p>' +
    '<div class="figopts">' + ['أ','ب','ج','د'].map((L, j) => {
      let cls = 'figopt';
      if(done){ cls += ' locked'; if(j === q.a) cls += ' correct'; else if(j === state.answers[q.i]) cls += ' wrong'; }
      return '<button class="' + cls + '" data-pick="' + j + '">' + L + '</button>';
    }).join('') + '</div>';
  if(done){
    html += '<div class="feedback ' + (ok ? 'ok' : 'bad') + '">' +
      (ok ? '✅ إجابة صحيحة، أحسنتِ! ' : '❌ إجابة غير صحيحة. الصواب: <b>' + ['أ','ب','ج','د'][q.a] + '</b>') +
      '<div class="enrich"><b>💡 كيف تقرأين سؤال الشكل؟</b> ابدئي بالشكل: ما الذي يوضحه؟ ثم اقرئي السؤال، واستبعدي الخيارات غير المنطقية قبل الاختيار.</div></div>';
    if(!ok) html += '<div class="qfoot"><button class="btn btn-soft" data-retry="1">🔄 أعيدي محاولة هذا السؤال</button></div>';
    html += '<div class="qfoot">' +
      (state.idx > 0 ? '<button class="btn btn-back" data-nav="-1">السابق</button>' : '') +
      (state.idx < total - 1 ? '<button class="btn btn-primary" data-nav="1">التالي ➜</button>' : '') +
      '<button class="btn btn-ghost" data-finish="1">🏁 عرض النتيجة</button></div>';
  }
  html += '</div>';
  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    if(state.answers[q.i] !== undefined) return;
    state.answers[q.i] = +b.dataset.pick; renderFigQuiz();
  });
  $('#quizBox').querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    state.idx = Math.max(0, Math.min(total - 1, state.idx + +b.dataset.nav)); renderFigQuiz();
  });
  $('#quizBox').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { state.idx = +b.dataset.go; renderFigQuiz(); });
  $('#quizBox').querySelectorAll('[data-retry]').forEach(b => b.onclick = () => { delete state.answers[q.i]; renderFigQuiz(); });
  $('#quizBox').querySelectorAll('[data-finish]').forEach(b => b.onclick = () => finishFigs());
  $('#quizBox').querySelectorAll('[data-zoom]').forEach(img => img.onclick = () => {
    $('#modalBox').innerHTML = '<img src="' + img.dataset.zoom + '" style="width:100%;border-radius:12px">' +
      '<div class="qfoot" style="justify-content:center"><button class="btn btn-primary" onclick="document.getElementById(\'modal\').hidden=true">إغلاق</button></div>';
    $('#modal').hidden = false;
  });
}
function finishFigs(){
  const f = state.field, sub = state.subject, total = state.items.length;
  const correct = state.items.filter(q => state.answers[q.i] === q.a).length;
  const score = pct(correct, total);
  const wrongIds = state.items.filter(q => state.answers[q.i] !== q.a).map(q => q.i);
  const k = fieldKey(sub, f), p = getProg(k);
  p.fig = p.fig || { best:0, attempts:0 };
  p.fig.attempts++; p.fig.best = Math.max(p.fig.best, score); p.last = Date.now();
  setProg(k, p);
  attempts.push({ mode:'fig', subject:sub, field:f.code, title:f.title + ' — الرسوم (م' + (state.figChunk + 1) + ')',
    score, correct, total, answered:Object.keys(state.answers).length, hints:0, retry:!!state.onlyWrong,
    wrong:wrongIds, date:today(), time:new Date().toLocaleTimeString('ar-SA'), xp: correct * 10 });
  s(K.attempts, attempts);
  syncPushSoon();
  let html = '<div class="result"><h2>' + (score >= 60 ? '🎉 أحسنتِ في أسئلة الرسوم!' : '📘 راجعي الأشكال معاً') + '</h2>' +
    '<div class="big">' + score + '%</div>' +
    '<p>الإجابات الصحيحة: <b>' + correct + '</b> من ' + total + ' • المحاولة رقم ' + p.fig.attempts + ' • أفضل نتيجة ' + p.fig.best + '%</p>' +
    '<div class="why"><b>💡 خطة سريعة:</b> أسئلة الشكل تحتاج قراءة الصورة أولاً: ما العنوان؟ ما المحور؟ ما المقصود بالسهم؟ ثم اقرئي السؤال واستبعدي الخيارات.</div>' +
    '<div class="qfoot" style="justify-content:center">' +
      (wrongIds.length ? '<button class="btn btn-soft" data-wrong="1">🔄 أعيدي الأسئلة الخاطئة (' + wrongIds.length + ')</button>' : '') +
      '<button class="btn btn-primary" data-again="1">🔁 إعادة المجموعة كاملة</button>' +
      '<button class="btn btn-ghost" data-cert="1">🎓 شهادة</button>' +
      '<button class="btn btn-back" data-back="1">رجوع للمجالات</button></div></div>';
  html += '<div class="card"><h3>🖼️ مراجعة أسئلة الشكل</h3>' + state.items.map(q => {
    const a = state.answers[q.i], okk = a === q.a;
    return '<div class="review-row ' + (okk ? 'ok' : 'bad') + '"><div class="rq">' + (state.items.indexOf(q) + 1) + ') ' + (okk ? 'إجابة صحيحة ✅' : (a === undefined ? 'لم تجيبي' : 'إجابتك: ' + ['أ','ب','ج','د'][a])) + (okk ? '' : ' — الصواب: ' + ['أ','ب','ج','د'][q.a]) + '</div>' +
      '<img src="' + q.img + '" style="width:100%;max-width:420px;border-radius:10px;border:1px solid var(--line);margin-top:6px" data-zoom="' + q.img + '">' +
      '<div class="rr">صفحة ' + q.p + ' — سؤال ' + q.n + ' في كتاب نافس</div></div>';
  }).join('') + '</div>';
  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-wrong]').forEach(b => b.onclick = () => {
    const items = state.figAll.filter(x => wrongIds.indexOf(x.i) > -1);
    startFigs(sub, f, state.figChunk, items);
  });
  $('#quizBox').querySelectorAll('[data-again]').forEach(b => b.onclick = () => startFigs(sub, f, state.figChunk));
  $('#quizBox').querySelectorAll('[data-cert]').forEach(b => b.onclick = () => showCert(f.title + ' — الرسوم', score, correct, total));
  $('#quizBox').querySelectorAll('[data-back]').forEach(b => b.onclick = () => go('train'));
  setTimeout(() => showCert(f.title + ' — الرسوم', score, correct, total), 450);
  $('#quizBox').querySelectorAll('[data-zoom]').forEach(img => img.onclick = () => {
    $('#modalBox').innerHTML = '<img src="' + img.dataset.zoom + '" style="width:100%;border-radius:12px">';
    $('#modal').hidden = false;
  });
  renderHub();
}

/* ---------- مهام المؤشر ---------- */
function startTasks(sub, f){
  showQuiz();
  state.mode = 'tasks'; state.subject = sub; state.field = f;
  state.items = f.tasks.map((t, i) => Object.assign({}, t, { i }));
  state.idx = 0; state.taskSelf = {}; state.answers = {}; state.hints = {};
  renderTasks();
  $('#quizBox').scrollIntoView({ behavior:'smooth', block:'start' });
}
function renderTasks(){
  const f = state.field, t = state.items[state.idx], total = state.items.length;
  const done = Object.keys(state.taskSelf).filter(k => ['ok','part','no'].indexOf(state.taskSelf[k]) > -1).length;
  let html = '<div class="quiz-head"><div class="qh-top"><h3>🔎 مهام المؤشر — ' + f.title + '</h3>' +
    '<div class="qh-stats"><span class="pill">تمت المهمة: ' + done + '/' + total + '</span>' +
    '<span class="pill tip">المؤشر: ' + f.code + '</span></div></div>' +
    '<div class="pbar"><i style="width:' + pct(done, total) + '%"></i></div>' +
    '<div class="qnav">' + state.items.map((x, i) => {
      const st = state.taskSelf[x.i] === undefined ? '' : (state.taskSelf[x.i] === 'ok' ? ' done' : ' err');
      return '<button class="qdot' + st + (i === state.idx ? ' cur' : '') + '" data-go="' + i + '">' + (x.i + 1) + '</button>';
    }).join('') + '</div></div>';

  html += '<div class="qcard"><div class="qnum">المهمة ' + (state.idx + 1) + ' من ' + total + '</div>' +
    '<div class="ind"><h4><svg><use href="#i-target"/></svg> المؤشر</h4><p>' + t.ind + '</p>' +
    '<p class="out"><b>ناتج التعلم:</b> ' + t.out + '</p></div>' +
    '<div class="qtext">' + t.q + '</div>' +
    '<div class="taskbox"><h4>🪜 خطوات الحل (اقرأها بهدوء)</h4><ol>' + t.steps.map(s => '<li>' + s + '</li>').join('') + '</ol></div>';

  if(state.taskSelf[t.i] === undefined){
    html += '<div class="qfoot"><button class="btn btn-soft" data-show="1">👀 أظهر لي الإجابة النموذجية</button></div>';
  } else {
    html += '<div class="taskbox" style="border-color:var(--emerald)"><h4>✅ الإجابة النموذجية</h4><div class="model">' + t.ans + '</div></div>' +
      '<div class="qfoot"><span style="font-weight:700">قيّمي إجابتك:</span>' +
      '<button class="btn btn-primary" data-self="ok">فهمت إجابتي صحيحة ✅</button>' +
      '<button class="btn btn-ghost" data-self="part">فهمت جزئيا 🤔</button>' +
      '<button class="btn btn-ghost" data-self="no">لم أفهم ❌</button></div>';
    if(state.taskSelf[t.i]){
      html += '<div class="feedback ' + (state.taskSelf[t.i] === 'ok' ? 'ok' : 'bad') + '">' +
        (state.taskSelf[t.i] === 'ok' ? 'رائع! فهمتِ المؤشر وتحققتِ من إجابتك بنفسك. 👏'
          : state.taskSelf[t.i] === 'part' ? 'جيد، لكن ارجعي للخطوات مرة ثانية وركّزي على الجزء غير الواضح.'
          : 'لا بأس، اقرئي الخطوات مرة ثانية بهدوء، ثم اطلبي المساعدة من معلمتك. 💪') + '</div>';
    }
    html += '<div class="qfoot">' +
      (state.idx > 0 ? '<button class="btn btn-back" data-nav="-1">السابق</button>' : '') +
      (state.idx < total - 1 ? '<button class="btn btn-primary" data-nav="1">التالي ➜</button>' : '<button class="btn btn-primary" data-finish="1">🏁 إنهاء المهام</button>') +
      '</div>';
  }
  html += '</div>';
  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-show]').forEach(b => b.onclick = () => { state.taskSelf[t.i] = 'shown'; renderTasks(); });
  $('#quizBox').querySelectorAll('[data-self]').forEach(b => b.onclick = () => { state.taskSelf[t.i] = b.dataset.self; renderTasks(); });
  $('#quizBox').querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { state.idx = Math.max(0, Math.min(total - 1, state.idx + +b.dataset.nav)); renderTasks(); });
  $('#quizBox').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { state.idx = +b.dataset.go; renderTasks(); });
  $('#quizBox').querySelectorAll('[data-finish]').forEach(b => b.onclick = () => finishTasks());
}
function finishTasks(){
  const f = state.field, sub = state.subject, total = state.items.length;
  const ok = state.items.filter(t => state.taskSelf[t.i] === 'ok').length;
  const part = state.items.filter(t => state.taskSelf[t.i] === 'part').length;
  const no = state.items.filter(t => state.taskSelf[t.i] === 'no' || state.taskSelf[t.i] === 'shown' || state.taskSelf[t.i] === undefined).length;
  const score = pct(ok, total);
  const k = fieldKey(sub, f);
  const p = getProg(k);
  p.tasks = p.tasks || { done:0 };
  p.tasks.done = Math.max(p.tasks.done, ok);
  p.last = Date.now();
  setProg(k, p);
  attempts.push({ mode:'tasks', subject:sub, field:f.code, title:f.title + ' (مهام مؤشر)', score, correct:ok, total, answered:ok + part + no, hints:0, retry:false, date:today(), time:new Date().toLocaleTimeString('ar-SA'), xp: ok * 15 });
  s(K.attempts, attempts);
  syncPushSoon();
  const html = '<div class="result"><h2>' + (score >= 60 ? '🎉 أداء رائع في مهام المؤشر' : '📘 خلينا نراجع معاً') + '</h2>' +
    '<div class="big">' + score + '%</div>' +
    '<p>مهام أتقنتِها: <b>' + ok + '</b> • جزئية: ' + part + ' • تحتاج مراجعة: ' + no + '</p>' +
    '<div class="why"><b>💡 ماذا يعني هذا؟</b><br>مهام المؤشر تطلب منك الفهم والشرح، وليست اختياراً فقط. عندما تستطيعين شرح الإجابة بكلماتك أنتِ فأنتِ أتقنتِ المؤشر فعلاً.</div>' +
    '<div class="qfoot" style="justify-content:center"><button class="btn btn-primary" data-again="1">🔁 إعادة المهام</button>' +
    '<button class="btn btn-ghost" data-cert="1">🎓 شهادة الإنجاز</button>' +
    '<button class="btn btn-back" data-back="1">رجوع للمجالات</button></div></div>';
  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-again]').forEach(b => b.onclick = () => startTasks(sub, f));
  $('#quizBox').querySelectorAll('[data-cert]').forEach(b => b.onclick = () => showCert(f.title + ' (مهام مؤشر)', score, ok, total));
  $('#quizBox').querySelectorAll('[data-back]').forEach(b => b.onclick = () => go('train'));
  renderHub();
  setTimeout(() => showCert(f.title + ' (مهام مؤشر)', score, ok, total), 450);
}

/* ---------- الخطط العلاجية ---------- */
function fieldAttempts(sub, f, mode){
  return attempts.filter(a => a.subject === sub && a.field === f.code && a.mode === (mode || 'mcq'));
}
function lastWrong(sub, f){
  const at = fieldAttempts(sub, f, 'mcq');
  for(let i = at.length - 1; i >= 0; i--){
    if(at[i].wrong && at[i].wrong.length) return at[i].wrong;
  }
  return [];
}
function planTargets(f, wrong){
  const set = {};
  wrong.forEach(i => { const q = f.mcq[i]; if(q && q.k !== undefined) set[q.k] = 1; });
  return Object.keys(set).map(k => f.ind[+k]).filter(Boolean);
}
function planDays(k){
  const p = getProg(k);
  if(!p.days) p.days = [false, false, false];
  return p.days;
}
function togglePlanDay(k, i){
  const p = getProg(k);
  if(!p.days) p.days = [false, false, false];
  p.days[i] = !p.days[i];
  setProg(k, p);
  renderProgress();
  const trainVisible = document.getElementById('sec-train').classList.contains('show');
  if(state.mode === 'plan' && trainVisible) showPlan(state.subject, state.field);
}
function planStatus(sub, f){
  const at = fieldAttempts(sub, f, 'mcq');
  const p = getProg(fieldKey(sub, f));
  const best = p.mcq.best;
  if(!at.length) return { label:'لم تبدأ', cls:'r', best:0, last:0 };
  const last = at[at.length - 1].score;
  if(last >= 80) return { label:'متقنة في آخر محاولة', cls:'g', best, last };
  if(last >= 60) return { label:'جيدة — تحتاج تثبيت', cls:'a', best, last };
  return { label:'تحتاج خطة علاجية', cls:'r', best, last };
}
function planHTML(sub, f, compact){
  const k = fieldKey(sub, f);
  const p = getProg(k);
  const wrong = lastWrong(sub, f);
  const targets = planTargets(f, wrong);
  const days = planDays(k);
  const at = fieldAttempts(sub, f, 'mcq');
  const last = at.length ? at[at.length - 1] : null;
  const st = planStatus(sub, f);
  let html = '<div class="plan-card">' +
    '<div class="plan-head"><div><b>' + f.code + ' — ' + f.title + '</b><small>أفضل نتيجة: ' + p.mcq.best + '% • محاولات: ' + at.length + ' • ' + st.label + '</small></div>' +
    '<span class="tag-s">' + (last ? 'آخر محاولة ' + last.score + '%' : 'لم تبدئي') + '</span></div>';

  html += '<div class="plan-block"><b>🎯 المؤشرات المستهدفة</b>' +
    (targets.length ? '<ul>' + targets.map(t => '<li>' + t + '</li>').join('') + '</ul>'
      : '<p class="muted" style="margin:4px 0">' + (at.length ? 'أداؤك جيد في هذا المجال — راجعي المؤشرات التالية للتثبيت:' : 'لم تبدئي بعد. نبدأ بمراجعة مؤشرات المجال:') + '</p><ul>' + f.ind.slice(0, 3).map(t => '<li>' + t + '</li>').join('') + '</ul>') +
    '</div>';

  if(wrong.length){
    html += '<div class="plan-block"><b>✍️ أسئلة أخطأتِ فيها</b><div class="wrongq">' +
      wrong.slice(0, 10).map(i => '<span>' + (i + 1) + '</span>').join('') + '</div>' +
      '<p class="muted" style="margin:6px 0 0">أعيدي حل هذه الأسئلة بعد قراءة الشرح، ثم أعيدي الاختبار كاملاً.</p></div>';
  }

  html += '<div class="plan-block"><b>🪜 خطوات الخطة</b><ol class="plan-steps">' +
    '<li>اقرئي المؤشر وناتج التعلم للمجال بتمعن.</li>' +
    '<li>راجعي شرح الإجابة لكل سؤال أخطأتِ فيه.</li>' +
    '<li>حلّي «مهام المؤشر» الثلاث الأولى بصوت مسموع.</li>' +
    '<li>أعيدي الاختبار واستهدفي نتيجة أعلى بـ 10 درجات.</li>' +
    '<li>سجّلي إنجازك في لوحة ولي الأمر.</li></ol></div>';

  html += '<div class="plan-block"><b>📅 متابعة ثلاثة أيام</b><div class="plan-days">' +
    ['اليوم 1: مراجعة المؤشر + سؤالان', 'اليوم 2: مهمة مؤشر + أسئلة الرسوم', 'اليوم 3: إعادة الاختبار'].map((t, i) =>
      '<label class="plan-day' + (days[i] ? ' done' : '') + '"><input type="checkbox" ' + (days[i] ? 'checked' : '') + ' data-day="' + i + '"><span>' + t + '</span></label>').join('') +
    '</div></div>';

  if(!compact){
    html += '<div class="qfoot">' +
      '<button class="btn btn-primary btn-sm" data-act="start">📝 ابدئي الاختبار</button>' +
      (wrong.length ? '<button class="btn btn-soft btn-sm" data-act="wrong">🔄 الأسئلة الخاطئة</button>' : '') +
      '<button class="btn btn-ghost btn-sm" data-act="print">🖨️ طباعة الخطة</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="back">رجوع</button></div>';
  } else {
    html += '<div class="qfoot">' +
      '<button class="btn btn-soft btn-sm" data-act="open">📋 عرض الخطة كاملة</button>' +
      '<button class="btn btn-primary btn-sm" data-act="start">📝 إعادة الاختبار</button></div>';
  }
  html += '</div>';
  return html;
}
function bindPlan(container, sub, f){
  const k = fieldKey(sub, f);
  container.querySelectorAll('[data-day]').forEach(cb => cb.onchange = () => togglePlanDay(k, +cb.dataset.day));
  container.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if(a === 'start') startMCQ(sub, f);
    else if(a === 'open') showPlan(sub, f);
    else if(a === 'wrong'){
      const w = lastWrong(sub, f);
      if(w.length){ state.wrongIds = w; startMCQ(sub, f, true); } else toast('لا توجد أسئلة خاطئة محفوظة');
    }
    else if(a === 'print') printPlan(sub, f);
    else go('progress');
  });
}
function showPlan(sub, f){
  state.mode = 'plan'; state.subject = sub; state.field = f;
  go('train');
  showQuiz();
  $('#quizBox').innerHTML = '<div class="quiz-head"><div class="qh-top"><h3>📋 الخطة العلاجية — ' + f.title + '</h3>' +
    '<span class="pill">' + f.code + '</span></div></div>' + planHTML(sub, f);
  bindPlan($('#quizBox'), sub, f);
  $('#quizBox').scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ---------- التقرير الشامل والطباعة ---------- */
function buildReport(){
  const name = profile.name || 'الطالبة', school = profile.school || 'لم تسجل المدرسة';
  const mcq = attempts.filter(a => a.mode === 'mcq');
  const totalQ = mcq.reduce((s, a) => s + a.total, 0);
  const totalC = mcq.reduce((s, a) => s + a.correct, 0);
  const avg = pct(totalC, totalQ);
  const rows = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const k = fieldKey(sub, f), p = getProg(k);
    const at = fieldAttempts(sub, f, 'mcq'), ft = fieldAttempts(sub, f, 'fig');
    const figBest = ft.reduce((m, a) => Math.max(m, a.score), 0);
    const figLatest = ft.length ? ft[ft.length - 1].score : 0;
    const ls = at.length ? at[at.length - 1].score : 0;
    const st = !at.length ? 'لم تبدأ' : (ls >= 80 ? 'متقنة' : (ls >= 60 ? 'جيدة' : 'تحتاج دعماً'));
    rows.push('<tr><td>' + f.code + '</td><td style="text-align:right">' + f.title + '</td><td>' + at.length + '</td><td><b>' + p.mcq.best + '%</b></td><td>' + (ft.length ? figLatest + '%' : '—') + '</td><td>' + ((p.tasks && p.tasks.done) || 0) + '/5</td><td>' + st + '</td></tr>');
  }));

  let html = '<div class="report">' +
    '<div class="rep-head"><div><h1>تقرير تقدم الطالبة</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الطالبة:</b> ' + name + '</div><div><b>المدرسة:</b> ' + school + '</div>' +
    '<div><b>التاريخ:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div><div><b>سجل التدريب:</b> ' + attempts.length + ' مهمة</div></div>' +
    '<div class="rep-kpis"><div><b>' + avg + '%</b><span>متوسط الدقة</span></div>' +
    '<div><b>' + mcq.length + '</b><span>اختباراً منجزاً</span></div>' +
    '<div><b>' + attempts.filter(a => a.score >= 60).length + '</b><span>شهادة</span></div>' +
    '<div><b>' + streakDays() + '</b><span>يوم متتالٍ</span></div></div>' +
    '<h2>أدائي في المجالات</h2>' +
    '<table class="rep-table"><tr><th>المجال</th><th>العنوان</th><th>محاولات</th><th>أفضل نتيجة</th><th>الرسوم</th><th>المهام</th><th>الحالة</th></tr>' + rows.join('') + '</table>';

  const weak = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const p = getProg(fieldKey(sub, f));
    const at = fieldAttempts(sub, f, 'mcq');
    const ls = at.length ? at[at.length - 1].score : 0;
    if(at.length && ls < 80) weak.push({ sub, f });
  }));
  html += '<h2>الخطط العلاجية</h2>';
  if(!weak.length){
    html += '<p class="rep-note">لا توجد خطط علاجية حالياً — جميع المجالات التي بدأتِها بمستوى جيد أو متقن. 🌟</p>';
  } else {
    weak.forEach(w => {
      const wrong = lastWrong(w.sub, w.f);
      const targets = planTargets(w.f, wrong);
      html += '<div class="rep-plan"><h3>' + w.f.code + ' — ' + w.f.title + ' <small>(أفضل نتيجة ' + getProg(fieldKey(w.sub, w.f)).mcq.best + '%)</small></h3>' +
        (targets.length ? '<p><b>المؤشرات المستهدفة:</b></p><ul>' + targets.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '') +
        (wrong.length ? '<p><b>أسئلة للمراجعة:</b> ' + wrong.map(i => (i + 1)).join('، ') + '</p>' : '') +
        '<p><b>خطة العمل:</b> مراجعة المؤشر ← إعادة الأسئلة الخاطئة ← مهمة مؤشر ← إعادة الاختبار بهدف +10 درجات.</p></div>';
    });
  }

  html += '<h2>سجل المحاولات (آخر 25)</h2>';
  const at25 = attempts.slice(-25).reverse();
  html += at25.length ? '<table class="rep-table"><tr><th>المهمة</th><th>النوع</th><th>الدرجة</th><th>التاريخ</th><th>الوقت</th></tr>' +
    at25.map(a => '<tr><td style="text-align:right">' + a.title + '</td><td>' + (a.mode === 'mcq' ? 'اختبار' : a.mode === 'fig' ? 'رسوم' : 'مؤشر') + '</td><td>' + a.score + '%</td><td>' + a.date + '</td><td>' + (a.time || '') + '</td></tr>').join('') + '</table>'
    : '<p class="rep-note">لا توجد محاولات مسجلة بعد.</p>';

  html += '<div class="rep-sign"><div>توقيع المعلمة: ........................</div><div>توقيع ولي الأمر: ........................</div></div>' +
    '<p class="rep-foot">هذا التقرير صادر من منصة «تدريب نافس علوم» — إعداد المعلمة نعمة هرشان.</p></div>';
  return html;
}
function doPrint(){
  // إن لم تكن هناك طالبة مسجّلة (وضع المعلمة) نطبع تقرير الصف الأسبوعي بدل تقرير فارغ
  if(!attempts.length && getRegistry().length){
    printWeekly();
    toast('تم تجهيز تقرير الصف الأسبوعي 📄');
    return;
  }
  $('#printArea').innerHTML = buildReport();
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
function printPlan(sub, f){
  const name = profile.name || 'الطالبة';
  $('#printArea').innerHTML = '<div class="report"><div class="rep-head"><div><h1>خطة علاجية</h1><p>' + f.code + ' — ' + f.title + '</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الطالبة:</b> ' + name + '</div><div><b>التاريخ:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div></div>' +
    planHTML(sub, f, true) + '</div>';
  const root = $('#printArea');
  root.querySelectorAll('.qfoot').forEach(x => x.remove());
  root.querySelectorAll('input[type="checkbox"]').forEach(inp => {
    inp.replaceWith(document.createTextNode(inp.checked ? '☑ ' : '☐ '));
  });
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

/* ---------- الشهادة (تُمنح بعد كل اختبار منجز — قابلة للطباعة والحفظ PDF) ---------- */
function certHTML(title, score, correct, total){
  const name = profile.name || 'الطالبة';
  const school = profile.school || '';
  return '<div class="cert"><div class="seal">🏅</div>' +
    '<p style="font-weight:800;color:var(--violet)">تدريب نافس علوم</p>' +
    '<p class="muted">إدارة تعليم جيزان · إعداد المعلمة: نعمة هرشان</p>' +
    '<h2>شهادة إنجاز</h2>' +
    '<p>تشهد منصة تدريب نافس علوم بأن</p>' +
    '<div class="cname">' + esc(name) + '</div>' +
    '<p class="muted">' + (school ? 'من مدرسة: ' + esc(school) : '') + '</p>' +
    '<p>قد أتمّت بنجاح مهمة <b>' + esc(title) + '</b></p>' +
    '<div class="cgrade">' + score + '%</div>' +
    '<p class="muted">' + correct + ' من ' + total + ' • ' + new Date().toLocaleDateString('ar-SA') + '</p>' +
    '<div class="sign"><span>المعلمة: نعمة هرشان</span><span>التوقيع: ____________</span></div>' +
    '</div>';
}
function showCert(title, score, correct, total){
  const box = $('#modalBox');
  box.innerHTML = certHTML(title, score, correct, total) +
    '<div class="qfoot" style="justify-content:center;margin-top:14px">' +
    '<button class="btn btn-primary" data-printcert="1">🖨️ طباعة الشهادة / حفظ PDF</button>' +
    '<button class="btn btn-ghost" data-closeModal="1">إغلاق</button></div>';
  box.querySelector('[data-printcert]').onclick = () => printCert(title, score, correct, total);
  box.querySelector('[data-closeModal]').onclick = () => { $('#modal').hidden = true; };
  $('#modal').hidden = false;
}
function printCert(title, score, correct, total){
  $('#printArea').innerHTML = '<div class="certprint">' + certHTML(title, score, correct, total) + '</div>';
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
$('#modal').onclick = e => { if(e.target.id === 'modal') $('#modal').hidden = true; };

/* ---------- الإنجاز ---------- */
function renderProgress(){
  const mcq = attempts.filter(a => a.mode === 'mcq');
  const totalQ = mcq.reduce((s, a) => s + a.total, 0);
  const totalC = mcq.reduce((s, a) => s + a.correct, 0);
  $('#progCards').innerHTML =
    '<div class="kpi"><b>' + mcq.length + '</b><small>اختبار منجز</small></div>' +
    '<div class="kpi"><b>' + pct(totalC, totalQ) + '%</b><small>دقة الإجابات</small></div>' +
    '<div class="kpi"><b>' + attempts.filter(a => a.score >= 60).length + '</b><small>شهادة مكتسبة</small></div>' +
    '<div class="kpi"><b>' + streakDays() + '</b><small>يوم متتالٍ</small></div>';

  const bars = $('#subjectBars'); bars.innerHTML = '';
  Object.keys(BANK).forEach(sub => {
    BANK[sub].fields.forEach(f => {
      const p = getProg(fieldKey(sub, f));
      const c = p.mcq.best;
      const cls = c >= 80 ? 'g' : c >= 60 ? 'a' : 'r';
      bars.appendChild(el('div','bar-row','<div class="bl"><span>' + f.code + ' — ' + f.title + '</span><span>' + c + '%</span></div><div class="bar"><i class="' + cls + '" style="width:' + c + '%"></i></div>'));
    });
  });

  const certs = attempts.filter(a => a.score >= 60);
  $('#certsList').innerHTML = certs.length ? certs.slice().reverse().map(a =>
    '<div class="review-row ok"><div class="rq">' + a.title + '</div><div class="rr">' + a.score + '% • ' + a.date + ' • ' + a.time + '</div></div>').join('')
    : '<div class="empty">لا توجد شهادات بعد — أتمّي اختبارا واحصلي على 60%.</div>';

  $('#attemptsList').innerHTML = attempts.length ? '<table><tr><th>المهمة</th><th>النوع</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    attempts.slice().reverse().slice(0, 20).map(a => '<tr><td>' + a.title + '</td><td>' + (a.mode === 'mcq' ? 'اختيار' : a.mode === 'fig' ? 'رسوم' : 'مؤشر') + '</td><td><b>' + a.score + '%</b></td><td>' + a.date + '</td></tr>').join('') + '</table>'
    : '<div class="empty">لا توجد محاولات بعد.</div>';

  const mh = $('#myMedals');
  if(mh){
    const mine = medalsFor(U.id);
    mh.innerHTML = mine.length ? mine.map(x => '<div class="medal-card"><div class="mc-i">' + x.i + '</div><b>' + x.n + '</b><small>' + x.d + '</small></div>').join('')
      : '<div class="empty">لم تكتسبي وساماً بعد — ابدئي باختبار لتحصل على أول وسام 🌱</div>';
  }
  const mth = $('#myTodayMedals');
  if(mth){
    const dm = dailyMedalsFor(U.id);
    mth.innerHTML = dm.length ? dm.map(x => '<div class="medal-card today"><div class="mc-i">' + x.i + '</div><b>' + x.n + '</b><small>' + x.d + '</small></div>').join('')
      : '<div class="empty">لم تحصد وسام اليوم بعد — ابدئي باختبار لتحصد أول وسام 🌅</div>';
  }
  const mhist = $('#medalHistory');
  if(mhist) mhist.innerHTML = medalHistoryHTML(U.id, 14);

  const planHost = $('#planArea');
  if(planHost){
    const weak = [];
    Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
      const at = fieldAttempts(sub, f, 'mcq');
      const pp = getProg(fieldKey(sub, f));
      const ls = at.length ? at[at.length - 1].score : 0;
      if(at.length && ls < 80) weak.push({ sub, f });
    }));
    planHost.innerHTML = weak.length ? weak.map(w => planHTML(w.sub, w.f, true)).join('')
      : '<div class="empty">لا توجد خطط علاجية حالياً — كل المجالات التي بدأتِها بمستوى جيد أو متقن. استمري في التدريب 🌟</div>';
    planHost.querySelectorAll('.plan-card').forEach((card, i) => bindPlan(card, weak[i].sub, weak[i].f));
  }
}

/* ---------- ولي الأمر ---------- */
function parentLogin(){
  if($('#pinInput').value === pin){
    $('#parentGate').hidden = true; $('#parentBody').hidden = false;
    renderParent();
  } else toast('الرمز غير صحيح ❌');
}
$('#pinBtn').onclick = parentLogin;
$('#pinInput').addEventListener('keydown', e => { if(e.key === 'Enter') parentLogin(); });
const parentLogoutBtn = $('#parentLogout'); if(parentLogoutBtn) parentLogoutBtn.onclick = () => logoutToRoles();
const parentSwitchBtn = $('#parentSwitch'); if(parentSwitchBtn) parentSwitchBtn.onclick = () => logoutToRoles('student');

function renderParent(){
  const mcq = attempts.filter(a => a.mode === 'mcq');
  const totalQ = mcq.reduce((s, a) => s + a.total, 0);
  const totalC = mcq.reduce((s, a) => s + a.correct, 0);
  const fieldsDone = Object.keys(progress).length;
  $('#parentCards').innerHTML =
    '<div class="kpi"><b>' + (profile.name || 'الطالبة') + '</b><small>' + (profile.school || 'لم تسجل المدرسة') + '</small></div>' +
    '<div class="kpi"><b>' + pct(totalC, totalQ) + '%</b><small>متوسط الأداء</small></div>' +
    '<div class="kpi"><b>' + attempts.length + '</b><small>مهمة أنجزتها</small></div>' +
    '<div class="kpi"><b>' + streakDays() + '</b><small>يوم متتالٍ</small></div>';

  const bars = $('#parentBars'); bars.innerHTML = '';
  Object.keys(BANK).forEach(sub => {
    BANK[sub].fields.forEach(f => {
      const p = getProg(fieldKey(sub, f));
      const c = p.mcq.best;
      const cls = c >= 80 ? 'g' : c >= 60 ? 'a' : 'r';
      bars.appendChild(el('div','bar-row','<div class="bl"><span>' + f.code + ' — ' + f.title + '</span><span>' + c + '%</span></div><div class="bar"><i class="' + cls + '" style="width:' + c + '%"></i></div>'));
    });
  });

  // نقاط تحتاج دعماً
  const weak = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const p = getProg(fieldKey(sub, f));
    if(p.mcq.attempts > 0 && p.mcq.best < 70) weak.push({ code:f.code, title:f.title, best:p.mcq.best });
  }));
  $('#weakList').innerHTML = weak.length ? '<p class="muted">هذه المجالات تحتاج دعماً إضافياً:</p>' + weak.map(w =>
    '<div class="review-row bad"><div class="rq">' + w.code + ' — ' + w.title + '</div><div class="rr">أفضل نتيجة ' + w.best + '% — راجعي هذا المجال معاً</div></div>').join('')
    : '<div class="empty">ممتاز! لا توجد مجالات ضعيفة حتى الآن 🌟</div>';

  // سجل المحاولات
  $('#parentAttempts').innerHTML = attempts.length ? '<table><tr><th>المهمة</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    attempts.slice().reverse().slice(0, 10).map(a => '<tr><td>' + a.title + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') + '</table>'
    : '<div class="empty">لا توجد محاولات بعد.</div>';

  $$('.goal').forEach(b => b.classList.toggle('active', +b.dataset.g === goal));
  const sid = U.id;
  const pm = $('#parentMedals');
  if(pm) pm.innerHTML = '<span class="muted">أوسمة اليوم:</span> ' + medalIcons(dailyMedalsFor(sid)) + ' <span style="width:12px"></span><span class="muted">أوسمة الإنجاز:</span> ' + medalIcons(medalsFor(sid));
  const ph = $('#parentMedalHistory');
  if(ph) ph.innerHTML = medalHistoryHTML(sid, 14);
  const pp = $('#parentPlans');
  if(pp){
    const list = studentPlanList(sid, profile.name);
    pp.innerHTML = list.length ? list.map(p => '<div class="review-row"><div class="rq">' + esc(p.title) + '</div><div class="rr">' + p.date + ' • ' + (p.read ? '<b style="color:#15803d">✅ قرأتها ابنتك</b>' : '<b style="color:#b45309">⏳ لم تُقرأ بعد</b>') + '</div></div>').join('')
      : '<div class="empty">لا توجد رسائل أو خطط من المعلمة بعد.</div>';
  }
}
$$('.goal').forEach(b => b.onclick = () => { goal = +b.dataset.g; s(K.goal, goal); renderParent(); toast('تم ضبط الهدف اليومي: ' + goal + ' أسئلة'); });
$$('#msgChips .chip').forEach(c => c.onclick = () => { $('#parentMsgText').value = c.textContent; });
$('#sendMsgBtn').onclick = () => {
  const t = $('#parentMsgText').value.trim();
  if(!t){ toast('اكتبي الرسالة أولاً ✍️'); return; }
  messages.push({ text:t, date:today() }); s(K.msg, messages);
  $('#parentMsgText').value = '';
  $('#parentMsgStatus').innerHTML = '<div class="notice">✅ أُرسلت الرسالة وستظهر لابنتك في الصفحة الرئيسية.</div>';
  renderHub();
};
$('#printReport').onclick = () => printStudentReport(U.id);
const repb = $('#repBtn'); if(repb) repb.onclick = () => doPrint();
$('#changePin').onclick = () => {
  const v = prompt('اكتبي الرمز الجديد (4 أرقام):');
  if(v && v.length >= 4){ pin = v; s(K.pin, pin); toast('تم تغيير الرمز ✅'); }
};
function renderUploaded(){
  const box = $('#uploadedList');
  if(!box) return;
  const up = gRaw('nafas_uploads', []);
  box.innerHTML = up.length ? '<table><tr><th>الطالبة</th><th>المهمة</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    up.slice().reverse().map(a => '<tr><td>' + esc(a.student) + '</td><td>' + esc(a.exam) + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') + '</table>' : '';
}

/* ---------- التقرير الأسبوعي للمعلمة + سجل الطالبات ---------- */
function defaultWeek(){
  const to = today();
  const d = new Date(); d.setDate(d.getDate() - 6);
  return { from: d.toISOString().slice(0,10), to };
}
function weekData(st, from, to){
  const at = readUser(st.id, 'attempts', []);
  const prog = readUser(st.id, 'progress', {});
  const inWeek = at.filter(a => a.date >= from && a.date <= to);
  const mcq = inWeek.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s,a)=>s+(a.total||0),0);
  const totC = mcq.reduce((s,a)=>s+(a.correct||0),0);
  const loginDays = Object.keys(st.logins || {}).filter(d => d >= from && d <= to);
  const sessions = loginDays.reduce((s,d)=>s+(st.logins[d]||0),0);
  const best = Object.keys(prog).reduce((m,k)=>Math.max(m, (prog[k].mcq && prog[k].mcq.best) || 0), 0);
  const weak = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const fa = at.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
    if(!fa.length) return;
    const la = fa[fa.length - 1];
    if(la.score < 80) weak.push({ code:f.code, title:f.title, last:la.score, wrong:(la.wrong||[]).length });
  }));
  return { inWeek, mcqCount:mcq.length, totQ, totC, accuracy: pct(totC, totQ), loginDays, sessions, best, weak, allAttempts: at.length };
}
function resolveRange(from, to){
  // إن كانت الفترة المختارة خالية من المحاولات، نوسّعها تلقائياً لتغطية كل الإنجازات
  let anyIn = false, min = null, max = null;
  getRegistry().forEach(st => {
    readUser(st.id, 'attempts', []).forEach(a => {
      if(!a.date) return;
      if(!min || a.date < min) min = a.date;
      if(!max || a.date > max) max = a.date;
      if(a.date >= from && a.date <= to) anyIn = true;
    });
  });
  if(!anyIn && min && (min < from || max > to)) return { from:min, to:max, widened:true };
  return { from, to, widened:false };
}
function weeklyData(fromIn, toIn){
  let from = fromIn || (($('#wkFrom') && $('#wkFrom').value) || defaultWeek().from);
  let to = toIn || (($('#wkTo') && $('#wkTo').value) || defaultWeek().to);
  const rg = resolveRange(from, to);
  from = rg.from; to = rg.to;
  return { from, to, widened: rg.widened, rows: getRegistry().map(st => ({ st, w: weekData(st, from, to) })) };
}
function weekStatus(w){
  return !w.allAttempts ? 'لم تبدأ' : (w.accuracy >= 80 ? 'متميزة' : w.accuracy >= 60 ? 'جيدة' : 'تحتاج دعماً');
}
function renderWeekly(){
  const host = $('#weeklyTable');
  if(!host) return;
  const { from, to, rows } = weeklyData();
  const att = rows.reduce((s,r)=>s+r.w.inWeek.length,0);
  const sess = rows.reduce((s,r)=>s+r.w.sessions,0);
  const days = rows.reduce((s,r)=>s+r.w.loginDays.length,0);
  const tq = rows.reduce((s,r)=>s+r.w.totQ,0), tc = rows.reduce((s,r)=>s+r.w.totC,0);
  $('#weeklyCards').innerHTML =
    '<div class="kpi"><b>' + rows.length + '</b><small>طالبة مسجلة</small></div>' +
    '<div class="kpi"><b>' + sess + '</b><small>جلسات دخول الأسبوع</small></div>' +
    '<div class="kpi"><b>' + att + '</b><small>محاولات الأسبوع</small></div>' +
    '<div class="kpi"><b>' + (tq ? pct(tc, tq) : 0) + '%</b><small>متوسط الدقة</small></div>';
  host.innerHTML = rows.length ? '<table><tr><th>الطالبة</th><th>المدرسة</th><th>أيام الدخول</th><th>الجلسات</th><th>آخر دخول</th><th>محاولات الأسبوع</th><th>الدقة</th><th>أفضل نتيجة</th><th>الحالة</th></tr>' +
    rows.map(r => '<tr><td><b>' + esc(r.st.name) + '</b></td><td>' + esc(r.st.school || '—') + '</td>' +
      '<td>' + r.w.loginDays.length + '</td><td>' + r.w.sessions + '</td>' +
      '<td>' + (r.st.lastSeen ? new Date(r.st.lastSeen).toLocaleDateString('ar-SA') : '—') + '</td>' +
      '<td>' + r.w.inWeek.length + '</td><td>' + (r.w.mcqCount ? r.w.accuracy + '%' : '—') + '</td>' +
      '<td>' + (r.w.best ? r.w.best + '%' : '—') + '</td><td>' + weekStatus(r.w) + '</td></tr>').join('') + '</table>'
    : '<div class="empty">لا توجد طالبات مسجلات على هذا الجهاز.</div>';
  const weakRows = [];
  rows.forEach(r => r.w.weak.forEach(wf => weakRows.push({ name:r.st.name, wf })));
  $('#weeklyWeak').innerHTML = weakRows.length ? '<table><tr><th>الطالبة</th><th>المجال</th><th>آخر نتيجة</th><th>أسئلة خاطئة</th></tr>' +
    weakRows.map(x => '<tr><td>' + esc(x.name) + '</td><td>' + x.wf.code + ' — ' + esc(x.wf.title) + '</td><td>' + x.wf.last + '%</td><td>' + x.wf.wrong + '</td></tr>').join('') + '</table>'
    : '<div class="empty">لا توجد مجالات تحتاج دعماً في هذه الفترة 🌟</div>';
  renderRoster();
}
function renderRoster(){
  const host = $('#rosterList');
  if(!host) return;
  const reg = getRegistry();
  host.innerHTML = reg.length ? reg.map(st =>
    '<div class="review-row"><div class="rq">' + esc(st.name) + ' <small>' + esc(st.school || '—') + '</small></div>' +
    '<div class="rr">جلسات: ' + (st.sessions || 0) + ' • آخر دخول: ' + (st.lastSeen ? new Date(st.lastSeen).toLocaleDateString('ar-SA') : '—') +
    ' <button class="btn btn-ghost btn-sm" data-open="' + st.id + '">فتح ملفها</button>' +
    ' <button class="btn btn-ghost btn-sm" data-del="' + st.id + '">حذف</button></div></div>').join('')
    : '<div class="empty">لا توجد طالبات مسجلات بعد.</div>';
  host.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { activateUser(b.dataset.open); go('hub'); });
  host.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    if(!confirm('حذف بيانات هذه الطالبة نهائياً؟')) return;
    const id = b.dataset.del;
    saveRegistry(getRegistry().filter(x => x.id !== id));
    ['profile','progress','attempts','msg','goal'].forEach(k => localStorage.removeItem('nafas_u_' + id + '_' + k));
    if(U.id === id) switchUser(); else renderWeekly();
  });
}
function buildWeeklyReport(fromIn, toIn){
  const { from, to, rows } = weeklyData(fromIn, toIn);
  const att = rows.reduce((s,r)=>s+r.w.inWeek.length,0);
  const sess = rows.reduce((s,r)=>s+r.w.sessions,0);
  const days = rows.reduce((s,r)=>s+r.w.loginDays.length,0);
  const tq = rows.reduce((s,r)=>s+r.w.totQ,0), tc = rows.reduce((s,r)=>s+r.w.totC,0);
  const ups = gRaw('nafas_uploads', []);
  let html = '<div class="report">' +
    '<div class="rep-head"><div><h1>التقرير الأسبوعي — إنجاز الطالبات ودخولهن</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الفترة:</b> ' + from + ' — ' + to + '</div>' +
    '<div><b>تاريخ الإصدار:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div>' +
    '<div><b>عدد الطالبات:</b> ' + rows.length + '</div>' +
    '<div><b>جلسات الدخول:</b> ' + sess + ' خلال ' + days + ' يوماً</div></div>' +
    (rows.widened ? '<p class="rep-note">ملاحظة: وسّعتُ الفترة تلقائياً لتغطية كل الإنجازات المسجّلة للطالبات.</p>' : '') +
    '<div class="rep-kpis"><div><b>' + rows.length + '</b><span>طالبة</span></div>' +
    '<div><b>' + sess + '</b><span>جلسة دخول</span></div>' +
    '<div><b>' + att + '</b><span>محاولة</span></div>' +
    '<div><b>' + (tq ? pct(tc, tq) : 0) + '%</b><span>متوسط الدقة</span></div></div>' +
    '<h2>متابعة الطالبات</h2><table class="rep-table"><tr><th>الطالبة</th><th>المدرسة</th><th>أيام الدخول</th><th>الجلسات</th><th>آخر دخول</th><th>محاولات الأسبوع</th><th>الدقة</th><th>أفضل نتيجة</th><th>الأوسمة</th><th>الحالة</th></tr>' +
    rows.map(r => '<tr><td style="text-align:right">' + esc(r.st.name) + '</td><td>' + esc(r.st.school || '—') + '</td>' +
      '<td>' + r.w.loginDays.length + '</td><td>' + r.w.sessions + '</td>' +
      '<td>' + (r.st.lastSeen ? new Date(r.st.lastSeen).toLocaleDateString('ar-SA') : '—') + '</td>' +
      '<td>' + r.w.inWeek.length + '</td><td>' + (r.w.mcqCount ? r.w.accuracy + '%' : '—') + '</td>' +
      '<td>' + (r.w.best ? r.w.best + '%' : '—') + '</td>' +
      '<td>' + medalIcons(medalsFor(r.st.id)) + '</td><td>' + weekStatus(r.w) + '</td></tr>').join('') + '</table>' +
    '<h2>🏆 المراكز الخمسة الأولى — أفضل إنجازاً</h2>' + (function(){
      const top = studentRanking().slice(0, 5);
      if(!top.length) return '<p class="rep-note">لا توجد طالبات بعد.</p>';
      const mk = ['🥇', '🥈', '🥉', '④', '⑤'];
      return '<table class="rep-table"><tr><th>المركز</th><th>الطالبة</th><th>المدرسة</th><th>الدقة</th><th>المحاولات</th><th>الأوسمة</th></tr>' +
        top.map((r, i) => '<tr><td>' + mk[i] + '</td><td style="text-align:right">' + esc(r.st.name) + '</td><td>' + esc(r.st.school || '—') + '</td>' +
          '<td>' + r.R.acc + '%</td><td>' + r.R.all.length + '</td><td>' + medalIcons(r.medals) + '</td></tr>').join('') + '</table>';
    })() +
    '<h2>🌅 نجوم اليوم (تتجدّد يومياً)</h2>' + (function(){
      const rows = dailyRanking().filter(r => r.medals.length).slice(0, 10);
      if(!rows.length) return '<p class="rep-note">لا توجد إنجازات اليوم بعد.</p>';
      return '<table class="rep-table"><tr><th>الطالبة</th><th>دخول اليوم</th><th>اختبارات اليوم</th><th>أفضل نتيجة</th><th>أوسمة اليوم</th></tr>' +
        rows.map(r => '<tr><td style="text-align:right">' + esc(r.st.name) + '</td><td>' + (r.D.logged ? r.D.loginsToday + ' جلسة' : '—') + '</td>' +
          '<td>' + (r.D.mcqCount || '—') + '</td><td>' + (r.D.best ? r.D.best + '%' : '—') + '</td><td>' + medalIcons(r.medals) + '</td></tr>').join('') + '</table>';
    })();
  const weakRows = [];
  rows.forEach(r => r.w.weak.forEach(wf => weakRows.push({ name:r.st.name, wf })));
  html += '<h2>مجالات تحتاج دعماً</h2>' + (weakRows.length ? '<table class="rep-table"><tr><th>الطالبة</th><th>المجال</th><th>آخر نتيجة</th><th>أسئلة خاطئة</th></tr>' +
    weakRows.map(x => '<tr><td style="text-align:right">' + esc(x.name) + '</td><td>' + x.wf.code + ' — ' + esc(x.wf.title) + '</td><td>' + x.wf.last + '%</td><td>' + x.wf.wrong + '</td></tr>').join('') + '</table>'
    : '<p class="rep-note">لا توجد مجالات تحتاج دعماً في هذه الفترة 🌟</p>');
  if(ups.length){
    html += '<h2>نتائج مرفوعة من تطبيق «مستقبلهم»</h2><table class="rep-table"><tr><th>الطالبة</th><th>المدرسة</th><th>الاختبار</th><th>الدرجة</th><th>التاريخ</th></tr>' +
      ups.slice().reverse().map(u => '<tr><td style="text-align:right">' + esc(u.student) + '</td><td>' + esc(u.school || '—') + '</td><td style="text-align:right">' + esc(u.exam) + '</td><td>' + u.score + '%</td><td>' + u.date + '</td></tr>').join('') + '</table>';
  }
  html += analysisHTML(from, to);
  html += '<div class="rep-sign"><div>توقيع المعلمة: ........................</div><div>توقيع ولي الأمر: ........................</div></div>' +
    '<p class="rep-foot">تقرير صادر من منصة «تدريب نافس علوم» — إدارة تعليم جيزان — إعداد المعلمة نعمة هرشان.</p></div>';
  return html;
}
function printWeekly(fromIn, toIn){
  $('#printArea').innerHTML = buildWeeklyReport(fromIn, toIn);
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
function exportData(){
  const reg = getRegistry();
  const data = { app:'nafas-training-3m', version:1, exportedAt:new Date().toISOString(),
    students: reg.map(st => ({ id:st.id, name:st.name, school:st.school, cls:st.cls,
      firstSeen:st.firstSeen, lastSeen:st.lastSeen, sessions:st.sessions, logins:st.logins,
      profile: readUser(st.id,'profile',{}), progress: readUser(st.id,'progress',{}), attempts: readUser(st.id,'attempts',[]) })),
    uploads: gRaw('nafas_uploads', []) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'تدريب-نافس-علوم-' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('تم تصدير البيانات ✅');
}
function importData(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const data = JSON.parse(fr.result);
      const reg = getRegistry();
      (data.students || []).forEach(st => {
        let t = reg.find(x => x.id === st.id);
        if(!t){
          t = { id:st.id, name:st.name || 'طالبة', school:st.school || '', cls:st.cls || '',
                firstSeen:st.firstSeen || Date.now(), lastSeen:st.lastSeen || Date.now(), sessions:0, logins:{} };
          reg.push(t);
        }
        if(st.name) t.name = st.name;
        if(st.school) t.school = st.school;
        t.logins = t.logins || {};
        Object.keys(st.logins || {}).forEach(d => { t.logins[d] = Math.max(t.logins[d] || 0, st.logins[d]); });
        t.lastSeen = Math.max(t.lastSeen || 0, st.lastSeen || 0);
        t.sessions = Math.max(t.sessions || 0, st.sessions || 0);
        const cur = readUser(t.id, 'attempts', []);
        const seen = new Set(cur.map(a => a.date + '|' + a.title + '|' + a.score + '|' + (a.time || '')));
        (st.attempts || []).forEach(a => {
          const k = a.date + '|' + a.title + '|' + a.score + '|' + (a.time || '');
          if(!seen.has(k)){ cur.push(a); seen.add(k); }
        });
        writeUser(t.id, 'attempts', cur);
        if(st.profile) writeUser(t.id, 'profile', st.profile);
        if(st.progress) writeUser(t.id, 'progress', st.progress);
      });
      saveRegistry(reg);
      const added = (data.students || []).length;
      const ups = gRaw('nafas_uploads', []);
      (data.uploads || []).forEach(u => {
        if(!ups.some(x => x.date === u.date && x.student === u.student && x.exam === u.exam)) ups.push(u);
      });
      sRaw('nafas_uploads', ups);
      renderWeekly(); renderUploaded();
      if(typeof renderTeacher === 'function') renderTeacher();
      toast('تم استيراد سجلات ' + added + ' طالبة ✅');
    }catch(e){ toast('تعذر قراءة الملف ❌'); }
  };
  fr.readAsText(file);
}
function initWeekInputs(){
  const d = defaultWeek();
  const f = $('#wkFrom'), tt = $('#wkTo');
  if(f && !f.value) f.value = d.from;
  if(tt && !tt.value) tt.value = d.to;
}
const on = (sel, fn) => { const e = $(sel); if(e) e.onclick = fn; };
on('#wkRefresh', () => { renderWeekly(); toast('تم تحديث التقرير الأسبوعي ✅'); });
on('#printWeekly', () => printWeekly());
on('#addStudentBtn', () => switchUser());
on('#switchUserBtn', () => switchUser());
on('#logoutBtn', () => logoutToRoles());
on('#lgAddBtn', () => addStudent());

/* ---------- لوحة المعلمة: تحليل بياني كامل + متابعة الطالبات ---------- */
function addDaysUTC(ds, n){
  const d = new Date(ds + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0,10);
}
function fieldOf(sub, code){
  if(!BANK[sub]) return null;
  return BANK[sub].fields.find(f => f.code === code) || null;
}
function buildAnalysis(from, to){
  const rg = resolveRange(from, to);
  from = rg.from; to = rg.to;
  const reg = getRegistry();
  const rows = reg.map(st => ({ st, w: weekData(st, from, to) }));
  const days = [];
  let d = from, guard = 0;
  while(d <= to && guard++ < 40){ days.push(d); d = addDaysUTC(d, 1); }

  let att = 0, mcqAtt = 0, figAtt = 0, taskAtt = 0, correct = 0, total = 0, certs = 0, sessions = 0, loginDays = 0;
  const dist = [{ l:'أقل من 40%', c:0 },{ l:'40% - 59%', c:0 },{ l:'60% - 79%', c:0 },{ l:'80% فأكثر', c:0 }];
  rows.forEach(r => {
    att += r.w.inWeek.length;
    sessions += r.w.sessions;
    loginDays += r.w.loginDays.length;
    r.w.inWeek.forEach(a => {
      if(a.mode === 'mcq'){
        mcqAtt++; total += a.total || 0; correct += a.correct || 0;
        if(a.score < 40) dist[0].c++; else if(a.score < 60) dist[1].c++; else if(a.score < 80) dist[2].c++; else dist[3].c++;
      }
      if(a.mode === 'fig') figAtt++;
      if(a.mode === 'tasks') taskAtt++;
      if(a.score >= 60) certs++;
    });
  });

  // متوسط الأداء لكل مجال
  const fields = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    let n = 0, sumLast = 0, sumBest = 0, weak = 0, best = 0, atts = 0;
    rows.forEach(r => {
      const fa = r.w.inWeek.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
      if(!fa.length) return;
      n++; atts += fa.length;
      const last = fa[fa.length - 1].score;
      const p = readUser(r.st.id, 'progress', {})[sub + '|' + f.code];
      const b = (p && p.mcq && p.mcq.best) || 0;
      sumLast += last; sumBest += b; best = Math.max(best, b);
      if(last < 80) weak++;
    });
    fields.push({ code:f.code, title:f.title, sub, n, atts, avgLast: n ? Math.round(sumLast / n) : 0, avgBest: n ? Math.round(sumBest / n) : 0, weak, best });
  }));

  // اتجاه الأسبوع
  const trend = days.map(dd => {
    let a = 0, c = 0, t = 0, stu = new Set();
    rows.forEach(r => r.w.inWeek.filter(x => x.date === dd).forEach(x => {
      a++; stu.add(r.st.id);
      if(x.mode === 'mcq'){ t += x.total || 0; c += x.correct || 0; }
    }));
    return { d: dd, att:a, acc: pct(c, t), stu: stu.size };
  });

  // أكثر المؤشرات تعثراً
  const indMap = {};
  rows.forEach(r => r.w.inWeek.filter(a => a.mode === 'mcq').forEach(a => {
    const f = fieldOf(a.subject, a.field);
    if(!f) return;
    (a.wrong || []).forEach(i => {
      const q = f.mcq[i];
      if(!q || q.k === undefined) return;
      const key = a.subject + '|' + a.field + '|' + q.k;
      if(!indMap[key]) indMap[key] = { code:f.code, title:f.title, text:(f.ind[q.k] || ''), n:0, students:{} };
      indMap[key].n++;
      indMap[key].students[r.st.name] = true;
    });
  }));
  const indicators = Object.values(indMap).map(x => ({ code:x.code, title:x.title, text:x.text, n:x.n, st:Object.keys(x.students).length }))
    .sort((a, b) => b.n - a.n).slice(0, 6);

  const ranking = rows.slice().sort((a, b) => (b.w.accuracy - a.w.accuracy) || (b.w.inWeek.length - a.w.inWeek.length));

  return { from, to, widened: rg.widened, rows, days, trend, fields, dist, indicators, ranking,
    totals:{ students: rows.length, sessions, loginDays, att, mcqAtt, figAtt, taskAtt, certs,
             accuracy: pct(correct, total), totalQ: total, totalC: correct } };
}
function anaBar(v, color){ return '<div class="ana-bar"><i style="width:' + Math.max(2, Math.min(100, v)) + '%;background:' + (color || '#6d28d9') + '"></i></div>'; }
function scoreColor(v){ return v >= 80 ? '#059669' : v >= 60 ? '#d97706' : '#dc2626'; }
function renderTeacher(){
  const all = $('#tpAllTime') && $('#tpAllTime').checked;
  const rng = all ? allTimeRange() : { from:($('#tpFrom') && $('#tpFrom').value) || defaultWeek().from,
                                      to:($('#tpTo') && $('#tpTo').value) || defaultWeek().to };
  if(all){
    const f = $('#tpFrom'), t2 = $('#tpTo');
    if(f) f.value = rng.from;
    if(t2) t2.value = rng.to;
  }
  const from = rng.from, to = rng.to;
  const A = buildAnalysis(from, to);
  const ss = $('#syncStatus');
  if(ss) ss.textContent = syncStatusText();
  const sd = $('#syncDiag');
  if(sd){
    const zero = getRegistry().filter(x => !readUser(x.id, 'attempts', []).length).map(x => x.name);
    sd.innerHTML = zero.length
      ? '⚠️ طالبات مسجلات بلا محاولات محفوظة: <b>' + zero.map(esc).join('، ') + '</b> — إن كانت إحداهن تدرّبت، اطلبي منها فتح المنصة على نفس جهازها والضغط على «📤 إرسال كل إنجازاتي للمعلمة».'
      : '✅ جميع الطالبات المسجلات لديهن محاولات محفوظة.';
  }
  const sci = $('#syncCodeInput');
  if(sci && !sci.value) sci.value = syncCode();
  const T = A.totals;
  $('#tpRangeTxt').textContent = 'الفترة: ' + A.from + ' — ' + A.to + (A.widened ? '  (تم توسيعها تلقائياً لأن هناك إنجازات خارج الفترة المختارة)' : '');

  $('#tpCards').innerHTML =
    '<div class="kpi"><b>' + T.students + '</b><small>طالبة مسجلة</small></div>' +
    '<div class="kpi"><b>' + T.sessions + '</b><small>جلسات دخول</small></div>' +
    '<div class="kpi"><b>' + T.att + '</b><small>محاولات</small></div>' +
    '<div class="kpi"><b>' + T.accuracy + '%</b><small>متوسط الدقة</small></div>' +
    '<div class="kpi"><b>' + T.certs + '</b><small>شهادة مكتسبة</small></div>' +
    '<div class="kpi"><b>' + T.loginDays + '</b><small>أيام دخول</small></div>' +
    '<div class="kpi"><b>' + T.mcqAtt + '</b><small>اختبار</small></div>' +
    '<div class="kpi"><b>' + T.figAtt + '</b><small>مجموعة رسوم</small></div>';

  // متوسط الدقة لكل مجال
  $('#tpFieldChart').innerHTML = A.fields.map(f =>
    '<div class="ana-row"><div class="an-l">' + f.code + ' — ' + f.title +
      '<small>' + f.n + ' طالبة • ' + f.atts + ' محاولة • تحتاج دعماً: ' + f.weak + '</small></div>' +
    '<div>' + anaBar(f.avgLast, scoreColor(f.avgLast)) + '<small>متوسط آخر نتيجة ' + f.avgLast + '%</small></div>' +
    '<div class="an-v">' + (f.n ? f.avgLast + '%' : '—') + '</div></div>').join('');

  // اتجاه الأسبوع
  const maxAtt = Math.max(1, ...A.trend.map(x => x.att));
  $('#tpTrend').innerHTML = '<div class="trend">' + A.trend.map(x =>
    '<div class="tc-col"><span class="tc-v">' + x.att + '</span>' +
    '<div class="tc-bar" style="height:' + Math.max(4, Math.round(x.att / maxAtt * 120)) + 'px"></div>' +
    '<small>' + x.d.slice(5) + '</small><small>' + (x.acc ? x.acc + '%' : '') + '</small></div>').join('') + '</div>';

  // توزيع الدرجات
  const maxD = Math.max(1, ...A.dist.map(x => x.c));
  $('#tpDist').innerHTML = A.dist.map(x =>
    '<div class="ana-row"><div class="an-l">' + x.l + '</div>' +
    '<div>' + anaBar(Math.round(x.c / maxD * 100), '#db2777') + '</div>' +
    '<div class="an-v">' + x.c + '</div></div>').join('') +
    '<p class="muted" style="font-size:12px;margin-top:8px">محاولات الاختيار من متعدد خلال الفترة: ' + T.mcqAtt + ' اختبار.</p>';

  // أكثر المؤشرات تعثراً
  $('#tpIndicators').innerHTML = A.indicators.length ? A.indicators.map(x =>
    '<div class="ana-row"><div class="an-l">' + x.code + ' — ' + x.title +
      '<small>' + x.text + '</small></div>' +
    '<div>' + anaBar(Math.min(100, x.n * 12), '#dc2626') + '</div>' +
    '<div class="an-v">' + x.n + '<small style="font-weight:400">' + x.st + ' طالبة</small></div></div>').join('')
    : '<div class="empty">لا توجد أخطاء متكررة في هذه الفترة 🌟</div>';

  // جدول الطالبات
  $('#tpStudents').innerHTML = A.rows.length ? '<div class="tp-table"><table><tr><th>الطالبة</th><th>المدرسة</th><th>أيام الدخول</th><th>الجلسات</th><th>آخر دخول</th><th>محاولات</th><th>الدقة</th><th>أفضل نتيجة</th><th>كل المحاولات</th><th>الأوسمة</th><th>الحالة</th><th>المسار والإرسال</th></tr>' +
    A.rows.map(r => '<tr><td><b>' + esc(r.st.name) + '</b></td><td>' + esc(r.st.school || '—') + '</td>' +
      '<td>' + r.w.loginDays.length + '</td><td>' + r.w.sessions + '</td>' +
      '<td>' + (r.st.lastSeen ? new Date(r.st.lastSeen).toLocaleDateString('ar-SA') : '—') + '</td>' +
      '<td>' + r.w.inWeek.length + '</td><td>' + (r.w.mcqCount ? r.w.accuracy + '%' : '—') + '</td>' +
      '<td>' + (r.w.best ? r.w.best + '%' : '—') + '</td><td>' + r.w.allAttempts + '</td><td>' + weekStatus(r.w) + '</td>' +
      '<td>' + medalIcons(dailyMedalsFor(r.st.id)) + '</td>' +
      '<td class="tp-send"><select data-track="' + r.st.id + '"><option value="">متوازنة</option>' +
      '<option value="remedial"' + (r.st.track === 'remedial' ? ' selected' : '') + '>تحتاج علاجي</option>' +
      '<option value="enrichment"' + (r.st.track === 'enrichment' ? ' selected' : '') + '>إثرائي</option></select>' +
      '<button class="btn btn-soft btn-sm" data-sendmenu="' + r.st.id + '">📩 إرسال</button> ' +
      '<button class="btn btn-ghost btn-sm" data-report="' + r.st.id + '">🖨️ تقريرها</button> ' +
      '<button class="btn btn-ghost btn-sm" data-sendrep="' + r.st.id + '">📤 أرسلي لها</button> ' +
      '<button class="btn btn-ghost btn-sm" data-req="' + r.st.id + '">🔄 تحديث</button></td></tr>').join('') + '</table></div>'
    : '<div class="empty">لا توجد طالبات مسجلات على هذا الجهاز.</div>';
  $('#tpStudents').querySelectorAll('[data-detail]').forEach(b => b.onclick = () => renderStudentDetail(b.dataset.detail));
  $('#tpStudents').querySelectorAll('[data-openst]').forEach(b => b.onclick = () => { activateUser(b.dataset.openst); $('#teacherPanel').hidden = true; go('hub'); });
  $('#tpStudents').querySelectorAll('[data-track]').forEach(s => s.onchange = () => {
    const reg = getRegistry();
    const st2 = reg.find(x => x.id === s.dataset.track);
    if(st2){ st2.track = s.value; saveRegistry(reg); toast('مسار ' + st2.name + ': ' + (TRACK_LABEL[s.value] || 'متوازنة')); renderTeacher(); }
  });
  $('#tpStudents').querySelectorAll('[data-sendmenu]').forEach(b => b.onclick = () => openSendMenu(b.dataset.sendmenu));
  $('#tpStudents').querySelectorAll('[data-report]').forEach(b => b.onclick = () => printStudentReport(b.dataset.report));
  $('#tpStudents').querySelectorAll('[data-sendrep]').forEach(b => b.onclick = () => sendStudentReport(b.dataset.sendrep));
  $('#tpStudents').querySelectorAll('[data-req]').forEach(b => b.onclick = () => requestStudentUpdate(b.dataset.req));
  renderSent();
  renderTopFive();
  renderTodayMedals();

  renderStudentDetail(A.rows.length ? A.rows[0].st.id : null, A);
  const planHost = $('#tpPlan');
  if(planHost) planHost.innerHTML = improvementHTML();
}
function renderStudentDetail(id, A){
  const host = $('#tpStudentDetail');
  if(!host) return;
  if(!id){ host.innerHTML = '<div class="empty">اختاري طالبة من الجدول لعرض تفصيل إنجازها.</div>'; return; }
  const A2 = A || buildAnalysis(($('#tpFrom') && $('#tpFrom').value) || defaultWeek().from, ($('#tpTo') && $('#tpTo').value) || defaultWeek().to);
  const row = A2.rows.find(r => r.st.id === id);
  if(!row){ host.innerHTML = '<div class="empty">غير متاح.</div>'; return; }
  const st = row.st, w = row.w;
  const all = readUser(st.id, 'attempts', []);
  const prog = readUser(st.id, 'progress', {});
  const fRows = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const fa = all.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
    const p = prog[sub + '|' + f.code];
    const best = (p && p.mcq && p.mcq.best) || 0;
    const last = fa.length ? fa[fa.length - 1].score : null;
    const tasks = (p && p.tasks && p.tasks.done) || 0;
    const figs = (p && p.fig && p.fig.best) || 0;
    fRows.push({ code:f.code, title:f.title, n:fa.length, best, last, tasks, figs, st: !fa.length ? 'لم تبدأ' : (last >= 80 ? 'متقنة' : last >= 60 ? 'جيدة' : 'تحتاج دعماً') });
  }));
  const weak = fRows.filter(f => f.n && f.last < 80);
  host.innerHTML =
    '<div class="toolbar-row"><b>👩‍🎓 ' + esc(st.name) + '</b><span class="muted">' + esc(st.school || '') + ' • ' + esc(st.cls || '') + '</span>' +
    '<button class="btn btn-ghost btn-sm" id="tpPrintOne">🖨️ طباعة تقرير هذه الطالبة</button></div>' +
    '<div class="grid-4"><div class="kpi"><b>' + w.inWeek.length + '</b><small>محاولات الفترة</small></div>' +
    '<div class="kpi"><b>' + (w.mcqCount ? w.accuracy + '%' : '—') + '</b><small>دقة الفترة</small></div>' +
    '<div class="kpi"><b>' + (w.best ? w.best + '%' : '—') + '</b><small>أفضل نتيجة</small></div>' +
    '<div class="kpi"><b>' + w.sessions + '</b><small>جلسات الدخول</small></div></div>' +
    '<div class="medals-row" style="margin:10px 0;align-items:center">' + medalIcons(dailyMedalsFor(st.id)) + '<span class="muted">أوسمة اليوم</span>' +
    '<span style="width:14px"></span>' + medalIcons(medalsFor(st.id)) + '<span class="muted">أوسمة الإنجاز التراكمية</span></div>' +
    '<div class="tp-table"><table><tr><th>المجال</th><th>المحاولات</th><th>أفضل نتيجة</th><th>آخر نتيجة</th><th>الرسوم</th><th>المهام</th><th>الحالة</th></tr>' +
    fRows.map(f => '<tr><td>' + f.code + ' — ' + esc(f.title) + '</td><td>' + f.n + '</td><td>' + (f.best ? f.best + '%' : '—') + '</td>' +
      '<td>' + (f.last === null ? '—' : f.last + '%') + '</td><td>' + (f.figs ? f.figs + '%' : '—') + '</td>' +
      '<td>' + f.tasks + '/5</td><td>' + f.st + '</td></tr>').join('') + '</table></div>' +
    '<p class="muted" style="margin-top:10px">' + (weak.length ? 'مجالات تحتاج دعماً: ' + weak.map(f => f.code + ' (' + f.last + '%)').join('، ') : 'لا توجد مجالات تحتاج دعماً 🌟') + '</p>' +
    '<h3 style="margin-top:14px">آخر المحاولات</h3><div class="tp-table"><table><tr><th>المهمة</th><th>النوع</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    (all.slice(-8).reverse().map(a => '<tr><td>' + esc(a.title) + '</td><td>' + (a.mode === 'mcq' ? 'اختبار' : a.mode === 'fig' ? 'رسوم' : 'مؤشر') + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') || '<tr><td colspan="4">لا توجد محاولات</td></tr>') + '</table></div>' +
    '<h3 style="margin-top:14px">📅 سجل الأوسمة اليومية — محفوظ ولا يُحذف</h3>' + medalHistoryHTML(st.id, 14);
  const pb = $('#tpPrintOne');
  if(pb) pb.onclick = () => printStudentReport(st.id);
}
/* ---------- تقرير فردي لكل طالبة ---------- */
function studentReportData(id){
  const st = getRegistry().find(x => x.id === id) || { id, name:'طالبة', school:'', cls:'' };
  const all = readUser(id, 'attempts', []);
  const prog = readUser(id, 'progress', {});
  const mcq = all.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s, a) => s + (a.total || 0), 0);
  const totC = mcq.reduce((s, a) => s + (a.correct || 0), 0);
  const acc = pct(totC, totQ);
  const best = Object.keys(prog).reduce((m, k) => Math.max(m, (prog[k].mcq && prog[k].mcq.best) || 0), 0);
  const fields = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const fa = all.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
    const p = prog[sub + '|' + f.code];
    const b = (p && p.mcq && p.mcq.best) || 0;
    const last = fa.length ? fa[fa.length - 1].score : null;
    const tasks = (p && p.tasks && p.tasks.done) || 0;
    const figs = (p && p.fig && p.fig.best) || 0;
    const figN = (p && p.fig && p.fig.attempts) || 0;
    if(!fa.length && !tasks && !figN) return;
    fields.push({ code:f.code, title:f.title, n:fa.length, best:b, last:last, tasks:tasks, figs:figs,
      st: !fa.length ? (tasks || figN ? 'أنجزتِ المهام' : 'لم تبدأ') : (last >= 80 ? 'متقنة' : last >= 60 ? 'جيدة' : 'تحتاج دعماً') });
  }));
  const weak = fields.filter(f => f.n && f.last < 80);
  const logins = Object.keys(st.logins || {});
  return { st, all, prog, acc, best, fields, weak, logins,
    certs: all.filter(a => a.score >= 60).length,
    sessions: st.sessions || 0,
    lastSeen: st.lastSeen || 0,
    track: st.track || '' };
}
function studentReportText(id){
  const R = studentReportData(id);
  const name = R.st.name || 'الطالبة';
  let tx = '📊 تقرير تقدمك — ' + name + '\n';
  tx += 'المدرسة: ' + (R.st.school || '—') + (R.st.cls ? ' | الصف: ' + R.st.cls : '') + '\n';
  tx += 'التاريخ: ' + new Date().toLocaleDateString('ar-SA') + '\n\n';
  tx += 'متوسط الدقة: ' + R.acc + '% | المحاولات: ' + R.all.length + ' | أفضل نتيجة: ' + R.best + '% | الشهادات: ' + R.certs + '\n';
  tx += 'جلسات الدخول: ' + R.sessions + ' | أيام التدريب: ' + R.logins.length + '\n';
  if(R.lastSeen) tx += 'آخر دخول: ' + new Date(R.lastSeen).toLocaleDateString('ar-SA') + '\n';
  tx += '\n——— أداؤك في المجالات ———\n';
  if(R.fields.length){
    R.fields.forEach(f => {
      tx += '• ' + f.code + ' — ' + f.title + '\n';
      tx += '   المحاولات: ' + f.n + ' | أفضل نتيجة: ' + (f.best ? f.best + '%' : '—') + ' | آخر نتيجة: ' + (f.last === null ? '—' : f.last + '%') + '\n';
      tx += '   الرسوم: ' + (f.figs ? f.figs + '%' : '—') + ' | المهام: ' + f.tasks + '/5 | الحالة: ' + f.st + '\n';
    });
  } else {
    tx += 'لا يوجد إنجاز مسجّل بعد — ابدئي باختبار في أي مجال.\n';
  }
  tx += '\n——— خلاصة ———\n';
  if(R.weak.length){
    tx += 'مجالات تحتاج دعماً: ' + R.weak.map(f => f.code + ' (' + f.last + '%)').join('، ') + '\n';
    tx += 'خطواتك: راجعي شرح الأسئلة الخاطئة ← أكملي مهمة مؤشر يومياً ← أعيدي الاختبار باستهداف +10 درجات.\n';
  } else if(R.all.length){
    tx += 'مستواك جيد جداً — حافظي على يومك التدريبي، وأخذ لكِ تحدياً إثرائياً.\n';
  } else {
    tx += 'ابدئي اليوم: اختبار واحد (10 أسئلة) + مهمة مؤشر واحدة.\n';
  }
  tx += '\nمعلمة: نعمة هرشان — إدارة تعليم جيزان';
  return tx;
}
function printStudentReport(id){
  const R = studentReportData(id);
  const st = R.st;
  const rows = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const fa = R.all.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
    const p = R.prog[sub + '|' + f.code];
    const b = (p && p.mcq && p.mcq.best) || 0;
    const last = fa.length ? fa[fa.length - 1].score : null;
    const tasks = (p && p.tasks && p.tasks.done) || 0;
    const figs = (p && p.fig && p.fig.best) || 0;
    rows.push('<tr><td>' + f.code + '</td><td style="text-align:right">' + f.title + '</td><td>' + fa.length + '</td>' +
      '<td>' + (b ? b + '%' : '—') + '</td><td>' + (last === null ? '—' : last + '%') + '</td>' +
      '<td>' + (figs ? figs + '%' : '—') + '</td><td>' + tasks + '/5</td></tr>');
  }));
  const html = '<div class="report"><div class="rep-head"><div><h1>تقرير تقدم الطالبة</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الطالبة:</b> ' + esc(st.name || '—') + '</div><div><b>المدرسة:</b> ' + esc(st.school || '—') + '</div>' +
    '<div><b>الصف:</b> ' + esc(st.cls || '—') + '</div><div><b>التاريخ:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div></div>' +
    '<div class="rep-kpis"><div><b>' + R.all.length + '</b><span>محاولة</span></div>' +
    '<div><b>' + R.acc + '%</b><span>متوسط الدقة</span></div>' +
    '<div><b>' + R.best + '%</b><span>أفضل نتيجة</span></div>' +
    '<div><b>' + R.certs + '</b><span>شهادة</span></div></div>' +
    '<h2>أداؤها في المجالات</h2><table class="rep-table"><tr><th>المجال</th><th>العنوان</th><th>المحاولات</th><th>أفضل نتيجة</th><th>آخر نتيجة</th><th>الرسوم</th><th>المهام</th></tr>' + rows.join('') + '</table>' +
    (R.weak.length ? '<h2>مجالات تحتاج دعماً</h2><p class="rep-note">' + R.weak.map(f => f.code + ' — ' + f.title + ' (آخر نتيجة ' + f.last + '%)').join(' • ') + '</p>' +
      '<p class="rep-note">الخطوات: مراجعة المؤشر ← إعادة الأسئلة الخاطئة ← مهمة مؤشر يومياً ← إعادة الاختبار بهدف +10 درجات.</p>' : '') +
    '<h2>سجل الدخول</h2><p class="rep-note">عدد الجلسات: ' + R.sessions + ' • أيام التدريب: ' + R.logins.length + (R.lastSeen ? ' • آخر دخول: ' + new Date(R.lastSeen).toLocaleDateString('ar-SA') : '') + '</p>' +
    '<h2>آخر المحاولات</h2>' + (R.all.length ? '<table class="rep-table"><tr><th>المهمة</th><th>النوع</th><th>الدرجة</th><th>التاريخ</th></tr>' +
      R.all.slice(-15).reverse().map(a => '<tr><td style="text-align:right">' + esc(a.title) + '</td><td>' + (a.mode === 'mcq' ? 'اختبار' : a.mode === 'fig' ? 'رسوم' : 'مؤشر') + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') + '</table>'
      : '<p class="rep-note">لا توجد محاولات مسجّلة لهذه الطالبة بعد.</p>') +
    '<div class="rep-sign"><div>توقيع المعلمة: ........................</div><div>توقيع ولي الأمر: ........................</div></div></div>';
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
function sendStudentReport(id){
  const st = getRegistry().find(x => x.id === id);
  if(!st){ toast('لا توجد بيانات الطالبة'); return; }
  const txt = studentReportText(id);
  const list = getPlans();
  const rec = { id:'r' + Date.now() + '-' + Math.floor(Math.random() * 900), sid:id, name:st.name, type:'report',
    title:'📊 تقرير تقدمك', text:txt, date:today(), time:new Date().toLocaleTimeString('ar-SA'), read:false };
  list.push(rec);
  savePlans(list);
  if(typeof syncPushPlan === 'function') syncPushPlan(rec);
  renderSent();
  toast('تم إرسال تقرير ' + st.name + ' إليها 📩');
}
function requestStudentUpdate(id){
  const st = getRegistry().find(x => x.id === id);
  if(!st) return;
  if(typeof postMsg === 'function') postMsg(JSON.stringify({ t:'req', sid:id, name:st.name }), 'req');
  toast('تم إرسال طلب تحديث إلى ' + st.name + ' — ستتحدث بياناتها خلال ثوانٍ إن كانت متصلة 📡');
}
function buildAnalysisReport(){
  const from = ($('#tpFrom') && $('#tpFrom').value) || defaultWeek().from;
  const to = ($('#tpTo') && $('#tpTo').value) || defaultWeek().to;
  const A = buildAnalysis(from, to), T = A.totals;
  let html = '<div class="report"><div class="rep-head"><div><h1>التحليل البياني — إنجاز الطالبات</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الفترة:</b> ' + from + ' — ' + to + '</div><div><b>تاريخ الإصدار:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div>' +
    '<div><b>الطالبات:</b> ' + T.students + '</div><div><b>جلسات الدخول:</b> ' + T.sessions + ' (' + T.loginDays + ' يوماً)</div></div>' +
    (A.widened ? '<p class="rep-note">ملاحظة: وسّعتُ الفترة تلقائياً لتغطية كل الإنجازات المسجّلة.</p>' : '') +
    '<div class="rep-kpis"><div><b>' + T.students + '</b><span>طالبة</span></div>' +
    '<div><b>' + T.att + '</b><span>محاولة</span></div>' +
    '<div><b>' + T.accuracy + '%</b><span>متوسط الدقة</span></div>' +
    '<div><b>' + T.certs + '</b><span>شهادة</span></div></div>' +
    '<h2>متوسط الأداء في كل مجال</h2><table class="rep-table"><tr><th>المجال</th><th>الطالبات</th><th>المحاولات</th><th>متوسط آخر نتيجة</th><th>متوسط أفضل نتيجة</th><th>تحتاج دعماً</th></tr>' +
    A.fields.map(f => '<tr><td>' + f.code + ' — ' + f.title + '</td><td>' + f.n + '</td><td>' + f.atts + '</td><td>' + (f.n ? f.avgLast + '%' : '—') + '</td><td>' + (f.n ? f.avgBest + '%' : '—') + '</td><td>' + f.weak + '</td></tr>').join('') + '</table>' +
    '<h2>توزيع الدرجات</h2><table class="rep-table"><tr><th>الفئة</th><th>عدد المحاولات</th><th>النسبة</th></tr>' +
    A.dist.map(x => '<tr><td>' + x.l + '</td><td>' + x.c + '</td><td>' + (T.mcqAtt ? Math.round(x.c / T.mcqAtt * 100) + '%' : '—') + '</td></tr>').join('') + '</table>' +
    '<h2>اتجاه الإنجاز خلال الفترة</h2><table class="rep-table"><tr><th>اليوم</th><th>المحاولات</th><th>الطالبات النشطات</th><th>الدقة</th></tr>' +
    A.trend.map(x => '<tr><td>' + x.d + '</td><td>' + x.att + '</td><td>' + x.stu + '</td><td>' + (x.att ? x.acc + '%' : '—') + '</td></tr>').join('') + '</table>' +
    '<h2>أكثر المؤشرات تعثراً</h2>' + (A.indicators.length ? '<table class="rep-table"><tr><th>المجال</th><th>المؤشر</th><th>عدد الأخطاء</th><th>عدد الطالبات</th></tr>' +
      A.indicators.map(x => '<tr><td>' + x.code + ' — ' + x.title + '</td><td style="text-align:right">' + x.text + '</td><td>' + x.n + '</td><td>' + x.st + '</td></tr>').join('') + '</table>'
      : '<p class="rep-note">لا توجد أخطاء متكررة في هذه الفترة 🌟</p>') +
    '<h2>ترتيب الطالبات</h2><table class="rep-table"><tr><th>الطالبة</th><th>المدرسة</th><th>محاولات</th><th>الدقة</th><th>أفضل نتيجة</th><th>جلسات الدخول</th></tr>' +
    A.ranking.map(r => '<tr><td style="text-align:right">' + esc(r.st.name) + '</td><td>' + esc(r.st.school || '—') + '</td><td>' + r.w.inWeek.length + '</td><td>' + (r.w.mcqCount ? r.w.accuracy + '%' : '—') + '</td><td>' + (r.w.best ? r.w.best + '%' : '—') + '</td><td>' + r.w.sessions + '</td></tr>').join('') + '</table>' +
    '<div class="rep-sign"><div>توقيع المعلمة: ........................</div><div>توقيع ولي الأمر: ........................</div></div>' +
    '<p class="rep-foot">تحليل صادر من منصة «تدريب نافس علوم» — إدارة تعليم جيزان — إعداد المعلمة نعمة هرشان.</p></div>';
  return html;
}
function printAnalysis(){
  $('#printArea').innerHTML = buildAnalysisReport();
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
function analysisHTML(from, to){
  const A = buildAnalysis(from, to), T = A.totals;
  let h = '<h2>التحليل البياني</h2>' +
    '<table class="rep-table"><tr><th>المجال</th><th>الطالبات</th><th>المحاولات</th><th>متوسط آخر نتيجة</th><th>تحتاج دعماً</th></tr>' +
    A.fields.map(f => '<tr><td>' + f.code + ' — ' + f.title + '</td><td>' + f.n + '</td><td>' + f.atts + '</td><td>' + (f.n ? f.avgLast + '%' : '—') + '</td><td>' + f.weak + '</td></tr>').join('') + '</table>' +
    '<p class="rep-note"><b>توزيع الدرجات:</b> ' + A.dist.map(x => x.l + ': ' + x.c).join(' | ') + '</p>' +
    '<p class="rep-note"><b>اتجاه الأسبوع:</b> ' + A.trend.map(x => x.d.slice(5) + ' — ' + x.att + ' محاولات، دقة ' + (x.att ? x.acc + '%' : '—')).join(' | ') + '</p>' +
    '<p class="rep-note"><b>إجمالي المحاولات:</b> ' + T.att + ' • <b>اختبارات:</b> ' + T.mcqAtt + ' • <b>رسوم:</b> ' + T.figAtt + ' • <b>مهام مؤشر:</b> ' + T.taskAtt + ' • <b>شهادات:</b> ' + T.certs + '</p>';
  if(A.indicators.length){
    h += '<p><b>أكثر المؤشرات تعثراً:</b></p><ul>' + A.indicators.map(x => '<li>' + x.code + ' — ' + x.text + ' (' + x.n + ' خطأ من ' + x.st + ' طالبة)</li>').join('') + '</ul>';
  }
  return h;
}

/* ---------- خطة التحسين المقترحة (خطوات وتوصيات مبنية على البيانات) ---------- */
function improvementPlan(){
  const from = ($('#tpFrom') && $('#tpFrom').value) || defaultWeek().from;
  const to = ($('#tpTo') && $('#tpTo').value) || defaultWeek().to;
  const A = buildAnalysis(from, to), T = A.totals;
  const steps = [
    { t:'تشخيص أسبوعي', d:'صدري التقرير الأسبوعي والتحليل البياني، ثم حدّدي أكثر من شهر تعثّرت فيه الطالبات.' },
    { t:'خطة علاجية لكل طالبة', d:'افتحي ملف الطالبة من جدول الطالبات، وصدري لها خطة علاجية من صفحة «إنجازي»، واطبعيها كواجب بيتري.' },
    { t:'حصة مركزية على المؤشر المتعثر', d:'قائمة «أكثر المؤشرات تعثراً» تحدد المؤشر الأضعف — تخصيص حصة قصيرة لممارسته مع أمثلة من أسئلة الرسوم.' },
    { t:'مهمة مؤشر يومياً', d:'تكليف كل طالبة بمهمة مؤشر واحدة يومياً (5 دقائق) مع تقويم ذاتي بثلاث مستويات، وربطها بالخطوات في الخطة.' },
    { t:'إعادة اختبار منتقاة ثم كامل', d:'إعادة الأسئلة الخاطئة فقط قبل الاختبار الكامل لرفع الثقة، ثم اختبار كامل لقياس التقدّم.' },
    { t:'شهادة وتقرير أسبوعي', d:'شهادة بعد كل اختبار تمنح الطالبة دافعية، والتقرير الأسبوعي المطبوع بالأرقام يوثّق التحسّن للمعلم وولي الأمر.' }
  ];
  const weakFields = A.fields.filter(f => f.n && f.avgLast < 80);
  const perStudent = A.rows.map(r => ({
    name:r.st.name, acc:r.w.accuracy, att:r.w.inWeek.length, weak:r.w.weak,
    note: !r.w.allAttempts ? 'لم تبدأ — تُسجَّل أولًا وتدخل في حصة منظّمة'
      : (r.w.accuracy >= 80 ? 'متميزة — مهام إثراء وقيادة للمتقدمات' : 'تحتاج دعماً — خطة علاجية ومتابعة أسبوعية')
  }));
  return { from, to, steps, weakFields, perStudent, indicators:A.indicators, accuracy:T.accuracy,
           target: Math.min(95, Math.max(60, T.accuracy + 10)), students:T.students };
}
function improvementHTML(){
  const P = improvementPlan();
  let h = '<h2>خطة التحسين المقترحة</h2>' +
    '<p class="rep-note">الهدف المقترح: رفع متوسط الدقة من <b>' + P.accuracy + '%</b> إلى <b>' + P.target + '%</b> خلال أسبوعين، مع ' +
    (P.weakFields.length ? 'تركيز على <b>' + P.weakFields.length + '</b> مجال يحتاج دعماً.' : 'الحفاظ على المستوى وتوسيع التدريب بأسئلة الرسوم.') + '</p>' +
    '<h3>خطوات التحسين</h3><ol>' + P.steps.map(s => '<li><b>' + s.t + '</b> — ' + s.d + '</li>').join('') + '</ol>';
  if(P.weakFields.length){
    h += '<h3>المجالات المستهدفة</h3><table class="rep-table"><tr><th>المجال</th><th>الطالبات</th><th>متوسط آخر نتيجة</th><th>تحتاج دعماً</th><th>الإجراء المقترح</th></tr>' +
      P.weakFields.map(f => {
        const ff = BANK[f.sub].fields.find(x => x.code === f.code);
        const ind = (ff && ff.ind && ff.ind[0]) ? ff.ind[0] : '';
        return '<tr><td>' + f.code + ' — ' + f.title + '</td><td>' + f.n + '</td><td>' + f.avgLast + '%</td><td>' + f.weak + '</td>' +
          '<td style="text-align:right">مراجعة المؤشر: ' + ind + ' — ثم مهمة مؤشر + إعادة الأسئلة الخاطئة + اختبار الرسوم</td></tr>';
      }).join('') + '</table>';
  }
  if(P.indicators.length){
    h += '<h3>المؤشرات الأكثر تعثراً (تشخيص دقيق)</h3><ul>' + P.indicators.map(x => '<li>' + x.code + ' — ' + x.text + ' (' + x.n + ' خطأ من ' + x.st + ' طالبة)</li>').join('') + '</ul>';
  }
  h += '<h3>متابعة فردية لكل طالبة</h3><table class="rep-table"><tr><th>الطالبة</th><th>محاولات</th><th>الدقة</th><th>التوصية</th></tr>' +
    P.perStudent.map(p => '<tr><td style="text-align:right">' + esc(p.name) + '</td><td>' + p.att + '</td><td>' + (p.acc ? p.acc + '%' : '—') + '</td><td style="text-align:right">' + p.note + '</td></tr>').join('') + '</table>';
  return h;
}
function printImprovement(){
  const P = improvementPlan();
  const html = '<div class="report"><div class="rep-head"><div><h1>خطة التحسين الأسبوعية</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الفترة:</b> ' + P.from + ' — ' + P.to + '</div><div><b>الطالبات:</b> ' + P.students + '</div>' +
    '<div><b>متوسط الدقة الحالي:</b> ' + P.accuracy + '%</div><div><b>الهدف:</b> ' + P.target + '%</div></div>' +
    improvementHTML() +
    '<div class="rep-sign"><div>توقيع المعلمة: ........................</div><div>توقيع ولي الأمر: ........................</div></div>' +
    '<p class="rep-foot">خطة صادرة من منصة «تدريب نافس علوم» — إدارة تعليم جيزان — إعداد المعلمة نعمة هرشان.</p></div>';
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}

/* ---------- فتح لوحة المعلمة ---------- */
// رمز المعلمة مخزّن بصيغة أكواد حرفية حتى لا يظهر كنص واضح في الصفحة أو الكود
const TEACHER_PIN_CODE = [78, 73, 77, 65, 72];
const isTeacherPin = (v) => {
  const s = String(v == null ? '' : v).trim().toUpperCase();
  if(s.length !== TEACHER_PIN_CODE.length) return false;
  for(let i = 0; i < s.length; i++){ if(s.charCodeAt(i) !== TEACHER_PIN_CODE[i]) return false; }
  return true;
};
let teacherAuthed = false;
function teacherLogin(){
  if(isTeacherPin($('#teacherPin').value)){
    teacherAuthed = true;
    $('#teacherGate').hidden = true;
    $('#teacherBody').hidden = false;
    initTeacherDates();
    renderTeacher();
    syncPull(true).then(() => { if(!$('#teacherPanel').hidden) renderTeacher(); });
    toast('أهلاً بكِ أستاذة 👩‍🏫');
  } else toast('الرمز غير صحيح ❌');
}
function openTeacher(){
  $('#teacherPanel').hidden = false;
  if(teacherAuthed){ $('#teacherGate').hidden = true; $('#teacherBody').hidden = false; initTeacherDates(); renderTeacher(); syncPull(true).then(() => renderTeacher()); }
  else { $('#teacherGate').hidden = false; $('#teacherBody').hidden = true; $('#teacherPin').value = ''; }
}
function initTeacherDates(){
  const d = defaultWeek();
  const f = $('#tpFrom'), t = $('#tpTo');
  if(f && !f.value) f.value = d.from;
  if(t && !t.value) t.value = d.to;
}
on('#teacherBtn', () => openTeacher());
on('#tpClose', () => { $('#teacherPanel').hidden = true; if(!U.id) renderLoginGate(); });
on('#teacherPinBtn', () => teacherLogin());
on('#tpRefresh', () => { renderTeacher(); toast('تم تحديث التحليل ✅'); });
on('#tpWeekly', () => printWeekly(($('#tpFrom') || {}).value, ($('#tpTo') || {}).value));
on('#tpPrintAnalysis', () => printAnalysis());
on('#tpPrintPlan', () => printImprovement());
const tpin = $('#teacherPin');
if(tpin) tpin.addEventListener('keydown', e => { if(e.key === 'Enter') teacherLogin(); });


/* ---------- خطط الطالبات وإشعارات المعلمة ---------- */
const getPlans = () => gRaw('nafas_plans', []);
const savePlans = (p) => sRaw('nafas_plans', p);
const TRACK_LABEL = { '':'متوازنة', remedial:'تحتاج علاجي', enrichment:'إثرائي' };
function studentPlanList(sid, nm){
  return getPlans().filter(p => p.sid === sid || (nm && p.name && p.name === nm)).slice().reverse();
}
function unreadFor(sid, nm){ return studentPlanList(sid, nm).filter(p => !p.read).length; }
function studentFields(sid){
  const all = readUser(sid, 'attempts', []);
  const prog = readUser(sid, 'progress', {});
  const rows = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const fa = all.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
    if(!fa.length) return;
    const last = fa[fa.length - 1];
    const p = prog[sub + '|' + f.code];
    const inds = [];
    (last.wrong || []).forEach(i => { const q = f.mcq[i]; if(q && q.k !== undefined && f.ind[q.k]) inds.push(f.ind[q.k]); });
    rows.push({ sub, f, n:fa.length, last:last.score, best:((p && p.mcq && p.mcq.best) || 0), wrong:last.wrong || [], inds });
  }));
  return rows;
}
function buildRemedialPlan(sid){
  const st = getRegistry().find(x => x.id === sid);
  const rows = studentFields(sid).slice().sort((a, b) => a.last - b.last);
  const weak = rows.filter(r => r.last < 80);
  const all = readUser(sid, 'attempts', []);
  const mcq = all.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s, a) => s + (a.total || 0), 0);
  const totC = mcq.reduce((s, a) => s + (a.correct || 0), 0);
  const acc = pct(totC, totQ);
  const target = Math.min(95, Math.max(60, acc + 10));
  const w = weak[0];
  let text = 'أهلاً ' + ((st && st.name) || '') + ' — هذه خطتك العلاجية المخصصة 💪\n\n';
  text += 'الهدف: رفع متوسط درجتك من ' + acc + '% إلى ' + target + '% خلال أسبوعين.\n\n';
  if(w){
    text += '1) راجعي هذا المؤشر قبل الاختبار: ' + (w.inds[0] || w.f.ind.join(' / ')) + '\n';
    text += '2) المجال ' + w.f.code + ' (' + w.f.title + '): أعيدي حل هذه الأسئلة الخاطئة: ' + (w.wrong.map(i => i + 1).join('، ') || '—') + '\n';
    text += '3) أعيدي أسئلة الرسوم في هذا المجال لتثبيت الفهم البصري.\n';
  } else {
    text += '1) راجعي مؤشرات مجالك الأضعف في صفحة «إنجازي».\n';
  }
  text += '4) أكملي مهمة مؤشر واحدة يومياً (5 دقائق) مع تقويمك الذاتي.\n';
  text += '5) أعيدي الاختبار في نهاية الأسبوع باستهداف +10 درجات، وسجّلي تقدّمك في لوحة ولي الأمر.\n\n';
  text += 'أتمنى لكِ أسبوعاً موفقاً — معلمة: نعمة هرشان.';
  return { title:'خطة علاجية', text };
}
function buildEnrichmentPlan(sid){
  const st = getRegistry().find(x => x.id === sid);
  const rows = studentFields(sid).slice().sort((a, b) => b.best - a.best);
  const b = rows[0];
  const all = readUser(sid, 'attempts', []);
  const mcq = all.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s, a) => s + (a.total || 0), 0);
  const totC = mcq.reduce((s, a) => s + (a.correct || 0), 0);
  const acc = pct(totC, totQ);
  let text = 'أهلاً ' + ((st && st.name) || '') + ' — أنتِ متقدمة، وهذه خطتك الإثرائية 🌟\n\n';
  text += 'مستواك الحالي: ' + acc + '% — ونريد أن نطوّرك إلى مستوى إثرائي متقدم (90% فأكثر).\n\n';
  if(b){
    text += '1) مجال تميّزك: ' + b.f.code + ' (' + b.f.title + ') — ابحثي عن فكرة جديدة فيه واكتبيها في خمسة أسطر.\n';
    const extra = (b.f.tasks || []).slice(2, 5);
    if(extra.length) text += '2) مهام إثرائية: ' + extra.map(t => t.q).join('  •  ') + '\n';
  } else {
    text += '1) ابدئي بتدريب منظّم في أي مجال لتسجيل إنجازك.\n';
  }
  text += '3) أعيدي مجموعة أسئلة الرسوم الأخيرة وحلّلي سبب كل إجابة.\n';
  text += '4) أعيدي صياغة إجابات مهام المؤشر بكلماتك أنتِ ثم قارنيها بالإجابة النموذجية.\n';
  text += '5) اشرحي لأحد زميلاتك مؤشراً واحداً بأسلوبك المبسّط.\n';
  text += '6) اطلبي مني مهمة إثرائية إضافية عند إنهاء الخطة.\n\n';
  text += 'متيازة! — معلمة: نعمة هرشان';
  return { title:'خطة إثرائية', text };
}
function buildNotePlan(sid){
  const st = getRegistry().find(x => x.id === sid);
  return { title:'رسالة من المعلمة', text: 'أهلاً ' + ((st && st.name) || '') + ' — أحببتُ أن أبارك إنجازك، وواصلتِ التدريب بثقة ✨\nفقط أذكّركِ بالهدف الأسبوعي: 10 أسئلة يومياً + مهمة مؤشر.\nمعلمة: نعمة هرشان' };
}
function buildAchievementPlan(sid){
  const st = getRegistry().find(x => x.id === sid);
  const rows = studentFields(sid).slice().sort((a, b) => b.best - a.best);
  const all = readUser(sid, 'attempts', []);
  const certs = all.filter(a => a.score >= 60).length;
  const mcq = all.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s, a) => s + (a.total || 0), 0);
  const totC = mcq.reduce((s, a) => s + (a.correct || 0), 0);
  const acc = pct(totC, totQ);
  const best = rows[0];
  let text = 'مبروك ' + ((st && st.name) || '') + '! 🎉\n\n';
  text += 'منجزكِ ممتاز: متوسط دقتك ' + acc + '%';
  if(certs) text += '، وجمعتِ ' + certs + ' شهادة إنجاز';
  text += '.\n';
  if(best) text += 'أعلى نتيجة لك في مجال ' + best.f.code + ' (' + best.f.title + ') بـ ' + best.best + '%.\n';
  text += 'استمري على هذا المنوال، وأضع لكِ تحدياً إثرائياً جديداً هذا الأسبوع.\n\n';
  text += 'معلمة: نعمة هرشان';
  return { title:'إشعار إنجاز 🎉', text };
}
function buildStrugglePlan(sid){
  const st = getRegistry().find(x => x.id === sid);
  const rows = studentFields(sid).slice().sort((a, b) => a.last - b.last);
  const w = rows.find(r => r.last < 80) || rows[0];
  let text = 'أهلاً ' + ((st && st.name) || '') + ' — لاحظتُ نقطة تحتاج انتباهك ⚠️\n\n';
  if(w) text += 'أصعب مجال لديك حالياً: ' + w.f.code + ' (' + w.f.title + ') وآخر نتيجة فيه ' + w.last + '%.\n';
  text += 'لا بأس أبداً، والتعثر بداية تحسين:\n';
  text += '1) راجعي شرح الأسئلة الخاطئة في صفحة «إنجازي».\n';
  text += '2) أكملي مهمة مؤشر واحدة يومياً (5 دقائق).\n';
  text += '3) أعيدي الاختبار واستهدفي +10 درجات، ثم أخبريني بالنتيجة.\n\n';
  text += 'أنا معكِ — معلمة: نعمة هرشان';
  return { title:'إشعار تعثّر ⚠️', text };
}
const SEND_OPTIONS = [
  { k:'achievement', i:'🎉', t:'إشعار إنجاز', d:'تهنئة بالإنجاز وتحصيد ما أنجزتِه' },
  { k:'struggle', i:'⚠️', t:'إشعار تعثّر', d:'تنبيه لطالبة تحتاج دعماً فورياً' },
  { k:'remedial', i:'💊', t:'خطة علاجية', d:'مؤشرات مستهدفة + أسئلة خاطئة + هدف رقمي' },
  { k:'enrichment', i:'🌟', t:'خطة إثرائية', d:'مهام إثرائية وتحليل أعمق للمتميزات' },
  { k:'note', i:'💬', t:'رسالة / ملاحظة', d:'رسالة عامة أو تشجيع' }
];
function openSendMenu(sid){
  const st = getRegistry().find(x => x.id === sid);
  if(!st){ toast('لا توجد بيانات الطالبة'); return; }
  const box = $('#modalBox');
  box.innerHTML = '<h3>📩 إرسال إلى: ' + esc(st.name) + '</h3>' +
    '<p class="muted">اختاري نوع الرسالة — النص جاهز تلقائياً من بيانات الطالبة ويمكنك تعديله قبل الإرسال.</p>' +
    '<div class="send-menu">' + SEND_OPTIONS.map(o =>
      '<button class="send-opt" data-k="' + o.k + '"><span class="so-i">' + o.i + '</span><span class="so-t"><b>' + o.t + '</b><small>' + o.d + '</small></span></button>').join('') + '</div>' +
    '<div class="qfoot" style="justify-content:center"><button class="btn btn-ghost" id="sendMenuClose">إغلاق</button></div>';
  $('#modal').hidden = false;
  $('#sendMenuClose').onclick = () => { $('#modal').hidden = true; };
  box.querySelectorAll('.send-opt').forEach(b => b.onclick = () => { openSendPlan(sid, b.dataset.k); });
}
function openSendPlan(sid, type){
  const st = getRegistry().find(x => x.id === sid);
  if(!st) return;
  const plan = type === 'remedial' ? buildRemedialPlan(sid)
             : type === 'enrichment' ? buildEnrichmentPlan(sid)
             : type === 'achievement' ? buildAchievementPlan(sid)
             : type === 'struggle' ? buildStrugglePlan(sid)
             : buildNotePlan(sid);
  const box = $('#modalBox');
  box.innerHTML = '<div class="plan-send"><h3>' + plan.title + ' — ' + esc(st.name) + '</h3>' +
    '<p class="muted">سيظهر النص في «لوحتي» عند الطالبة مع إشعار، ويمكنك تعديله قبل الإرسال.</p>' +
    '<textarea id="planText" rows="12">' + esc(plan.text) + '</textarea>' +
    '<div class="qfoot" style="justify-content:center"><button class="btn btn-primary" id="planSendBtn">إرسال إلى الطالبة</button>' +
    '<button class="btn btn-ghost" id="planCancel">إلغاء</button></div></div>';
  $('#modal').hidden = false;
  $('#planCancel').onclick = () => { $('#modal').hidden = true; };
  $('#planSendBtn').onclick = () => {
    const txt = $('#planText').value.trim();
    if(!txt){ toast('اكتبي نص الرسالة ✍️'); return; }
    const list = getPlans();
    const rec = { id:'p' + Date.now() + '-' + Math.floor(Math.random() * 900), sid, name:st.name, type,
      title:plan.title, text:txt, date:today(), time:new Date().toLocaleTimeString('ar-SA'), read:false };
    list.push(rec);
    savePlans(list);
    if(type === 'remedial' || type === 'enrichment' || type === 'struggle'){
      const reg = getRegistry();
      const s2 = reg.find(x => x.id === sid);
      if(s2){ s2.track = (type === 'enrichment') ? 'enrichment' : 'remedial'; saveRegistry(reg); }
    }
    if(typeof syncPushPlan === 'function') syncPushPlan(rec);
    $('#modal').hidden = true;
    renderTeacher(); renderSent(); renderInbox();
    toast('تم إرسال ' + plan.title + ' إلى ' + st.name + ' ✅');
  };
}
function sendPlanToAll(type){
  const reg = getRegistry();
  if(!reg.length){ toast('لا توجد طالبات مسجلات'); return; }
  const list = getPlans();
  const now = Date.now();
  reg.forEach((st, i) => {
    const plan = type === 'improvement' ? { title:'خطة تحسين الصف', text:improvementPlanText() } : (type === 'remedial' ? buildRemedialPlan(st.id) : buildEnrichmentPlan(st.id));
    list.push({ id:'p' + (now + i), sid:st.id, type, title:plan.title, text:plan.text, date:today(), time:new Date().toLocaleTimeString('ar-SA'), read:false });
    if(type === 'remedial' || type === 'enrichment'){ st.track = type; }
  });
  savePlans(list);
  saveRegistry(reg);
  list.slice(-reg.length).forEach((p, i) => setTimeout(() => { if(typeof syncPushPlan === 'function') syncPushPlan(p); }, (i + 1) * 2600));
  renderTeacher(); renderSent();
  toast('تم إرسال الخطة إلى ' + reg.length + ' طالبة ✅');
}
function improvementPlanText(){
  const P = improvementPlan();
  let text = 'خطة تحسين هذا الأسبوع 🎯\n\nالهدف: رفع متوسط الدقة إلى ' + P.target + '% خلال أسبوعين.\n\nخطوات التحسين:\n';
  P.steps.forEach((s, i) => { text += (i + 1) + ') ' + s.t + ' — ' + s.d + '\n'; });
  if(P.weakFields.length){
    text += '\nالمجالات المستهدفة:\n';
    P.weakFields.forEach(f => { text += '• ' + f.code + ' — ' + f.title + ' (متوسط ' + f.avgLast + '%)\n'; });
  }
  text += '\nمعلمة: نعمة هرشان';
  return text;
}
function syncPushRead(ids){
  if(!syncEnabled() || !ids || !ids.length) return;
  const st = getRegistry().find(x => x.id === U.id);
  postMsg(JSON.stringify({ t:'read', id:U.id, name:(st && st.name) || profile.name || '', ids: ids.slice(0, 25) }), 'read');
}
function markPlanRead(id){
  const l = getPlans();
  const p = l.find(x => x.id === id);
  if(p){ p.read = true; p.readAt = Date.now(); savePlans(l); syncPushRead([id]); }
}
let inboxVisible = false, inboxT = null;
function markAllInboxRead(silent){
  const l = getPlans();
  const ids = [];
  l.forEach(p => { if((p.sid === U.id || (profile.name && p.name === profile.name)) && !p.read){ p.read = true; p.readAt = Date.now(); ids.push(p.id); } });
  if(ids.length){ savePlans(l); syncPushRead(ids); renderBell(); }
  if(!silent && ids.length) renderInbox();
  return ids;
}
function checkInboxVisible(){
  const card = $('#inboxCard');
  if(!card) return;
  const r = card.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  if(!r.height || !vh){ inboxVisible = false; return; }
  const shown = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  inboxVisible = (shown / Math.min(r.height, vh)) >= 0.3;
  if(inboxVisible) markAllInboxRead(false);
}
function watchInboxRead(){
  window.removeEventListener('scroll', scheduleInboxCheck);
  window.addEventListener('scroll', scheduleInboxCheck, { passive:true });
  window.removeEventListener('resize', scheduleInboxCheck);
  window.addEventListener('resize', scheduleInboxCheck);
  setTimeout(checkInboxVisible, 350);
}
function scheduleInboxCheck(){
  if(inboxT) clearTimeout(inboxT);
  inboxT = setTimeout(checkInboxVisible, 350);
}
function renderInbox(){
  const box = $('#inboxList');
  if(!box) return;
  if(inboxVisible) markAllInboxRead(true);
  const list = studentPlanList(U.id, profile.name);
  const st = getRegistry().find(x => x.id === U.id);
  const track = st ? (st.track || '') : '';
  const head = st ? '<p class="muted" style="margin:0 0 8px">مسارك الحالي: <b>' + (TRACK_LABEL[track] || 'متوازنة') + '</b></p>' : '';
  box.innerHTML = head + (list.length ? list.map(p =>
    '<div class="plan-msg ' + p.type + '"><div class="pm-head"><b>' + esc(p.title) + '</b><small>' + p.date + ' • ' + (p.time || '') + '</small></div>' +
    '<div class="pm-text">' + esc(p.text) + '</div>' +
    '<div class="pm-foot">' + (p.read ? '<span class="muted">✅ تمت القراءة</span>'
      : '<button class="btn btn-soft btn-sm" data-read="' + p.id + '">تحديد كمقروء</button>') + '</div></div>').join('')
    : '<div class="empty">لا توجد رسائل بعد — ستظهر هنا خطتك أو إشعار معلمة فور إرساله.</div>');
  box.querySelectorAll('[data-read]').forEach(b => b.onclick = () => { markPlanRead(b.dataset.read); renderInbox(); renderBell(); });
}
function renderBell(){
  const n = unreadFor(U.id, profile.name);
  const dot = $('#bellDot');
  if(dot){ dot.hidden = n === 0; dot.textContent = n; }
  const btn = $('#bellBtn');
  if(btn) btn.classList.toggle('has', n > 0);
}
function openInbox(){
  const list = studentPlanList(U.id, profile.name);
  const box = $('#modalBox');
  box.innerHTML = '<h3>📬 لوحتي — الخطة والإشعارات</h3>' +
    (list.length ? list.map(p => '<div class="plan-msg ' + p.type + '"><div class="pm-head"><b>' + esc(p.title) + '</b><small>' + p.date + '</small></div><div class="pm-text">' + esc(p.text) + '</div></div>').join('')
      : '<div class="empty">لا توجد رسائل</div>') +
    '<div class="qfoot" style="justify-content:center"><button class="btn btn-ghost" id="inboxClose">إغلاق</button></div>';
  $('#modal').hidden = false;
  $('#inboxClose').onclick = () => { $('#modal').hidden = true; };
  markAllInboxRead(false);
}
function renderSent(){
  const box = $('#tpSent');
  if(!box) return;
  const list = getPlans().slice().reverse();
  const reg = getRegistry();
  box.innerHTML = list.length ? list.map(p => {
    const st = reg.find(x => x.id === p.sid);
    return '<div class="review-row"><div class="rq">' + esc(p.title) + ' — ' + esc(st ? st.name : (p.name || '—')) + '</div>' +
      '<div class="rr">' + p.date + ' • ' + (p.time || '') + ' ' + (p.read ? '<b style="color:#15803d">✅ تمت قراءتها</b>' + (p.readAt ? ' <span class="muted">' + new Date(p.readAt).toLocaleTimeString('ar-SA') + '</span>' : '') : '<b style="color:#b45309">⏳ لم تُقرأ بعد</b>') +
      ' <button class="btn btn-ghost btn-sm" data-delsent="' + p.id + '">حذف</button></div></div>';
  }).join('') : '<div class="empty">لم تُرسل أي خطة بعد.</div>';
  box.querySelectorAll('[data-delsent]').forEach(b => b.onclick = () => {
    savePlans(getPlans().filter(p => p.id !== b.dataset.delsent));
    renderSent(); renderInbox();
  });
}
on('#bellBtn', () => openInbox());
on('#tpSendAllImprove', () => sendPlanToAll('improvement'));
on('#tpSendAllRemedial', () => sendPlanToAll('remedial'));
on('#tpSendAllEnrich', () => sendPlanToAll('enrichment'));
on('#tpSendTop5', () => sendTopFive());
on('#tpPrintTop5', () => printTopFive());
on('#tpImageTop5', () => saveTopFiveImage());
on('#tpCopyImgTop5', () => copyTopFiveImage());
on('#tpCopyTop5', () => copyTopFive());


/* ---------- اختيار الدور في شاشة الدخول ---------- */
function fillParentStudents(){
  const sel = $('#lgParentStudent');
  if(!sel) return;
  const reg = getRegistry();
  sel.innerHTML = reg.length
    ? reg.map(s => '<option value="' + s.id + '">' + esc(s.name) + (s.school ? ' — ' + esc(s.school) : '') + '</option>').join('')
    : '<option value="">لا توجد طالبات مسجلات على هذا الجهاز</option>';
}
function showLoginRole(role){
  const roles = $('#lgRoles'), sv = $('#lgStudentView'), tv = $('#lgTeacherView'), pv = $('#lgParentView'), back = $('#lgBackRoles');
  const title = $('#lgTitle'), sub = $('#lgSubtitle');
  const hide = (e) => { if(e) e.hidden = true; };
  const show = (e) => { if(e) e.hidden = false; };
  if(role === 'student'){
    hide(roles); show(sv); hide(tv); hide(pv); show(back);
    if(title) title.textContent = 'دخول الطالبة 👩‍🎓';
    if(sub) sub.textContent = 'اختاري اسمك للمتابعة، أو سجّلي حساباً جديداً.';
  } else if(role === 'teacher'){
    hide(roles); hide(sv); show(tv); hide(pv); show(back);
    if(title) title.textContent = 'دخول المعلمة 🎓';
    if(sub) sub.textContent = 'أدخلي الرمز السري للمعلمة للوصول إلى لوحة المتابعة والتحليل.';
    const p = $('#lgTeacherPin');
    if(p){ p.value = ''; setTimeout(() => { try { p.focus(); } catch(e){} }, 80); }
  } else if(role === 'parent'){
    hide(roles); hide(sv); hide(tv); show(pv); show(back);
    fillParentStudents();
    if(title) title.textContent = 'دخول ولي الأمر 👨‍👩‍👧';
    if(sub) sub.textContent = 'متابعة ابنتك فقط: تقدّمها ودرجاتها وأوسمتها وتقاريرها.';
    const pp = $('#lgParentPin'); if(pp){ pp.value = ''; }
  } else {
    show(roles); hide(sv); hide(tv); hide(pv); hide(back);
    if(title) title.textContent = 'من أنتِ؟ 👋';
    if(sub) sub.textContent = 'اختاري طريقة الدخول — يمكنك تغييرها في أي وقت.';
  }
}
function parentGateLogin(){
  const sel = $('#lgParentStudent');
  const sid = sel ? sel.value : '';
  const st = getRegistry().find(x => x.id === sid);
  const v = (($('#lgParentPin') || {}).value || '').trim();
  const pv = String(gRaw('nafes_pin', APP.pin));
  if(!st){ toast('اختاري اسم ابنتك أولاً'); return; }
  if(v !== pv){ toast('رمز ولي الأمر غير صحيح ❌'); return; }
  U.id = sid;
  localStorage.setItem('nafas_active', sid);
  loadUserData();
  $('#loginGate').hidden = true;
  $('#parentGate').hidden = true;
  $('#parentBody').hidden = false;
  go('parent');
  renderParent();
  toast('أهلاً بولي الأمر — متابعة ' + st.name);
}
function teacherGateLogin(){
  const inp = $('#lgTeacherPin');
  const v = inp ? inp.value.trim() : '';
  if(isTeacherPin(v)){
    teacherAuthed = true;
    $('#loginGate').hidden = true;
    toast('أهلاً بكِ أستاذة 👩‍🏫');
    openTeacher();
  } else {
    toast('الرمز غير صحيح ❌');
    if(inp){ inp.value = ''; try { inp.focus(); } catch(e){} }
  }
}
on('#roleStudent', () => showLoginRole('student'));
on('#roleTeacher', () => showLoginRole('teacher'));
on('#roleParent', () => showLoginRole('parent'));
on('#lgParentGo', () => parentGateLogin());
on('#lgBackRoles', () => showLoginRole(''));
on('#lgTeacherGo', () => teacherGateLogin());
const lpp = $('#lgParentPin');
if(lpp) lpp.addEventListener('keydown', e => { if(e.key === 'Enter') parentGateLogin(); });
const tpAll = $('#tpAllTime');
if(tpAll) tpAll.onchange = () => { if(!tpAll.checked){ const d = defaultWeek(); const f = $('#tpFrom'), t2 = $('#tpTo'); if(f) f.value = d.from; if(t2) t2.value = d.to; } renderTeacher(); };
const lgp = $('#lgTeacherPin');
if(lgp) lgp.addEventListener('keydown', e => { if(e.key === 'Enter') teacherGateLogin(); });

/* ---------- كل الفترات + تصدير بيانات الطالبة للمعلمة ---------- */
function allTimeRange(){
  let min = null;
  getRegistry().forEach(st => {
    readUser(st.id, 'attempts', []).forEach(a => { if(!min || a.date < min) min = a.date; });
    Object.keys(st.logins || {}).forEach(d => { if(!min || d < min) min = d; });
  });
  return { from: min || defaultWeek().from, to: today() };
}
function exportStudentData(){
  const st = getRegistry().find(x => x.id === U.id);
  if(!st){ toast('لا توجد بيانات للتصدير'); return; }
  const data = { app:'nafas-training-3m', version:1, kind:'student', exportedAt:new Date().toISOString(),
    students: [{ id:st.id, name:st.name, school:st.school, cls:st.cls, firstSeen:st.firstSeen, lastSeen:st.lastSeen,
      sessions:st.sessions, logins:st.logins, track:st.track || '',
      profile: readUser(st.id,'profile',{}), progress: readUser(st.id,'progress',{}), attempts: readUser(st.id,'attempts',[]) }],
    plans: getPlans().filter(p => p.sid === st.id) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'بيانات-' + (st.name || 'طالبة').replace(/\s+/g, '-') + '-' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  toast('تم تصدير بياناتك — أرسلي الملف لمعلمتك 📤');
}
/* ---------- المزامنة السحابية: ظهور نتائج الطالبات مباشرة عند المعلمة ---------- */
const SYNC_DEFAULT_CODE = 'nafas-jizan-2026';
const SYNC = { last: 0, pulling: false, blockUntil: 0, lastFull: 0 };
function appVersion(){ try { const s = document.querySelector('script[src*="app.js"]'); const m = /v=(\d+)/.exec(s.src); return m ? m[1] : '?'; } catch(e){ return '?'; } }
(function(){ const v = $('#appVer'); if(v) v.textContent = 'v' + appVersion(); })();
function syncCode(){ return (gRaw('nafas_sync_code', '') || SYNC_DEFAULT_CODE); }
function saveSyncCode(c){ sRaw('nafas_sync_code', c || SYNC_DEFAULT_CODE); }
function syncEnabled(){ return gRaw('nafas_sync_on', true) !== false; }
function setSyncEnabled(v){ sRaw('nafas_sync_on', !!v); }
function syncTopic(){ return syncCode(); }
function syncUrl(q){ return 'https://ntfy.sh/' + encodeURIComponent(syncTopic()) + (q || ''); }
(function(){
  const m = /[?&]code=([^&#]+)/.exec(location.search);
  if(m) saveSyncCode(decodeURIComponent(m[1]));
})();
function studentCompact(){
  const st = getRegistry().find(x => x.id === U.id);
  if(!st) return null;
  const raw = readUser(U.id, 'attempts', []);
  const att = raw.map(a => ({ mode:a.mode, subject:a.subject, field:a.field, title:a.title, score:a.score,
    correct:a.correct, total:a.total, answered:a.answered || 0, hints:a.hints || 0, retry:!!a.retry,
    wrong:(a.wrong || []).slice(0, 12), date:a.date, time:a.time || '' }));
  const prog = {};
  const pr = readUser(U.id, 'progress', {});
  Object.keys(pr).forEach(k => { const p = pr[k] || {};
    prog[k] = { b:(p.mcq && p.mcq.best) || 0, a:(p.mcq && p.mcq.attempts) || 0, c:(p.mcq && p.mcq.correct) || 0,
                t:(p.tasks && p.tasks.done) || 0, fb:(p.fig && p.fig.best) || 0, fa:(p.fig && p.fig.attempts) || 0 }; });
  const logins = {};
  Object.keys(st.logins || {}).sort().slice(-60).forEach(d => { logins[d] = st.logins[d]; });
  return { id:st.id, name:st.name, school:st.school, cls:st.cls || '', track:st.track || '',
    firstSeen:st.firstSeen, lastSeen:st.lastSeen, sessions:st.sessions || 0, logins:logins,
    profile:readUser(U.id, 'profile', {}), progress:prog, n:att.length };
}
function postMsg(body, title){
  // طلب بسيط (بدون ترويسات مخصّصة) لتجنّب preflight ومنع حجب CORS
  try{
    return fetch(syncUrl(''), { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:body })
      .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return true; })
      .catch(() => { syncQueuePush(body); return false; });
  }catch(e){ syncQueuePush(body); return false; }
}
function syncQueue(){ return gRaw('nafas_sync_queue', []); }
function syncQueuePush(body){
  const q = syncQueue();
  q.push(body);
  sRaw('nafas_sync_queue', q.slice(-30));
}
function syncFlushQueue(){
  const q = syncQueue();
  if(!q.length) return;
  const rest = [];
  q.forEach(body => {
    fetch(syncUrl(''), { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body })
      .then(r => { if(!r.ok) rest.push(body); })
      .catch(() => rest.push(body));
  });
  setTimeout(() => { sRaw('nafas_sync_queue', rest); }, 2500);
}
let syncPushTimer = null;
function syncPush(){
  if(!syncEnabled()) return;
  const rec = studentCompact();
  if(!rec) return;
  const att = readUser(U.id, 'attempts', []).map(a => ({ mode:a.mode, subject:a.subject, field:a.field, title:a.title,
    score:a.score, correct:a.correct, total:a.total, answered:a.answered || 0, hints:a.hints || 0, retry:!!a.retry,
    wrong:(a.wrong || []).slice(0, 10), date:a.date, time:a.time || '' }));
  rec.n = att.length;
  rec.reads = getPlans().filter(p => (p.sid === U.id || (profile.name && p.name === profile.name)) && p.read).map(p => p.id).slice(-20);
  // رسالة واحدة مضغوطة (الخدمة تحدّ الطلبات، فنرسل رسالة واحدة كل مرة)
  let items = att.slice(-12);
  let body = JSON.stringify({ t:'rec', rec: Object.assign({}, rec, { att: items }) });
  while(body.length > 3400 && items.length > 1){
    items = items.slice(Math.ceil(items.length / 2));
    body = JSON.stringify({ t:'rec', rec: Object.assign({}, rec, { att: items }) });
  }
  if(body.length > 3400){
    const light = Object.assign({}, rec);
    delete light.logins; light.progress = {};
    body = JSON.stringify({ t:'rec', rec: light });
  }
  postMsg(body, 'rec');
  SYNC.last = Date.now();
  sRaw('nafas_sync_last', SYNC.last);
}
function syncPushSoon(){
  if(syncPushTimer) clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(() => { syncPushTimer = null; syncPush(); }, 3000);
}
function syncPushAll(){
  if(!syncEnabled()){ toast('المزامنة غير مفعّلة'); return; }
  if(!U.id){ toast('سجّلي دخولك أولاً'); return; }
  const rec = studentCompact();
  if(!rec){ toast('لا توجد بيانات لإرسالها'); return; }
  const att = readUser(U.id, 'attempts', []).map(a => ({ mode:a.mode, subject:a.subject, field:a.field, title:a.title,
    score:a.score, correct:a.correct, total:a.total, answered:a.answered || 0, hints:a.hints || 0, retry:!!a.retry,
    wrong:(a.wrong || []).slice(0, 10), date:a.date, time:a.time || '' }));
  if(!att.length){ toast('لا توجد محاولات لإرسالها بعد'); return; }
  const chunks = [];
  for(let i = 0; i < att.length; i += 6) chunks.push(att.slice(i, i + 6));
  chunks.forEach((items, i) => setTimeout(() => {
    postMsg(JSON.stringify({ t:'rec', rec: Object.assign({}, rec, { att: items }) }), 'rec');
  }, i * 2600));
  toast('جارٍ إرسال كل إنجازاتك (' + att.length + ' محاولة) إلى المعلمة… 📤');
}
function attKey(a){
  return [a.mode, a.subject, a.field, a.date, a.time || '', a.score, a.correct, a.total, a.answered || 0].join('|');
}
function mergeAttemptLists(local, incoming){
  const map = {};
  (local || []).forEach(a => { map[attKey(a)] = a; });
  (incoming || []).forEach(a => { const k = attKey(a); if(!map[k]) map[k] = a; });
  return Object.keys(map).map(k => map[k]).sort((x, y) => {
    const a = (x.date || '') + ' ' + (x.time || ''), b = (y.date || '') + ' ' + (y.time || '');
    return a < b ? -1 : a > b ? 1 : 0;
  });
}
function mergeProgressData(local, incoming){
  const out = {};
  Object.keys(local || {}).forEach(k => { out[k] = local[k]; });
  Object.keys(incoming || {}).forEach(k => {
    const a = out[k] || {}, b = incoming[k] || {};
    const am = a.mcq || {}, bm = b.mcq || {}, at2 = a.tasks || {}, bt = b.tasks || {}, af = a.fig || {}, bf = b.fig || {};
    out[k] = {
      mcq: { best: Math.max(am.best || 0, bm.best || 0), attempts: Math.max(am.attempts || 0, bm.attempts || 0), correct: Math.max(am.correct || 0, bm.correct || 0) },
      tasks: { done: Math.max(at2.done || 0, bt.done || 0) },
      fig: { best: Math.max(af.best || 0, bf.best || 0), attempts: Math.max(af.attempts || 0, bf.attempts || 0) },
      last: a.last || b.last || 0
    };
  });
  return out;
}
function normName(s){ return String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim(); }
function resolveSyncId(id, name, school){
  const al = gRaw('nafas_sync_alias', {});
  if(al[id]) return al[id];
  const reg = getRegistry();
  if(reg.some(x => x.id === id)) return id;
  const nm = normName(name);
  if(nm){
    let twins = reg.filter(x => normName(x.name) === nm && x.id !== id);
    if(school) twins = twins.filter(x => !x.school || normName(x.school) === normName(school));
    if(twins.length === 1){
      al[id] = twins[0].id;
      sRaw('nafas_sync_alias', al);
      return twins[0].id;
    }
    // اسم مختصر في سجل المعلمة (مثل «روزلين») يقابل الاسم الكامل القادم من جهاز الطالبة
    const empties = reg.filter(x => x.id !== id && !readUser(x.id, 'attempts', []).length);
    const pref = empties.filter(x => {
      const a = normName(x.name);
      if(!a || a.length < 3) return false;
      const short = a.length < nm.length ? a : nm;
      const long = a.length < nm.length ? nm : a;
      return long.indexOf(short) === 0 && (long.length === short.length || long.charAt(short.length) === ' ');
    });
    if(pref.length === 1){
      al[id] = pref[0].id;
      sRaw('nafas_sync_alias', al);
      return pref[0].id;
    }
  }
  return id;
}
function materializeSync(id){
  const cache = gRaw('nafas_sync_cache', {});
  const c = cache[id];
  if(!c || !c.rec) return false;
  const rec = c.rec;
  id = resolveSyncId(id, rec.name, rec.school);
  const reg = getRegistry();
  let st = reg.find(x => x.id === id);
  if(!st){
    st = { id, name:rec.name || 'طالبة', school:rec.school || '', cls:rec.cls || '',
           firstSeen:rec.firstSeen || Date.now(), lastSeen:rec.lastSeen || Date.now(), sessions:0, logins:{} };
    reg.push(st);
  }
  if(rec.name) st.name = rec.name;
  if(rec.school) st.school = rec.school;
  if(rec.cls) st.cls = rec.cls;
  if(rec.track) st.track = rec.track;
  st.firstSeen = Math.min(st.firstSeen || Date.now(), rec.firstSeen || Date.now());
  st.lastSeen = Math.max(st.lastSeen || 0, rec.lastSeen || 0);
  st.sessions = Math.max(st.sessions || 0, rec.sessions || 0);
  st.logins = st.logins || {};
  Object.keys(rec.logins || {}).forEach(d => { st.logins[d] = Math.max(st.logins[d] || 0, rec.logins[d]); });
  saveRegistry(reg);
  const parts = c.parts || {};
  const atts = [];
  Object.keys(parts).map(Number).sort((a, b) => a - b).forEach(i => (parts[i] || []).forEach(a => atts.push(a)));
  const incoming = (rec.att && rec.att.length) ? rec.att : atts;
  const curAtt = readUser(id, 'attempts', []);
  const merged = mergeAttemptLists(curAtt, incoming);
  if(merged.length && merged.length !== curAtt.length) writeUser(id, 'attempts', merged);
  if(rec.progress && Object.keys(rec.progress).length){
    const prog = {};
    Object.keys(rec.progress).forEach(k => { const p = rec.progress[k];
      prog[k] = { mcq:{ best:p.b || 0, attempts:p.a || 0, correct:p.c || 0 }, tasks:{ done:p.t || 0 },
                  fig:{ best:p.fb || 0, attempts:p.fa || 0 }, last:0 }; });
    writeUser(id, 'progress', mergeProgressData(readUser(id, 'progress', {}), prog));
  }
  if(rec.profile){
    const curProf = readUser(id, 'profile', {});
    const mergedProf = Object.assign({}, curProf);
    Object.keys(rec.profile).forEach(k => { if(rec.profile[k] && !mergedProf[k]) mergedProf[k] = rec.profile[k]; });
    writeUser(id, 'profile', mergedProf);
  }
  if(rec.reads && rec.reads.length){
    const pl = getPlans();
    let hit = false;
    pl.forEach(p => { if(rec.reads.indexOf(p.id) >= 0 && !p.read){ p.read = true; p.readAt = Date.now(); hit = true; } });
    if(hit) savePlans(pl);
  }
  return true;
}
function syncPull(full){
  if(!syncEnabled() || SYNC.pulling) return Promise.resolve(0);
  if(SYNC.blockUntil && Date.now() < SYNC.blockUntil) return Promise.resolve(0);
  SYNC.pulling = true;
  if(full) SYNC.lastFull = Date.now();
  const teacherOpen = $('#teacherPanel') && !$('#teacherPanel').hidden;
  const since = full ? 'all' : (teacherOpen ? '30m' : Math.floor((gRaw('nafas_sync_since', 0) || (Date.now() - 36 * 3600 * 1000)) / 1000));
  return fetch(syncUrl('/json?poll=1&since=' + since), { headers:{ 'Accept':'application/json' } })
    .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(txt => {
      const lines = String(txt || '').split('\n').filter(Boolean);
      const cache = gRaw('nafas_sync_cache', {});
      let changed = false;
      lines.forEach(line => {
        let m; try { m = JSON.parse(line); } catch(e){ return; }
        if(!m || m.event !== 'message' || !m.message) return;
        let p; try { p = JSON.parse(m.message); } catch(e){ return; }
        if(p.t === 'rec' && p.rec && p.rec.id){
          if(!cache[p.rec.id]) cache[p.rec.id] = { rec:null, parts:{} };
          const prev = cache[p.rec.id].rec || {};
          const next = Object.assign({}, prev, p.rec);
          next.att = mergeAttemptLists(prev.att || [], p.rec.att || []);
          if((!p.rec.progress || !Object.keys(p.rec.progress).length) && prev.progress) next.progress = prev.progress;
          next.profile = Object.assign({}, prev.profile || {});
          Object.keys(p.rec.profile || {}).forEach(k => { if(p.rec.profile[k]) next.profile[k] = p.rec.profile[k]; });
          next.reads = Array.from(new Set([].concat(prev.reads || [], p.rec.reads || [])));
          const lg = Object.assign({}, prev.logins || {});
          Object.keys(p.rec.logins || {}).forEach(d => { lg[d] = Math.max(lg[d] || 0, p.rec.logins[d] || 0); });
          next.logins = lg;
          next.firstSeen = Math.min(prev.firstSeen || Infinity, p.rec.firstSeen || Infinity);
          if(!isFinite(next.firstSeen)) next.firstSeen = p.rec.firstSeen || prev.firstSeen || Date.now();
          next.lastSeen = Math.max(prev.lastSeen || 0, p.rec.lastSeen || 0);
          next.sessions = Math.max(prev.sessions || 0, p.rec.sessions || 0);
          ['name','school','cls','track'].forEach(k => { if(!next[k] && prev[k]) next[k] = prev[k]; });
          cache[p.rec.id].rec = next;
          changed = true;
        } else if(p.t === 'att' && p.id){
          if(!cache[p.id]) cache[p.id] = { rec:null, parts:{} };
          cache[p.id].parts = cache[p.id].parts || {};
          cache[p.id].parts[p.part] = p.items;
          changed = true;
        } else if(p.t === 'req' && p.sid){
          if(p.sid === U.id || (p.name && p.name === profile.name)){
            setTimeout(() => { syncPush(); }, 500);
          }
        } else if(p.t === 'plan' && p.plan && p.plan.id){
          const pl = getPlans();
          if(!pl.some(x => x.id === p.plan.id)){
            pl.push(p.plan);
            savePlans(pl);
            changed = true;
          }
        } else if(p.t === 'read' && p.ids){
          const pl = getPlans();
          let hit = false;
          pl.forEach(x => { if(p.ids.indexOf(x.id) >= 0 && !x.read){ x.read = true; x.readAt = Date.now(); hit = true; } });
          if(hit){ savePlans(pl); changed = true; }
        }
      });
      if(changed) sRaw('nafas_sync_cache', cache);
      Object.keys(cache).forEach(materializeSync);
      sRaw('nafas_sync_since', Date.now());
      SYNC.last = Date.now();
      sRaw('nafas_sync_last', SYNC.last);
      return changed ? lines.length : 0;
    })
    .catch(() => { SYNC.blockUntil = Date.now() + 60000; return 0; })
    .then(v => { SYNC.pulling = false; return v; });
}
function syncStatusText(){
  const on = syncEnabled();
  const last = gRaw('nafas_sync_last', 0);
  const t = last ? new Date(last).toLocaleTimeString('ar-SA') : '—';
  return (on ? '✅ المزامنة مفعّلة' : '⛔ المزامنة متوقفة') + ' • رمز الصف: ' + syncCode() + ' • آخر تحديث: ' + t;
}
function syncPushPlan(plan){
  if(!syncEnabled() || !plan) return;
  postMsg(JSON.stringify({ t:'plan', plan: plan }), 'nafas-plan');
}
function startSyncLoop(){
  if(syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    syncFlushQueue();
    const teacherOpen = $('#teacherPanel') && !$('#teacherPanel').hidden;
    if(teacherOpen){
      const full = !SYNC.lastFull || (Date.now() - SYNC.lastFull > 300000);
      syncPull(full).then(() => { if(typeof renderTeacher === 'function') renderTeacher(); });
    } else if(U.id){
      syncPull().then(() => { renderInbox(); renderBell(); });
    }
  }, 12000);
  if(syncKeepTimer) clearInterval(syncKeepTimer);
  syncKeepTimer = setInterval(() => { if(U.id && syncEnabled()) syncPush(); }, 600000);
}
let syncKeepTimer = null;
let syncTimer = null;
on('#syncNow', () => { syncPull(true).then(n => { if(typeof renderTeacher === 'function') renderTeacher(); toast(n ? 'تمت استعادة ' + n + ' سجلاً من السحابة ✅' : 'لا جديد — تحققي من تفعيل المزامنة ورمز الصف'); }); });
on('#appReload', () => {
  const u = new URL(location.href);
  u.searchParams.set('r', String(Date.now()));
  location.href = u.toString();
});
on('#syncToggle', () => { setSyncEnabled(!syncEnabled()); renderTeacher(); toast(syncEnabled() ? 'تم تفعيل المزامنة ✅' : 'تم إيقاف المزامنة'); });
on('#syncCopy', () => {
  const link = location.origin + location.pathname + '?code=' + encodeURIComponent(syncCode());
  const ta = document.createElement('textarea');
  ta.value = link; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('تم نسخ رابط الصف 📋 — أرسليه للطالبات'); }
  catch(e){ prompt('انسخي الرابط وأرسليه للطالبات:', link); }
  ta.remove();
});
on('#syncStopMine', () => { setSyncEnabled(!syncEnabled()); renderHub(); toast(syncEnabled() ? 'تم إرسال تقدمك للمعلمة ✅' : 'تم إيقاف الإرسال للمعلمة'); });
on('#syncSendAll', () => syncPushAll());
on('#syncSaveCode', () => {
  const v = ($('#syncCodeInput') ? $('#syncCodeInput').value : '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if(!v){ toast('اكتبي رمز صف صحيحاً'); return; }
  saveSyncCode(v);
  sRaw('nafas_sync_since', 0);
  if($('#syncCodeInput')) $('#syncCodeInput').value = v;
  renderTeacher();
  toast('تم حفظ رمز الصف: ' + v + ' ✅ — أرسلي الرابط الجديد للطالبات');
});


/* ---------- الأوسمة التحفيزية والمراكز ---------- */
function studentStreak(id){
  const all = readUser(id, 'attempts', []);
  const days = [...new Set(all.map(a => a.date))].sort().reverse();
  if(!days.length) return 0;
  let s = 1;
  for(let i = 0; i < days.length - 1; i++){
    if(daysBetween(days[i + 1], days[i]) === 1) s++; else break;
  }
  return s;
}
function maxStreak(id){
  const all = readUser(id, 'attempts', []);
  const st = getRegistry().find(x => x.id === id) || { logins:{} };
  const days = [...new Set(all.map(a => a.date).concat(Object.keys(st.logins || {})))].filter(Boolean).sort();
  let best = 0, cur = 0, prev = null;
  days.forEach(d => {
    if(prev && daysBetween(prev, d) === 1) cur++; else cur = 1;
    if(cur > best) best = cur;
    prev = d;
  });
  return best;
}
function bestAvgEver(id){
  const mcq = readUser(id, 'attempts', []).filter(a => a.mode === 'mcq');
  let c = 0, t = 0, best = 0;
  mcq.forEach(a => {
    c += a.correct || 0; t += a.total || 0;
    const av = t ? Math.round(c / t * 100) : 0;
    if(av > best) best = av;
  });
  return best;
}
function medalsFor(id){
  const all = readUser(id, 'attempts', []);
  const prog = readUser(id, 'progress', {});
  const mcq = all.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s, a) => s + (a.total || 0), 0);
  const totC = mcq.reduce((s, a) => s + (a.correct || 0), 0);
  const acc = pct(totC, totQ);
  const bestAv = Math.max(acc, bestAvgEver(id));
  const tasksDone = Object.keys(prog).reduce((s, k) => s + ((prog[k].tasks && prog[k].tasks.done) || 0), 0);
  const streak = maxStreak(id);
  const m = [];
  if(all.length) m.push({ i:'🌱', n:'البداية', d:'أول إنجاز منجز' });
  if(all.length >= 5) m.push({ i:'📚', n:'المجتهدة', d:'٥ محاولات أو أكثر' });
  if(all.some(a => a.score === 100)) m.push({ i:'💯', n:'التفوق', d:'اختبار بدرجة كاملة' });
  if(all.some(a => a.score >= 90)) m.push({ i:'🎯', n:'الدقة العالية', d:'٩٠٪ فأكثر في اختبار' });
  if(mcq.length >= 2 && bestAv >= 80) m.push({ i:'🏅', n:'المتمكّنة', d:'أفضل متوسط دقة ' + bestAv + '٪' });
  if(all.some(a => a.mode === 'fig')) m.push({ i:'🖼️', n:'قارئة الأشكال', d:'أنجزتِ أسئلة الرسوم' });
  if(tasksDone >= 5) m.push({ i:'✍️', n:'المخطّطة', d:'٥ مهام مؤشر' });
  if(tasksDone >= 15) m.push({ i:'🧠', n:'الشارحة', d:'١٥ مهمة مؤشر' });
  if(streak >= 3) m.push({ i:'🔥', n:'المواظبة', d:'٣ أيام متتالية' });
  if(m.length >= 6) m.push({ i:'👑', n:'سيطرة', d:'ستة أوسمة فأكثر' });
  return m;
}
function medalIcons(m){
  return m.length ? m.map(x => '<span class="medal" title="' + esc(x.n + ' — ' + x.d) + '">' + x.i + '</span>').join('') : '<span class="muted">—</span>';
}
function studentRanking(){
  const rows = getRegistry().map(st => {
    const R = studentReportData(st.id);
    const medals = medalsFor(st.id);
    const score = R.acc + Math.min(30, R.all.length * 2) + medals.length * 5;
    return { st, R, medals, score };
  });
  rows.sort((a, b) => b.score - a.score || b.R.all.length - a.R.all.length);
  return rows;
}
function renderTopFive(){
  const host = $('#tpTop5');
  if(!host) return;
  const rows = studentRanking().filter(r => r.R.all.length > 0);
  const top = rows.slice(0, 5);
  if(!top.length){ host.innerHTML = '<div class="empty">لا توجد إنجازات مسجلة بعد — ستظهر المراكز فور بدء الطالبات التدريب.</div>'; return; }
  const medal = ['🥇', '🥈', '🥉', '④', '⑤'];
  host.innerHTML = '<div class="podium">' + top.map((r, i) =>
    '<div class="pod p' + (i + 1) + '"><div class="pod-m">' + medal[i] + '</div>' +
    '<div class="pod-name">' + esc(r.st.name) + '</div>' +
    '<div class="pod-school">' + esc(r.st.school || '—') + '</div>' +
    '<div class="pod-stats"><span>' + r.R.acc + '٪</span><span>' + r.R.all.length + ' محاولة</span><span>' + r.medals.length + ' وسام</span></div>' +
    '<div class="pod-medals">' + medalIcons(r.medals) + '</div></div>').join('') + '</div>';
}
function topFiveRows(){ return studentRanking().filter(r => r.R.all.length > 0).slice(0, 5); }
function topFivePlainText(){
  const top = topFiveRows();
  const medal = ['🥇','🥈','🥉','④','⑤'];
  let txt = '🏆 المراكز الخمسة الأولى — ' + APP.name + '\n';
  txt += 'إعداد المعلمة: ' + APP.teacher + ' • ' + today() + '\n\n';
  if(!top.length){ txt += 'لا توجد إنجازات مسجلة بعد — كوني أول من يبدأ التدريب 💪'; return txt; }
  top.forEach((r, i) => {
    txt += medal[i] + ' ' + r.st.name + ' — ' + r.R.acc + '٪ دقة • ' + r.R.all.length + ' محاولة • ' + r.medals.length + ' وسام\n';
  });
  txt += '\nالترتيب التراكمي يُحسب من الدقة وعدد المحاولات والأوسمة المكتسبة.';
  return txt;
}
function topFiveTextFor(st){
  const top = topFiveRows();
  const base = topFivePlainText();
  const idx = st ? top.findIndex(r => r.st.id === st.id) : -1;
  if(idx >= 0) return '🎉 مبارك لكِ المركز ' + (idx + 1) + '!\n\n' + base + '\n\nاستمري في التميز 🌟';
  return base + '\n\nاستمري في التدريب للوصول إلى المراكز الأولى 💪';
}
function sendTopFive(){
  const reg = getRegistry();
  if(!reg.length){ toast('لا توجد طالبات مسجلات'); return; }
  if(!topFiveRows().length){ toast('لا توجد إنجازات مسجلة بعد'); return; }
  if(!confirm('سيتم إرسال المراكز الخمسة الأولى إلى جميع الطالبات (' + reg.length + ').\nأبقي الصفحة مفتوحة حتى يكتمل الإرسال. متابعة؟')) return;
  const list = getPlans();
  const now = Date.now();
  reg.forEach((st, i) => {
    list.push({ id:'p' + (now + i), sid:st.id, name:st.name, type:'ranking',
      title:'🏆 المراكز الخمسة الأولى', text: topFiveTextFor(st), date:today(),
      time:new Date().toLocaleTimeString('ar-SA'), read:false });
  });
  savePlans(list);
  list.slice(-reg.length).forEach((p, i) => setTimeout(() => { if(typeof syncPushPlan === 'function') syncPushPlan(p); }, (i + 1) * 2600));
  renderTeacher(); renderSent(); renderInbox();
  toast('جارٍ إرسال المراكز إلى ' + reg.length + ' طالبة… أبقي الصفحة مفتوحة 📤');
}
function copyTopFive(){
  const txt = topFivePlainText();
  const done = () => toast('تم نسخ الترتيب ✅');
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch(e){ toast('تعذّر النسخ'); }
    ta.remove();
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(fallback);
  } else fallback();
}

/* ---------- تقرير المراكز الخمسة الأولى (طباعة / PDF) ---------- */
function buildTopFiveReport(){
  const all = studentRanking().filter(r => r.R.all.length > 0);
  const top = all.slice(0, 5);
  const medal = ['🥇','🥈','🥉','④','⑤'];
  const sumAtt = top.reduce((s, r) => s + r.R.all.length, 0);
  const sumMedals = top.reduce((s, r) => s + r.medals.length, 0);
  const bestAcc = top.length ? top[0].R.acc : 0;
  let podium = '';
  if(top.length){
    podium = '<div class="rep-podium">' + top.slice(0, 3).map((r, i) =>
      '<div class="rep-pod ' + ['gold','silver','bronze'][i] + '"><div class="m">' + medal[i] + '</div>' +
      '<b>' + esc(r.st.name) + '</b><span>' + r.R.acc + '% دقة • ' + r.R.all.length + ' محاولة • ' + r.medals.length + ' وسام</span></div>'
    ).join('') + '</div>';
  }
  const tableRows = top.map((r, i) =>
    '<tr><td><b>' + (i + 1) + '</b></td><td style="text-align:right">' + esc(r.st.name) + '</td>' +
    '<td>' + esc(r.st.school || '—') + '</td><td>' + r.R.acc + '%</td><td>' + r.R.all.length + '</td>' +
    '<td>' + r.medals.length + '</td><td>' + (r.medals.length ? r.medals.map(x => x.i).join(' ') : '—') + '</td></tr>'
  ).join('');
  return '<div class="report"><div class="rep-head"><div><h1>تقرير المراكز الخمسة الأولى — لوحة الشرف</h1>' +
    '<p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>تاريخ الإصدار:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div>' +
    '<div><b>عدد الطالبات في الترتيب:</b> ' + all.length + '</div>' +
    '<div><b>أساس الترتيب:</b> الدقة + عدد المحاولات + الأوسمة المكتسبة</div>' +
    '<div><b>النطاق:</b> تراكمي حتى تاريخ الإصدار</div></div>' +
    (top.length ? podium +
      '<h2>تفاصيل المراكز الخمسة الأولى</h2><table class="rep-table"><tr><th>المركز</th><th>الطالبة</th><th>المدرسة</th><th>الدقة</th><th>المحاولات</th><th>الأوسمة</th><th>أوسمة مميزة</th></tr>' + tableRows + '</table>' +
      '<div class="rep-kpis"><div><b>' + bestAcc + '%</b><span>أعلى دقة</span></div><div><b>' + sumAtt + '</b><span>محاولات المراكز الخمسة</span></div>' +
      '<div><b>' + sumMedals + '</b><span>أوسمة المراكز الخمسة</span></div><div><b>' + all.length + '</b><span>طالبة في الترتيب</span></div></div>' +
      '<p class="rep-note">🎉 نهنئ الطالبات المتميزات على وصولهن إلى المراكز الخمسة الأولى، ونشجّع جميع الطالبات على مواصلة التدريب — كل محاولة تقرّبك من القمة. استمري 💪</p>'
      : '<p class="rep-note">لا توجد إنجازات مسجلة بعد — ستظهر لوحة الشرف فور بدء الطالبات التدريب.</p>') +
    '<div class="rep-sign"><div>إعداد المعلمة: نعمة هرشان</div><div>الختم: ........................</div></div>' +
    '<p class="rep-foot">تقرير صادر من منصة «تدريب نافس علوم» — إدارة تعليم جيزان — إعداد المعلمة نعمة هرشان.</p></div>';
}
function printTopFive(){
  $('#printArea').innerHTML = buildTopFiveReport();
  document.body.classList.add('printing');
  setTimeout(function(){ window.print(); }, 150);
}

/* ---------- صورة المراكز (PNG جاهزة للمشاركة) ---------- */
function topFiveCanvas(){
  const top = topFiveRows();
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const font = '"Segoe UI", Tahoma, Arial, sans-serif';
  const rr = (px, py, w, h, r) => {
    g.beginPath();
    g.moveTo(px + r, py);
    g.arcTo(px + w, py, px + w, py + h, r);
    g.arcTo(px + w, py + h, px, py + h, r);
    g.arcTo(px, py + h, px, py, r);
    g.arcTo(px, py, px + w, py, r);
    g.closePath();
  };
  const fit = (txt, maxW, size, weight, color, px, py, align) => {
    let s = size;
    g.font = weight + ' ' + s + 'px ' + font;
    while(s > 18 && g.measureText(txt).width > maxW){ s -= 1; g.font = weight + ' ' + s + 'px ' + font; }
    let t = txt;
    if(g.measureText(t).width > maxW){
      while(t.length > 3 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
      t += '…';
    }
    g.fillStyle = color; g.textAlign = align || 'right'; g.fillText(t, px, py);
    return s;
  };
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4c1d95'); bg.addColorStop(.55, '#6d28d9'); bg.addColorStop(1, '#db2777');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.07)';
  [[95,130,230],[985,1170,300],[1040,110,170],[40,1160,190]].forEach(d => { g.beginPath(); g.arc(d[0], d[1], d[2], 0, Math.PI * 2); g.fill(); });
  g.fillStyle = 'rgba(255,255,255,.16)';
  for(let i = 0; i < 46; i++){ g.beginPath(); g.arc((i * 137) % W, (i * 251) % H, 1.5 + (i % 3), 0, Math.PI * 2); g.fill(); }
  g.textAlign = 'center'; g.direction = 'rtl';
  g.fillStyle = '#fff'; g.font = '800 56px ' + font; g.fillText(APP.name, W / 2, 104);
  g.fillStyle = 'rgba(255,255,255,.88)'; g.font = '600 24px ' + font;
  g.fillText('إدارة تعليم جيزان • إعداد المعلمة ' + APP.teacher, W / 2, 148);
  const cx = 60, cy = 196, cw = 960, ch = 1058;
  g.save(); g.shadowColor = 'rgba(20,10,40,.28)'; g.shadowBlur = 40; g.shadowOffsetY = 16;
  rr(cx, cy, cw, ch, 36); g.fillStyle = '#fff'; g.fill(); g.restore();
  g.fillStyle = '#4c1d95'; g.font = '800 50px ' + font;
  g.fillText('🏆 المراكز الخمسة الأولى', W / 2, 282);
  g.fillStyle = '#7c7794'; g.font = '600 23px ' + font;
  g.fillText('لوحة الشرف • ' + today(), W / 2, 320);
  g.fillStyle = '#f59e0b'; rr(W / 2 - 90, 338, 180, 8, 4); g.fill();
  const colors = ['#f59e0b', '#94a3b8', '#b45309', '#6d28d9', '#6d28d9'];
  const rowX = cx + 30, rowW = cw - 60, rowH = 140, rowGap = 12, rowTop = 378;
  top.forEach((r, i) => {
    const y = rowTop + i * (rowH + rowGap);
    g.fillStyle = i === 0 ? '#fffbeb' : (i % 2 ? '#faf9ff' : '#f5f3ff');
    rr(rowX, y, rowW, rowH, 22); g.fill();
    if(i === 0){ g.strokeStyle = '#fcd34d'; g.lineWidth = 3; rr(rowX, y, rowW, rowH, 22); g.stroke(); }
    const bx = rowX + rowW - 78, by = y + rowH / 2;
    g.beginPath(); g.arc(bx, by, 39, 0, Math.PI * 2); g.fillStyle = colors[i]; g.fill();
    g.fillStyle = '#fff'; g.font = '800 38px ' + font; g.textAlign = 'center'; g.fillText(String(i + 1), bx, by + 14);
    fit(r.st.name, 470, 34, '800', '#1e1b31', bx - 62, y + 60, 'right');
    fit(r.st.school || '—', 470, 21, '600', '#7c7794', bx - 62, y + 99, 'right');
    g.textAlign = 'left';
    g.fillStyle = '#6d28d9'; g.font = '800 36px ' + font; g.fillText(r.R.acc + '%', rowX + 42, y + 64);
    g.fillStyle = '#7c7794'; g.font = '600 20px ' + font;
    g.fillText(r.R.all.length + ' محاولة • ' + r.medals.length + ' وسام', rowX + 42, y + 100);
  });
  g.textAlign = 'center';
  g.fillStyle = '#7c7794'; g.font = '600 20px ' + font;
  g.fillText('الترتيب التراكمي: الدقة + عدد المحاولات + الأوسمة المكتسبة', W / 2, 1190);
  g.fillStyle = 'rgba(255,255,255,.95)'; g.font = '700 30px ' + font;
  g.fillText('استمري في التدريب… المراكز تُحسم بالإنجاز 💪', W / 2, 1294);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 19px ' + font;
  g.fillText('منصة تدريب نافس علوم • إدارة تعليم جيزان', W / 2, 1328);
  return c;
}
function downloadTopFiveImage(blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'المراكز-الخمسة-الأولى-' + today() + '.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  toast('تم تنزيل صورة المراكز ✅');
}
function saveTopFiveImage(){
  if(!topFiveRows().length){ toast('لا توجد إنجازات مسجلة بعد'); return; }
  const c = topFiveCanvas();
  c.toBlob(function(blob){
    if(!blob){ toast('تعذّر إنشاء الصورة'); return; }
    let file = null;
    try { file = new File([blob], 'المراكز-الخمسة-الأولى.png', { type:'image/png' }); } catch(e){}
    if(file && navigator.canShare && navigator.canShare({ files:[file] })){
      navigator.share({ files:[file], title:'المراكز الخمسة الأولى', text: topFivePlainText() })
        .then(() => toast('تمت مشاركة الصورة ✅'))
        .catch((err) => { if(err && err.name === 'AbortError') return; downloadTopFiveImage(blob); });
    } else downloadTopFiveImage(blob);
  }, 'image/png');
}
function copyTopFiveImage(){
  if(!topFiveRows().length){ toast('لا توجد إنجازات مسجلة بعد'); return; }
  if(!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof ClipboardItem === 'undefined'){
    toast('المتصفح لا يدعم نسخ الصور — استخدمي زر «صورة المراكز» للحفظ');
    return;
  }
  try {
    const c = topFiveCanvas();
    const item = new ClipboardItem({ 'image/png': new Promise(function(resolve){ c.toBlob(resolve, 'image/png'); }) });
    navigator.clipboard.write([item])
      .then(() => toast('تم نسخ صورة المراكز — الصقيها في واتساب ✅'))
      .catch(() => toast('تعذّر النسخ — استخدمي زر «صورة المراكز» للحفظ'));
  } catch(e){
    toast('تعذّر النسخ — استخدمي زر «صورة المراكز» للحفظ');
  }
}

/* ---------- أوسمة اليوم (تتحدث يومياً) ---------- */
function weekStart(){
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7; // بداية الأسبوع: السبت
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}
function dailyData(id){
  const all = readUser(id, 'attempts', []);
  const st = getRegistry().find(x => x.id === id) || { logins:{} };
  const d = today();
  const todays = all.filter(a => a.date === d);
  const mcq = todays.filter(a => a.mode === 'mcq');
  const totQ = mcq.reduce((s, a) => s + (a.total || 0), 0);
  const totC = mcq.reduce((s, a) => s + (a.correct || 0), 0);
  const ws = weekStart();
  const weekDays = [...new Set(all.filter(a => a.date >= ws).map(a => a.date))].length;
  return {
    todays, mcqCount:mcq.length, acc: pct(totC, totQ),
    best: todays.reduce((m, a) => Math.max(m, a.score || 0), 0),
    logged: !!(st.logins && st.logins[d]),
    loginsToday: (st.logins && st.logins[d]) || 0,
    streak: studentStreak(id), weekDays,
    figsToday: todays.filter(a => a.mode === 'fig').length,
    tasksToday: todays.filter(a => a.mode === 'tasks').length
  };
}
function dailyMedalsFor(id){
  const D = dailyData(id);
  const m = [];
  if(D.logged) m.push({ i:'🌅', n:'حاضرة اليوم', d:'سجّلت دخولها اليوم' });
  if(D.loginsToday > 1) m.push({ i:'🔁', n:'مثابرة اليوم', d:D.loginsToday + ' جلسات اليوم' });
  if(D.mcqCount) m.push({ i:'⚡', n:'أنجزت اختباراً', d:D.mcqCount + ' اختبار اليوم' });
  if(D.best >= 100) m.push({ i:'💯', n:'القمة اليوم', d:'درجة كاملة اليوم' });
  else if(D.best >= 90) m.push({ i:'🎯', n:'متميّزة اليوم', d:'أفضل نتيجة اليوم ' + D.best + '٪' });
  else if(D.best >= 80) m.push({ i:'📗', n:'جيدة اليوم', d:'أفضل نتيجة اليوم ' + D.best + '٪' });
  else if(D.best >= 60) m.push({ i:'🌱', n:'تحتاج تثبيتاً', d:'أفضل نتيجة اليوم ' + D.best + '٪ — راجعي الخطة' });
  if(D.figsToday) m.push({ i:'🖼️', n:'رسوم اليوم', d:'مجموعة رسوم اليوم' });
  if(D.tasksToday) m.push({ i:'✍️', n:'مهام اليوم', d:D.tasksToday + ' مهمة مؤشر' });
  if(D.streak >= 3) m.push({ i:'🔥', n:'مواظبة ' + D.streak + ' أيام', d:'تدريب متواصل' });
  if(D.weekDays >= 5) m.push({ i:'📆', n:'أسبوع كامل', d:D.weekDays + ' أيام هذا الأسبوع' });
  return m;
}
function dailyRanking(){
  return getRegistry().map(st => {
    const D = dailyData(st.id);
    const medals = dailyMedalsFor(st.id);
    const score = D.acc + medals.length * 6 + D.mcqCount * 3 + (D.logged ? 5 : 0);
    return { st, D, medals, score };
  }).sort((a, b) => b.score - a.score);
}
function renderTodayMedals(){
  const host = $('#tpToday');
  if(!host) return;
  const rows = dailyRanking().filter(r => r.medals.length);
  host.innerHTML = rows.length ? '<div class="tp-table"><table><tr><th>الطالبة</th><th>دخول اليوم</th><th>اختبارات اليوم</th><th>أفضل نتيجة اليوم</th><th>أوسمة اليوم</th></tr>' +
    rows.map(r => '<tr><td><b>' + esc(r.st.name) + '</b></td>' +
      '<td>' + (r.D.logged ? '✅ ' + r.D.loginsToday + ' جلسة' : '—') + '</td>' +
      '<td>' + (r.D.mcqCount || '—') + '</td><td>' + (r.D.best ? r.D.best + '٪' : '—') + '</td>' +
      '<td>' + medalIcons(r.medals) + '</td></tr>').join('') + '</table></div>'
    : '<div class="empty">لا توجد أوسمة اليوم بعد — تتجدّد الأوسمة تلقائياً كل يوم بحسب دخول الطالبات وإنجازهن 🌅</div>';
}

function medalsForDate(id, date){
  const all = readUser(id, 'attempts', []);
  const st = getRegistry().find(x => x.id === id) || { logins:{} };
  const day = all.filter(a => a.date === date);
  const mcq = day.filter(a => a.mode === 'mcq');
  const best = day.reduce((m, a) => Math.max(m, a.score || 0), 0);
  const logins = (st.logins && st.logins[date]) || 0;
  const m = [];
  if(logins) m.push({ i:'🌅', n:'حاضرة' });
  if(logins > 1) m.push({ i:'🔁', n:'مثابرة' });
  if(mcq.length) m.push({ i:'⚡', n:'اختبار' });
  if(best >= 100) m.push({ i:'💯', n:'القمة' });
  else if(best >= 90) m.push({ i:'🎯', n:'متميّزة' });
  else if(best >= 80) m.push({ i:'📗', n:'جيدة' });
  else if(best >= 60 && mcq.length) m.push({ i:'🌱', n:'تحتاج تثبيتاً' });
  if(day.some(a => a.mode === 'fig')) m.push({ i:'🖼️', n:'رسوم' });
  if(day.some(a => a.mode === 'tasks')) m.push({ i:'✍️', n:'مهام' });
  const active = {};
  all.forEach(a => { if(a.date) active[a.date] = 1; });
  Object.keys(st.logins || {}).forEach(d => { active[d] = 1; });
  let streak = 0, cur = date;
  while(active[cur]){ streak++; cur = addDaysUTC(cur, -1); }
  if(streak >= 3) m.push({ i:'🔥', n:'مواظبة ' + streak + ' أيام' });
  return m;
}
function medalHistory(id, limit){
  const all = readUser(id, 'attempts', []);
  const st = getRegistry().find(x => x.id === id) || { logins:{} };
  const days = [...new Set(all.map(a => a.date).concat(Object.keys(st.logins || {})))].filter(Boolean).sort().reverse();
  const out = [];
  days.slice(0, limit || 14).forEach(d => {
    const m = medalsForDate(id, d);
    if(m.length) out.push({ date:d, medals:m });
  });
  return out;
}
function medalHistoryHTML(id, limit){
  const h = medalHistory(id, limit || 14);
  if(!h.length) return '<div class="empty">لم تُسجّل أوسمة بعد.</div>';
  return '<div class="tp-table"><table><tr><th>اليوم</th><th>الأوسمة</th></tr>' +
    h.map(x => '<tr><td>' + x.date + '</td><td>' + x.medals.map(m => '<span class="medal" title="' + esc(m.n) + '">' + m.i + '</span>').join('') + '</td></tr>').join('') +
    '</table></div>';
}

/* ---------- الوضع الليلي ---------- */
$('#themeBtn').onclick = () => {
  document.body.classList.toggle('dark');
  s(K.theme, document.body.classList.contains('dark'));
  $('#themeBtn').innerHTML = document.body.classList.contains('dark') ? '<svg><use href="#i-sun"/></svg>' : '<svg><use href="#i-moon"/></svg>';
};
if(g(K.theme, false)){ document.body.classList.add('dark'); $('#themeBtn').innerHTML = '<svg><use href="#i-sun"/></svg>'; }

/* ---------- تحدي اليوم ---------- */
$('#dailyBtn').onclick = () => {
  const subs = Object.keys(BANK);
  const sub = subs[Math.floor(Math.random() * subs.length)];
  const f = BANK[sub].fields[Math.floor(Math.random() * BANK[sub].fields.length)];
  go('train'); selectSubject(sub);
  setTimeout(() => startMCQ(sub, f), 200);
};

/* ---------- التشغيل ---------- */
migrateLegacy();
if(U.id && !studentExists(U.id)){ U.id = ''; localStorage.removeItem('nafas_active'); }
renderAll();
initWeekInputs();
startSyncLoop();
if(U.id) syncPushSoon();
// شاشة اختيار الدور تظهر دائماً عند فتح المنصة أو تحديث الصفحة
renderLoginGate();
