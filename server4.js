//dependencies
//body-parser : 1.14.2
//express     : 4.13.4
//json-socket : 0.1.2
//jsonwebtoken: 5.5.4
//htmlparser  : 1.7.7
//net         : 1.0.2
//mongoose    : 4.3.6
//python-shell : 0.3.0
//util        : 0.10.3
//morgan      : 1.6.1

var express     = require('express');
var app         = express();
var net         = require('net');
var JsonSocket  = require('json-socket');
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User   = require('./models/user'); // get our mongoose model
var OTP1    = require('./models/otp'); // get our mongoose model
var MsgPending = require('./models/MsgPending') //get MsgPending mongoose module
var MsgSnt = require('./models/MsgSnt') //get MsgSnt mongoose module
var PythonShell = require('python-shell');

var OTP_TIME_OUT = 300000; //Time in milliseconds

// =======================
// configuration =========
// =======================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

// =======================
// routes ================
// =======================

function validateUserName(uName){
  return true;
}

//for registration of user
var setupRoute = express.Router();

setupRoute.use(function(req,res,next){
		if(!validateUserName(req.body.phone_number)){
			res.json({success: false,message: 'Setup Failed. Enter Valid Username'});
		}
		else{
			next();
		}
});

setupRoute.post('/login', function(req, res) {
							//registers new user with his/her phone_number and sends the otp to the phone_number
							
						User.findOne({phone_number:req.body.phone_number},function(err,user){
							if(!user){
								user = new User({
									phone_number: req.body.phone_number
								});
							}
							var options = {
								args: [req.body.phone_number]
							};
							PythonShell.run('./something.py',options, function (err, results) {
								if (err){
										console.log(err);
										res.status(500).send("Internal Server Error");
									} 
								OTP1.findOne({phone_number:req.body.phone_number},function(err,otp3){
									if(!otp3){
										console.log('results: %j', results);
										var otp1 = new OTP1({
											phone_number: req.body.phone_number,
											otp: results,
											time:Date.now()
										});
										console.log(otp1.otp);
										otp1.save(function(err){
												if(err){
													console.log(err);
													res.status(500).send("Internal Server Error");
												} 
												console.log("otp saved");
										});
									}
									else{
										console.log('results: %j', results);
										otp3['otp']=results;
										otp3['time']=Date.now();
										console.log(otp3.otp);
										otp3.save(function(err){
											if(err){
													console.log(err);
													res.status(500).send("Internal Server Error");
												} 
											console.log("otp saved");
										});
									}
								});
							});
						// save the user
						user.save(function(err) {
							if (err){
								console.log(err);
								res.status(500).send("Internal Server Error");
							} 
							console.log('User saved successfully');
							res.status(200).send("OK");
						});
							});
});


app.use('/',setupRoute);
// API ROUTES -------------------
var apiRoutes = express.Router(); 

// route to authenticate a user
apiRoutes.post('/authenticate', function(req, res) {
					// authenticates the users by verifying the otp sent returns a token back to the user.
					User.findOne({
							phone_number: req.body.phone_number
						}, function(err, user) {
								if (err){
									console.log(err);
									res.status(500).send("Internal Server Error");
								}
								if (!user) {
									res.status(401).send("Unauthorized");
								}
								else if (user) {
									// check if OTP matches
									OTP1.findOne({phone_number:req.body.phone_number},function(err,fetchedOtp){
											var curDate = new Date();
											if(err) {
												console.log(err);
												res.status(500).send("Internal Server Error");
											}											
											if(!fetchedOtp){
												res.status(401).send("Unauthorized");
											}
											else if(curDate - fetchedOtp.time > OTP_TIME_OUT){
												res.status(410).send("OTP Expired");
											}
											else if(req.body.otp == fetchedOtp.otp.split("\r")[0])
											{
												var token = jwt.sign(user, app.get('superSecret'), {
													expiresInMinutes: 14400000 // expires in 24 hours
												});
												res.json({
													user: req.body.phone_number,
													token: token
												});
											}
											else{
												res.status(406).send("OTP incorrect");
											}
									});
								}
							});
});


apiRoutes.use(function(req, res, next) {
				// check header or url parameters or post parameters for token
				var token = req.body.token || req.query.token || req.headers['x-access-token'];
				// decode token
				if (token) {
					// verifies secret and checks exp
					jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
						if (err) {
							return res.json({ success: false, message: 'Failed to authenticate token.' });    
						}
						else {
							// if everything is good, save to request for use in other routes
							req.decoded = decoded;    
							next();
						}
					});

				}
				else {
					// if there is no token
					// return an error
					return res.status(403).send({ 
						success: false, 
						message: 'No token provided.' 
					});
					
				}
});

