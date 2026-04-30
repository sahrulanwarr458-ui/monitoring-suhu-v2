const client = mqtt.connect("wss://a518f7d82e9445599e1da781533eff86.s1.eu.hivemq.cloud:8884/mqtt",{
    username:"Penetas_telur",
    password:"Farming123?"
});

let chart;
let currentMode="AUTO";

document.addEventListener("DOMContentLoaded",()=>{

    initChart();
    setInterval(updateTime,1000);

    document.getElementById("autoModeBtn").onclick=()=>setMode("AUTO");
    document.getElementById("manualModeBtn").onclick=()=>setMode("MANUAL");

    document.getElementById("lampOnBtn").onclick=()=>sendManual("lamp","ON");
    document.getElementById("lampOffBtn").onclick=()=>sendManual("lamp","OFF");
});

function setMode(m){
    client.publish("inkubator/mode",m);
}

function sendManual(dev,val){
    if(currentMode!=="MANUAL"){
        alert("Ubah ke MANUAL dulu");
        return;
    }
    client.publish(`inkubator/manual/${dev}`,val);
}

client.on("connect",()=>{
    document.getElementById("connectionStatus").innerText="ONLINE";
    client.subscribe("inkubator/#");
});

client.on("message",(topic,msg)=>{
    let val=msg.toString();

    if(topic==="inkubator/suhu"){
        let t=parseFloat(val);
        document.getElementById("currentTemp").innerText=t.toFixed(1);
        updateChart(t);
    }

    if(topic==="inkubator/lampu") update("lampu",val);
    if(topic==="inkubator/kipas") update("kipas",val);

    if(topic==="inkubator/low") document.getElementById("lowVal").innerText=val;
    if(topic==="inkubator/high") document.getElementById("highVal").innerText=val;

    if(topic==="inkubator/mode"){
        currentMode=val;
        document.getElementById("modeStatus").innerText=val;
        document.getElementById("manualPanel").style.display=
            val==="MANUAL"?"block":"none";
    }
});

function update(id,val){
    let el=document.getElementById(id);
    val=val==="ON"?"ON":"OFF";

    el.innerText=val;
    el.className="status-badge "+(val==="ON"?"on":"off");
}

function initChart(){
    let ctx=document.getElementById("tempChart").getContext("2d");
    chart=new Chart(ctx,{
        type:"line",
        data:{labels:[],datasets:[{data:[]}]}
    });
}

function updateChart(t){
    chart.data.labels.push(new Date().toLocaleTimeString());
    chart.data.datasets[0].data.push(t);

    if(chart.data.labels.length>30){
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

function updateTime(){
    document.getElementById("currentTime").innerText=
        new Date().toLocaleString();
}
