const express = require('express')
const router = express.Router();

const Data = require('../models/data.js');
const Device = require('../models/device.js')
const Notification = require('../models/notifications.js')
const alarmRule = require('../models/emqx_alarm_rule.js')
const EmqxAuthRule = require('../models/emqx_auth.js');
const Template = require ('../models/template.js')

const {checkAuth} = require ('../middlewares/authentication.js')



var mqtt = require ('mqtt')
var client


// Esto es el endpoint para probar el recurso y la regla, bajo el setup que se hizo, 
// on emqx broker it sets: http://host.docker.internal:3001 for pointing as a client on front,
//  and since here it point to /saver-webhook, e.g /api/saver-webhook
// this endpoint saves the rule content on data
router.post('/saver-webhook', async (req, res) =>{
    if (req.headers.token != process.env.EMQX_API_TOKEN){
        res.sendStatus(404); // Para indicar que el endpoint no existe
        return;
    }

    const data = req.body;

    
    const splittedTopic = data.topic.split("/");
    const dId = splittedTopic[1];
    const variable = splittedTopic[2];
    var result = await Device.find({dId: dId, userId: data.userId});
    if (result.length == 1) {
        Data.create ({
            userId: data.userId,
            dId: dId,
            variable: variable,
            value: data.payload,
            time: Date.now ()
        })
        console.log("Date created")
    }

    res.sendStatus(200);
    console.log(data);

    //res.json("{}");
    
});

