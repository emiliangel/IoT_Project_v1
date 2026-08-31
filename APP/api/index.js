//require
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const mongoose = require ("mongoose");
const colors = require ("colors");
require('dotenv').config();
//instances
const app = express();
//express config
app.use(morgan("tiny")); //para que sea visualmente mejor
app.use(express.json()); // para que muestre en fomato json
app.use(express.urlencoded ({
    extended: true // permite pasar param desde url
}));

app.use(cors());


//express routes

app.use('/api', require('./routes/users.js'))

app.use('/api', require('./routes/devices.js'))

app.use('/api', require('./routes/templates.js'))

app.use("/api", require("./routes/webhooks.js"));

app.use("/api", require("./routes/emqxapi.js"));

app.use("/api", require("./routes/alarms.js"));

app.use("/api", require("./routes/dataprovider.js"));



//listener


app.listen(process.env.API_PORT, '0.0.0.0', () => {
    console.log("API server listening on port: " + process.env.API_PORT) //Esto es lo que se muestra en 
});



module.exports = app; // se xporta como un módulo para poder ordenar los endpoints por archivos


//Mongo Connection

const mongoUserNAme = process.env.MONGO_USERNAME;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoHost = process.env.MONGO_HOST;
const mongoPort = process.env.MONGO_PORT;
const mongoDatabase= process.env.MONGO_DATABASE; //ver si se le pone el otro nombre, si es necesario, el otro es: "ioticos_god_level" //al cambiar este nombre cambia el nombre de la base de datos contentiva de la colección... , no la del título de la base de datos total 


var uri = "mongodb://" + mongoUserNAme + ":" + mongoPassword + "@" + mongoHost + ":" + mongoPort + "/" + mongoDatabase

const options = {
    useNewUrlParser : true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useNewUrlParser: true,
    authSource: "admin",
};

try {

    mongoose.connect(uri, options).then 
        
    (   () =>
        {
        console.log("\n");
        console.log("***************".green);
        console.log("Susccesfully connected".green);
        console.log("***************".green);
        console.log("\n".green);
        global.check_mqtt_superuser();


        }, 
        (err) => {
            console.log("\n".red);
            console.log("***************".red);
            console.log("Connection Failed".red);
            console.log("***************".red);
            console.log("\n".red)
            console.log(err)
        }




    );
    

}   catch (error) {
    console.log ("ERROR CONNECTING MONGO");
    console.log(error);
}

// ver bien lo de try catch

//endpoint test


app.get("/testing", (req, res) => {
    console.log("Hello Api");
    res.send("Hello API");

});