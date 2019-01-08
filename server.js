const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const { spawn } = require('child_process');
const express = require('express');
const passport = require('passport');
const flash = require('connect-flash');
const app = express();

app._render = function(req, res, sections = null)
{
	let buttons = {};
	
	if (req.isAuthenticated())
	{
		buttons.profile = true
	}
	else
	{
		buttons.join = true
	}
	
	res.render('layout', {
		baseurl: req.protocol + '://' + req.headers.host + '/',
		sections: sections,
		buttons: buttons
	});
};

app._spawn = function(str)
{
	let parts = str.split(" ");
	
	let command = parts[0];
	let params = parts.slice(1);
	
	return spawn(command, params);
};

global.app = app;
global.passport = passport;

const mongoose = require('mongoose');
const mustache = require('mustache-express');

const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const morgan = require('morgan');

let configDB = require('./config/database.js');
require('./config/passport')(passport);

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let connectWithRetry = function()
{
	return mongoose.connect(configDB.url,
	{
		useNewUrlParser: true,
		connectTimeoutMS: configDB.timeout
	},
	function(error)
	{
		if(error)
		{
			console.error('Failed to connect to mongo on startup, retrying in 1 sec.');
			setTimeout(connectWithRetry, configDB.timeout);
		}
	});
};

connectWithRetry();

mongoose.Promise = global.Promise;

app.engine('mustache', mustache());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.use(express.static('public'));

app.use(session(
{
	secret: 'f6350b4df1fc48c6caee4883f52ef201',
	resave: true,
	saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use('/user', require('./app/routes/user'));
app.use('/videos', require('./app/routes/video'));

app.get('/', function(req, res)
{
	res.redirect('/videos');
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);