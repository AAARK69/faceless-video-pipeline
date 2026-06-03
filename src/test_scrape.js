const { chromium } = require('playwright');

async function run() {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log("Navigating to zillowgonewild.com...");
    try {
        await page.goto('https://zillowgonewild.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log("Title:", await page.title());
        
        // Find continue reading links
        const readLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .filter(a => a.innerText.includes('Continue reading') || a.innerText.includes('continue reading'))
                .map(a => ({ href: a.href, text: a.innerText.trim() }));
        });
        
        console.log("Continue reading links:", readLinks);
        
        if (readLinks.length > 0) {
            const postUrl = readLinks[0].href;
            console.log("Navigating to post:", postUrl);
            await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
            console.log("Post Title:", await page.title());
            
            // Extract all image sources on the page
            const imgs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('img'))
                    .map(img => img.src)
                    .filter(src => src.startsWith('https://') && !src.includes('logo') && !src.includes('avatar') && !src.includes('hgtv'));
            });
            console.log("Found images in post:", imgs.slice(0, 10));
        }
    } catch (err) {
        console.error("Error during navigation:", err);
    } finally {
        await browser.close();
    }
}

run();
