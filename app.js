// ===== MQTT CONFIGURATION =====
const options = {
    username: "Penetas_telur",
    password: "Farming123?",
    connectTimeout: 4000,
    clientId: "web_" + Math.random().toString(16).substr(2, 8),
    clean: true,
    reconnectPeriod: 5000,
};

const client = mqtt.connect(
    "wss://a518f7d82e9445599e1da781533eff86.s1.eu.hivemq.cloud:8884/mqtt",
    options
);

// ===== GLOBAL VARIABLES =====
let chart;
let dataPointCount = 0;
let temperatureHistory = [];
let currentMode = "AUTO";

// ===== WAIT FOR DOM TO LOAD =====
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing dashboard...");
    
    // Initialize chart with delay to ensure canvas is ready
    setTimeout(() => {
        initChart();
    }, 100);
    
    // Initialize time
    updateTime();
    setInterval(updateTime, 1000);
    
    // Set client ID
    const clientIdEl = document.getElementById("clientId");
    if (clientIdEl) {
        clientIdEl.innerHTML = options.clientId;
    }
    
    // Mode buttons
    const autoBtn = document.getElementById("autoModeBtn");
    const manualBtn = document.getElementById("manualModeBtn");
    
    if (autoBtn) {
        autoBtn.addEventListener("click", () => setMode("AUTO"));
    }
    if (manualBtn) {
        manualBtn.addEventListener("click", () => setMode("MANUAL"));
    }
    
    // Manual control buttons
    const lampOnBtn = document.getElementById("lampOnBtn");
    const lampOffBtn = document.getElementById("lampOffBtn");
    const fanOnBtn = document.getElementById("fanOnBtn");
    const fanOffBtn = document.getElementById("fanOffBtn");
    
    if (lampOnBtn) lampOnBtn.addEventListener("click", () => sendManualCommand("lamp", "ON"));
    if (lampOffBtn) lampOffBtn.addEventListener("click", () => sendManualCommand("lamp", "OFF"));
    if (fanOnBtn) fanOnBtn.addEventListener("click", () => sendManualCommand("fan", "ON"));
    if (fanOffBtn) fanOffBtn.addEventListener("click", () => sendManualCommand("fan", "OFF"));
    
    // Auto-reconnect handler
    setInterval(() => {
        if (!client.connected) {
            console.log("Attempting to reconnect...");
            client.reconnect();
        }
    }, 30000);
});

// ===== SET MODE =====
function setMode(mode) {
    if (client.connected) {
        client.publish("inkubator/mode", mode, (err) => {
            if (err) {
                showNotification("Failed to change mode", "error");
            } else {
                showNotification(`Mode changed to ${mode}`, "success");
                updateModeUI(mode);
            }
        });
    } else {
        showNotification("MQTT not connected", "error");
    }
}

// ===== UPDATE MODE UI =====
function updateModeUI(mode) {
    currentMode = mode;
    const modeStatus = document.getElementById("modeStatus");
    const autoBtn = document.getElementById("autoModeBtn");
    const manualBtn = document.getElementById("manualModeBtn");
    const manualPanel = document.getElementById("manualPanel");
    
    if (modeStatus) {
        modeStatus.textContent = mode;
        modeStatus.className = `mode-status ${mode.toLowerCase()}`;
    }
    
    if (autoBtn && manualBtn) {
        if (mode === "AUTO") {
            autoBtn.classList.add("active");
            manualBtn.classList.remove("active");
            if (manualPanel) manualPanel.style.display = "none";
        } else {
            manualBtn.classList.add("active");
            autoBtn.classList.remove("active");
            if (manualPanel) manualPanel.style.display = "block";
        }
    }
}

/function sendManualCommand(device, state) {
    if (!client.connected) {
        showNotification("MQTT not connected", "error");
        return;
    }
    
    if (currentMode !== "MANUAL") {
        showNotification("Please switch to MANUAL mode first", "error");
        return;
    }

    const topic = `inkubator/manual/${device}`;

    // 🔥 LANGSUNG UBAH TAMPILAN (INI KUNCINYA)
    if (device === "lamp") {
        updateStatus("lampu", state);
    } else if (device === "fan") {
        updateStatus("kipas", state);
    }

    client.publish(topic, state, (err) => {
        if (err) {
            showNotification(`Failed to control ${device}`, "error");
        }
    });
}

