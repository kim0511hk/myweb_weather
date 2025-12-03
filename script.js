// 1. 설정 변수
const API_KEY = '12e52dbacc70f2ec12c7dc25068908c5'; 
let currentUnit = 'metric';
let currentLang = 'kr';
let currentLat = null;
let currentLon = null;
let world; 
let moonWorld;
let moonLight; 
let clockInterval = null; 
let currentMode = 0; 

// 예보 토글 관련 변수
let isHourlyForecast = false; 
let currentForecastData = null; 

const geoLangMap = { 'kr': 'ko', 'en': 'en', 'ja': 'ja', 'zh_cn': 'zh' };
const apiLangMap = { 'kr': 'kr', 'en': 'en', 'ja': 'ja', 'zh_cn': 'zh_cn' };

const translations = {
    kr: { 
        dust: "미세먼지", hum: "습도", wind: "풍속",
        pop: "강수확률", // [추가]
        outfitTitle: "오늘의 옷차림", 
        forecastTitle: "이번주 날씨", 
        hourlyTitle: "오늘 시각별 날씨",
        feelsLike: "체감 온도",
        good: "좋음", bad: "나쁨",
       moonPhase: ["삭", "초승달", "상현달", "상현망간의 달", "보름달", "하현망간의 달", "하현달", "그믐달"],
        astroTitle: "오늘의 천문 정보",
        sunMoon: ["일출", "일몰", "월출", "월몰"]
    },
    en: { 
        dust: "Dust", hum: "Humidity", wind: "Wind", 
        pop: "Rain Prob", // [추가]
        outfitTitle: "Outfit Rec", 
        forecastTitle: "Forecast", 
        hourlyTitle: "Hourly Forecast",
        feelsLike: "Feels Like", 
        good: "Good", bad: "Bad",
        moonPhase: ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"],
        astroTitle: "Astronomy Info",
        sunMoon: ["Sunrise", "Sunset", "Moonrise", "Moonset"]
    },
    ja: { 
        dust: "PM2.5", hum: "湿度", wind: "風速",
        pop: "降水確率", // [추가]
        outfitTitle: "今日の服装", 
        forecastTitle: "週間予報", 
        hourlyTitle: "時間別予報",
        feelsLike: "体感温度",
        good: "良い", bad: "悪い",
        moonPhase: ["新月", "三日月", "上弦の月", "十三夜月", "満月", "寝待月", "下弦の月", "有明月"],
        astroTitle: "今日の天文情報",
        sunMoon: ["日の出", "日の入", "月の出", "月の入"]
    },
    zh_cn: { 
        dust: "微尘", hum: "湿度", wind: "风速",
        pop: "降水概率", // [추가]
        outfitTitle: "今日着装", 
        forecastTitle: "本周天气", 
        hourlyTitle: "每小时天气",
        feelsLike: "体感温度",
        good: "好", bad: "差",
        moonPhase: ["新月", "娥眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"],
        astroTitle: "今天天文信息",
        sunMoon: ["日出", "日落", "月出", "月落"]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
        alert("script.js 파일에서 API Key를 입력해주세요!");
    }
    updateUIText();
    initGlobe(); 
    initMoon(); 
    loadRecentSearches();
    requestGPS();
});

function requestGPS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                getWeatherByCoord(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.warn("위치 권한 에러:", error);
                getWeather('Seoul'); 
            }
        );
    } else {
        getWeather('Seoul');
    }
}

function startClock(timezoneOffset) {
    if (clockInterval) clearInterval(clockInterval); 

    const update = () => {
        const now = new Date();
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const targetTime = new Date(utcMs + (timezoneOffset * 1000));

        const timeStr = targetTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        const dateOptions = { month: 'short', day: 'numeric', weekday: 'short' };
        const dateStr = targetTime.toLocaleDateString(currentLang === 'kr' ? 'ko-KR' : 'en-US', dateOptions);

        const timeEl = document.getElementById('localTime');
        if (timeEl) timeEl.textContent = timeStr;
        const dateEl = document.getElementById('localDate');
        if (dateEl) dateEl.textContent = dateStr;
    };

    update(); 
    clockInterval = setInterval(update, 1000); 
}

