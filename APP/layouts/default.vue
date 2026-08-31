<template>
  <div class="wrapper" :class="{ 'nav-open': $sidebar.showSidebar }">
    
    <notifications></notifications>
   
    <side-bar
      :background-color="sidebarBackground"
      short-title="GL"
      title="IoT"
    >
      <template slot-scope="props" slot="links">
        <sidebar-item
          :link="{
            name: 'Dashboard',
            icon: 'tim-icons icon-chart-pie-36',
            path: '/dashboard'
          }"
        >
        </sidebar-item>

        <sidebar-item
          :link="{
            name: 'Devices',
            icon: 'tim-icons icon-chart-pie-36',
            path: '/devices'
          }"
        >
        </sidebar-item>


        <sidebar-item
          :link="{
            name: 'Alarms',
            icon: 'tim-icons icon-chart-pie-36',
            path: '/alarms'
          }"
        >
        </sidebar-item>


        <sidebar-item
          :link="{
            name: 'Templates',
            icon: 'tim-icons icon-chart-pie-36',
            path: '/templates'
          }"
        >
        </sidebar-item>
    

   
      </template>
    </side-bar>
    <!--Share plugin (for demo purposes). You can remove it if don't plan on using it-->
    <sidebar-share :background-color.sync="sidebarBackground"> </sidebar-share>
    <div class="main-panel" :data="sidebarBackground">
      <dashboard-navbar></dashboard-navbar>
      <router-view name="header"></router-view>

      <div
        :class="{ content: !isFullScreenRoute }"
        @click="toggleSidebar"
      >
        <zoom-center-transition :duration="200" mode="out-in">
          <!-- your content here -->
          <nuxt></nuxt>
        </zoom-center-transition>
      </div>
      <content-footer v-if="!isFullScreenRoute"></content-footer>
    </div>
  </div>
