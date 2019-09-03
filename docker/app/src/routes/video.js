var express = require('express');
var router = express.Router();
var controller = require('../controllers/video');

router.get('/', controller.main);
router.get('/popular', controller.popular);
router.get('/upload', controller.upload);
router.get('/video/:videoId', controller.video);
router.get('/stream/:videoId', controller.stream);
router.get('/thumb/:thumbName', controller.thumb);

module.exports = router;