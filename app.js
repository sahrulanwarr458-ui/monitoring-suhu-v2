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
let currentMode = "AUTO";
let esp32Online = false;
let heartbeatTimeout;
let lastMessageTime = null;
let isUpdatingUI = false; // Flag to prevent UI update loops

// ===== WAIT FOR DOM TO LOAD =====
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing dashboard...");
    
    setTimeout(() => {
        initChart();
    }, 100);
    
    updateTime();
    setInterval(updateTime, 1000);
    
    const clientIdEl = document.getElementById("clientId");
    if (clientIdEl) {
        clientIdEl.innerHTML = options.clientId;
    }
    
    // Mode buttons
    const autoBtn = document.getElementById("autoModeBtn");
    const manualBtn = document.getElementById("manualModeBtn");
    
    if (autoBtn) {
        autoBtn.addEventListener("click", () => {
            if (!isUpdatingUI) {
                setMode("AUTO");
            }
        });
    }
    if (manualBtn) {
        manualBtn.addEventListener("click", () => {
            if (!isUpdatingUI) {
                setMode("MANUAL");
            }
        });
    }
    
    // Manual control buttons
    const lampOnBtn = document.getElementById("lampOnBtn");
    const lampOffBtn = document.getElementById("lampOffBtn");
    const motorOnBtn = document.getElementById("motorOnBtn");
    const motorOffBtn = document.getElementById("motorOffBtn");
    
    if (lampOnBtn) lampOnBtn.addEventListener("click", () => sendManualCommand("lamp", "ON"));
    if (lampOffBtn) lampOffBtn.addEventListener("click", () => sendManualCommand("lamp", "OFF"));
    if (motorOnBtn) motorOnBtn.addEventListener("click", () => sendManualCommand("motor", "ON"));
    if (motorOffBtn) motorOffBtn.addEventListener("click", () => sendManualCommand("motor", "OFF"));
    
    setInterval(() => {
        updateLastMessageDisplay();
    }, 1000);
    
    // Request initial status
    setTimeout(() => {
        if (client.connected) {
            client.publish("inkubator/request_status", "request");
        }
    }, 2000);
});

// ===== UPDATE LAST MESSAGE DISPLAY =====
function updateLastMessageDisplay() {
    const lastMessageEl = document.getElementById("lastMessageTime");
    if (lastMessageEl && lastMessageTime) {
        const now = new Date();
        const diff = Math.floor((now - lastMessageTime) / 1000);
        if (diff < 60) {
            lastMessageEl.innerHTML = `${diff} detik yang lalu`;
        } else if (diff < 3600) {
            lastMessageEl.innerHTML = `${Math.floor(diff / 60)} menit yang lalu`;
        } else {
            lastMessageEl.innerHTML = lastMessageTime.toLocaleTimeString('id-ID');
        }
    }
}

// ===== UPDATE ESP32 STATUS =====
function updateESP32Status(online) {
    esp32Online = online;
    const esp32StatusBadge = document.getElementById("esp32Status");
    const esp32StatusText = document.getElementById("esp32StatusText");
    const manualButtons = document.querySelectorAll('.manual-btn');
    const setpointButtons = document.querySelectorAll('.btn-primary');
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    if (esp32StatusBadge) {
        if (online) {
            esp32StatusBadge.innerHTML = "🟢 ESP32 ONLINE";
            esp32StatusBadge.className = "esp32-badge online";
        } else {
            esp32StatusBadge.innerHTML = "🔴 ESP32 OFFLINE";
            esp32StatusBadge.className = "esp32-badge offline";
        }
    }
    
    if (esp32StatusText) {
        if (online) {
            esp32StatusText.innerHTML = "Online";
            esp32StatusText.className = "summary-status online";
        } else {
            esp32StatusText.innerHTML = "Offline";
            esp32StatusText.className = "summary-status offline";
        }
    }
    
    const isConnected = client.connected && online;
    manualButtons.forEach(btn => { btn.disabled = !isConnected; });
    setpointButtons.forEach(btn => { btn.disabled = !isConnected; });
    modeButtons.forEach(btn => { btn.disabled = !isConnected; });
    
    if (!online && client.connected) {
        showOfflineWarning();
    } else {
        hideOfflineWarning();
    }
}

