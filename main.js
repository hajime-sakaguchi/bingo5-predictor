// main.js - Bingo 5 System
function initializeBingo5System() {
    // DOM Elements
    const btnFetchData = document.getElementById('btnFetchData');
    const btnGenerate = document.getElementById('btnGenerate');
    const resultContainer = document.getElementById('resultContainer');
    const fixSlotsContainer = document.getElementById('fixSlotsContainer');
    const globalStatsContent = document.getElementById('globalStatsContent');
    const personalStatsContent = document.getElementById('personalStatsContent');
    
    // State
    const AppState = {
        globalDraws: [], // 全体抽せんデータ
        personalHistory: [], // 個人実績データ
        globalStats: { slotCounts: [] }, // 枠ごとのHot/Cold
        personalStats: { mySlotCounts: [] }, // 購入数字のヒット率
        generatedSets: [] // 生成された5通りの予測データ
    };

    // !!!!!!!!!! ここにGASのデプロイURLを入力してください !!!!!!!!!!
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwQz65euuA-a6s5qKNUcMeqDC132VE0yZlrQMO34F1zS-D055-9fDHuyCAvCzOCOqM7DA/exec';

    // Bingo5 Range config (枠1〜8)
    const BINGO_RANGES = [
        { min: 1, max: 5 }, { min: 6, max: 10 }, { min: 11, max: 15 }, { min: 16, max: 20 },
        { min: 21, max: 25 }, { min: 26, max: 30 }, { min: 31, max: 35 }, { min: 36, max: 40 }
    ];

    // Initialize UI
    initUI();

    function initUI() {
        console.log("Bingo 5 System Initialized.");
        fixSlotsContainer.innerHTML = '';
        BINGO_RANGES.forEach((range, idx) => {
            const div = document.createElement('div');
            div.className = 'flex flex-col bg-white/5 border border-white/10 rounded-lg p-2';
            let options = `<option value="" class="bg-primary">-</option>`;
            for (let i = range.min; i <= range.max; i++) {
                options += `<option value="${i}" class="bg-primary">${i}</option>`;
            }
            div.innerHTML = `
                <span class="text-[10px] text-gray-400 text-center mb-1">Slot ${idx + 1}<br>(${range.min}-${range.max})</span>
                <select id="fixSlot${idx + 1}" class="bg-black/20 text-white border border-white/20 rounded p-1 text-sm focus:outline-none focus:border-accentGlow">
                    ${options}
                </select>`;
            fixSlotsContainer.appendChild(div);
        });
        
        // ページ読み込み時に自動的にデータ取得を実行
        setTimeout(() => {
            if (btnFetchData) btnFetchData.click();
        }, 500);
    }

    // 1. Data fetching from GAS
    btnFetchData.addEventListener('click', async () => {
        const fetchStatus = document.getElementById('fetchStatus');
        if (GAS_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
            fetchStatus.className = "text-xs text-yellow-400 mt-2 h-4 text-center font-mono";
            fetchStatus.textContent = "Please configure GAS_URL in main.js first.";
            return;
        }
        
        const btnIcon = btnFetchData.querySelector('svg');
        btnIcon.classList.add('animate-spin');
        fetchStatus.className = "text-xs text-blue-400 mt-2 h-4 text-center font-mono";
        fetchStatus.textContent = "Fetching data...";
        
        try {
            // Fetch Global Draws
            const globalRes = await fetch(`${GAS_URL}?action=getDraws`);
            const globalJson = await globalRes.json();
            if (globalJson.status === 'success') {
                // Header (1st row) may exist, we'll keep all valid rows
                AppState.globalDraws = globalJson.data.filter(row => row.length >= 10 && Number.isInteger(parseInt(row[2], 10)));
            }

            // Fetch Personal History
            const historyRes = await fetch(`${GAS_URL}?action=getHistory`);
            const historyJson = await historyRes.json();
            if (historyJson.status === 'success') {
                AppState.personalHistory = historyJson.data.filter(row => row.length >= 10 && Number.isInteger(parseInt(row[2], 10)));
            }

            // --- 統計計算ロジック ---
            
            // 1. Global Stats (Hot/Cold)
            const numberCounts = Array(41).fill(0);
            AppState.globalDraws.forEach(row => {
                for(let i=2; i<=9; i++) {
                    const num = parseInt(row[i], 10);
                    if(num >= 1 && num <= 40) numberCounts[num]++;
                }
            });
            
            // 枠ごとの出現回数も記録（予測アルゴリズム用）
            AppState.globalStats.slotCounts = Array(8).fill(null).map(() => Array(41).fill(0));
            AppState.globalDraws.forEach(row => {
                for(let i=0; i<8; i++) {
                    const num = parseInt(row[i+2], 10);
                    if(num >= 1 && num <= 40) AppState.globalStats.slotCounts[i][num]++;
                }
            });

            // Hot/Cold の選出 (全体)
            const sortedCounts = numberCounts.map((count, num) => ({num, count})).filter(x => x.num > 0).sort((a, b) => b.count - a.count);
            const hotNumbers = sortedCounts.slice(0, 5).map(x => `${x.num}(${x.count}回)`);
            const coldNumbers = sortedCounts.slice(-5).map(x => `${x.num}(${x.count}回)`);

            // 2. Personal Stats (購入癖)
            const myNumberCounts = Array(41).fill(0);
            AppState.personalHistory.forEach(row => {
                for(let i=2; i<=9; i++) {
                    const num = parseInt(row[i], 10);
                    if(num >= 1 && num <= 40) myNumberCounts[num]++;
                }
            });
            
            // 自分の枠ごとの購入癖（予測アルゴリズム用）
            AppState.personalStats.mySlotCounts = Array(8).fill(null).map(() => Array(41).fill(0));
            AppState.personalHistory.forEach(row => {
                for(let i=0; i<8; i++) {
                    const num = parseInt(row[i+2], 10);
                    if(num >= 1 && num <= 40) AppState.personalStats.mySlotCounts[i][num]++;
                }
            });

            const mySorted = myNumberCounts.map((count, num) => ({num, count})).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
            const myHabit = mySorted.slice(0, 5).map(x => `${x.num}(${x.count}回)`);

            // ヒット率計算（自分が買った数字が、その後の抽せんで出たか等）※今回は簡易的に過去のHotと自分のHabitの一致度
            let hitScore = 0;
            mySorted.slice(0,10).forEach(x => {
                if (sortedCounts.slice(0,10).find(h => h.num === x.num)) hitScore++;
            });
            const hitRate = mySorted.length > 0 ? Math.round((hitScore / 10) * 100) : 0;

            fetchStatus.className = "text-xs text-green-400 mt-2 h-4 text-center font-mono";
            fetchStatus.textContent = `Data synced! (Draws:${AppState.globalDraws.length}, History:${AppState.personalHistory.length})`;
            
            globalStatsContent.innerHTML = `<div class='text-green-400 mb-1'>Global data loaded (${AppState.globalDraws.length} draws).</div><div class="text-accentGlow">Hot:</div>${hotNumbers.join(', ')}<br><br><div class="text-blue-400">Cold:</div>${coldNumbers.join(', ')}`;
            personalStatsContent.innerHTML = `<div class='text-green-400 mb-1'>Personal history loaded (${AppState.personalHistory.length} sets).</div><div>Trend Match Rate: ${hitRate}%</div><br><div class="text-accentGlow">Strong Bias:</div>${myHabit.length > 0 ? myHabit.join(', ') : 'No data yet.'}`;
            
            // --- 次回予測回号と抽せん日の自動入力 ---
            if (AppState.globalDraws.length > 0) {
                let maxDraw = 0;
                let latestDateStr = null;
                AppState.globalDraws.forEach(row => {
                    const drawNum = parseInt(row[0], 10);
                    if (!isNaN(drawNum) && drawNum > maxDraw) {
                        maxDraw = drawNum;
                        latestDateStr = row[1];
                    }
                });
                
                if (maxDraw > 0) {
                    const targetDrawInput = document.getElementById('targetDrawNum');
                    if (targetDrawInput && !targetDrawInput.value) {
                        targetDrawInput.value = maxDraw + 1;
                    }
                    
                    const targetDateInput = document.getElementById('targetDrawDate');
                    if (latestDateStr && targetDateInput && !targetDateInput.value) {
                        const latestDate = new Date(latestDateStr);
                        if (!isNaN(latestDate.getTime())) {
                            // ビンゴ5は毎週水曜日（通常7日後）
                            const nextDate = new Date(latestDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                            const nextDateStr = `${nextDate.getFullYear()}-${(nextDate.getMonth()+1).toString().padStart(2, '0')}-${nextDate.getDate().toString().padStart(2, '0')}`;
                            targetDateInput.value = nextDateStr;
                        }
                    }
                }
            }
            
        } catch (error) {
            fetchStatus.className = "text-xs text-red-400 mt-2 h-4 text-center font-mono break-words";
            fetchStatus.textContent = "Error: " + error.message;
        } finally {
            btnIcon.classList.remove('animate-spin');
        }
    });

    // 2. Manual Results Entry Initialization
    const manualSlotsContainer = document.getElementById('manualSlotsContainer');
    const manualSelects = [];
    
    // 枠1〜8のドロップダウンを動的に生成
    for (let i = 0; i < 8; i++) {
        const range = BINGO_RANGES[i];
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col";
        
        const label = document.createElement('label');
        label.className = "text-[9px] text-gray-500 mb-0.5 text-center";
        label.textContent = `Slot ${i+1}`;
        wrapper.appendChild(label);
        
        const select = document.createElement('select');
        select.className = "input-glass rounded py-1 px-1 text-xs text-center appearance-none cursor-pointer focus:ring-1 focus:ring-accentGlow/50";
        // デフォルトの空オプション
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "-";
        defaultOption.className = "bg-primary text-white";
        select.appendChild(defaultOption);
        
        // 範囲内の数字を追加
        for (let num = range.min; num <= range.max; num++) {
            const opt = document.createElement('option');
            opt.value = num;
            opt.textContent = num;
            opt.className = "bg-primary text-white";
            select.appendChild(opt);
        }
        
        // 自動的に該当する固定枠(Fix Slot)にも反映させる
        select.addEventListener('change', (e) => {
            const fixSlot = document.getElementById(`fixSlot${i+1}`);
            if (fixSlot) {
                fixSlot.value = e.target.value;
            }
        });
        
        wrapper.appendChild(select);
        manualSlotsContainer.appendChild(wrapper);
        manualSelects.push(select);
    }
    
    // 保存ボタンの処理
    const btnSaveManual = document.getElementById('btnSaveManual');
    const manualStatus = document.getElementById('manualStatus');
    
    btnSaveManual.addEventListener('click', async () => {
        const drawNum = document.getElementById('manualDrawNum').value;
        const drawDateRaw = document.getElementById('manualDrawDate').value; // YYYY-MM-DD
        
        if (!drawNum || !drawDateRaw) {
            manualStatus.className = "text-xs text-yellow-400 text-center font-mono h-4";
            manualStatus.textContent = "回号と抽せん日を入力してください。";
            return;
        }
        
        const numbers = manualSelects.map(sel => sel.value);
        if (numbers.some(n => n === "")) {
            manualStatus.className = "text-xs text-yellow-400 text-center font-mono h-4";
            manualStatus.textContent = "当せん数字をすべて選択してください。";
            return;
        }
        
        const drawDate = drawDateRaw.replace(/-/g, '/'); // YYYY/MM/DD
        
        manualStatus.className = "text-xs text-blue-400 text-center font-mono h-4";
        manualStatus.textContent = "Saving to Google Sheets...";
        btnSaveManual.disabled = true;
        btnSaveManual.classList.add('opacity-50');
        
        try {
            // code.gsの doPost -> saveDraw の仕様に合わせたデータを作成
            const rowData = [
                parseInt(drawNum, 10),
                drawDate,
                ...numbers.map(n => parseInt(n, 10))
            ];
            
            const payload = {
                action: 'saveDraw',
                row: rowData
            };
            
            // fetch()でPOSTリクエスト送信
            // GASのウェブアプリは no-cors を指定しないとCORSエラーになる場合があります
            await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            // no-corsの場合、レスポンスの詳細は読めないため、例外が出なければ成功とみなす
            manualStatus.className = "text-xs text-green-400 text-center font-mono h-4";
            manualStatus.textContent = "保存が完了しました！";
            
            // 入力欄をクリア
            document.getElementById('manualDrawNum').value = "";
            document.getElementById('manualDrawDate').value = "";
            manualSelects.forEach(sel => sel.value = "");
            
            // 最新データを再取得する
            document.getElementById('btnFetchData').click();
            
        } catch (error) {
            manualStatus.className = "text-xs text-red-400 text-center font-mono h-4";
            manualStatus.textContent = "Error: " + error.message;
        } finally {
            btnSaveManual.disabled = false;
            btnSaveManual.classList.remove('opacity-50');
        }
    });

    // Simple PRNG based on string seed (Xorshift-like mock)
    function seededRandom(seedStr) {
        let h = 0xdeadbeef;
        for(let i = 0; i < seedStr.length; i++)
            h = Math.imul(h ^ seedStr.charCodeAt(i), 2654435761);
        let state = ((h ^ h >>> 16) >>> 0);
        
        return function() {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            return ((state < 0 ? ~state + 1 : state) % 100000) / 100000;
        }
    }

    btnGenerate.addEventListener('click', () => {
        try {
            const biasOption = document.getElementById('biasOption').value;
            const seedValue = "なりわいのいやさかなりてしろがねもくがねもほくらにみちみちる";
            
            // Fixed slots
            const fixedSlots = [];
            for(let i=1; i<=8; i++) {
                const val = document.getElementById(`fixSlot${i}`).value;
                fixedSlots.push(val ? parseInt(val) : null);
            }
            
            btnGenerate.querySelector('svg').classList.add('animate-spin');
            
            setTimeout(() => {
                try {
                    const results = generateBingo5(5, biasOption, seedValue, fixedSlots);
                    if (results.length === 0) {
                        resultContainer.innerHTML = '<div class="text-red-400 text-sm p-4 bg-red-900/20 rounded-xl border border-red-500/30">1000回試行しましたが条件(合計値150〜178)に合う数字が生成できませんでした。固定枠の指定が厳しすぎる可能性があります。</div>';
                    } else {
                        displayResults(results);
                    }
                } catch (err) {
                    resultContainer.innerHTML = `<div class="text-red-400 text-sm p-4 bg-red-900/20 rounded-xl border border-red-500/30">生成中にエラーが発生しました: ${err.message}</div>`;
                } finally {
                    btnGenerate.querySelector('svg').classList.remove('animate-spin');
                }
            }, 600); // UI feel delay
        } catch (err) {
            resultContainer.innerHTML = `<div class="text-red-400 text-sm p-4 bg-red-900/20 rounded-xl border border-red-500/30">ボタン押下時の初期処理でエラーが発生しました: ${err.message}</div>`;
        }
    });

    function generateBingo5(count, biasOption, seedStr, fixedSlots) {
        const rng = seedStr ? seededRandom(seedStr + Date.now().toString()) : Math.random;
        const mock = [];
        
        let attempts = 0;
        while(mock.length < count && attempts < 1000) {
            attempts++;
            const row = [];
            let sum = 0;
            
            for (let i = 0; i < 8; i++) {
                if (fixedSlots[i] !== null) {
                    row.push(fixedSlots[i]);
                    sum += fixedSlots[i];
                } else {
                    const r = BINGO_RANGES[i];
                    
                    // 重み付けの計算 (Weight Calculation)
                    let weights = [];
                    let totalWeight = 0;
                    for (let n = r.min; n <= r.max; n++) {
                        let w = 1.0; // 基準の重み（確率は均等）
                        
                        const gCount = (AppState.globalStats && AppState.globalStats.slotCounts && AppState.globalStats.slotCounts[i]) ? (AppState.globalStats.slotCounts[i][n] || 0) : 0;
                        const pCount = (AppState.personalStats && AppState.personalStats.mySlotCounts && AppState.personalStats.mySlotCounts[i]) ? (AppState.personalStats.mySlotCounts[i][n] || 0) : 0;
                        
                        if (biasOption === 'smart') {
                            // Smart: 全体のトレンド(Hot)を少し優遇しつつ、自分の買い癖を避ける
                            w += (gCount * 0.3);
                            w = Math.max(0.1, w - (pCount * 1.5));
                        } else if (biasOption === 'emphasize') {
                            // Emphasize: 自分の買い癖を極端に強調する
                            w += (pCount * 3.0);
                        } else if (biasOption === 'avoid') {
                            // Avoid: 自分の買い癖を完全に避ける
                            w = Math.max(0.01, w - (pCount * 2.0));
                        }
                        
                        weights.push({ n, w });
                        totalWeight += w;
                    }
                    
                    // 重み付け抽選 (Weighted Random Selection)
                    let randomVal = rng() * totalWeight;
                    let selectedNum = r.min;
                    for (const item of weights) {
                        randomVal -= item.w;
                        if (randomVal <= 0) {
                            selectedNum = item.n;
                            break;
                        }
                    }
                    
                    row.push(selectedNum);
                    sum += selectedNum;
                }
            }
            
            // Filter: sum constraint (avg is 164. Range [150, 178])
            if (sum < 150 || sum > 178) continue;
            
            mock.push(row);
        }
        
        AppState.generatedSets = mock;
        return mock;
    }

    function displayResults(results) {
        resultContainer.innerHTML = '';
        
        results.forEach((row, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group';
            
            const ballsHtml = row.map(n => `
                <div class="number-ball w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-white text-sm md:text-base cursor-default select-none transition-transform duration-300">
                    ${n}
                </div>
            `).join('');

            div.innerHTML = `
                <div class="font-bold text-gray-400 w-16 text-center border-r border-white/10 pr-4 mr-4 flex flex-col items-center justify-center">
                    <span class="text-[10px] uppercase tracking-widest text-accentGlow">Set</span>
                    <span class="text-xl text-white group-hover:text-accentGlow transition-colors">${idx + 1}</span>
                </div>
                <div class="flex-1 flex justify-between gap-1 md:gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    ${ballsHtml}
                </div>
            `;
            
            // Animation staggered entry
            div.style.opacity = '0';
            div.style.transform = 'translateY(10px)';
            resultContainer.appendChild(div);
            
            setTimeout(() => {
                div.style.transition = 'all 0.5s ease-out';
                div.style.opacity = '1';
                div.style.transform = 'translateY(0)';
            }, idx * 100);
        });
        
        document.getElementById('btnSaveHistory').classList.remove('hidden');
        document.getElementById('btnSaveHistory').classList.add('flex');
    }

    // 4. Save Generated History to GAS
    const btnSaveHistory = document.getElementById('btnSaveHistory');
    btnSaveHistory.addEventListener('click', async () => {
        if (!AppState.generatedSets || AppState.generatedSets.length === 0) return;
        
        btnSaveHistory.disabled = true;
        btnSaveHistory.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Saving...`;
        
        try {
            const targetDraw = document.getElementById('targetDrawNum').value;
            const targetDateRaw = document.getElementById('targetDrawDate').value;
            
            if (!targetDraw || !targetDateRaw) {
                resultContainer.innerHTML = `<div class="text-yellow-400 text-sm p-4 bg-yellow-900/20 rounded-xl border border-yellow-500/30">Algorithm Settings で「購入回号(Target Draw)」と「抽せん日(Draw Date)」を指定してください。</div>`;
                btnSaveHistory.disabled = false;
                btnSaveHistory.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save as History`;
                return;
            }
            
            const targetDate = targetDateRaw.replace(/-/g, '/');
            
            for (const row of AppState.generatedSets) {
                const rowData = [parseInt(targetDraw, 10), targetDate, ...row]; // 回号, 抽せん日, 枠1〜8
                const payload = { action: 'saveHistory', row: rowData };
                
                await fetch(GAS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            
            btnSaveHistory.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Saved!`;
            setTimeout(() => {
                btnSaveHistory.disabled = false;
                btnSaveHistory.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save as History`;
            }, 3000);
            
            // 履歴が更新されたので再取得して統計をアップデート
            document.getElementById('btnFetchData').click();
            
        } catch (error) {
            resultContainer.innerHTML = `<div class="text-red-400 text-sm p-4 bg-red-900/20 rounded-xl border border-red-500/30">Save failed: ${error.message}</div>`;
            btnSaveHistory.disabled = false;
            btnSaveHistory.innerHTML = `Save as History`;
        }
    });
}

// Ensure the code runs regardless of when it's loaded (useful for Google Sites iframes)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBingo5System);
} else {
    initializeBingo5System();
}
