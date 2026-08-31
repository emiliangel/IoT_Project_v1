<template>
    <div class = "row" v-if="$store.state.devices.length > 0">
      <div
        v-for="(widget, index) in $store.state.selectedDevice.template.widgets"
        :key="index"
        :class="[widget.column]"
      >
                <!--pre> Widgets:{{fixWidget(widget)}}</pre--> 
                <!--<pre> Device Name:{{$store.state.selectedDevice.name}}</pre> -->

                   
        <Rtnumberchart
          v-if="widget.widget == 'numberchart'"
          :config="fixWidget(widget)"
        ></Rtnumberchart>

        <Iotswitch
          v-if="widget.widget == 'switch'"
          :config="fixWidget(widget)"
        ></Iotswitch>

        <Iotbutton
          v-if="widget.widget == 'button'"
          :config="fixWidget(widget)"
        ></Iotbutton>

        <Iotindicator
          v-if="widget.widget == 'indicator'"
          :config="fixWidget(widget)"
        ></Iotindicator>
      </div>
    </div>

    <div v-else>
      <h1>Dashboard</h1>
      <p>No devices found. Please add a device to see the dashboard.</p>
    </div>

</template>

<script>
import Rtnumberchart from "../components/Widgets/Rtnumberchart.vue";
import Iotswitch from "../components/Widgets/Iotswitch.vue";
import Iotbutton from "../components/Widgets/Iotbutton.vue";
import Iotindicator from "../components/Widgets/IotIndicator.vue";

export default {
  middleware: "authenticated",
  components: {
    Rtnumberchart,
    Iotswitch,
    Iotbutton,
    Iotindicator

  },
mounted () {

},

methods: {
  fixWidget(widget){
    var widgetCopy = Object.assign ({}, widget); //In this way, it does not work, because it tries to mutate store from here, and this is not allowed by it
    var widgetCopy = JSON.parse(JSON.stringify(widget)) //In this way, It works
    widgetCopy.selectedDevice.dId = this.$store.state.selectedDevice.dId,
    widgetCopy.selectedDevice.name = this.$store.state.selectedDevice.name,
    widgetCopy.userId = this.$store.state.selectedDevice.userId;

    if (widget.widget == "numberchart"){
      widgetCopy.demo = false
    } //Just aplly for Numerchart widget
    return widgetCopy
  }
}

}


</script>