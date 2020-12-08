let express = require('express');
let router = express.Router();

let middleware_controller = require('../controllers/MiddlewareController');
let home_controller = require('../controllers/HomeController');

router.get('/', middleware_controller.m_checkLogin, function (req, res, next) {
    home_controller.dashboard(req, res, next);
});
router.get('/profile', middleware_controller.m_checkLogin, function (req, res, next) {
    home_controller.profile(req, res, next);
});
router.post('/change-profile', middleware_controller.m_checkLogin, function (req, res, next) {
    home_controller.changeProfile(req, res, next);
});
// router.post('/app-run', middleware_controller.m_checkLogin, function (req, res, next) {
//     home_controller.runInStock(req, res, next);
// });
router.post('/app-run', middleware_controller.m_checkLogin, function (req, res, next) {
    home_controller.runUpcoming(req, res, next);
});
router.post('/app-stop', middleware_controller.m_checkLogin, function (req, res, next) {
    home_controller.stopBot(req, res, next);
});

module.exports = router;
