/* =========================================================
   تدريب نافس علوم — منطق المنصة
   إعداد المعلمة: نعمة هرشان
   ========================================================= */
const APP = {
  name:'تدريب نافس علوم',
  teacher:'نعمة هرشان',
  pin:'1234'
};

/* ---------- تخزين ---------- */
const K = { profile:'nafes_profile', progress:'nafes_progress', attempts:'nafes_attempts', msg:'nafes_msg', goal:'nafes_goal', pin:'nafes_pin', theme:'nafes_theme' };
const g = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let profile = g(K.profile, { name:'', school:'' });
let progress = g(K.progress, {});       // key -> {mcq:{best,attempts,corrected}, tasks:{done}, last:ts}
let attempts = g(K.attempts, []);        // سجل المحاولات
let messages = g(K.msg, []);             // رسائل ولي الأمر
let goal = g(K.goal, 10);
let pin = g(K.pin, APP.pin);

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
    card.innerHTML =
      '<div class="chap-top"><h4>' + f.title + '</h4><span class="code">' + f.code + '</span></div>' +
      '<div class="pbar"><i style="width:' + pct(p.mcq.best, 100) + '%"></i></div>' +
      '<div class="pfoot"><span>أفضل نتيجة: ' + p.mcq.best + '%</span><span>مهام مؤشر: ' + tDone + '/' + f.tasks.length + '</span></div>' +
      '<div class="chap-acts">' +
        '<button class="btn btn-primary btn-sm" data-a="mcq">📝 اختبار (10 أسئلة)</button>' +
        '<button class="btn btn-soft btn-sm" data-a="tasks">🔎 مهام المؤشر (5)</button>' +
      '</div>';
    const ind = el('details');
    ind.style.marginTop = '4px';
    ind.innerHTML = '<summary style="cursor:pointer;font-size:13px;color:var(--muted)">المؤشر وناتج التعلم</summary>' +
      '<div class="ind" style="margin-top:8px"><p class="out"><b>ناتج التعلم:</b> ' + f.out + '</p>' +
      '<ul class="indlist">' + f.ind.map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
    card.appendChild(ind);
    card.querySelectorAll('[data-a]').forEach(btn => {
      btn.onclick = () => btn.dataset.a === 'mcq' ? startMCQ(curSubject, f) : startTasks(curSubject, f);
    });
    grid.appendChild(card);
  });
  box.appendChild(grid);
}

/* ---------- اختبار اختيار من متعدد ---------- */
function startMCQ(sub, f, onlyWrong){
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
    date: today(), time:new Date().toLocaleTimeString('ar-SA'),
    xp: correct * 10 + (score >= 80 ? 20 : 0)
  });
  s(K.attempts, attempts);

  const msg = score >= 90 ? 'ممتاز 🌟 نتيجة رائعة، أنتِ جاهزة للاختبار الحقيقي.'
            : score >= 75 ? 'رائع جدا 👏 استمري على هذا المنوال!'
            : score >= 60 ? 'جيد 💡 راجعي التلميحات والإثراء ثم أعيدي المحاولة.'
            : 'لا بأس 💪 راجعي قسم الإثراء، والتدريبات الفردية تساعدكِ أكثر.';
  let html = '<div class="result"><h2>' + (score >= 60 ? '🎉 أحسنتِ!' : '📝 لندرس معاً') + '</h2>' +
    '<div class="big">' + score + '%</div>' +
    '<p>الإجابات الصحيحة: <b>' + correct + '</b> من ' + total + ' • تلميحات مستخدمة: ' + hintsUsed + '</p>' +
    '<div class="why"><b>💡 كيف أقرأ نتيجتي؟</b><br>' + msg + '</div>' +
    '<div class="qfoot" style="justify-content:center">' +
      (wrongIds.length ? '<button class="btn btn-soft" data-retrywrong="1">🔄 إعادة الأسئلة الخاطئة (' + wrongIds.length + ')</button>' : '') +
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
  $('#quizBox').querySelectorAll('[data-cert]').forEach(b => b.onclick = () => showCert(f.title, score, correct, total));
  $('#quizBox').querySelectorAll('[data-back]').forEach(b => b.onclick = () => { go('train'); });
  renderHub();
}