// script.js

function initGlobe() {
    const globeContainer = document.getElementById('globeViz');
    if (!globeContainer || typeof Globe === 'undefined') return;
    const width = globeContainer.clientWidth;
    const height = globeContainer.clientHeight;

    world = Globe()
        (globeContainer)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('rgba(0,0,0,0)')
        .width(width).height(height)
        .showAtmosphere(false)
        
        // [추가] 지구본 클릭 이벤트!
        .onGlobeClick(({ lat, lng }) => {
            // 1. 클릭한 좌표로 날씨 정보 가져오기
            getWeatherByCoord(lat, lng);
            
            // 2. (선택사항) 클릭 효과음이나 진동을 넣을 수도 있습니다.
            // console.log(`Clicked at: ${lat}, ${lng}`);
        });
    
    world.controls().autoRotate = true;
    world.controls().autoRotateSpeed = 0.25;
    world.controls().enableZoom = true;
    world.controls().minDistance = 200;  // 최소 거리 (가까이)
    world.controls().maxDistance = 600;  // 최대 거리 (멀리)

    window.addEventListener('resize', () => {
        const container = document.querySelector('.globe-section');
        if (container && world) {
            world.width(container.clientWidth);
            world.height(container.clientHeight);
        }
    });
}

// create a simple procedural moon texture (data URL) so we don't depend on cross-origin images
function createProceduralMoonTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // base surface
    ctx.fillStyle = '#242424ff';
    ctx.fillRect(0, 0, size, size);

    // add crater-like radial gradients
    /*const craterCount = Math.floor(size / 8);
    for (let i = 0; i < craterCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * (size / 12) + (size / 40);
        const grd = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
        grd.addColorStop(0, 'rgba(255, 255, 255, 0.27)');
        grd.addColorStop(0.6, 'rgba(160, 160, 160, 0.61)');
        grd.addColorStop(1, 'rgba(90,90,90,0.6)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }*/

    // subtle noise overlay
    const noiseDensity = Math.floor(size * 0.35);
    for (let n = 0; n < noiseDensity; n++) {
        ctx.fillStyle = `rgba(${120 + Math.floor(Math.random() * 70)},${120 + Math.floor(Math.random() * 70)},${120 + Math.floor(Math.random() * 70)},${(Math.random() * 0.08)})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, Math.random() * 3, Math.random() * 3);
    }

    return canvas.toDataURL();
}

// procedural bump map (grayscale noise) to provide some surface shading
function createProceduralBumpTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    const strokes = Math.floor(size * 0.6);
    for (let i = 0; i < strokes; i++) {
        const gray = 100 + Math.floor(Math.random() * 120);
        ctx.fillStyle = `rgba(${gray},${gray},${gray},${0.06 + Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, Math.random() * 6, Math.random() * 6);
    }

    return canvas.toDataURL();
}

// script.js