// ===== CHART INITIALIZATION =====
function initChart() {
    const canvas = document.getElementById('tempChart');
    if (!canvas) {
        console.error("Chart canvas not found!");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointStyle: 'circle'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#f59e0b',
                    bodyColor: '#e2e8f0',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `Temperature: ${context.parsed.y.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 25,
                    max: 52,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: true
                    },
                    ticks: {
                        color: '#e2e8f0',
                        stepSize: 3,
                        callback: function(value) {
                            return value + '°C';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: '#94a3b8',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        display: true
                    },
                    ticks: {
                        color: '#e2e8f0',
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 8
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#94a3b8',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animation: {
                duration: 500,
                easing: 'easeInOutQuart'
            },
            elements: {
                line: {
                    borderJoin: 'round'
                }
            }
        }
    });
    
    console.log("Chart initialized successfully");
}

// ===== TIME UPDATE =====
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateString = now.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.innerHTML = `${dateString}<br><span style="font-size: 14px; color: #a0aec0;">${timeString}</span>`;
    }
}

// ===== MQTT CONNECTION HANDLER =====
client.on("connect", () => {
    console.log("Connected to MQTT broker");
    updateConnectionStatus(true);
    
    client.subscribe("inkubator/#", (err) => {
        if (!err) {
            console.log("Subscribed to inkubator/#");
            showNotification("Connected to MQTT Broker", "success");
        } else {
            console.error("Subscription error:", err);
        }
    });
});

client.on("error", (err) => {
    console.error("MQTT Error:", err);
    updateConnectionStatus(false);
    showNotification("Connection Error: " + err.message, "error");
});

client.on("reconnect", () => {
    console.log("Reconnecting to MQTT broker...");
    updateConnectionStatus(false);
    const connectionStatus = document.getElementById("connectionStatus");
    if (connectionStatus) {
        connectionStatus.innerHTML = "● RECONNECTING";
        connectionStatus.className = "connection-badge offline";
    }
});

client.on("offline", () => {
    console.log("MQTT client offline");
    updateConnectionStatus(false);
});

// ===== UPDATE CONNECTION STATUS =====
function updateConnectionStatus(isConnected) {
    const statusEl = document.getElementById("connectionStatus");
    if (statusEl) {
        if (isConnected) {
            statusEl.innerHTML = "● ONLINE";
            statusEl.className = "connection-badge online";
        } else {
            statusEl.innerHTML = "● OFFLINE";
            statusEl.className = "connection-badge offline";
        }
    }
}

// ===== UPDATE DEVICE STATUS =====
function updateStatus(id, value) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element ${id} not found`);
        return;
    }

    let status = value.toString().toUpperCase();
    if (status === "1") status = "ON";
    if (status === "0") status = "OFF";
    
    el.innerText = status;
    el.classList.remove("on", "off");
    el.classList.add(status === "ON" ? "on" : "off");
    
    console.log(`Status updated: ${id} = ${status}`);
}

// ===== SHOW NOTIFICATION =====
function showNotification(message, type) {
    let notificationDiv = document.getElementById('floatingNotification');
    if (!notificationDiv) {
        notificationDiv = document.createElement('div');
        notificationDiv.id = 'floatingNotification';
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(notificationDiv);
        
        if (!document.querySelector('#notificationStyles')) {
            const style = document.createElement('style');
            style.id = 'notificationStyles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    if (type === "error") {
        notificationDiv.style.background = 'rgba(239, 68, 68, 0.95)';
        notificationDiv.style.border = '1px solid #ef4444';
        notificationDiv.style.color = 'white';
    } else if (type === "success") {
        notificationDiv.style.background = 'rgba(34, 197, 94, 0.95)';
        notificationDiv.style.border = '1px solid #22c55e';
        notificationDiv.style.color = 'white';
    } else {
        notificationDiv.style.background = 'rgba(245, 158, 11, 0.95)';
        notificationDiv.style.border = '1px solid #f59e0b';
        notificationDiv.style.color = 'white';
    }
    
    notificationDiv.innerHTML = message;
    notificationDiv.style.display = 'block';
    
    setTimeout(() => {
        if (notificationDiv) {
            notificationDiv.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notificationDiv) {
                    notificationDiv.style.display = 'none';
                    notificationDiv.style.animation = '';
                }
            }, 300);
        }
    }, 3000);
}

