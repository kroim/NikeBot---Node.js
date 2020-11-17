let mongoose     = require('mongoose');
let Schema       = mongoose.Schema;

let NikeSchema   = new Schema({
    id: String,
    user_id: String,
    payment_flag: Number,  // 0: unset payment, 1: set payment
    address_flag: Number,  // 0: unset bill address, 1: set bill address
    cvc: Number,
    created_at: Date,
    updated_at: Date,
});
// event
NikeSchema.pre('save', function (next) {
    this.id = this._id.toString();
    next();
});

module.exports.User = mongoose.model('nike', NikeSchema);
