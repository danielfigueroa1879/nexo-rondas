// public/js/api.js

// TODO: Reemplaza estas variables con las reales de tu proyecto de Supabase
const SUPABASE_URL = 'TU_SUPABASE_URL_AQUI';
const SUPABASE_KEY = 'TU_SUPABASE_ANON_KEY_AQUI';

// Inicializa el cliente global (disponible en ventana porque cargamos el CDN en index.html)
let supabase = null;

if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

class ApiService {
    // Wrapper genérico para las tablas
    static async fetch(table, match = null) {
        if (SUPABASE_URL === 'TU_SUPABASE_URL_AQUI') {
            console.log(`[Demo] Simulando fetch a tabla: ${table}`);
            return []; // Devuelve arreglo vacío en modo demo
        }

        if (!supabase) throw new Error("Supabase no está configurado.");
        let query = supabase.from(table).select('*');
        if (match) {
            query = query.match(match);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    static async insert(table, payload) {
        if (SUPABASE_URL === 'TU_SUPABASE_URL_AQUI') {
            console.log(`[Demo] Simulando insert a tabla: ${table}`, payload);
            return [{ id: Math.floor(Math.random() * 1000), ...payload }];
        }

        if (!supabase) throw new Error("Supabase no está configurado.");
        const { data, error } = await supabase.from(table).insert([payload]).select();
        if (error) throw error;
        return data;
    }
}
