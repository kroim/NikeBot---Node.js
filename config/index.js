let config = {
    port: 3100,
    base_url: 'http://127.0.0.1:3100',
    mongo: {
        host: '127.0.0.1',
        port: 27017,
        db_name: 'nike_bot'
    },
    dev_info: {
        name: 'wonder',
        email: 'johnmax@consultant.com',
        password: '!@#4567Dev'
    }
};

module.exports = function () {
    return config;
};