function initMoon() {
    const moonContainer = document.getElementById('moonViz');
    if (!moonContainer || typeof Globe === 'undefined') return;

    const moonImg = createProceduralMoonTexture(512);
    const bumpImg = createProceduralBumpTexture(512);

    moonWorld = Globe()
        (moonContainer)
        .globeImageUrl(moonImg)
        .bumpImageUrl(bumpImg)
        .backgroundColor('#000000') // 배경 검정
        .width(80).height(80)
        .showAtmosphere(false); // 대기 없음

    // [핵심] 조명 설정 (그림자 만들기)
    const scene = moonWorld.scene();
    
    // 1. 기존 조명 제거 (기본 조명이 있으면 그림자가 안 생김)
    scene.children.forEach(child => {
        if (child.isLight) child.visible = false;
    });

    // 2. 은은한 환경광 (너무 깜깜하지 않게)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.000000000000001); 
    scene.add(ambientLight);

    // 3. 태양광 (강한 빛, 그림자 생성용)
    moonLight = new THREE.DirectionalLight(0xFFF01D, 10000);
    moonLight.position.set(100, 0, 0); // 초기 위치
    scene.add(moonLight);

    // 달의 재질을 빛에 반응하도록 설정
    setTimeout(() => {
        const globeObj = moonWorld.scene().children.find(obj => obj.type === 'Group');
        if(globeObj) {
            globeObj.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    obj.material.needsUpdate = true;
                }
            });
        }
    }, 500);

    moonWorld.controls().autoRotate = false; // 회전 멈춤 (그림자 확인 위해)
    moonWorld.controls().enableZoom = false;
}
function updateAstroInfo(lat, lon) {
    if (typeof SunCalc === 'undefined') return;

    const now = new Date();
    const times = SunCalc.getTimes(now, lat, lon);
    const moonTimes = SunCalc.getMoonTimes(now, lat, lon);
    const moonIllumination = SunCalc.getMoonIllumination(now);

    

    updateMoonShadow(moonIllumination.phase);
    
    const formatTime = (date) => {
        return date ? date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '--:--';
    };

    const sunriseEl = document.getElementById('sunriseTime');
    if (sunriseEl) sunriseEl.textContent = formatTime(times.sunrise);
    const sunsetEl = document.getElementById('sunsetTime');
    if (sunsetEl) sunsetEl.textContent = formatTime(times.sunset);
    const moonriseEl = document.getElementById('moonriseTime');
    if (moonriseEl) moonriseEl.textContent = formatTime(moonTimes.rise);
    const moonsetEl = document.getElementById('moonsetTime');
    if (moonsetEl) moonsetEl.textContent = formatTime(moonTimes.set);



    const phase = moonIllumination.phase; 
    let phaseText = "";
    const t = translations[currentLang] || translations['en']; 
    const phases = t.moonPhase || translations['en'].moonPhase;

    // phase 값 범위 (0.0 ~ 1.0)
    // 0.0: 삭 (New)
    // 0.25: 상현 (First Quarter)
    // 0.5: 보름 (Full)
    // 0.75: 하현 (Last Quarter)

    if (phase < 0.03 || phase > 0.97) {
        phaseText = phases[0]; // 🌑 삭 (New Moon)
    } 
    else if (phase < 0.22) {
        phaseText = phases[1]; // 🌒 초승달 (Waxing Crescent)
    } 
    else if (phase < 0.28) {
        phaseText = phases[2]; // 🌓 상현달 (First Quarter) - 반달
    } 
    else if (phase < 0.47) {
        phaseText = phases[3]; // 🌔 상현망간의 달 (Waxing Gibbous) - 차가는 달
    } 
    else if (phase < 0.53) {
        phaseText = phases[4]; // 🌕 보름달 (Full Moon)
    } 
    else if (phase < 0.72) {
        phaseText = phases[5]; // 🌖 하현망간의 달 (Waning Gibbous) - 기우는 달
    } 
    else if (phase < 0.78) {
        phaseText = phases[6]; // 🌗 하현달 (Last Quarter) - 반달
    } 
    else {
        phaseText = phases[7]; // 🌘 그믐달 (Waning Crescent)
    }

    const phaseEl = document.getElementById('moonPhaseName');
    if (phaseEl) phaseEl.textContent = phaseText;
}

function updateGlobePosition(lat, lon, cityName) {
    if (!world) return;
    const markerData = [{ lat: lat, lng: lon, size: 0.5, color: 'red', name: cityName }];
    
    world
        .pointsData(markerData)
        .pointAltitude(0.02)
        .pointColor('color')
        .pointRadius(0.5)
        .htmlElementsData(markerData)
        .htmlElement(d => {
            const el = document.createElement('div');
            el.innerHTML = `
                <div style="color: white; font-family: 'Noto Sans KR', sans-serif; font-size: 16px; font-weight: bold; text-shadow: 0 0 3px black; transform: translate(-50%, -150%); white-space: nowrap;">
                    ${d.name}
                </div>`;
            return el;
        });

    world.pointOfView({ lat: lat, lng: lon, altitude: 1.7 }, 1800);
}

