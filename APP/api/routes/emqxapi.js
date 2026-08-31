const express = require('express');
const router = express.Router();
const axios = require('axios')
const colors = require('colors');
const EmqxAuthRule = require ('../models/emqx_auth')

const auth = {
    auth: {
        username: 'admin',
        password: process.env.EMQX_DEFAULT_APPLICATION_SECRET
    }
};

global.saverResource = null;
global.alarmResource = null;

// EMQX RESOURCES MANAGER
//List resources (Si sólo hay dos recursos se llama a Create Resources)

async function listResources (){

    try{
        const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/resources/";
        const res = await axios.get(url, auth)

        const size = res.data.data.length;

        if (res.status === 200) {
            if (size == 0){
                    console.log ("Creating resources".green)
                    createResources ();
                }else if (size == 2) {
                    res.data.data.forEach(resource => {
                        if(resource.description == "alarm-webhook"){
                            global.alarmResource = resource;

                            console.log("Alarm resource found".bgBlue);
                            console.log(global.alarmResource);
                            console.log("Alarm Resource Found".bgBlue);
                            console.log("\n");

                        }

                        if(resource.description == "saver-webhook"){
                            global.saverResource = resource;
                            console.log("Saver resource found".bgBlue);
                            console.log(global.saverResource);
                            console.log("Saver resource Found".bgBlue);
                            console.log("\n");

                        }
                    });

                    }else{
                        function printWarning () {
                            console.log("DELETE ALL WEBHOOK RESOURCES AND RESTART NODE - YOUREMQXDOMAIN:8085/#/RESOURCES".red)
                            setTimeout (()=> {
                                printWarning();
                            }, 1000);
                        }     
                        printWarning();                  
                     
                }

        }else{
            console.log("Error in emqx api")
        }
    }catch (error) {
        console.log("error listando recursos")
    }


}
//Create resources
async function createResources () {
    try{
       const url = "http://"+process.env.EMQX_NODE_HOST+":8085/api/v4/resources";

        const data1 = {
            "type": "web_hook",
            "config": {
                //url: "http://host.docker.internal:3001/api/saver-webhook",
                //url: "http://host.docker.internal:3001",
                //url: "http://10.93.127.158:3001",
                url: "http://192.168.0.102:3001",
                //headers: { Esto en el curso Pablo lo coloca, pero creo que para esta version de Emxq se pone sin esto
                //    token: "121212"
                //},
                method: "POST"
            },
            description: "saver-webhook"
        }

        const data2 = {
            "type": "web_hook",
            "config": {
                //url: "http://host.docker.internal:3001/api/alarm-webhook",
                //url: "http://host.docker.internal:3001",
                //url: "http://10.93.127.158:3001",
                url: "http://192.168.0.102:3001",
                //headers: {
                    //token: "121212"
                //},
                method: "POST"
            },
            description: "alarm-webhook"  
        }

        const res1 = await axios.post(url, data1, auth);

        if (res1.status === 200){
            console.log("Saver resource created!".green);
        }

        const res2 = await axios.post(url, data2, auth);

        if(res2.status === 200){
            console.log("Alarm resource created!".green);
        }
        setTimeout (() => {
            console.log("Recursos creados".green);
            listResources ();
        },1000); 

    } catch (error){
    console.log("Error creating resoruces");
    console.log(error);
    }
}

global.check_mqtt_superuser = async function check_mqtt_superuser () {
    try {   
        const superusers = await EmqxAuthRule.find({type: "superuser"});
        if (superusers.length > 0) {
            return;
        }

        await EmqxAuthRule.create(
            {
                publish: ["#"],
                subscribe: ["#"],
                userId: "abcdefghi",
                username: "admin",
                password: "emqxdashpass",
                type: "superuser",
                time: Date.now(),
                updatedTime: Date.now()
            }
        )
    }catch (error){
        console.log("Error creating superuser");
        console.log(error);
    }
},

setTimeout (() => { 
    console.log("LISTING RESOURCES");
    listResources();
}, process.env.EMQX_RESOURCES_DELAY); // Time to allow EMQX to start and be ready to receive requests, this is set in .env file
module.exports = router;
