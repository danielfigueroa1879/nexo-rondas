// public/js/supervisor.js

class SupervisorDashboard {
    static executions = [];
    static incidents = [];
    static realtimeSubscription = null;
    static simInterval = null;

    static async init() {
        // Inicializar UI de botones
        document.getElementById('btn-generate-report')?.addEventListener('click', () => {
            this.generatePDFReport();
        });

        // Cargar datos iniciales
        await this.loadDashboardData();

        // Si estamos en modo demo, iniciar simulación, de lo contrario, conectar realtime
        if (!supabaseClient) {
            this.startDemoSimulation();
        } else {
            this.subscribeToRealtime();
        }
    }

    static async loadDashboardData() {
        const container = document.getElementById('live-rounds-container');
        container.innerHTML = '<p class="text-center text-secondary">Cargando datos...</p>';

        try {
            // En modo demo, creamos algunas rondas falsas
            if (!supabaseClient) {
                this.executions = [
                    { id: 1, route_id: 1, status: 'in_progress', start_time: new Date(Date.now() - 1000 * 60 * 15).toISOString(), guard_name: 'Juan Pérez', route_name: 'Ronda Perimetral' },
                    { id: 2, route_id: 2, status: 'in_progress', start_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), guard_name: 'Ana Gómez', route_name: 'Ronda Interior (Atrasada)' },
                    { id: 3, route_id: 3, status: 'completed', start_time: new Date(Date.now() - 1000 * 60 * 120).toISOString(), end_time: new Date(Date.now() - 1000 * 60 * 90).toISOString(), guard_name: 'Carlos Ruiz', route_name: 'Ronda Estacionamiento' }
                ];
                this.incidents = [
                    { id: 1, description: 'Puerta trasera sin candado', reported_at: new Date().toISOString() }
                ];
            } else {
                // Obtener datos reales de Supabase (Simplificado sin JOINs complejos para la demo)
                const { data: execs } = await supabaseClient.from('round_executions').select('*').order('start_time', { ascending: false }).limit(20);
                const { data: incs } = await supabaseClient.from('incidents').select('*').gte('reported_at', new Date(new Date().setHours(0,0,0,0)).toISOString());
                
                this.executions = execs || [];
                this.incidents = incs || [];

                // Para un sistema real, aquí haríamos fetch de los nombres de los guardias y rutas
                // asumiendo que para la demo vienen vacíos si no hay JOIN
                for (let e of this.executions) {
                    e.guard_name = 'Guardia ' + (e.guard_id ? e.guard_id.substring(0,4) : '?');
                    e.route_name = 'Ruta ' + e.route_id;
                }
            }

            this.renderDashboard();

        } catch (e) {
            console.error("Error al cargar dashboard", e);
            container.innerHTML = '<p class="text-center" style="color:var(--danger-color);">Error al cargar datos.</p>';
        }
    }

    static renderDashboard() {
        const container = document.getElementById('live-rounds-container');
        let activeCount = 0;
        let delayedCount = 0;

        let html = '';

        this.executions.forEach(exec => {
            if (exec.status === 'in_progress') activeCount++;
            
            // Heurística de atraso: Si lleva más de 60 minutos "in_progress", está atrasada.
            const startTime = new Date(exec.start_time);
            const isDelayed = exec.status === 'in_progress' && (Date.now() - startTime.getTime() > 60 * 60 * 1000);
            if (isDelayed) delayedCount++;

            const statusColor = exec.status === 'completed' ? 'var(--secondary-color)' : (isDelayed ? 'var(--danger-color)' : 'var(--primary-color)');
            const statusText = exec.status === 'completed' ? '✅ Completada' : (isDelayed ? '⚠️ Atrasada' : '🏃 En Progreso');

            html += `
                <div style="background: var(--surface-bg); border: 1px solid var(--surface-border); padding: var(--space-3); border-radius: var(--radius-sm); margin-bottom: var(--space-2); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="display: block; font-size: 1.1rem; margin-bottom: 4px;">${exec.route_name || 'Ruta Desconocida'}</strong>
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">👤 ${exec.guard_name || 'Desconocido'} | 🕒 Inicio: ${startTime.toLocaleTimeString()}</span>
                    </div>
                    <div style="background: ${statusColor}22; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; border: 1px solid ${statusColor};">
                        ${statusText}
                    </div>
                </div>
            `;
        });

        if (this.executions.length === 0) {
            html = '<p class="text-center text-secondary">No hay actividad registrada hoy.</p>';
        }

        container.innerHTML = html;

        // Actualizar contadores
        document.getElementById('stat-active').textContent = activeCount;
        document.getElementById('stat-delayed').textContent = delayedCount;
        document.getElementById('stat-incidents').textContent = this.incidents.length;
    }

    static subscribeToRealtime() {
        if (this.realtimeSubscription) return;

        console.log("Conectando a Supabase Realtime...");
        this.realtimeSubscription = supabaseClient
            .channel('public:round_executions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'round_executions' }, payload => {
                console.log("Cambio en tiempo real recibido!", payload);
                // Refrescar el dashboard al detectar un cambio
                this.loadDashboardData();
            })
            .subscribe();
    }

    static startDemoSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        console.log("Iniciando simulación de datos en tiempo real...");
        
        // Simular un cambio cada 15 segundos para propósitos de demostración
        this.simInterval = setInterval(() => {
            if (this.executions.length > 0) {
                // Hacer que la primera ronda avance el tiempo para simular atraso, o completar una
                const rand = Math.random();
                if (rand > 0.7 && this.executions[0].status === 'in_progress') {
                    this.executions[0].status = 'completed';
                    this.executions[0].end_time = new Date().toISOString();
                } else if (rand < 0.3) {
                    this.executions.unshift({
                        id: Math.floor(Math.random() * 1000),
                        route_id: 4,
                        status: 'in_progress',
                        start_time: new Date().toISOString(),
                        guard_name: 'Guardia Nuevo',
                        route_name: 'Ronda Recién Iniciada'
                    });
                }
                this.renderDashboard();
            }
        }, 15000);
    }

    static generatePDFReport() {
        if (!window.jspdf) {
            alert("La librería PDF aún no ha cargado. Intenta en unos segundos.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Título
        doc.setFontSize(22);
        doc.setTextColor(33, 150, 243); // Primary color
        doc.text("NEXO Rondas - Reporte Diario", 14, 20);
        
        // Fecha
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Fecha de generación: ${new Date().toLocaleString()}`, 14, 28);

        // Resumen
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Resumen de Actividad", 14, 40);
        
        const active = document.getElementById('stat-active').textContent;
        const delayed = document.getElementById('stat-delayed').textContent;
        const incidents = document.getElementById('stat-incidents').textContent;

        doc.setFontSize(11);
        doc.text(`Rondas Activas/Completadas: ${this.executions.length} (${active} en progreso)`, 14, 48);
        doc.text(`Alertas de Atraso: ${delayed}`, 14, 54);
        doc.text(`Incidentes Reportados: ${incidents}`, 14, 60);

        // Tabla de Ejecuciones
        doc.setFontSize(14);
        doc.text("Detalle de Rondas", 14, 75);

        const tableColumn = ["ID", "Ruta", "Guardia", "Inicio", "Estado"];
        const tableRows = [];

        this.executions.forEach(exec => {
            const execData = [
                exec.id,
                exec.route_name,
                exec.guard_name,
                new Date(exec.start_time).toLocaleTimeString(),
                exec.status === 'completed' ? 'Completada' : 'En progreso'
            ];
            tableRows.push(execData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 80,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [33, 150, 243] }
        });

        // Incidentes (Si hay)
        if (this.incidents.length > 0) {
            const finalY = doc.lastAutoTable.finalY || 80;
            doc.text("Incidentes", 14, finalY + 15);
            
            const incColumn = ["ID", "Descripción", "Hora"];
            const incRows = this.incidents.map(inc => [
                inc.id,
                inc.description,
                new Date(inc.reported_at).toLocaleTimeString()
            ]);

            doc.autoTable({
                head: [incColumn],
                body: incRows,
                startY: finalY + 20,
                theme: 'grid',
                styles: { fontSize: 9 },
                headStyles: { fillColor: [231, 76, 60] } // Danger color
            });
        }

        // Guardar PDF
        doc.save(`NEXO_Reporte_${new Date().toISOString().split('T')[0]}.pdf`);
    }
}
