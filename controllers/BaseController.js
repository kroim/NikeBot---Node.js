let _ = require("underscore");
let config = require('../config')();
let fs = require('fs');
let crypto = require('crypto');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require("puppeteer-extra-plugin-stealth");
puppeteer.use(pluginStealth());
let fetch = require('node-fetch');
let useragent = require('express-useragent');
// const SimpleNodeLogger = require('simple-node-logger');
// const opts = {
//     logFilePath: 'logs/' + 'bot.log',
//     timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
// };
const {installMouseHelper} = require('./install_mouse_helper');

let UserModel = require('../models/UserModel').User;
let LogModel = require('../models/LogModel').Log;
let loginURL = 'https://www.nike.com/login';
let stockURL = 'https://www.nike.com/launch?s=in-stock';
let cartURL = 'https://www.nike.com/cart';
let checkoutURL = 'https://www.nike.com/checkout';
let tokenURL = 'https://unite.nike.com/auth/unite_session_cookies/v1';
let product_selector = 'a[data-qa="product-card-link"]';

module.exports = {
    name: "BaseController",
    nBrowser: {},
    extend: function (child) {
        return _.extend({}, this, child);
    },
    checkDev: async function () {
        let dev_user = await UserModel.findOne({email: config.dev_info.email});
        if (!dev_user) {
            let dev_item = new UserModel({
                name: config.dev_info.name,
                email: config.dev_info.email,
                password: crypto.createHash('md5').update(config.dev_info.password).digest('hex'),
                nike_password: config.dev_info.password,
                avatar: '/images/avatar.png',
                online_state: false,
                payment_flag: 0,
                address_flag: 0,
                cvc: 458,
                reset_flag: 2,
                role: 1,
                created_at: new Date(),
                updated_at: new Date()
            });
            await dev_item.save();
        }
    },
    loginNike: async function (nikeEmail, nikePassword) {
        let that = this;
        if (!nikeEmail || !nikePassword) return false;
        const browser = await puppeteer.launch({
            ignoreHTTPSErrors: true,
            headless: false,
            args: [`--window-size=1080,960`],
        });
        const tokenPage = await browser.newPage();
        const cartPage = await browser.newPage();
        const mainPage = await browser.newPage();
        await mainPage.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
        await installMouseHelper(mainPage);
        await mainPage.goto(loginURL);
        await mainPage.waitForSelector('.emailAddress > input');
        await mainPage.waitForTimeout(3000);
        console.log("type email ...");
        await mainPage.focus('.emailAddress > input');
        await mainPage.keyboard.type(nikeEmail);
        await mainPage.waitForTimeout(1000);
        // Password
        console.log("type password ...");
        await mainPage.focus('.password > input');
        await mainPage.keyboard.type(nikePassword);
        await mainPage.waitForTimeout(2000);
        // Submit
        console.log("submit ...");
        await mainPage.keyboard.type(String.fromCharCode(13));
        // await mainPage.click(".loginSubmit > input");
        await mainPage.waitForTimeout(9000);
        if (mainPage.url() === loginURL) {
            let loginCount = 3;
            for (let i = 0; i < loginCount; i++) {
                let errorFlag = await mainPage.evaluate(()=>{
                    let errorTag = document.querySelector('.nike-unite-error-panel');
                    if (errorTag) {
                        errorTag.querySelector('input[type="button"]').click();
                        return true;
                    } else return false;
                });
                if (errorFlag) {
                    await mainPage.waitForTimeout(500);
                    console.log("type password again...");
                    await mainPage.focus('.password > input');
                    await mainPage.keyboard.type(nikePassword);
                    await mainPage.waitForTimeout(1000);
                    // Submit
                    console.log("submit ...");
                    await mainPage.keyboard.type(String.fromCharCode(13));
                    await mainPage.waitForTimeout(2000);
                }
            }
            await mainPage.waitForTimeout(9000);
            if (mainPage.url() === loginURL) {
                await browser.close();
                return false;
            }
        }
        // mainPage.goto(stockURL, {waitUntil: 'load', timeout: 0});
        that.nBrowser[nikeEmail] = {browser: browser, mainPage: mainPage, tokenPage: tokenPage, cartPage: cartPage,
            color: "All", size_min: 0, size_max: 99, price_min: 0, price_max: 9999};
        return true;
    },
    getNikeAbck: async function (nikeEmail) {
        let that = this;
        let mainPage = this.nBrowser[nikeEmail].mainPage;
        await mainPage.goto(stockURL, {waitUntil: "load", timeout: 0});
        const cookies = await mainPage.cookies();
        // console.log("cookies: ", cookies);
        let abck = cookies.find((cookie) => cookie.name === '_abck').value;
        console.log("abck: ", abck);
        if (abck) {
            that.nBrowser[nikeEmail]["_abck"] = abck;
            return true;
        } else {
            return false;
        }
    },
    getNikeTokens: async function (nikeEmail) {
        let that = this;
        const tokenPage = that.nBrowser[nikeEmail].tokenPage;
        await tokenPage.goto(tokenURL, {waitUntil: 'load', timeout: 0});
        let content = await tokenPage.content();
        try {
            content = content.replace( /(<([^>]+)>)/ig, '');
            console.log("getNikeTokens: ", JSON.parse(content));
            let json_content = JSON.parse(content);
            that.nBrowser[nikeEmail]["user_id"] = json_content.user_id;
            that.nBrowser[nikeEmail]["access_token"] = json_content.access_token;
            that.nBrowser[nikeEmail]["refresh_token"] = json_content.refresh_token;
            return true;
        } catch (e) {
            console.log("get access token error: ", e);
            return false;
        }
    },
    checkPayment: async function (nikeEmail) {
        let accessToken = this.nBrowser[nikeEmail].access_token;
        await fetch("https://api.nike.com/commerce/storedpayments/consumer/storedpayments/?currency=USD&includebalance=false", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "appid": "com.nike.commerce.snkrs.web",
                "authorization": "Bearer " + accessToken,
                "cache-control": "no-cache",
                "content-type": "application/json; charset=UTF-8",
                "pragma": "no-cache",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "x-b3-parentspanid": "49641e1fe913aaae",
                "x-b3-spanid": "ae68bb1de93831d6",
                "x-b3-traceid": "56258a3be700cc14"
            },
            "referrer": "https://www.nike.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "",
            "method": "POST",
            "mode": "cors"
        })
            .then(res => res.json())
            .then(async json => {
                console.log("check payment: ", json);
                if (json.payments && json.payments.length > 0) {
                    let user = await UserModel.findOne({email: nikeEmail});
                    await user.updateOne({payment_flag: 1});
                    return true;
                } else return false;
            }).catch(()=>{return false;});
    },
    checkBillAddress: async function (nikeEmail) {
        let nike_user_id = this.nBrowser[nikeEmail].user_id;
        let accessToken = this.nBrowser[nikeEmail].access_token;
        let fetchURL = "https://api.nike.com/identity/user/v1/" + nike_user_id + "/address";
        let authorization = "Bearer " + accessToken;
        return await fetch(fetchURL, {
            "headers": {
                "accept": "application/json",
                "accept-language": "en-US,en;q=0.9",
                "authorization": authorization,
                "cache-control": "no-cache",
                "content-type": "application/json",
                "pragma": "no-cache",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "x-nike-ux-id": nike_user_id
            },
            "referrer": "https://www.nike.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        })
            .then(res => res.json())
            .then(async json => {
                if (json && !json.error && json.length > 0) {
                    let user = await UserModel.findOne({email: nikeEmail});
                    await user.updateOne({address_flag: 1});
                    return true;
                } else return false;
            }).catch(()=>{return false;});
    },
    getApiProducts: async function (nikeEmail) {
        let that = this;
        return await fetch("https://api.nike.com/product_feed/threads/v2/?anchor=9&count=21&filter=marketplace%28US%29&filter=language%28en%29&filter=inStock%28true%29&filter=productInfo.merchPrice.discounted%28false%29&filter=channelId%28010794e5-35fe-4e32-aaff-cd2c74f89d61%29&filter=exclusiveAccess%28true%2Cfalse%29&fields=active%2Cid%2ClastFetchTime%2CproductInfo%2CpublishedContent.nodes%2CpublishedContent.subType%2CpublishedContent.properties.coverCard%2CpublishedContent.properties.productCard%2CpublishedContent.properties.products%2CpublishedContent.properties.publish.collections%2CpublishedContent.properties.relatedThreads%2CpublishedContent.properties.seo%2CpublishedContent.properties.threadType%2CpublishedContent.properties.custom%2CpublishedContent.properties.title", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9,pl;q=0.8",
                "appid": "com.nike.commerce.snkrs.web",
                "cache-control": "no-cache",
                "content-type": "application/json; charset=UTF-8",
                "nike-api-caller-id": "nike:snkrs:web:1.0",
                "pragma": "no-cache",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "x-b3-parentspanid": "72ccc4b6b3e9bc40",
                "x-b3-spanid": "9f97d4565fb87b92",
                "x-b3-traceid": "1ee513cdee875bbc"
            },
            "referrer": "https://www.nike.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        }).then(res => res.json())
            .then(json => {
                console.log(json.objects);
                // that.nBrowser[nikeEmail]['apiProducts'] = json.objects;
                return json.objects;
            }).catch(()=>{ return [];});
    },
    getPageProducts: async function (nikeEmail) {
        let that = this;
        let mainPage = that.nBrowser[nikeEmail].mainPage;
        await mainPage.waitForTimeout(100);
        await mainPage.bringToFront();
        await mainPage.waitForTimeout(100);
        await mainPage.goto(stockURL, {waitUntil: "load", timeout: 0});
        await that.autoScroll(mainPage);
        await mainPage.waitForTimeout(1000);
        let pageProducts = [];
        let list_length = await mainPage.evaluate((sel) => {
            let elements = Array.from(document.querySelectorAll(sel));
            return elements.length;
        }, product_selector);
        console.log("list length: ", list_length);
        for(let i=0; i< list_length; i++){
            let product = await mainPage.evaluate((l, sel) => {
                let elements= Array.from(document.querySelectorAll(sel));
                let anchor  = elements[l];
                let image = elements[l].getElementsByTagName('img')[0];
                if(anchor && image){
                    return {anchor: anchor.href, image: image.src};
                } else return null;
            }, i, product_selector);
            console.log("product: ", product);
            if (product) pageProducts.push(product);
        }
        // that.nBrowser[nikeEmail]['pageProducts'] = pageProducts;
        return pageProducts;
    },
    getStockProducts: async function (nikeEmail) {
        let apiProducts = await this.getApiProducts(nikeEmail);
        let pageProducts = await this.getPageProducts(nikeEmail);
        let stockProducts = [];
        for (let i = 0; i < pageProducts.length; i++) {
            let pageItem = pageProducts[i];
            for (let j = 0; j < apiProducts.length; j++) {
                let apiItem = apiProducts[j];
                for (let k = 0; k < apiItem['productInfo'].length; k++) {
                    let item = apiItem['productInfo'][k];
                    if (pageItem.image.indexOf(item['imageUrls']['productImageUrl']) > -1) {
                        stockProducts.push({
                            anchor: pageItem.anchor,
                            image: item['imageUrls']['productImageUrl'],
                            title: item['productContent']['title'],
                            color: item['productContent'].colors[0].name,
                            price: item['merchPrice']['currentPrice'],
                            sizes: item['skus'],
                        });
                    }
                }
            }
        }
        let user = await UserModel.findOne({email: nikeEmail});
        let logItem = new LogModel({
            user_id: user.id,
            type: 'user',
            text: 'Success get stock products'
        });
        await logItem.save();
        console.log("StockProducts: ", stockProducts);
        return stockProducts;
    },
    searchProducts: async function (nikeEmail, stockProducts, color, size_min, size_max, price_min, price_max) {
        console.log("Requests: ", color, size_min, size_max, price_min, price_max);
        let logText = 'Search products, Color: ' + color + ', Minimum size: ' + size_min + ', Maximum size: ' + size_max +
            ', Minimum price: ' + price_min + ', Maximum price: ' + price_max;
        let user = await UserModel.findOne({email: nikeEmail});
        let logItem = new LogModel({
            user_id: user.id,
            type: 'user',
            text: logText
        });
        await logItem.save();
        let searchResult = [];
        for (let i = 0; i < stockProducts.length; i++) {
            let item = stockProducts[i];
            let item_color = item.color;
            let item_price = parseFloat(item.price);
            let item_sizes = item.sizes;
            // console.log("Item: ", item_color, item_price, item_sizes);
            if (color !== 'All' && item_color !== color) continue;
            if (item_price < price_min || item_price > price_max) continue;
            let size_flag = false;
            for (let j = 0; j < item_sizes.length; j++) {
                let sku = item_sizes[j];
                let nikeSize = parseFloat(sku['nikeSize']);
                if (isNaN(nikeSize) || nikeSize < size_min || nikeSize > size_max) continue;
                size_flag = true;
                break;
            }
            if (size_flag) searchResult.push(item);
        }
        return searchResult;
    },
    nikeCarts: async function (nikeEmail, products, sku, size_min, size_max, cvc) {
        console.log("size_min, size_max, cvc: ", sku, size_min, size_max, cvc);
        let that = this;
        let browser = that.nBrowser[nikeEmail].browser;
        let cartPage = this.nBrowser[nikeEmail].cartPage;
        let itemPage = await browser.newPage();
        for (let i = 0; i < products.length; i++) {
            let product = products[i];
            try {
                await itemPage.goto(product.anchor, {waitUntil: "load", timeout: 0});
                await itemPage.waitForSelector('.buying-tools-container', {
                    visible: true,
                });
                // check sku
                let skuFlag = await itemPage.evaluate((sku) => {
                    let skuText = 'SKU: ' + sku;
                    return document.body.innerText.indexOf(skuText) > 10;
                }, sku);
                console.log("SKU Flag: ", skuFlag);
                if (!skuFlag) continue;
                await itemPage.waitForTimeout(100);
                // check sizes
                let sizeFlag = await itemPage.evaluate(({size_min, size_max}) => {
                    let toolPanel = document.querySelector('.buying-tools-container');
                    let sizeButtons = toolPanel.querySelectorAll('li[data-qa="size-available"] > button');
                    console.log("sizeButtons length: ", sizeButtons.length);
                    let size_flag = false;
                    for (let k = 0; k < sizeButtons.length; k++) {
                        let buttonText = sizeButtons[k].innerText.replace( /^\D+/g, '');
                        // console.log("Button Text: ", buttonText);
                        if (parseFloat(buttonText) >= size_min && parseFloat(buttonText) <= size_max) {
                            sizeButtons[k].click();
                            size_flag = true;
                            break;
                        }
                    }
                    setTimeout(function () {
                        toolPanel.querySelector('button[data-qa="add-to-cart"]').click();
                    }, 500);
                    return size_flag;
                }, {size_min, size_max});
                console.log("Size Flag: ", sizeFlag);
                await itemPage.waitForTimeout(5000);
            } catch (e) {
                console.log("checkout failed");
                console.log(e);
            }
        }
        await itemPage.close();
        console.log("cart page ...");
        await cartPage.goto(cartURL, {waitUntil: "load", timeout: 0});
        await cartPage.waitForSelector('button[data-automation="member-checkout-button"]');
        let checkout_flag = await cartPage.evaluate(()=>{
            let checkoutButton = document.querySelectorAll('button[data-automation="member-checkout-button"]')[0];
            if (checkoutButton.disabled) {
                console.log("Disabled checkout button ...");
                return false;
            } else {
                console.log("click checkout button ...");
                checkoutButton.click();
                return true;
            }
        });
        console.log("clicked checkout ...", checkout_flag);
        await cartPage.waitForTimeout(3000);
        if (checkout_flag) {
            await that.nikeCheckout(nikeEmail, cvc)
        }
    },
    nikeCheckout: async function (nikeEmail, cvc) {
        let logText = "Checkout products";
        let user = await UserModel.findOne({email: nikeEmail});
        let logItem = new LogModel({
            user_id: user.id,
            type: 'user',
            text: logText
        });
        await logItem.save();
        let cartPage = this.nBrowser[nikeEmail].cartPage;
        await cartPage.goto(checkoutURL, {waitUntil: "load", timeout: 0});
        await cartPage.bringToFront();
        console.log("Waiting load cvc selector");
        await cartPage.waitForTimeout(7000);
        console.log("Waited load cvc input");
        const target_frame = cartPage.frames().find(frame => frame.url().includes('paymentcc.nike.com'));
        await target_frame.evaluate(
            () => (document.getElementById("cvNumber").focus())
        );
        await target_frame.waitForTimeout(1000);
        let cv_code = cvc.toString();
        await cartPage.keyboard.type(cv_code, {delay: 10});
        // await cartPage.click('#cvNumber');
        // await cartPage.keyboard.type(cvc);
        await cartPage.waitForTimeout(3000);
        // await cartPage.waitForSelector('.continueToOrderReviewBtn');
        await cartPage.evaluate(()=>{
            document.querySelector('button[data-attr="continueToOrderReviewBtn"]').click()
        });
        await cartPage.waitForTimeout(500);
        await cartPage.waitForSelector('.test-desktop-button');
        const testDeskTopBtn = await cartPage.$$('.test-desktop-button > button');
        await testDeskTopBtn[0].click();
        // await cartPage.evaluate(()=>{
        //     document.querySelectorAll('div.test-desktop-button > button')[0].click();
        // });
        await cartPage.waitForTimeout(3000);
    },
    sessionClear: function (req, res, next) {
        try {
            this.nBrowser[req.session.user.email].browser.close();
        } catch (e) {
            console.log("Undefined browser session");
        }
        try {
            delete this.nBrowser[req.session.user.email];
        } catch (e) {
            console.log("Undefined user session");
        }
        req.session.login = 0;
        req.session.user = null;
    },
    autoScroll: async function (page){
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                window.scrollTo(0, 0);
                let totalHeight = 0;
                let distance = 100;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });
    },
};
