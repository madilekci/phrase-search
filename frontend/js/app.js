const API_BASE = 'http://localhost:3000/api';

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const videoSection = document.getElementById('videoSection');
const videoPlayer = document.getElementById('videoPlayer');
const videoSource = document.getElementById('videoSource');
const currentPhrase = document.getElementById('currentPhrase');
const timestamp = document.getElementById('timestamp');
const searchInfo = document.getElementById('searchInfo');
const statsTotal = document.getElementById('statsTotal');
const statsDuration = document.getElementById('statsDuration');

async function loadStats() {
	try {
		const response = await fetch(`${API_BASE}/stats`);
		const stats = await response.json();
		statsTotal.textContent = stats.total_phrases;
		statsDuration.textContent = `${(stats.total_duration / 60).toFixed(1)} dakika`;
	} catch (error) {
		console.error('Failed to load stats:', error);
	}
}

async function search(query) {
	if (!query || query.trim().length < 2) {
		searchInfo.textContent = 'Lütfen en az 2 karakter girin';
		return;
	}

	loadingDiv.classList.remove('hidden');
	resultsDiv.innerHTML = '';
	searchInfo.textContent = '';
	videoSection.classList.add('hidden');

	try {
		const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
		const data = await response.json();

		loadingDiv.classList.add('hidden');

		if (data.results.length === 0) {
			resultsDiv.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h2>Sonuç bulunamadı</h2>
          <p>"${query}" için hiçbir cümle bulunamadı</p>
        </div>
      `;
			return;
		}

		searchInfo.textContent = `${data.count} sonuç bulundu`;
		displayResults(data.results);
	} catch (error) {
		loadingDiv.classList.add('hidden');
		resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h2>Hata</h2>
        <p>Arama yapılırken bir hata oluştu</p>
      </div>
    `;
		console.error('Search error:', error);
	}
}

function displayResults(results) {
	resultsDiv.innerHTML = '';

	results.forEach((result) => {
		const resultItem = document.createElement('div');
		resultItem.className = 'result-item';
		resultItem.innerHTML = `
      <div class="text">${result.text}</div>
      <div class="meta">
        ⏱️ ${result.start_time} - ${result.end_time}
        (${result.clip_duration.toFixed(1)}s)
      </div>
    `;

		resultItem.addEventListener('click', () => {
			playClip(result);
		});

		resultsDiv.appendChild(resultItem);
	});
}

function playClip(clip) {
	videoSection.classList.remove('hidden');
	videoSource.src = `/clips/${clip.clip_filename}`;
	videoPlayer.load();
	videoPlayer.play();

	currentPhrase.textContent = `"${clip.text}"`;
	timestamp.textContent = `⏱️ ${clip.start_time} - ${clip.end_time}`;

	videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

searchButton.addEventListener('click', () => {
	search(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		search(searchInput.value);
	}
});

loadStats();

console.log('🐺 Kurtlar Vadisi Phrase Search initialized');
