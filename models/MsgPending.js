var mongoose=require('mongoose');
var Schema = mongoose.Schema;
var MessagePendingSchema = new Schema({
	to_phone_no: Number,
	from_phone_no: Number,
	message :String,
	time_sent : { type: Date, default: Date.now }
	});
var MessagePending=mongoose.model('MessagePending',MessagePendingSchema);
module.exports = MessagePending;



