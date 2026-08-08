// public/js/admin.js
class AdminPanel {
    static async init() {
        const user = Auth.getUser();
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'supervisor')) return;

        // Simplified for demo: assume company ID 1 exists or we create it.
        // In a real flow, we'd list companies first.
        
        await this.loadFacilities(1); // Hardcoded to company 1 for demo purposes
        
        const facilitySelect = document.getElementById('select-facility');
        if (facilitySelect) {
            facilitySelect.addEventListener('change', async (e) => {
                const facilityId = e.target.value;
                if (facilityId) {
                    document.getElementById('btn-new-checkpoint').classList.remove('hidden');
                    await this.loadCheckpoints(facilityId);
                } else {
                    document.getElementById('btn-new-checkpoint').classList.add('hidden');
                    document.getElementById('checkpoints-list').innerHTML = '<p>Selecciona una instalación para ver sus puntos.</p>';
                }
            });
        }

        document.getElementById('btn-new-facility')?.addEventListener('click', () => {
            const name = prompt("Nombre de la nueva instalación:");
            if (name) {
                this.createFacility(1, name);
            }
        });

        document.getElementById('btn-new-checkpoint')?.addEventListener('click', () => {
            const facilityId = document.getElementById('select-facility').value;
            const name = prompt("Nombre del nuevo punto de control (ej: Entrada Principal):");
            if (name && facilityId) {
                this.createCheckpoint(facilityId, name);
            }
        });
    }

    static async loadFacilities(companyId) {
        try {
            const facilities = await ApiService.request(`/admin/facilities?company_id=${companyId}`);
            
            // Populate list
            const listEl = document.getElementById('facilities-list');
            if (facilities.length === 0) {
                listEl.innerHTML = '<p>No hay instalaciones. Crea una para comenzar.</p>';
            } else {
                listEl.innerHTML = `
                    <ul style="list-style:none; padding:0;">
                        ${facilities.map(f => `
                            <li style="padding: var(--space-3); border-bottom: 1px solid var(--surface-border);">
                                <strong>${f.name}</strong>
                            </li>
                        `).join('')}
                    </ul>
                `;
            }

            // Populate select
            const selectEl = document.getElementById('select-facility');
            if (selectEl) {
                selectEl.innerHTML = '<option value="">Seleccione...</option>';
                facilities.forEach(f => {
                    selectEl.innerHTML += `<option value="${f.id}">${f.name}</option>`;
                });
            }

        } catch (e) {
            console.error(e);
        }
    }

    static async createFacility(companyId, name) {
        try {
            await ApiService.request('/admin/facilities', 'POST', { company_id: companyId, name });
            await this.loadFacilities(companyId);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    static async loadCheckpoints(facilityId) {
        const listEl = document.getElementById('checkpoints-list');
        listEl.innerHTML = '<p>Cargando puntos...</p>';
        
        try {
            const checkpoints = await ApiService.request(`/admin/checkpoints?facility_id=${facilityId}`);
            
            if (checkpoints.length === 0) {
                listEl.innerHTML = '<p>No hay puntos configurados.</p>';
                return;
            }

            listEl.innerHTML = '';
            checkpoints.forEach(cp => {
                const card = document.createElement('div');
                card.className = 'glass-surface text-center';
                card.style.padding = 'var(--space-4)';
                
                card.innerHTML = `
                    <h3 style="margin-bottom: var(--space-2); font-size: 1.1rem;">${cp.name}</h3>
                    <p style="font-size: 0.8rem; margin-bottom: var(--space-4);">ID: ${cp.unique_code}</p>
                    <div id="qr-${cp.id}" style="display:flex; justify-content:center; background:white; padding:10px; border-radius:8px; margin: 0 auto; width: fit-content;"></div>
                    <button class="btn btn-primary btn-block mt-4" onclick="window.print()">Imprimir QR</button>
                `;
                listEl.appendChild(card);

                // Generate QR Code
                new QRCode(document.getElementById(`qr-${cp.id}`), {
                    text: cp.unique_code,
                    width: 128,
                    height: 128,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            });

        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<p>Error al cargar puntos.</p>';
        }
    }

    static async createCheckpoint(facilityId, name) {
        try {
            await ApiService.request('/admin/checkpoints', 'POST', { facility_id: facilityId, name });
            await this.loadCheckpoints(facilityId);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }
}

// Ensure AdminPanel initiates when dashboard is shown
document.addEventListener('DOMContentLoaded', () => {
    // We observe changes to the view-dashboard class or just call it after a slight delay
    // For simplicity, we just hook into the global scope.
    if (Auth.isAuthenticated() && Auth.getUser().role !== 'guard') {
        AdminPanel.init();
    }
});