function toggleMode() {
    currentMode = (currentMode + 1) % 3; 
    const body = document.body;
    if (currentMode === 0) {
        body.classList.remove('dark-mode'); body.classList.remove('night-mode-active');
    } else if (currentMode === 1) {
        body.classList.add('dark-mode'); body.classList.remove('night-mode-active');
    } else {
        body.classList.remove('dark-mode'); body.classList.add('night-mode-active');
    }
}

function toggleForecastMode() {
    if (!currentForecastData) return; 
    isHourlyForecast = !isHourlyForecast; 
    const title = document.getElementById('forecastTitle');
    
    if (isHourlyForecast) {
        title.textContent = translations[currentLang].hourlyTitle;
        displayHourlyForecast(currentForecastData);
    } else {
        title.textContent = translations[currentLang].forecastTitle;
        displayForecast(currentForecastData);
    }
}

// --- 이벤트 리스너 ---
const searchModal = document.getElementById('searchModal');
const langModal = document.getElementById('langModal');
const cityInput = document.getElementById('cityInput');
const suggestionBox = document.getElementById('suggestionBox');

document.getElementById('openSearchBtn').onclick = () => { searchModal.style.display = "block"; cityInput.focus(); };
document.getElementById('openLangBtn').onclick = () => { langModal.style.display = "block"; };
document.getElementById('closeSearchBtn').onclick = () => searchModal.style.display = "none";
document.getElementById('closeLangBtn').onclick = () => langModal.style.display = "none";
window.onclick = (e) => { 
    if (e.target == searchModal) searchModal.style.display = "none"; 
    if (e.target == langModal) langModal.style.display = "none"; 
};

let debounceTimer;
cityInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = cityInput.value.trim();
    if (query.length < 1) { suggestionBox.style.display = 'none'; return; }
    debounceTimer = setTimeout(() => { fetchCitySuggestions(query); }, 500); 
});

async function fetchCitySuggestions(query) {
    const limit = 5;
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=${limit}&appid=${API_KEY}`;
    try {
        const res = await fetch(url);
        const cities = await res.json();
        displaySuggestions(cities);
    } catch (error) { console.error(error); }
}

function displaySuggestions(cities) {
    suggestionBox.innerHTML = '';
    if (cities.length === 0) { suggestionBox.style.display = 'none'; return; }
    cities.forEach(city => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        const localName = (city.local_names && city.local_names['ko']) ? city.local_names['ko'] : city.name;
        div.textContent = `${localName}, ${city.country}`;
        div.onclick = () => {
            cityInput.value = localName; 
            suggestionBox.style.display = 'none';
            getWeather(localName); 
            searchModal.style.display = 'none'; 
            cityInput.value = ""; 
        };
        suggestionBox.appendChild(div);
    });
    suggestionBox.style.display = 'block';
}

document.getElementById('searchActionBtn').onclick = () => {
    const city = cityInput.value;
    if(city) { getWeather(city); searchModal.style.display = "none"; cityInput.value = ""; }
};
cityInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') {
        const firstSuggestion = suggestionBox.querySelector('.suggestion-item');
        if (suggestionBox.style.display === 'block' && firstSuggestion) { firstSuggestion.click(); } 
        else { document.getElementById('searchActionBtn').click(); }
    }
});

document.getElementById('toggleUnitBtn').onclick = () => toggleUnit();
document.getElementById('currentLocBtn').onclick = () => requestGPS();
document.getElementById('toggleModeBtn').onclick = () => toggleMode();
document.getElementById('toggleForecastBtn').onclick = () => toggleForecastMode();


function changeLanguage(lang) {
    currentLang = lang;
    langModal.style.display = "none";
    updateUIText();
    if (currentLat && currentLon) getWeatherByCoord(currentLat, currentLon);
}

function updateUIText() {
    const t = translations[currentLang];
    document.getElementById('dustLabel').textContent = t.dust;
    document.getElementById('humidityLabel').textContent = t.hum;
    document.getElementById('windLabel').textContent = t.wind;
    document.getElementById('popLabel').textContent = t.pop;
    document.getElementById('outfitTitle').textContent = t.outfitTitle;
    document.getElementById('astroTitle').textContent = t.astroTitle;
    
    if (isHourlyForecast) document.getElementById('forecastTitle').textContent = t.hourlyTitle;
    else document.getElementById('forecastTitle').textContent = t.forecastTitle;

    // 천문 정보 라벨 업데이트
    const labels = document.querySelectorAll('.label-text');
    if (labels.length >= 4) {
        labels[0].textContent = t.sunMoon[0]; 
        labels[1].textContent = t.sunMoon[1]; 
        labels[2].textContent = t.sunMoon[2]; 
        labels[3].textContent = t.sunMoon[3]; 
    }
}

async function getWeather(city) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`;
    try {
        const res = await fetch(geoUrl);
        const data = await res.json();
        if (data.length === 0) throw new Error("도시를 찾을 수 없습니다.");
        const { lat, lon, local_names } = data[0];
        const geoLang = geoLangMap[currentLang]; 
        const displayName = (local_names && local_names[geoLang]) ? local_names[geoLang] : data[0].name;
        fetchAndDisplay(lat, lon, displayName);
    } catch (error) { console.error(error); alert("오류: " + error.message); }
}

