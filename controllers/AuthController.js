let View = require('../views/base');
let path = require('path');
let fs = require('fs');
let crypto = require('crypto');
let config = require('../config/index')();
let ejs = require('ejs');

let BaseController = require('./BaseController');
let UserModel = require('../models/UserModel').User;
let LogModel = require('../models/LogModel').Log;

module.exports = BaseController.extend({
    name: 'AuthController',
    login: async function (req, res, next) {
        if (req.session.login === 1) return res.redirect('/');
        let v = new View(res, 'pages/login');
        v.render({
            title: 'ECAT | Login',
            session: req.session,
            i18n: res,
        })
    },
    forgotPassword: async function (req, res, next) {
        if (req.session.login === 1) return res.redirect('/');
        let v = new View(res, 'pages/forgot_password');
        v.render({
            title: 'ECAT | Forgot password',
            session: req.session,
            i18n: res,
        })
    },
    resetPassword: async function (req, res, next) {
        if (req.session.login === 1) return res.redirect('/');
        let token = req.query.token;
        if (!token) return res.redirect('/404');
        let user = await UserModel.findOne({reset_token: token});
        if (!user) return res.redirect('/404');
        req.session.user = user;
        let v = new View(res, 'auth/reset_password');
        v.render({
            title: 'ECAT | Forgot password',
            session: req.session,
            i18n: res,
        })
    },
    logout: async function (req, res, next) {
        try {
            let user_id = req.session.user.id;
            let logItem = new LogModel({
                user_id: user_id,
                type: 'user',
                text: 'Success Logout',
            });
            await logItem.save();
        } catch (e) {
            console.log("User is not defined in logout");
        }
        this.sessionClear(req, res, next);
        console.log("nBrowser", this.nBrowser);
        return res.redirect('/');
    },
    postLogin: async function (req, res, next) {
        let that = this;
        let login_email = req.body.email;
        let login_password = req.body.password;
        login_email = login_email.toLowerCase().trim();
        let user = await UserModel.findOne({email: login_email});
        let nike_login = 0;
        if (!user) {
            // create new user
            nike_login = await this.loginNike(login_email, login_password);
            if (nike_login) {
                let user_item = new UserModel({
                    name: 'user',
                    email: login_email,
                    password: crypto.createHash('md5').update(login_password).digest('hex'),
                    nike_password: login_password,
                    online_state: false,
                    avatar: '/images/avatar.png',
                    reset_flag: 2,
                    role: 2,
                    payment_flag: 0,
                    address_flag: 0,
                    cvc: 0,
                    created_at: new Date(),
                    updated_at: new Date()
                });
                user = await user_item.save();
                let logItem = new LogModel({
                    user_id: user.id,
                    type: "user",
                    text: "Success created user account",
                });
                await logItem.save();
            } else {
                this.sessionClear(req, res, next);
                return res.send({status: 'error', message: res.cookie().__('Login credentials are not valid')});
            }
        } else {
            if (!user.verifyPassword(login_password)) return res.send({status: 'error', message: res.cookie().__('Password is not correct')});
            nike_login = await this.loginNike(user.email, user.nike_password);
            // nike_login = 1;
            console.log("nike_login: ", nike_login);
            if (!nike_login) {
                let logItem = new LogModel({
                    user_id: user.id,
                    type: "user",
                    text: "Failed login",
                });
                await logItem.save();
                this.sessionClear(req, res, next);
                return res.send({status: 'error', message: res.cookie().__('Login credentials are not valid')});
            }
        }
        let logItem = new LogModel({
            user_id: user.id,
            type: "user",
            text: "Success login",
        });
        await logItem.save();
        req.session.user = user;
        req.session.login = 1;
        return res.send({status: 'success', message: res.cookie().__('Login is success')});
    },
    postForgotPassword: async function (req, res, next) {
        let forgot_email = req.body.forgot_email;
        let user = await UserModel.findOne({email: forgot_email});
        if (!user) return res.send({status: 'error', message: res.cookie().__('Unknown user')});
        let forgot_token_str = "ecat" + Date.now().toString() + (Math.random() * 101).toString() + 'forgot';
        let forgot_token = crypto.createHash('md5').update(forgot_token_str).digest('hex');

        let verify_email_link = config.base_url + "/auth/reset-password?token=" + forgot_token;
        // let template = __dirname + '/../views/templates/reset_password.ejs';
        let template = __dirname + '/../views/templates/resetPasswordNew.ejs';
        let templateData = {
            username: user.first_name,
            useremail: user.email,
            reset_password_link: verify_email_link,
            base_url: config.base_url,
            i18n: res,
        };
        ejs.renderFile(template, templateData, (err, html) => {
            if (err) {
                console.log('[' + new Date() + ']', "EMAIL TEMPLATE RENDER ERROR", err);
                return res.send({status: 'fail', message: res.cookie().__('html rendering failed')});
            }
            let mailOpts = {
                from: 'ECAT Manager <manager@ec-at.com>',
                to: forgot_email,
                subject: res.cookie().__('Do you want to change your password?'),
                html: html
            };
            transporter.sendMail(mailOpts, async (err, info) => {
                if (err) {
                    console.log('[' + new Date() + ']', "MAIL SENDING ERROR", err);
                    return res.send({status: 'error', message: 'Failed sending message to your email'});
                }
                console.log('[' + new Date() + '] Mail sending success ', JSON.stringify(info));
                await user.updateOne({reset_flag: 1, reset_token: forgot_token});
                return res.send({status: 'success', message: res.cookie().__('Please check your email')});
            });
        });
    },
    postResetPassword: async function (req, res, next) {
        if (!req.session.user) return res.send({status: 'error', message: res.cookie().__('Unknown user')});
        let user = await UserModel.findOne({id: req.session.user.id});
        if (!user) return res.send({status: 'error', message: res.cookie().__('Unknown user')});
        user.password = req.body.new_password;
        await user.save();
        return res.send({status: 'success', message: res.cookie().__('Updated password successfully')});
    },
});