// ===== MESSAGE HANDLER =====
client.on("message", (topic, message) => {
    const val = message.toString();
    console.log(`Received: ${topic} = ${val}`);
    
    switch(topic) {
        case "inkubator/suhu":
            const temp = parseFloat(val);
            if (!isNaN(temp) && chart) {
                const currentTempEl = document.getElementById("currentTemp");
                if (currentTempEl) {
                    currentTempEl.innerText = temp.toFixed(1);
                }
                
                const now = new Date();
                const timeLabel = now.toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                chart.data.labels.push(timeLabel);
                chart.data.datasets[0].data.push(temp);
                
                if (chart.data.labels.length > 30) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }
                
                chart.update();
                
                dataPointCount++;
                const dataPointsEl = document.getElementById("dataPoints");
                if (dataPointsEl) {
                    dataPointsEl.innerHTML = dataPointCount;
                }
            }
            break;
            
        case "inkubator/lampu":
            updateStatus("lampu", val);
            break;
            
        case "inkubator/kipas":
            updateStatus("kipas", val);
            break;
            
        case "inkubator/low":
            const lowEl = document.getElementById("lowVal");
            if (lowEl) {
                const numVal = parseFloat(val).toFixed(1);
                lowEl.innerText = numVal;
                showNotification(`Setpoint LOW updated to ${numVal}°C`, "success");
            }
            break;
            
        case "inkubator/high":
            const highEl = document.getElementById("highVal");
            if (highEl) {
                const numVal = parseFloat(val).toFixed(1);
                highEl.innerText = numVal;
                showNotification(`Setpoint HIGH updated to ${numVal}°C`, "success");
            }
            break;
            
        case "inkubator/mode":
            updateModeUI(val);
            break;
            
        default:
            console.log("Unknown topic:", topic);
    }
});

// ===== SEND COMMANDS =====
function kirimLow() {
    const inputEl = document.getElementById("setLow");
    if (!inputEl) return;
    
    const v = inputEl.value;
    if (!v || isNaN(v)) {
        showNotification("Please enter a valid temperature value", "error");
        return;
    }
    
    if (client.connected) {
        client.publish("inkubator/set/low", v.toString(), (err) => {
            if (err) {
                showNotification("Failed to send LOW setpoint", "error");
                console.error("Publish error:", err);
            } else {
                showNotification(`Sending LOW setpoint: ${v}°C`, "success");
                inputEl.value = "";
            }
        });
    } else {
        showNotification("MQTT not connected", "error");
    }
}

function kirimHigh() {
    const inputEl = document.getElementById("setHigh");
    if (!inputEl) return;
    
    const v = inputEl.value;
    if (!v || isNaN(v)) {
        showNotification("Please enter a valid temperature value", "error");
        return;
    }
    
    if (client.connected) {
        client.publish("inkubator/set/high", v.toString(), (err) => {
            if (err) {
                showNotification("Failed to send HIGH setpoint", "error");
                console.error("Publish error:", err);
            } else {
                showNotification(`Sending HIGH setpoint: ${v}°C`, "success");
                inputEl.value = "";
            }
        });
    } else {
        showNotification("MQTT not connected", "error");
    }
}

// ===== RESET CHART =====
function resetChart() {
    if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();
        dataPointCount = 0;
        const dataPointsEl = document.getElementById("dataPoints");
        if (dataPointsEl) {
            dataPointsEl.innerHTML = "0";
        }
        showNotification("Chart data reset", "success");
        console.log("Chart reset");
    }
}

console.log("Dashboard JavaScript loaded");