async function getWeatherByCoord(lat, lon) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
    try {
        const res = await fetch(geoUrl);
        const data = await res.json();
        const geoLang = geoLangMap[currentLang];
        const displayName = (data[0].local_names && data[0].local_names[geoLang]) ? data[0].local_names[geoLang] : data[0].name;
        fetchAndDisplay(lat, lon, displayName);
    } catch (e) { fetchAndDisplay(lat, lon, "Unknown City"); }
}

async function fetchAndDisplay(lat, lon, cityName) {
    currentLat = lat; currentLon = lon;
    updateGlobePosition(lat, lon, cityName);
    
    try {
        updateAstroInfo(lat, lon); 
    } catch (e) { console.warn("Astro info error:", e); }

    const apiLang = apiLangMap[currentLang];
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}&lang=${apiLang}`;
    
    try {
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();
        const isNight = (weatherData.dt < weatherData.sys.sunrise || weatherData.dt > weatherData.sys.sunset);
        if (currentMode === 0) updateBackground(isNight);
        startClock(weatherData.timezone);

        const dustUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
        const dustRes = await fetch(dustUrl);
        const dustData = await dustRes.json();

        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}&lang=${apiLang}`;
        const forecastRes = await fetch(forecastUrl);
        const forecastData = await forecastRes.json();
        
        currentForecastData = forecastData;
        let maxPop = 0;
        if (forecastData.list && forecastData.list.length > 0) {
            // list[i].pop 은 0~1 사이의 소수점 값 (0.5 = 50%)
            // 다음 4개 구간(12시간)만 검사
            for(let i = 0; i < Math.min(4, forecastData.list.length); i++) {
                if (forecastData.list[i].pop > maxPop) {
                    maxPop = forecastData.list[i].pop;
                }
            }
        }

        // [수정] maxPop 값을 인자로 추가해서 넘겨줍니다!
        displayCurrentWeather(weatherData, dustData, cityName, isNight, maxPop);
        
        if (isHourlyForecast) displayHourlyForecast(forecastData);
        else displayForecast(forecastData);
        
        recommendOutfit(weatherData.main.temp);
        saveToLocalStorage(cityName);
    } catch (error) { console.error(error); alert("날씨 정보 오류: " + error.message); }
}

function updateBackground(isNight) {
    const body = document.body;
    if (currentMode === 0) {
        if (isNight) { body.classList.add('night'); body.classList.remove('day'); } 
        else { body.classList.add('day'); body.classList.remove('night'); }
    }
}

