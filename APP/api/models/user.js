const mongoose = require('mongoose'); //import mongoose from 'mongoose';
const uniqueValidator = require('mongoose-unique-validator');  //valida el registro de una persona con un único email

const Schema = mongoose.Schema; //es el esquma de mongo. ver esto

const userSchema = new Schema({
    name: { type: String, required: [true] },
    email: { type: String, required: [true], unique: true },  //el unique es para que sea un email unico
    password: { type: String, required: [true] },
    // devices: [], es sólo ejemplo //en mysql no puedo dejar esto vacío para colocar lo que quiera 
});


//Validator 
userSchema.plugin(uniqueValidator, { message: 'Error, email already exists.' });

// convert to model
const User = mongoose.model('User', userSchema);  //se creal el modelo 
module.exports = User; //se exporta el modelo para que pueda ser usado en otros archivos