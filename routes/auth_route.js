let express = require('express');
let router = express.Router();

let auth_controller = require('../controllers/AuthController');

router.get('/login', function (req, res, next) {
    auth_controller.login(req, res, next);
});
router.post('/login', function (req, res, next) {
    auth_controller.postLogin(req, res, next);
});

router.get('/reset-password', function (req, res, next) {
    auth_controller.resetPassword(req, res, next);
});
router.get('/forgot-password', function (req, res, next) {
    auth_controller.forgotPassword(req, res, next);
});
router.post('/forgot-password', function (req, res, next) {
    auth_controller.postForgotPassword(req, res, next);
});
router.post('/reset-password', function (req, res, next) {
    auth_controller.postResetPassword(req, res, next);
});

router.get('/logout', function (req, res, next) {
    auth_controller.logout(req, res, next);
});




module.exports = router;
