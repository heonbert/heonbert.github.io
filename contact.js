// 이메일 난독화: HTML 소스에 이메일이 노출되지 않도록 런타임에 조립
(function() {
    var u = 'heonbert';
    var d = 'gmail.com';
    var footer = document.querySelector('.footer-contact');
    if (!footer) return;
    var a = document.createElement('a');
    a.href = 'mai' + 'lto:' + u + '@' + d;
    a.setAttribute('aria-label', 'Email');
    a.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>';
    footer.appendChild(a);
})();