//pinging to update IP of a client
apiRoutes.post('/update_ip', function(req, res) {
					//find the phone_number of the client in the database 
					//and update its ip_address field to the new ip_address provided by the client and mark him as active.
					User.findOne({
									phone_number: req.body.phone_number
								},
						function(err, user) {
							if (err){
								console.log(err);
								res.status(500).send("Internal Server Error");
							}
							if (!user) {
								res.status(401).send("Unauthorized");
							}
							else{
								user["ip_address"] = req.body.ip_address;
								user["port"] = req.body.port;
								user["active"] = true;
								user["last_updated_time"] = Date.now();
								user.save(function(err){
											if(err) {
												console.log(err);
												res.status(500).send("Internal Server Error");
											}
											console.log("IP Updated");
										});
								MsgPending.find({to_phone_number:req.body.phone_number},function(err,msgs){
											if(err){
												console.log(err);
											}
											res.json({message:"IP Updated successfully",pendingMsgCount:msgs.length});
								});
								
							}
						});
});

//route used to call a phone_number
apiRoutes.post('/call', function(req, res) {
						//Search the database to find the existence of callee(to_phone_number)
						//if exists, check if he is active,
						//if active, then send the ip_address of the callee(to_phone_number) to caller (from_phone_number).
						//else, Handle the error such as.
						//callee busy, Invalid callee (to_phone_number), callee not reachable
						User.findOne({
									phone_number: req.body.from_phone_number
									},function(err, caller) {
										if (err){
											console.log(err);
											res.status(500).send("Internal Server Error");
										}
										if (!caller) {
											res.status(401).send('Unauthorized');
										}
										else{
											User.findOne({
													phone_number: req.body.to_phone_number
												},function(err, callee) {
													if (err) {
														console.log(err);
														res.status(500).send("Internal Server Error");
													} 
													if (!callee) {
														res.status(404).send('Not Found');
													}
													else{
														port1 = callee.port;
														host = callee.ip_address;
														var s = new net.Socket();
														s.setTimeout(5000);
														s.on('timeout',function(){
															s.destroy();
															res.status(404).send("User not Reachable");
															console.log(" in socket timeout");
														});
														var socket = new JsonSocket(s);
														if(port1&&host){
																//s.setTimeout(5000);
																socket.connect(port1,host);
																if(true){
																	socket.on('connect',function(err){
																		socket.sendMessage("1:" + caller.phone_number +"#!");
																		socket.on('data',function(message){
																			console.log(message.toString("utf8"));
																			m = message.toString("utf8").slice(0,-2).split(":");
																			console.log(m);
																			if(m[0]=="0") {
																				res.status(403).send("Client BUSY");
																			}
																			else{
																				res.json({ip_address: callee.ip_address,port:m[1]});
																			}
																			//s.end();
																		});
																	});
																	socket.on("error",function(err){
																			console.log(err);
																			if(err.errno=='ECONNRESET'){
																				return;
																			}
																			callee["active"] = false; 
																			callee.save(function(err){
																				if(err) console.log(err);
																			});
																			//console.log(err);
																			res.status(404).send("User not Reachable");  
																		});
												
																}
																else{
																  res.status(404).send("User not Reachable");
																}  
														}
														else
														{
															 res.status(404).send("User not Reachable");
														}
													
													}
												});
											}
									});
});


apiRoutes.post('/message_send',function(req,res){
																console.log("message_send invoked");
																var fromPhNo=req.body.from_phone_number;
																var toPhNo=req.body.to_phone_number;
																var sendingmsg=req.body.message;
																User.findOne({
																			phone_number: req.body.to_phone_number
																},function(err,receiver){

																			if(err){
																				console.log(err);
																				res.status(404).send('Not Found');
																			}
																			else if(!receiver){
																				console.log(err);
																				res.status(404).send('Not Found');
																			}
																			else{
																				var msg=new MsgPending({
																						to_phone_number:toPhNo,
																						from_phone_number:fromPhNo,
																						message:sendingmsg
																				});
																				msg.save(function(err){
																						if(err)
																						{
																							 console.log(err);
																							 res.status(500).send("Internal Server Error");
																						}
																					});
																					//console.log("error happened in line 299");
																				MsgPending.find({
																						to_phone_number:toPhNo
																				},function(err,msgs){
																						if(err){
																								console.log(err);
																						}
																						else{
																							if(receiver.port&&receiver.ip_address)
																							{
																								var socket = new JsonSocket(new net.Socket());
																								socket.connect(receiver.port,receiver.ip_address);
																								socket.on('connect',function(){
																								socket.sendMessage("3:"+msgs.length+"#!");	
																								});
																								socket.on("error",function(){
																									console.log("socket error");
																								});
																							}
																						}
																					});
																					res.status(200).send('OK');
																				}
																			});
																});

apiRoutes.post('/message_receive',function(req,res){
						MsgPending.find({
							to_phone_number:req.body.to_phone_number
						},function(err,msgs){
									if(err){
										res.status(404).send('Not Found');
									}
									else{
										//res.json({count:msgs.length,messages:msgs});
										for(var i in msgs){
											var sentmsg=new MsgSnt(msgs[i]);
											sentmsg.save(function(err){
												if(err) console.log(err);
											});
											MsgPending.remove(msgs[i],function(err){
													if(err){
														console.log(err);
														//res.status(500).send("Internal Server Error");
													}
												});
										}
										res.json({count:msgs.length,messages:msgs});
									}
						});
});

// route to return all users 
apiRoutes.get('/users', function(req, res) {
		User.find({}, function(err, users) {
			res.json(users);
		});
});   

app.use('/', apiRoutes);


// =======================
// start the server ======
// =======================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);
