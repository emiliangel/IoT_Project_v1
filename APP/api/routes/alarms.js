const express = require('express')
const router = express.Router();
const axios = require('axios');
const {checkAuth} = require('../middlewares/authentication.js');
const colors = require ('colors');
const alarmRule = require('../models/emqx_alarm_rule');


const auth = {
    auth: {
        username: 'admin',
        password: process.env.EMQX_DEFAULT_APPLICATION_SECRET
    }
};

/*
//////
API ALARMS
//////
*/

// Create Alarm-Rule

router.post("/alarm-rule", checkAuth, async (req, res)=> {
    var newRule = req.body.newRule;
    newRule.userId = req.userData._id;
    var r = await createAlarmRule(newRule);
    
    if (r) {
        const response = {
            status: "success",
        }
        return res.json(response);        
    }else{
        const response = {
            status: "error",
        }  
        return res.status(500).json(response);
    }
});
// Update Alarm Rule

router.put("/alarm-rule", checkAuth, async (req, res)=> {
    var rule = req.body.rule;
    console.log(rule)
    var r = await updateAlarmRuleStatus(rule.emqxRuleId, rule.status);
    
    if (r) {
        const response = {
            status: "success",
        }
        return res.json(response);        
    }else{
        const response = {
            status: "error",
        }  
        return res.status(500).json(response);
    }
});

// Delete alarm Rule
router.delete('/alarm-rule', checkAuth, async (req, res) => {

    var emqxRuleId = req.query.emqxRuleId; // lo obtiene de la query en si, donde esta el ruleid

    var r = await deleteAlarmRule(emqxRuleId);

    if (r ) {

        const response = {
            status: "success",
        }

        return res.json(response);

    } else {
        const response = {
            status: "error",
        }

        return res.json(response);
    }

});


/*
//////
FUNCTIONS ALARMS (with EMQX API)
//////
*/

// Create Alarm Rule
async function createAlarmRule (newAlarm) {
    const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules";
    const topic = newAlarm.userId + "/" + newAlarm.dId + "/" + newAlarm.variable + "/sdata";
    const rawsql = "SELECT username, topic,payload FROM \"" + topic + "\" WHERE payload.value " + newAlarm.condition + " " + newAlarm.value + " AND is_not_null(payload.value)";

    var newRule = {
        rawsql:rawsql,
        actions: [{
            name: "data_to_webserver",
            params: {
                headers: {
                    "Content-Type": "application/json",
                    "token": process.env.EMQX_API_TOKEN
                },
                path: "api/alarm-webhook",
                body: '{"userId":"' + newAlarm.userId +'", "payload": ${payload}, "topic":"${topic}"}',
                $resource: global.alarmResource.id,
                //payload_tmpl: '{"userId":"' + userId + '","payload": ${payload}, "topic":"${topic}"}'
            }
        }],
        description: "ALARM-RULE",
        enabled: newAlarm.status
    }
    const res = await axios.post(url, newRule, auth);
    const emqxRuleId = res.data.data.id  /// if below is used the same const res 
    // for put answer, we must select
    
    if (res.status === 200  && res.data.data) {
        //console.log(res.data.data);

        const mongoRule = await alarmRule.create ({
            userId: newAlarm.userId,
            dId: newAlarm.dId,
            emqxRuleId: res.data.data.id,
            status: newAlarm.status,
            variable: newAlarm.variable,
            variableFullName: newAlarm.variableFullName,
            value: newAlarm.value,
            condition: newAlarm.condition,
            triggerTime: newAlarm.triggerTime,
            createTime: Date.now()
        });

        const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules/" + mongoRule.emqxRuleId;
        const body = '{"userId":"' + newAlarm.userId + '","dId":"' + newAlarm.dId + '","deviceName":"' + newAlarm.deviceName + '","payload":${payload},"topic":"${topic}","emqxRuleId":"' + mongoRule.emqxRuleId + '","value":' + newAlarm.value + ',"condition":"' + newAlarm.condition + '","variable":"' + newAlarm.variable + '","variableFullName":"' + newAlarm.variableFullName + '","triggerTime":' + newAlarm.triggerTime + '}';
        newRule.actions[0].params.body = body;  // var is updated with new body (and alarm rule id)

        const res_update = await axios.put(url, newRule, auth);

        console.log("Alarm rule created");

        return true

    }


}


// Update alarm Rule status
async function updateAlarmRuleStatus (emqxRuleId, status) {
    const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules/" + emqxRuleId;
    
    const newRule = {
        enabled: status
    }

    const res = await axios.put(url, newRule, auth);

    //return true
    if (res.status === 200 && res.data.data) {
        //Actualiza en Mongo
        await alarmRule.updateOne({emqxRuleId: emqxRuleId}, {status: status})
        console.log("Saver Rule Status Updated...". green);

        return true;
    }
}

// Delete Alarm Rule
async function deleteAlarmRule(emqxRuleId) {
    try {

        const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/rules/" + emqxRuleId;

        const emqxRule = await axios.delete(url, auth);

        const deleted = await alarmRule.deleteOne({ emqxRuleId: emqxRuleId });

        return true;

    } catch (error) {

        console.log(error);
        return false;

    }
}

module.exports = router;
