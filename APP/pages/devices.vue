<template>
    <div>
        
<!-- Form add device -->      
        <div class="row">
            <card>
                <div slot="header">
                    <h4 class="card-title">
                        Add new device
                    </h4>
                </div>
            </card>

            <div class="row">
                <div class="col-4">
                    <base-input label="Device Name" type="text" placeholder="Ex Home Office" v-model="newDevice.name" >
                    </base-input>
                </div>

                <div class="col-4">
                    <base-input label="Device Id" type="text" placeholder="Ex Home Office" v-model="newDevice.dId">
                    </base-input>
                </div>



                <div class="col-4">

                    <slot name="label">
                        <label>Templates</label>
                    </slot>
                    <el-select v-model="selectedIndexTemplate" value="1" class="select-primary" placeholder="Select Template" style="width: 100%">
                        <el-option v-for= "template, index in templates" :key="template._id" class="text-dark" :value="index" :label="template.name"></el-option>
                    </el-select>
                </div>
            </div>

            <div class="row pull-right">
                <div class="col-12">
                    <base-button @click= "createNewDevice()" type="primary" class="mb-1" size="lg" style="top:20px; left: 20px;">Add</base-button>
                </div>
            </div>
            
        </div>

        
<!-- Device table -->
        <div class="row">
            <card>
                <div slot="header">
                    <h4 class="card-title">Devices</h4>
                </div>

                <el-table :data="$store.state.devices">

                    <el-table-column label="#" min-width="50" align="center"> 
                         <div slot-scope="{row, $index}"> {{$index + 1}}</div> 

                    </el-table-column>
                    <el-table-column label="Name" prop="name"></el-table-column>
                    <el-table-column label="Device Id" prop="dId"></el-table-column>
                    <el-table-column label="Password" prop="password"></el-table-column>
                    <el-table-column label="Template" prop="templateName"></el-table-column>
                    <el-table-column label="Actions">


                        <div slot-scope="{row, $index}">
                            <!--{{row.saverRule}}--> <!-- To verify the var change -->


                            <el-tooltip content="Saver Status Indicator" style="margin-right: 10px;">
                                <!-- Esta línea se hizo con apoyo de la documen, mezclado con lo de Pablo -->
                                <i class="fas fa-database" :class="{'text-success' : row.saverRule.status, 'text-dark' : !row.saverRule.status}"></i> 

                            </el-tooltip>

                            <el-tooltip content="Database Saver">
                                <!-- Esta línea se hizo con apoyo de la documen, mezclado con lo de Pablo, OJO, SE COLOCÓ INPUT EN LUGAR DE CLICK PARA QUE FUNCIONARA EL SWITCH -->
                            <base-switch @input="updateSaverRuleStatus(row.saverRule)" :value ="row.saverRule.status" type="primary" on-text="On" off-text="Off">
                            </base-switch> 

                            </el-tooltip>

                            <el-tooltip content="Delete" effect="Light" :open-delay="300" placement="top">
                            
                            <base-button type="danger" icon size="small" class="btn-link" @click="deleteDevice(row)">
                                <i class="tim-icons icon-simple-remove"></i>
                            </base-button>  

                            </el-tooltip>

                        </div>

                        <el-tooltip content="Delete" effect="Light" :open-delay="300" placement="top">
                          
                          <base-button type="danger" icon size="small" class="btn-link">
                            <i class="tim-icons icon-simple-remove"></i>
                          </base-button>  

                        </el-tooltip>
                    

                    
                    
                    </el-table-column>

                </el-table>
               <!--pre> Devices:{{ $store.state.devices }}</pre--> <!--This line is use wether is required to show all devices (selected and no selected)-->  
               <!--pre> Devices:{{ $store.state.selectedDevice }}</pre-->    

               <!--Json :value="templates"/>  
                <pre> Templates:{{templates}}</pre-->    


                <!--<Json :value="$store.state.devices" />  CON JSON NO FUNCIONA, NO MUESTRA LOS DATOS, CON PRE SI LO HACE--> 
            </card>

        </div>

          

    </div>
</template>

<script>

import {Table, TableColumn} from "element-ui";
import {Select, Option} from "element-ui";
import {BaseSwitch} from '@/components'; // Tomado de la documentacion
//import { notify } from "~/api";


