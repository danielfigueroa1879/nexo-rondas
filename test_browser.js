const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    page.on('requestfailed', request => console.log('BROWSER NETWORK ERROR:', request.url(), request.failure().errorText));

    await page.goto('http://localhost:8081');
    console.log("Page loaded.");
    
    // Simulate login as admin
    await page.type('#email', 'admin@empresa.com');
    await page.type('#password', '123456');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    console.log("Clicking btn-new-guard...");
    await page.click('#btn-new-guard').catch(e => console.log(e.message));
    
    await page.waitForTimeout(1000);
    
    await browser.close();
})();
