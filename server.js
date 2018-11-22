const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

let express = require('express');
let app = express();

let mustache = require('mustache-express');

app.engine('mustache', mustache());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.use(express.static('public'));

app.get('/', function (req, res)
{
	res.render('index', {
		title: 'Hello World!'
	});
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);