export default {
    middleware: "authenticated", //Se debe poner para poner el auth.token en el storage
    components: {
        [Table.name]:Table,
        [TableColumn.name]:TableColumn,
        [Option.name]:Option,
        [Select.name]:Select,
        BaseSwitch
    },


    data () {
        return {
          /*  switches: {
             defaultOn: true,
             defaultOff: false
           },*/
           templates: [],
           selectedIndexTemplate: null,
           newDevice: {
            name: "",
            dId: "",
            templateId: "",
            templateName: ""
           },
        }
    },

    mounted () {
        this.$store.dispatch("getDevices");
        this.getTemplates();
    },

    methods: {
        
        async createNewDevice () {

            //Notify if is not name
            if (this.newDevice.name == "") {
                this.$notify ({
                    type: "warning",
                    icon: "tim-icons icon-alert-circle-exc",
                    message: "Device Name is Empty :("
                });
                return;
            };
            //Notify if is not name
            if (this.newDevice.dId == "") {
                this.$notify ({
                    type: "warning",
                    icon: "tim-icons icon-alert.circle.exc",
                    message: "Device ID is Empty"
                });
                return;
            };
            //Notify if is not name
            if (this.selectedIndexTemplate == null) {
                this.$notify({
                    type: "warning",
                    icon: "tim-icons icon-alert-circle-exc",
                    message: "template must be selected"
                });
                return;
            };

            const axiosHeaders = {
                headers: {
                    token: this.$store.state.auth.token

                }
            };

            this.newDevice.templateId = this.templates[this.selectedIndexTemplate]._id;
            this.newDevice.templateName = this.templates[this.selectedIndexTemplate].name;

            const toSend = {
                newDevice: this.newDevice
            }

            const res = await this.$axios
            .post("/device", toSend, axiosHeaders)
            .then(res => {
                    if (res.data.status == "success"){
                    this.newDevice.name = "",
                    this.newDevice.dId = "",
                    this.selectedIndexTemplate = null;
                

                    this.$notify({
                        type: "sucess",
                        icon: "tim-icons icon-check-2",
                        message: "Success! Device added"
                    })
                    this.$store.dispatch("getDevices");
                    return;
                }
            })

            .catch(e => {
                if (
                    e.response.data.status == "error" && 
                    e.response.data.error.error.dId.kind == "unique"
                ) {
                    this.$notify({
                    type: "warning",
                    icon: "tim-icons icon-alert-circle-exc",
                    message: "template must be selected"
                });
                    return;
                }else {
                    this.$notify("Error!");  //Ver como especificar que el error que viene por duplicacion de device al registrar
                    return;
                }

            })
        },   
        
        //GetTemplates
        async getTemplates () {
          const axiosHeader = {
            headers: {
              token: this.$store.state.auth.token ///ver si es token o accesstoken
            }
          };
          try {
            const res = await this.$axios.get ("/template", axiosHeader);
            console.log(res.data);

            if (res.data.status == "success"){
              this.templates = res.data.data;
            }
          }catch (error){
            this.$notify({
              type: "danger",
              icon: "tim-icons icon-alert-circle-exc",
              message: "Error obteniendo templates"
            });
          }
        },

        deleteDevice(device){
            const axiosHeader = {
                headers: {
                    token: this.$store.state.auth.token,
                },
                params: {
                    dId: device.dId,  
                }
            };
                //console.log(params)

            this.$axios
            .delete ("/device", axiosHeader)
            .then (res => {
                if (res.data.status == "success"){
                    this.$notify ({
                        type: "success",
                        icon: "tim-icons icon-check-2",
                        message: device.name + "Deleted"

                    });
                    this.$store.dispatch("getDevices")
                }
            })

            .catch (e => {
                console.log(e);
                this.$notify({
                    type: "danger",
                    icon: "tim-icons icon-alert-circle-exc",
                    message: "Error deleting " + device.name
                });
            });
        },
        // Update rules
        updateSaverRuleStatus(rule){
            console.log("testing- rule", rule)
            //console.log("rule:", rule)
            //console.log("ruleCopy:", JSON.parse(JSON.stringify(rule)))

            var ruleCopy = JSON.parse(JSON.stringify(rule));

            ruleCopy.status = !ruleCopy.status;
            console.log("ruleCopy", ruleCopy)

            const toSend = {rule: ruleCopy};

            const axiosHeader = {
                headers: {
                    token: this.$store.state.auth.token
                }
            };


            this.$axios.put("/saver-rule", toSend, axiosHeader)
            .then(res => {
                if (res.data.status == "success") {

                    this.$store.dispatch("getDevices");
                    this.$notify({
                        type: "success",
                        icon: "tim-icons icon-check-2",
                        message: "Device Saver Status Updated"

                    });
                }
                if (res.data.status == "error") {
                    this.$notify({
                        type: "danger",
                        icon: "tim-icons icon-alert-circle-exc",
                        message: "Error updating Saver Status"

                    });
                    return;
                }

            }
            )
            .catch (e => {
                console.log(e);
                this.$notify({
                    type:"danger",
                    icon: "tim-icons icon-alert-circle-exc",
                    message: "Error deleting" + device.name
                });
                return;
            })

        }
    }
}
</script>



<style>
/*VISTA DEL DEVICE FIXED*/

/* Make Element UI table background transparent */
.el-table {
    background: transparent !important;
}

/* Remove header bottom border so only row separators remain */
.el-table .el-table__header-wrapper,
.el-table .el-table__header-wrapper table thead,
.el-table .el-table__header-wrapper table thead th,
.el-table thead th {
    background-color: transparent !important;
    border-bottom: none !important;
}

/* Ensure header cell backgrounds are transparent and inherit color */
.el-table thead th .cell,
.el-table th .cell {
    background-color: transparent !important;
    color: inherit !important;
}

/* Add a subtle border between rows (keep only row separators) */
.el-table .el-table__body-wrapper table tbody tr td {
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
}

/* Remove extra empty block background if present */
.el-table .el-table__empty-block {
    background-color: transparent !important;
}
</style>


 