document.addEventListener('DOMContentLoaded', () => {
    const SCRIPT_URL = "YOUR_GOOGLE_SCRIPT_URL_HERE"; // ใช้ URL เดิมของคุณ

    const mapContainer = document.getElementById('map-container');
    const floorplanImage = document.getElementById('floorplanImage');
    let allData = { config: {}, pins: [] };

    async function fetchFromApi(method, action, body = null) {
        let url = `${SCRIPT_URL}?action=${action}`;
        const options = {
            method: method, redirect: 'follow', muteHttpExceptions: true,
        };
        if (body) {
            options.body = JSON.stringify(body);
            options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        }
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Network response error`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
            return null;
        }
    }

    // =============================
    // ===== ADMIN PAGE LOGIC ======
    // =============================
    if (document.title.includes('Admin')) {
        const pinModal = document.getElementById('pinModal');
        const closeBtn = pinModal.querySelector('.close-btn');
        const savePinButton = document.getElementById('savePinButton');
        const floorplanUrlInput = document.getElementById('floorplanUrlInput');
        const saveFloorplanButton = document.getElementById('saveFloorplanButton');
        let currentPinCoords = null;

        // --- New logic for saving floorplan URL ---
        saveFloorplanButton.addEventListener('click', async () => {
            const url = floorplanUrlInput.value.trim();
            if (!url || !url.startsWith('http')) {
                return alert('กรุณาป้อน URL ของรูปภาพให้ถูกต้อง');
            }
            const result = await fetchFromApi('POST', 'saveConfig', { floorplan_url: url });
            if (result && result.status === 'success') {
                alert('บันทึก URL แผนผังสำเร็จ!');
                floorplanImage.src = url; // Update image immediately
            }
        });

        mapContainer.addEventListener('click', (e) => {
            if (e.target.id !== 'floorplanImage' || !floorplanImage.src) return;
            const rect = mapContainer.getBoundingClientRect();
            currentPinCoords = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
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
            const result = await fetchFromApi('POST', 'addPin', newPin);
            if (result && result.status === 'success') {
                alert('บันทึกหมุดสำเร็จ!');
                pinModal.style.display = 'none';
                loadData();
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
        let currentCheckingPinId = null;

        window.openInspectionModal = (pinId) => {
            currentCheckingPinId = pinId;
            document.getElementById('formPinId').textContent = pinId;
            inspectionModal.style.display = 'flex';
            document.getElementById('inspectionResult').innerHTML = '';
            inspectionForm.reset();
        };

        inspectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inspectorName = document.getElementById('inspectorName').value;
            if (!inspectorName) return alert('กรุณาเลือกผู้ตรวจสอบ');
            let isOk = !Array.from(new FormData(inspectionForm).values()).includes('fail');
            const inspectionData = { pinId: currentCheckingPinId, status: isOk ? 'Pass' : 'Fail', inspector: inspectorName };
            const result = await fetchFromApi('POST', 'addInspection', inspectionData);
            if (result && result.status === 'success') {
                document.getElementById('inspectionResult').textContent = `บันทึกผลสำเร็จ: ${inspectionData.status}`;
                setTimeout(() => { inspectionModal.style.display = 'none'; loadData(); }, 1500);
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
        allData.pins.forEach(pin => {
            const last = pin.inspections.length > 0 ? pin.inspections[pin.inspections.length - 1] : null;
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${pin.id}</td><td>${pin.location}</td><td>${pin.department}</td>
                <td class="status-cell-${(last?.status || 'N/A').toLowerCase()}">${last?.status || 'ยังไม่ตรวจ'}</td>
                <td>${last?.timestamp || '-'}</td><td>${last?.inspector || '-'}</td>`;
        });
    }

    function renderHistory() {
        const tableBody = document.querySelector('#historyTable tbody');
        if (!tableBody) return;
        const allInspections = allData.pins.flatMap(pin => pin.inspections.map(insp => ({ ...insp, pinId: pin.id, pinLocation: pin.location })));
        allInspections.sort((a, b) => new Date(b.timestamp.split(', ')[0].split('/').reverse().join('-') + 'T' + b.timestamp.split(', ')[1]) - new Date(a.timestamp.split(', ')[0].split('/').reverse().join('-') + 'T' + a.timestamp.split(', ')[1]));
        tableBody.innerHTML = '';
        allInspections.forEach(insp => {
            const row = tableBody.insertRow();
            row.innerHTML = `<td>${insp.timestamp}</td><td>${insp.pinId}</td><td>${insp.pinLocation}</td>
                <td class="status-cell-${insp.status.toLowerCase()}">${insp.status}</td><td>${insp.inspector}</td>`;
        });
    }

    // =====================================
    // ===== SHARED: LOAD & RENDER DATA ====
    // =====================================
    async function loadData() {
        console.log("กำลังโหลดข้อมูล...");
        const data = await fetchFromApi('GET', 'getData');
        if (!data) return;
        allData = data;

        if (floorplanImage && allData.config.floorplan_url) {
            floorplanImage.src = allData.config.floorplan_url;
        }
        if (document.getElementById('floorplanUrlInput')) {
            document.getElementById('floorplanUrlInput').value = allData.config.floorplan_url || '';
        }

        if (mapContainer) {
            mapContainer.querySelectorAll('.pin').forEach(p => p.remove());
            allData.pins.forEach(pin => {
                const pinElement = document.createElement('div');
                pinElement.className = 'pin';
                pinElement.style.left = `${pin.coords.x}%`;
                pinElement.style.top = `${pin.coords.y}%`;
                const last = pin.inspections.length > 0 ? pin.inspections[pin.inspections.length - 1] : null;
                if (last) pinElement.classList.add(last.status === 'Pass' ? 'status-ok' : 'status-fail');
                if (document.title.includes('Inspector')) pinElement.onclick = () => window.openInspectionModal(pin.id);
                mapContainer.appendChild(pinElement);
            });
        }
        renderDashboard();
        renderHistory();
        console.log("โหลดข้อมูลเรียบร้อย");
    }

    loadData();
});
