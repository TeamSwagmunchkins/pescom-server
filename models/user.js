var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('User', new Schema({ 
    phone_number:{type:String,default:""}, 
    ip_address: {type:String,default:""},
    port: {type:String,default:""},
    active: {type:Boolean,default:true},
    latest_updated_time: {type:Date,default:Date.now}
}));
