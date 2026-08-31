const express = require ("express");
const router = express.Router(); //ver que es esto
const {checkAuth} = require('../middlewares/authentication.js')
const axios = require("axios")
const colors = require ("colors")

const SaverRule = require ('../models/emqx_saver_rule')
const Template = require ('../models/template')
const alarmRule = require ('../models/emqx_alarm_rule')



/*
MODELS
*/
const Device = require ('../models/device')
/*
API
*/

const auth = {
    auth: {
        username: 'admin',
        password: process.env.EMQX_DEFAULT_APPLICATION_SECRET
    }
};

// Get Device
router.get("/device", checkAuth, async (req, res) =>{

    try {
    const userId = req.userData._id

    //get devices
    var devices = await Device.find ({userId: userId});
    devices = JSON.parse(JSON.stringify(devices)); // ver bien esto
    
    //get saver rules
    const saverRules = await getSaverRules(userId)
    //get templates
    const templates = await getTemplates(userId)
    //get AlarmRules
    const alarmRules = await getAlarmRules(userId)

    devices.forEach((device, index) => {
        devices[index].saverRule = saverRules.filter(saverRule => saverRule.dId == device.dId)[0];
        devices[index].template = templates.filter(template => template._id == device.templateId)[0];
        devices[index].alarmRules = alarmRules.filter(alarmRule => alarmRule.dId == device.dId);

    });
    
    var response = {
        status: "success",
        data: devices
    }
    res.json(response)
    //console.log(toReturn.data);
    } catch (error) {
         console.log("ERROR GETTING DEVICES")
         const response = {
            status: "error",
            error:error
        }
    }
    
});

//New Device

router.post("/device", checkAuth, async (req, res)=> {

    try{
        const userId= req.userData._id; //Este es el token de JWT que se envío en el header de la solicitud
        var newDevice = req.body.newDevice; // Cuerpo de peticion

        console.log(newDevice);
        newDevice.userId = userId;
        newDevice.createdTime = Date.now ();
        newDevice.password= makeid(10)

        // Se crea la regla, luego de crear el objeto

        //Se coloca await para esperar por el resultado y no solo por la promesa
        await createSaverRule(userId, newDevice.dId, true);
        //Se crea el device, luega de crear la regla, para evitar errores, en caso de que se cree el device y no la regla
        const device = await Device.create(newDevice);

        await selectDevice(userId, newDevice.dId);

        const response = {
            status: "success"
        }
        return res.json(response)

    }catch (error){
        console.log("ERROR CREATING NEW DEVICE")
        console.log(error);

         const response = {
            status: "Error al registrar device",
            error:error
        }
        return res.status(500).json(response)
    }
   

})

//Delete Device

router.delete("/device", checkAuth, async (req, res) => {
    try{
        const userId = req.userData._id;
        const dId = req.query.dId;

        //deleting saver rule
        await deleteSaverRule(dId);

        //deleting all possible alarm rules
        await deleteAllAlarmRules(userId, dId);

        //deleting all possible mqtt device credentials
        await deleteMqttDeviceCredentials(dId);

        //deleting device
        const result = await Device.deleteOne ({userId: userId, dId: dId});

        //devices after deletion
        const devices = await Device.find ({userId: userId});

        if (devices.length >= 1){
            // Is there any device selected?
            var found = false;
            devices.forEach(device => {
                if (device.selected == true){
                    found = true;
                }
            });

            // If there is not any device selected, select the first one
            if (!found){
                await Device.updateMany({userId: userId}, {selected: false});
                await Device.updateOne({userId: userId, dId: devices[0].dId}, {selected: true});
            }
        }


        const response = {
            status: "success",
            data: result
        }
        return res.json(response)

    } catch (error){
        console.log("ERROR DELETING DEVICE")
        console.log(error);

         const response = {
            status: "Error al BORRAR device",
            error:error
        }
        return res.status(500).json(response)
    }

})

// Update device

router.put ("/device", checkAuth, async (req, res)  => {
    const dId = req.body.dId;
    const userId = req.userData._id;

    if (await selectDevice(userId, dId)){  //If this await response reach relatively slow, it could not be necessary. But Its better to set it waiting a value as such and not a promise
        const response = {
            status: "success"
        };
        return res.json(response)
    }else{
        const response = {
            status: "error"
        };
        return res.json(response)
    }

})

// Update saver-rule
router.put("/saver-rule", checkAuth, async (req, res) => {
    const rule = req.body.rule;
    // Actualizar status de la regla
    await updateSaverRuleStatus (rule.emqxRuleId, rule.status)
    const response = {
        status: "success"
    };

    res.json(response);
});