//DEVICE CREDENTIALS WEBHOOK
router.post ("/getdevicescredentials", async (req,res)=>{

    try{
        console.log(req.body)

        const dId = req.body.dId;

        const password = req.body.password;

        const device = await Device.findOne ({dId: dId});

        // Guard: device may not exist
        if (!device) {
            console.log("Device not found for dId", dId);
            return res.status(404).json({ status: 'error', message: 'Device not found' });
        }

        // Guard: missing password or mismatch
        if (!device.password || password != device.password) {
            console.log('Invalid password for device', dId);
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userId = device.userId;

        var credentials = await getDeviceMqttCredentials(dId, userId);

        var template = await Template.findOne ({_id: device.templateId});

        console.log(template);
        
        var variables = []
        //This takes this properties from widget and build a new object with tis properties, which is stored in var v
        template.widgets.forEach(widget => { 
            var v = (({variable,variableFullName,variableType,variableSendFreq}) => ({
                variable,
                variableFullName,
                variableType, variableSendFreq
            }))(widget);
            
            variables.push(v)
        });
        
        console.log("credenciales_usernaeme" + credentials.username)
        const toSend = {
            username: credentials.username,
            password: credentials.password,
            topic: userId + "/" + dId + "/",
            variables: variables
        };
        console.log(toSend)

        res.json(toSend)

        setTimeout(()=>{
            getDeviceMqttCredentials(dId, userId);
            console.log("Devices credentials updated")
        }, 15000);

    }catch(error){
        console.log("Error getting devices credential", error)
    }

    

});



//Save Notify to Mongo and send message to EMQX (publish message), 
// this catches only alarm webhooks (alarm rules not saver rules)
router.post('/alarm-webhook', async (req, res) =>{

    try {
       if (req.headers.token != process.env.EMQX_API_TOKEN){
        res.sendStatus(404); // Para indicar que el endpoint ni existe
        return;
    }
        res.sendStatus(200);

        const incomingAlarm = req.body;

        updateAlarmCounter(incomingAlarm.emqxRuleId)

        const lastNotif = await Notification.find({dId: incomingAlarm.dId, emqxRuleId: incomingAlarm.emqxRuleId}).sort({time: -1}).limit(1); //Sort in descending orden and get the last Notif
        
        if (lastNotif == 0){
            console.log("First time alarm")
            saveNotifyToMongo(incomingAlarm)
            sendMqttNotif(incomingAlarm)


        }else{
            const lastNotifToNowmins = ((Date.now() - lastNotif[0].time) / 1000 / 60)
            if (lastNotifToNowmins > incomingAlarm.triggerTime){
                saveNotifyToMongo(incomingAlarm);
                console.log("TRIGGERED NOTIFICATION")
                sendMqttNotif(incomingAlarm)

            }
        }
        //console.log(incomingAlarm);
        //res.sendStatus(200); This response was set above, because by this way emqx get faster status 200 answer, regardless the rest of process on post

    }catch (error){
        console.log(error);
        res.sendStatus(200);
    }   
});

//Get All not readed notifications
router.get("/notifications", checkAuth, async(req, res) => {
    try {
        const userId = req.userData._id;
        console.log("en notifications",userId);

        const notifications = await getNotifications(userId);
        const toSend = {
            status: "success",
            data: notifications
        };
        res.json(toSend)

    }catch (error){
        console.log("ERROR GETTING NOTIFICATIONS")
        console.log(error)
        const toSend = {
            status: "error",
            error: error
        }
        return res.status(500).json(toSend)
    }
});

//Update Notifications (readed status)
router.put("/notifications", checkAuth, async (req,res)=>{
    try{
        const userId = req.userData._id;
        const notificationId = req.body.notifId;
        await Notification.updateOne({userId: userId, _id: notificationId}, {readed: true});

        const toSend = {
            status: "success",
        };
        res.json(toSend);
    }catch (error) {
        console.log("ERROR UPDATING NOTIF STATUS");
        console.log(error)

        const toSend = {
            status: "error",
            error: error
        };

        return res.status(500).json(toSend);
    }
});



/*FUNCTIONS*/
//Read all not readed notifications
async function getNotifications (userId) {
    try {
        const res = await Notification.find ({userId: userId, readed: false});
        console.log("res de notifi", res)
        return res;
    } catch (error) {
        console.log(error);
        return false;

    }
}
//Update Notification (readed status)

// FUNCTION TO CONNECT VIA TCP (MQTT) TO BROKER FROM BACKEND
function startMqttClient() {
    const options = {
        port: 1883,
        host: process.env.EMQX_NODE_HOST,
        clientId: 'webhook_superuser' + Math.round(Math.random() * (0 - 10000) * -1),
        username: process.env.EMQX_NODE_SUPERUSER_USER,
        password: process.env.EMQX_NODE_SUPERUSER_PASSWORD,
        keepalive: 60,
        reconnectPeriod: 5000,
        protocolId: 'MQIsdp',
        protocolVersion: 3,
        clean: true,
        encoding: 'utf8'
    }
    client = mqtt.connect ('mqtt://' + process.env.EMQX_NODE_HOST, options);

    client.on('connect', function () {
        console.log("MQTT CONNECTION -> success")
        console.log("\n")

    });

    client.on('reconnect',  (error) => {
        console.log("RECONNECTING MQTT")
        console.log(error)

    });

    client.on('error', (error) => {
        console.log("MQTT CONNECTION FAIL")
        console.log(error)

    });
    
}

function sendMqttNotif(notif){
    const topic = notif.userId + '/dummy-did/dummy-var/notif';
    const msg = 'The rule: when the' + notif.variableFullName + ' is ' + notif.condition + 'than' + notif.value;
    client.publish(topic, msg)
    console.log("Notificacion de mqtt en webhook")

}

function saveNotifyToMongo(incomingAlarm) {
    var newNotif = incomingAlarm;
    newNotif.time = Date.now();
    newNotif.readed = false;
    Notification.create(newNotif);
}

async function updateAlarmCounter(emqxRuleId) {
    try {
        await alarmRule.updateOne({emqxRuleId: emqxRuleId}, {$inc: {counter: 1 }}); //Corrected to Update One
    }catch (error){
        console.log(error)
    }
}

//Get Device Credentials

async function getDeviceMqttCredentials  (dId, userId) {
   try {
        var rule = await EmqxAuthRule.find({
            type: "device",
            userId: userId,
            dId: dId
        });

        console.log("Rule found for device", rule)
        if (rule.length == 0){
            const newRule = {
                userId: userId,
                dId: dId,
                username: makeid(10),
                password: makeid(10),
                publish: [userId + "/" + dId + "/+/sdata"],
                subscribe: [userId + "/" + dId + "/+/actdata"], //This is data sent from widgets to Device
                type: "device",
                time: Date.now(),
                updatedTime: Date.now ()

            }
            const result = await EmqxAuthRule.create(newRule);

            const toReturn = {
                username: result.username,
                password: result.password
            };

            return toReturn;
        }

        const newUserName = makeid(10);
        const newPassword = makeid(10);

        console.log("username", newUserName + "password" + newPassword)
        
        const result = await EmqxAuthRule.updateOne (
            {type: "device", dId: dId},
            {$set:{
                username: newUserName,
                password: newPassword,
                updatedTime: Date.now()
            }}
        );

        if (result.n == 1 && result.ok == 1) {
            return {
                username: newUserName,
                password: newPassword
            };
        }else{
            return false;
        }

    } catch (error){
        console.log(error);
        return false;
   }
}

function makeid(length){
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result; 
}


setTimeout(()=>{
    startMqttClient();
},3000)


module.exports = router