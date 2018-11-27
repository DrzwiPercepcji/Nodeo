var express = require('express');
var router = express.Router();
var controller = require('../controllers/video');

var multer  = require('multer');
var upload = multer({ dest: 'uploads/' });

router.get('/test', controller.test);

router.get('/', controller.main);
router.get('/upload', controller.upload);
router.get('/video/:videoId', controller.video);
router.get('/stream/:videoId', controller.stream);

router.post('/upload', upload.single('file'), controller.create);

module.exports = router;