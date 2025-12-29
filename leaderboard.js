(function(){
    const STORAGE_KEY = 'fish_leaderboard_v1';

    function $(sel){ return document.querySelector(sel); }
    function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

    function loadLeaderboard(){
        try{
            const raw = localStorage.getItem(STORAGE_KEY);
            if(!raw) return [];
            const data = JSON.parse(raw);
            if(!Array.isArray(data)) return [];
            return data;
        }catch(e){ console.warn('Failed to load leaderboard', e); return []; }
    }

    function saveLeaderboard(arr){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }

    // Seed preset scores (only when empty)
    function seedPresetsIfEmpty(){
        const cur = loadLeaderboard();
        if(cur && cur.length > 0) return;
        const presets = [
            {name: 'Legend', score: 505},
            {name: 'ProFish', score: 480},
            {name: 'NightCat', score: 455},
            {name: 'TideMaster', score: 430},
            {name: 'WaveRider', score: 405},
            {name: 'SilverFin', score: 380},
            {name: 'GoldenHook', score: 355},
            {name: 'LuckyPaw', score: 330},
            {name: 'BaitBoss', score: 305},
            {name: 'ReelQueen', score: 280},
            {name: 'Bubble', score: 255},
            {name: 'Minnow', score: 230},
            {name: 'Guppy', score: 205},
            {name: 'Sprout', score: 180},
            {name: 'TinyFin', score: 155},
            {name: 'Drift', score: 130},
            {name: 'Pebble', score: 105},
            {name: 'Ripple', score: 80},
            {name: 'Splash', score: 55},
            {name: 'Starter', score: 30}
        ];
        saveLeaderboard(presets.map(it=>({name: it.name, score: Number(it.score)||0, ts: Date.now()})));
    }

    function renderLeaderboard(){
        const container = $('#leaderboardList');
        const data = loadLeaderboard();
        if(data.length === 0){ container.innerHTML = '<div style="opacity:.7">No scores yet</div>'; return; }
        // sort desc
        const sorted = data.slice().sort((a,b)=> b.score - a.score).slice(0,50);
        const ol = document.createElement('ol');
        sorted.forEach(item => {
            const li = document.createElement('li');
            const name = document.createElement('span'); name.className='name'; name.textContent = item.name || 'Anon';
            const score = document.createElement('span'); score.className='score'; score.textContent = item.score || 0;
            li.appendChild(name); li.appendChild(score);
            ol.appendChild(li);
        });
        container.innerHTML = '';
        container.appendChild(ol);
    }

    function addScore(name, score){
        const arr = loadLeaderboard();
        arr.push({ name: name || 'Anon', score: Number(score) || 0, ts: Date.now() });
        saveLeaderboard(arr);
        renderLeaderboard();
    }

    function upsertSessionScore(sessionId, name, score){
        const arr = loadLeaderboard();
        const idx = arr.findIndex(it => it._sessionId === sessionId);
        const entry = { name: name || 'You', score: Number(score) || 0, ts: Date.now(), _sessionId: sessionId };
        if(idx === -1){ arr.push(entry); } else { arr[idx] = Object.assign(arr[idx], entry); }
        saveLeaderboard(arr);
        renderLeaderboard();
    }

    function exportLeaderboard(){
        const data = loadLeaderboard();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'fish-leaderboard.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=> URL.revokeObjectURL(url), 5000);
    }

    function importLeaderboardFile(file){
        const reader = new FileReader();
        reader.onload = function(e){
            try{
                const parsed = JSON.parse(e.target.result);
                if(!Array.isArray(parsed)) throw new Error('Invalid format');
                // basic validation
                const clean = parsed.filter(it => it && (typeof it.name === 'string' || typeof it.score === 'number')).map(it=>({name: it.name||'Anon', score: Number(it.score)||0, ts: it.ts||Date.now()}));
                const arr = loadLeaderboard().concat(clean);
                saveLeaderboard(arr);
                renderLeaderboard();
                alert('Leaderboard imported.');
            }catch(err){ alert('Failed to import leaderboard: ' + err.message); }
        };
        reader.readAsText(file);
    }

    function clearLeaderboard(){
        if(!confirm('Clear leaderboard? This cannot be undone.')) return;
        localStorage.removeItem(STORAGE_KEY);
        renderLeaderboard();
    }

    function init(){
        seedPresetsIfEmpty();

        const submitBtn = $('#submitScore');
        const nameInput = $('#playerName');
        const scoreInput = $('#playerScore');
        const exportBtn = $('#exportLb');
        const importBtn = $('#importLb');
        const clearBtn = $('#clearLb');
        const importFile = $('#importFile');

        submitBtn.addEventListener('click', ()=>{
            const name = nameInput.value.trim() || 'Anon';
            let score = parseInt(scoreInput.value, 10);
            if(isNaN(score)){
                // try to read from game's exposed accessor
                try{ score = (typeof window.getFishScore === 'function') ? Number(window.getFishScore()) : 0; }catch(e){ score = 0; }
            }
            addScore(name, score);
            nameInput.value = '';
            scoreInput.value = '';
        });

        exportBtn.addEventListener('click', exportLeaderboard);
        importBtn.addEventListener('click', ()=> importFile.click());
        importFile.addEventListener('change', (e)=>{
            const f = e.target.files && e.target.files[0];
            if(f) importLeaderboardFile(f);
            importFile.value = '';
        });

        clearBtn.addEventListener('click', clearLeaderboard);

        // live-update the score field placeholder if game exposes score
        setInterval(()=>{
            if(typeof window.getFishScore === 'function'){
                const s = Number(window.getFishScore()) || 0;
                if(document.activeElement !== scoreInput) scoreInput.placeholder = s;
            }
        }, 1000);

        // SESSION AUTO-UPDATER: keep a session-scoped leaderboard entry that mirrors the in-game score
        const sessionId = 'sess_' + Math.random().toString(36).slice(2,9);
        let lastSessionScore = null;
        setInterval(()=>{
            try{
                if(typeof window.getFishScore === 'function'){
                    const currentScore = Number(window.getFishScore()) || 0;
                    const name = (document.getElementById('playerName') && document.getElementById('playerName').value.trim()) || 'You';
                    if(lastSessionScore !== currentScore){
                        lastSessionScore = currentScore;
                        upsertSessionScore(sessionId, name, currentScore);
                    }
                }
            }catch(e){ /* ignore */ }
        }, 1000);

        renderLeaderboard();
    }

    // initialize on DOM ready
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
