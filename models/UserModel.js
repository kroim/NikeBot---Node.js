let mongoose     = require('mongoose');
let Schema       = mongoose.Schema;
let crypto = require('crypto');

let UserSchema   = new Schema({
    id: String,
    name: String,
    email: String,
    password: String,
    nike_password: String,
    phone: String,
    reset_flag: Number,  // 1: usable token,  2: unusable token
    reset_token: String,
    avatar: String,
    role: Number,  // 1: admin, 2: users
    online_state: Number,  // 1: offline, 2: online
    payment_flag: Number,  // 0: unset payment, 1: set payment
    address_flag: Number,  // 0: unset bill address, 1: set bill address
    cvc: Number,
    created_at: Date,
    updated_at: Date,
});
// event
UserSchema.pre('save', function (next) {
    this.id = this._id.toString();
    next();
});

// Methods
UserSchema.methods.verifyPassword = function (password) {
    return this.password === crypto.createHash('md5').update(password).digest("hex")
};
module.exports.User = mongoose.model('users', UserSchema);