function showOfflineWarning() {
    let warningDiv = document.getElementById('offlineWarning');
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'offlineWarning';
        warningDiv.className = 'offline-overlay';
        warningDiv.innerHTML = '⚠️ ESP32 OFFLINE - Check device connection ⚠️';
        document.body.appendChild(warningDiv);
    }
}

function hideOfflineWarning() {
    const warningDiv = document.getElementById('offlineWarning');
    if (warningDiv) warningDiv.remove();
}

// ===== UPDATE MQTT STATUS =====
function updateMQTTStatus(connected) {
    const mqttStatusBadge = document.getElementById("mqttStatus");
    const mqttStatusText = document.getElementById("mqttStatusText");
    
    if (mqttStatusBadge) {
        if (connected) {
            mqttStatusBadge.innerHTML = "● MQTT ONLINE";
            mqttStatusBadge.className = "connection-badge online";
        } else {
            mqttStatusBadge.innerHTML = "● MQTT OFFLINE";
            mqttStatusBadge.className = "connection-badge offline";
        }
    }
    
    if (mqttStatusText) {
        if (connected) {
            mqttStatusText.innerHTML = "Connected";
            mqttStatusText.className = "summary-status online";
        } else {
            mqttStatusText.innerHTML = "Disconnected";
            mqttStatusText.className = "summary-status offline";
        }
    }
    
    if (!connected) {
        const manualButtons = document.querySelectorAll('.manual-btn');
        const setpointButtons = document.querySelectorAll('.btn-primary');
        const modeButtons = document.querySelectorAll('.mode-btn');
        manualButtons.forEach(btn => btn.disabled = true);
        setpointButtons.forEach(btn => btn.disabled = true);
        modeButtons.forEach(btn => btn.disabled = true);
        updateESP32Status(false);
    }
}

// ===== UPDATE MOTOR TIMER DISPLAY =====
function updateMotorTimerDisplay(seconds, cycleState) {
    const timerEl = document.getElementById("motorTimer");
    const motorStatusText = document.getElementById("motorStatusText");
    const motorCyclePhase = document.getElementById("motorCyclePhase");
    
    if (timerEl && seconds !== undefined) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        timerEl.innerHTML = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (motorCyclePhase && cycleState) {
        if (cycleState === "ON") {
            motorCyclePhase.innerHTML = "ON (Motor Running)";
            motorCyclePhase.className = "cycle-value phase-on";
            if (motorStatusText) motorStatusText.innerHTML = "Motor sedang berjalan";
        } else {
            motorCyclePhase.innerHTML = "OFF (Motor Stopped)";
            motorCyclePhase.className = "cycle-value phase-off";
            if (motorStatusText) motorStatusText.innerHTML = "Motor dalam periode OFF";
        }
    }
    
    // Update progress bar
    if (seconds > 0 && cycleState) {
        const totalDuration = 2 * 60 * 60;
        let progress;
        if (cycleState === "ON") {
            progress = ((totalDuration - seconds) / totalDuration) * 50;
        } else {
            progress = 50 + ((totalDuration - seconds) / totalDuration) * 50;
        }
        const progressBar = document.getElementById("cycleProgressBar");
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
    }
}

// ===== SET MODE =====
function setMode(mode) {
    if (!client.connected || !esp32Online) {
        showNotification("ESP32 tidak terhubung", "error");
        return;
    }
    
    if (client.connected) {
        client.publish("inkubator/mode", mode, (err) => {
            if (err) {
                showNotification("Failed to change mode", "error");
            } else {
                showNotification(`Mode changed to ${mode}`, "success");
            }
        });
    }
}

