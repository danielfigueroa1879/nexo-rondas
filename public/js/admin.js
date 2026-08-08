// public/js/admin.js
class AdminPanel {
    static async init() {
        const user = Auth.getUser();
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'supervisor')) return;

        // ─── PASO 1: Registrar todos los event listeners PRIMERO (sincrono) ───
        this._setupEventListeners();

        // ─── PASO 2: Cargar datos en segundo plano ───
        this.renderGuardsList();
        try {
            await this.loadFacilities(1);
        } catch(e) {
            console.warn('No se pudieron cargar instalaciones:', e.message);
        }
    }

    static _setupEventListeners() {
        // Evitar doble registro de listeners
        if (this._listenersRegistered) return;
        this._listenersRegistered = true;

        // Selector de instalación
        const facilitySelect = document.getElementById('select-facility');
        if (facilitySelect) {
            facilitySelect.addEventListener('change', async (e) => {
                const facilityId = e.target.value;
                if (facilityId) {
                    document.getElementById('btn-new-checkpoint')?.classList.remove('hidden');
                    document.getElementById('btn-new-route')?.classList.remove('hidden');
                    try { await this.loadCheckpoints(facilityId); } catch(e) {}
                    try { await this.loadRoutes(facilityId); } catch(e) {}
                } else {
                    document.getElementById('btn-new-checkpoint')?.classList.add('hidden');
                    document.getElementById('btn-new-route')?.classList.add('hidden');
                    const cpList = document.getElementById('checkpoints-list');
                    const rtList = document.getElementById('routes-list');
                    if (cpList) cpList.innerHTML = '<p>Selecciona una instalación para ver sus puntos.</p>';
                    if (rtList) rtList.innerHTML = '<p>Selecciona una instalación para ver sus rondas.</p>';
                }
            });
        }

        // Botón: Nuevo Guardia
        document.getElementById('btn-new-guard')?.addEventListener('click', () => {
            const modal = document.getElementById('modal-guard');
            if (modal) modal.style.display = 'flex';
        });

        // Formulario: Guardar Guardia
        document.getElementById('form-guard')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('guard-name').value.trim();
            const email = document.getElementById('guard-email').value.trim();
            const password = document.getElementById('guard-password').value.trim();
            const facilitySelectEl = document.getElementById('guard-facility');
            const facilityId = facilitySelectEl ? facilitySelectEl.value : '';
            const facilityName = facilitySelectEl ? facilitySelectEl.options[facilitySelectEl.selectedIndex]?.text : '';

            if (!name || !email || !password) {
                alert('Por favor completa todos los campos.');
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

            try {
                // 1. Guardar en Supabase (para acceso desde cualquier dispositivo)
                if (supabaseClient) {
                    // Verificar si ya existe en Supabase
                    const { data: existing } = await supabaseClient
                        .from('guards')
                        .select('id')
                        .eq('email', email)
                        .maybeSingle();

                    if (existing) {
                        alert('Ya existe un guardia con ese correo.');
                        return;
                    }

                    const { error } = await supabaseClient.from('guards').insert([{
                        name, email, password,
                        facility_id: facilityId || null,
                        facility_name: facilityName || null,
                        role: 'guard'
                    }]);

                    if (error) throw error;
                }

                // 2. También guardar en localStorage como cache local
                const guards = JSON.parse(localStorage.getItem('nexo_guards') || '[]');
                if (!guards.find(g => g.email === email)) {
                    guards.push({
                        id: 'guard-' + Date.now(),
                        name, email, password,
                        facilityId, facilityName,
                        role: 'guard'
                    });
                    localStorage.setItem('nexo_guards', JSON.stringify(guards));
                }

                const modal = document.getElementById('modal-guard');
                if (modal) modal.style.display = 'none';
                e.target.reset();
                this.renderGuardsList();
                alert(`✅ Guardia "${name}" registrado. Ya puede ingresar con:\nEmail: ${email}\nContraseña: ${password}`);

            } catch (err) {
                console.error(err);
                alert('Error al registrar guardia: ' + (err.message || err));
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar Guardia'; }
            }
        });

        // Botón: Nueva Instalación
        document.getElementById('btn-new-facility')?.addEventListener('click', () => {
            const name = prompt('Nombre de la nueva instalación:');
            if (name && name.trim()) {
                this.createFacility(1, name.trim());
            }
        });

        // Botón: Nuevo Punto de Control
        document.getElementById('btn-new-checkpoint')?.addEventListener('click', () => {
            const facilityId = document.getElementById('select-facility')?.value;
            if (!facilityId) {
                alert('Selecciona primero una instalación.');
                return;
            }
            const name = prompt('Nombre del nuevo punto de control (ej: Entrada Principal):');
            if (name && name.trim()) {
                this.createCheckpoint(facilityId, name.trim());
            }
        });

        // Botón: Nueva Ronda
        document.getElementById('btn-new-route')?.addEventListener('click', () => {
            const facilityId = document.getElementById('select-facility')?.value;
            if (!facilityId) {
                alert('Selecciona primero una instalación.');
                return;
            }
            const modal = document.getElementById('modal-route');
            if (modal) modal.style.display = 'flex';
        });

        // Formulario: Guardar Ronda
        document.getElementById('form-route')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const facilityId = document.getElementById('select-facility')?.value;
            const name = document.getElementById('route-name').value.trim();
            const time = document.getElementById('route-time').value;

            const checkboxes = document.querySelectorAll('input[name="route-checkpoint"]:checked');
            const points = Array.from(checkboxes).map(cb => parseInt(cb.value));

            if (points.length === 0) {
                alert('Debes seleccionar al menos un punto para la ronda.');
                return;
            }

            try {
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

                if (supabaseClient) {
                    await supabaseClient.from('route_points').insert(routePointsPayload);
                }

                const modal = document.getElementById('modal-route');
                if (modal) modal.style.display = 'none';
                document.getElementById('form-route').reset();
                await this.loadRoutes(facilityId);
            } catch (err) {
                alert('Error al crear ronda: ' + err.message);
            }
        });

        // Cerrar modales con botón Cancelar
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.getAttribute('data-close-modal');
                const modal = document.getElementById(modalId);
                if (modal) modal.style.display = 'none';
            });
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
    static renderGuardsList() {
        const listEl = document.getElementById('guards-list');
        if (!listEl) return;

        const guards = JSON.parse(localStorage.getItem('nexo_guards') || '[]');

        if (guards.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: var(--space-4);">No hay guardias registrados. Presiona "+ Registrar Nuevo Guardia" para agregar uno.</p>';
            return;
        }

        listEl.innerHTML = guards.map(g => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-bg); border:1px solid var(--surface-border); border-radius:var(--radius-sm); padding:var(--space-3); margin-bottom:var(--space-2);">
                <div>
                    <strong style="display:block; font-size:1rem;">${g.name}</strong>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${g.email}</span>
                    ${g.facilityName ? `<span style="font-size:0.75rem; color:var(--primary-color); display:block; margin-top:2px;">📍 ${g.facilityName}</span>` : ''}
                </div>
                <button onclick="AdminPanel.deleteGuard('${g.id}')" style="background:var(--danger-color); color:white; border:none; border-radius:var(--radius-sm); padding:6px 12px; cursor:pointer; font-size:0.8rem;">Eliminar</button>
            </div>
        `).join('');
    }

    static deleteGuard(guardId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este guardia?')) return;
        let guards = JSON.parse(localStorage.getItem('nexo_guards') || '[]');
        guards = guards.filter(g => g.id !== guardId);
        localStorage.setItem('nexo_guards', JSON.stringify(guards));
        this.renderGuardsList();
    }
}

