var express = require('express');
var router = express.Router();
var controller = require('../controllers/video');

function redirectUserLogin(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/user/login');
}

function redirectUserProfile(req, res, next) {
    if (!req.isAuthenticated())
        return next();

    res.redirect('/user');
}

var multer = require('multer');
var upload = multer({ dest: 'uploads/' });

router.get('/test', controller.test);

router.get('/', controller.main);
router.get('/popular', controller.popular);
router.get('/upload', redirectUserLogin, controller.upload);
router.get('/video/:videoId', controller.video);
router.get('/stream/:videoId', controller.stream);

router.post('/upload', redirectUserLogin, upload.single('file'), controller.create);

module.exports = router;