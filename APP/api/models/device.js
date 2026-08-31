const mongoose = require('mongoose'); //import mongoose from 'mongoose';
const uniqueValidator = require('mongoose-unique-validator');  //valida el registro de una persona con un único email

const Schema = mongoose.Schema; //es el esquma de mongo. ver esto

const deviceSchema = new Schema({
    userId: { type: String, required: [true] },
    dId: { type: String, required: [true], unique: true },  //el unique es para que sea un email unico
    name: { type: String, required: [true] },
    password: {type: String, required: [true]},
    selected: {type: Boolean, required: [true], default: false},
    templateId: {type: String, required: [true]},
    templateName: {type: String, required: [true]},
    createdTime: {type: Number}
    // devices: [], es sólo ejemplo //en mysql no puedo dejar esto vacío para colocar lo que quiera 
});


//Validator 
deviceSchema.plugin(uniqueValidator, { message: 'Error, email already exists.' });

// convert to model
const Device = mongoose.model('Device', deviceSchema);  //se creal el modelo 
module.exports = Device; //se exporta el modelo para que pueda ser usado en otros archivos