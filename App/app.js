const express = require('express'),
app = express(),
mongoose = require('mongoose'),
bcrypt = require('bcrypt'),
bodyParser = require('body-parser'),
jwt = require('jsonwebtoken'),
cors = require('cors'),
User = require('./models/user.js'),
Bearer = require('./models/issuedToken.js'),
config= require('./config.js'),
authRoutes = require('./routes/authRoutes'),
cookieParser = require('cookie-parser')
//make a database with name credentials
mongoose.connect('mongodb://localhost:27017/ChatCrypt',{
   useNewUrlParser: true,
   useFindAndModify: false,
   useCreateIndex: true,
   useUnifiedTopology: true 
});
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.use(cors())
app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));
app.use(function(req, res, next) {
    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    next();
});
app.use(require('express-session')({
    secret:'PeShVmYq3t6w9z$C&F)J@NcQfTjWnZr4u7x!A%D*G-KaPdSgUkXp2s5v8y/B?E(H', //cookie secret
    name: 'e_session',
    resave:false,
    path: 'session/',
    cookie: {sameSite: true,maxAge: 60000,httpOnly: true}, //max-age is in miliseconds
    saveUninitialized:false,
  }));
app.disable('x-powered-by');

// PROTECTED ROUTES ////////////////////////////////////
app.get('/',validate_token,(req, res)=>{
    // console.log(req.cookies);
    // console.log("Session "+ req.session);
    console.log(req.user_id);
    User.findById(req.user_id,(err, user)=>{
        if(err){
            console.log(err);
        }else{
            //console.log(user.username);
            res.render("dashboard",{user : user.username});
        }
    })
  

});
app.get('/my_inbox', validate_token, (req, res)=>{
    const user_id = req.headers["user_id"]
    User.findById(user_id).select("inbox").exec((err, inbox)=>{
        if(err){
            res.send(err)
        }
        // console.log(inbox)
        res.send(inbox)
    })
})
app.get('/my_outbox', validate_token, (req, res)=>{
    const user_id = req.headers["user_id"]
    User.findById(user_id).select("outbox").exec((err, outbox)=>{
        if(err){
            res.send(err)
        }
        // console.log(inbox)
        res.send(outbox)
    })
})
app.post('/sendMessage', async (req, res)=>{
    const msg = req.body.message
    const from = req.body.from
    const to = req.body.to
    console.log("Message :" + msg);
    console.log("From :" + from);
    console.log("To: " + to);
    const senderObj = await User.findOne({"username":from}).catch(err=>{
        console.log(err)
        res.send(err)
    })
    const receiverObj = await User.findOne({"username":to}).catch(err=>{
        console.log(err)
        res.send(err)
    })
    console.log(receiverObj);
    let received_msg = {"text": msg, "from":senderObj._id}
    let sent_msg = {"text": msg, "to":receiverObj._id}

    console.log(received_msg)

    // update inbox of receiver
    receiverObj.inbox.push(received_msg)
    // update outbox of sender
    senderObj.outbox.push(sent_msg)
    
    await receiverObj.save().catch(err=>{
        console.log(err)
        res.send(err)
    })
    await senderObj.save().catch(err=>{
        console.log(err)
        res.send(err)
    })
    res.send({"msg":req.body.message, "from": req.body.from, "to": req.body.to});
    
})
app.get('/contacts',async (req, res)=>{
    const users = await User.find({}).catch(err=>{
        console.log(err)
        res.send(err)
    })
    console.log(users)
    const contact_names = []
    users.forEach(user=>{
        contact_names.push(user.username)
    })
    console.log(contact_names)
    res.render("contacts.ejs",{names:contact_names})
})
//////////////////////////////////////////////////////////

// REST API for authentication //
app.get('/login', authRoutes)  
app.post('/login', authRoutes)
app.get('/register', authRoutes)
app.post('/register', authRoutes)
app.get('/logout',authRoutes)
////////////////////////////////




app.listen(3000,(req, res)=>{
    console.log("server started at port 3000 --> http://localhost:3000");
});

// for verifying and validating tokens
function validate_token(req, res, next){
    const client_token = req.cookies.jwt;
    // console.log(client_token);
    jwt.verify(client_token, config.jwt_secret, (err, decoded)=>{
        if(err){
            // console.log(err);
            console.log("Token Expired!!");
            res.clearCookie("jwt");
            res.redirect("/login");
        }else{
            // console.log(decoded);
            //{ user : ,iat: , exp: , iss}
            Bearer.find({_id: decoded._id},(err, foundToken)=>{
                if(err){
                    console.log(err);
                }
                    else{
                        if(foundToken.length == 1){
                                req.user_id = foundToken[0].user_id;
                                req.headers["user_id"] = foundToken[0].user_id
                                //append a user object to request header//
                                next();

                        }else{
                            console.log("Token couldn't be found!");

                            res.clearCookie("jwt"); //user not found on the issued token list
                            req.session.status = false;
                            res.redirect('/login');
                        }
                    }
            })
        }
    });
 }