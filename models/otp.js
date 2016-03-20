var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model("OTP",new Schema({
	phone_number:String,
	otp:String,
	time:Date
}));