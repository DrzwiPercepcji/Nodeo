const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const express = require('express');
const app = express();

app._render = function (req, res, sections = null) {
    let buttons = {};

    if (false) {
        buttons.profile = true
    }
    else {
        buttons.join = true
    }

    res.render('layout', {
        baseurl: req.protocol + '://' + req.headers.host + '/',
        sections: sections,
        buttons: buttons
    });
};

global.app = app;

const mustache = require('mustache-express');

app.engine('mustache', mustache());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.use(express.static('public'));

app.use('/user', require('./src/routes/user'));
app.use('/videos', require('./src/routes/video'));

app.get('/', function (req, res) {
    res.redirect('/videos');
});

app.get('/admin', function (req, res) {
    res.redirect('/user/admin');
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);