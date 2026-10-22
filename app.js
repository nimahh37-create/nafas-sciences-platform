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
function switchUser(){
  U.id = ''; localStorage.removeItem('nafas_active');
  renderLoginGate();
}
function renderAll(){
  renderProfile(); renderHub(); renderTrain(); renderProgress(); renderUploaded();
  renderInbox(); renderBell();
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

  // الأوسمة
  const badges = $('#badgesRow');
  const earned = {
    'أول اختبار': attempts.length >= 1,
    '٥ اختبارات': attempts.length >= 5,
    'مارة ٨٠٪': attempts.some(a => a.score >= 80),
    'مارة ٩٥٪': attempts.some(a => a.score >= 95),
    'مؤشر مكتمل': Object.values(progress).some(p => p.tasks && p.tasks.done >= 5),
    'نجمة نافس': attempts.filter(a => a.score === 100).length >= 1,
    'محاولة مجديدة': attempts.filter(a => a.retry).length >= 1,
    'أسبوع كامل': streakDays() >= 7
  };
  const defs = [['🌱','أول اختبار'],['🚀','٥ اختبارات'],['⭐','مارة ٨٠٪'],['💎','مارة ٩٥٪'],['🔎','مؤشر مكتمل'],['🏆','نجمة نافس'],['🔄','محاولة مجديدة'],['📅','أسبوع كامل']];
  badges.innerHTML = '';
  defs.forEach(([ic, name]) => {
    const on = earned[name];
    badges.appendChild(el('div', 'badge' + (on ? ' on' : ''), '<div class="bico">' + ic + '</div><b>' + name + '</b><small>' + (on ? 'مكتسبة' : 'لم تُكتسب بعد') + '</small>'));
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
    '<div class="rep-head"><div><h1>تقرير التقدم الشامل</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
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
  initWeekInputs();
  renderWeekly();
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
$('#printReport').onclick = () => doPrint();
$('#repBtn').onclick = () => doPrint();
$('#changePin').onclick = () => {
  const v = prompt('اكتبي الرمز الجديد (4 أرقام):');
  if(v && v.length >= 4){ pin = v; s(K.pin, pin); toast('تم تغيير الرمز ✅'); }
};
$('#uploadBtn').onclick = () => {
  const st = $('#upStudent').value.trim(), sc = $('#upSchool').value.trim(),
        ex = $('#upExam').value.trim(), sc2 = parseInt($('#upScore').value, 10);
  if(!st || !sc || !ex || isNaN(sc2)){ toast('أكملي بيانات الرفع ⬆️'); return; }
  const ups = gRaw('nafas_uploads', []);
  ups.push({ student:st, school:sc, exam:ex, score:sc2, date:today(), time:new Date().toLocaleTimeString('ar-SA') });
  sRaw('nafas_uploads', ups);
  $('#uploadStatus').innerHTML = '<div class="notice">✅ تم رفع تقدّم <b>' + st + '</b> (' + sc2 + '%) إلى لوحة صاحب المبادرة.</div>';
  renderParent(); renderHub();
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
function weeklyData(fromIn, toIn){
  const from = fromIn || (($('#wkFrom') && $('#wkFrom').value) || defaultWeek().from);
  const to = toIn || (($('#wkTo') && $('#wkTo').value) || defaultWeek().to);
  return { from, to, rows: getRegistry().map(st => ({ st, w: weekData(st, from, to) })) };
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
    '<div class="rep-kpis"><div><b>' + rows.length + '</b><span>طالبة</span></div>' +
    '<div><b>' + sess + '</b><span>جلسة دخول</span></div>' +
    '<div><b>' + att + '</b><span>محاولة</span></div>' +
    '<div><b>' + (tq ? pct(tc, tq) : 0) + '%</b><span>متوسط الدقة</span></div></div>' +
    '<h2>متابعة الطالبات</h2><table class="rep-table"><tr><th>الطالبة</th><th>المدرسة</th><th>أيام الدخول</th><th>الجلسات</th><th>آخر دخول</th><th>محاولات الأسبوع</th><th>الدقة</th><th>أفضل نتيجة</th><th>الحالة</th></tr>' +
    rows.map(r => '<tr><td style="text-align:right">' + esc(r.st.name) + '</td><td>' + esc(r.st.school || '—') + '</td>' +
      '<td>' + r.w.loginDays.length + '</td><td>' + r.w.sessions + '</td>' +
      '<td>' + (r.st.lastSeen ? new Date(r.st.lastSeen).toLocaleDateString('ar-SA') : '—') + '</td>' +
      '<td>' + r.w.inWeek.length + '</td><td>' + (r.w.mcqCount ? r.w.accuracy + '%' : '—') + '</td>' +
      '<td>' + (r.w.best ? r.w.best + '%' : '—') + '</td><td>' + weekStatus(r.w) + '</td></tr>').join('') + '</table>';
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
on('#exportData', () => exportData());
on('#importData', () => { const f = $('#importFile'); if(f) f.click(); });
on('#addStudentBtn', () => switchUser());
on('#switchUserBtn', () => switchUser());
on('#lgAddBtn', () => addStudent());
const imp = $('#importFile');
if(imp) imp.onchange = e => { if(e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };

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

  return { from, to, rows, days, trend, fields, dist, indicators, ranking,
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
  const sci = $('#syncCodeInput');
  if(sci && !sci.value) sci.value = syncCode();
  const T = A.totals;
  $('#tpRangeTxt').textContent = 'الفترة: ' + from + ' — ' + to;

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
  $('#tpStudents').innerHTML = A.rows.length ? '<div class="tp-table"><table><tr><th>الطالبة</th><th>المدرسة</th><th>أيام الدخول</th><th>الجلسات</th><th>آخر دخول</th><th>محاولات</th><th>الدقة</th><th>أفضل نتيجة</th><th>كل المحاولات</th><th>الحالة</th><th>المسار والإرسال</th></tr>' +
    A.rows.map(r => '<tr><td><b>' + esc(r.st.name) + '</b></td><td>' + esc(r.st.school || '—') + '</td>' +
      '<td>' + r.w.loginDays.length + '</td><td>' + r.w.sessions + '</td>' +
      '<td>' + (r.st.lastSeen ? new Date(r.st.lastSeen).toLocaleDateString('ar-SA') : '—') + '</td>' +
      '<td>' + r.w.inWeek.length + '</td><td>' + (r.w.mcqCount ? r.w.accuracy + '%' : '—') + '</td>' +
      '<td>' + (r.w.best ? r.w.best + '%' : '—') + '</td><td>' + r.w.allAttempts + '</td><td>' + weekStatus(r.w) + '</td>' +
      '<td class="tp-send"><select data-track="' + r.st.id + '"><option value="">متوازنة</option>' +
      '<option value="remedial"' + (r.st.track === 'remedial' ? ' selected' : '') + '>تحتاج علاجي</option>' +
      '<option value="enrichment"' + (r.st.track === 'enrichment' ? ' selected' : '') + '>إثرائي</option></select>' +
      '<button class="btn btn-soft btn-sm" data-sendmenu="' + r.st.id + '">📩 إرسال</button></td></tr>').join('') + '</table></div>'
    : '<div class="empty">لا توجد طالبات مسجلات على هذا الجهاز.</div>';
  $('#tpStudents').querySelectorAll('[data-detail]').forEach(b => b.onclick = () => renderStudentDetail(b.dataset.detail));
  $('#tpStudents').querySelectorAll('[data-openst]').forEach(b => b.onclick = () => { activateUser(b.dataset.openst); $('#teacherPanel').hidden = true; go('hub'); });
  $('#tpStudents').querySelectorAll('[data-track]').forEach(s => s.onchange = () => {
    const reg = getRegistry();
    const st2 = reg.find(x => x.id === s.dataset.track);
    if(st2){ st2.track = s.value; saveRegistry(reg); toast('مسار ' + st2.name + ': ' + (TRACK_LABEL[s.value] || 'متوازنة')); renderTeacher(); }
  });
  $('#tpStudents').querySelectorAll('[data-sendmenu]').forEach(b => b.onclick = () => openSendMenu(b.dataset.sendmenu));
  renderSent();

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
    '<div class="tp-table"><table><tr><th>المجال</th><th>المحاولات</th><th>أفضل نتيجة</th><th>آخر نتيجة</th><th>الرسوم</th><th>المهام</th><th>الحالة</th></tr>' +
    fRows.map(f => '<tr><td>' + f.code + ' — ' + esc(f.title) + '</td><td>' + f.n + '</td><td>' + (f.best ? f.best + '%' : '—') + '</td>' +
      '<td>' + (f.last === null ? '—' : f.last + '%') + '</td><td>' + (f.figs ? f.figs + '%' : '—') + '</td>' +
      '<td>' + f.tasks + '/5</td><td>' + f.st + '</td></tr>').join('') + '</table></div>' +
    '<p class="muted" style="margin-top:10px">' + (weak.length ? 'مجالات تحتاج دعماً: ' + weak.map(f => f.code + ' (' + f.last + '%)').join('، ') : 'لا توجد مجالات تحتاج دعماً 🌟') + '</p>' +
    '<h3 style="margin-top:14px">آخر المحاولات</h3><div class="tp-table"><table><tr><th>المهمة</th><th>النوع</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    (all.slice(-8).reverse().map(a => '<tr><td>' + esc(a.title) + '</td><td>' + (a.mode === 'mcq' ? 'اختبار' : a.mode === 'fig' ? 'رسوم' : 'مؤشر') + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') || '<tr><td colspan="4">لا توجد محاولات</td></tr>') + '</table></div>';
  const pb = $('#tpPrintOne');
  if(pb) pb.onclick = () => printStudentReport(st.id);
}
function printStudentReport(id){
  const st = getRegistry().find(x => x.id === id);
  if(!st) return;
  const all = readUser(id, 'attempts', []);
  const prog = readUser(id, 'progress', {});
  const rows = [];
  Object.keys(BANK).forEach(sub => BANK[sub].fields.forEach(f => {
    const fa = all.filter(a => a.subject === sub && a.field === f.code && a.mode === 'mcq');
    const p = prog[sub + '|' + f.code];
    rows.push('<tr><td>' + f.code + '</td><td style="text-align:right">' + f.title + '</td><td>' + fa.length + '</td>' +
      '<td>' + (((p && p.mcq && p.mcq.best) || 0) + '%') + '</td>' +
      '<td>' + (fa.length ? fa[fa.length - 1].score + '%' : '—') + '</td>' +
      '<td>' + (((p && p.tasks && p.tasks.done) || 0) + '/5') + '</td></tr>');
  }));
  const html = '<div class="report"><div class="rep-head"><div><h1>تقرير إنجاز الطالبة</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الطالبة:</b> ' + esc(st.name) + '</div><div><b>المدرسة:</b> ' + esc(st.school || '—') + '</div>' +
    '<div><b>الصف:</b> ' + esc(st.cls || '—') + '</div><div><b>التاريخ:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div></div>' +
    '<div class="rep-kpis"><div><b>' + all.length + '</b><span>محاولة</span></div>' +
    '<div><b>' + all.filter(a => a.score >= 60).length + '</b><span>شهادة</span></div>' +
    '<div><b>' + (st.sessions || 0) + '</b><span>جلسة دخول</span></div>' +
    '<div><b>' + Object.keys(st.logins || {}).length + '</b><span>يوم دخول</span></div></div>' +
    '<h2>أداؤها في المجالات</h2><table class="rep-table"><tr><th>المجال</th><th>العنوان</th><th>المحاولات</th><th>أفضل نتيجة</th><th>آخر نتيجة</th><th>المهام</th></tr>' + rows.join('') + '</table>' +
    '<h2>آخر المحاولات</h2><table class="rep-table"><tr><th>المهمة</th><th>النوع</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    all.slice(-15).reverse().map(a => '<tr><td style="text-align:right">' + esc(a.title) + '</td><td>' + (a.mode === 'mcq' ? 'اختبار' : a.mode === 'fig' ? 'رسوم' : 'مؤشر') + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') + '</table>' +
    '<div class="rep-sign"><div>توقيع المعلمة: ........................</div><div>توقيع ولي الأمر: ........................</div></div></div>';
  $('#printArea').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 120);
}
function buildAnalysisReport(){
  const from = ($('#tpFrom') && $('#tpFrom').value) || defaultWeek().from;
  const to = ($('#tpTo') && $('#tpTo').value) || defaultWeek().to;
  const A = buildAnalysis(from, to), T = A.totals;
  let html = '<div class="report"><div class="rep-head"><div><h1>التحليل البياني — إنجاز الطالبات</h1><p>تدريب نافس علوم — علوم الحياة وعلوم الأرض والفضاء (الصف الثالث المتوسط)</p></div>' +
    '<div class="rep-brand">إدارة تعليم جيزان<br>إعداد المعلمة<br><b>نعمة هرشان</b></div></div>' +
    '<div class="rep-meta"><div><b>الفترة:</b> ' + from + ' — ' + to + '</div><div><b>تاريخ الإصدار:</b> ' + new Date().toLocaleDateString('ar-SA') + '</div>' +
    '<div><b>الطالبات:</b> ' + T.students + '</div><div><b>جلسات الدخول:</b> ' + T.sessions + ' (' + T.loginDays + ' يوماً)</div></div>' +
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
let teacherAuthed = false;
function teacherLogin(){
  if($('#teacherPin').value === pin){
    teacherAuthed = true;
    $('#teacherGate').hidden = true;
    $('#teacherBody').hidden = false;
    initTeacherDates();
    renderTeacher();
    syncPull().then(() => { if(!$('#teacherPanel').hidden) renderTeacher(); });
    toast('أهلاً بكِ أستاذة 👩‍🏫');
  } else toast('الرمز غير صحيح ❌');
}
function openTeacher(){
  $('#teacherPanel').hidden = false;
  if(teacherAuthed){ $('#teacherGate').hidden = true; $('#teacherBody').hidden = false; initTeacherDates(); renderTeacher(); syncPull().then(() => renderTeacher()); }
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
on('#tpExport', () => exportData());
on('#tpImport', () => { const f = $('#tpImportFile'); if(f) f.click(); });
const tpi = $('#tpImportFile');
if(tpi) tpi.onchange = e => { if(e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; };
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
function markPlanRead(id){
  const l = getPlans();
  const p = l.find(x => x.id === id);
  if(p){ p.read = true; savePlans(l); }
}
function renderInbox(){
  const box = $('#inboxList');
  if(!box) return;
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
  const l = getPlans();
  let ch = false;
  l.forEach(p => { if(p.sid === U.id && !p.read){ p.read = true; ch = true; } });
  if(ch){ savePlans(l); renderBell(); renderInbox(); }
}
function renderSent(){
  const box = $('#tpSent');
  if(!box) return;
  const list = getPlans().slice().reverse();
  const reg = getRegistry();
  box.innerHTML = list.length ? list.map(p => {
    const st = reg.find(x => x.id === p.sid);
    return '<div class="review-row"><div class="rq">' + esc(p.title) + ' — ' + esc(st ? st.name : '—') + '</div>' +
      '<div class="rr">' + p.date + ' • ' + (p.time || '') + (p.read ? ' • تمت القراءة' : ' • لم تُقرأ بعد') +
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


/* ---------- اختيار الدور في شاشة الدخول ---------- */
function showLoginRole(role){
  const roles = $('#lgRoles'), sv = $('#lgStudentView'), tv = $('#lgTeacherView'), back = $('#lgBackRoles');
  const title = $('#lgTitle'), sub = $('#lgSubtitle');
  const hide = (e) => { if(e) e.hidden = true; };
  const show = (e) => { if(e) e.hidden = false; };
  if(role === 'student'){
    hide(roles); show(sv); hide(tv); show(back);
    if(title) title.textContent = 'دخول الطالبة 👩‍🎓';
    if(sub) sub.textContent = 'اختاري اسمك للمتابعة، أو سجّلي حساباً جديداً.';
  } else if(role === 'teacher'){
    hide(roles); hide(sv); show(tv); show(back);
    if(title) title.textContent = 'دخول المعلمة 🎓';
    if(sub) sub.textContent = 'أدخلي الرمز السري للمعلمة للوصول إلى لوحة المتابعة والتحليل.';
    const p = $('#lgTeacherPin');
    if(p){ p.value = ''; setTimeout(() => { try { p.focus(); } catch(e){} }, 80); }
  } else {
    show(roles); hide(sv); hide(tv); hide(back);
    if(title) title.textContent = 'من أنتِ؟ 👋';
    if(sub) sub.textContent = 'اختاري طريقة الدخول — يمكنك تغييرها في أي وقت.';
  }
}
function teacherGateLogin(){
  const inp = $('#lgTeacherPin');
  const v = inp ? inp.value.trim() : '';
  if(v === pin){
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
on('#lgBackRoles', () => showLoginRole(''));
on('#lgTeacherGo', () => teacherGateLogin());
on('#exportMine', () => exportStudentData());
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
const SYNC = { last: 0, pulling: false, blockUntil: 0 };
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
function materializeSync(id){
  const cache = gRaw('nafas_sync_cache', {});
  const c = cache[id];
  if(!c || !c.rec) return false;
  const rec = c.rec;
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
  if(id !== U.id){
    const parts = c.parts || {};
    const atts = [];
    Object.keys(parts).map(Number).sort((a, b) => a - b).forEach(i => (parts[i] || []).forEach(a => atts.push(a)));
    if(rec.att && rec.att.length) writeUser(id, 'attempts', rec.att);
    else if(atts.length) writeUser(id, 'attempts', atts);
    if(rec.progress && Object.keys(rec.progress).length){
      const prog = {};
      Object.keys(rec.progress).forEach(k => { const p = rec.progress[k];
        prog[k] = { mcq:{ best:p.b || 0, attempts:p.a || 0, correct:p.c || 0 }, tasks:{ done:p.t || 0 },
                    fig:{ best:p.fb || 0, attempts:p.fa || 0 }, last:0 }; });
      writeUser(id, 'progress', prog);
    }
    if(rec.profile) writeUser(id, 'profile', rec.profile);
  }
  return true;
}
function syncPull(){
  if(!syncEnabled() || SYNC.pulling) return Promise.resolve(0);
  if(SYNC.blockUntil && Date.now() < SYNC.blockUntil) return Promise.resolve(0);
  SYNC.pulling = true;
  const since = Math.floor((gRaw('nafas_sync_since', 0) || (Date.now() - 36 * 3600 * 1000)) / 1000);
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
          cache[p.rec.id].rec = p.rec;
          changed = true;
        } else if(p.t === 'att' && p.id){
          if(!cache[p.id]) cache[p.id] = { rec:null, parts:{} };
          cache[p.id].parts = cache[p.id].parts || {};
          cache[p.id].parts[p.part] = p.items;
          changed = true;
        } else if(p.t === 'plan' && p.plan && p.plan.id){
          const pl = getPlans();
          if(!pl.some(x => x.id === p.plan.id)){
            pl.push(p.plan);
            savePlans(pl);
            changed = true;
          }
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
      syncPull().then(() => { if(typeof renderTeacher === 'function') renderTeacher(); });
    } else if(U.id){
      syncPull().then(() => { renderInbox(); renderBell(); });
    }
  }, 20000);
}
let syncTimer = null;
on('#syncNow', () => { syncPull().then(n => { if(typeof renderTeacher === 'function') renderTeacher(); toast(n ? 'تم تحديث النتائج من الطالبات ✅' : 'لا جديد الآن'); }); });
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
on('#syncSaveCode', () => {
  const v = ($('#syncCodeInput') ? $('#syncCodeInput').value : '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if(!v){ toast('اكتبي رمز صف صحيحاً'); return; }
  saveSyncCode(v);
  sRaw('nafas_sync_since', 0);
  if($('#syncCodeInput')) $('#syncCodeInput').value = v;
  renderTeacher();
  toast('تم حفظ رمز الصف: ' + v + ' ✅ — أرسلي الرابط الجديد للطالبات');
});


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
if(U.id) logLogin();
renderAll();
initWeekInputs();
startSyncLoop();
syncPushSoon();
if(!U.id) renderLoginGate();
