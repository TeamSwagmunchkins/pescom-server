var express     = require('express');
var app         = express();
var net         = require('net');
var JsonSocket  = require('json-socket');
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var password = require('password-hash-and-salt');
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User   = require('./models/user'); // get our mongoose model
var OTP1    = require('./models/otp');
var PythonShell = require('python-shell');
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
  else
  {
    next();
  }
});

setupRoute.post('/signup', function(req, res) {

                          var user = new User({ 
                              phone_number: req.body.phone_number  
                            });
                          var options = {
                                args: [req.body.phone_number]
                              };    
                          PythonShell.run('./something.py',options, function (err, results) {
                                if (err) throw err;
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
                                          if(err) throw err;
                                          console.log("otp saved");
                                        });
                                      }
                                      else{
                                        console.log('results: %j', results);
                                        otp3['otp']=results;
                                        otp3['time']=Date.now();
                                        console.log(otp3.otp);
                                        otp3.save(function(err){
                                          if(err) throw err;
                                          console.log("otp saved");
                                        });
                                      }
                                });     
                          });
                        // save the user
                        user.save(function(err) {
                          if (err) throw err;
                          console.log('User saved successfully');
                          res.json({ success: true });
                        });
});


app.use('/',setupRoute);
// API ROUTES -------------------
var apiRoutes = express.Router(); 

// route to authenticate a user
apiRoutes.post('/authenticate', function(req, res) { 

  // find the user
   User.findOne({
                phone_number: req.body.phone_number
                }, function(err, user) {

                    if (err) throw err;

                    if (!user) {
                        res.json({ success: false, message: 'Authentication failed. User not found.' });
                    } else if (user) {

                      // check if OTP matches
                      OTP1.findOne({phone_number:req.body.phone_number},function(err,otp2){
                        var x = new Date();
                        if(err) throw err;
                        
                        if(!otp2){
                          res.json({success:false,message:"You are not Authenticated"});
                        }
                        else if(x - otp2.time > 300000)
                        {
                          res.json({success:false,message:'OTP Expired'});
                        }

                        else if(req.body.otp == otp2.otp)
                        {
                          var token = jwt.sign(user, app.get('superSecret'), {
                                          expiresInMinutes: 1440 // expires in 24 hours
                                        });
                                      res.json({
                                        success: true,
                                        message: 'Enjoy your token!',
                                        user: req.body.phone_number,
                                        token: token
                                      });
                        }

                        else{
                          res.json({success:false, message:"otp not matching"});
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
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;    
        next();
      }
    });

  } else {

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
              //and update its ip_address field to the new ip_address provided by the client.
              User.findOne({
                phone_number: req.body.phone_number
                }, function(err, user) {

                    if (err) throw err;

                    if (!user) {
                        res.json({ success: false, message: 'Invalid User.' });
                    }
                    else
                    {
                      user["ip_address"] = req.body.ip_address;
                      user["port"] = req.body.port;
                      user["active"] = true;
                      user["last_updated_time"] = Date.now();
                      user.save(function(err){
                                  if(err) throw err;
                                  console.log("IP Updated");
                                })
                      res.json({success:true,message:"IP Updated successfully"});
                    }
                  });

});
//route used to call a phone_number
apiRoutes.post('/call', function(req, res) {
    //Search the database to find the existance of to_phone_number
    //if exists, check if he is active,
    //if active, then send the ip_address of the to_phone_number to from_phone_number.
    //else, Error handling cases.
    User.findOne({
                phone_number: req.body.from_phone_number
                }, function(err, user) {

                    if (err) throw err;

                    if (!user) {
                        res.status(401).send('Unauthorized');
                    }   
                    else{
                       User.findOne({
                          phone_number: req.body.to_phone_number
                          }, function(err, user1) {

                                  if (err) throw err;

                                  if (!user1) {
                                      res.status(404).send('Not Found');
                                  }
                                  else
                                  {
                                      port1 = user1.port;
                                      host = user1.ip_address;
                                      var socket = new JsonSocket(new net.Socket());
                                      socket.connect(port1,host);
                
                                      if(user1["active"])
                                      {
                                          socket.on('connect',function(){
                                    
                                          socket.sendMessage("TYPE_INCOMING_CALL:" + user.phone_number +"#!");
                                          socket.on('data',function(message){
                                            //res.json({a:message});
                                            console.log(message.toString("utf8"));
                                            m = message.toString("utf8").split(":");
                                            if(m[0]=="0")
                                            {
                                              res.json({success:false,message:"Client Busy"});
                                            }
                                            else
                                            {
                                              res.json({success:true,ip_address: user1.ip_address,port:m[1]});
                                            }
                                          });
                                        });
                                        socket.on("error",function(){
                                          user1["active"] = false; 
                                          user1.save(function(err){
                                                if(err) throw err;
                                              });
                                          res.json({success:false,message:"User not Reachable"});  
                                        });
                                    }
                                    else
                                    {
                                       res.json({success:false,message:"User not Reachable"});
                                    }  
                                }
                            });
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