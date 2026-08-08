// public/js/api.js

// TODO: Reemplaza estas variables con las reales de tu proyecto de Supabase
window.SUPABASE_URL = 'https://nubxyqgblvgxxrfzuwdv.supabase.co';
window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Ynh5cWdibHZneHhyZnp1d2R2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjIwOTM0NiwiZXhwIjoyMTAxNzg1MzQ2fQ.t5qM3obW4GYepYB_8Ex3F4JyuWx8yy6f1bm70TpA8Lc';

// Inicializa el cliente global (disponible en ventana porque cargamos el CDN en index.html)
// Usamos otro nombre para evitar colisionar con el objeto global window.supabase
let supabaseClient = null;

if (window.supabase && window.SUPABASE_URL.startsWith('http')) {
    try {
        supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    } catch (e) {
        console.warn("No se pudo inicializar Supabase:", e);
    }
}

class ApiService {
    // Wrapper genérico para las tablas
    static async fetch(table, match = null) {
        if (!supabaseClient) {
            console.log(`[Demo] Simulando fetch a tabla: ${table}`);
            return []; // Devuelve arreglo vacío en modo demo
        }

        let query = supabaseClient.from(table).select('*');
        if (match) {
            query = query.match(match);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async insert(table, payload) {
        if (!supabaseClient) {
            console.log(`[Demo] Simulando insert a tabla: ${table}`, payload);
            return [{ id: Math.floor(Math.random() * 1000), ...payload }];
        }

        const { data, error } = await supabaseClient.from(table).insert([payload]).select();
        if (error) throw error;
        return data;
    }
}
