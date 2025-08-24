
document.addEventListener('DOMContentLoaded', function() {
	setTimeout(() => {
		console.log('%cRunning Shoply V4', 'color: #ccc; font-size: 20px;')
		console.log('%c\n\n\nDeveloped, created and built with ❤️ by itsmarian \nhttps://itsmarian.is-a.dev/ \nhttps://github.com/itsmarianmc/ \n\n\n', 'color: #7c3aed; font-size: 20px;');
	}, 60);

	const banner = document.querySelector('.cookie-banner');
	const settingsPanel = document.getElementById('settings-panel');
	const overlay = document.getElementById('overlay');
	const acceptAllBtn = document.getElementById('accept-all');
	const changeSettingsBtn = document.getElementById('change-settings');
	const closeSettingsBtn = document.getElementById('close-settings');
	const saveSettingsBtn = document.getElementById('save-settings');

	const analyticsToggle = document.getElementById('analytics-toggle');
	const preferencesToggle = document.getElementById('preferences-toggle');
	const thirdpartyToggle = document.getElementById('thirdparty-toggle');
	const marketingToggle = document.getElementById('marketing-toggle');

	const defaultConsent = {
		'ad_storage': 'denied',
		'ad_user_data': 'denied',
		'ad_personalization': 'denied',
		'analytics_storage': 'denied',
		'functionality_storage': 'denied',
		'personalization_storage': 'denied',
		'security_storage': 'denied'
	};
	gtag('consent', 'default', defaultConsent);

	document.querySelectorAll('.toggle-switch input').forEach(toggle => {
		if (!toggle.disabled) toggle.addEventListener('change', saveCookieSettings);
	});

	changeSettingsBtn.addEventListener('click', () => {
		settingsPanel.style.display = 'block';
		overlay.style.display = 'block';
		document.body.style.overflow = 'hidden';
	});

	closeSettingsBtn.addEventListener('click', closeSettings);
	overlay.addEventListener('click', closeSettings);

	saveSettingsBtn.addEventListener('click', () => {
		saveCookieSettings();
		setBannerAccepted();
		closeSettings();
		banner.style.display = 'none';
	});

	acceptAllBtn.addEventListener('click', () => {
		analyticsToggle.checked = true;
		preferencesToggle.checked = true;
		thirdpartyToggle.checked = true;
		marketingToggle.checked = true;
		saveCookieSettings();
		setBannerAccepted();
		banner.style.display = 'none';
	});

	function closeSettings() {
		settingsPanel.style.display = 'none';
		overlay.style.display = 'none';
		document.body.style.overflow = 'auto';
	}

	function saveCookieSettings() {
		const settings = {
			analytics: analyticsToggle.checked,
			preferences: preferencesToggle.checked,
			thirdparty: thirdpartyToggle.checked,
			marketing: marketingToggle.checked
		};
		localStorage.setItem('cookieSettings', JSON.stringify(settings));
		gtag('consent', 'update', {
			'analytics_storage': settings.analytics ? 'granted' : 'denied',
			'functionality_storage': settings.preferences ? 'granted' : 'denied',
			'ad_storage': settings.marketing ? 'granted' : 'denied',
			'ad_user_data': settings.marketing ? 'granted' : 'denied',
			'ad_personalization': settings.marketing ? 'granted' : 'denied',
			'personalization_storage': settings.preferences ? 'granted' : 'denied',
			'security_storage': 'granted'
		});
		if (settings.analytics) {
			gtag('config', 'G-2E9SPPVJFL', {
				'page_path': window.location.pathname
			});
		}
		console.log('%cCookie Settings saved:', 'font-weight:bold;');
		console.table(settings);
	}

	function loadCookieSettings() {
		const saved = localStorage.getItem('cookieSettings');
		if (!saved) return false;
		const settings = JSON.parse(saved);
		analyticsToggle.checked = settings.analytics;
		preferencesToggle.checked = settings.preferences;
		thirdpartyToggle.checked = settings.thirdparty;
		marketingToggle.checked = settings.marketing;
		console.log('%cCookie Settings loaded:', 'font-weight:bold;');
		console.table(settings);
		return true;
	}

	function setBannerAccepted() {
		localStorage.setItem('bannerAccepted', 'true');
	}

	function checkBannerAccepted() {
		return localStorage.getItem('bannerAccepted') === 'true';
	}

	function initCookieBanner() {
		if (checkBannerAccepted()) {
			loadCookieSettings();
			banner.style.display = 'none';
		} else {
			localStorage.removeItem('cookieSettings');
			analyticsToggle.checked = false;
			preferencesToggle.checked = false;
			thirdpartyToggle.checked = false;
			marketingToggle.checked = false;
			gtag('consent', 'default', defaultConsent);
			banner.style.display = 'block';
		}
	}

	initCookieBanner();
});

document.getElementById("settingsPannelOpener").addEventListener("click", () => {
	document.getElementById("settings-panel").style.display = "block";
	document.getElementById("overlay").style.display = "block";
});