function displayCurrentWeather(data, dustData, cityName, isNight, maxPop) {
    updateWeatherEffects(data.weather[0].id);
    document.getElementById('cityName').textContent = cityName; 
    document.getElementById('temperature').textContent = Math.round(data.main.temp);
    document.getElementById('description').textContent = data.weather[0].description;
    document.getElementById('humidity').textContent = data.main.humidity;
    document.getElementById('wind').textContent = data.wind.speed;
    const popPercent = Math.round((maxPop || 0) * 100);
    document.getElementById('pop').textContent = popPercent;
    
    if (dustData && dustData.list && dustData.list.length > 0) {
        const dustLevel = dustData.list[0].main.aqi;
        const dustText = dustLevel <= 2 ? translations[currentLang].good : translations[currentLang].bad;
        document.getElementById('dust').textContent = dustText;
    } else {
        document.getElementById('dust').textContent = "-";
    }
    
    const feelsLikeTemp = Math.round(data.main.feels_like);
    const feelsLabel = translations[currentLang].feelsLike;
    document.getElementById('feelsLikeText').textContent = `${feelsLabel}: ${feelsLikeTemp}°`;

    const iconDiv = document.getElementById('weatherIcon');
    const wId = data.weather[0].id;
    iconDiv.className = 'weather-icon'; 

    if (wId === 800) {
        if (isNight) iconDiv.classList.add('moon');
        else iconDiv.classList.add('clear');
    }
    else if (wId >= 801) iconDiv.classList.add('clouds');
    else if (wId >= 500 && wId <= 531) iconDiv.classList.add('rain');
    else if (wId >= 600 && wId <= 622) iconDiv.classList.add('snow');
    else if (wId >= 200 && wId <= 232) iconDiv.classList.add('thunder');
    else iconDiv.classList.add('clouds'); 
}

function displayForecast(data) {
    const grid = document.getElementById('forecastGrid');
    grid.innerHTML = '';
    for (let i = 0; i < data.list.length; i += 8) {
        const day = data.list[i];
        const date = new Date(day.dt * 1000).toLocaleDateString(geoLangMap[currentLang], { weekday: 'short' });
        const wId = day.weather[0].id;
        const weatherClass = getWeatherClass(wId);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div>${date}</div>
            <div class="weather-icon small ${weatherClass}"></div> 
            <div style="font-weight:bold">${Math.round(day.main.temp)}°</div>
        `;
        grid.appendChild(card);
    }
}

// [수정됨] 24시간 표기법(HH:00) 적용
function displayHourlyForecast(data) {
    const grid = document.getElementById('forecastGrid');
    grid.innerHTML = '';
    
    const hourlyData = data.list.slice(0, 8);
    
    hourlyData.forEach(hour => {
        const dateObj = new Date(hour.dt * 1000);
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const time = `${hours}:00`; 
        
        const wId = hour.weather[0].id;
        const weatherClass = getWeatherClass(wId);

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div>${time}</div> 
            <div class="weather-icon small ${weatherClass}"></div> 
            <div style="font-weight:bold">${Math.round(hour.main.temp)}°</div>
        `;
        grid.appendChild(card);
    });
}

function getWeatherClass(wId) {
    if (wId === 800) return 'clear';
    if (wId >= 801) return 'clouds';
    if (wId >= 500 && wId <= 531) return 'rain';
    if (wId >= 600 && wId <= 622) return 'snow';
    if (wId >= 200 && wId <= 232) return 'thunder';
    return 'clouds';
}

function recommendOutfit(temp) {
    let tempC = currentUnit === 'metric' ? temp : (temp - 32) * 5 / 9;
    const title = document.getElementById('outfitTitle');
    const text = document.getElementById('outfitText');
    const t = translations[currentLang];
    title.textContent = t.outfitTitle;
    if (tempC >= 28) text.textContent = "🥵 " + (currentLang==='en'?"Hot! Shorts": "더워요! 반바지");
    else if (tempC >= 20) text.textContent = "👕 " + (currentLang==='en'?"T-shirt": "반팔/얇은긴팔");
    else if (tempC >= 10) text.textContent = "🧥 " + (currentLang==='en'?"Jacket": "자켓/가디건");
    else text.textContent = "🥶 " + (currentLang==='en'?"Coat & Scarf": "패딩/코트 필수");
}

function toggleUnit() {
    currentUnit = currentUnit === 'metric' ? 'imperial' : 'metric';
    document.getElementById('unit').textContent = currentUnit === 'metric' ? '°C' : '°F';
    if (currentLat && currentLon) getWeatherByCoord(currentLat, currentLon);
}

