const mongoose = require('mongoose');
const Schema = mongoose.Schema

const dataSchema = new Schema ({
    userId: {type: String, required: [true]},
    dId: {type: String, required: [true]},
    variable: {type: String, required: [true]},
    value: {type: mongoose.Schema.Types.Mixed, required: [true]}, //Se puso para que reciba cualquier tipo de dato, pero ver si se quiere recibir todo el objeto, o solo un valor particular
    time: {type: Number, required: [true]}
});

const Data = mongoose.model("Data", dataSchema);

module.exports = Data;