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
                    document.getElementById('btn-new-route').classList.remove('hidden');
                    await this.loadCheckpoints(facilityId);
                    await this.loadRoutes(facilityId);
                } else {
                    document.getElementById('btn-new-checkpoint').classList.add('hidden');
                    document.getElementById('btn-new-route').classList.add('hidden');
                    document.getElementById('checkpoints-list').innerHTML = '<p>Selecciona una instalación para ver sus puntos.</p>';
                    document.getElementById('routes-list').innerHTML = '<p>Selecciona una instalación para ver sus rondas.</p>';
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

        document.getElementById('btn-new-route')?.addEventListener('click', () => {
            document.getElementById('modal-route').style.display = 'flex';
        });

        document.getElementById('form-route')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const facilityId = document.getElementById('select-facility').value;
            const name = document.getElementById('route-name').value;
            const time = document.getElementById('route-time').value;
            
            // Get checked checkpoints in order (this is a simplified logic, in real life we might want drag&drop for ordering)
            const checkboxes = document.querySelectorAll('input[name="route-checkpoint"]:checked');
            const points = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (points.length === 0) {
                alert("Debes seleccionar al menos un punto para la ronda.");
                return;
            }

            try {
                // En Supabase, para rutas, insertamos la ruta, luego obtenemos el ID y luego insertamos los puntos
                const [routeData] = await ApiService.insert('routes', {
                    facility_id: facilityId,
                    name: name,
                    schedule_time: time
                });
                
                const routeId = routeData.id;
                
                const routePointsPayload = points.map((checkpointId, index) => ({
                    route_id: routeId,
                    checkpoint_id: checkpointId,
                    sequence_order: index + 1
                }));
                
                // Inserta los puntos en lote
                if (supabaseClient) {
                    await supabaseClient.from('route_points').insert(routePointsPayload);
                }

                document.getElementById('modal-route').style.display = 'none';
                document.getElementById('form-route').reset();
                await this.loadRoutes(facilityId);
            } catch (err) {
                alert('Error al crear ruta: ' + err.message);
            }
        });
    }

    static async loadFacilities(companyId) {
        try {
            // Nota: Aquí quitamos los parámetros custom y usamos el fetch genérico
            const facilities = await ApiService.fetch('facilities', { company_id: companyId });
            
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
            await ApiService.insert('facilities', { company_id: companyId, name: name });
            await this.loadFacilities(companyId);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    static async loadCheckpoints(facilityId) {
        const listEl = document.getElementById('checkpoints-list');
        listEl.innerHTML = '<p>Cargando puntos...</p>';
        
        try {
            const checkpoints = await ApiService.fetch('checkpoints', { facility_id: facilityId });
            
            // Update Checkpoints view
            if (checkpoints.length === 0) {
                listEl.innerHTML = '<p>No hay puntos configurados.</p>';
                document.getElementById('route-checkpoints-selection').innerHTML = '<p>Crea puntos primero.</p>';
                return;
            }

            listEl.innerHTML = '';
            let checkboxHtml = '';
            
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

                // Add to modal selection list
                checkboxHtml += `
                    <label style="display: block; margin-bottom: var(--space-2); cursor: pointer;">
                        <input type="checkbox" name="route-checkpoint" value="${cp.id}">
                        ${cp.name}
                    </label>
                `;
            });
            
            document.getElementById('route-checkpoints-selection').innerHTML = checkboxHtml;

        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<p>Error al cargar puntos.</p>';
        }
    }

    static async createCheckpoint(facilityId, name) {
        try {
            const unique_code = Math.random().toString(36).substring(2, 15);
            await ApiService.insert('checkpoints', { facility_id: facilityId, name: name, unique_code: unique_code });
            await this.loadCheckpoints(facilityId);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    static async loadRoutes(facilityId) {
        const listEl = document.getElementById('routes-list');
        listEl.innerHTML = '<p>Cargando rondas...</p>';
        
        try {
            const routes = await ApiService.fetch('routes', { facility_id: facilityId });
            
            // Para demo: como no hay JOIN automático sin sintaxis compleja en Supabase-JS básico
            // iteramos sobre las rutas para cargar los nombres de los puntos.
            for (let r of routes) {
                if(supabaseClient) {
                    const { data: routePoints } = await supabaseClient
                        .from('route_points')
                        .select('sequence_order, checkpoints(name)')
                        .eq('route_id', r.id)
                        .order('sequence_order', { ascending: true });
                    
                    r.points = routePoints ? routePoints.map(rp => ({name: rp.checkpoints.name})) : [];
                } else {
                    r.points = [];
                }
            }

            if (routes.length === 0) {
                listEl.innerHTML = '<p>No hay rondas configuradas.</p>';
                return;
            }

            listEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4);">
                    ${routes.map(r => `
                        <div class="glass-surface">
                            <h3 style="margin-bottom: var(--space-2);">${r.name}</h3>
                            <p style="font-size: 0.9rem; margin-bottom: var(--space-2);"><strong>Hora:</strong> ${r.schedule_time}</p>
                            <p style="font-size: 0.9rem; margin-bottom: var(--space-2);"><strong>Puntos (${r.points.length}):</strong></p>
                            <ol style="padding-left: var(--space-4); font-size: 0.85rem;">
                                ${r.points.map(p => `<li>${p.name}</li>`).join('')}
                            </ol>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            console.error(e);
            listEl.innerHTML = '<p>Error al cargar rondas.</p>';
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