// ===== UPDATE MODE UI =====
function updateModeUI(mode) {
    if (isUpdatingUI) return;
    isUpdatingUI = true;
    
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
    
    setTimeout(() => {
        isUpdatingUI = false;
    }, 100);
}

// ===== SEND MANUAL COMMAND =====
function sendManualCommand(device, state) {
    if (!client.connected) {
        showNotification("MQTT not connected", "error");
        return;
    }
    
    if (!esp32Online) {
        showNotification("ESP32 is offline", "error");
        return;
    }
    
    if (currentMode !== "MANUAL") {
        showNotification("Please switch to MANUAL mode first", "error");
        return;
    }
    
    const topic = `inkubator/manual/${device}`;
    client.publish(topic, state, (err) => {
        if (err) {
            showNotification(`Failed to control ${device}`, "error");
        } else {
            showNotification(`${device.toUpperCase()} turned ${state}`, "success");
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
        data: { labels: [], datasets: [{
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
            pointHoverRadius: 8
        }]},
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#e2e8f0', font: { size: 12, weight: 'bold' } }, position: 'top' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#f59e0b',
                    bodyColor: '#e2e8f0',
                    callbacks: { label: function(context) { return `Temperature: ${context.parsed.y.toFixed(1)}°C`; } }
                }
            },
            scales: {
                y: { min: 25, max: 52, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#e2e8f0', stepSize: 3, callback: function(value) { return value + '°C'; } } },
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#e2e8f0', maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 8 } }
            }
        }
    });
}

// ===== TIME UPDATE =====
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.innerHTML = `${dateString}<br><span style="font-size: 14px; color: #a0aec0;">${timeString}</span>`;
    }
}

// ===== MQTT CONNECTION HANDLER =====
client.on("connect", () => {
    console.log("Connected to MQTT broker");
    updateMQTTStatus(true);
    
    client.subscribe("inkubator/#", (err) => {
        if (!err) console.log("Subscribed to inkubator/#");
    });
    
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => { updateESP32Status(false); }, 15000);
    
    // Request initial status
    setTimeout(() => {
        client.publish("inkubator/request_status", "request");
    }, 1000);
});

client.on("error", (err) => {
    console.error("MQTT Error:", err);
    updateMQTTStatus(false);
    updateESP32Status(false);
});

client.on("reconnect", () => {
    console.log("Reconnecting...");
    updateMQTTStatus(false);
    updateESP32Status(false);
});

client.on("offline", () => {
    console.log("MQTT offline");
    updateMQTTStatus(false);
    updateESP32Status(false);
});

// ===== UPDATE STATUS =====
function updateStatus(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let status = value.toString().toUpperCase();
    if (status === "1") status = "ON";
    if (status === "0") status = "OFF";
    
    if (el.innerText !== status) {
        el.innerText = status;
        el.classList.remove("on", "off");
        el.classList.add(status === "ON" ? "on" : "off");
    }
}

// ===== SHOW NOTIFICATION =====
function showNotification(message, type) {
    let notificationDiv = document.getElementById('floatingNotification');
    if (!notificationDiv) {
        notificationDiv = document.createElement('div');
        notificationDiv.id = 'floatingNotification';
        notificationDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; padding: 12px 20px;
            border-radius: 12px; font-size: 14px; font-weight: 600;
            z-index: 10000; animation: slideIn 0.3s ease-out;
            backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(notificationDiv);
    }
    
    if (type === "error") {
        notificationDiv.style.background = 'rgba(239, 68, 68, 0.95)';
        notificationDiv.style.border = '1px solid #ef4444';
    } else if (type === "success") {
        notificationDiv.style.background = 'rgba(34, 197, 94, 0.95)';
        notificationDiv.style.border = '1px solid #22c55e';
    } else {
        notificationDiv.style.background = 'rgba(245, 158, 11, 0.95)';
        notificationDiv.style.border = '1px solid #f59e0b';
    }
    notificationDiv.style.color = 'white';
    notificationDiv.innerHTML = message;
    notificationDiv.style.display = 'block';
    
    setTimeout(() => {
        if (notificationDiv) {
            notificationDiv.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notificationDiv) notificationDiv.style.display = 'none';
            }, 300);
        }
    }, 3000);
}

