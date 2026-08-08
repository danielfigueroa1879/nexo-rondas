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

        // --- Gestión de Guardias ---
        this.renderGuardsList();
        
        document.getElementById('btn-new-guard')?.addEventListener('click', () => {
            document.getElementById('modal-guard').style.display = 'flex';
        });

        document.getElementById('form-guard')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('guard-name').value;
            const email = document.getElementById('guard-email').value;
            const password = document.getElementById('guard-password').value;
            const facilitySelect = document.getElementById('guard-facility');
            const facilityId = facilitySelect.value;
            const facilityName = facilitySelect.options[facilitySelect.selectedIndex].text;

            const guards = JSON.parse(localStorage.getItem('nexo_guards') || '[]');
            
            // Validar si existe el correo
            if (guards.find(g => g.email === email)) {
                alert("Ya existe un guardia con ese correo.");
                return;
            }

            guards.push({
                id: 'guard-' + Date.now(),
                name: name,
                email: email,
                password: password, // NOTA: Solo para propósitos de la DEMO
                facilityId: facilityId,
                facilityName: facilityName,
                role: 'guard'
            });
            localStorage.setItem('nexo_guards', JSON.stringify(guards));
            
            document.getElementById('modal-guard').style.display = 'none';
            document.getElementById('form-guard').reset();
            this.renderGuardsList();
        });

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
            const facilities = await ApiService.fetch('facilities', { company_id: companyId });
            
            const listEl = document.getElementById('facilities-list');
            const selectEl = document.getElementById('select-facility');
            const guardSelectEl = document.getElementById('guard-facility');

            listEl.innerHTML = '';
            
            if (selectEl) selectEl.innerHTML = '<option value="">Seleccione...</option>';
            if (guardSelectEl) guardSelectEl.innerHTML = '<option value="">Seleccione...</option>';
            
            if (facilities.length === 0) {
                listEl.innerHTML = '<p>No hay instalaciones registradas.</p>';
                return;
            }

            facilities.forEach(f => {
                const div = document.createElement('div');
                div.style.background = 'var(--surface-bg)';
                div.style.padding = 'var(--space-4)';
                div.style.borderRadius = 'var(--radius-sm)';
                div.style.marginBottom = 'var(--space-2)';
                div.style.border = '1px solid var(--surface-border)';
                div.innerHTML = `<strong>${f.name}</strong> <span style="color:var(--text-secondary);font-size:0.8rem;margin-left:10px;">ID: ${f.id}</span>`;
                listEl.appendChild(div);

                if (selectEl) {
                    const opt = document.createElement('option');
                    opt.value = f.id;
                    opt.textContent = f.name;
                    selectEl.appendChild(opt);
                }

                if (guardSelectEl) {
                    const optGuard = document.createElement('option');
                    optGuard.value = f.id;
                    optGuard.textContent = f.name;
                    guardSelectEl.appendChild(optGuard);
                }
            });
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

