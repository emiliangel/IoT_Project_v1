const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const alarmRuleSchema = new Schema ({
    userId: {type: String, required: [true]},
    dId: {type: String, required: [true]},
    emqxRuleId: {type: String, required: [true]},
    variableFullName: {type: String},
    variable: {type: String},
    value: {type: String},
    condition: {type: String},
    triggerTime: {type: Number},
    status: {type: Boolean},
    counter: {type: Number, default: 0},
    createdTime: {type: Number}
});

const alarmRule = mongoose.model('alarmRule', alarmRuleSchema);
module.exports = alarmRule;