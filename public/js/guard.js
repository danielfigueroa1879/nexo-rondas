// public/js/guard.js

class GuardApp {
    static activeRoute = null;
    static currentSequenceIndex = 0;
    static html5QrcodeScanner = null;
    static activeRoundExecutionId = null;
    static completedRouteIds = [];
    static isProcessingScan = false;

    static async init() {
        const user = Auth.getUser();
        if (!user || user.role !== 'guard') return;

        // Mostrar vista inicial
        document.getElementById('view-guard').style.display = 'flex';
        
        await this.checkAssignedRounds();

        // Configurar incidentes
        document.getElementById('btn-report-incident')?.addEventListener('click', () => {
            document.getElementById('modal-incident').style.display = 'flex';
        });

        document.getElementById('btn-continue-scan')?.addEventListener('click', () => {
            document.getElementById('between-points-info').style.display = 'none';
            document.getElementById('scanner-container').style.display = 'block';
            this.updateUIForNextPoint();
            this.initScanner();
        });

        document.getElementById('form-incident')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.reportIncident();
        });
    }

    static async checkAssignedRounds() {
        if (!supabaseClient) {
            this.showNoRounds();
            return;
        }

        try {
            document.getElementById('guard-status-text').textContent = "Buscando rondas pendientes...";
            
            // Lógica simplificada: obtener todas las rutas.
            const allRoutes = await ApiService.fetch('routes');
            // Filtrar las que ya completamos en esta sesión
            const routes = allRoutes.filter(r => !this.completedRouteIds.includes(r.id));
            
            if (routes && routes.length > 0) {
                // Seleccionamos la primera ruta disponible para demo
                this.activeRoute = routes[0];
                
                // Obtener los puntos de la ruta en orden estricto
                const { data: routePoints } = await supabaseClient
                    .from('route_points')
                    .select('sequence_order, checkpoints(id, name, unique_code)')
                    .eq('route_id', this.activeRoute.id)
                    .order('sequence_order', { ascending: true });

                this.activeRoute.points = routePoints || [];
                
                if (this.activeRoute.points.length > 0) {
                    this.startRound();
                } else {
                    this.showNoRounds();
                }
            } else {
                this.showNoRounds();
            }

        } catch (error) {
            console.error(error);
            document.getElementById('guard-status-text').textContent = "Error de conexión.";
        }
    }

    static showNoRounds() {
        document.getElementById('active-round-info').style.display = 'none';
        document.getElementById('btn-report-incident').style.display = 'none';
        document.getElementById('no-rounds-info').style.display = 'block';
        document.getElementById('guard-status-text').textContent = "Libre";
        
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.clear();
        }
    }

    static async startRound() {
        document.getElementById('no-rounds-info').style.display = 'none';
        document.getElementById('active-round-info').style.display = 'block';
        document.getElementById('btn-report-incident').style.display = 'block';
        
        document.getElementById('scanner-container').style.display = 'block';
        document.getElementById('between-points-info').style.display = 'none';
        
        document.getElementById('current-route-name').textContent = this.activeRoute.name;
        this.currentSequenceIndex = 0;

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

        this.updateUIForNextPoint();
        this.initScanner();
    }

    static updateUIForNextPoint() {
        if (this.currentSequenceIndex < this.activeRoute.points.length) {
            const nextPoint = this.activeRoute.points[this.currentSequenceIndex].checkpoints;
            document.getElementById('next-checkpoint-name').textContent = nextPoint.name;
            document.getElementById('guard-status-text').textContent = `Progreso: ${this.currentSequenceIndex}/${this.activeRoute.points.length}`;
        } else {
            this.completeRound();
        }
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
            
            if (this.currentSequenceIndex < this.activeRoute.points.length) {
                // Mostrar pantalla intermedia de caminata
                document.getElementById('scanner-container').style.display = 'none';
                const nextPoint = this.activeRoute.points[this.currentSequenceIndex].checkpoints;
                document.getElementById('upcoming-checkpoint-name').textContent = nextPoint.name;
                document.getElementById('between-points-info').style.display = 'block';
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
        document.getElementById('active-round-info').style.display = 'none';
        document.getElementById('btn-report-incident').style.display = 'none';
        
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.clear();
        }

        // Marcar como completada en BD
        if (this.activeRoundExecutionId && supabaseClient) {
            await supabaseClient.from('round_executions')
                .update({ end_time: new Date().toISOString(), status: 'completed' })
                .eq('id', this.activeRoundExecutionId);
        }

        this.completedRouteIds.push(this.activeRoute.id);
        
        document.getElementById('between-points-info').style.display = 'none';
        
        alert("¡Muy buen trabajo! Ronda finalizada exitosamente.");
        
        // Buscar si hay otra ronda
        this.checkAssignedRounds();
    }

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

            document.getElementById('modal-incident').style.display = 'none';
            document.getElementById('form-incident').reset();
            alert("Incidente reportado correctamente.");

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
