import { t, tt } from '../i18n';

export function renderFooter(host: HTMLElement): void {
  const year = new Date().getFullYear();
  host.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <a href="/" class="brand" style="text-align:left;display:inline-block">Merèl</a>
            <p class="footer-tagline">${t('footer.tagline')}</p>
          </div>
          <div class="footer-col">
            <h4>${t('footer.shop')}</h4>
            <ul>
              <li><a href="/shop">${t('footer.link.all')}</a></li>
              <li><a href="/shop">${t('footer.link.bouquets')}</a></li>
              <li><a href="/shop">${t('footer.link.stems')}</a></li>
              <li><a href="/shop">${t('footer.link.vases')}</a></li>
              <li><a href="/looks">${t('footer.link.looks')}</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>${t('footer.about')}</h4>
            <ul>
              <li><a href="/story">${t('footer.link.story')}</a></li>
              <li><a href="/care">${t('footer.link.care')}</a></li>
              <li><a href="/care">${t('footer.link.contact')}</a></li>
            </ul>
          </div>
        </div>
        <div class="payment-marks" aria-label="Payment methods">
          <span class="pay-badge">iDEAL</span>
          <span class="pay-badge">Visa</span>
          <span class="pay-badge">Mastercard</span>
          <span class="pay-badge">Maestro</span>
          <span class="pay-badge">Apple Pay</span>
        </div>
        <div class="footer-legal">
          <span>${tt('footer.copyright', { year })}</span>
          <span>${t('footer.legal')}</span>
        </div>
      </div>
    </footer>`;
}