/*
FUNCTIONS
*/
async function selectDevice (userId, dId) {
    try {
    const result = await Device.updateMany ({userId: userId}, {selected: false})
    const result2 = await Device.updateOne ({dId : dId, userId: userId}, {selected: true})
    
    return true

    }catch (error){
        console.log ("Error in 'selected device' Function")
        console.log(error)
        return false
    }
}
/* TEMPLATE FUNCTIONS */
/* Get Templates*/
async function getTemplates(userId) {
    try {
        const templates = await Template.find({ userId: userId})
        return templates;
    } catch(error) {
        return false;
    }
}

/* RULE FUNCTIONS*/

/* Get Alarm Rules*/

async function getAlarmRules(userId) {
    try {
        const alarmRules = await alarmRule.find({ userId: userId})
        return alarmRules;
    } catch(error) {
        return "error";
    }
}

/* Delete Alarm Rules*/
async function deleteAllAlarmRules(userId, dId) {
  try {
    const rules = await alarmRule.find({ userId: userId, dId: dId });

    if (rules.length > 0) {
      asyncForEach(rules, async rule => {
        const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules/" + rule.emqxRuleId;
        const res = await axios.delete(url, auth);
      });

      await alarmRule.deleteMany({ userId: userId, dId: dId });
    }

    return true;
  } catch (error) {
    console.log(error);
    return "error";
  }
}

/* Create Rule*/
async function createSaverRule (userId, dId, status) {
    try {
        const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules";

        const topic = userId + "/" + dId + "/+/sdata";  //el +/sdata es para “Todos los mensajes que terminen en /sdata con un nivel antes”.

        const rawsql = "SELECT topic, payload FROM \"" + topic + "\" WHERE payload.save = 1";

        var newRule = {
            rawsql: rawsql,
            actions: [
                {
                    name: "data_to_webserver",
                    params: {
                        headers: {
                            "Content-Type": "application/json",
                            "token": process.env.EMQX_API_TOKEN
                        },
                        path: "api/saver-webhook",
                        body: '{"userId":"' + userId + '","payload": ${payload}, "topic":"${topic}"}',
                        $resource: global.saverResource.id,
                        //payload_tmpl: '{"userId":"' + userId + '","payload": ${payload}, "topic":"${topic}"}'
                    }
                }
            ],
            description: "SAVER-RULE",
            enabled: status        
        };

        //save rule in emqx 
        const res = await axios.post(url,newRule, auth);
        if (res.status === 200 && res.data.data) {
            console.log(res.data.data);
            //Se graba regla en mongo
            await SaverRule.create ({
                userId: userId,
                dId: dId,
                emqxRuleId: res.data.data.id,
                status: status

            });
            return true
        } else {
            return false
        }
    }catch (error){
        console.log("error")
    }   
}

/* Get Rule */
async function getSaverRules(userId) {
    try {
        const rules = await SaverRule.find({ userId: userId})
        return rules;
    } catch(error) {
        return false;
    }
}


/* Update rule*/

async function updateSaverRuleStatus (emqxRuleId, status) {
    const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules/" + emqxRuleId;
    
    const newRule = {
        enabled: status
    }

    const res = await axios.put(url, newRule, auth);

    if (res.status === 200 && res.data.data) {
        //Actualiza en Mongo
        await SaverRule.updateOne({emqxRuleId: emqxRuleId}, {status: status})
        console.log("Saver Rule Status Updated...". green);

        return {
            status: "success",
            action: "updated"
        }
    }
}

/* Delete Rule*/
//AQUI

async function deleteSaverRule(dId) {
    try {
        const mongoRule = await SaverRule.findOne ({dId: dId});
        const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules/" + mongoRule.emqxRuleId;
        const emqxRule = await axios.delete(url, auth);
        // Se borra de mongo también
        const deleted = await SaverRule.deleteOne ({dId: dId});

        return true
    } catch (error) {
        console.log ("Error deleting saver rule");
        console.log(error);
        return false;
    }
}

//Makeid to generate device password
function  makeid(length) {
      var result = "";
      var characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      var charactersLength = characters.length;
      for (var i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      return result;
}

/* Delete ALL emqx auth rules*/

async function deleteMqttDeviceCredentials(dId) {
  try {
    await EmqxAuthRule.deleteMany({ dId: dId, type: "device" });

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

module.exports = router;