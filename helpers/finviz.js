require('chromedriver');
let webdriver = require('selenium-webdriver');
let chrome = require('selenium-webdriver/chrome');

const FINVIZ_URL = "https://finviz.com/";
const XPATHS = {
    "login": "/html/body/table[2]/tbody/tr/td/table/tbody/tr/td[16]/a",
    "email": "/html/body/div[2]/div/div/form/label[1]/input",
    "password": "/html/body/div[2]/div/div/form/label[2]/input",
    "loginSubmit": "/html/body/div[2]/div/div/form/input",
    "portfolio": "/html/body/table[2]/tbody/tr/td/table/tbody/tr/td[6]/a",
    "portfolioSelect": "/html/body/table[3]/tbody/tr[1]/td/table/tbody/tr[3]/td/form/table/tbody/tr[1]/td[1]/select",
    "portfolioEdit": "/html/body/table[3]/tbody/tr[1]/td/table/tbody/tr[3]/td/form/table/tbody/tr[1]/td[2]/a[2]",
    "portfolioName": "/html/body/table[3]/tbody/tr[1]/td/table/tbody/tr[3]/td/form/table[2]/tbody/tr[1]/td[8]/input",
    "portfolioTable": "/html/body/table[3]/tbody/tr[1]/td/table/tbody/tr[3]/td/form/table[2]/tbody",
    "save": "/html/body/table[3]/tbody/tr[1]/td/table/tbody/tr[3]/td/form/table[3]/tbody/tr/td[2]/input"
}

async function addToFinvizWatchlist(symbols, login, watchlist) {
    let options = new chrome.Options();
    options.addArguments('headless');
    let driver = new webdriver.Builder()
        .withCapabilities(webdriver.Capabilities.chrome())
        .setChromeOptions(options)
        .build();

    try {
        // login
        await loginFinviz(driver, login);

        // go to watchlist
        await selectWatchlist(driver, watchlist);

        // add enough rows for incoming symbols
        let addRows = await driver.wait(webdriver.until.elementLocated(webdriver.By.id('addrows_button')));
        for (let i = 0; i < Math.ceil(symbols.length / 10); ++i) {
            await addRows.click();
        }

        // find table
        let table = await driver.findElement(webdriver.By.xpath(XPATHS["portfolioTable"]));
        let rows = await table.findElements(webdriver.By.tagName('tr'));
        // remove labels
        rows.shift();

        // find first empty row 
        let firstRowIndex = 0;
        for (let i = 0; i < rows.length; ++i) {
            let row = rows[i];
            let ticker = await row.findElement(webdriver.By.className("portfolio-edit"));
            let tickerText = await ticker.getAttribute("value");
            tickerText = tickerText.trim();
            if (tickerText == "") {
                firstRowIndex = i;
                break;
            }
        }

        // add symbols
        for (let i = 0; i < symbols.length; ++i) {
            let symbol = symbols[i];
            removeAds(driver);
            await addSymbol(driver, symbol, rows[firstRowIndex + i]);
        }

        // scroll down to avoid ads
        await driver.findElement(webdriver.By.tagName("body")).sendKeys(webdriver.Key.CONTROL, webdriver.Key.END);
        await new Promise(r => setTimeout(r, 1000));

        // save main frame
        let mainWindow = driver.getWindowHandle();

        // calculate the shares
        removeAds(driver);
        let calculateShares = await driver.findElement(webdriver.By.id('recalculate_button'));
        await calculateShares.click();
        // wait for alert
        await new Promise(r => setTimeout(r, 1000));
        await driver.switchTo().alert().accept();

        // switch to main frame
        await driver.switchTo().window(mainWindow);
        // save
        removeAds(driver);
        await saveWatchlist(driver);

        console.log("DONE");
        driver.quit();
    }
    catch (err) {
        console.log("ERROR!", err);
        driver.quit();
    }
}

async function loginFinviz(driver, login) {
    // load page
    driver.get(FINVIZ_URL);

    // click signin
    let signin = await driver.findElement(webdriver.By.xpath(XPATHS["login"]));
    await signin.click();

    // enter info
    let email = await driver.wait(webdriver.until.elementLocated(webdriver.By.xpath(XPATHS["email"])));
    await email.sendKeys(login.username)
    let password = await driver.findElement(webdriver.By.xpath(XPATHS["password"]));
    await password.sendKeys(login.password)

    // click signin
    let submit = await driver.findElement(webdriver.By.xpath(XPATHS["loginSubmit"]));
    await submit.click();
}

async function selectWatchlist(driver, watchlistName) {
    // go to portfolio page
    let portfolio = await driver.wait(webdriver.until.elementLocated(webdriver.By.xpath(XPATHS["portfolio"])));
    portfolio.click();

    // click combobox
    let watchlists = driver.wait(webdriver.until.elementLocated(webdriver.By.xpath(XPATHS["portfolioSelect"])));
    await watchlists.click();

    // find desired watchlist
    let entries = await watchlists.findElements(webdriver.By.tagName('option'));
    for (let i = 0; i < entries.length; ++i) {
        let entry = entries[i];
        let text = await entry.getText();
        text = text.trim();
        if (text == watchlistName) {
            await entry.click();
            let edit = await driver.wait(webdriver.until.elementLocated(webdriver.By.xpath(XPATHS["portfolioEdit"])));
            // remove all ads
            await edit.click();
            return;
        }
    }

    // if no watchlist exists with the name
    let newWatchlist = entries[0];
    await newWatchlist.click();

    // enter watchlist name
    let newWatchlistText = await driver.wait(webdriver.until.elementLocated(webdriver.By.xpath(XPATHS["portfolioName"])));
    await newWatchlistText.sendKeys(watchlistName);
}

async function addSymbol(driver, symbol, row) {
    let cells = await row.findElements(webdriver.By.tagName("td"));
    // enter symbol
    let symbolInput = await cells[1].findElement(webdriver.By.tagName("input"));
    await symbolInput.sendKeys(symbol);

    // get current price
    let priceButton = await cells[6].findElement(webdriver.By.tagName("button"));
    await priceButton.click();
}

async function saveWatchlist(driver) {
    // save button
    let save = await driver.findElement(webdriver.By.xpath(XPATHS["save"]));
    await save.click();
}

function removeAds(driver) {
    driver.executeScript("document.querySelectorAll('iframe').forEach(function(element) {element.remove();});")
}

module.exports = { addToFinvizWatchlist }