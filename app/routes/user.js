var express = require('express');
var router = express.Router();
var controller = require('../controllers/user');

function redirectUserLogin(req, res, next)
{
	if (req.isAuthenticated())
		return next();
	
	res.redirect('/user/login');
}

function redirectUserProfile(req, res, next)
{
	if (!req.isAuthenticated())
		return next();
	
	res.redirect('/user');
}

router.get('/', redirectUserLogin, controller.main);
router.get('/signup', redirectUserProfile, controller.signup);
router.get('/login', redirectUserProfile, controller.login);
router.get('/logout', redirectUserLogin, controller.logout);

router.post('/signup', passport.authenticate('local-signup', {
	successRedirect : '/user',
	failureRedirect : '/user/signup',
	failureFlash : true
}));

router.post('/login', passport.authenticate('local-login', {
	successRedirect : '/user',
	failureRedirect : '/user/login',
	failureFlash : true
}));

module.exports = router;