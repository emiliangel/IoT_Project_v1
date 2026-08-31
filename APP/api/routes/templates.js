const express = require ('express');
const router = express.Router();
const {checkAuth} = require('../middlewares/authentication.js')
const Device = require('../models/device.js')
const Template = require('../models/template')

//Models import 

// Get template
router.get ('/template' , checkAuth, async (req, res) =>{

    try {
        const userId = req.userData._id;
        const templates = await Template.find({userId: userId});

        const response = {
            status: "success",
            data: templates
        }
        return res.json(response)
    }
    catch (error){
        console.log ("error creando plantilla")
        const response = {
            status: "error",
            error: error
        }
        return res.status(500).json(response)
    }

})
// Post template

router.post ('/template', checkAuth, async (req, res) => {
    try {
        const userId = req.userData._id; //se obtiene id del user
        var newTemplate = req.body.template; //se obtienen datos de plantilla

        newTemplate.userId = userId;
        newTemplate.createdTime = Date.now ();

        const template = await Template.create (newTemplate);

        const response = {
            status: "success",
        }

        return res.json(response)

    } catch (error) {
        console.log ("error creando plantilla")
        const response = {
            status: "error",
            error: error
        }

        return res.status(500).json(response)
    }

})
//Delete Template

router.delete('/template', checkAuth, async (req, res) => {
    try {
        const userId = req.userData._id;
        const templateId = req.query.templateId;

        const devices = await Device.find({userId: userId, templateId: templateId});

        if (devices.length > 0) {
            const response = {
                status: "fail",
                error: "template in use"
            }
            return res.json(response);
        }

        const deleted = await Template.deleteOne ({userId: userId, _id: templateId});

        const response = {
            status: "success",
        }

        return res.json(response)
    } catch (error) {
       const response = {
            status: "error",
            error: error
        }
        return res.status(500).json(response)
    }
})

module.exports = router;