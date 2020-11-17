let express = require('express');
let flash = require('connect-flash');
let path = require('path');
let session = require('express-session');
let mongoose = require('mongoose');
let cors = require('cors');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let methodOverride = require('method-override');

let app = express();
let config = require('./config')();
let home_route = require('./routes/home_route');
let auth_route = require('./routes/auth_route');
let i18n = require('i18n');
i18n.configure({
    //define how many languages we would support in our application
    locales: ['EN', 'DE'],
    //define the path to language json files, default is /locales
    directory: __dirname + '/locales',
    //define the default language
    defaultLocale: 'EN',
    // define a custom cookie name to parse locale settings from
    cookie: 'i18n'
});
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(cors());
app.use(session({
    secret:"1234567890",
    cookie: {secure: false},
    resave: true,
    saveUninitialized: true
}));
app.use(i18n.init);
app.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit: 1000000}));
app.use(bodyParser.json({limit: '50mb', extended: true}));
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(flash());
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-type,Accept');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
mongoose.connect('mongodb://' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.db_name,
    { useNewUrlParser: true, useUnifiedTopology: true }, async function(err, db) {
    if(err) {
        console.log( '[' + new Date().toLocaleString() + '] ' +'Sorry, there is no mongo db server running.');
    } else {
        let attachDB = function(req, res, next) {
            req.db = db;
            next();
        };
        let BaseController = require('./controllers/BaseController');
        await BaseController.checkDev();

        app.use('/', attachDB, home_route);
        app.use('/', attachDB, auth_route);
        /**
         * Error Routes
         * */
        app.get('*', function (req, res, next) {
            res.render("pages/error", { session: req.session });
        });
        app.get('/404', function (req, res, next) {
            res.render("pages/error", { session: req.session });
        });

        app.listen(config.port, function(){
            console.log( '[' + new Date().toLocaleString() + '] ' +'Server listening ' + config.base_url);
        });
    }
});
