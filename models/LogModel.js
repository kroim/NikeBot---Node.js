let mongoose     = require('mongoose');
let Schema       = mongoose.Schema;

let LogSchema   = new Schema({
    id: String,
    user_id: String,
    type: String,
    text: String,
    created_at: Date,
});
// event
LogSchema.pre('save', function (next) {
    this.id = this._id.toString();
    this.created_at = new Date();
    next();
});

module.exports.Log = mongoose.model('logs', LogSchema);
