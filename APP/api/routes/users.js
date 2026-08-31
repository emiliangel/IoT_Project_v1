const express = require("express");
const router = express.Router(); //ver que es esto
const jwt = require('jsonwebtoken'); //ver para que?
const bcrypt = require('bcrypt');
const {checkAuth} = require('../middlewares/authentication.js')
const EmqxAuthRule = require ('../models/emqx_auth')



//models import
const User = require('../models/user.js')


//login
router.post("/login", async (req, res)=>{
    const email = req.body.email;
    const password = req.body.password;

    var user = await User.findOne ({email:email});

    if(!user){
        const toSend = {
            status: "error",
            error: "error en las credenciales"
        }
        return res.status(401).json(toSend);
    }

    if ((bcrypt.compareSync(password, user.password))){  
    
        user.set('password', undefined, {strict: false}); //ver esto

        const token = jwt.sign({userData:user}, 'securePassword', {expiresIn: 60*60});
        const toSend = {
            status: "success",
            token:token, 
            userData:user   //se pone aqui porque a lo mejor esta data sea usada en el front
           
        }
        return res.status(200).json(toSend);

    }else{
        const toSend = {
            status: "error en pswd o email",
            error: "Invalid credentials"
        }
        return res.status(401).json(toSend);
    }

})
//register
router.post("/register", async (req,res)=>{

    try {
        
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    
    const encryptedPassword = bcrypt.hashSync(password, 10);

    const newUser = {
        name: name,
        email: email,
        password: encryptedPassword,

    }

    const user = await User.create(newUser)

    console.log(user)

    const toSend = {
        status: "success",
    }
    res.json(toSend);

    }catch (error) {
        console.log("ERROR - POST register endpoint")
        console.log(error); 
        const toSend = {
            status: "error",
            error:error,
        }
        res.status(500).json(toSend);
    }
 
})

//Get MQTT WEB CREDENTIALS FROM DB
router.post("/getmqttcredentials", checkAuth, async (req, res)=>{
    try {
        const userId = req.userData._id; //Here, userId is extracted from token
        const credentials = await getWebUserMqttCredentials(userId);

        const toSend = {
            status: "success",
            username: credentials.username,
            password: credentials.password
        }

        res.json(toSend);
        setTimeout (()=>{
            getWebUserMqttCredentials(userId);
        }, 5000);

    }catch (error){
        console.log(error);
        const toSend = {
            status: "error"
        };
        return res.status(500).json(toSend);
    }
});

//Get MQTT CREDENTIALS FOR RECONECTION
router.post("/getmqttcredentialsforreconnection", checkAuth, async (req, res)=>{
    const userId = req.userData._id;
    const credentials = await getWebUserMqttCredentialsForReconnection(userId); //This function gets the new credential updated when logging

    const toSend = {
        status: "success",
        username: credentials.username,
        password: credentials.password
    }

    console.log(toSend);
    res.json(toSend)

    setTimeout(()=>{
        getWebUserMqttCredentials (userId);
    }, 15000);



})


// Mqtt credential types: "user", "device", "superuser"
async function getWebUserMqttCredentials (userId) {

    try {
        var rule = await EmqxAuthRule.find({type: "user", userId: userId});
        // If does not exist
        if (rule.length == 0){
            const newRule = {
                userId: userId,
                username: makeid(10),
                password: makeid (10),
                publish: [userId + "/#"],
                subscribe: [userId + "/#"],
                type: "user",
                time: Date.now(),
                updateTime: Date.now ()
            }
        
            //Its created in DB
            const result = await EmqxAuthRule.create(newRule);

            const toReturn = {
                username: result.username,
                password: result.password
            }

            return toReturn;
        }

        const newUserName = makeid (10);
        const newPassword = makeid (10);
        // The user and password are updated in DB
        const result = await EmqxAuthRule.updateOne({type: "user", userId: userId}, {$set: {username: newUserName, password: newPassword, updateTime: Date.now()}});
        // update response example
        // {n:1, nModified:1, ok:1} // This is the result value by update method 

        if(result.n == 1 && result.ok == 1){
            return {
                username: newUserName,
                password: newPassword
            }
        }else{
            return false;
        }
    }catch (error){
        console.log(error);
        return false;

    }
    

}
async function getWebUserMqttCredentialsForReconnection(userId){
    try {
        const rule = await EmqxAuthRule.find({type: "user", userId: userId});
        if (rule.length == 1){
            const toReturn = {
                username: rule[0].username,
                password: rule[0].password
            }
            return toReturn;
        }
    }catch(error){
        console.log(error)
        return false;
    }
}

function makeid(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

module.exports = router;