function saveToLocalStorage(city) {
    let searches = JSON.parse(localStorage.getItem('recentSearches')) || [];
    if (!searches.includes(city)) { searches.unshift(city); if (searches.length > 5) searches.pop(); localStorage.setItem('recentSearches', JSON.stringify(searches)); loadRecentSearches(); }
}
function loadRecentSearches() {
    const container = document.getElementById('recentSearch'); container.innerHTML = '';
    const searches = JSON.parse(localStorage.getItem('recentSearches')) || [];
    searches.forEach(city => { const btn = document.createElement('button'); btn.textContent = city; btn.onclick = () => getWeather(city); container.appendChild(btn); });
}
// script.js 맨 아래에 추가

// --- 날씨 배경 효과 제어 함수 ---
function updateWeatherEffects(wId) {
    const container = document.getElementById('weatherEffectContainer');
    if (!container) return;
    container.innerHTML = ''; // 기존 효과 초기화

    // 날씨 ID에 따라 효과 실행
    // 2xx: 뇌우, 3xx: 이슬비, 5xx: 비 -> 비 효과
    if (wId >= 200 && wId <= 531) {
        createRain(container);
    } 
    // 6xx: 눈 -> 눈 효과
    else if (wId >= 600 && wId <= 622) {
        createSnow(container);
    }
    // 801~804: 구름 -> 구름 효과 (800은 맑음이라 효과 없음)
    else if (wId >= 801 && wId <= 804) {
        createClouds(container);
    }
}

function createRain(container) {
    const amount = 100; // 빗방울 개수
    for (let i = 0; i < amount; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = Math.random() * 100 + 'vw';
        drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's'; // 0.5~1초 사이
        drop.style.animationDelay = Math.random() * 2 + 's';
        drop.style.opacity = Math.random();
        container.appendChild(drop);
    }
}

function createSnow(container) {
    const amount = 50; // 눈송이 개수
    for (let i = 0; i < amount; i++) {
        const flake = document.createElement('div');
        flake.className = 'snow-flake';
        const size = Math.random() * 5 + 2 + 'px'; // 2~7px 크기
        flake.style.width = size;
        flake.style.height = size;
        flake.style.left = Math.random() * 100 + 'vw';
        flake.style.animationDuration = (Math.random() * 3 + 2) + 's'; // 2~5초 사이 천천히
        flake.style.animationDelay = Math.random() * 5 + 's';
        flake.style.opacity = Math.random();
        container.appendChild(flake);
    }
}

function createClouds(container) {
    const amount = 5; // 배경 구름 개수
    for (let i = 0; i < amount; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud-effect';
        const size = Math.random() * 300 + 200 + 'px'; // 200~500px 대형 구름
        cloud.style.width = size;
        cloud.style.height = size;
        cloud.style.top = Math.random() * 40 + '%'; // 화면 상단 40% 내에 배치
        cloud.style.animationDuration = (Math.random() * 20 + 20) + 's'; // 매우 천천히 이동
        cloud.style.animationDelay = (Math.random() * 10) * -1 + 's'; // 미리 시작된 것처럼
        container.appendChild(cloud);
    }
}
// script.js 맨 아래에 추가

// 위상(0~1)에 따라 조명 위치 회전
function updateMoonShadow(phase) {
    if (!moonLight) return;

    // phase 0 (New Moon) -> 빛이 뒤에서 (각도 180도, PI)
    // phase 0.5 (Full Moon) -> 빛이 정면에서 (각도 0도)
    // 수학적 계산: 
    // phase가 0 -> Math.PI (뒤)
    // phase 0.5 -> 0 (앞)
    // phase 1.0 -> -Math.PI (다시 뒤)
    
    const angle = (phase - 0.5) * Math.PI * 2; 
    // 혹은 반대로 돌아가면 부호를 바꿈: -(phase - 0.5) ...

    // 빛을 원형으로 회전시킴 (거리 50)
    // 카메라가 Z축에 있다고 가정할 때:
    // X, Z 평면에서 회전
    moonLight.position.set(
        Math.sin(angle) * 50, // X
        0,                    // Y
        Math.cos(angle) * 50  // Z
    );
}