</template>
<script>
  /* eslint-disable no-new */
  import PerfectScrollbar from 'perfect-scrollbar';
  import 'perfect-scrollbar/css/perfect-scrollbar.css';
  import SidebarShare from '@/components/Layout/SidebarSharePlugin';
  function hasElement(className) {
    return document.getElementsByClassName(className).length > 0;
  }

  function initScrollbar(className) {
    if (hasElement(className)) {
      new PerfectScrollbar(`.${className}`);
    } else {
      // try to init it later in case this component is loaded async
      setTimeout(() => {
        initScrollbar(className);
      }, 100);
    }
  }

  import DashboardNavbar from '@/components/Layout/DashboardNavbar.vue';
  import ContentFooter from '@/components/Layout/ContentFooter.vue';
  import DashboardContent from '@/components/Layout/Content.vue';
  import { SlideYDownTransition, ZoomCenterTransition } from 'vue2-transitions';
  import { orangeChartOptions } from '~/components/Charts/config';
  import mqtt from 'mqtt';


  export default {
    components: {
      DashboardNavbar,
      ContentFooter,
      DashboardContent,
      SlideYDownTransition,
      ZoomCenterTransition,
      SidebarShare
    },
    data() {
      return {
        options: {
        port: process.env.mqtt_port,
        host: process.env.mqtt_host,
        path: "/mqtt", //I set path instead endpoind. I'm not sure if it works in th oother way 
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 5000,
        clientId: "web_" + this.$store.state.auth.userData.name + "_" + Math.floor(Math.random() * 1000000 + 1),
        username: "",
        password: ""
        },
        sidebarBackground:'blue', //vue|blue|orange|green|red|primary
        client:null

      };
    },

    computed: {
      isFullScreenRoute() {
        return this.$route.path === '/maps/full-screen'
      }
    },

    mounted() {
      this.$store.dispatch("getNotifications");
      this.initScrollbar();
      setTimeout(()=>{
        this.startMqttClient();
      }, 2000)
    },
  ///REVIEW IF BEFORE DESTROY FUNCTION MUST BE SENT
    methods: {
      // FUNCTION TO CONNECT VIA WS (MQTT) TO BROKER FROM FRONTEND -> THIS IS LIKE A LISTENER LISTENING ANY MESSAGE COMING FROM BROKER 
      // AFTER BREAKING RULE, THIS MESSAGE COMES FROM DUMMY/NOTIF TOPIC WHICH IS CREATED ON BACKEND TO PUBLISH THE MESSAGE
      // AS THIS LISTENER (ON FRONTEND) HAS A /NOTIF IT CATCHES THIS MESSAGE TO BE PUBLISHED AS A NOTIFICATION ON FRONTED

      async startMqttClient () {
          await this.getMqttCredentials(); // Post to get credentials, these are stored in options
          const deviceSubscribeTopic = this.$store.state.auth.userData._id + "/+/+/sdata"
          const notifSubscribeTopic = this.$store.state.auth.userData._id + "/+/+/notif"
          const connectUrl = process.env.mqtt_prefix + this.options.host + ":" + this.options.port + this.options.path;

          try {
            this.client = mqtt.connect(connectUrl, this.options);
          }catch(error){
            console.log("error en catch", error)
          }
          //MQTT CONNECTION
          this.client.on('connect', () => {
            console.log("cliente", this.client)
            console.log('Connection succeded! en default.vue')

            //Sdata Subscribe
            this.client.subscribe(deviceSubscribeTopic, {qos:0}, (err) => {
              if (err){
                console.log("Error in DeviceSubscription")
                return;
              }
              console.log("Device Subscription Success")
              console.log(deviceSubscribeTopic);

            })

            //Notif Subscribe
            this.client.subscribe(notifSubscribeTopic, {qos:0}, err => {
              if (err){
                console.log("Error in DeviceSubscription")
                return;
              }
              console.log("Device Subscription Success")
              console.log(notifSubscribeTopic);
            })

            this.client.on ('error', error => {
              console.log('Connection failed', error)
            })

            this.client.on("reconnect", error => {
              console.log('Reconnecting', error)
              this.getMqttCredentialsForReconnection();
            })

            this.client.on('message', (topic, message) => {
              console.log("Message from mqtt topic:" + topic);
              console.log(message.toString());

              try {
                const splittedTopic = topic.split("/");
                const msgType = splittedTopic[3];
                console.log("msgType" + msgType)

                if (msgType == "notif"){
                  console.log("Disparo de notificacion en default.vue")
                  this.$notify({type: 'danger', icon:'tim-icons icon-alert-circle-exc', message: message.toString()})
                  this.$store.dispatch("getNotifications");

                  return;
                }else if (msgType == "sdata"){
                  $nuxt.$emit (topic, JSON.parse(message.toString()))
                  console.log("Esto es en el default.vue con sdata")
                  return;

                }

              }catch (error){
                console.log(error)
              }
            });

            $nuxt.$on('mqtt-sender', (toSend) => {
              console.log("Esto es en el default.vue al escuchar el mensaje por nuxt on (mqtt-sender), para luego ser publicado por mqtt")
              this.client.publish(toSend.topic, JSON.stringify(toSend.msg));
            });

        })
      },

      //This function is called by startMqttClient
      async getMqttCredentials () {
        try{
          const axiosHeaders = {
            headers: {
              token: this.$store.state.auth.token
            }
          };
          const credentials = await this.$axios.post("/getmqttcredentials", null, axiosHeaders)
          console.log("Credenciales obtenidas en funcion:", credentials.data)

          if(credentials.data.status == "success"){
            this.options.username = credentials.data.username;
            this.options.password = credentials.data.password;

          }else{
            console.log("Error en obtención de credenciales")
          }          
        }catch (error){
          console.log(error);
        }

      },
      //Method to get Credential in case of an unexpected disconnection
      async getMqttCredentialsForReconnection() {
        const axiosHeaders = {
          headers: {
            token: this.$store.state.auth.token
          }
        };
        const credentials = await this.$axios.post("/getmqttcredentialsforreconnection", null, axiosHeaders)
        console.log("Credenciales obtenidas en funcion de reconexión:", credentials.data)

        if(credentials.data.status == "success"){ // Here, unlike the getMqttCredentials method this replaces the credential on client object directly
          this.client.options.username = credentials.data.username;
          this.client.options.password = credentials.data.password;

        }else{
          console.log("Error en obtención de credenciales para reconexión")
        }
      },


      toggleSidebar() {
        if (this.$sidebar.showSidebar) {
          this.$sidebar.displaySidebar(false);
        }
      },
      initScrollbar() {
        let docClasses = document.body.classList;
        let isWindows = navigator.platform.startsWith('Win');
        if (isWindows) {
          // if we are on windows OS we activate the perfectScrollbar function
          initScrollbar('sidebar');
          initScrollbar('main-panel');
          initScrollbar('sidebar-wrapper');

          docClasses.add('perfect-scrollbar-on');
        } else {
          docClasses.add('perfect-scrollbar-off');
        }
      }
    },
  };
</script>
<style lang="scss">
  $scaleSize: 0.95;
  @keyframes zoomIn95 {
    from {
      opacity: 0;
      transform: scale3d($scaleSize, $scaleSize, $scaleSize);
    }
    to {
      opacity: 1;
    }
  }

  .main-panel .zoomIn {
    animation-name: zoomIn95;
  }

  @keyframes zoomOut95 {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
      transform: scale3d($scaleSize, $scaleSize, $scaleSize);
    }
  }

  .main-panel .zoomOut {
    animation-name: zoomOut95;
  }
</style>