/* ---------- مهام المؤشر ---------- */
function startTasks(sub, f){
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
  const html = '<div class="result"><h2>' + (score >= 60 ? '🎉 أداء رائع في مهام المؤشر' : '📘 خلينا نراجع معاً') + '</h2>' +
    '<div class="big">' + score + '%</div>' +
    '<p>مهام أتقنتِها: <b>' + ok + '</b> • جزئية: ' + part + ' • تحتاج مراجعة: ' + no + '</p>' +
    '<div class="why"><b>💡 ماذا يعني هذا؟</b><br>مهام المؤشر تطلب منك الفهم والشرح، وليست اختياراً فقط. عندما تستطيعين شرح الإجابة بكلماتك أنتِ فأنتِ أتقنتِ المؤشر فعلاً.</div>' +
    '<div class="qfoot" style="justify-content:center"><button class="btn btn-primary" data-again="1">🔁 إعادة المهام</button>' +
    '<button class="btn btn-back" data-back="1">رجوع للمجالات</button></div></div>';
  $('#quizBox').innerHTML = html;
  $('#quizBox').querySelectorAll('[data-again]').forEach(b => b.onclick = () => startTasks(sub, f));
  $('#quizBox').querySelectorAll('[data-back]').forEach(b => b.onclick = () => go('train'));
  renderHub();
}

/* ---------- الشهادة ---------- */
function showCert(title, score, correct, total){
  const name = profile.name || 'الطالبة';
  const school = profile.school || '';
  const box = $('#modalBox');
  box.innerHTML = '<div class="cert"><div class="seal">🏅</div>' +
    '<p style="font-weight:800;color:var(--violet)">تدريب نافس علوم</p>' +
    '<p class="muted">إعداد المعلمة: نعمة هرشان</p>' +
    '<h2>شهادة إنجاز</h2>' +
    '<p>تشهد منصة تدريب نافس علوم بأن</p>' +
    '<div class="cname">' + name + '</div>' +
    '<p class="muted">' + (school ? 'من مدرسة: ' + school : '') + '</p>' +
    '<p>قد أتمّت بنجاح مهمة <b>' + title + '</b></p>' +
    '<div class="cgrade">' + score + '%</div>' +
    '<p class="muted">' + correct + ' من ' + total + ' • ' + new Date().toLocaleDateString('ar-SA') + '</p>' +
    '<div class="sign"><span>المعلمة: نعمة هرشان</span><span>التوقيع: ____________</span></div>' +
    '<div class="qfoot" style="justify-content:center;margin-top:16px"><button class="btn btn-primary" onclick="window.print()">🖨️ طباعة الشهادة</button></div></div>';
  $('#modal').hidden = false;
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
    attempts.slice().reverse().slice(0, 20).map(a => '<tr><td>' + a.title + '</td><td>' + (a.mode === 'mcq' ? 'اختيار' : 'مؤشر') + '</td><td><b>' + a.score + '%</b></td><td>' + a.date + '</td></tr>').join('') + '</table>'
    : '<div class="empty">لا توجد محاولات بعد.</div>';
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
$('#printReport').onclick = () => window.print();
$('#changePin').onclick = () => {
  const v = prompt('اكتبي الرمز الجديد (4 أرقام):');
  if(v && v.length >= 4){ pin = v; s(K.pin, pin); toast('تم تغيير الرمز ✅'); }
};
$('#uploadBtn').onclick = () => {
  const st = $('#upStudent').value.trim(), sc = $('#upSchool').value.trim(),
        ex = $('#upExam').value.trim(), sc2 = parseInt($('#upScore').value, 10);
  if(!st || !sc || !ex || isNaN(sc2)){ toast('أكملي بيانات الرفع ⬆️'); return; }
  attempts.push({ mode:'mcq', subject:'upload', field:'app', title:ex, score:sc2, correct:Math.round(sc2/10), total:10, answered:10, hints:0, retry:false, date:today(), time:new Date().toLocaleTimeString('ar-SA'), xp:0, source:'تطبيق مستقبلهم' });
  s(K.attempts, attempts);
  $('#uploadStatus').innerHTML = '<div class="notice">✅ تم رفع تقدّم <b>' + st + '</b> (' + sc2 + '%) إلى لوحة صاحب المبادرة.</div>';
  renderParent(); renderHub();
};
function renderUploaded(){
  const box = $('#uploadedList');
  if(!box) return;
  const up = attempts.filter(a => a.source);
  box.innerHTML = up.length ? '<table><tr><th>الطالبة</th><th>المهمة</th><th>الدرجة</th><th>التاريخ</th></tr>' +
    up.slice().reverse().map(a => '<tr><td>' + a.student + '</td><td>' + a.title + '</td><td>' + a.score + '%</td><td>' + a.date + '</td></tr>').join('') + '</table>' : '';
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
renderProfile();
renderHub();
renderTrain();
renderProgress();
renderUploaded();
