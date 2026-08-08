// public/js/guard.js

class GuardApp {
    static activeRoute = null;
    static currentSequenceIndex = 0;
    static html5QrcodeScanner = null;
    static activeRoundExecutionId = null;
    static completedRouteIds = [];
    static trafficTimer = null;
    static roundStartTime = null;
    static isProcessingScan = false;

    static async init() {
        // Cargar rutas completadas de localStorage
        const savedCompleted = localStorage.getItem('nexo_completed_routes');
        if (savedCompleted) {
            try { this.completedRouteIds = JSON.parse(savedCompleted); } catch(e) {}
        }

        const user = Auth.getUser();
        if (!user || user.role !== 'guard') return;

        document.getElementById('guard-user-name').textContent = user.name || user.email;
        
        const facilityNameHeader = document.getElementById('guard-facility-name-header');
        if (facilityNameHeader) {
            facilityNameHeader.textContent = user.facilityName || 'Mis Rondas';
        }

        // Mostrar vista inicial
        document.getElementById('view-guard').style.display = 'flex';
        
        await this.checkAssignedRounds();

        // Configurar incidentes
        document.getElementById('btn-report-incident')?.addEventListener('click', () => {
            document.getElementById('modal-incident').classList.add('open');
            document.getElementById('incident-overlay').classList.add('open');
        });

        document.getElementById('btn-close-incident')?.addEventListener('click', () => {
            document.getElementById('modal-incident').classList.remove('open');
            document.getElementById('incident-overlay').classList.remove('open');
        });

        document.getElementById('incident-overlay')?.addEventListener('click', () => {
            document.getElementById('modal-incident').classList.remove('open');
            document.getElementById('incident-overlay').classList.remove('open');
        });

        document.getElementById('btn-continue-scan')?.addEventListener('click', () => {
            document.getElementById('between-points-info').style.display = 'none';
            document.getElementById('scanner-container').style.display = 'block';
            
            document.getElementById('btn-continue-scan').style.display = 'none';
            document.getElementById('btn-start-scan-first').style.display = 'none';
            document.getElementById('btn-cancel-scan').style.display = 'block';

            this.updateUIForNextPoint();
            this.initScanner();
        });

        document.getElementById('btn-start-scan-first')?.addEventListener('click', () => {
            document.getElementById('pre-scan-info').style.display = 'none';
            document.getElementById('scanner-container').style.display = 'block';
            
            document.getElementById('btn-continue-scan').style.display = 'none';
            document.getElementById('btn-start-scan-first').style.display = 'none';
            document.getElementById('btn-cancel-scan').style.display = 'block';

            this.updateUIForNextPoint();
            this.initScanner();
        });

        document.getElementById('btn-cancel-scan')?.addEventListener('click', () => {
            if (this.html5QrcodeScanner) {
                try { this.html5QrcodeScanner.clear(); } catch(e) {}
            }
            document.getElementById('scanner-container').style.display = 'none';
            document.getElementById('btn-cancel-scan').style.display = 'none';
            
            if (this.currentSequenceIndex === 0) {
                document.getElementById('pre-scan-info').style.display = 'block';
                document.getElementById('btn-start-scan-first').style.display = 'flex';
            } else {
                document.getElementById('between-points-info').style.display = 'block';
                document.getElementById('btn-continue-scan').style.display = 'flex';
            }
        });

        document.getElementById('form-incident')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.reportIncident();
        });
    }

    static allAssignedRoutes = [];

    static async checkAssignedRounds() {
        if (!supabaseClient) {
            this.showNoRounds();
            return;
        }

        try {
            document.getElementById('guard-status-text').textContent = "Buscando rondas asignadas...";
            
            // Lógica simplificada: obtener todas las rutas.
            const routes = await ApiService.fetch('routes');
            
            if (routes && routes.length > 0) {
                this.allAssignedRoutes = routes;
                this.renderRoundsMenu();
            } else {
                this.showNoRounds();
            }

        } catch (e) {
            console.error("Error al obtener rondas", e);
            this.showNoRounds();
        }
    }

    static renderRoundsMenu() {
        document.getElementById('no-rounds-info').style.display = 'none';
        document.getElementById('active-round-info').style.display = 'none';
        document.getElementById('guard-bottom-nav').style.display = 'none';
        document.getElementById('guard-progress-container').style.display = 'none';
        document.getElementById('rounds-menu-container').style.display = 'block';

        const listContainer = document.getElementById('rounds-list');
        listContainer.innerHTML = '';

        this.allAssignedRoutes.forEach((route, index) => {
            const isCompleted = this.completedRouteIds.includes(route.id);
            const isActive = (this.activeRoute && this.activeRoute.id === route.id);
            
            let status = 'pending';
            if (isCompleted) status = 'completed';
            else if (isActive) {
                const elapsed = Date.now() - this.roundStartTime;
                if (elapsed > 60 * 60 * 1000) status = 'overdue';
                else status = 'in_progress';
            }

            // Hora de vencimiento simulada: la hora actual + (index+1) horas.
            const expirationTime = new Date();
            expirationTime.setHours(expirationTime.getHours() + (index + 1));
            const timeStr = expirationTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const btn = document.createElement('button');
            btn.className = 'round-btn';
            
            let statusText = '';
            if (status === 'pending') {
                btn.classList.add('traffic-red');
                statusText = `Pendiente - Vence ${timeStr}`;
            } else if (status === 'in_progress') {
                btn.classList.add('traffic-yellow');
                statusText = `En Curso`;
            } else if (status === 'overdue') {
                btn.classList.add('traffic-red');
                statusText = `Atrasada - Venció ${timeStr}`;
            } else if (status === 'completed') {
                btn.classList.add('traffic-green');
                statusText = `Completada`;
                btn.style.cursor = 'default';
            }

            btn.innerHTML = `
                <span>${route.name}</span>
                <span class="traffic-status">${statusText}</span>
            `;

            btn.onclick = () => {
                if (!isCompleted) this.selectRoute(route);
            };

            listContainer.appendChild(btn);
        });
    }

    static async selectRoute(route) {
        try {
            this.activeRoute = route;
            
            // Obtener los puntos de la ruta en orden estricto
            const { data: routePoints } = await supabaseClient
                .from('route_points')
                .select('sequence_order, checkpoints(id, name, unique_code)')
                .eq('route_id', this.activeRoute.id)
                .order('sequence_order', { ascending: true });

            this.activeRoute.points = routePoints || [];
            
            if (this.activeRoute.points.length > 0) {
                document.getElementById('rounds-menu-container').style.display = 'none';
                document.getElementById('active-round-info').style.display = 'flex';
                document.getElementById('guard-bottom-nav').style.display = 'flex';
                document.getElementById('guard-progress-container').style.display = 'block';
                
                document.getElementById('scanner-container').style.display = 'none';
                document.getElementById('between-points-info').style.display = 'none';
                document.getElementById('pre-scan-info').style.display = 'block';
                
                document.getElementById('btn-cancel-scan').style.display = 'none';
                document.getElementById('btn-continue-scan').style.display = 'none';
                document.getElementById('btn-start-scan-first').style.display = 'flex';
                
                const nameDisplay = document.getElementById('active-round-name-display');
                if (nameDisplay) {
                    nameDisplay.textContent = this.activeRoute.name;
                }
                
                this.currentSequenceIndex = 0;
                this.updateProgressBar();

                if (this.activeRoute.points.length > 0) {
                    const firstPoint = this.activeRoute.points[0].checkpoints;
                    document.getElementById('initial-checkpoint-name').textContent = firstPoint.name;
                }
            } else {
                alert("Esta ruta no tiene puntos configurados.");
                this.renderRoundsMenu();
            }
        } catch(e) {
            console.error("Error al seleccionar ruta", e);
            alert("Error al cargar la ruta.");
        }
    }

    static showNoRounds() {
        document.getElementById('active-round-info').style.display = 'none';
        document.getElementById('guard-bottom-nav').style.display = 'none';
        document.getElementById('guard-progress-container').style.display = 'none';
        document.getElementById('no-rounds-info').style.display = 'block';
        document.getElementById('guard-status-text').textContent = "Libre";
        
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.clear();
        }
    }

    static async startRound() {
        this.roundStartTime = Date.now();

        // Registrar inicio de ronda en la BD
        const user = Auth.getUser();
        try {
            const [execution] = await ApiService.insert('round_executions', {
                route_id: this.activeRoute.id,
                guard_id: user.id,
                scheduled_datetime: new Date().toISOString(),
                start_time: new Date().toISOString(),
                status: 'in_progress'
            });
            this.activeRoundExecutionId = execution.id;
        } catch (e) {
            console.error("No se pudo registrar la ejecución", e);
        }
    }

    static updateUIForNextPoint() {
        if (this.currentSequenceIndex < this.activeRoute.points.length) {
            const nextPoint = this.activeRoute.points[this.currentSequenceIndex].checkpoints;
            document.getElementById('next-checkpoint-name').textContent = nextPoint.name;
            document.getElementById('guard-status-text').textContent = `Punto ${this.currentSequenceIndex + 1} de ${this.activeRoute.points.length}`;
            this.updateProgressBar();
        } else {
            this.completeRound();
        }
    }

    static updateProgressBar() {
        if (!this.activeRoute || !this.activeRoute.points.length) return;
        const total = this.activeRoute.points.length;
        const percentage = (this.currentSequenceIndex / total) * 100;
        document.getElementById('guard-progress-fill').style.width = `${percentage}%`;
    }

    static initScanner() {
        if (this.html5QrcodeScanner) {
            try {
                this.html5QrcodeScanner.clear();
            } catch(e) {}
        }

        this.html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }
        );

        this.html5QrcodeScanner.render(
            this.onScanSuccess.bind(this),
            (error) => { /* ignorar errores de frame vacío */ }
        );
    }

    static async onScanSuccess(decodedText, decodedResult) {
        if (this.isProcessingScan) return; // Prevenir múltiples escaneos simultáneos
        if (this.currentSequenceIndex >= this.activeRoute.points.length) return;

        this.isProcessingScan = true; // Bloquear nuevos escaneos

        const expectedPoint = this.activeRoute.points[this.currentSequenceIndex].checkpoints;

        if (decodedText === expectedPoint.unique_code) {
            // Escaneo exitoso y correcto
            
            // Intentar obtener geolocalización (no bloqueante)
            let lat = null, lng = null;
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 3000}));
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                } catch(e) { console.warn("GPS no disponible"); }
            }

            // Registrar log en BD
            try {
                await ApiService.insert('round_logs', {
                    round_execution_id: this.activeRoundExecutionId,
                    checkpoint_id: expectedPoint.id,
                    scanned_at: new Date().toISOString(),
                    latitude: lat,
                    longitude: lng
                });
            } catch(e) { console.error(e); }

            // Efecto visual/sonoro de éxito
            document.body.style.backgroundColor = 'var(--secondary-color)';
            setTimeout(() => { document.body.style.backgroundColor = 'var(--bg-color)'; }, 500);

            // Detener escáner inmediatamente
            if (this.html5QrcodeScanner) {
                try { this.html5QrcodeScanner.clear(); } catch(e) {}
            }

            // Avanzar
            this.currentSequenceIndex++;
            this.updateProgressBar();
            
            if (this.currentSequenceIndex < this.activeRoute.points.length) {
                // Mostrar pantalla intermedia de caminata
                document.getElementById('scanner-container').style.display = 'none';
                const nextPoint = this.activeRoute.points[this.currentSequenceIndex].checkpoints;
                document.getElementById('upcoming-checkpoint-name').textContent = nextPoint.name;
                document.getElementById('between-points-info').style.display = 'block';
                
                document.getElementById('btn-cancel-scan').style.display = 'none';
                document.getElementById('btn-continue-scan').style.display = 'flex';
            } else {
                // Terminar ronda directamente
                this.completeRound();
            }

        } else {
            // Escaneo incorrecto
            alert(`Punto Incorrecto.\nDebes escanear: ${expectedPoint.name}`);
        }
        
        // Liberar el bloqueo después de procesar
        setTimeout(() => {
            this.isProcessingScan = false;
        }, 1500); 
    }

    static async completeRound() {
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.clear();
        }
        
        // Registrar fin de ronda en BD
        if (this.activeRoundExecutionId) {
            try {
                await ApiService.update('round_executions', this.activeRoundExecutionId, {
                    status: 'completed',
                    end_time: new Date().toISOString()
                });
            } catch (e) {
                console.error("No se pudo actualizar el fin de la ronda", e);
            }
        }
        
        this.completedRouteIds.push(this.activeRoute.id);
        localStorage.setItem('nexo_completed_routes', JSON.stringify(this.completedRouteIds));
        
        // Esperar 4 segundos para celebrar antes de volver al inicio
        setTimeout(() => {
            document.getElementById('active-round-info').style.display = 'none';
            document.getElementById('guard-bottom-nav').style.display = 'none';
            document.getElementById('guard-progress-container').style.display = 'none';
            this.activeRoute = null;
            this.activeRoundExecutionId = null;
            this.roundStartTime = null;
            this.checkAssignedRounds();
        }, 4000);
    }

    // Traffic timer is no longer needed globally since buttons are rendered on menu load.
    // If you need real-time button updates, you could use a setInterval that calls renderRoundsMenu()

    static async reportIncident() {
        const desc = document.getElementById('incident-desc').value;
        const photoInput = document.getElementById('incident-photo');
        const user = Auth.getUser();

        let photoUrl = null;

        const btn = document.querySelector('#form-incident button[type="submit"]');
        btn.textContent = 'Subiendo...';
        btn.disabled = true;

        try {
            // Subir foto si existe
            if (photoInput.files.length > 0 && supabaseClient) {
                const file = photoInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabaseClient.storage
                    .from('incidents')
                    .upload(filePath, file);

                if (!uploadError) {
                    const { data } = supabaseClient.storage.from('incidents').getPublicUrl(filePath);
                    photoUrl = data.publicUrl;
                }
            }

            // Guardar en BD
            await ApiService.insert('incidents', {
                round_execution_id: this.activeRoundExecutionId,
                guard_id: user.id,
                description: desc,
                photo_url: photoUrl
            });

            document.getElementById('modal-incident').classList.remove('open');
            document.getElementById('incident-overlay').classList.remove('open');
            document.getElementById('form-incident').reset();
            alert('Incidente reportado exitosamente');

        } catch (e) {
            console.error(e);
            alert("Error al reportar incidente.");
        } finally {
            btn.textContent = 'Enviar Reporte';
            btn.disabled = false;
        }
    }
}

// Iniciar automáticamente si es un guardia
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isAuthenticated() && Auth.getUser().role === 'guard') {
        GuardApp.init();
    }
});
