var express = require('express');
var router = express.Router();
var controller = require('../controllers/user');

router.get('/', controller.main);
router.get('/admin', controller.admin);
router.get('/admin/remove/video/:videoId', controller.removeVideo);
router.get('/admin/remove/user/:userId', controller.removeUser);
router.get('/signup', controller.signup);
router.get('/login', controller.login);
router.get('/logout', controller.logout);

module.exports = router;