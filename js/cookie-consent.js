(() => {
    'use strict';

    if (window.__tallerMapCookieConsentLoaded) {
        return;
    }
    window.__tallerMapCookieConsentLoaded = true;

    const STORAGE_KEY = 'tallermap_cookie_consent_v1';
    const POLICY_VERSION = '1.0';
    const ANALYTICS_ID = 'G-PHB5F28R3L';
    const ACCEPTED = 'accepted';
    const REJECTED = 'rejected';
    let analyticsLoaded = false;
    let banner = null;

    function loadVercelWebAnalytics() {
        if (window.__tallerMapVercelAnalyticsLoaded || document.querySelector('script[data-tallermap-vercel-analytics]')) {
            return;
        }

        window.__tallerMapVercelAnalyticsLoaded = true;
        window.va = window.va || function () {
            (window.vaq = window.vaq || []).push(arguments);
        };

        const script = document.createElement('script');
        script.defer = true;
        script.src = '/_vercel/insights/script.js';
        script.dataset.tallermapVercelAnalytics = 'true';
        document.head.appendChild(script);
    }

    // Vercel Web Analytics es anónimo y no usa cookies. Se carga de forma global
    // desde el script común que ya utilizan las páginas públicas de TallerMap.
    loadVercelWebAnalytics();

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || ((...args) => {
        window.dataLayer.push(args);
    });

    window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted',
        wait_for_update: 500
    });

    function readChoice() {
        try {
            const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
            if (stored && stored.version === POLICY_VERSION && (stored.choice === ACCEPTED || stored.choice === REJECTED)) {
                return stored.choice;
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    function saveChoice(choice) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                choice: choice,
                version: POLICY_VERSION,
                updatedAt: new Date().toISOString()
            }));
        } catch (error) {
            // El consentimiento sigue funcionando durante la visita aunque el navegador bloquee localStorage.
        }
    }

    function clearAnalyticsCookies() {
        document.cookie.split(';').forEach((cookie) => {
            const name = cookie.split('=')[0].trim();
            if (name === '_ga' || name.indexOf('_ga_') === 0) {
                const domains = ['', window.location.hostname, '.' + window.location.hostname];
                domains.forEach((domain) => {
                    const domainPart = domain ? '; Domain=' + domain : '';
                    document.cookie = name + '=; Max-Age=0; Path=/' + domainPart + '; SameSite=Lax';
                });
            }
        });
    }

    function loadAnalytics() {
        if (analyticsLoaded || document.querySelector('script[data-tallermap-analytics]')) {
            return;
        }

        analyticsLoaded = true;
        window.gtag('consent', 'update', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        window.gtag('js', new Date());
        window.gtag('config', ANALYTICS_ID, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false
        });

        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ANALYTICS_ID);
        script.dataset.tallermapAnalytics = 'true';
        document.head.appendChild(script);
    }

    function hideBanner() {
        if (banner) {
            banner.hidden = true;
        }
    }

    function choose(choice) {
        saveChoice(choice);
        if (choice === ACCEPTED) {
            loadAnalytics();
        } else {
            const reloadWithoutAnalytics = analyticsLoaded;
            window.gtag('consent', 'update', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
            clearAnalyticsCookies();
            if (reloadWithoutAnalytics) {
                window.setTimeout(() => { window.location.reload(); }, 50);
            }
        }
        hideBanner();
    }

    function createBanner() {
        const wrapper = document.createElement('aside');
        wrapper.className = 'cookie-banner';
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-labelledby', 'cookie-banner-title');
        wrapper.setAttribute('aria-describedby', 'cookie-banner-description');

        const content = document.createElement('div');
        content.className = 'cookie-banner__content';

        const copy = document.createElement('div');
        copy.className = 'cookie-banner__copy';

        const title = document.createElement('strong');
        title.id = 'cookie-banner-title';
        title.textContent = 'Tu privacidad, tu elección';

        const description = document.createElement('p');
        description.id = 'cookie-banner-description';
        description.append('Usamos cookies analíticas opcionales para saber cómo se utiliza TallerMap y mejorarlo. No se activarán hasta que las aceptes. ');

        const policyLink = document.createElement('a');
        policyLink.href = resolvePolicyUrl();
        policyLink.textContent = 'Ver política de cookies';
        description.appendChild(policyLink);

        copy.append(title, description);

        const actions = document.createElement('div');
        actions.className = 'cookie-banner__actions';

        const reject = document.createElement('button');
        reject.type = 'button';
        reject.className = 'cookie-choice';
        reject.textContent = 'Rechazar';
        reject.addEventListener('click', () => { choose(REJECTED); });

        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'cookie-choice';
        accept.textContent = 'Aceptar analítica';
        accept.addEventListener('click', () => { choose(ACCEPTED); });

        actions.append(reject, accept);
        content.append(copy, actions);
        wrapper.appendChild(content);
        document.body.appendChild(wrapper);
        return wrapper;
    }

    function resolvePolicyUrl() {
        return '/pages/cookies.html';
    }

    function openPreferences() {
        if (!banner) {
            banner = createBanner();
        }
        banner.hidden = false;
        const firstButton = banner.querySelector('button');
        if (firstButton) {
            firstButton.focus();
        }
    }

    function init() {
        const choice = readChoice();

        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-cookie-preferences]');
            if (trigger) {
                event.preventDefault();
                openPreferences();
            }
        });

        if (choice === ACCEPTED) {
            loadAnalytics();
        } else if (!choice) {
            openPreferences();
        }
    }

    window.TallerMapCookies = { open: openPreferences };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
