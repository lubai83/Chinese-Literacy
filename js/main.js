const { pinyin } = pinyinPro;

let currentGrade = parseInt(localStorage.getItem('selectedGrade')) || 1;
let currentVocab = [];
let currentCardIndex = 0;
let writer = null;

let difficultWords = JSON.parse(localStorage.getItem('difficultWords')) || {};

function goHome() {
  window.location.href = 'index.html';
}

function getStorageKey() {
  const mode = document.querySelector('input[name="reviewMode"]:checked').value;
  const lesson = document.getElementById('lessonSelect').value;
  return `progress_${currentGrade}_${mode}_${lesson}`;
}

function saveProgress() {
  localStorage.setItem(getStorageKey(), currentCardIndex);
}

function loadProgress() {
  const savedIndex = parseInt(localStorage.getItem(getStorageKey()));
  currentCardIndex = savedIndex ? savedIndex : 0;
}

async function loadData() {
  const mode = document.querySelector('input[name="reviewMode"]:checked').value;
  let gradesToLoad = [];
  if (mode === 'all') {
    for (let i = 1; i <= currentGrade; i++) gradesToLoad.push(i);
  } else {
    gradesToLoad.push(currentGrade);
  }

  let allVocab = [];
  for (let g of gradesToLoad) {
    if (!window.MaLiPingVocab || !window.MaLiPingVocab[`grade${g}`]) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = `js/data/grade${g}.js`;
        script.onload = resolve;
        script.onerror = () => { console.warn(`js/data/grade${g}.js not found`); resolve(); };
        document.body.appendChild(script);
      });
    }
    if (window.MaLiPingVocab && window.MaLiPingVocab[`grade${g}`]) {
      allVocab = allVocab.concat(window.MaLiPingVocab[`grade${g}`]);
    }
  }

  if (mode === 'current') {
    const lesson = document.getElementById('lessonSelect').value;
    if (lesson) {
      allVocab = allVocab.filter(v => v.lesson === lesson);
    }
  }

  // Preserve order so progress navigation makes sense
  currentVocab = allVocab;
  
  if(currentVocab.length > 0) {
    loadProgress();
    if(currentCardIndex >= currentVocab.length) currentCardIndex = 0;
    renderCard();
  } else {
    document.getElementById('cardFront').innerText = '空';
  }
}

async function initApp() {
  if (!window.MaLiPingVocab || !window.MaLiPingVocab[`grade${currentGrade}`]) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = `js/data/grade${currentGrade}.js`;
        script.onload = resolve;
        script.onerror = resolve;
        document.body.appendChild(script);
      });
  }
  
  const gradeData = window.MaLiPingVocab[`grade${currentGrade}`] || [];
  const lessons = [...new Set(gradeData.map(v => v.lesson))];
  const select = document.getElementById('lessonSelect');
  select.innerHTML = '';
  lessons.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l; opt.innerText = l; select.appendChild(opt);
  });

  updateSidebar();
  
  writer = HanziWriter.create('hanzi-grid', '好', {
    width: 320, height: 320, padding: 20,
    strokeAnimationSpeed: 1, delayBetweenStrokes: 50,
    showCharacter: false, showOutline: true
  });

  loadData();
}

function onLessonChange() {
  document.querySelector('input[value="current"]').checked = true;
  loadData();
}

function onModeChange() {
  loadData();
}

function flipCard() {
  document.getElementById('flashcard').classList.toggle('flipped');
}

function prevCard() {
  if (currentCardIndex > 0) {
    currentCardIndex--;
    saveProgress();
    renderCard();
  }
}

function nextCard() {
  if (currentCardIndex < currentVocab.length - 1) {
    currentCardIndex++;
    saveProgress();
    renderCard();
  } else {
    // If at the end, just wrap around or stay
    currentCardIndex = 0;
    saveProgress();
    renderCard();
  }
}

function renderCard() {
  if (!currentVocab[currentCardIndex]) return;
  const charData = currentVocab[currentCardIndex];
  const char = charData.char;
  
  // Progress Bar
  const total = currentVocab.length;
  document.getElementById('progressText').innerText = `进度: ${currentCardIndex + 1} / ${total}`;
  document.getElementById('progressChar').innerText = char;
  const pct = ((currentCardIndex + 1) / total) * 100;
  document.getElementById('progressBarFill').style.width = `${pct}%`;
  
  // Flashcard
  document.getElementById('cardFront').innerText = char;
  document.getElementById('cardCharBack').innerText = char;
  document.getElementById('cardPinyin').innerText = pinyin(char);
  
  const phrases = charData.phrases || [];
  document.getElementById('cardPhrases').innerText = phrases.length > 0 ? phrases.join("，") : "暂无预设，请在课文中复习";

  document.getElementById('flashcard').classList.remove('flipped');
  writer.setCharacter(char);
}

function playAudio(e) {
  e.stopPropagation();
  const charData = currentVocab[currentCardIndex];
  if(!charData) return;
  
  const char = charData.char;
  const phrases = charData.phrases || [];
  
  let textToRead = char;
  if(phrases.length > 0) {
    textToRead += "。" + phrases.join("。");
  }
  
  const msg = new SpeechSynthesisUtterance(textToRead);
  msg.lang = 'zh-CN';
  msg.rate = 0.85; 
  window.speechSynthesis.speak(msg);
}

function animateStroke() {
  writer.animateCharacter();
}

function startQuiz() {
  writer.quiz({
    onMistake: function(strokeData) {
      document.getElementById('hanzi-grid').style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      setTimeout(() => document.getElementById('hanzi-grid').style.backgroundColor = 'transparent', 200);
    },
    onComplete: function(summaryData) {
      document.getElementById('hanzi-grid').style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
      setTimeout(() => document.getElementById('hanzi-grid').style.backgroundColor = 'transparent', 500);
    }
  });
}

function rateCard(status) {
  const charData = currentVocab[currentCardIndex];
  if(!charData) return;
  
  if (status === 'familiar') {
    delete difficultWords[charData.id];
  } else {
    difficultWords[charData.id] = { char: charData.char, status: status, pinyin: pinyin(charData.char) };
  }
  
  localStorage.setItem('difficultWords', JSON.stringify(difficultWords));
  updateSidebar();
  
  nextCard();
}

function updateSidebar() {
  const list = document.getElementById('difficultList');
  list.innerHTML = '';
  Object.values(difficultWords).forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${item.char}</span> <span class="pinyin">${item.pinyin}</span>`;
    list.appendChild(li);
  });
}

function clearDifficultWords() {
  if(confirm("确定要清空生字本吗？")) {
    difficultWords = {};
    localStorage.removeItem('difficultWords');
    updateSidebar();
  }
}

if (window.location.pathname.endsWith('app.html')) {
  window.onload = initApp;
}
