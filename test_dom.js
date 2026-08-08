const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('public/index.html', 'utf8');
const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: "usable"
});

dom.window.localStorage.setItem('nexo_user', JSON.stringify({
    id: 1, role: 'admin', name: 'Admin Test'
}));

dom.window.document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded");
    setTimeout(() => {
        const btn = dom.window.document.getElementById('btn-new-guard');
        console.log("btn-new-guard exists:", !!btn);
        if (btn) {
            btn.click();
            const modal = dom.window.document.getElementById('modal-guard');
            console.log("modal-guard display:", modal.style.display);
        }
    }, 1000);
});