// ===== MESSAGE HANDLER =====
client.on("message", (topic, message) => {
    const val = message.toString();
    console.log(`Received: ${topic} = ${val}`);
    
    lastMessageTime = new Date();
    
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
        if (esp32Online) updateESP32Status(false);
    }, 15000);
    
    switch(topic) {
        case "inkubator/suhu":
            const temp = parseFloat(val);
            if (!isNaN(temp) && chart) {
                document.getElementById("currentTemp").innerText = temp.toFixed(1);
                const now = new Date();
                const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                chart.data.labels.push(timeLabel);
                chart.data.datasets[0].data.push(temp);
                if (chart.data.labels.length > 30) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }
                chart.update();
                document.getElementById("dataPoints").innerHTML = ++dataPointCount;
            }
            break;
            
        case "inkubator/heartbeat":
            updateESP32Status(true);
            const uptimeSec = parseInt(val);
            if (!isNaN(uptimeSec)) {
                const hours = Math.floor(uptimeSec / 3600);
                const minutes = Math.floor((uptimeSec % 3600) / 60);
                document.getElementById("uptime").innerHTML = `${hours}h ${minutes}m`;
            }
            break;
            
        case "inkubator/status":
            updateESP32Status(val === "online");
            break;
            
        case "inkubator/lampu":
            updateStatus("lampu", val);
            break;
            
        case "inkubator/motor":
            updateStatus("motor", val);
            break;
            
        case "inkubator/motor_next":
            updateMotorTimerDisplay(parseInt(val), document.getElementById("motorCyclePhase")?.innerText.includes("ON") ? "ON" : "OFF");
            break;
            
        case "inkubator/motor_cycle_state":
            const timerText = document.getElementById("motorTimer")?.innerText;
            let secs = 0;
            if (timerText && timerText !== "Changing phase...") {
                const parts = timerText.split(':');
                if (parts.length === 3) secs = parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseInt(parts[2]);
            }
            updateMotorTimerDisplay(secs, val);
            break;
            
        case "inkubator/low":
            const lowEl = document.getElementById("lowVal");
            if (lowEl && parseFloat(lowEl.innerText) !== parseFloat(val)) {
                lowEl.innerText = parseFloat(val).toFixed(1);
            }
            break;
            
        case "inkubator/high":
            const highEl = document.getElementById("highVal");
            if (highEl && parseFloat(highEl.innerText) !== parseFloat(val)) {
                highEl.innerText = parseFloat(val).toFixed(1);
            }
            break;
            
        case "inkubator/mode":
            if (currentMode !== val) {
                updateModeUI(val);
            }
            break;
    }
});

// ===== SEND COMMANDS =====
function kirimLow() {
    if (!client.connected || !esp32Online) {
        showNotification("ESP32 tidak terhubung", "error");
        return;
    }
    const v = document.getElementById("setLow").value;
    if (!v || isNaN(v)) {
        showNotification("Masukkan nilai suhu yang valid", "error");
        return;
    }
    client.publish("inkubator/set/low", v.toString());
    showNotification(`Mengirim setpoint LOW: ${v}°C`, "success");
    document.getElementById("setLow").value = "";
}

function kirimHigh() {
    if (!client.connected || !esp32Online) {
        showNotification("ESP32 tidak terhubung", "error");
        return;
    }
    const v = document.getElementById("setHigh").value;
    if (!v || isNaN(v)) {
        showNotification("Masukkan nilai suhu yang valid", "error");
        return;
    }
    client.publish("inkubator/set/high", v.toString());
    showNotification(`Mengirim setpoint HIGH: ${v}°C`, "success");
    document.getElementById("setHigh").value = "";
}

function resetChart() {
    if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();
        dataPointCount = 0;
        document.getElementById("dataPoints").innerHTML = "0";
        showNotification("Chart reset", "success");
    }
}
