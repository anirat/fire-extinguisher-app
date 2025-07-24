document.addEventListener('DOMContentLoaded', () => {
    // !!! วาง URL ของคุณที่คัดลอกมา ที่นี่ !!!
    const SCRIPT_URL = https://script.google.com/macros/s/AKfycbwCvRfDg1XfEwEX3Urc2uvCAE2TVjRw3PfvF-qaVxPSDKz-4BepFE8ldrAio6HpGwIs/exec; 

    // === Global Variables ===
    const mapContainer = document.getElementById('map-container');
    const floorplanImage = document.getElementById('floorplanImage');
    let allPinsData = []; // ตัวแปรสำหรับเก็บข้อมูลทั้งหมดที่โหลดมา

    // ฟังก์ชันสำหรับเรียก API
    async function fetchFromApi(method, action, body = null) {
        let url = `${SCRIPT_URL}?action=${action}`;
        const options = {
            method: method,
            redirect: 'follow', // จำเป็นสำหรับ Apps Script
            muteHttpExceptions: true,
        };
        if (body) {
            options.body = JSON.stringify(body);
            // Apps Script ต้องการ header แบบนี้สำหรับ POST
            options.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; 
        }
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับฐานข้อมูล');
            return null;
        }
    }

    // โหลดข้อมูลแผนผัง (ยังใช้ localStorage ได้เพื่อความง่าย)
    if (floorplanImage) {
        const savedFloorplan = localStorage.getItem('floorplanImage');
        if (savedFloorplan) {
            floorplanImage.src = savedFloorplan;
        }
    }

    // =============================
    // ===== ADMIN PAGE LOGIC ======
    // =============================
    if (document.title.includes('Admin')) {
        const pinModal = document.getElementById('pinModal');
        const closeBtn = pinModal.querySelector('.close-btn');
        const savePinButton = document.getElementById('savePinButton');
        const floorplanUpload = document.getElementById('floorplanUpload');
        let currentPinCoords = null;

        floorplanUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    floorplanImage.src = event.target.result;
                    localStorage.setItem('floorplanImage', event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        mapContainer.addEventListener('click', (e) => {
            if (e.target.id !== 'floorplanImage') return;
            const rect = mapContainer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            currentPinCoords = { x, y };
            pinModal.style.display = 'flex';
            pinModal.querySelectorAll('input, textarea').forEach(el => el.value = '');
        });

        savePinButton.addEventListener('click', async () => {
            const newPin = {
                id: document.getElementById('pinId').value,
                location: document.getElementById('pinLocation').value,
                department: document.getElementById('pinDepartment').value,
                details: document.getElementById('pinDetails').value,
                coords: currentPinCoords
            };
            if (!newPin.id) return alert('กรุณากรอกรหัสถัง');

            savePinButton.textContent = 'กำลังบันทึก...';
            savePinButton.disabled = true;

            const result = await fetchFromApi('POST', 'addPin', newPin);

            savePinButton.textContent = 'บันทึกหมุด';
            savePinButton.disabled = false;

            if (result && result.status === 'success') {
                alert('บันทึกหมุดสำเร็จ!');
                pinModal.style.display = 'none';
                loadData(); // โหลดข้อมูลใหม่
            }
        });
        closeBtn.onclick = () => pinModal.style.display = 'none';
    }

    // =================================
    // ===== INSPECTOR PAGE LOGIC ======
    // =================================
    if (document.title.includes('Inspector')) {
        const inspectionModal = document.getElementById('inspectionModal');
        const closeBtn = inspectionModal.querySelector('.close-btn');
        const inspectionForm = document.getElementById('inspectionForm');
        const inspectorNameSelect = document.getElementById('inspectorName');
        let currentCheckingPinId = null;

        window.openInspectionModal = (pinId) => {
            currentCheckingPinId = pinId;
            document.getElementById('formPinId').textContent = pinId;
            inspectionModal.style.display = 'flex';
            document.getElementById('inspectionResult').innerHTML = '';
            document.getElementById('inspectionResult').className = '';
            inspectionForm.reset();
        };

        inspectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inspectorName = inspectorNameSelect.value;
            if (!inspectorName) return alert('กรุณาเลือกผู้ตรวจสอบ');

            let isOk = true;
            new FormData(inspectionForm).forEach(value => {
                if (value === 'fail') isOk = false;
            });

            const inspectionData = {
                pinId: currentCheckingPinId,
                status: isOk ? 'Pass' : 'Fail',
                inspector: inspectorName
            };

            const submitButton = inspectionForm.querySelector('button');
            submitButton.textContent = 'กำลังบันทึก...';
            submitButton.disabled = true;

            const result = await fetchFromApi('POST', 'addInspection', inspectionData);

            submitButton.textContent = 'บันทึกผลการตรวจ';
            submitButton.disabled = false;

            if (result && result.status === 'success') {
                document.getElementById('inspectionResult').textContent = `บันทึกผลสำเร็จ: ${inspectionData.status}`;
                document.getElementById('inspectionResult').className = isOk ? 'pass' : 'fail';
                setTimeout(() => {
                    inspectionModal.style.display = 'none';
                    loadData(); // โหลดข้อมูลใหม่
                }, 1500);
            }
        });
        closeBtn.onclick = () => inspectionModal.style.display = 'none';
    }

    // =================================
    // ===== DASHBOARD & HISTORY LOGIC =====
    // =================================
    function renderDashboard() {
        const tableBody = document.querySelector('#dashboardTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        allPinsData.forEach(pin => {
            const lastInspection = pin.inspections.length > 0 ? pin.inspections[pin.inspections.length - 1] : null;
            const status = lastInspection ? lastInspection.status : 'ยังไม่ได้ตรวจ';
            const timestamp = lastInspection ? lastInspection.timestamp : '-';
            const inspector = lastInspection ? lastInspection.inspector : '-';
            const statusClass = `status-cell-${status.toLowerCase()}`;
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${pin.id}</td>
                <td>${pin.location}</td>
                <td>${pin.department}</td>
                <td class="${statusClass}">${status}</td>
                <td>${timestamp}</td>
                <td>${inspector}</td>
            `;
        });
    }

    function renderHistory() {
        const tableBody = document.querySelector('#historyTable tbody');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const allInspections = [];
        allPinsData.forEach(pin => {
            pin.inspections.forEach(insp => {
                allInspections.push({ ...insp, pinId: pin.id, pinLocation: pin.location });
            });
        });

        // Sort by date
        allInspections.sort((a, b) => {
            const dateA = new Date(a.timestamp.split(', ')[0].split('/').reverse().join('-') + 'T' + a.timestamp.split(', ')[1]);
            const dateB = new Date(b.timestamp.split(', ')[0].split('/').reverse().join('-') + 'T' + b.timestamp.split(', ')[1]);
            return dateB - dateA;
        });

        allInspections.forEach(inspection => {
            const statusClass = `status-cell-${inspection.status.toLowerCase()}`;
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${inspection.timestamp}</td>
                <td>${inspection.pinId}</td>
                <td>${inspection.pinLocation}</td>
                <td class="${statusClass}">${inspection.status}</td>
                <td>${inspection.inspector}</td>
            `;
        });
    }

    // =====================================
    // ===== SHARED: LOAD & RENDER DATA ====
    // =====================================
    async function loadData() {
        console.log("กำลังโหลดข้อมูลจาก Google Sheets...");
        const data = await fetchFromApi('GET', 'getData');
        if (!data) {
            console.error("ไม่สามารถโหลดข้อมูลได้");
            return;
        };
        allPinsData = data;

        if (mapContainer) {
            mapContainer.querySelectorAll('.pin').forEach(p => p.remove());
            allPinsData.forEach(pin => {
                const pinElement = document.createElement('div');
                pinElement.className = 'pin';
                pinElement.style.left = `${pin.coords.x}%`;
                pinElement.style.top = `${pin.coords.y}%`;
                const lastInspection = pin.inspections.length > 0 ? pin.inspections[pin.inspections.length - 1] : null;
                if (lastInspection) {
                    pinElement.classList.add(lastInspection.status === 'Pass' ? 'status-ok' : 'status-fail');
                }
                if (document.title.includes('Inspector')) {
                    pinElement.title = `คลิกเพื่อตรวจ: ${pin.id}`;
                    pinElement.onclick = () => window.openInspectionModal(pin.id);
                } else {
                    pinElement.title = `รหัส: ${pin.id}\nตำแหน่ง: ${pin.location}`;
                }
                mapContainer.appendChild(pinElement);
            });
        }
        renderDashboard();
        renderHistory();
        console.log("โหลดข้อมูลและแสดงผลเรียบร้อย");
    }

    // Initial load of data on all pages
    loadData();
});