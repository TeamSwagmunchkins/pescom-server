var mongoose=require('mongoose');
var MessageSentSchema= new Schema({
	
	to_phone_no: Number,
	from_phone_no: Number,
	message: String,
	time_sent: { type: Date, default: Date.now },
	time_recieved: { type: Date, default: Date.now }
	});
var MessageSent = mongoose.model('MessageSent',MessageSentSchema);
module.exports= MessageSent;


