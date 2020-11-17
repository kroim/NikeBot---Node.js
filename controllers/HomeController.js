let View = require('../views/base');
let path = require('path');
let fs = require('fs');
let crypto = require('crypto');
let BaseController = require('./BaseController');
let UserModel = require('../models/UserModel').User;
let LogModel = require('../models/LogModel').Log;
let publicAbsPath = path.join(__dirname, '../public');

module.exports = BaseController.extend({
    name: 'HomeController',
    dashboard: async function (req, res, next) {
        let that = this;
        let nikeEmail = req.session.user.email;
        let abck = await that.getNikeAbck(nikeEmail);
        let content = await that.getNikeTokens(nikeEmail);
        let products = [];
        if (abck && content) {
            await that.checkBillAddress(nikeEmail);
            await that.checkPayment(nikeEmail);
            products = await that.getStockProducts(nikeEmail);
        }
        let user = await UserModel.findOne({email: nikeEmail});
        let sku = ''; let color = 'All'; let size_min = 0; let size_max = 99; let price_min = 0; let price_max = 9999;
        let logs = await LogModel.find({user_id: user.id});
        let v = new View(res, 'pages/dashboard');
        v.render({
            title: 'NikeBot | Home',
            session: req.session,
            i18n: res,
            tab_text: 'dashboard',
            user: user,
            logs: logs,
            sku: sku,
            color: color,
            size_min: size_min,
            size_max: size_max,
            price_min: price_min,
            price_max: price_max,
            products: products,
        })
    },
    profile: async function (req, res, next) {
        let that = this;
        let user = await UserModel.findOne({id: req.session.user.id});
        let v = new View(res, 'pages/profile');
        v.render({
            title: 'NikeBot | Profile',
            session: req.session,
            i18n: res,
            tab_text: 'profile',
            user: user,
        })
    },
    changeProfile: async function (req, res, next) {
        let user = await UserModel.findOne({id: req.session.user.id});
        let method_type = req.body.method_type;
        if (method_type === 'profile') {
            if (!user.verifyPassword(req.body.password)) return res.send({status: 'error', message: res.cookie().__('Password is not correct')});
            await user.updateOne({
                name: req.body.name,
                cvc: req.body.cvc,
            });
            return res.send({status: 'success', message: res.cookie().__('Profile is updated successfully')});
        } else if (method_type === 'password') {
            if (!user.verifyPassword(req.body.current_password)) return res.send({status: 'error', message: res.cookie().__('Current password is not correct')});
            await user.updateOne({
                password: crypto.createHash('md5').update(req.body.new_password).digest('hex'),
            });
            return res.send({status: 'success', message: res.cookie().__('Password is updated successfully')});
        } else if (method_type === 'avatar') {
            if (req.body.avatarImg.length > 1000) {
                let avatarData = req.body.avatarImg.replace(/^data:image\/\w+;base64,/, "");
                let file_extension = '.png';
                if (avatarData.charAt(0) === '/') file_extension = '.jpg';
                else if (avatarData.charAt(0) === 'R') file_extension = '.gif';
                let avatarPath = '/images/avatar_' + user.id + file_extension;
                let avatarUploadPath = publicAbsPath + avatarPath;
                fs.writeFileSync(avatarUploadPath, avatarData, 'base64');
                await user.updateOne({avatar: avatarPath});
                req.session.user.avatar = avatarPath;
                return res.send({status: 'success', message: res.cookie().__('Avatar is updated successfully')});
            } else return res.send({status: 'error', message: res.cookie().__('Undefined image')});
        } else {
            return res.send({status: 'error', message: res.cookie().__('Undefined method type')});
        }
    },
    runBot: async function (req, res, next) {
        let that = this;
        let user = await UserModel.findOne({id: req.session.user.id});
        if (!user.payment_flag || !user.address_flag || !user.cvc) return res.send({status: 'verify', message: 'Account is not verified'});
        let logItem = new LogModel({
            user_id: user.id,
            type: "user",
            text: "Running stock bot"
        });
        await logItem.save();
        let sku = req.body.sku;
        let color = req.body.color;
        let size_min = parseFloat(req.body.size_min);
        let size_max = parseFloat(req.body.size_max);
        let price_min = parseFloat(req.body.price_min);
        let price_max = parseFloat(req.body.price_max);
        // that.nBrowser[user.email].sku = sku;
        // that.nBrowser[user.email].color = color;
        // that.nBrowser[user.email].size_min = size_min;
        // that.nBrowser[user.email].size_max = size_max;
        // that.nBrowser[user.email].price_min = price_min;
        // that.nBrowser[user.email].price_max = price_max;
        let stockProducts = await that.getStockProducts(user.email);
        let products = await that.searchProducts(user.email, stockProducts, color, size_min, size_max, price_min, price_max);
        // let products = [];
        try {
            that.nikeCarts(user.email, products, sku, size_min, size_max, user.cvc);
            // that.nikeCheckout(user.email, user.cvc);
        } catch (e) {
            console.log("checkout error: ", e);
        }
        return res.send({status: 'success', message: 'Running bot successfully', products: products});
    },
    stopBot: async function (req, res, next) {
        let user = await UserModel.findOne({id: req.session.user.id});
        let logItem = new LogModel({
            user_id: user.id,
            type: "user",
            text: "Stopped stock bot"
        });
        await logItem.save();
        return res.send({status: 'success', message: 'Stopped bot successfully'});
    },
});