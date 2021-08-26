import 'chromedriver';
import webdriver from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';

import { ExportLogin } from '../types/types';

const STOCKSTRACKER_URL = "https://www.stockstracker.com/";
const XPATHS = { "watchlists": "/html/body/div[2]/table/tbody/tr/td[1]/div[2]/div[1]/div[2]/a" }

async function addToStocksTrackerWatchlist(symbols: string[], login: ExportLogin, watchlist: string) {
    let options = new chrome.Options();
    options.addArguments('headless');
    options.addArguments('no-sandbox');
    options.addArguments('disable-gpu');
    options.addArguments('disable-dev-shm-usage');
    let driver = new webdriver.Builder()
        .withCapabilities(webdriver.Capabilities.chrome())
        .setChromeOptions(options)
        .build();

    try {
        // login
        await loginStocksTracker(driver, login);

        // go to watchlist
        await selectWatchlist(driver, watchlist);

        // add symbols
        for (let i = 0; i < symbols.length; ++i) {
            let symbol = symbols[i];
            await addSymbol(driver, symbol);
        }

        console.log("DONE");
        driver.quit();
    }
    catch {
        driver.quit();
    }
}

async function loginStocksTracker(driver:  webdriver.ThenableWebDriver, login: ExportLogin) {
    // load page
    driver.get(STOCKSTRACKER_URL);

    // click signin
    let signin = await driver.findElement(webdriver.By.id("signin"));
    await signin.click();

    // enter info
    let email = await driver.wait(webdriver.until.elementLocated(webdriver.By.id("email")));
    await email.sendKeys(login.username)
    let password = await driver.findElement(webdriver.By.id("password"));
    await password.sendKeys(login.password)

    // click signin
    let submit = await driver.findElement(webdriver.By.id("btnSubmit"));
    await submit.click();
}

async function selectWatchlist(driver:  webdriver.ThenableWebDriver, watchlistName: string) {
    // click combobox
    let watchlists = await driver.findElement(webdriver.By.xpath(XPATHS.watchlists));
    await watchlists.click();

    // find desired watchlist
    let watchlistResults = await driver.wait(webdriver.until.elementLocated(webdriver.By.className("resultSet")));
    // wait for results to load
    await new Promise(r => setTimeout(r, 3000));
    let entries = await watchlistResults.findElements(webdriver.By.tagName('tr'));
    for (let i = 0; i < entries.length; ++i) {
        let entry = entries[i];
        let text = await entry.getText();
        text = text.trim();
        if (text == watchlistName) {
            entry.click();
            return;
        }
    }

    // if no watchlist exists with the name
    // click +
    let newWatchlist = await driver.findElement(webdriver.By.className("btnNew"));
    await newWatchlist.click();

    // enter watchlist name
    let newWatchlistText = await driver.wait(webdriver.until.elementLocated(webdriver.By.id("wname")));
    await newWatchlistText.sendKeys(watchlistName);

    // click create
    let modal = await driver.findElement(webdriver.By.id("dialog-div-dom"));
    let create = await modal.findElement(webdriver.By.xpath("//*[text()='Create']"))
    await create.click();

    // recursive call to actually select the watchlist
    await selectWatchlist(driver, watchlistName);
}

async function addSymbol(driver:  webdriver.ThenableWebDriver, symbol: string) {
    // search symbol
    let searchbar = await driver.findElement(webdriver.By.id('searchbox'));
    searchbar.sendKeys(symbol);
    await new Promise(r => setTimeout(r, 1500));

    // find first result
    let results = await driver.findElement(webdriver.By.id('searchResultSet'));
    let firstResult = await results.findElement(webdriver.By.tagName('td'));

    // add symbol
    await firstResult.click();
}

export { addToStocksTrackerWatchlist }